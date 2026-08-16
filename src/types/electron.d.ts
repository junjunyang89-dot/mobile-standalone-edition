export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  isPackaged: () => Promise<boolean>
  getNodeConfig: () => Promise<{
    controlPlaneUrl: string
    workerPort: number
    workerUrl: string
    packaged: boolean
  }>
  setControlPlane: (url: string) => Promise<{ ok: boolean; url: string; message: string }>
  getWorkerStatus: () => Promise<{ ok: boolean; url: string; message: string }>
  device: {
    list: () => Promise<any[]>
    connect: (deviceId: string) => Promise<any>
    disconnect: (deviceId: string) => Promise<any>
    onConnected: (callback: (device: any) => void) => void
    onDisconnected: (callback: (deviceId: string) => void) => void
  }
  task: {
    list: () => Promise<any[]>
    create: (taskData: any) => Promise<any>
    update: (taskId: string, taskData: any) => Promise<any>
    delete: (taskId: string) => Promise<any>
    run: (taskId: string) => Promise<boolean>
    stop: (taskId: string) => Promise<boolean>
    getStatus: (taskId: string) => Promise<any>
  }
  file: {
    selectDirectory: () => Promise<string | null>
    readProject: (path: string) => Promise<any>
    listReports: () => Promise<any[]>
    getReport: (reportId: string) => Promise<any>
  }
  db: {
    query: (sql: string, params: any[]) => Promise<any>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    bootNodeConfig?: {
      controlPlaneUrl: string
      workerPort: number
      workerUrl: string
      packaged: boolean
    } | null
  }
}
