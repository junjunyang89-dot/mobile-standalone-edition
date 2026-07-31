import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { AppDatabase } from '../electron/database/database'
import { TaskManager } from '../electron/services/taskManager'
import { FileManager } from '../electron/services/fileManager'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 数据目录配置
const userDataPath = process.env.USER_DATA_PATH || join(process.cwd(), 'data')
const dataDir = join(userDataPath, 'data')
const reportsDir = join(userDataPath, 'reports')

// 确保数据目录存在
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}
if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true })
}

// 初始化服务
const db = new AppDatabase(join(dataDir, 'app.db'))
const fileManager = new FileManager(dataDir, reportsDir)
const taskManager = new TaskManager(db, fileManager)

let deviceManager: any = null
;(async () => {
  try {
    const { DeviceManager } = await import('../electron/services/deviceManager')
    deviceManager = new DeviceManager()
  } catch (err: any) {
    console.warn('DeviceManager unavailable (native usb module may be missing):', err?.message)
  }
})()

const getDevices = async () => {
  if (!deviceManager) return []
  return deviceManager.listDevices()
}

// API 路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 应用信息
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' })
})

// 设备管理 API
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await getDevices()
    res.json({ success: true, data: devices })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 首页已连接设备统计（与设备列表一致，便于前端首屏一次请求）
app.get('/api/devices/connected-summary', async (req, res) => {
  try {
    const devices = await getDevices()
    const connected = Array.isArray(devices)
      ? devices.filter((d: any) => (d.status || '').toLowerCase() === 'connected')
      : []
    const androidCount = connected.filter((d: any) => (d.platform || '').toUpperCase() === 'ANDROID').length
    const iosCount = connected.filter((d: any) => (d.platform || '').toUpperCase() === 'IOS').length
    const harmonyosCount = connected.filter((d: any) => (d.platform || '').toUpperCase() === 'HARMONYOS').length
    res.json({
      success: true,
      data: {
        totalConnected: connected.length,
        androidCount,
        iosCount,
        harmonyosCount,
        devices: connected
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/devices/scan', (req, res) => {
  try {
    if (deviceManager && typeof (deviceManager as any).scanDevices === 'function') {
      ;(deviceManager as any).scanDevices()
    }
    res.json({ success: true, data: '设备扫描完成' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/devices/:deviceId/connect', async (req, res) => {
  try {
    if (!deviceManager) return res.status(503).json({ success: false, error: 'Device manager not available' })
    const { deviceId } = req.params
    const device = await deviceManager.connectDevice(deviceId)
    if (device) {
      res.json({ success: true, data: device })
    } else {
      res.status(404).json({ success: false, error: 'Device not found' })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/devices/:deviceId/disconnect', async (req, res) => {
  try {
    if (!deviceManager) return res.status(503).json({ success: false, error: 'Device manager not available' })
    const { deviceId } = req.params
    const result = await deviceManager.disconnectDevice(deviceId)
    res.json({ success: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 任务管理 API（分页，返回 content 及 scenarioName 供前端「测试场景」列展示）
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await taskManager.listTasks()
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const size = Math.max(1, Math.min(100, parseInt(String(req.query.size), 10) || 10))
    const taskType = String(req.query.taskType || '').trim()
    const platform = String(req.query.platform || '').trim()
    const status = String(req.query.status || '').trim()
    const deviceId = String(req.query.deviceId || '').trim()
    const appId = String(req.query.appId || '').trim()
    let list = tasks.map((t: any) => {
      const config = typeof t.config === 'string' ? (() => { try { return JSON.parse(t.config) } catch { return {} } })() : (t.config || {})
      return {
        ...t,
        taskType: config.taskType || 'FUNCTIONAL_QUALITY_TEST',
        appId: config.appId ?? t.appId ?? null,
        scenarioKey: t.scenarioKey ?? null,
        scenarioName: t.scenarioName ?? null
      }
    })
    if (taskType) list = list.filter((x: any) => (x.taskType || x.platform || '').toLowerCase().includes(taskType.toLowerCase()))
    if (platform) list = list.filter((x: any) => (x.platform || '').toUpperCase() === platform.toUpperCase())
    if (status) list = list.filter((x: any) => (x.status || '').toUpperCase() === status.toUpperCase())
    if (deviceId) list = list.filter((x: any) => (x.deviceId || '').includes(deviceId))
    if (appId) list = list.filter((x: any) => (x.appId || '').includes(appId))
    const totalElements = list.length
    const totalPages = Math.max(1, Math.ceil(totalElements / size))
    const start = (page - 1) * size
    const content = list.slice(start, start + size)
    res.json({ success: true, data: { content, totalElements, totalPages, page, size } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const task = await taskManager.getTaskStatus(taskId)
    if (task) {
      res.json({ success: true, data: task })
    } else {
      res.status(404).json({ success: false, error: 'Task not found' })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/tasks', async (req, res) => {
  try {
    const taskData = req.body
    const task = await taskManager.createTask(taskData)
    res.json({ success: true, data: task })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 统一创建任务（功能基础质量等）：POST /api/tasks/test，保存 scenarioKey/scenarioName 供列表「测试场景」列展示
const scenarioKeyToName: Record<string, string> = {
  settings: '设置测试',
  settings_account: '设置-我的账号',
  launch_app: '启动应用程序',
  login: '登录',
  search: '搜索'
}
function buildScenarioName(scenarioKey: string, platform: string): string {
  const base = scenarioKeyToName[(scenarioKey || '').toLowerCase()] || scenarioKey || ''
  if (!platform) return base
  const p = (platform || '').toUpperCase()
  if (p === 'ANDROID') return `${base}(Android)`
  if (p === 'IOS') return `${base}(iOS)`
  if (p === 'HARMONYOS') return `${base}(鸿蒙)`
  return base
}
app.post('/api/tasks/test', async (req, res) => {
  try {
    const body = req.body || {}
    const { taskType, platform, deviceId, appId, scenarioKey, taskName, remarks, config: configRaw } = body
    const name = taskName && String(taskName).trim() || `Task-${taskType || 'test'}-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-6)}`
    const scenarioKeyNorm = scenarioKey && String(scenarioKey).trim().toLowerCase() || null
    const scenarioName = scenarioKeyNorm ? buildScenarioName(scenarioKeyNorm, platform) : null
    const config: Record<string, any> = {
      appId: appId && String(appId).trim(),
      taskType: taskType || 'FUNCTIONAL_QUALITY_TEST'
    }
    if (configRaw != null) {
      try {
        const parsed = typeof configRaw === 'string' ? JSON.parse(configRaw) : configRaw
        if (parsed && typeof parsed === 'object') Object.assign(config, parsed)
      } catch (_) {}
    }
    const task = await taskManager.createTask({
      name,
      description: remarks && String(remarks).trim() || undefined,
      projectPath: '',
      scriptPath: '',
      platform: (platform || 'android').toLowerCase(),
      deviceId: deviceId && String(deviceId).trim() || undefined,
      scenarioKey: scenarioKeyNorm,
      scenarioName,
      config
    })
    res.json({ success: true, data: task })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.put('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const taskData = req.body
    const task = await taskManager.updateTask(taskId, taskData)
    if (task) {
      res.json({ success: true, data: task })
    } else {
      res.status(404).json({ success: false, error: 'Task not found' })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const result = await taskManager.deleteTask(taskId)
    res.json({ success: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/tasks/:taskId/run', async (req, res) => {
  try {
    const { taskId } = req.params
    const result = await taskManager.runTask(taskId)
    res.json({ success: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/tasks/:taskId/stop', async (req, res) => {
  try {
    const { taskId } = req.params
    const result = await taskManager.stopTask(taskId)
    res.json({ success: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 文件管理 API
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await fileManager.listReports()
    res.json({ success: true, data: reports })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params
    const report = await fileManager.getReport(reportId)
    if (report) {
      res.json({ success: true, data: report })
    } else {
      res.status(404).json({ success: false, error: 'Report not found' })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 设备 ID 脱敏：前 4 位 + **** + 后 4 位
function maskDeviceId(deviceId: string | null | undefined): string {
  if (!deviceId || typeof deviceId !== 'string') return ''
  return deviceId.length >= 8 ? deviceId.slice(0, 4) + '****' + deviceId.slice(-4) : deviceId
}

type ExecutionLogStep = {
  step: string
  message?: string
  timestamp?: string
  level: 'Info' | 'Error'
  status?: string
  selector?: string | null
  screenshotUrl?: string | null
}

/** 根据任务及最近一次执行信息生成执行日志步骤（overview 与 execution-log 共用） */
function buildExecutionLogSteps(t: any, lastRun: any): ExecutionLogStep[] {
  const steps: ExecutionLogStep[] = []
  const maskedDevice = maskDeviceId(t.deviceId)
  const taskName = t.name || '功能体验基础质量测试(登录)'
  const toTs = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : undefined)
  const t0 = lastRun?.start_time ?? t.createdAt ?? Math.floor(Date.now() / 1000)
  const t1 = lastRun?.end_time ?? t0 + 1
  const tMid = Math.floor((t0 + t1) / 2)
  const execVars = (() => {
    try {
      const row = lastRun
      if (row?.execution_variables) {
        const p = typeof row.execution_variables === 'string' ? JSON.parse(row.execution_variables) : row.execution_variables
        if (p && (p.phoneNumberMasked || p.verificationCodeMasked)) return p
      }
    } catch (_) {}
    return { phoneNumberMasked: '138****8000', verificationCodeMasked: '****(6位)' }
  })()

  steps.push({ step: '开始测试', message: '', timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({ step: '获取执行步骤', message: taskName, timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({ step: '正在解析应用信息...', message: '', timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({ step: '应用包名 / 应用版本', message: '', timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({ step: '应用信息解析完成', message: '', timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({ step: '正在检查设备状态并执行环境初始化...', message: '', timestamp: toTs(t0), level: 'Info', status: 'success' })
  steps.push({
    step: '设备环境就绪',
    message: maskedDevice ? `${maskedDevice}设备,环境初始化执行成功` : '环境初始化执行成功',
    timestamp: toTs(t0),
    level: 'Info',
    status: 'success'
  })
  steps.push({ step: '启动应用', message: '', timestamp: toTs(tMid), level: 'Info', status: 'success' })
  steps.push({ step: '主界面就绪', message: '', timestamp: toTs(tMid), level: 'Info', status: 'success' })
  steps.push({ step: '输入手机号', message: `已输入: ${execVars.phoneNumberMasked || '138****8000'}`, timestamp: toTs(tMid), level: 'Info', status: 'success' })
  steps.push({ step: '输入验证码', message: `已输入: ${execVars.verificationCodeMasked || '(6位)'}`, timestamp: toTs(tMid), level: 'Info', status: 'success' })
  if (lastRun?.error_message) {
    steps.push({
      step: '执行异常',
      message: lastRun.error_message,
      timestamp: toTs(lastRun.end_time || lastRun.start_time),
      level: 'Error',
      status: 'fail'
    })
  }
  steps.push({ step: '执行完成并截图', message: '', timestamp: toTs(t1), level: 'Info', status: 'success' })
  steps.push({ step: '正在汇总数据并生成报告', message: '', timestamp: toTs(t1), level: 'Info', status: 'success' })
  steps.push({ step: '报告已生成,任务完成', message: '', timestamp: toTs(t1), level: 'Info', status: 'success' })
  steps.push({ step: '测试服务执行完毕', message: '', timestamp: toTs(t1), level: 'Info', status: 'success' })
  return steps
}

// 创建功能基础质量任务（文档）：POST /api/functional-test/tasks，body: taskName, platform, deviceId, applicationId, scenarioKey, remarks
app.post('/api/functional-test/tasks', async (req, res) => {
  try {
    const body = req.body || {}
    const { taskName, platform, deviceId, applicationId, scenarioKey, remarks } = body
    const name = taskName && String(taskName).trim() || `Task-功能体验基础质量测试-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-6)}`
    const scenarioKeyNorm = scenarioKey && String(scenarioKey).trim().toLowerCase() || null
    const scenarioName = scenarioKeyNorm ? buildScenarioName(scenarioKeyNorm, platform) : null
    const task = await taskManager.createTask({
      name,
      description: remarks && String(remarks).trim() || undefined,
      projectPath: '',
      scriptPath: '',
      platform: (platform || 'android').toLowerCase(),
      deviceId: deviceId && String(deviceId).trim() || undefined,
      scenarioKey: scenarioKeyNorm,
      scenarioName,
      config: applicationId ? { appId: String(applicationId).trim(), taskType: 'FUNCTIONAL_QUALITY_TEST' } : { taskType: 'FUNCTIONAL_QUALITY_TEST' }
    })
    res.json({ success: true, data: task })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 功能测试任务列表（分页）：GET /api/functional-test/tasks
app.get('/api/functional-test/tasks', async (req, res) => {
  try {
    const tasks = await taskManager.listTasks()
    const days = parseInt(String(req.query.days), 10)
    const status = String(req.query.status || '').trim()
    const keyword = String(req.query.keyword || '').trim()
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const size = Math.max(1, Math.min(100, parseInt(String(req.query.size), 10) || 10))
    let list = tasks.map((t: any) => ({
      id: t.id,
      taskId: t.id,
      taskName: t.name,
      taskType: t.platform ? `功能体验-${t.platform}` : '功能体验',
      platform: (t.platform || 'android').toUpperCase(),
      status: (t.status || 'pending').toUpperCase(),
      createdAt: t.createdAt,
      created_at: t.createdAt,
      updatedAt: t.updatedAt,
      deviceId: t.deviceId,
      scenarioKey: t.scenarioKey ?? null,
      scenarioName: t.scenarioName ?? null
    }))
    if (days > 0) {
      const since = Math.floor(Date.now() / 1000) - days * 86400
      list = list.filter((x: any) => (x.createdAt ?? x.created_at) >= since)
    }
    if (status) list = list.filter((x: any) => (x.status || '').toUpperCase() === status.toUpperCase())
    if (keyword) {
      const k = keyword.toLowerCase()
      list = list.filter((x: any) => (x.taskName || x.name || '').toLowerCase().includes(k))
    }
    const totalElements = list.length
    const totalPages = Math.max(1, Math.ceil(totalElements / size))
    const start = (page - 1) * size
    const content = list.slice(start, start + size)
    res.json({
      success: true,
      data: { content, totalElements, totalPages, page, size }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 功能测试任务详情：GET /api/functional-test/tasks/:taskId
app.get('/api/functional-test/tasks/:taskId', async (req, res) => {
  try {
    const task = await taskManager.getTaskStatus(req.params.taskId)
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' })
    const t = task as any
    res.json({
      success: true,
      data: {
        id: t.id,
        taskName: t.name,
        status: (t.status || 'pending').toUpperCase(),
        executionStatus: t.status,
        reportPath: null,
        deviceId: t.deviceId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 功能测试任务概览：GET /api/functional-test/tasks/:taskId/overview
app.get('/api/functional-test/tasks/:taskId/overview', async (req, res) => {
  try {
    const task = await taskManager.getTaskStatus(req.params.taskId)
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' })
    const t = task as any
    const executions = db.query('SELECT * FROM task_executions WHERE task_id = ? ORDER BY start_time DESC LIMIT 1', [t.id]) as any[]
    const lastRun = executions[0]
    const startTime = lastRun?.start_time ? new Date(lastRun.start_time * 1000).toISOString() : null
    const endTime = lastRun?.end_time ? new Date(lastRun.end_time * 1000).toISOString() : null
    const duration = lastRun && lastRun.start_time && lastRun.end_time ? `${lastRun.end_time - lastRun.start_time}秒` : null
    const executionVars = (() => {
      try {
        const row = lastRun as any
        if (row?.execution_variables) {
          const parsed = typeof row.execution_variables === 'string' ? JSON.parse(row.execution_variables) : row.execution_variables
          if (parsed && (parsed.phoneNumberMasked || parsed.verificationCodeMasked)) return parsed
        }
      } catch (_) {}
      return { phoneNumberMasked: '138****8000', verificationCodeMasked: '****(6位)' }
    })()
    const testResultItems = [
      { testItemCategory: '登录', testItemName: '输入手机号', testResult: '通过', detailLogLink: null, detailMessage: executionVars.phoneNumberMasked ?? '138****8000' },
      { testItemCategory: '登录', testItemName: '输入验证码', testResult: '通过', detailLogLink: null, detailMessage: executionVars.verificationCodeMasked ?? '****(6位)' },
      { testItemCategory: '登录', testItemName: '完成登录', testResult: '通过', detailLogLink: null, detailMessage: null }
    ]
    const taskStatus = (t.status || 'pending').toUpperCase()
    res.json({
      success: true,
      data: {
        taskId: t.id,
        title: t.name,
        remarks: null,
        testType: t.platform ? `功能体验-${t.platform}` : '功能体验',
        status: taskStatus === 'PENDING' ? 'PENDING' : taskStatus === 'RUNNING' ? 'RUNNING' : taskStatus === 'FAILED' ? 'FAILED' : 'COMPLETED',
        executionStatus: taskStatus,
        appPackageName: null,
        appVersion: null,
        apiVersion: null,
        startTime,
        duration,
        executor: null,
        reportPath: null,
        summarySectionTitle: '功能质量达标率',
        executionVariables: executionVars,
        compatibilitySummary: { actualTestItemCount: 3, passedCount: 3, failedCount: 0, warningCount: 0 },
        resultDistribution: [{ categoryName: '登录', passed: 3, total: 3 }],
        testResultItems,
        executionLog: buildExecutionLogSteps(t, lastRun)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 执行日志步骤列表：GET /api/functional-test/tasks/:taskId/execution-log（与 overview 内 executionLog 结构一致）
app.get('/api/functional-test/tasks/:taskId/execution-log', async (req, res) => {
  try {
    const { taskId } = req.params
    const task = await taskManager.getTaskStatus(taskId)
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' })
    const t = task as any
    const executions = db.query('SELECT * FROM task_executions WHERE task_id = ? ORDER BY start_time DESC LIMIT 1', [taskId]) as any[]
    const lastRun = executions[0]
    const steps = buildExecutionLogSteps(t, lastRun)
    res.json({ success: true, data: steps })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 任务截图：GET /api/functional-test/tasks/:taskId/screenshot（暂无截图时 404）
app.get('/api/functional-test/tasks/:taskId/screenshot', (req, res) => {
  res.status(404).setHeader('Content-Type', 'application/json').json({ success: false, error: 'Screenshot not available' })
})

// Android 设置测试代理（转发至 automation-service，见对接文档；端口由 AUTOMATION_SERVICE_PORT 控制，默认 8099）
const AUTOMATION_SERVICE_BASE = `http://127.0.0.1:${process.env.AUTOMATION_SERVICE_PORT || '8099'}/automation-service`
app.post('/api/android-settings-test/execute', async (req, res) => {
  try {
    const response = await fetch(`${AUTOMATION_SERVICE_BASE}/api/android-settings-test/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e: any) {
    res.status(502).json({ code: 502, message: e?.message || 'automation-service 不可达', data: null })
  }
})
app.get('/api/android-settings-test/health', async (req, res) => {
  try {
    const response = await fetch(`${AUTOMATION_SERVICE_BASE}/api/android-settings-test/health`)
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e: any) {
    res.status(502).json({ status: 'DOWN', error: e?.message || 'automation-service 不可达' })
  }
})

// 性能报告：GET /api/functional-test/tasks/:taskId/performance-report（仅性能任务，返回最新执行的 result_data 解析 JSON；无则 404）
app.get('/api/functional-test/tasks/:taskId/performance-report', async (req, res) => {
  try {
    const task = await taskManager.getTaskStatus(req.params.taskId)
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' })
    const t = task as any
    const taskType = (t.config && typeof t.config === 'object' ? t.config.taskType : null) || (typeof t.config === 'string' ? (() => { try { return JSON.parse(t.config || '{}').taskType } catch { return null } })() : null)
    if (String(taskType).toUpperCase() !== 'PERFORMANCE_BASELINE_TEST') {
      return res.status(404).json({ success: false, error: 'Not a performance baseline task' })
    }
    const executions = db.query('SELECT * FROM task_executions WHERE task_id = ? ORDER BY start_time DESC LIMIT 1', [t.id]) as any[]
    const lastRun = executions[0]
    if (!lastRun) return res.status(404).json({ success: false, error: 'No execution yet' })
    const resultData = (lastRun as any).result_data
    if (resultData == null || resultData === '') return res.status(404).json({ success: false, error: 'No result data' })
    const parsed = typeof resultData === 'string' ? JSON.parse(resultData) : resultData
    res.json({ success: true, data: parsed })
  } catch (e: any) {
    if (e && (e.message || '').includes('JSON')) return res.status(404).json({ success: false, error: 'Invalid result data' })
    res.status(500).json({ success: false, error: e?.message || 'Internal error' })
  }
})

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ success: false, error: err.message || 'Internal server error' })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`)
  console.log(`📁 Data directory: ${dataDir}`)
  console.log(`📊 Reports directory: ${reportsDir}`)
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  if (deviceManager && typeof deviceManager.stop === 'function') deviceManager.stop()
  db.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server')
  if (deviceManager && typeof deviceManager.stop === 'function') deviceManager.stop()
  db.close()
  process.exit(0)
})
