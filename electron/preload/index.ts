import { contextBridge, ipcRenderer } from 'electron'

function readBootNodeConfig() {
  try {
    return ipcRenderer.sendSync('node:get-config-sync')
  } catch {
    return null
  }
}

const bootNodeConfig = readBootNodeConfig()

contextBridge.exposeInMainWorld('bootNodeConfig', bootNodeConfig)

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  isPackaged: () => ipcRenderer.invoke('node:is-packaged'),
  getNodeConfig: () => ipcRenderer.invoke('node:get-config'),
  setControlPlane: (url: string) => ipcRenderer.invoke('node:set-control-plane', url),
  getWorkerStatus: () => ipcRenderer.invoke('node:worker-status'),

  // 设备管理
  device: {
    list: () => ipcRenderer.invoke('device:list'),
    connect: (deviceId: string) => ipcRenderer.invoke('device:connect', deviceId),
    disconnect: (deviceId: string) => ipcRenderer.invoke('device:disconnect', deviceId),
    onConnected: (callback: (device: any) => void) => {
      ipcRenderer.on('device:connected', (_, device) => callback(device))
    },
    onDisconnected: (callback: (deviceId: string) => void) => {
      ipcRenderer.on('device:disconnected', (_, deviceId) => callback(deviceId))
    }
  },

  // 任务管理
  task: {
    list: () => ipcRenderer.invoke('task:list'),
    create: (taskData: any) => ipcRenderer.invoke('task:create', taskData),
    update: (taskId: string, taskData: any) => ipcRenderer.invoke('task:update', taskId, taskData),
    delete: (taskId: string) => ipcRenderer.invoke('task:delete', taskId),
    run: (taskId: string) => ipcRenderer.invoke('task:run', taskId),
    stop: (taskId: string) => ipcRenderer.invoke('task:stop', taskId),
    getStatus: (taskId: string) => ipcRenderer.invoke('task:get-status', taskId)
  },

  // 文件管理
  file: {
    selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
    readProject: (path: string) => ipcRenderer.invoke('file:read-project', path),
    listReports: () => ipcRenderer.invoke('file:list-reports'),
    getReport: (reportId: string) => ipcRenderer.invoke('file:get-report', reportId)
  },

  // 数据库操作
  db: {
    query: (sql: string, params: any[]) => ipcRenderer.invoke('db:query', sql, params)
  }
})
