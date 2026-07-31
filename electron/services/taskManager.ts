import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { AppDatabase } from '../database/database'
import { FileManager } from './fileManager'
import { v4 as uuidv4 } from 'uuid'

export interface Task {
  id: string
  name: string
  description?: string
  projectPath: string
  scriptPath: string
  platform: 'android' | 'ios' | 'harmonyos'
  deviceId?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  createdAt: number
  updatedAt: number
  config?: any
  scenarioKey?: string | null
  scenarioName?: string | null
}

export class TaskManager extends EventEmitter {
  private db: AppDatabase
  private fileManager: FileManager
  private runningTasks: Map<string, ChildProcess> = new Map()

  constructor(db: AppDatabase, fileManager: FileManager) {
    super()
    this.db = db
    this.fileManager = fileManager
  }

  async listTasks(): Promise<Task[]> {
    const rows = this.db.query('SELECT * FROM tasks ORDER BY created_at DESC') as any[]
    return rows.map(this.mapRowToTask)
  }

  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Task> {
    const id = uuidv4()
    const now = Math.floor(Date.now() / 1000)
    
    this.db.query(
      `INSERT INTO tasks (id, name, description, project_path, script_path, platform, device_id, status, created_at, updated_at, config, scenario_key, scenario_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        taskData.name,
        taskData.description || null,
        taskData.projectPath,
        taskData.scriptPath,
        taskData.platform,
        taskData.deviceId || null,
        'pending',
        now,
        now,
        taskData.config ? JSON.stringify(taskData.config) : null,
        taskData.scenarioKey ?? null,
        taskData.scenarioName ?? null
      ]
    )

    return await this.getTask(id) as Task
  }

  async updateTask(taskId: string, taskData: Partial<Task>): Promise<Task | null> {
    const task = await this.getTask(taskId)
    if (!task) return null

    const updates: string[] = []
    const values: any[] = []

    if (taskData.name !== undefined) {
      updates.push('name = ?')
      values.push(taskData.name)
    }
    if (taskData.description !== undefined) {
      updates.push('description = ?')
      values.push(taskData.description)
    }
    if (taskData.status !== undefined) {
      updates.push('status = ?')
      values.push(taskData.status)
    }
    if (taskData.config !== undefined) {
      updates.push('config = ?')
      values.push(JSON.stringify(taskData.config))
    }

    updates.push('updated_at = ?')
    values.push(Math.floor(Date.now() / 1000))
    values.push(taskId)

    this.db.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return await this.getTask(taskId) as Task
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const result = this.db.query('DELETE FROM tasks WHERE id = ?', [taskId]) as any
    return result.changes > 0
  }

  async getTask(taskId: string): Promise<Task | null> {
    const rows = this.db.query('SELECT * FROM tasks WHERE id = ?', [taskId]) as any[]
    if (rows.length === 0) return null
    return this.mapRowToTask(rows[0])
  }

  async runTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId)
    if (!task || task.status === 'running') {
      return false
    }

    await this.updateTask(taskId, { status: 'running' })
    
    // 实际执行逻辑：启动Java/Maven进程运行测试脚本
    const executionId = uuidv4()
    const startTime = Date.now()

    try {
      // 这里应该调用实际的自动化框架
      // 例如：mvn test -Dtest=TestClass
      const child = this.executeTestTask(task)
      this.runningTasks.set(taskId, child)

      child.on('exit', async (code) => {
        this.runningTasks.delete(taskId)
        const endTime = Date.now()
        const status = code === 0 ? 'completed' : 'failed'
        
        await this.updateTask(taskId, { status })
        
        // 记录执行历史
        this.db.query(
          `INSERT INTO task_executions (id, task_id, status, start_time, end_time, error_message)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [executionId, taskId, status, Math.floor(startTime / 1000), Math.floor(endTime / 1000), code !== 0 ? `Exit code: ${code}` : null]
        )
      })

      child.on('error', async (error) => {
        this.runningTasks.delete(taskId)
        await this.updateTask(taskId, { status: 'failed' })
        
        this.db.query(
          `INSERT INTO task_executions (id, task_id, status, start_time, error_message)
           VALUES (?, ?, ?, ?, ?)`,
          [executionId, taskId, 'failed', Math.floor(startTime / 1000), error.message]
        )
      })

      return true
    } catch (error: any) {
      await this.updateTask(taskId, { status: 'failed' })
      return false
    }
  }

  private executeTestTask(task: Task): ChildProcess {
    // 实际项目中应该调用Java/Maven来执行测试
    // 这里是一个示例
    const command = process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
    const args = ['test', '-Dtest=TestClass']
    
    return spawn(command, args, {
      cwd: task.projectPath,
      stdio: 'pipe'
    })
  }

  async stopTask(taskId: string): Promise<boolean> {
    const child = this.runningTasks.get(taskId)
    if (child) {
      child.kill()
      this.runningTasks.delete(taskId)
      await this.updateTask(taskId, { status: 'stopped' })
      return true
    }
    return false
  }

  async getTaskStatus(taskId: string): Promise<Task | null> {
    return await this.getTask(taskId)
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      projectPath: row.project_path,
      scriptPath: row.script_path,
      platform: row.platform,
      deviceId: row.device_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      config: row.config ? JSON.parse(row.config) : undefined,
      scenarioKey: row.scenario_key ?? undefined,
      scenarioName: row.scenario_name ?? undefined
    }
  }
}
