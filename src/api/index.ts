import type { SupportedDevicePlatform } from '@/utils/platform'

/** 抓到的一条流水。字段对齐手机抓包工具的 General 页，方便两边对照 */
export interface CapturedFlow {
  seq: number
  method: string
  path: string
  host: string
  url: string
  query: string
  httpVersion: string
  /** 对端 ip:port；连接复用时可能拿不到 */
  remote: string
  status: number
  reason: string
  durationMs: number
  at: number
  traceId?: string | null
  reqContentType: string
  respContentType: string
  /** 整个报文大小（含头），和抓包工具的 Request/Response Package 对得上 */
  reqBytes: number
  respBytes: number
  respKind: string
  respTruncated: boolean
  /** 二进制响应没有 body，这里说明为什么 */
  bodyNote: string
  hasDetail: boolean
  /** 这个接口在本次抓包里被调了几次。轮询接口调七八次很常见 */
  calls: number
}

export interface CapturedDetail {
  reqHeaders: Record<string, string>
  reqCookies: Record<string, string>
  reqBody: string
  respHeaders: Record<string, string>
  respCookies: Record<string, string>
  respBody: string
  bodyNote: string
}

export interface CurrentUserVo {
  bootstrapping: boolean
  id?: string
  username: string
  displayName?: string
  role: string
  roleLabel: string
  canWrite?: boolean
  canDelete?: boolean
  canManageUsers?: boolean
  hiddenRoutes: string[]
}

export interface ApiEndpointVo {
  id: string
  project: string
  httpMethod: string
  path: string
  handler?: string
  summary?: string
  caseCount: number
  /** 其中真正验了返回字段的有几条；0 表示这个接口的用例全是只验 200 的 */
  strongCaseCount: number
  /** 其中启用中的有几条；0 表示用例全停用了，等于没人在验 */
  enabledCaseCount: number
  changeFlag?: string
  changeNote?: string
  sourceBranch?: string
  lastSyncedAt?: string
  statusCode: string
  statusLabel: string
  statusHint: string
  actionable: boolean
  hasCaptureMeta?: boolean
  hasDocMeta?: boolean
}

export interface PlatformUserVo {
  id: string
  username: string
  displayName?: string
  role: string
  roleLabel: string
  enabled: boolean
  lastLoginAt?: string
  createdAt?: string
}

const AUTH_TOKEN_STORAGE_KEY = 'platform-auth-token'

/**
 * 直接读 localStorage，不 import auth store——api 被 auth store 引用，
 * 反向再引会绕成循环依赖，打包后的表现是某个模块变成 undefined，
 * 而报错位置和真正的原因隔着十万八千里。
 */
function readAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/** Spring Boot 500 时 message 经常是类名；DevTools 热更后常见 PermissionRules 找不到 */
function formatBackendError(error: Record<string, unknown>, status: number): string {
  const msg = String(error.message || error.error || '').trim()
  const trace = String(error.trace || '')
  if (
    trace.includes('NoClassDefFoundError') ||
    trace.includes('ClassNotFoundException') ||
    msg.includes('PermissionRules')
  ) {
    return '后端需要完整重启：请在 IDEA 里 Stop 再 Run（DevTools 热更新导致类加载异常，不是接口逻辑问题）'
  }
  return msg || `HTTP error! status: ${status}`
}

/**
 * 带登录态的 fetch。
 * <p>
 * 传 FormData 的接口没法走 request()——那里写死了 Content-Type: application/json，
 * 而 multipart 需要浏览器自己生成 boundary。于是这些接口只能裸 fetch，
 * 也就集体漏掉了 Authorization。<b>鉴权一开，上传类功能会全部 401</b>，
 * 而报错是「上传失败」，完全看不出跟登录有关。
 * <p>
 * 所以裸 fetch 也必须走这一个口子，不要再直接调 fetch。
 */
async function authFetch(url: string, init: RequestInit = {}) {
  const token = readAuthToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  })
  if (res.status === 401) {
    notifyUnauthorized()
  }
  return res
}

/** 同理，用事件通知而不是直接调 auth store */
function notifyUnauthorized() {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('platform-unauthorized'))
}

const API_BASE_STORAGE_KEY = 'apiBaseUrl'
const WORKER_BASE_STORAGE_KEY = 'workerBaseUrl'
const BAKED_CONTROL_PLANE_URL = String(import.meta.env.VITE_CONTROL_PLANE_URL || '').trim()
const DEV_DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api'
const DEFAULT_API_BASE_URL = BAKED_CONTROL_PLANE_URL || DEV_DEFAULT_API_BASE_URL

function isLoopbackApiUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  } catch {
    return false
  }
}

function normalizeApiBaseUrl(raw: string) {
  const s = raw.trim().replace(/\/+$/, '')
  if (!s) return DEFAULT_API_BASE_URL
  return s.endsWith('/api') ? s : `${s}/api`
}

function readStoredUrl(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    if (saved && saved.trim()) return normalizeApiBaseUrl(saved)
  } catch {
    /* 无 localStorage 时退回默认 */
  }
  return fallback
}

function bootControlPlaneUrl() {
  try {
    const url = String(window.bootNodeConfig?.controlPlaneUrl || '').trim()
    if (url && !isLoopbackApiUrl(url)) return normalizeApiBaseUrl(url)
  } catch {
    /* 非 Electron 或 preload 未注入 */
  }
  return ''
}

function resolveApiBaseUrl() {
  const boot = bootControlPlaneUrl()
  const stored = readStoredUrl(API_BASE_STORAGE_KEY, '')
  if (stored && !isLoopbackApiUrl(stored)) return stored
  if (boot) return boot
  if (
    import.meta.env.PROD &&
    stored &&
    isLoopbackApiUrl(stored) &&
    BAKED_CONTROL_PLANE_URL &&
    !isLoopbackApiUrl(BAKED_CONTROL_PLANE_URL)
  ) {
    return normalizeApiBaseUrl(BAKED_CONTROL_PLANE_URL)
  }
  if (!stored) return boot || DEFAULT_API_BASE_URL
  return stored
}

function resolveWorkerBaseUrl() {
  return readStoredUrl(WORKER_BASE_STORAGE_KEY, resolveApiBaseUrl())
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseURL: string
  private workerBaseURL: string

  constructor(baseURL: string, workerBaseURL?: string) {
    this.baseURL = baseURL
    this.workerBaseURL = workerBaseURL || baseURL
  }

  /** 用于拼接步骤截图等相对路径：img src="{baseUrl}/{entry.screenshotUrl}" */
  getBaseUrl(): string {
    return this.baseURL
  }

  getWorkerBaseUrl(): string {
    return this.workerBaseURL
  }

  setBaseUrl(url: string) {
    let next = normalizeApiBaseUrl(url)
    if (import.meta.env.PROD && isLoopbackApiUrl(next)) {
      const keep = bootControlPlaneUrl() || BAKED_CONTROL_PLANE_URL
      if (keep && !isLoopbackApiUrl(keep)) next = normalizeApiBaseUrl(keep)
    }
    this.baseURL = next
    try {
      localStorage.setItem(API_BASE_STORAGE_KEY, this.baseURL)
    } catch {
      /* ignore */
    }
  }

  setWorkerBaseUrl(url: string) {
    this.workerBaseURL = normalizeApiBaseUrl(url)
    try {
      localStorage.setItem(WORKER_BASE_STORAGE_KEY, this.workerBaseURL)
    } catch {
      /* ignore */
    }
  }

  /**
   * 设备扫描走本机 worker（adb 在哪台机器就打哪台）。
   * 流程执行：控制面和 worker 若是同一台（都是 127.0.0.1），直接打控制面，
   * 避免浏览器/开发态还绕到旧的 3001 worker，接口挂住后被前端误报超时。
   */
  private usesWorker(endpoint: string) {
    const path = endpoint.split('?')[0]
    if (path.startsWith('/devices')) return true
    if (/\/ui-flows\/[^/]+\/execute$/.test(path)) {
      try {
        const workerHost = new URL(this.workerBaseURL).hostname
        const controlHost = new URL(this.baseURL).hostname
        if (workerHost === controlHost) return false
      } catch {
        return false
      }
      return this.workerBaseURL !== this.baseURL
    }
    return false
  }

  private endpointUrl(endpoint: string) {
    const base = this.usesWorker(endpoint) ? this.workerBaseURL : this.baseURL
    return `${base}${endpoint}`
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.endpointUrl(endpoint)
    const onWorker = this.usesWorker(endpoint)
    // 登录态挂在唯一的出口上。逐个接口加请求头一定会漏，而漏掉的那个
    // 表现是「偶尔弹一次重新登录」，比全都不带还难查
    const token = readAuthToken()
    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      })
    } catch (e: unknown) {
      if (options.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        throw e
      }
      const msg = e instanceof Error ? e.message : String(e)
      if (onWorker) {
        throw new Error(
          `连不上本机执行节点（${this.workerBaseURL}）。` +
            '请到「设置」确认 worker 为「已随应用启动」；Windows 需安装 Java 17；' +
            '且 Mac 上 MySQL 要允许本机 IP 访问 3306。' +
            (msg === 'Failed to fetch' ? '' : ` 原始错误：${msg}`)
        )
      }
      throw new Error(
        `连不上 ${url}。请确认控制面已启动、地址正确，且与本机在同一局域网。` +
          (msg === 'Failed to fetch' ? '' : ` 原始错误：${msg}`)
      )
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }))
      if (response.status === 401) {
        // 令牌过期或账号被停用：清掉登录态跳登录页。
        // 不这么做的话，页面会持续弹「未登录」而用户找不到重新登录的入口
        notifyUnauthorized()
      }
      throw new Error(formatBackendError(error, response.status))
    }

    const data = await response.json()
    // 兼容 Node 后端返回 { success, data } 的情况，统一解包为 data
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as T
    }
    return data as T
  }

  // ---------------- 账号与权限 ----------------

  /** 平台还没建账号时返回 bootstrapping=true，登录页据此显示「创建第一个管理员」 */
  async fetchBootstrapStatus() {
    return this.request<{ bootstrapping: boolean; message: string }>('/auth/bootstrap-status')
  }

  async login(username: string, password: string) {
    return this.request<{ token: string; user: CurrentUserVo }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  }

  /** 创建第一个管理员。有账号之后这个接口就永久关闭 */
  async bootstrapAdmin(username: string, displayName: string, password: string) {
    return this.request<{ token: string; user: CurrentUserVo }>('/auth/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, password })
    })
  }

  async fetchCurrentUser() {
    return this.request<CurrentUserVo>('/auth/me')
  }

  async changeOwnPassword(oldPassword: string, newPassword: string) {
    return this.request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    })
  }

  async fetchPlatformUsers() {
    return this.request<PlatformUserVo[]>('/platform-users')
  }

  /** 角色字典由后端下发，不在前端硬编码三个中文名 */
  async fetchPlatformRoles() {
    return this.request<Array<{ code: string; label: string; description: string }>>(
      '/platform-users/roles'
    )
  }

  async createPlatformUser(body: {
    username: string
    displayName?: string
    password: string
    role: string
  }) {
    return this.request<PlatformUserVo>('/platform-users', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updatePlatformUser(
    id: string,
    body: { displayName?: string; role?: string; enabled?: boolean }
  ) {
    return this.request<PlatformUserVo>(`/platform-users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async resetPlatformUserPassword(id: string, password: string) {
    return this.request<{ success: boolean }>(
      `/platform-users/${encodeURIComponent(id)}/reset-password`,
      { method: 'POST', body: JSON.stringify({ password }) }
    )
  }

  async deletePlatformUser(id: string) {
    return this.request<{ success: boolean }>(`/platform-users/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  // 应用信息
  async getVersion() {
    const result = await this.request<{ version: string }>('/health/version')
    return result
  }

  async pingHealth(baseUrl?: string) {
    const base = normalizeApiBaseUrl(baseUrl || this.baseURL)
    const response = await fetch(`${base}/health`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.json() as Promise<{
      status?: string
      nodeId?: string
      nodeRole?: string
      executesLocally?: boolean
    }>
  }

  async listWorkerNodes() {
    return this.request<Array<{
      id: string
      displayName?: string
      hostname?: string
      role?: string
      baseUrl?: string
      lastSeen?: string
      devicesJson?: string
    }>>('/worker-nodes')
  }

  /** 设备列表：GET {baseUrl}/devices，响应为 JSON 数组，无数据时为 [] */
  async getDevices() {
    const raw = await this.request<any>('/devices')
    return Array.isArray(raw) ? raw : []
  }

  /** 按平台设备列表：GET {baseUrl}/devices/platform/{platform}，platform 为 ANDROID / IOS / HARMONYOS */
  async getDevicesByPlatform(platform: SupportedDevicePlatform | string) {
    const raw = await this.request<any>(`/devices/platform/${platform}`)
    return Array.isArray(raw) ? raw : []
  }

  /** 按平台已登记应用列表：GET {baseUrl}/applications/platform/{platform} */
  async getApplicationsByPlatform(platform: SupportedDevicePlatform | string) {
    const raw = await this.request<any>(`/applications/platform/${platform}`)
    return Array.isArray(raw) ? raw : []
  }

  /** 工作台看板统计：元素/流程覆盖、近7日通过率、线上回归等 */
  async getWorkbenchStats() {
    return this.request<{
      activeElementCount: number
      totalElementCount: number
      enabledFlowCount: number
      regressionFlowCount: number
      taskPassRate7d: number | null
      tasksFinished7d: number
      tasksPassed7d: number
      tasksFailed7d: number
      tasksRunning: number
      tasksTotal: number
      latestRegressionPassRate: number | null
      regressionPassRate7d: number | null
      regressionRuns7d: number
      regressionWeekDays?: Array<{
        date: string
        dateText: string
        weekday: string
        runCount: number
        passRate: number | null
        allPassed: boolean | null
      }>
      recentRegressionRuns?: Array<{
        id: string
        status: string
        passRate?: number | null
        dateText?: string
        dayText?: string
        date?: string
        appsText?: string
        jobCount?: number
        finishedAt?: string | null
        features?: Array<{
          stepId: string
          label: string
          status: string
          sortOrder?: number
        }>
      }>
      p0BugCount: number | null
      p0BugAvailable: boolean
      recentFailedTasks: Array<{
        id: string
        name: string
        status: string
        taskType?: string
        updatedAt?: string
      }>
    }>('/workbench/stats')
  }

  /** 首页已连接设备统计：GET /devices/connected-summary，返回总数、各平台数量及设备列表 */
  async getConnectedSummary() {
    return this.request<{
      totalConnected: number
      androidCount: number
      iosCount: number
      harmonyosCount: number
      devices: any[]
    }>('/devices/connected-summary')
  }

  /** 刷新/扫描设备：POST /devices/scan，无请求体；调用后可再请求 getDevices 获取最新列表 */
  async scanDevices() {
    return this.request<string>('/devices/scan', { method: 'POST' })
  }

  /** 这台设备跑哪个环境。传空串＝取消绑定，回到「执行时再定」 */
  async setDeviceEnvironment(deviceId: string, environment: string) {
    return this.request<{ ok: boolean; environment: string }>(
      `/devices/${encodeURIComponent(deviceId)}/environment`,
      { method: 'PUT', body: JSON.stringify({ environment }) }
    )
  }

  /** 这台设备现在被谁占着；没人占 locked=false */
  async getDeviceLock(deviceId: string) {
    return this.request<{ locked: boolean; describe?: string; refId?: string; since?: string }>(
      `/devices/${encodeURIComponent(deviceId)}/lock`
    )
  }

  /** 获取单个设备详情：GET /devices/{id}，404 表示不存在 */
  async getDevice(deviceId: string) {
    return this.request<any>(`/devices/${deviceId}`)
  }

  /**
   * 设备详情（点击设备后展示）：GET /devices/{id}/detail
   * 默认不含已安装应用、不含 getprop 全文（首屏更快）。
   * includeApps / includeRaw 按需打开；应用列表见 getDeviceInstalledApps。
   */
  async getDeviceDetail(
    deviceId: string,
    opts?: { includeApps?: boolean; includeRaw?: boolean }
  ) {
    const qs = new URLSearchParams()
    if (opts?.includeApps) qs.set('includeApps', 'true')
    if (opts?.includeRaw) qs.set('includeRaw', 'true')
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<{
      id?: string
      name?: string
      platform?: string
      version?: string
      status?: string
      batteryLevel?: number | null
      installedApplications?: Array<{ name?: string; packageName?: string; version?: string }>
      iosDetail?: Record<string, string | number | undefined>
      iosDetailRaw?: string
      androidDetail?: {
        systemInfo?: Record<string, string | number | undefined>
        hardwareInfo?: Record<string, string | number | undefined>
        batteryInfo?: Record<string, string | number | undefined>
        storageInfo?: Record<string, string | number | undefined>
        networkInfo?: Record<string, string | number | undefined>
        securityInfo?: Record<string, string | number | undefined>
        sensorInfo?: Record<string, string | number | boolean | undefined>
      }
      androidDetailRaw?: string
    }>(`/devices/${encodeURIComponent(deviceId)}/detail${suffix}`)
  }

  /** 已安装应用（独立接口，详情页异步加载） */
  async getDeviceInstalledApps(deviceId: string) {
    return this.request<{
      installedApplications?: Array<{ name?: string; packageName?: string; version?: string }>
    }>(`/devices/${encodeURIComponent(deviceId)}/installed-apps`)
  }

  /** iOS 接新机体检 */
  async getIosReadiness(udid: string) {
    return this.request<{
      udid?: string
      ready?: boolean
      summary?: string
      checks?: Array<{ status?: string; name?: string; detail?: string; howToFix?: string }>
    }>(`/devices/${encodeURIComponent(udid)}/ios-readiness`)
  }

  /** iOS WDA / 签名修复工具箱：分步体检 */
  async getIosWdaToolkit(udid: string) {
    return this.request<{
      udid?: string
      healthy?: boolean
      summary?: string
      nextTip?: string
      config?: Record<string, unknown>
      runtime?: Record<string, unknown>
      steps?: Array<{
        id?: string
        order?: number
        status?: string
        title?: string
        detail?: string
        tip?: string
        actionId?: string
        actionLabel?: string
        confirmRequired?: boolean
      }>
      actions?: Array<{
        id?: string
        label?: string
        description?: string
        confirmRequired?: boolean
        longRunning?: boolean
      }>
    }>(`/devices/${encodeURIComponent(udid)}/ios-wda-toolkit`)
  }

  /** 执行 WDA 工具箱动作 */
  async postIosWdaToolkitAction(
    udid: string,
    body: { action: string; confirm?: boolean }
  ) {
    return this.request<{
      ok?: boolean
      action?: string
      message?: string
      reportAfter?: any
    }>(`/devices/${encodeURIComponent(udid)}/ios-wda-toolkit/actions`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async connectDevice(deviceId: string) {
    return this.request<any>(`/devices/${deviceId}/connect`, {
      method: 'POST'
    })
  }

  async disconnectDevice(deviceId: string) {
    return this.request<boolean>(`/devices/${deviceId}/disconnect`, {
      method: 'POST'
    })
  }

  /** 真机点选：拉取当前屏截图元信息；screenshotUrl 为 devices/{id}/inspect/screenshot */
  async getDeviceInspectSnapshot(deviceId: string) {
    return this.request<{
      deviceId: string
      platform?: string
      screenshotUrl: string
      screenshotPath?: string
      width?: number
      height?: number
      filterBar?: {
        barBounds?: { left: number; top: number; right: number; bottom: number }
        chips?: Array<{
          label: string
          offsetXPercent: number
          offsetYPercent: number
          bounds?: { left: number; top: number; right: number; bottom: number }
        }>
      }
    }>(`/devices/${deviceId}/inspect/snapshot`)
  }

  async getDeviceInspectHierarchy(deviceId: string, refresh = false) {
    const q = refresh ? '?refresh=true' : '?refresh=false'
    return this.request<{
      deviceId: string
      width?: number
      height?: number
      nodeCount?: number
      root: any
    }>(`/devices/${encodeURIComponent(deviceId)}/inspect/hierarchy${q}`)
  }

  async postDeviceInspectNodeLocators(deviceId: string, body: { nodePath: string; appId?: string }) {
    return this.request<{
      nodePath?: string
      xpath?: string
      className?: string
      resourceId?: string
      text?: string
      contentDesc?: string
      bounds?: { left: number; top: number; right: number; bottom: number }
      screenBounds?: { left: number; top: number; right: number; bottom: number }
      ancestors?: Array<{ nodePath?: string; text?: string; className?: string; bounds?: any }>
      candidates: Array<{
        rank: number
        className?: string
        resourceId?: string
        text?: string
        contentDesc?: string
        clickable?: boolean
        enabled?: boolean
        bounds?: { left: number; top: number; right: number; bottom: number }
        locatorType: string
        locatorValue: string
        suggestedNameEn?: string
        suggestedNameZh?: string
        visualHint?: string
        matchedElementId?: string
        matchedNameEn?: string
        matchedNameZh?: string
        matchedStatus?: string
        matchCount?: number
        unique?: boolean | null
      }>
    }>(`/devices/${encodeURIComponent(deviceId)}/inspect/node-locators`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 真机点选：按相对坐标命中控件，返回推荐 locator 与已匹配元素 */
  async postDeviceInspectHitTest(
    deviceId: string,
    body: { xRatio?: number; yRatio?: number; x?: number; y?: number; appId?: string; elementKey?: string }
  ) {
    return this.request<{
      deviceId: string
      platform?: string
      x: number
      y: number
      width: number
      height: number
      tapOffsetXPercent?: number | null
      tapOffsetYPercent?: number | null
      tapOffsetBounds?: { left: number; top: number; right: number; bottom: number }
      tapOffsetHint?: string
      candidates: Array<{
        rank: number
        className?: string
        resourceId?: string
        text?: string
        contentDesc?: string
        clickable?: boolean
        enabled?: boolean
        bounds?: { left: number; top: number; right: number; bottom: number }
        locatorType: string
        locatorValue: string
        suggestedNameEn?: string
        suggestedNameZh?: string
        visualHint?: string
        matchedElementId?: string
        matchedNameEn?: string
        matchedNameZh?: string
        matchedStatus?: string
        /** 这个定位在当前这一屏命中几个节点；后端一直在算，只是以前没人显示 */
        matchCount?: number
        /** matchCount === 1；null 表示无法校验（坐标定位、语法错等） */
        unique?: boolean | null
      }>
      /** 本次点选发现的问题，如「库里某条元素的定位在这一屏指向了别的节点」 */
      warnings?: string[]
    }>(`/devices/${deviceId}/inspect/hit-test`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 静态资源完整 URL（如 tmp/screenshots/xxx.png） */
  resolveAssetUrl(path?: string | null) {
    if (!path) return ''
    if (path.startsWith('http')) return path
    const p = path.startsWith('/') ? path : `/${path}`
    return `${this.baseURL}${p}`
  }

  /**
   * 真机点选截图：跟 snapshot 一样走 worker，并且带登录头。
   * 不能塞进 &lt;img src&gt; 拼控制面地址——图在拍截图那台机器上，控制面 404，
   * 浏览器也不会给 img 加 Authorization。
   */
  async fetchDeviceInspectScreenshotObjectUrl(deviceId: string, cacheBust?: string): Promise<string> {
    const q = cacheBust ? `?t=${encodeURIComponent(cacheBust)}` : `?t=${Date.now()}`
    const endpoint = `/devices/${encodeURIComponent(deviceId)}/inspect/screenshot${q}`
    const res = await authFetch(this.endpointUrl(endpoint))
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? '截图文件不存在，请再点「刷新截图」'
          : `截图加载失败（${res.status}）`
      )
    }
    const blob = await res.blob()
    if (!blob.size) throw new Error('截图为空')
    return URL.createObjectURL(blob)
  }

  // 任务管理（分页）
  /**
   * 任务列表：GET /api/tasks?page=1&size=10&taskType=...&platform=...
   * 传 page、size 时响应为 { content, totalElements, totalPages, page, size }，列表用 content，分页用其余字段。
   */
  async getTasks(
    filters?: {
      taskType?: string
      platform?: SupportedDevicePlatform | string
      status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED'
      deviceId?: string
      appId?: string
    },
    pagination: { page: number; size: number } = { page: 1, size: 10 }
  ) {
    const params = new URLSearchParams()
    params.set('page', String(pagination.page))
    params.set('size', String(pagination.size))
    if (filters?.taskType) params.append('taskType', filters.taskType)
    if (filters?.platform) params.append('platform', filters.platform)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.deviceId) params.append('deviceId', filters.deviceId)
    if (filters?.appId) params.append('appId', filters.appId)

    const query = params.toString()
    return this.request<{
      content: any[]
      totalElements: number
      totalPages: number
      page: number
      size: number
    }>(`/tasks?${query}`)
  }

  async getTask(taskId: string) {
    return this.request<any>(`/tasks/${taskId}`)
  }

  async createTask(taskData: any) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    })
  }

  /**
   * 统一创建任务：POST /api/tasks/test。
   * 创建性能基础质量测试必须用此接口（不要用 POST /functional-test/tasks）。请求体传 taskType: "PERFORMANCE_BASELINE_TEST" 及 platform、deviceId、appId 等，设备选 Android。
   * 流程用例请用 UI_FLOW_TEST，并在 config 中传 flowId。功能基础质量（FUNCTIONAL_QUALITY_TEST）已下线，后端会拒绝新建。
   */
  async createTestTask(body: {
    taskType: string
    platform: SupportedDevicePlatform | string
    deviceId: string
    appId: string
    taskName?: string
    remarks?: string
    config?: string
    /** 功能基础质量：settings、settings_account、settings_interests、settings_school_cert（设置-高校认证）等，小写，与 POST /tasks/test 约定一致 */
    scenarioKey?: string | null
  }) {
    const scenarioKeyNorm = body.scenarioKey != null && String(body.scenarioKey).trim() !== ''
      ? String(body.scenarioKey).trim().toLowerCase()
      : null
    return this.request<any>('/tasks/test', {
      method: 'POST',
      body: JSON.stringify({
        taskType: body.taskType,
        platform: body.platform,
        deviceId: body.deviceId,
        appId: body.appId,
        taskName: body.taskName ?? undefined,
        remarks: body.remarks ?? undefined,
        config: body.config ?? undefined,
        scenarioKey: scenarioKeyNorm
      })
    })
  }

  async updateTask(taskId: string, taskData: any) {
    return this.request<any>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    })
  }

  /** 删除任务：DELETE /tasks/{taskId}，后端会先停止任务（若正在运行）再删除。 */
  async deleteTask(taskId: string) {
    return this.request<boolean>(`/tasks/${taskId}`, {
      method: 'DELETE'
    })
  }

  async runTask(taskId: string) {
    return this.request<boolean>(`/tasks/${taskId}/run`, {
      method: 'POST'
    })
  }

  /**
   * 停止当前自动化测试：POST /tasks/{taskId}/stop（注意是 POST，不是 GET），无请求体。
   * taskId 为任务 ID（列表/详情中的任务 id）。若出现 Network error，请检查方法是否为 POST、URL 是否为 {baseUrl}/tasks/{taskId}/stop。
   */
  async stopTask(taskId: string) {
    return this.request<boolean>(`/tasks/${taskId}/stop`, {
      method: 'POST'
    })
  }

  // 报告管理
  async getReports() {
    return this.request<any[]>('/reports')
  }

  async getReport(reportId: string) {
    return this.request<any>(`/reports/${reportId}`)
  }

  // 应用管理
  /** @param refresh true 时请求带 ?refresh=true，拉取设备真实安装列表（含新装应用）；不传或 false 用缓存 */
  async getInstalledApps(deviceId: string, refresh?: boolean) {
    const q = refresh ? '?refresh=true' : ''
    return this.request<any[]>(`/applications/devices/${deviceId}/applications${q}`)
  }

  /** @param refresh true 时请求带 ?refresh=true，拉取设备真实安装列表（含新装应用）；不传或 false 用缓存 */
  async getDeviceApps(deviceId: string, refresh?: boolean) {
    const q = refresh ? '?refresh=true' : ''
    return this.request<any[]>(`/applications/devices/${deviceId}/applications${q}`)
  }

  /** @deprecated 功能基础质量已下线，请勿再调用；请使用 createTestTask + UI_FLOW_TEST 等类型 */
  async createFunctionalTestTask(_taskData: {
    taskName?: string
    remarks?: string
    platform: SupportedDevicePlatform | string
    deviceId: string
    applicationId: string
  }): Promise<never> {
    throw new Error('功能基础质量测试已下线，请改用流程用例执行（UI_FLOW_TEST）')
  }

  /** 表单字段需含 file、deviceId；platform 为 ANDROID / IOS / HARMONYOS。POST {baseUrl}/applications/upload */
  async uploadAndInstallApp(formData: FormData) {
    const url = `${this.baseURL}/applications/upload`
    const response = await authFetch(url, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }))
      throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }


  // —— 低代码资产：行级元素 / 关键字 / 流程 ——
  async getUiElements(params?: {
    appId?: string
    platform?: string
    catalog?: string
    /** 如 'AUTOMATION,SHARED'：某场景页同时包含专用 + 两边共用 */
    catalogs?: string
    moduleTag?: string
    pageId?: string
    source?: string
    status?: string
    keyword?: string
    /** 传 page 时走分页，返回 PageResult；不传则返回全量数组 */
    page?: number
    size?: number
  }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.platform) q.append('platform', params.platform)
    if (params?.catalog) q.append('catalog', params.catalog)
    if (params?.catalogs) q.append('catalogs', params.catalogs)
    if (params?.moduleTag) q.append('moduleTag', params.moduleTag)
    if (params?.pageId) q.append('pageId', params.pageId)
    if (params?.source) q.append('source', params.source)
    if (params?.status) q.append('status', params.status)
    if (params?.keyword) q.append('keyword', params.keyword)
    if (params?.page != null) q.append('page', String(params.page))
    if (params?.size != null) q.append('size', String(params.size))
    const qs = q.toString()
    const path = qs ? `/ui-elements?${qs}` : '/ui-elements'
    if (params?.page != null) {
      return this.request<{
        content: any[]
        totalElements: number
        totalPages: number
        page: number
        size: number
      }>(path)
    }
    return this.request<any[]>(path)
  }

  async getUiElement(id: string) {
    return this.request<any>(`/ui-elements/${id}`)
  }

  async createUiElement(body: Record<string, unknown>) {
    return this.request<any>('/ui-elements', { method: 'POST', body: JSON.stringify(body) })
  }

  /** 解析 Appium Inspector XML：POST /ui-elements/inspector-xml/parse */
  async parseInspectorXml(body: { platform: string; xml: string }) {
    return this.request<{ candidates: any[]; count: number }>('/ui-elements/inspector-xml/parse', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 页面/弹窗字典 */
  async getUiPages(params?: { appId?: string; enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.enabledOnly) q.append('enabledOnly', 'true')
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-pages?${qs}` : '/ui-pages')
  }

  /** 中文页面名 → 建议的英文编码（AI 翻译）。生成不出来返回空串 */
  async suggestPageCode(nameZh: string) {
    return this.request<{ code: string }>(
      `/ui-pages/suggest-code?nameZh=${encodeURIComponent(nameZh)}`
    )
  }

  async createUiPage(body: {
    appId: string
    pageId: string
    nameZh: string
    description?: string
    moduleTag?: string
    sortOrder?: number
  }) {
    return this.request<any>('/ui-pages', { method: 'POST', body: JSON.stringify(body) })
  }

  async ensureUiPage(body: { appId: string; pageId: string; nameZh?: string; moduleTag?: string }) {
    return this.request<any>('/ui-pages/ensure', { method: 'POST', body: JSON.stringify(body) })
  }

    async updateUiPage(id: string, body: {
      pageId?: string
      nameZh?: string
      description?: string
      moduleTag?: string
      sortOrder?: number
      enabled?: boolean
    }) {
      return this.request<any>(`/ui-pages/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
    }

  /** 勾选候选写入元素库：POST /ui-elements/inspector-xml/import */
  async importInspectorXml(body: {
    appId: string
    platform: string
    status?: string
    pageId: string
    pageNameZh?: string
    moduleTag?: string
    items: Array<Record<string, unknown>>
  }) {
    return this.request<{
      created: any[]
      createdCount: number
      skipped?: string[]
      skippedCount?: number
      errors: string[]
    }>('/ui-elements/inspector-xml/import', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // ---------- 专项：版本质量卡 ----------

  async getPerfBaselineVersions(packageName: string, platform = 'ANDROID') {
    const q = new URLSearchParams({ packageName, platform })
    return this.request<string[]>(`/perf-baseline/versions?${q}`)
  }

  async comparePerfBaseline(params: {
    packageName: string
    platform?: string
    versionName: string
    deviceModel?: string
  }) {
    const q = new URLSearchParams({
      packageName: params.packageName,
      platform: params.platform || 'ANDROID',
      versionName: params.versionName
    })
    if (params.deviceModel) q.set('deviceModel', params.deviceModel)
    return this.request<
      Array<{
        metricKey: string
        label: string
        unit: string
        current: number | null
        baseline: number | null
        baselineVersion: string | null
        deviceModel: string | null
        deltaPercent: number | null
        level: string
        summary: string
      }>
    >(`/perf-baseline/compare?${q}`)
  }

  /** 删页面。页面下还有元素时后端会拒绝，并告诉你有几个 */
  async deleteUiPage(id: string) {
    return this.request<{ ok: boolean }>(`/ui-pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async updateUiElement(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/ui-elements/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  async deleteUiElement(id: string) {
    return this.request<{ ok: boolean }>(`/ui-elements/${id}`, { method: 'DELETE' })
  }

  /** 上传元素预览图（可选），返回 { previewImage, url } */
  async uploadUiElementPreview(file: File) {
    const form = new FormData()
    form.append('file', file)
    const url = `${this.baseURL}/ui-elements/preview/upload`
    const response = await authFetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '上传失败' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{ previewImage: string; url: string }>
  }

  /** 元素预览图完整 URL（DB 存相对路径 ui-element-previews/xxx.png） */
  uiElementPreviewUrl(previewImage?: string | null) {
    if (!previewImage) return ''
    if (previewImage.startsWith('http')) return previewImage
    const path = previewImage.startsWith('/') ? previewImage : `/${previewImage}`
    return `${this.baseURL}${path}`
  }

  async getUiKeywords(params?: { category?: string; enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.category) q.append('category', params.category)
    if (params?.enabledOnly != null) q.append('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-keywords?${qs}` : '/ui-keywords')
  }

  async createUiKeyword(body: Record<string, unknown>) {
    return this.request<any>('/ui-keywords', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateUiKeyword(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/ui-keywords/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  async deleteUiKeyword(id: string) {
    return this.request<{ ok: boolean }>(`/ui-keywords/${id}`, { method: 'DELETE' })
  }

  async getUiFlows(params?: {
    appId?: string
    platform?: string
    catalog?: string
    componentOnly?: boolean
    /** 线上回归可选用例：ONLINE/SHARED、启用、非组件 */
    forRegression?: boolean
    /** true＝跑已发布的线上包，只列「已上线」的流程 */
    releasedPackage?: boolean
    /** 环境：PROD（默认）/ TEST */
    environment?: string
    /** 批量执行轨道：REGRESSION（默认）/ AUTOMATION，与 forRegression 配合用 */
    track?: string
    /** 流程名称模糊搜索 */
    name?: string
  }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.platform) q.append('platform', params.platform)
    if (params?.catalog) q.append('catalog', params.catalog)
    if (params?.componentOnly != null) q.append('componentOnly', String(params.componentOnly))
    if (params?.forRegression != null) q.append('forRegression', String(params.forRegression))
    if (params?.releasedPackage != null) q.append('releasedPackage', String(params.releasedPackage))
    if (params?.environment) q.append('environment', params.environment)
    if (params?.track) q.append('track', params.track)
    if (params?.name) q.append('name', params.name)
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-flows?${qs}` : '/ui-flows')
  }

  async getUiFlow(id: string) {
    return this.request<any>(`/ui-flows/${id}`)
  }

  /** 一批流程各自最近一次执行：通过 / 失败 / 未跑 */
  async getUiFlowLastRuns(ids: string[]) {
    const q = ids.filter(Boolean).join(',')
    if (!q) return {}
    return this.request<
      Record<
        string,
        {
          lastRunStatus?: string
          lastRunAt?: string
          lastRunTaskId?: string
          /** 试跑轨（run_track=DEBUG）的最近一次；不算质量数据，但要看得见 */
          lastDebugStatus?: string
          lastDebugAt?: string
          lastDebugTaskId?: string
        }
      >
    >(
      `/ui-flows/last-runs?ids=${encodeURIComponent(q)}`
    )
  }

  async createUiFlow(body: Record<string, unknown>) {
    return this.request<any>('/ui-flows', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateUiFlow(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/ui-flows/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  async deleteUiFlow(id: string) {
    return this.request<{ ok: boolean }>(`/ui-flows/${id}`, { method: 'DELETE' })
  }

  /** 按「应用字典 + 平台」列最近几个蒲公英版本，执行流程时挑一个装 */
  async getPgyerAppBuilds(appId: string, platform?: string, limit = 5) {
    const q = new URLSearchParams({ appId, limit: String(limit) })
    if (platform) q.set('platform', platform)
    return this.request<
      Array<{
        buildKey: string
        buildVersion: string
        buildVersionNo: string
        buildBuildVersion: number
        buildCreated: string
        buildFileSize: number
        buildUpdateDescription: string
      }>
    >(`/pgyer/app-builds?${q.toString()}`)
  }

  /** 这条流程用到的定位变量名，执行对话框据此列输入框 */
  async getFlowLocatorVariables(flowId: string) {
    return this.request<string[]>(`/ui-flows/${encodeURIComponent(flowId)}/locator-variables`)
  }

  /** 扫这条流程里写死的环境数据（手机号 / 赛事 ID / 按文案定位），只报不改 */
  async scanFlowEnvData(flowId: string) {
    return this.request<{
      flowId: string
      flowName: string
      summary: string
      hits: Array<{
        stepNo: string
        paramName: string
        value: string
        kind: string
        suggestVariable?: string
        reason: string
      }>
    }>(`/ui-flows/${encodeURIComponent(flowId)}/env-data-scan`)
  }

  /** 执行流程：创建 UI_FLOW_TEST 任务并默认立即 run */
  async executeUiFlow(
    flowId: string,
    body: {
      deviceId: string
      platform?: string
      appId?: string
      /** 自定义包名 / BundleId，可覆盖字典或单独使用 */
      packageName?: string
      activity?: string
      taskName?: string
      params?: Record<string, string>
      /** TEST / PROD，缺省 PROD。只决定报告标识与验证码，包名两个环境一致 */
      environment?: string
      runNow?: boolean
      /**
       * 传 'DEBUG' ＝ 试跑：结果不算通过率、不当这条流程的「最近结果」、失败不告警。
       * 流程编排页默认传它——在编辑器里跑本来就是调试，调试挂两次不该拉低质量数据。
       */
      track?: string
    }
  ) {
    const path = `/ui-flows/${flowId}/execute`
    const url = this.endpointUrl(path)
    console.info('[executeUiFlow]', url)
    const ac = new AbortController()
    const timer = window.setTimeout(() => ac.abort(), 25000)
    try {
      return await this.request<{
        taskId: string
        task: any
        started: boolean
        message: string
      }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: ac.signal
      })
    } catch (e: unknown) {
      if (ac.signal.aborted) {
        throw new Error(
          `执行请求超过 25 秒没有返回（${url}）。` +
            '接口应立刻受理任务；一直转圈通常是后端没重启，或 Java 连的库不通（例如 3307 隧道没开）。'
        )
      }
      throw e
    } finally {
      window.clearTimeout(timer)
    }
  }

  // —— 业务应用字典 ——
  async getUiApps(params?: { enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.enabledOnly != null) q.append('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-apps?${qs}` : '/ui-apps')
  }

  async getUiApp(id: string) {
    return this.request<any>(`/ui-apps/${encodeURIComponent(id)}`)
  }

  async createUiApp(body: Record<string, unknown>) {
    return this.request<any>('/ui-apps', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateUiApp(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/ui-apps/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  async deleteUiApp(id: string) {
    return this.request<{ ok: boolean }>(`/ui-apps/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  // —— H5 页面汇总 ——
  async getUiH5Pages(params?: { appId?: string; enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.enabledOnly != null) q.append('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-h5-pages?${qs}` : '/ui-h5-pages')
  }

  async getUiH5Page(id: string) {
    return this.request<any>(`/ui-h5-pages/${encodeURIComponent(id)}`)
  }

  async getUiH5PageOpen(id: string) {
    return this.request<{
      id: string
      name: string
      rawUrl: string
      openUrl: string
      authType: string
      hasToken: boolean
      note: string
      apiProbeUrl?: string
    }>(`/ui-h5-pages/${encodeURIComponent(id)}/open`)
  }

  async probeUiH5Page(id: string) {
    return this.request<{
      ok: boolean
      message: string
      apiUrl?: string
      postId?: string
      postTitle?: string
      httpStatus?: number
      rawPreview?: string
    }>(`/ui-h5-pages/${encodeURIComponent(id)}/probe`)
  }

  async createUiH5Page(body: Record<string, unknown>) {
    return this.request<any>('/ui-h5-pages', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateUiH5Page(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/ui-h5-pages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteUiH5Page(id: string) {
    return this.request<{ ok: boolean }>(`/ui-h5-pages/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /** 版本需求归档 */
  async listVersionArchives() {
    return this.request<any[]>('/version-archives')
  }

  async getVersionArchive(id: string) {
    return this.request<any>(`/version-archives/${encodeURIComponent(id)}`)
  }

  async syncVersionArchive(body: {
    appVersion: string
    releaseLabel: string
    productLine?: string
    releaseDate?: string
  }) {
    return this.request<any>('/version-archives/sync', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async closeVersionArchive(
    id: string,
    body: { dryRun?: boolean; confirm?: boolean; issueKeys?: string[]; comment?: string }
  ) {
    return this.request<any>(`/version-archives/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      body: JSON.stringify(body || {})
    })
  }

  async deleteVersionArchive(id: string) {
    return this.request<{ ok: boolean }>(`/version-archives/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  async reopenAssignVersionIssue(
    issueKey: string,
    body: { username: string; comment?: string }
  ) {
    return this.request<{ ok: boolean; message?: string }>(
      `/version-archives/jira/${encodeURIComponent(issueKey)}/reopen-assign`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async reopenAssignVersionIssuesBatch(body: {
    issueKeys: string[]
    username: string
    comment?: string
  }) {
    return this.request<{ ok: boolean; logs?: string[]; message?: string }>(
      '/version-archives/jira/reopen-assign-batch',
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  /** 测试 Wiki 连通（经控制面） */
  async pingReleaseDocWiki() {
    return this.request<{ ok: boolean; message: string }>('/release-doc/ping')
  }

  /** 发版文档：预览抽取（不建 Wiki 页） */
  async previewReleaseDoc(body: { title: string; version: string }) {
    return this.request<any>('/release-doc/preview', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 发版文档：抽取并创建 Wiki 子页面（可传校对后的 rows） */
  async generateReleaseDoc(body: { title: string; version: string; rows?: any[] }) {
    return this.request<any>('/release-doc/generate', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 发版邮件：按模版生成 HTML 草稿（rows 可选，空则后端从 Wiki 拉表） */
  async previewReleaseMail(body: { title: string; wikiPageUrl: string; rows?: any[] }) {
    return this.request<any>('/release-doc/mail/draft', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 发版邮件：发送 */
  async sendReleaseMail(body: { to: string; cc?: string; subject: string; htmlBody: string }) {
    return this.request<any>('/release-doc/mail/send', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 埋点校验：Wiki 表 vs Kibana JSON */
  async trackingCheckVerify(body: {
    wikiUrl: string
    version: string
    elementName?: string
    os?: string
    kibanaJson: string
  }) {
    return this.request<any>('/tracking-check/verify', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 周改动漏测看板：多仓 git diff */
  async changeReviewDiff(body: {
    weekLabel?: string
    projects: Array<{
      name: string
      type: string
      path: string
      baseRef?: string
      headRef: string
      pathspecs?: string[]
    }>
    checklist?: Array<{
      id?: string
      title: string
      keywords?: string
      projectType?: string
    }>
    releaseDbNotes?: string
  }) {
    return this.request<any>('/change-review/diff', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 周改动漏测看板：从发版文档校对行解析分支与 DB 备注 */
  async changeReviewImportBranches(body: {
    rows: Array<{ summary?: string; branches?: string; dbChanges?: string }>
  }) {
    return this.request<any>('/change-review/import-branches', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** Web 端测试：Playwright 就绪状态 */
  async webTestStatus() {
    return this.request<{
      enabled: boolean
      projectReady: boolean
      nodeModulesPresent: boolean
      projectDir: string
      message: string
      supportedChannels: string[]
      plannedChannels: string[]
    }>('/web-test/status')
  }

  async webTestKeywords() {
    return this.request<Array<{ code: string; nameZh: string; category: string; description: string }>>(
      '/web-test/keywords'
    )
  }

  async getWebTestCases(params?: { channel?: string; enabledOnly?: boolean; keyword?: string }) {
    const q = new URLSearchParams()
    if (params?.channel) q.set('channel', params.channel)
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    if (params?.keyword) q.set('keyword', params.keyword)
    const qs = q.toString()
    return this.request<any[]>(qs ? `/web-test/cases?${qs}` : '/web-test/cases')
  }

  async createWebTestCase(body: Record<string, unknown>) {
    return this.request<any>('/web-test/cases', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateWebTestCase(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/web-test/cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteWebTestCase(id: string) {
    return this.request<{ ok: boolean }>(`/web-test/cases/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /** 接口清单：有哪些接口、覆盖到没有 */
  async fetchApiEndpoints(params: { project?: string; keyword?: string; changeFlag?: string }) {
    const q = new URLSearchParams()
    if (params.project) q.set('project', params.project)
    if (params.keyword) q.set('keyword', params.keyword)
    if (params.changeFlag) q.set('changeFlag', params.changeFlag)
    return this.request<{
      total: number
      counts: Record<string, number>
      items: ApiEndpointVo[]
    }>(`/api-endpoints?${q.toString()}`)
  }

  /** 从接口清单生成一条用例骨架。凑不出有意义断言时后端会生成为「停用」 */
  async generateCaseFromEndpoint(endpointId: string) {
    return this.request<{
      case: { id: string; name: string }
      enabled: boolean
      note: string
    }>(`/api-endpoints/${encodeURIComponent(endpointId)}/generate-case`, { method: 'POST' })
  }

  /**
   * 单个接口详情，带每条用例「还差什么」。
   * 生成的用例是停用的，补完之后没人知道它已经能启用了——清单上就一直挂着
   * 「有用例 · 但没在验」，而人以为自己还没补完。
   */
  async getApiEndpointDetail(id: string) {
    return this.request<{
      endpoint: any
      statusCode: string
      statusLabel: string
      statusHint: string
      cases: Array<{ id: string; name: string; enabled: boolean; ready: boolean; todos: string[] }>
    }>(`/api-endpoints/${encodeURIComponent(id)}`)
  }

  /**
   * 接口清单的树：APP 后端 / PVP · 客户端 / WEB / 其他 → 项目 → 接口数。
   * 二十多个项目铺成一张平表，人第一眼找不到自己那块。
   */
  /** 接口清单左侧 catalog 树：APP / PVP / WEB → 项目 + 接口数 */
  async fetchApiEndpointTree() {
    return this.request<{
      categories: Array<{
        key: string
        label: string
        total: number
        pending?: number
        children: Array<{
          project: string
          label?: string
          total: number
          pending?: number
          configured?: boolean
          missing?: boolean
        }>
      }>
    }>('/api-endpoints/tree')
  }


  /**
   * 上传开发给的接口文档（Confluence 导出的 .docx）。
   * 文档补的是抓包补不了的那一半：必填、默认值、枚举回落、边界、哪些字段可空。
   */
  async importInterfaceDoc(project: string, file: File) {
    const form = new FormData()
    form.append('project', project)
    form.append('file', file)
    const response = await authFetch(`${this.baseURL}/api-endpoints/import-doc`, {
      method: 'POST',
      body: form
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '导入失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{
      matched: number
      unmatched: string[]
      /** 按「同名透传」推断着套过去的路径。是推断不是文档写的，所以单独列 */
      aliasApplied: string[]
      branches: string[]
      details: Array<{ httpMethod: string; path: string; params: number; fields: number; nullableFields: number }>
    }>
  }

  /** 状态字典由后端下发，前端不硬编码这几个中文名 */
  async fetchApiEndpointStatuses() {
    return this.request<Array<{ code: string; label: string; hint: string; actionable: boolean }>>(
      '/api-endpoints/statuses'
    )
  }

  async getApiProjects(params?: { enabledOnly?: boolean; catalogOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    if (params?.catalogOnly != null) q.set('catalogOnly', String(params.catalogOnly))
    const qs = q.toString()
    return this.request<
      Array<{
        code: string
        name: string
        description?: string
        enabled?: boolean
        sortOrder?: number
        successCodePath?: string
        successCodeValue?: string
      }>
    >(qs ? `/api-projects?${qs}` : '/api-projects')
  }

  async getApiProjectsTree(params?: { enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<{
      categories: Array<{
        key: string
        label: string
        count: number
        projects: Array<{
          code: string
          name: string
          description?: string
          kind?: string
          enabled?: boolean
          sortOrder?: number
          successCodePath?: string
          successCodeValue?: string
          category?: string
          missing?: boolean
        }>
      }>
    }>(qs ? `/api-projects/tree?${qs}` : '/api-projects/tree')
  }

  /**
   * 统一树：分类 → 项目 → 模块，每层带 counts。
   *
   * 与 getApiProjectTree 的区别是它带覆盖度数字——每个项目有多少接口用例／接口／
   * UI 流程／元素／Bug。树因此不只是目录，而能直接回答「哪个项目没人测」。
   *
   * 后端收敛了原先三个各自为政的树端点，节点结构统一为
   * {key,label,type,counts,children}，一套渲染即可。
   *
   * @param includeEmpty 默认 true 保留零资产的项目——「一条用例都没有」正是要看见的
   */
  async getUnifiedTree(includeEmpty = true) {
    const qs = includeEmpty ? '' : '?includeEmpty=false'
    return this.request<{
      dimension: string
      nodes: Array<{
        key: string
        label: string
        type: 'CATEGORY'
        projectCount: number
        counts: Record<string, number>
        children: Array<{
          key: string
          label: string
          type: 'PROJECT'
          /** BACKEND | CLIENT | H5，渲染图标用；它是属性不是层级 */
          kind: string
          total: number
          counts: Record<string, number>
          children: Array<{
            /** 稳定标识，前端自己映射到路由 */
            key: 'API_CASES' | 'API_ENDPOINTS' | 'API_COLLECTIONS' | 'UI_FLOWS' | 'UI_ELEMENTS' | 'BUGS'
            label: string
            type: 'MODULE'
            count: number
            projectCode: string
          }>
        }>
      }>
    }>(`/tree${qs}`)
  }

  /**
   * 接口覆盖差集：白盒（代码变更分析）与黑盒（前端抓包）两边结论的对照。
   *
   * changedNotCaptured 是最该看的那个数——接口改了但抓包一次都没捕获到，
   * 要么这条路没测到，要么前端本来就不调它。
   */
  async getCoverageGapSummary(includeArchived = false) {
    const qs = includeArchived ? '?includeArchived=true' : ''
    return this.request<Array<{
      requirementNo: string
      total: number
      changedNotCaptured: number
      covered: number
      capturedNotChanged: number
      manual: number
    }>>(`/coverage-gap${qs}`)
  }

  async getCoverageGap(requirementNo: string, includeArchived = false) {
    const qs = includeArchived ? '?includeArchived=true' : ''
    return this.request<{
      requirementNo: string
      total: number
      coveredCount: number
      changedNotCapturedCount: number
      capturedNotChangedCount: number
      manualCount: number
      /** 一句人话，直接说下一步做什么 */
      hint: string
      covered: Array<Record<string, unknown>>
      changedNotCaptured: Array<Record<string, unknown>>
      capturedNotChanged: Array<Record<string, unknown>>
    }>(`/coverage-gap/${encodeURIComponent(requirementNo)}${qs}`)
  }

  /** 客户端 App ↔ 项目 关联，UI 自动化资产靠它归属到项目 */
  async getAppProjectLinks(params: { appId?: string; projectCode?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.appId) qs.set('appId', params.appId)
    if (params.projectCode) qs.set('projectCode', params.projectCode)
    const s = qs.toString()
    return this.request<Array<{
      appId: string
      projectCode: string
      platform?: string
      relation: string
      note?: string
      appName?: string
      projectName?: string
    }>>(s ? `/app-project-links?${s}` : '/app-project-links')
  }

  async saveAppProjectLink(body: Record<string, unknown>) {
    return this.request<any>('/app-project-links', { method: 'POST', body: JSON.stringify(body) })
  }

  async deleteAppProjectLink(appId: string, projectCode: string) {
    return this.request<any>(
      `/app-project-links?appId=${encodeURIComponent(appId)}&projectCode=${encodeURIComponent(projectCode)}`,
      { method: 'DELETE' }
    )
  }

  /** 还没挂上任何项目的 App——它们的 UI 资产在项目树上是看不见的 */
  async getUnlinkedApps() {
    return this.request<Array<{ appId: string; appName: string }>>('/app-project-links/unlinked-apps')
  }

  async createApiProject(body: Record<string, unknown>) {
    return this.request<any>('/api-projects', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateApiProject(code: string, body: Record<string, unknown>) {
    return this.request<any>(`/api-projects/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteApiProject(code: string) {
    return this.request<{ ok: boolean }>(`/api-projects/${encodeURIComponent(code)}`, {
      method: 'DELETE'
    })
  }

  async listApiProjectCategories() {
    return this.request<
      Array<{ key: string; label: string; sortOrder?: number; builtin?: boolean }>
    >('/api-projects/categories')
  }

  async createApiProjectCategory(body: { label: string; sortOrder?: number }) {
    return this.request<{ key: string; label: string; sortOrder?: number; builtin?: boolean }>(
      '/api-projects/categories',
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async updateApiProjectCategory(key: string, body: { label: string; sortOrder?: number }) {
    return this.request<{ key: string; label: string; sortOrder?: number; builtin?: boolean }>(
      '/api-projects/categories',
      {
        method: 'POST',
        body: JSON.stringify({ key, label: body.label, sortOrder: body.sortOrder })
      }
    )
  }

  async deleteApiProjectCategory(key: string) {
    return this.request<{ ok: boolean }>(`/api-projects/categories/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    })
  }

  async getApiUrls(params?: { project?: string; environment?: string; enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.project) q.set('project', params.project)
    if (params?.collectionId) q.set('collectionId', params.collectionId)
    if (params?.environment) q.set('environment', params.environment)
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<any[]>(qs ? `/api-urls?${qs}` : '/api-urls')
  }

  async createApiUrl(body: Record<string, unknown>) {
    return this.request<any>('/api-urls', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateApiUrl(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/api-urls/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteApiUrl(id: string) {
    return this.request<{ ok: boolean }>(`/api-urls/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  // —— 接口测试（TEST / PROD 环境）——
  async getApiTestEnvs() {
    return this.request<
      Array<{
        environment: string
        name: string
        baseUrl: string
        defaultHeaders?: string
        defaultToken?: string
        /** 数据库断言用的只读库。密码回显成遮罩，原样传回即保持不变 */
        dbHost?: string
        dbPort?: number
        dbName?: string
        dbUser?: string
        dbPassword?: string
        enabled?: boolean
      }>
    >('/api-test/envs')
  }

  async saveApiTestEnv(
    environment: string,
    body: {
      name?: string
      baseUrl: string
      defaultHeaders?: string
      defaultToken?: string
      dbHost?: string
      dbPort?: number
      dbName?: string
      dbUser?: string
      dbPassword?: string
      enabled?: boolean
    }
  ) {
    return this.request<any>(`/api-test/envs/${encodeURIComponent(environment)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  /** 试一下数据库断言的库连不连得上——配完不试就只能靠跑用例来发现连不上 */
  async checkApiTestEnvDb(environment: string) {
    return this.request<{ ok: boolean; message: string }>(
      `/api-test/envs/${encodeURIComponent(environment)}/db-check`,
      { method: 'POST' }
    )
  }

  // ---------- 用例集合 ----------

  async getApiTestCollections(params?: {
    project?: string
    scope?: 'TEST' | 'LIVE'
    includeArchived?: boolean
    appVersion?: string
  }) {
    const q = new URLSearchParams()
    if (params?.project) q.set('project', params.project)
    if (params?.scope) q.set('scope', params.scope)
    if (params?.includeArchived != null) q.set('includeArchived', String(params.includeArchived))
    if (params?.appVersion) q.set('appVersion', params.appVersion)
    const qs = q.toString()
    return this.request<
      Array<{
        id: string
        project: string
        name: string
        description?: string
        enabled?: boolean
        sortOrder?: number
        scope?: string
        lifecycle?: string
        requirementNo?: string
        appVersion?: string
        caseCount?: number
        passRate?: number | null
        lastRunAt?: string | null
        lastRunId?: string | null
      }>
    >(qs ? `/api-test/collections?${qs}` : '/api-test/collections')
  }

  async getApiTestCollectionTree(params?: {
    scope?: 'TEST' | 'LIVE'
    appVersion?: string
    includeArchived?: boolean
  }) {
    const q = new URLSearchParams()
    if (params?.scope) q.set('scope', params.scope)
    if (params?.appVersion) q.set('appVersion', params.appVersion)
    if (params?.includeArchived != null) q.set('includeArchived', String(params.includeArchived))
    const qs = q.toString()
    return this.request<{
      treeMode?: 'TEST' | 'LIVE'
      scope: string
      appVersion: string
      categories: Array<{
        key: string
        label: string
        projects: Array<{
          code: string
          label: string
          collectionCount?: number
          caseCount?: number
          runCollectionId?: string
          groups?: Array<{
            key?: string
            kind?: string
            label: string
            project?: string
            collections?: Array<Record<string, unknown>>
          }>
          controllers?: Array<{
            key?: string
            kind?: string
            label: string
            handler?: string
            caseCount?: number
            statusTag?: string
            previews?: Array<{ method?: string; path?: string; label?: string }>
          }>
          collections?: Array<Record<string, unknown>>
        }>
      }>
    }>(`/api-test/collections/tree?${qs}`)
  }

  async getApiTestProjectLiveCases(project: string, params?: { includeArchived?: boolean }) {
    const q = new URLSearchParams()
    if (params?.includeArchived != null) q.set('includeArchived', String(params.includeArchived))
    const qs = q.toString()
    return this.request<Array<{ id: string; name: string; method: string; path: string; enabled?: boolean; controller?: string }>>(
      qs
        ? `/api-test/projects/${encodeURIComponent(project)}/live-cases?${qs}`
        : `/api-test/projects/${encodeURIComponent(project)}/live-cases`
    )
  }

  async getApiTestCollectionCases(collectionId: string) {
    return this.request<Array<{ id: string; name: string; method: string; path: string; enabled?: boolean; controller?: string }>>(
      `/api-test/collections/${encodeURIComponent(collectionId)}/cases`
    )
  }

  async archiveApiTestCollection(id: string) {
    return this.request<{ ok: boolean }>(`/api-test/collections/${encodeURIComponent(id)}/archive`, {
      method: 'POST'
    })
  }

  async releaseApiTestRequirement(requirementNo: string) {
    return this.request<{ requirementNo: string; collectionsArchived: number; endpointsArchived: number }>(
      `/api-test/requirements/${encodeURIComponent(requirementNo)}/release`,
      { method: 'POST' }
    )
  }

  async createApiTestCollection(body: Record<string, unknown>) {
    return this.request<any>('/api-test/collections', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateApiTestCollection(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/api-test/collections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteApiTestCollection(id: string) {
    return this.request<{ ok: boolean }>(`/api-test/collections/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  /** id 传 '__none__' 表示移出集合 */
  async assignApiTestCases(collectionId: string, caseIds: string[]) {
    return this.request<{ assigned: number }>(
      `/api-test/collections/${encodeURIComponent(collectionId)}/cases`,
      { method: 'POST', body: JSON.stringify({ caseIds }) }
    )
  }

  async autoGroupApiTestCases(project: string) {
    return this.request<{ created: number; assigned: number }>(
      `/api-test/projects/${encodeURIComponent(project)}/auto-group`,
      { method: 'POST' }
    )
  }

  // ---------- 定时执行 ----------

  async getApiTestSchedules() {
    return this.request<
      Array<{
        id: string
        name: string
        cron: string
        collectionId?: string | null
        collectionName?: string | null
        project?: string | null
        environment: string
        enabled: boolean
        nextRunAt?: string | null
        lastRunAt?: string | null
        lastRunId?: string | null
        lastStatus?: string | null
        lastMessage?: string | null
        caseCount?: number
        recentRuns?: Array<{
          status?: string | null
          runId?: string | null
          at?: string | null
          message?: string | null
        }>
      }>
    >('/api-test/schedules')
  }

  async saveApiTestSchedule(body: Record<string, unknown>) {
    return this.request<any>('/api-test/schedules', { method: 'POST', body: JSON.stringify(body) })
  }

  async deleteApiTestSchedule(id: string) {
    return this.request<{ ok: boolean }>(`/api-test/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  async setApiTestScheduleEnabled(id: string, enabled: boolean) {
    return this.request<any>(`/api-test/schedules/${encodeURIComponent(id)}/enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    })
  }

  async runApiTestScheduleNow(id: string) {
    return this.request<any>(`/api-test/schedules/${encodeURIComponent(id)}/run`, { method: 'POST' })
  }

  // ---------- 执行报告 ----------

  async getApiTestRuns(params: { collectionId?: string; limit?: number } = {}) {
    const q = new URLSearchParams()
    if (params.collectionId) q.set('collectionId', params.collectionId)
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return this.request<
      Array<{
        id: string
        environment: string
        collectionId?: string | null
        collectionName?: string | null
        total: number
        passed: number
        failed: number
        durationMs: number
        ok: boolean | number
        message?: string
        createdAt: string
      }>
    >(`/api-test/runs${qs ? '?' + qs : ''}`)
  }

  async browseApiTestRuns(limit = 200) {
    return this.request<
      Array<{
        id: string
        environment: string
        collectionId?: string | null
        collectionName?: string | null
        collectionProject?: string | null
        requirementNo?: string | null
        sourceBranch?: string | null
        collectionScope?: string | null
        total: number
        passed: number
        failed: number
        durationMs: number
        ok: boolean | number
        message?: string
        createdAt: string
        interfaces: Array<{ project: string; method: string; path: string }>
      }>
    >(`/api-test/runs/browse?limit=${limit}`)
  }

  async deleteApiTestRun(runId: string) {
    return this.request<{ ok: boolean }>(`/api-test/runs/${encodeURIComponent(runId)}`, {
      method: 'DELETE'
    })
  }

  async deleteApiTestRuns(ids: string[]) {
    return this.request<{ ok: boolean; deleted: number }>(`/api-test/runs`, {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    })
  }

  async getApiTestRunDetail(runId: string) {
    return this.request<{ run: any; cases: any[] }>(`/api-test/runs/${encodeURIComponent(runId)}`)
  }

  async getApiTestTrend(days = 7) {
    return this.request<Array<Record<string, any>>>(`/api-test/runs/trend?days=${days}`)
  }

  /** 环境变量。secret 的值后端返回掩码，真值不下发浏览器 */
  async getApiTestVariables(environment: string) {
    return this.request<
      Array<{
        environment: string
        name: string
        value?: string
        secret?: boolean
        enabled?: boolean
        description?: string
        sortOrder?: number
      }>
    >(`/api-test/envs/${encodeURIComponent(environment)}/variables`)
  }

  async saveApiTestVariable(
    environment: string,
    body: {
      name: string
      value?: string
      secret?: boolean
      enabled?: boolean
      description?: string
      sortOrder?: number
    }
  ) {
    return this.request<any>(`/api-test/envs/${encodeURIComponent(environment)}/variables`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteApiTestVariable(environment: string, name: string) {
    return this.request<{ ok: boolean }>(
      `/api-test/envs/${encodeURIComponent(environment)}/variables/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    )
  }

  // ---------- 流程覆盖了哪些用例（真相存在用例的 flowId 上，这里只是另一个编辑入口） ----------

  /** 勾了这批流程还缺哪些前置；回归轨只提示不自动补 */
  async resolveFlowDependencies(flowIds: string[]) {
    return this.request<{
      orderedIds: string[]
      missing: Array<{ id: string; name: string }>
    }>('/ui-flows/resolve-dependencies', {
      method: 'POST',
      body: JSON.stringify({ flowIds })
    })
  }

  async getFlowCases(flowId: string) {
    return this.request<any[]>(`/ui-flows/${encodeURIComponent(flowId)}/cases`)
  }

  async getFlowLinkableCases(flowId: string, params: { platform?: string; keyword?: string } = {}) {
    const q = new URLSearchParams()
    if (params.platform) q.set('platform', params.platform)
    if (params.keyword) q.set('keyword', params.keyword)
    const qs = q.toString()
    return this.request<any[]>(
      `/ui-flows/${encodeURIComponent(flowId)}/linkable-cases${qs ? '?' + qs : ''}`
    )
  }

  async setFlowCases(flowId: string, caseIds: number[]) {
    return this.request<{ linked: number; unlinked: number }>(
      `/ui-flows/${encodeURIComponent(flowId)}/cases`,
      { method: 'PUT', body: JSON.stringify({ caseIds }) }
    )
  }

  async getApiTestProjects() {
    return this.request<string[]>('/api-test/projects')
  }

  async reimportApiTestProject(project: string) {
    return this.request<{ ok: boolean; imported: number; project: string }>(
      `/api-test/projects/${encodeURIComponent(project)}/reimport`,
      { method: 'POST' }
    )
  }

  async getApiTestCases(params?: {
    project?: string
    /** 传 __none__ 查还没归组的用例 */
    collectionId?: string
    environment?: string
    enabledOnly?: boolean
    keyword?: string
    page?: number
    size?: number
  }) {
    const q = new URLSearchParams()
    if (params?.project) q.set('project', params.project)
    if (params?.environment) q.set('environment', params.environment)
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    if (params?.keyword) q.set('keyword', params.keyword)
    if (params?.page != null) q.set('page', String(params.page))
    if (params?.size != null) q.set('size', String(params.size))
    const qs = q.toString()
    const path = qs ? `/api-test/cases?${qs}` : '/api-test/cases'
    if (params?.page != null) {
      return this.request<{
        content: any[]
        totalElements: number
        totalPages: number
        page: number
        size: number
      }>(path)
    }
    return this.request<any[]>(path)
  }

  async createApiTestCase(body: Record<string, unknown>) {
    return this.request<any>('/api-test/cases', { method: 'POST', body: JSON.stringify(body) })
  }

  async updateApiTestCase(id: string, body: Record<string, unknown>) {
    return this.request<any>(`/api-test/cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteApiTestCase(id: string) {
    return this.request<{ ok: boolean }>(`/api-test/cases/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  async runApiTest(body: {
    /** 与 collectionId 二选一 */
    caseIds?: string[]
    /** 按集合执行：顺序由集合内用例的排序号决定，调用方不用管 */
    collectionId?: string
    environment?: string
    tokenOverride?: string
    urlIdOverride?: string
    confirmProd?: boolean
  }) {
    return this.request<{
      ok: boolean
      message: string
      environment: string
      total: number
      passed: number
      failed: number
      durationMs: number
      runId?: string
      collectionId?: string
      collectionName?: string
      cases: Array<{
        id: string
        name: string
        method?: string
        url?: string
        status: string
        httpStatus?: number
        durationMs?: number
        error?: string
        assertionResults?: string[]
        bodyPreview?: string
        /** 实际发出去的和实际收到的——没有它，人只能拿 Postman 再手工重放一遍 */
        reqHeaders?: Record<string, string>
        reqBody?: string
        respHeaders?: Record<string, string>
      }>
    }>('/api-test/run', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async getAppPortal() {
    return this.request<{ groups: Array<{ key: string; label: string; links: any[] }> }>('/app-portal')
  }
  async saveAppPortalLink(body: {
    id?: string
    groupKey: string
    title: string
    url: string
    remark?: string
    sortOrder?: number
  }) {
    return this.request<{ ok: boolean; id: string }>('/app-portal', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }
  async deleteAppPortalLink(id: string) {
    return this.request<{ ok: boolean }>(`/app-portal/${id}`, { method: 'DELETE' })
  }

  /** 接口测试统计面板：KPI + Recent Runs + Collections */
  async getApiTestStats() {
    return this.request<{
      updatedAt?: string
      cases: number
      casesDelta7d: number
      passRate: number | null
      passRateDelta: number | null
      failed: number
      failedDelta: number | null
      avgLatencyMs: number | null
      avgLatencyDeltaMs: number | null
      recentRuns: Array<{
        id: string
        caseId?: string
        name?: string
        method?: string
        path?: string
        status?: string
        durationMs?: number | null
        createdAt?: string
      }>
      collections: Array<{
        project: string
        name: string
        caseCount: number
        passRate: number | null
      }>
    }>('/api-test/stats')
  }

  /** Web 端测试：执行编排用例（caseIds）或临时 URL（cases） */
  async webTestRun(body: {
    caseIds?: string[]
    tokenOverride?: string
    cases?: Array<{
      name?: string
      channel?: string
      url?: string
      authMode?: string
      token?: string
      authQueryKey?: string
      cookieDomain?: string
      h5PageId?: string
    }>
  }) {
    return this.request<{
      ok: boolean
      message: string
      total: number
      passed: number
      failed: number
      skipped: number
      durationMs: number
      reportDir?: string
      cases: Array<{
        name: string
        channel?: string
        url?: string
        status: string
        error?: string
        requirementRef?: string
      }>
      logTail?: string
    }>('/web-test/run', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // —— CodeWords AI Agent / 元素监控 ——
  async getCodeWordsStatus() {
    return this.request<{
      enabled: boolean
      configured: boolean
      agentId: string
      monitorWorkflowId: string
      testCaseGeneratorId?: string
      apiBase: string
      knowledgeCount?: number
      storageReady?: boolean
    }>('/codewords/status')
  }

  async codeWordsChat(body: { message: string; sessionId?: string }) {
    return this.request<any>('/codewords/chat', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async codeWordsMonitor(body: { url: string; schedule?: boolean }) {
    return this.request<any>('/codewords/monitor', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** CodeWords 测试用例生成器 v2（仅返回 JSON，不落库） */
  /**
   * 从 Appium Inspector 截图里认元素。只出草稿，不入库——
   * 模型是在认字，定位器错一个字符不会报错，只会在跑流程时超时找不到。
   */
  async readInspectorShots(files: File[]) {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    const res = await authFetch(`${this.baseURL}/ui-elements/read-inspector-shot`, {
      method: 'POST',
      body: fd
    })
    const data = await res.json().catch(() => ({ message: '识别失败' }))
    if (!res.ok) throw new Error(data.message || '识别失败')
    return data as {
      drafts: Array<{
        nameEn: string
        nameZh: string
        locatorType: string
        locatorValue: string
        fallbacks: string[]
        visualHint: string
        confidence: 'HIGH' | 'MEDIUM' | 'LOW'
        note: string
      }>
    }
  }

  /**
   * 用千问生成用例（不落库）。截图/需求文档直接传文件，不用先放到公网。
   * 替代原来按次计费的 CodeWords 工作流，产出格式一致。
   */
  async generateTestCasesByQwen(params: {
    pageName: string
    text?: string
    files?: File[]
    /** PAGE_SHOT（默认）/ REQUIREMENT_DOC —— 两种素材的提示词是相反的 */
    materialKind?: 'PAGE_SHOT' | 'REQUIREMENT_DOC'
  }) {
    const fd = new FormData()
    fd.append('pageName', params.pageName)
    if (params.text) fd.append('text', params.text)
    if (params.materialKind) fd.append('materialKind', params.materialKind)
    ;(params.files || []).forEach((f) => fd.append('files', f))
    // 这里必须走裸 fetch：request() 会写死 Content-Type: application/json，
    // 而 FormData 需要浏览器自己带上 multipart 的 boundary。
    // 但登录态得手动补上——漏了的话鉴权一开这个功能就整个用不了
    const res = await authFetch(`${this.baseURL}/ai-test-cases/generate`, {
      method: 'POST',
      body: fd
    })
    const data = await res.json().catch(() => ({ message: '生成失败' }))
    if (!res.ok) throw new Error(data.message || '生成失败')
    return data as {
      page: string
      total: number
      model: string
      test_cases: any[]
      open_questions?: Array<Record<string, any>>
    }
  }

  // —— 接口变更分析（分支 vs 基线）——
  async getApiChangeProjects() {
    return this.request<Array<{
      code: string; name: string; repoPath?: string; baseBranch?: string; ready: boolean
    }>>('/api-changes/projects')
  }

  async getApiChangeBranches(project: string) {
    return this.request<{ repoPath: string; branches: string[]; current: string }>(
      `/api-changes/branches?project=${encodeURIComponent(project)}`
    )
  }

  // —— 接口变更分析：表结构 / 代码目录 ——
  async getApiTableSchemas(project?: string) {
    const q = project ? `?project=${encodeURIComponent(project)}` : ''
    return this.request<any[]>(`/api-changes/table-schemas${q}`)
  }

  async saveApiTableSchema(body: Record<string, unknown>) {
    return this.request<any>('/api-changes/table-schemas', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async deleteApiTableSchema(id: number) {
    return this.request<any>(`/api-changes/table-schemas/${id}`, { method: 'DELETE' })
  }

  /** 粘进去先看看推导出什么，不落库 */
  async previewTableHints(ddl: string) {
    return this.request<{ tableName: string; testHints: any[] }>(
      '/api-changes/table-schemas/preview',
      { method: 'POST', body: JSON.stringify({ ddl }) }
    )
  }

  async getApiCodeDirs(project?: string) {
    const q = project ? `?project=${encodeURIComponent(project)}` : ''
    return this.request<any[]>(`/api-changes/code-dirs${q}`)
  }

  async saveApiCodeDir(body: Record<string, unknown>) {
    return this.request<any>('/api-changes/code-dirs', { method: 'POST', body: JSON.stringify(body) })
  }

  async deleteApiCodeDir(id: number) {
    return this.request<any>(`/api-changes/code-dirs/${id}`, { method: 'DELETE' })
  }

  /** 目录对目录：拿不到内网、只能把两个分支各拷一份到本地时用 */
  async analyzeApiChangeDirs(body: { project?: string; baseDir: string; headDir: string }) {
    return this.request<any>('/api-changes/analyze-dirs', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // ---------- 变更影响：表→接口、变更→需复查用例 ----------
  async getTableImpact(table: string, project?: string) {
    const q = project ? `?project=${encodeURIComponent(project)}` : ''
    return this.request<any>(`/table-impact/${encodeURIComponent(table)}${q}`)
  }
  async getTableImpacts(body: { tables: string[]; project?: string }) {
    return this.request<any>('/table-impact', { method: 'POST', body: JSON.stringify(body) })
  }
  async getCaseReview(body: { project?: string; changedFields?: string[]; changedTables?: string[] }) {
    return this.request<any>('/case-review', { method: 'POST', body: JSON.stringify(body) })
  }

  async analyzeApiChanges(body: { project: string; baseRef?: string; headRef?: string }) {
    return this.request<any>('/api-changes/analyze', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 接口变更分析历史报告列表 */
  async listApiChangeReports(params?: { project?: string; limit?: number }) {
    const qs = new URLSearchParams()
    if (params?.project) qs.set('project', params.project)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<
      Array<{
        id: number
        project?: string
        baseRef?: string
        headRef?: string
        summary?: string
        createdAt?: string
      }>
    >(`/api-changes/reports${suffix}`)
  }

  async getApiChangeReport(id: number) {
    return this.request<{
      id: number
      project?: string
      baseRef?: string
      headRef?: string
      summary?: string
      createdAt?: string
      report: any
    }>(`/api-changes/reports/${id}`)
  }

  async deleteApiChangeReport(id: number) {
    return this.request<{ ok: boolean }>(`/api-changes/reports/${id}`, { method: 'DELETE' })
  }

  /** 表格解析预览：只解析不落库，让人先看一眼再决定 */
  async parseTestCaseSheet(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await authFetch(`${this.baseURL}/ai-test-cases/import/parse`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({ message: '解析失败' }))
    if (!res.ok) throw new Error(data.message || '解析失败')
    return data as { rows: any[]; raw: any[]; warnings: string[] }
  }

  /** 从表格软件直接粘贴的内容（行换行、列 Tab），同样只解析不落库 */
  async parseTestCaseText(text: string) {
    return this.request<{ rows: any[]; raw: any[]; warnings: string[] }>(
      '/ai-test-cases/import/parse-text',
      { method: 'POST', body: JSON.stringify({ text }) }
    )
  }

  /** 确认导入：rows 用预览返回的 raw */
  async importTestCases(category: string, rows: any[]) {
    return this.request<{ imported: number; failed: string[] }>('/ai-test-cases/import', {
      method: 'POST',
      body: JSON.stringify({ category, rows })
    })
  }

  /** 手工新建一条用例（source=MANUAL）；生成器批量落库仍走 saveAiTestCasesBatch */
  async createAiTestCase(body: Record<string, unknown>) {
    return this.request<any>('/ai-test-cases', { method: 'POST', body: JSON.stringify(body) })
  }

  /** 编辑用例：只传要改的字段。flowId 传空串＝解除流程关联，不传＝不动 */
  async updateAiTestCase(id: number, body: Record<string, unknown>) {
    return this.request<any>(`/ai-test-cases/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  }

  /**
   * 对着一条用例提问。带着此前对话一起在本机仓库检索，不经过千问。
   */
  async askAiTestCase(id: number, question: string, history: Array<{ role: string; content: string }> = []) {
    return this.request<{
      answer: string
      model: string
      caseId?: string
      requirementNo?: string
      sources?: string[]
    }>(`/ai-test-cases/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question, history })
    })
  }

  /** 需求页上还没点到某一条 TC 时，按整单问 */
  async askRequirement(
    requirementNo: string,
    question: string,
    history: Array<{ role: string; content: string }> = []
  ) {
    return this.request<{
      answer: string
      model: string
      caseId?: string
      requirementNo?: string
      sources?: string[]
    }>(`/ai-test-cases/requirements/${encodeURIComponent(requirementNo)}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question, history })
    })
  }

  /** 端的字典：客户端 / H5 / 后端 / 管理后台 */
  async fetchSides() {
    return this.request<Array<{ code: string; label: string; hint: string }>>('/ai-test-cases/sides')
  }

  /** 某个需求单涉及的接口（分支改动 + 人工补充） */
  async fetchRequirementEndpoints(requirementNo: string) {
    return this.request<Array<{
      id: string
      project?: string
      endpointId?: string
      httpMethod: string
      path: string
      summary?: string
      changeFlag?: string
      changeNote?: string
      sourceBranch?: string
      /** SYNC＝对比分析关联的，MANUAL＝人工补的 */
      source?: string
    }>>(`/ai-test-cases/requirement-endpoints?requirementNo=${encodeURIComponent(requirementNo)}`)
  }

  /** 各需求单关联接口数量，供清单「涉及接口 · N」 */
  async fetchRequirementEndpointCounts() {
    return this.request<Array<{ requirementNo: string; total: number }>>(
      '/ai-test-cases/requirement-endpoint-counts'
    )
  }

  /** 需求单提测覆盖：客户端 / H5 / 后端接口 */
  async fetchRequirementCoverage(requirementNo: string, category?: string) {
    const q = new URLSearchParams({ requirementNo })
    if (category) q.set('category', category)
    return this.request<{
      requirementNo: string
      ready: boolean
      summary: string
      dimensions: Array<Record<string, any>>
    }>(`/ai-test-cases/requirement-coverage?${q.toString()}`)
  }

  async waiveRequirementCoverage(body: { requirementNo: string; dimension: string; reason: string }) {
    return this.request<{ success: boolean }>('/ai-test-cases/requirement-coverage/waive', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async clearRequirementCoverageWaiver(requirementNo: string, dimension: string) {
    return this.request<{ success: boolean }>(
      `/ai-test-cases/requirement-coverage/waive?requirementNo=${encodeURIComponent(requirementNo)}&dimension=${encodeURIComponent(dimension)}`,
      { method: 'DELETE' }
    )
  }

  // —— 抓包：安卓走 USB（adb reverse），iOS 要 WiFi 代理 ——

  async startCapture(body: {
    deviceId: string
    platform: string
    requirementNo?: string
    hosts?: string
  }) {
    return this.request<{
      sessionId: string
      platform: string
      hosts: string
      /** iOS 才有：要人手动去设置里填什么 */
      manualProxyTip?: string | null
    }>('/packet-capture/start', { method: 'POST', body: JSON.stringify(body) })
  }

  /** 抓包过程中实时看——不然你不知道代理到底通没通，白操作一遍 */
  async peekCapture(sessionId: string) {
    return this.request<{
      total: number
      flows: any[]
      /** 代理上见到的<b>全部</b>域名（含被白名单挡掉的）。抓到 0 条时靠它区分是哪种原因 */
      seenHosts: Record<string, number>
      seenTotal: number
      /** 握手失败的域名——那是「抓不了」，不是「配错了」 */
      failedHosts: Record<string, number>
    }>(`/packet-capture/${encodeURIComponent(sessionId)}/peek`)
  }

  async stopCapture(sessionId: string, body: { requirementNo?: string; project?: string }) {
    return this.request<{
      total: number
      distinct: number
      linked: number
      /** 挂了但没选项目时的提醒 */
      linkWarn: string
      seenHosts: Record<string, number>
      failedHosts: Record<string, number>
      flows: CapturedFlow[]
    }>(`/packet-capture/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 页面刷新后用它恢复「还在抓」的状态，否则会留下一个撤不掉的代理 */
  /**
   * 某一条的详情：请求头、Cookies、请求/响应体。
   * sessionId 传 'last' 取上一场已结束的抓包——看响应基本都是抓完之后的事。
   */
  async captureDetail(sessionId: string, seq: number) {
    return this.request<{
      available: boolean
      message?: string
      detail?: CapturedDetail
    }>(`/packet-capture/${encodeURIComponent(sessionId)}/flow/${seq}/detail`)
  }

  /** 抓完之后补挂到需求单——抓之前经常还不知道该挂哪个单 */
  async linkCapturedFlows(body: {
    requirementNo: string
    /** 必填：接口清单按项目分，没有项目就生不成用例 */
    project: string
    sessionId?: string
    flows: Array<{ method: string; path: string; host: string; seq?: number }>
  }) {
    return this.request<{ linked: number; fieldsExtracted?: number }>('/packet-capture/link', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async importOpenApi(project: string, content: string) {
    return this.request<{ imported: number; skipped: number; warnings: string[] }>(
      `/api-endpoints/projects/${encodeURIComponent(project)}/import-openapi`,
      { method: 'POST', body: JSON.stringify({ content }) }
    )
  }

  /**
   * 把这次抓包用的 token 存到测试环境。
   * 用例里不写死 token——它会过期，写死的话过期那天所有用例集体变红。
   */
  async saveCaptureToken(sessionId: string, environment = 'TEST') {
    return this.request<{ ok?: boolean; message: string }>(
      `/packet-capture/${encodeURIComponent(sessionId)}/save-token`,
      { method: 'POST', body: JSON.stringify({ environment }) }
    )
  }

  async currentCapture() {
    return this.request<{
      running: boolean
      sessionId?: string
      deviceId?: string
      platform?: string
      hosts?: string
      requirementNo?: string
      startedAt?: number
    }>('/packet-capture/current')
  }

  /**
   * 从一条涉及接口直接生成用例并归入集合。
   * 不传 collectionId 就按需求单自动找/建一个测试集合——
   * 「本单上线」是按需求单整批归档的，一单一集合那一步才归得干净。
   */
  async generateCaseFromRequirementEndpoint(
    id: string,
    body: { collectionId?: string; appVersion?: string; sourceBranch?: string }
  ) {
    return this.request<{
      caseId: string
      caseName: string
      caseEnabled: boolean
      note: string
      collectionId: string
      collectionName: string
      collectionCreated: boolean
    }>(`/ai-test-cases/requirement-endpoints/${encodeURIComponent(id)}/generate-case`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async getApiTestPickableTree(params?: { requirementNo?: string; appVersion?: string }) {
    const q = new URLSearchParams()
    if (params?.requirementNo) q.set('requirementNo', params.requirementNo)
    if (params?.appVersion) q.set('appVersion', params.appVersion)
    const qs = q.toString()
    return this.request<{
      options: Array<{
        value: string
        label: string
        disabled?: boolean
        children: Array<{ value: string; label: string }>
      }>
    }>(qs ? `/api-test/collections/pickable-tree?${qs}` : '/api-test/collections/pickable-tree')
  }

  /** @deprecated 请用 getApiTestPickableTree 级联 */
  /**
   * 给一个需求单下所有涉及接口一次性生成用例。
   * 逐个点太累——四个接口点四次，第三次就没人点了；而没生成的话覆盖率永远是 0%。
   */
  async generateCasesForRequirement(
    requirementNo: string,
    body: { appVersion?: string; collectionId?: string }
  ) {
    return this.request<{
      created: number
      reused: number
      failed: string[]
      cases: Array<{
        path: string
        caseId: string
        caseName: string
        enabled: boolean
        reused: boolean
        collectionName: string
      }>
    }>(`/ai-test-cases/requirements/${encodeURIComponent(requirementNo)}/generate-cases`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async getPickableCollections(project: string, requirementNo?: string, appVersion?: string) {
    const q = new URLSearchParams({ project })
    if (requirementNo) q.set('requirementNo', requirementNo)
    if (appVersion) q.set('appVersion', appVersion)
    return this.request<
      Array<{ id: string; name: string; requirementNo?: string; appVersion?: string; caseCount?: number }>
    >(`/ai-test-cases/requirement-endpoints/collections?${q.toString()}`)
  }

  // ---------- Bug 记录 ----------

  async fetchBugManage(params?: {
    environment?: string
    status?: string
    priority?: string
    assignee?: string
    q?: string
  }) {
    const q = new URLSearchParams()
    if (params?.environment) q.set('environment', params.environment)
    if (params?.status) q.set('status', params.status)
    if (params?.priority) q.set('priority', params.priority)
    if (params?.assignee) q.set('assignee', params.assignee)
    if (params?.q) q.set('q', params.q)
    const qs = q.toString()
    const path = qs ? `/requirement-bugs?${qs}` : '/requirement-bugs'
    try {
      return await this.request<{
        bugs: Array<Record<string, any>>
        assignees: string[]
        statusCounts: Record<string, number>
      }>(path)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('not supported') && !msg.includes('requirementNo')) {
        throw e
      }
      return this.request<{
        bugs: Array<Record<string, any>>
        assignees: string[]
        statusCounts: Record<string, number>
      }>('/requirement-bugs/manage', {
        method: 'POST',
        body: JSON.stringify(params || {})
      })
    }
  }

  /** 某个需求单下测出来的 bug。字段对齐 wiki 那张表，搬过去不用重新映射 */
  async fetchRequirementBugs(requirementNo: string) {
    return this.request<Array<Record<string, any>>>(
      `/requirement-bugs?requirementNo=${encodeURIComponent(requirementNo)}`
    )
  }

  async fetchBugSummary(requirementNo: string) {
    return this.request<{
      total: number
      fixed: number
      verified: number
      /** 开发说改好了、而没人回去点一遍——最容易漏的一档 */
      fixedNotVerified: number
    }>(`/requirement-bugs/summary?requirementNo=${encodeURIComponent(requirementNo)}`)
  }

  async createBug(body: Record<string, unknown>) {
    return this.request<{ id: string }>('/requirement-bugs', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updateBug(id: string, body: Record<string, unknown>) {
    return this.request<{ success: boolean }>(`/requirement-bugs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteBug(id: string) {
    return this.request<{ success: boolean }>(`/requirement-bugs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  /** 导成 wiki 能粘的 HTML 表格 */
  async exportBugsToWiki(requirementNo: string) {
    return this.request<{ html: string; note: string }>(
      `/requirement-bugs/export?requirementNo=${encodeURIComponent(requirementNo)}`
    )
  }

  /** 一个 bug 常要好几张图（问题现场 + 原型对照），所以支持多传 */
  async uploadBugImages(files: File[]) {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    const response = await authFetch(`${this.baseURL}/requirement-bugs/images`, {
      method: 'POST',
      body: form
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '上传失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{ urls: string[] }>
  }

  /** 线上问题跟踪截图，支持一次多张 */
  async uploadIssueImages(files: File[]) {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    const response = await authFetch(`${this.baseURL}/issue-tracking/images`, {
      method: 'POST',
      body: form
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: '上传失败' }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{ urls: string[] }>
  }

  /** 线上/测试问题持续跟踪 */
  async listIssueTracking(params?: {
    environment?: string
    status?: string
    priority?: string
    trackingTester?: string
    projectType?: string
    developer?: string
    q?: string
  }) {
    const q = new URLSearchParams()
    if (params?.environment) q.set('environment', params.environment)
    if (params?.status) q.set('status', params.status)
    if (params?.priority) q.set('priority', params.priority)
    if (params?.trackingTester) q.set('trackingTester', params.trackingTester)
    if (params?.projectType) q.set('projectType', params.projectType)
    if (params?.developer) q.set('developer', params.developer)
    if (params?.q) q.set('q', params.q)
    const qs = q.toString()
    return this.request<{
      issues: Array<Record<string, any>>
      testers: string[]
      developers: string[]
      statusCounts: Record<string, number>
    }>(qs ? `/issue-tracking?${qs}` : '/issue-tracking')
  }

  async createIssueTracking(body: Record<string, unknown>) {
    return this.request<{ id: string }>('/issue-tracking', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updateIssueTracking(id: string, body: Record<string, unknown>) {
    return this.request<{ success: boolean }>(`/issue-tracking/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteIssueTracking(id: string) {
    return this.request<{ success: boolean }>(`/issue-tracking/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  }

  async syncIssueTrackingWiki(id?: string) {
    const path = id
      ? `/issue-tracking/sync-wiki?id=${encodeURIComponent(id)}`
      : '/issue-tracking/sync-wiki'
    return this.request<{
      ok: boolean
      wikiPageUrl: string
      title?: string
      count: number
      appended?: number
      skipped?: number
      uploadedImages?: number
    }>(path, { method: 'POST' })
  }

  /** 人工补一个接口到需求单上——分析只认这个分支改过的，没改但会调到的要自己加 */
  async addRequirementEndpoint(body: {
    requirementNo: string
    httpMethod: string
    path: string
    summary?: string
    project?: string
  }) {
    return this.request<{ success: boolean }>('/ai-test-cases/requirement-endpoints', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async removeRequirementEndpoint(id: string) {
    return this.request<{ success: boolean }>(
      `/ai-test-cases/requirement-endpoints/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
  }

  /** 某个集合 / 某一版还没确认的问题：需求文档里的矛盾和缺口，拿去问产品用的 */
  async listOpenQuestions(params: { category?: string; appVersion?: string; includeResolved?: boolean }) {
    const q = new URLSearchParams()
    if (params.category) q.set('category', params.category)
    if (params.appVersion) q.set('appVersion', params.appVersion)
    if (params.includeResolved) q.set('includeResolved', 'true')
    return this.request<Array<{
      id: string
      title: string
      kind?: string
      detail?: string
      question?: string
      impact?: string
      appVersion?: string
      pageName?: string
      resolved?: number
    }>>(`/ai-test-cases/open-questions?${q.toString()}`)
  }

  /** 删掉一条待确认。和「已确认」不同：这条根本不成立，留着下次又要判断一遍 */
  async deleteOpenQuestion(id: string) {
    return this.request<{ success: boolean }>(
      `/ai-test-cases/open-questions/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
  }

  async resolveOpenQuestion(id: string, resolved = true) {
    return this.request<{ success: boolean }>(
      `/ai-test-cases/open-questions/${encodeURIComponent(id)}/resolve?resolved=${resolved}`,
      { method: 'POST' }
    )
  }

  /** 手动新建版本。汇总页往往提测后才建，而用例要在提测前就开始写 */
  async createVersionArchive(body: {
    releaseLabel: string
    appVersion?: string
    productLine?: string
    releaseDate?: string
  }) {
    return this.request<any>('/version-archives', { method: 'POST', body: JSON.stringify(body) })
  }

  /** 往版本里手动加一个需求单 */
  async addVersionIssue(archiveId: string, body: {
    issueKey: string
    summary?: string
    statusName?: string
    assignee?: string
  }) {
    return this.request<any>(`/version-archives/${encodeURIComponent(archiveId)}/issues`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async removeVersionIssue(archiveId: string, issueKey: string) {
    return this.request<{ success: boolean }>(
      `/version-archives/${encodeURIComponent(archiveId)}/issues/${encodeURIComponent(issueKey)}`,
      { method: 'DELETE' }
    )
  }

  /** 某一版下每个单号有多少条用例——「这个单子测完了没有」靠它回答 */
  async fetchRequirementCounts(params: { category?: string; appVersion?: string }) {
    const q = new URLSearchParams()
    if (params.category) q.set('category', params.category)
    if (params.appVersion) q.set('appVersion', params.appVersion)
    return this.request<Array<{ requirementNo: string; total: number; reviewed: number }>>(
      `/ai-test-cases/requirement-counts?${q.toString()}`
    )
  }

  /** 需求登记列表（含自定义展示名） */
  async fetchRequirements(keyword?: string) {
    const q = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
    return this.request<Array<{ requirementNo: string; title?: string }>>(`/requirements${q}`)
  }

  /** 左侧树重命名：只改 title，单号不变 */
  async saveRequirementTitle(requirementNo: string, title: string) {
    return this.request<{ requirementNo: string; title?: string }>(
      `/requirements/${encodeURIComponent(requirementNo)}/title`,
      {
        method: 'PATCH',
        body: JSON.stringify({ title })
      }
    )
  }

  /** 某个用例集下出现过的 APP 版本 + 各自条数，新版本在前 */
  async listAiTestCaseVersions(category?: string) {
    const q = category ? `?category=${encodeURIComponent(category)}` : ''
    return this.request<Array<{ version: string; count: number }>>(`/ai-test-cases/versions${q}`)
  }

  async generateAiTestCases(body: {
    page_name?: string
    text_content?: string
    images?: string[]
    elements?: Array<Record<string, any>>
    screenshot_url?: string
    requirements?: string
  }) {
    return this.request<{
      page?: string
      total?: number
      input_types?: string[]
      test_cases?: AiTestCaseDto[]
      [key: string]: any
    }>('/codewords/test-cases/generate', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * 测试用例生成：multipart 上传（图片由后端转 base64 data URI，文档抽文字）。
   * FormData: page_name, text_content?, requirements?, files
   */
  async generateAiTestCasesUpload(params: {
    page_name: string
    text_content?: string
    requirements?: string
    files?: File[]
  }) {
    const form = new FormData()
    form.append('page_name', params.page_name)
    if (params.text_content) form.append('text_content', params.text_content)
    if (params.requirements) form.append('requirements', params.requirements)
    for (const f of params.files || []) {
      form.append('files', f)
    }
    const url = `${this.baseURL}/codewords/test-cases/generate-upload`
    const response = await authFetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Generate failed' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }
    return (await response.json()) as {
      page?: string
      total?: number
      input_types?: string[]
      test_cases?: AiTestCaseDto[]
      [key: string]: any
    }
  }

  /** AI 用例文档列表（表 ai_test_cases） */
  async listAiTestCases(params?: {
    category?: string
    pageName?: string
    priority?: string
    status?: string
    platform?: string
    batchId?: string
    automationAdvice?: string
    releaseStage?: string
    /** APP 版本，如 9.3 */
    appVersion?: string
    /** 需求单号，如 APP-8873 */
    requirementNo?: string
    /** 涉及端：CLIENT / H5 / SERVER / ADMIN */
    side?: string
    /** 标题/编号/测试点/模块 模糊搜 */
    keyword?: string
    page?: number
    size?: number
  }) {
    const qs = new URLSearchParams()
    if (params?.category) qs.set('category', params.category)
    if (params?.appVersion) qs.set('appVersion', params.appVersion)
    if (params?.requirementNo) qs.set('requirementNo', params.requirementNo)
    if (params?.side) qs.set('side', params.side)
    if (params?.pageName) qs.set('pageName', params.pageName)
    if (params?.priority) qs.set('priority', params.priority)
    if (params?.status) qs.set('status', params.status)
    if (params?.platform) qs.set('platform', params.platform)
    if (params?.batchId) qs.set('batchId', params.batchId)
    if (params?.automationAdvice) qs.set('automationAdvice', params.automationAdvice)
    if (params?.releaseStage) qs.set('releaseStage', params.releaseStage)
    if (params?.keyword) qs.set('keyword', params.keyword)
    qs.set('page', String(params?.page ?? 1))
    qs.set('size', String(params?.size ?? 20))
    return this.request<{
      content: AiTestCaseDto[]
      totalElements: number
      page: number
      size: number
      totalPages: number
      onlineCount?: number
      testingCount?: number
    }>(`/ai-test-cases?${qs.toString()}`)
  }

  async promoteAiTestCase(id: number) {
    return this.request<AiTestCaseDto>(`/ai-test-cases/${id}/promote`, { method: 'POST' })
  }

  async promoteAiTestCasesBatch(ids: number[]) {
    return this.request<{ promoted: number; failed: string[] }>('/ai-test-cases/promote-batch', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
  }

  async saveAiTestCasesBatch(body: {
    page_name: string
    category?: string
    platform?: string
    screenshot_url?: string
    app_id?: string
    status?: string
    /** 批次级层级，整批共用 */
    module?: string
    sub_module?: string
    test_item?: string
    /** 所属 APP 版本，如 9.3；版本迭代集必填 */
    app_version?: string
    /** 所属需求单号，如 APP-8873 */
    requirement_no?: string
    /** 涉及端，整批共用 */
    sides?: string[]
    /** 生成时挑出来的待确认项，跟着这一批一起落库 */
    open_questions?: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  }) {
    return this.request<{
      batchId: string
      pageName: string
      category?: string
      saved: number
      cases: AiTestCaseDto[]
    }>('/ai-test-cases/batch', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updateAiTestCaseStatus(id: number, status: 'DRAFT' | 'REVIEWED' | 'ARCHIVED') {
    return this.request<AiTestCaseDto>(`/ai-test-cases/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  async deleteAiTestCase(id: number) {
    return this.request<{ ok: boolean }>(`/ai-test-cases/${id}`, {
      method: 'DELETE'
    })
  }

  /** 知识手册：分类短记列表（现象/原因/处理） */
  async listHandbook(params?: { category?: string; project?: string; q?: string; limit?: number }) {
    const qs = new URLSearchParams()
    if (params?.category) qs.set('category', params.category)
    if (params?.project) qs.set('project', params.project)
    if (params?.q) qs.set('q', params.q)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<
      Array<{
        id: number
        category: string
        project?: string
        title: string
        symptom: string
        cause: string
        fix: string
        tags?: string
        imageUrl?: string
        createdAt?: string
        updatedAt?: string
      }>
    >(`/handbook${suffix}`)
  }

  async getHandbook(id: number) {
    return this.request<{
      id: number
      category: string
      project?: string
      title: string
      symptom: string
      cause: string
      fix: string
      tags?: string
      imageUrl?: string
      createdAt?: string
      updatedAt?: string
    }>(`/handbook/${id}`)
  }

  async createHandbook(body: {
    category: string
    project?: string | null
    title: string
    symptom: string
    cause: string
    fix: string
    tags?: string
    imageUrl?: string | null
  }) {
    return this.request<any>('/handbook', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updateHandbook(
    id: number,
    body: {
      category: string
      project?: string | null
      title: string
      symptom: string
      cause: string
      fix: string
      tags?: string
      imageUrl?: string | null
    }
  ) {
    return this.request<any>(`/handbook/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  async deleteHandbook(id: number) {
    return this.request<{ ok: boolean }>(`/handbook/${id}`, {
      method: 'DELETE'
    })
  }

  /** 上传知识手册配图（可选），返回 { imageUrl, url } */
  async uploadHandbookImage(file: File) {
    const form = new FormData()
    form.append('file', file)
    const url = `${this.baseURL}/handbook/image/upload`
    const response = await authFetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '上传失败' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{ imageUrl: string; url: string }>
  }

  /**
   * AI 汇总短记草稿（不落库）。
   * FormData: text?, hintCategory?, hintProject?, files[]
   */
  async aiSummarizeHandbook(params: {
    text?: string
    hintCategory?: string
    hintProject?: string
    files?: File[]
  }) {
    const form = new FormData()
    if (params.text?.trim()) form.append('text', params.text.trim())
    if (params.hintCategory) form.append('hintCategory', params.hintCategory)
    if (params.hintProject) form.append('hintProject', params.hintProject)
    ;(params.files || []).slice(0, 3).forEach((f) => form.append('files', f))
    const url = `${this.baseURL}/handbook/ai-summarize`
    const response = await authFetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'AI 汇总失败' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }
    return response.json() as Promise<{
      category: string
      project?: string
      title: string
      symptom: string
      cause: string
      fix: string
      tags?: string
      imageUrl?: string
      model?: string
    }>
  }

  /** 知识手册配图完整 URL（DB 存相对路径 handbook-images/xxx.png） */
  handbookImageUrl(imageUrl?: string | null) {
    if (!imageUrl) return ''
    if (imageUrl.startsWith('http')) return imageUrl
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
    return `${this.baseURL}${path}`
  }

  /** 平台前端知识库列表（无需 STORAGE_API_KEY） */
  async searchAgentKnowledge(query?: string, limit = 50) {
    const qs = new URLSearchParams()
    qs.set('query', query ?? '')
    qs.set('limit', String(limit))
    return this.request<{
      results: Array<{ id: number | string; topic: string; snippet?: string; content?: string; created_at?: string }>
      count: number
    }>(`/codewords/knowledge?${qs.toString()}`)
  }

  async saveAgentKnowledge(body: { topic: string; content: string }) {
    return this.request<any>('/codewords/knowledge', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * 俊俊文档上传：解析并可选写入知识库。
   * FormData: files + saveKnowledge
   */
  async ingestAgentFiles(files: File[], saveKnowledge = true) {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    form.append('saveKnowledge', String(saveKnowledge))
    const url = `${this.baseURL}/codewords/ingest-files`
    const response = await authFetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }))
      throw new Error(error.message || error.error || `HTTP ${response.status}`)
    }
    return (await response.json()) as {
      count: number
      successCount: number
      items: Array<{
        filename: string
        topic?: string
        size?: number
        chars?: number
        preview?: string
        content?: string
        kind?: string
        url?: string
        ok: boolean
        knowledgeStatus?: string
        message?: string
      }>
    }
  }

  async loadAgentConversation(sessionId: string) {
    const qs = new URLSearchParams({ session_id: sessionId })
    return this.request<{ messages: any[]; session_id: string }>(`/codewords/conversation?${qs.toString()}`)
  }

  async saveAgentConversation(body: { session_id: string; messages: any[] }) {
    return this.request<any>('/codewords/conversation', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // 自动化测试任务详情 / 概览 / 日志 / 截图（保留）；旧场景列表与 /execute 已下线

  /** 场景化性能测试场景：GET /functional-test/scenarios/scenario-performance?platform= */
  async getScenarioPerformanceScenarios(platform: string) {
    const p = String(platform || '').trim()
    if (!p) {
      return Promise.resolve([])
    }
    const q = `?platform=${encodeURIComponent(p)}`
    return this.request<Array<{ scenarioKey: string; name: string; platform?: string; id?: string; taskType?: string; description?: string }>>(
      `/functional-test/scenarios/scenario-performance${q}`
    )
  }

  /**
   * 任务详情：GET /functional-test/tasks/{id}
   * 含 executionStatus、reportPath、errorMessage、scenarioKey、scenarioName；可选 executionLog。
   */
  async getFunctionalTestTask(taskId: string) {
    return this.request<{
      id: string
      taskName?: string
      status: string
      executionStatus?: string
      reportPath?: string
      errorMessage?: string
      executionEndTime?: string
      deviceId?: string
      applicationId?: string
      createdAt?: string
      scenarioKey?: string | null
      scenarioName?: string | null
      executionVariables?: { phoneNumberMasked?: string; verificationCodeMasked?: string }
      executionLog?: Array<{ step: string; status: string; level?: 'Info' | 'Error'; message?: string; selector?: string | null; timestamp?: string; screenshotUrl?: string | null }>
    }>(`/functional-test/tasks/${taskId}`)
  }

  /**
   * 功能测试任务列表（分页）：GET /functional-test/tasks
   * 参数：page(默认1)、size(默认10)；days、keyword、status 筛选。不传 page/size 时为第1页、每页10条。
   * 响应：{ content, totalElements, totalPages, page, size }
   */
  async getFunctionalTestTasks(params?: {
    page?: number
    size?: number
    days?: number
    keyword?: string
    status?: string
  }) {
    const q = new URLSearchParams()
    const page = params?.page ?? 1
    const size = params?.size ?? 10
    q.append('page', String(page))
    q.append('size', String(size))
    if (params?.days != null && params.days > 0) q.append('days', String(params.days))
    if (params?.keyword?.trim()) q.append('keyword', params.keyword.trim())
    if (params?.status?.trim()) q.append('status', params.status.trim())
    const query = q.toString()
    return this.request<{
      content: any[]
      totalElements: number
      totalPages: number
      page: number
      size: number
    }>(`/functional-test/tasks?${query}`)
  }

  /**
   * 任务详情概览：GET /functional-test/tasks/{id}/overview
   * 支持功能体验基础质量测试、兼容性测试等；任务不存在返回 404。
   */
  async getFunctionalTestTaskOverview(taskId: string) {
    return this.request<{
      taskId: string
      title: string
      remarks: string | null
      testType: string
      scenarioKey?: string | null
      scenarioName?: string | null
      /** 任务执行状态：RUNNING=执行中，PENDING=待执行，COMPLETED=已完成，FAILED=失败 */
      status?: string | null
      executionStatus?: string | null
      appPackageName: string | null
      appVersion: string | null
      apiVersion: string | null
      startTime: string | null
      duration: string | null
      executor: string | null
      reportPath: string | null
      /** 概览达标率区块标题，如「功能质量达标率」「兼容性满足度」 */
      summarySectionTitle?: string | null
      executionVariables?: { phoneNumberMasked?: string; verificationCodeMasked?: string }
      compatibilitySummary: {
        actualTestItemCount: number
        passedCount: number
        failedCount: number
        warningCount: number
      } | null
      resultDistribution: Array<{
        categoryName: string
        passed?: number
        warning?: number
        failed?: number
        deviceDependent?: number
      }> | null
      testResultItems: Array<{
        testItemCategory: string
        testItemName: string
        testResult: string
        detailLogLink: string | null
        detailMessage: string | null
      }>
      /** 执行日志步骤列表，与任务详情/execution-log 接口结构一致；有则用此渲染，无需再请求 */
      executionLog?: Array<{ step: string; status?: string; level?: 'Info' | 'Error'; message?: string; selector?: string | null; timestamp?: string; screenshotUrl?: string | null }>
    }>(`/functional-test/tasks/${taskId}/overview`)
  }

  /**
   * 执行日志步骤列表：GET /functional-test/tasks/{id}/execution-log
   * 每项含 step、message、timestamp、level、selector(失败时)、screenshotUrl(步骤截图相对路径)
   */
  async getFunctionalTestTaskExecutionLog(taskId: string) {
    return this.request<Array<{
      step: string
      status?: 'success' | 'fail'
      level?: 'Info' | 'Error'
      message?: string
      selector?: string | null
      timestamp?: string
      screenshotUrl?: string | null
    }>>(`/functional-test/tasks/${taskId}/execution-log`)
  }

  /**
   * 任务截图列表：GET /functional-test/tasks/{id}/screenshot-list
   * 按 taskId 从文件系统扫描，返回全部匹配截图，供前端展示
   */
  async getFunctionalTestTaskScreenshotList(taskId: string) {
    return this.request<Array<{ index: number; screenshotUrl: string; step: string }>>(
      `/functional-test/tasks/${taskId}/screenshot-list`
    )
  }

  /**
   * 任务最近一次执行截图 URL：GET /functional-test/tasks/{id}/screenshot 返回 image/png
   * 前端可直接用作 <img src="..." />，无截图时 404。
   */
  getFunctionalTestTaskScreenshotUrl(taskId: string): string {
    return `${this.baseURL}/functional-test/tasks/${taskId}/screenshot`
  }

  /**
   * 步骤截图带登录头拉成 object URL。
   * &lt;img src&gt; 拼相对路径时浏览器加不上 Authorization，鉴权一开图就裂。
   */
  async fetchTaskStepScreenshotObjectUrl(screenshotUrl: string): Promise<string> {
    const path = String(screenshotUrl || '').trim()
    if (!path) throw new Error('这一步没有截图')
    if (path.startsWith('blob:')) return path
    const url = path.startsWith('http')
      ? path
      : this.endpointUrl(path.startsWith('/') ? path : `/${path}`)
    const res = await authFetch(url)
    if (!res.ok) {
      throw new Error(res.status === 404 ? '截图文件不存在' : `截图加载失败（${res.status}）`)
    }
    const blob = await res.blob()
    if (!blob.size) throw new Error('截图为空')
    return URL.createObjectURL(blob)
  }

  /**
   * 性能基础质量测试报告：GET /functional-test/tasks/{id}/performance-report
   * 仅对性能基础质量测试任务有效，返回最新一次执行的 result_data 解析后的 JSON；非性能任务或尚无执行结果时 404。
   */
  async getPerformanceReport(taskId: string) {
    return this.request<{
      traversalDurationMinutes: number
      totalOperations: number
      launchCount: number
      clickCount: number
      swipeCount: number
      conclusion: string
      resourceSummary: {
        cpuApp?: { peak?: number; min?: number; avg?: number }
        memoryPss?: { peak?: number; min?: number; avg?: number }
        /** 网络接收字节（整机），或速率汇总 Kb/s */
        networkRxBytes?: { peak?: number; min?: number; avg?: number }
        /** 网络发送字节（整机），或速率汇总 Kb/s */
        networkTxBytes?: { peak?: number; min?: number; avg?: number }
        /** 温度 ℃ */
        temperature?: { peak?: number; min?: number; avg?: number }
        /** 帧率 FPS */
        fps?: { peak?: number; min?: number; avg?: number }
      }
      issueSummary: {
        responseDelayCount?: number
        completionDelayCount?: number
        stutterCount?: number
        blackWhiteBlockCount?: number
        avCount?: number
        totalIssueCount?: number
        /** 键为「启动操作」「滑动操作」「点击操作」「观看视频」，值为各类型问题数 */
        byOperationType?: Record<string, {
          responseDelayCount?: number
          completionDelayCount?: number
          stutterCount?: number
          avCount?: number
          blackWhiteBlockCount?: number
        }>
      }
      resourceSamples: Array<{
        timestampMs: number
        cpuPercent?: number
        memoryPssKb?: number
        networkRxBytes?: number
        networkTxBytes?: number
        /** 温度，十分之一摄氏度（÷10 为 ℃） */
        temperatureTenthsC?: number
        /** 估算 FPS（gfxinfo） */
        fps?: number
        /** 卡顿帧占比 % */
        jankPercent?: number
      }>
      operations: Array<{
        index: number
        type: string
        startTimeMs: number
        endTimeMs: number
        responseDelayMs?: number
        completionDelayMs?: number
        cpuAvgDuringStep?: number
        memoryPssKbDuringStep?: number
        pageName?: string | null
        actionLabel?: string | null
        /** 操作前截图索引，GET .../performance-screenshots/{index} */
        screenshotBeforeIndex?: number | null
        /** 操作后截图索引 */
        screenshotAfterIndex?: number | null
        /** 本步白屏/黑屏时长（ms） */
        whiteScreenMs?: number | null
        /** 本步黑白块次数（可选） */
        blackWhiteBlockCount?: number | null
        /** 维测数据（可选，后端约定格式） */
        dimensionData?: string | Record<string, unknown> | null
      }>
      /** 性能测试执行期间截图总张数（每秒一张等），0 表示未开启截图 */
      screenshotCount?: number
      /** 每张截图的时间轴：index、timestampMs，供前端做遍历条 */
      screenshotTimeline?: Array<{ index: number; timestampMs: number }>
    }>(`/functional-test/tasks/${taskId}/performance-report`)
  }

  /**
   * 性能测试第 i 张截图：GET /functional-test/tasks/{id}/performance-screenshots/{index}
   * index 从 0 开始（含首张「操作前」图），需与 performance-report 用同一 taskId，否则 404。
   */
  getPerformanceScreenshotUrl(taskId: string, index: number): string {
    return `${this.baseURL}/functional-test/tasks/${taskId}/performance-screenshots/${index}`
  }

  // 测试计划（定时任务）
  async getTestPlans() {
    return this.request<any[]>('/test-plans')
  }

  async createTestPlan(body: {
    name: string
    cronExpression: string
    timezone?: string
    deviceId: string
    appId: string
    scenarioId: string
    scenarioConfig?: string
    enabled?: boolean
    /** 与后端计划类型枚举一致：ANDROID / IOS / HARMONYOS */
    planType?: string
  }) {
    return this.request<any>('/test-plans', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async triggerTestPlan(id: string) {
    return this.request<any>(`/test-plans/${id}/trigger`, { method: 'POST' })
  }

  async setTestPlanEnabled(id: string, enabled: boolean) {
    return this.request<any>(`/test-plans/${id}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    })
  }

  async pauseTestPlan(id: string) {
    return this.request<any>(`/test-plans/${id}/pause`, { method: 'POST' })
  }

  async resumeTestPlan(id: string) {
    return this.request<any>(`/test-plans/${id}/resume`, { method: 'POST' })
  }

  // —— APP 回归（线上 + 测试环境）——
  async getOnlineRegressionAccounts(appId?: string) {
    const q = appId ? `?appId=${encodeURIComponent(appId)}` : ''
    return this.request<
      Array<{ id: string; appId: string; label?: string; phoneNumber: string; verificationCode: string }>
    >(`/online-regression/accounts${q}`)
  }

  async startOnlineRegressionRun(body: {
    appIds: string[]
    deviceIds: string[]
    /** 勾选的 ui_flows.id */
    flowIds: string[]
    excludeJobKeys?: string[]
    /** 多账号：两机回归时传两个不同账号，后端随机分配到设备 */
    accountIds?: string[]
    accountId?: string
    customPhones?: string[]
    customCodes?: string[]
    customPhone?: string
    customCode?: string
    enableOverseasProxy?: boolean
    /** PROD（默认，线上回归）/ TEST（测试环境发版前回归） */
    environment?: string
    /** REGRESSION（默认）/ AUTOMATION（按前置依赖拓扑排序执行） */
    track?: string
    /** 复位流程：每条用例前先跑一次，把设备带回已知起点 */
    resetFlowId?: string
    /**
     * 批次级装包策略：NONE（默认，用设备上现有的包）/ LATEST / SPECIFIC / PREVIOUS_THEN_LATEST。
     * 装包不作为流程步骤——它不是用例，跑通不说明任何功能是好的，混进步骤列表只会稀释通过率。
     */
    installStrategy?: string
    /** installStrategy=SPECIFIC 时要装的蒲公英 buildKey */
    installBuildKey?: string
    /**
     * 批次级执行参数，覆盖流程里的 ${变量}，只影响这一次。
     * 常规数据走按环境注入的环境变量；这里适合「同一批用例这次换个账号跑一遍」。
     * 账号池分配的手机号验证码优先级更高，不会被它覆盖。
     */
    params?: Record<string, string>
  }) {
    return this.request<{
      id: string
      status: string
      passRate?: number | null
      jobs: Array<{
        id: string
        key: string
        appId: string
        appName: string
        deviceId: string
        deviceName: string
        devicePlatform: string
        endpoint: string
        endpointLabel?: string
        status: string
        progress: number
        currentStepLabel?: string
        accountPhone?: string
        errorMessage?: string
        latestScreenshotUrl?: string | null
        steps: Array<{
          id: string
          stepId: string
          label: string
          status: string
          taskId?: string
          error?: string
          screenshotUrl?: string | null
        }>
      }>
    }>('/online-regression/runs', { method: 'POST', body: JSON.stringify(body) })
  }

  /**
   * 执行顺序预览。自动化轨道会补入没勾的前置并按依赖排序；成环时返回 400 且 message 带完整环路。
   */
  async previewRunOrder(flowIds: string[], track?: string, resetFlowId?: string) {
    return this.request<{
      steps: Array<{ id: string; label: string; weight: number; fromFeature?: string }>
      autoAddedIds: string[]
      resetFlowId?: string | null
    }>('/online-regression/preview-order', {
      method: 'POST',
      body: JSON.stringify({ flowIds, track, resetFlowId })
    })
  }

  async clearOnlineRegressionHistory() {
    return this.request<{ success: boolean; deleted?: number }>('/online-regression/runs', {
      method: 'DELETE'
    })
  }

  async listOnlineRegressionRuns(limit = 20) {
    return this.request<
      Array<{
        id: string
        status: string
        passRate?: number | null
        errorMessage?: string | null
        startedAt?: string | null
        finishedAt?: string | null
        createdAt?: string | null
        jobCount?: number
        /** PROD / TEST，存量批次由后端补成 PROD */
        environment?: string
        environmentLabel?: string
        /** REGRESSION / AUTOMATION，存量批次由后端补成 REGRESSION */
        track?: string
        trackLabel?: string
      }>
    >(`/online-regression/runs?limit=${encodeURIComponent(String(limit))}`)
  }

  async fetchOnlineRegressionRun(runId: string) {
    return this.request<{
      id: string
      status: string
      passRate?: number | null
      enableOverseasProxy?: boolean
      startedAt?: string
      finishedAt?: string
      errorMessage?: string
      jobs: Array<{
        id: string
        key: string
        appId: string
        appName: string
        deviceId: string
        deviceName: string
        devicePlatform: string
        endpoint: string
        endpointLabel?: string
        status: string
        progress: number
        currentStepLabel?: string
        accountPhone?: string
        errorMessage?: string
        latestScreenshotUrl?: string | null
        steps: Array<{
          id: string
          stepId: string
          label: string
          status: string
          taskId?: string
          error?: string
          screenshotUrl?: string | null
        }>
      }>
    }>(`/online-regression/runs/${encodeURIComponent(runId)}`)
  }

  async stopOnlineRegressionRun(runId: string) {
    return this.request<{ success: boolean }>(`/online-regression/runs/${encodeURIComponent(runId)}/stop`, {
      method: 'POST'
    })
  }

  // —— 蒲公英：版本列表 / 下载安装（非线上回归）——
  async listPgyerBuilds(appKey?: string, page = 1) {
    const qs = new URLSearchParams()
    if (appKey) qs.set('appKey', appKey)
    qs.set('page', String(page))
    return this.request<
      Array<{
        buildKey: string
        buildName?: string
        buildVersion?: string
        buildVersionNo?: string
        buildBuildVersion?: number
        buildType?: number
        buildIdentifier?: string
        buildFileSize?: number
        buildCreated?: string
        buildUpdateDescription?: string
        platformLabel?: string
      }>
    >(`/pgyer/builds?${qs.toString()}`)
  }

  async installFromPgyer(body: { deviceId: string; buildKey: string; uninstallFirst?: boolean }) {
    return this.request<{ success: boolean; message?: string; localPath?: string }>('/pgyer/install', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // ==================== 失败归因 ====================

  /** 当前结论（人工优先）；没有归因过时后端返回 204，这里归一为 null */
  async getFailureDiagnosis(taskId: string) {
    const res = await authFetch(`${this.baseURL}/failure-diagnosis/${encodeURIComponent(taskId)}`)
    if (res.status === 204) return null
    if (!res.ok) throw new Error(`获取归因失败: ${res.status}`)
    return res.json()
  }

  /** 全部结论，最新在前。AI 与人工的分歧都留在这里 */
  async getFailureDiagnosisHistory(taskId: string) {
    return this.request<any[]>(`/failure-diagnosis/${encodeURIComponent(taskId)}/history`)
  }

  /** 分类字典：值 + 中文名 + 对应处理动作 */
  async getFailureDiagnosisCategories() {
    return this.request<Array<{ value: string; label: string; action: string }>>(
      '/failure-diagnosis/categories'
    )
  }

  /** 人工改判：另存一条 source=HUMAN 的结论，不覆盖 AI 那条 */
  async saveFailureDiagnosis(taskId: string, body: Record<string, unknown>) {
    return this.request(`/failure-diagnosis/${encodeURIComponent(taskId)}`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /** 采纳候选定位；旧定位由后端降级进备用，不会丢 */
  async applyDiagnosisLocator(id: string, operator?: string) {
    const q = operator ? `?operator=${encodeURIComponent(operator)}` : ''
    return this.request(`/failure-diagnosis/records/${encodeURIComponent(id)}/apply-locator${q}`, {
      method: 'POST'
    })
  }

  /** 认可这条结论。没有这个动作，「人工改判率」分不清「判对了」和「没人看」 */
  async reviewDiagnosis(id: string, operator?: string) {
    const q = operator ? `?operator=${encodeURIComponent(operator)}` : ''
    return this.request(`/failure-diagnosis/records/${encodeURIComponent(id)}/review${q}`, {
      method: 'POST'
    })
  }

  // ---------- 功能模块树 ----------
  async getProjectModuleTree(category?: string, enabledOnly?: boolean) {
    const qs = new URLSearchParams()
    if (category) qs.set('category', category)
    if (enabledOnly != null) qs.set('enabledOnly', String(enabledOnly))
    const q = qs.toString()
    return this.request<any[]>(`/project-modules/tree${q ? '?' + q : ''}`)
  }
  async saveProjectModule(body: Record<string, unknown>) {
    return this.request<any>('/project-modules', { method: 'POST', body: JSON.stringify(body) })
  }
  async deleteProjectModule(id: string) {
    return this.request<any>(`/project-modules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  // ---------- 需求登记 ----------
  async getRequirements(params: { projectCode?: string; versionId?: string; status?: string; keyword?: string } = {}) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    const q = qs.toString()
    return this.request<any[]>(`/requirements${q ? '?' + q : ''}`)
  }
  async saveRequirement(requirement: Record<string, unknown>, moduleIds?: string[]) {
    return this.request<any>('/requirements', {
      method: 'POST',
      body: JSON.stringify({ requirement, moduleIds })
    })
  }
  async deleteRequirement(requirementNo: string) {
    return this.request<any>(`/requirements/${encodeURIComponent(requirementNo)}`, { method: 'DELETE' })
  }

  // ---------- PVP 接口签名 ----------
  async pvpSign(body: { environment?: string; r?: string; t?: string; params: Record<string, string> }) {
    return this.request<{ a: string; r: string; t: string; s: string; signedRequest: string }>(
      '/pvp-sign', { method: 'POST', body: JSON.stringify(body) })
  }

  // ---------- 接口响应快照 ----------
  async getResponseSnapshots(requirementNo?: string) {
    const q = requirementNo ? `?requirementNo=${encodeURIComponent(requirementNo)}` : ''
    return this.request<any[]>(`/response-snapshots${q}`)
  }
  async promoteResponseSnapshot(body: { sessionId: string; name: string; requirementNo?: string; note?: string }) {
    return this.request<any>('/response-snapshots/promote', { method: 'POST', body: JSON.stringify(body) })
  }
  async diffResponseSnapshot(snapshotId: string, sessionId: string) {
    return this.request<any>(`/response-snapshots/${encodeURIComponent(snapshotId)}/diff`, {
      method: 'POST', body: JSON.stringify({ sessionId })
    })
  }
  async deleteResponseSnapshot(snapshotId: string) {
    return this.request<any>(`/response-snapshots/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' })
  }

  // ---------- 活动页奖励顺序自动校验（从抓包读接口，不用手抄） ----------
  async auditRewardOrder(body: { sessionId: string; ladder?: string[][]; aliases?: Record<string, string> }) {
    return this.request<any>('/reward-audit', { method: 'POST', body: JSON.stringify(body) })
  }

  // ---------- 抓包会话（快照的原料） ----------
  async getCaptureSessions(requirementNo?: string) {
    const q = requirementNo ? `?requirementNo=${encodeURIComponent(requirementNo)}` : ''
    return this.request<any[]>(`/packet-capture/sessions${q}`)
  }

}

export interface AiTestCaseStep {
  step?: number
  action?: string
  target?: string
  expected?: string
}

export interface AiTestCaseDto {
  id?: number
  caseId?: string
  case_id?: string
  pageName?: string
  page_name?: string
  category?: string
  title: string
  priority?: string
  type?: string
  precondition?: string
  steps?: AiTestCaseStep[]
  screenshotUrl?: string
  platform?: string
  appId?: string
  source?: string
  status?: string
  batchId?: string
  module?: string
  subModule?: string
  testItem?: string
  testPoint?: string
  expectedResult?: string
  remark?: string
  flowId?: string
  /** RECOMMENDED | PARTIAL | NOT_RECOMMENDED；空＝未评估 */
  automationAdvice?: string | null
  /** TESTING | ONLINE */
  releaseStage?: string | null
  /** 所属 APP 版本，如 9.3；只有版本迭代集会用 */
  appVersion?: string | null
  /** 所属需求单号，如 APP-8873 */
  requirementNo?: string | null
  /** 涉及端，后端已解析成数组 */
  sides?: string[] | null
  automated?: boolean
  flowName?: string
  flowMissing?: boolean
  lastRunStatus?: string
  lastRunAt?: string
  createdAt?: string
  updatedAt?: string
}

export const apiClient = new ApiClient(resolveApiBaseUrl(), resolveWorkerBaseUrl())
