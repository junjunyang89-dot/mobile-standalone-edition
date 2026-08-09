import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { SupportedDevicePlatform } from '@/utils/platform'

export interface Task {
  id: string
  name: string
  description?: string
  projectPath?: string
  scriptPath?: string
  platform:
    | 'android'
    | 'ios'
    | 'harmonyos'
    | 'pog_android'
    | 'pog_ios'
    | 'ANDROID'
    | 'IOS'
    | 'HARMONYOS'
  deviceId?: string
  appId?: string
  taskType?: string
  /** 测试场景展示名（如「设置测试(Android)」「设置-我的账号(iOS)」），列表/详情用 */
  scenarioName?: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED'
  createdAt: number | string
  updatedAt: number | string
  config?: any
}

export interface TaskQuery {
  taskType?: string
  platform?: SupportedDevicePlatform | string
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED'
  deviceId?: string
  appId?: string
}

export interface TaskPagination {
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const pagination = ref<TaskPagination>({
    page: 1,
    size: 10,
    totalElements: 0,
    totalPages: 0
  })

  const fetchTasks = async (filters?: TaskQuery, pageSize?: { page: number; size: number }) => {
    loading.value = true
    try {
      const p = pageSize ?? { page: pagination.value.page, size: pagination.value.size }
      const res = await apiClient.getTasks(filters, p)
      tasks.value = res.content ?? []
      pagination.value = {
        page: res.page ?? p.page,
        size: res.size ?? p.size,
        totalElements: res.totalElements ?? 0,
        totalPages: res.totalPages ?? 0
      }
    } catch (error) {
      console.error('Fetch tasks error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const createTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    try {
      await apiClient.createTask(taskData)
      await fetchTasks()
    } catch (error) {
      console.error('Create task error:', error)
      throw error
    }
  }

  /** 统一创建任务：POST /api/tasks/test，必填 taskType/platform/deviceId/appId。流程用例请传 UI_FLOW_TEST 并在配置中绑定 flowId。 */
  const createTestTask = async (body: {
    taskType: string
    platform: SupportedDevicePlatform | string
    deviceId: string
    appId: string
    taskName?: string
    remarks?: string
    config?: string
    scenarioKey?: string
  }) => {
    try {
      const result = await apiClient.createTestTask(body)
      await fetchTasks()
      return result
    } catch (error) {
      console.error('Create test task error:', error)
      throw error
    }
  }

  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    try {
      await apiClient.updateTask(taskId, taskData)
      await fetchTasks()
    } catch (error) {
      console.error('Update task error:', error)
      throw error
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId)
      await fetchTasks()
    } catch (error) {
      console.error('Delete task error:', error)
      throw error
    }
  }

  const runTask = async (taskId: string) => {
    try {
      await apiClient.runTask(taskId)
      await fetchTasks()
    } catch (error) {
      console.error('Run task error:', error)
      throw error
    }
  }

  const stopTask = async (taskId: string) => {
    try {
      await apiClient.stopTask(taskId)
      await fetchTasks()
    } catch (error) {
      console.error('Stop task error:', error)
      throw error
    }
  }

  return {
    tasks,
    loading,
    pagination,
    fetchTasks,
    createTask,
    createTestTask,
    updateTask,
    deleteTask,
    runTask,
    stopTask
  }
})
