import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import {
  disposeLocalWorker,
  ensureLocalWorker,
  loadNodeConfig,
  localWorkerUrl,
  restartLocalWorker,
  saveNodeConfig
} from './workerSidecar'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
let mainWindow: BrowserWindow | null = null

// 延迟加载，避免启动时加载原生模块
let db: any = null
let deviceManager: any = null
let taskManager: any = null
let fileManager: any = null
let servicesLoadAttempted = false

async function loadServices() {
  if (servicesLoadAttempted) return
  servicesLoadAttempted = true

  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'data')
  const reportsDir = join(userDataPath, 'reports')

  // better-sqlite3 要求数据库文件所在目录已存在；先保证 userData 再创建子目录
  if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true })
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

  try {
    const { AppDatabase } = await import('../database/database')
    const { TaskManager } = await import('../services/taskManager')
    const { FileManager } = await import('../services/fileManager')

    db = new AppDatabase(join(dataDir, 'app.db'))
    fileManager = new FileManager(dataDir, reportsDir)
    taskManager = new TaskManager(db, fileManager)
  } catch (error) {
    console.error('Failed to load core services:', error)
  }

  // DeviceManager 依赖原生模块 usb，在 Electron 下可能无对应 native build，单独加载并忽略失败
  try {
    const { DeviceManager } = await import('../services/deviceManager')
    deviceManager = new DeviceManager()
  } catch (error) {
    console.warn('Device manager unavailable (native usb module may not be built for this Electron version):', (error as Error)?.message ?? error)
    deviceManager = null
  }
}

// 数据目录将在 loadServices 中初始化

function createWindow() {
  const preloadPath = isDev
    ? join(__dirname, '../preload/index.js')
    : join(__dirname, '../preload/index.js')
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev
    },
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // 设置 IPC 处理器（不依赖本地服务）
  setupIpcHandlers()

  createWindow()

  if (app.isPackaged) {
    ensureLocalWorker().then((r) => {
      console.log('[worker]', r.message, r.url)
    }).catch((err) => {
      console.error('[worker] start failed', err)
    })
  }

  // 延迟加载服务（在后台加载，避免阻塞启动）
  loadServices().catch(err => {
    console.error('Background service loading failed:', err)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  disposeLocalWorker()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  disposeLocalWorker()
  if (deviceManager && typeof deviceManager.stop === 'function') {
    deviceManager.stop()
  }
  if (db && typeof db.close === 'function') {
    db.close()
  }
})

function setupIpcHandlers() {
  // IPC Handlers
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('node:is-packaged', () => app.isPackaged)
  const nodeConfigPayload = () => {
    const cfg = loadNodeConfig()
    return {
      ...cfg,
      workerUrl: localWorkerUrl(cfg),
      packaged: app.isPackaged
    }
  }
  ipcMain.handle('node:get-config', () => nodeConfigPayload())
  ipcMain.on('node:get-config-sync', (event) => {
    event.returnValue = nodeConfigPayload()
  })
  ipcMain.handle('node:set-control-plane', async (_, url: string) => {
    saveNodeConfig({ controlPlaneUrl: String(url || '').trim() })
    if (app.isPackaged) {
      return restartLocalWorker()
    }
    return { ok: true, url: localWorkerUrl(), message: '开发模式未拉起安装包内的执行节点' }
  })
  ipcMain.handle('node:worker-status', () => ensureLocalWorker())

  // 设备管理（延迟加载；无 native 模块时返回空，不抛错，前端可依赖后端 HTTP 接口）
  ipcMain.handle('device:list', async () => {
    await loadServices()
    if (!deviceManager) return []
    return await deviceManager.listDevices()
  })

  ipcMain.handle('device:connect', async (_, deviceId: string) => {
    await loadServices()
    if (!deviceManager) return { ok: false, error: 'Device manager not available' }
    return await deviceManager.connectDevice(deviceId)
  })

  ipcMain.handle('device:disconnect', async (_, deviceId: string) => {
    await loadServices()
    if (!deviceManager) return { ok: false, error: 'Device manager not available' }
    return await deviceManager.disconnectDevice(deviceId)
  })

  // 任务管理（延迟加载）
  ipcMain.handle('task:list', async () => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.listTasks()
  })

  ipcMain.handle('task:create', async (_, taskData: any) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.createTask(taskData)
  })

  ipcMain.handle('task:update', async (_, taskId: string, taskData: any) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.updateTask(taskId, taskData)
  })

  ipcMain.handle('task:delete', async (_, taskId: string) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.deleteTask(taskId)
  })

  ipcMain.handle('task:run', async (_, taskId: string) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.runTask(taskId)
  })

  ipcMain.handle('task:stop', async (_, taskId: string) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.stopTask(taskId)
  })

  ipcMain.handle('task:get-status', async (_, taskId: string) => {
    await loadServices()
    if (!taskManager) throw new Error('Task manager not available')
    return await taskManager.getTaskStatus(taskId)
  })

  // 文件管理（延迟加载）
  ipcMain.handle('file:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:read-project', async (_, path: string) => {
    await loadServices()
    if (!fileManager) throw new Error('File manager not available')
    return await fileManager.readProject(path)
  })

  ipcMain.handle('file:list-reports', async () => {
    await loadServices()
    if (!fileManager) return []
    return await fileManager.listReports()
  })

  ipcMain.handle('file:get-report', async (_, reportId: string) => {
    await loadServices()
    if (!fileManager) return null
    return await fileManager.getReport(reportId)
  })

  // 数据库操作（延迟加载）
  ipcMain.handle('db:query', async (_, sql: string, params: any[]) => {
    await loadServices()
    if (!db) throw new Error('Database not available')
    return await db.query(sql, params)
  })

  // 监听设备变化（延迟加载）
  loadServices().then(() => {
    if (deviceManager) {
      deviceManager.on('device-connected', (device: any) => {
        mainWindow?.webContents.send('device:connected', device)
      })

      deviceManager.on('device-disconnected', (deviceId: string) => {
        mainWindow?.webContents.send('device:disconnected', deviceId)
      })
    }
  }).catch(() => {
    // 忽略加载错误
  })
}
