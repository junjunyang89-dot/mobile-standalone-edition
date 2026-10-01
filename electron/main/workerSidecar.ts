import { app } from 'electron'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, createWriteStream } from 'fs'
import { join } from 'path'

const WORKER_PORT = 3001
const DEV_DEFAULT_CONTROL = 'http://127.0.0.1:3080/api'

export type NodeConfig = {
  controlPlaneUrl: string
  workerPort: number
}

let workerProc: ChildProcess | null = null

function isLoopbackUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  } catch {
    return false
  }
}

/** 安装包 extraResources 里的控制面地址；开发模式没有这份文件。 */
function packagedControlPlaneUrl(): string {
  const candidates = [
    join(process.resourcesPath || '', 'control-plane.json'),
    join(app.getAppPath(), 'resources', 'control-plane.json')
  ]
  for (const file of candidates) {
    try {
      if (!file || !existsSync(file)) continue
      const url = String(JSON.parse(readFileSync(file, 'utf8')).controlPlaneUrl || '').trim()
      if (url && !isLoopbackUrl(url)) return url
    } catch {
      /* try next */
    }
  }
  return ''
}

function defaultControlPlaneUrl() {
  if (app.isPackaged) {
    return packagedControlPlaneUrl() || DEV_DEFAULT_CONTROL
  }
  return DEV_DEFAULT_CONTROL
}

export function configPath() {
  return join(app.getPath('userData'), 'node-config.json')
}

export function loadNodeConfig(): NodeConfig {
  const fallback = defaultControlPlaneUrl()
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<NodeConfig>
    let url = String(parsed.controlPlaneUrl || '').trim() || fallback
    // 安装包首次默认或旧配置里的 127.0.0.1 是「这台电脑」，不是控制面那台 Mac
    if (app.isPackaged && isLoopbackUrl(url) && fallback && !isLoopbackUrl(fallback)) {
      url = fallback
      persistConfig({
        controlPlaneUrl: url,
        workerPort: Number(parsed.workerPort) > 0 ? Number(parsed.workerPort) : WORKER_PORT
      })
    }
    return {
      controlPlaneUrl: url,
      workerPort: Number(parsed.workerPort) > 0 ? Number(parsed.workerPort) : WORKER_PORT
    }
  } catch {
    const cfg = { controlPlaneUrl: fallback, workerPort: WORKER_PORT }
    if (app.isPackaged && fallback && !isLoopbackUrl(fallback)) persistConfig(cfg)
    return cfg
  }
}

function persistConfig(cfg: NodeConfig) {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2))
}

export function saveNodeConfig(patch: Partial<NodeConfig>): NodeConfig {
  const next = { ...loadNodeConfig(), ...patch }
  persistConfig(next)
  return next
}

export function localWorkerUrl(cfg = loadNodeConfig()) {
  return `http://127.0.0.1:${cfg.workerPort}/api`
}

function jarPath() {
  return join(process.resourcesPath, 'backend', 'mobile-standalone-backend-1.0.0.jar')
}

function dbHostFromControlPlane(url: string) {
  try {
    return new URL(url).hostname || '127.0.0.1'
  } catch {
    return '127.0.0.1'
  }
}

async function healthOk(url: string) {
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/health`)
    return res.ok
  } catch {
    return false
  }
}

function workerLogPath() {
  return join(app.getPath('userData'), 'worker.log')
}

export function localWorkerLogPath() {
  return workerLogPath()
}

function workerPidPath() {
  return join(app.getPath('userData'), 'worker.pid')
}

function rememberWorkerPid(pid: number) {
  try {
    writeFileSync(workerPidPath(), String(pid))
  } catch {
    /* ignore */
  }
}

function forgetWorkerPid() {
  try {
    if (existsSync(workerPidPath())) unlinkSync(workerPidPath())
  } catch {
    /* ignore */
  }
}

function killPidTree(pid: number) {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true, stdio: 'ignore' })
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* already gone */
  }
}

/** 窗口关了之后 Java 常变成孤儿进程，继续占着安装目录里的 jar。 */
function killOrphanWorkers() {
  const pidFile = workerPidPath()
  try {
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, 'utf8').trim())
      if (pid > 0) killPidTree(pid)
    }
  } catch {
    /* ignore */
  }
  forgetWorkerPid()
  if (process.platform === 'win32') {
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | Where-Object { $_.CommandLine -match 'mobile-standalone-backend' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
      ],
      { windowsHide: true, stdio: 'ignore' }
    )
  }
}

function stopWorker() {
  const pid = workerProc?.pid
  workerProc = null
  if (pid) killPidTree(pid)
  killOrphanWorkers()
}

/**
 * 安装包里自带后端 jar：作为本机执行节点拉起，去连控制面。
 * 开发模式不拉，避免和正在 mvn 的进程抢端口。
 */
export async function ensureLocalWorker(): Promise<{ ok: boolean; url: string; message: string }> {
  const cfg = loadNodeConfig()
  const url = localWorkerUrl(cfg)
  if (await healthOk(url)) {
    return { ok: true, url, message: '本机执行节点已在运行' }
  }
  if (!app.isPackaged) {
    return { ok: false, url, message: '开发模式请自行启动后端；安装包会自动拉起本机执行节点' }
  }
  const jar = jarPath()
  if (!existsSync(jar)) {
    return { ok: false, url, message: '安装包缺少后端 jar，请重新打包' }
  }

  stopWorker()
  const advertise = url
  const logFile = workerLogPath()
  try {
    writeFileSync(
      logFile,
      `\n--- worker start ${new Date().toISOString()} port=${cfg.workerPort} db=${dbHostFromControlPlane(cfg.controlPlaneUrl)} ---\n`,
      { flag: 'a' }
    )
  } catch {
    /* ignore */
  }
  const logStream = createWriteStream(logFile, { flags: 'a' })
  workerProc = spawn('java', [
    '-jar', jar,
    '--spring.profiles.active=worker',
    `--server.port=${cfg.workerPort}`
  ], {
    env: {
      ...process.env,
      SERVER_PORT: String(cfg.workerPort),
      APP_NODE_ROLE: 'WORKER',
      CONTROL_PLANE_URL: cfg.controlPlaneUrl,
      APP_NODE_ADVERTISE_URL: advertise,
      DB_HOST: dbHostFromControlPlane(cfg.controlPlaneUrl)
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  workerProc.stdout?.pipe(logStream)
  workerProc.stderr?.pipe(logStream)
  workerProc.on('error', (err) => {
    try {
      logStream.write(`\n[spawn error] ${err.message}\n`)
    } catch {
      /* ignore */
    }
  })
  const spawnedPid = workerProc.pid
  if (spawnedPid) rememberWorkerPid(spawnedPid)
  workerProc.on('exit', (code) => {
    console.warn('local worker exited', code)
    if (workerProc?.pid === spawnedPid) workerProc = null
  })

  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (await healthOk(url)) {
      return { ok: true, url, message: '本机执行节点已启动' }
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  return {
    ok: false,
    url,
    message:
      '本机执行节点启动超时。请确认已安装 Java 17，且 Mac 上 MySQL 允许本机访问（3306）。' +
      ` 日志：${logFile}`
  }
}

export async function restartLocalWorker() {
  stopWorker()
  return ensureLocalWorker()
}

export function disposeLocalWorker() {
  stopWorker()
}
