import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'

export class AppDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
    const dbExists = existsSync(dbPath)
    
    // 在打包后的应用中，修复 better-sqlite3 的原生模块路径
    let dbOptions: any = {}
    if (app.isPackaged) {
      // asar: false 时，路径是 process.resourcesPath/app/node_modules/better-sqlite3
      const nativePath = join(process.resourcesPath, 'app', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
      if (existsSync(nativePath)) {
        // 使用 nativeBinding 选项直接指定原生模块路径
        dbOptions.nativeBinding = nativePath
      }
    }
    
    this.db = new Database(dbPath, dbOptions)
    this.db.pragma('journal_mode = WAL')
    
    if (!dbExists) {
      this.initTables()
    } else {
      this.migrateTasksScenarioColumns()
    }
  }

  /** 兼容旧库：为 tasks 表增加 scenario_key、scenario_name 列（若无） */
  private migrateTasksScenarioColumns() {
    try {
      const cols = this.db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[]
      const names = cols.map((c) => c.name)
      if (!names.includes('scenario_key')) {
        this.db.exec('ALTER TABLE tasks ADD COLUMN scenario_key TEXT')
      }
      if (!names.includes('scenario_name')) {
        this.db.exec('ALTER TABLE tasks ADD COLUMN scenario_name TEXT')
      }
    } catch (_) {}
  }

  private initTables() {
    // 任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        project_path TEXT,
        script_path TEXT,
        platform TEXT,
        device_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        config TEXT,
        scenario_key TEXT,
        scenario_name TEXT
      )
    `)

    // 任务执行历史表（execution_variables 为脱敏 JSON，如 phoneNumberMasked, verificationCodeMasked）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time INTEGER,
        end_time INTEGER,
        report_path TEXT,
        error_message TEXT,
        execution_variables TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `)

    // 设备表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        version TEXT,
        status TEXT DEFAULT 'disconnected',
        last_seen INTEGER DEFAULT (strftime('%s', 'now')),
        config TEXT
      )
    `)

    // 配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
  }

  query(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql)
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(params)
      } else {
        return stmt.run(params)
      }
    } catch (error) {
      console.error('Database query error:', error)
      throw error
    }
  }

  close() {
    this.db.close()
  }
}
