import type { SupportedDevicePlatform } from '@/utils/platform'

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

  /** 设备扫描和真正跑流程必须打到插着手机的那台执行节点 */
  private endpointUrl(endpoint: string) {
    const path = endpoint.split('?')[0]
    const useWorker = path.startsWith('/devices') || /\/ui-flows\/[^/]+\/execute$/.test(path)
    const base = useWorker ? this.workerBaseURL : this.baseURL
    return `${base}${endpoint}`
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.endpointUrl(endpoint)
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }))
      throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    // 兼容 Node 后端返回 { success, data } 的情况，统一解包为 data
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return data.data as T
    }
    return data as T
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
    }>(`/devices/${deviceId}/inspect/snapshot`)
  }

  /** 真机点选：按相对坐标命中控件，返回推荐 locator 与已匹配元素 */
  async postDeviceInspectHitTest(
    deviceId: string,
    body: { xRatio?: number; yRatio?: number; x?: number; y?: number; appId?: string }
  ) {
    return this.request<{
      deviceId: string
      platform?: string
      x: number
      y: number
      width: number
      height: number
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
      }>
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
    const response = await fetch(url, {
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
    const response = await fetch(url, { method: 'POST', body: form })
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
    }
  ) {
    return this.request<{
      taskId: string
      task: any
      started: boolean
      message: string
    }>(`/ui-flows/${flowId}/execute`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
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

  async getApiProjects(params?: { enabledOnly?: boolean }) {
    const q = new URLSearchParams()
    if (params?.enabledOnly != null) q.set('enabledOnly', String(params.enabledOnly))
    const qs = q.toString()
    return this.request<
      Array<{
        code: string
        name: string
        description?: string
        enabled?: boolean
        sortOrder?: number
      }>
    >(qs ? `/api-projects?${qs}` : '/api-projects')
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
      enabled?: boolean
    }
  ) {
    return this.request<any>(`/api-test/envs/${encodeURIComponent(environment)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  // ---------- 用例集合 ----------

  async getApiTestCollections(project?: string) {
    const qs = project ? `?project=${encodeURIComponent(project)}` : ''
    return this.request<
      Array<{
        id: string
        project: string
        name: string
        description?: string
        enabled?: boolean
        sortOrder?: number
        caseCount?: number
        passRate?: number | null
        lastRunAt?: string | null
        lastRunId?: string | null
      }>
    >(`/api-test/collections${qs}`)
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
      }>
    }>('/api-test/run', {
      method: 'POST',
      body: JSON.stringify(body)
    })
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
    const res = await fetch(`${this.baseURL}/ui-elements/read-inspector-shot`, {
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
  async generateTestCasesByQwen(params: { pageName: string; text?: string; files?: File[] }) {
    const fd = new FormData()
    fd.append('pageName', params.pageName)
    if (params.text) fd.append('text', params.text)
    ;(params.files || []).forEach((f) => fd.append('files', f))
    const res = await fetch(`${this.baseURL}/ai-test-cases/generate`, { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({ message: '生成失败' }))
    if (!res.ok) throw new Error(data.message || '生成失败')
    return data as { page: string; total: number; model: string; test_cases: any[] }
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
    const res = await fetch(`${this.baseURL}/ai-test-cases/import/parse`, { method: 'POST', body: fd })
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
    const response = await fetch(url, { method: 'POST', body: form })
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
    /** 标题/编号/测试点/模块 模糊搜 */
    keyword?: string
    page?: number
    size?: number
  }) {
    const qs = new URLSearchParams()
    if (params?.category) qs.set('category', params.category)
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
    const response = await fetch(url, { method: 'POST', body: form })
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
    const response = await fetch(url, { method: 'POST', body: form })
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
    const response = await fetch(url, { method: 'POST', body: form })
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
    const res = await fetch(`${this.baseURL}/failure-diagnosis/${encodeURIComponent(taskId)}`)
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
  automated?: boolean
  flowName?: string
  flowMissing?: boolean
  lastRunStatus?: string
  lastRunAt?: string
  createdAt?: string
  updatedAt?: string
}

export const apiClient = new ApiClient(resolveApiBaseUrl(), resolveWorkerBaseUrl())
