import type { SupportedDevicePlatform } from '@/utils/platform'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  /** 用于拼接步骤截图等相对路径：img src="{baseUrl}/{entry.screenshotUrl}" */
  getBaseUrl(): string {
    return this.baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
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

  /** 设备列表：GET {baseUrl}/devices，响应为 JSON 数组，无数据时为 [] */
  async getDevices() {
    const raw = await this.request<any>('/devices')
    return Array.isArray(raw) ? raw : []
  }

  /** 按平台设备列表：GET {baseUrl}/devices/platform/{platform}，platform 与后端枚举一致（含 POG_ANDROID、POG_IOS） */
  async getDevicesByPlatform(platform: SupportedDevicePlatform | string) {
    const raw = await this.request<any>(`/devices/platform/${platform}`)
    return Array.isArray(raw) ? raw : []
  }

  /** 按平台已登记应用列表：GET {baseUrl}/applications/platform/{platform} */
  async getApplicationsByPlatform(platform: SupportedDevicePlatform | string) {
    const raw = await this.request<any>(`/applications/platform/${platform}`)
    return Array.isArray(raw) ? raw : []
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

  /** 获取单个设备详情：GET /devices/{id}，404 表示不存在 */
  async getDevice(deviceId: string) {
    return this.request<any>(`/devices/${deviceId}`)
  }

  /**
   * 设备详情（点击设备后展示）：GET /devices/{id}/detail
   * 返回：设备名称、batteryLevel、installedApplications[]；
   * iOS 时含 iosDetail（解析键值对）+ iosDetailRaw（ideviceinfo 完整输出）；
   * Android/HarmonyOS 时含 androidDetail（分层结构）+ androidDetailRaw（getprop + dumpsys battery 完整输出）
   * 404 表示设备不存在或无效
   */
  async getDeviceDetail(deviceId: string) {
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
    }>(`/devices/${deviceId}/detail`)
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
   * 创建性能基础质量测试必须用此接口（不要用 POST /functional-test/tasks，该接口仅创建功能体验测试）。请求体传 taskType: "PERFORMANCE_BASELINE_TEST" 及 platform、deviceId、appId 等，设备选 Android。
   * 功能基础质量须带 scenarioKey（选「设置测试」→ "settings"，选「设置-我的账号」→ "settings_account" 等，小写），后端会落库并返回 scenarioName。
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

  /** @deprecated 请使用 createTestTask，传 appId 并指定 taskType: FUNCTIONAL_QUALITY_TEST */
  async createFunctionalTestTask(taskData: {
    taskName?: string
    remarks?: string
    platform: SupportedDevicePlatform | string
    deviceId: string
    applicationId: string
  }) {
    return this.createTestTask({
      taskType: 'FUNCTIONAL_QUALITY_TEST',
      platform: taskData.platform,
      deviceId: taskData.deviceId,
      appId: taskData.applicationId,
      taskName: taskData.taskName,
      remarks: taskData.remarks
    })
  }

  /** 表单字段需含 file、deviceId；platform 与设备/应用枚举一致（含 POG_ANDROID、POG_IOS）。POST {baseUrl}/applications/upload */
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

  // 页面对象（含元素）
  async getPageObjects(params?: {
    catalog?: 'AUTOMATION' | 'ONLINE' | 'SHARED' | string
    appId?: string
    platform?: SupportedDevicePlatform | string
  }) {
    const q = new URLSearchParams()
    if (params?.catalog) q.append('catalog', params.catalog)
    if (params?.appId) q.append('appId', params.appId)
    if (params?.platform) q.append('platform', params.platform)
    const qs = q.toString()
    return this.request<any[]>(qs ? `/page-objects?${qs}` : '/page-objects')
  }

  async getPageObject(id: string) {
    return this.request<any>(`/page-objects/${id}`)
  }

  /** 按定位方式分类的详情，用于编辑页分块展示 */
  async getPageObjectCategorized(id: string) {
    return this.request<any>(`/page-objects/${id}/categorized`)
  }

  async getPageObjectByPage(params: {
    platform: SupportedDevicePlatform | string
    appId: string
    pagePath: string
  }) {
    const q = new URLSearchParams()
    q.append('platform', params.platform)
    q.append('appId', params.appId)
    q.append('pagePath', params.pagePath)
    return this.request<any>(`/page-objects/by-page?${q.toString()}`)
  }

  async createPageObject(body: {
    platform: SupportedDevicePlatform | string
    appId: string
    pagePath: string
    catalog?: 'AUTOMATION' | 'ONLINE' | 'SHARED' | string
    name?: string
    description?: string
    elements?: Record<string, any>
    createdBy?: string
  }) {
    return this.request<any>('/page-objects', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async updatePageObject(
    id: string,
    body: Partial<{
      name: string
      description: string
      pagePath: string
      catalog: 'AUTOMATION' | 'ONLINE' | 'SHARED' | string
      elements: Record<string, any>
    }>
  ) {
    return this.request<any>(`/page-objects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    })
  }

  /** 按页面删除：删除整个页面对象及其下所有元素 */
  async deletePageObject(id: string) {
    return this.request<void>(`/page-objects/${id}`, { method: 'DELETE' })
  }

  /** 按元素删除：只删除该页面下指定元素，返回更新后的完整 PageObject */
  async deletePageObjectElement(id: string, elementKey: string) {
    return this.request<any>(`/page-objects/${id}/elements/${encodeURIComponent(elementKey)}`, {
      method: 'DELETE'
    })
  }

  // —— 低代码资产：行级元素 / 关键字 / 流程 ——
  async getUiElements(params?: {
    appId?: string
    platform?: string
    catalog?: string
    /** 如 'AUTOMATION,SHARED'：某场景页同时包含专用 + 两边共用 */
    catalogs?: string
    moduleTag?: string
    keyword?: string
  }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.platform) q.append('platform', params.platform)
    if (params?.catalog) q.append('catalog', params.catalog)
    if (params?.catalogs) q.append('catalogs', params.catalogs)
    if (params?.moduleTag) q.append('moduleTag', params.moduleTag)
    if (params?.keyword) q.append('keyword', params.keyword)
    const qs = q.toString()
    return this.request<any[]>(qs ? `/ui-elements?${qs}` : '/ui-elements')
  }

  async getUiElement(id: string) {
    return this.request<any>(`/ui-elements/${id}`)
  }

  async createUiElement(body: Record<string, unknown>) {
    return this.request<any>('/ui-elements', { method: 'POST', body: JSON.stringify(body) })
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
  }) {
    const q = new URLSearchParams()
    if (params?.appId) q.append('appId', params.appId)
    if (params?.platform) q.append('platform', params.platform)
    if (params?.catalog) q.append('catalog', params.catalog)
    if (params?.componentOnly != null) q.append('componentOnly', String(params.componentOnly))
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

  // —— CodeWords AI Agent / 元素监控 ——
  async getCodeWordsStatus() {
    return this.request<{
      enabled: boolean
      configured: boolean
      agentId: string
      monitorWorkflowId: string
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

  // 自动化测试（场景列表 + 一键执行）
  async getFunctionalTestScenarios() {
    return this.request<any[]>('/functional-test/scenarios')
  }

  /**
   * 按模块分组（不含 Pog 派生场景）。若需展示 Pog-Android / Pog-iOS 可执行项，请改用
   * getFunctionalTestScenariosByPlatformModule 或 getFunctionalTestScenariosByPlatform。
   */
  async getFunctionalTestScenariosByModule() {
    return this.request<any[]>('/functional-test/scenarios/by-module')
  }

  /**
   * 按平台→模块两层分组的场景列表：GET /functional-test/scenarios/by-platform-module
   */
  async getFunctionalTestScenariosByPlatformModule(): Promise<
    Array<{
      platform: string
      platformLabel: string
      modules: Array<{
        moduleKey: string
        moduleName: string
        scenarios: Array<{ id: string; name: string; platform: string; taskType: string; description?: string; scenarioKey?: string }>
      }>
    }>
  > {
    return this.request<any[]>('/functional-test/scenarios/by-platform-module')
  }

  /**
   * 按平台分组的场景列表：GET /functional-test/scenarios/by-platform
   * 返回 [{ platform, platformLabel, scenarios: [...] }, ...]，用于折叠展示。
   */
  async getFunctionalTestScenariosByPlatform(): Promise<
    Array<{
      platform: string
      platformLabel: string
      scenarios: Array<{
        id: string
        name: string
        platform: string
        taskType: string
        description?: string
        scenarioKey?: string
      }>
    }>
  > {
    return this.request<any[]>('/functional-test/scenarios/by-platform')
  }

  /**
   * 功能基础质量场景下拉：GET /functional-test/scenarios/functional-quality?platform={platform}
   * `platform` 必填（与任务所选平台枚举一致）。Pog 平台当前多为空数组；禁止改调不带 platform 的全量接口再在本地筛选，以免混入 Android/iOS 场景。
   */
  async getFunctionalQualityScenarios(platform: string) {
    const p = String(platform || '').trim()
    if (!p) {
      return Promise.resolve([])
    }
    const q = `?platform=${encodeURIComponent(p)}`
    return this.request<Array<{ scenarioKey: string; name: string; platform?: string; id?: string; taskType?: string; description?: string }>>(
      `/functional-test/scenarios/functional-quality${q}`
    )
  }

  /**
   * 执行登录自动化测试：POST /functional-test/execute
   * 必填 scenarioId、deviceId、applicationId；config 推荐必传（JSON 字符串含 phoneNumber、verificationCode）。
   * scenarioId 须与列表/分组接口返回的 id 完全一致，勿使用已废弃或非接口返回的 id。
   */
  async executeFunctionalTest(body: {
    scenarioId: string
    deviceId: string
    applicationId: string
    config?: string
  }) {
    return this.request<{ taskId: string; status: string; message?: string }>('/functional-test/execute', {
      method: 'POST',
      body: JSON.stringify(body)
    })
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

  // ---------- 设置测试直调接口（对接 automation-service，见「Android 设置测试 - 前端对接调试文档」） ----------

  /** Android 设置测试执行响应（后端返回 code/message/data，成功时 code===200，失败时 code===500 等） */
  async executeAndroidSettingsTest(body: {
    deviceId?: string
    appiumServerUrl?: string
    packageName?: string
    platformVersion?: string
    deviceName?: string
  } = {}): Promise<{
    code: number
    message?: string
    data?: {
      reportId?: string
      taskId?: string
      deviceId?: string
      testCaseName?: string
      testSteps?: Array<{ stepName: string; status: string; duration?: number; errorMessage?: string | null }>
      testData?: {
        loadingCompletionDelayMs?: number
        whiteScreenDurationMs?: number
      }
    }
  }> {
    const url = `${this.baseURL}/android-settings-test/execute`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const json = await response.json().catch(() => ({ code: response.status, message: '响应解析失败' }))
      return json as { code: number; message?: string; data?: any }
    } catch (e: any) {
      clearTimeout(timeoutId)
      if (e?.name === 'AbortError') {
        return { code: 0, message: '请求超时（单次测试建议 ≥120 秒）' }
      }
      return { code: 0, message: e?.message || '网络错误' }
    }
  }

  /**
   * iOS 设置测试直调：POST {baseUrl}/ios-settings-test/execute（备用，主流程不依赖）
   * 请求体 deviceId 必填，applicationId 与 bundleId 二选一；响应格式同 Android。
   */
  async executeIosSettingsTest(body: {
    deviceId: string
    applicationId?: string
    bundleId?: string
    appiumServerUrl?: string
  }) {
    return this.request<{ code?: number; message?: string; data?: { taskId?: string; deviceId?: string; testCaseName?: string; testSteps?: Array<{ stepName: string; status: string; errorMessage?: string | null }>; reportPath?: string } }>(
      '/ios-settings-test/execute',
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  /** Android 设置测试健康检查：GET {baseUrl}/android-settings-test/health（备用） */
  async getAndroidSettingsTestHealth() {
    return this.request<{ status?: string; service?: string; timestamp?: number }>('/android-settings-test/health')
  }

  /** iOS 设置测试健康检查：GET {baseUrl}/ios-settings-test/health（备用） */
  async getIosSettingsTestHealth() {
    return this.request<{ status?: string; service?: string; timestamp?: number }>('/ios-settings-test/health')
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
    /** 与后端计划类型枚举一致，如 POG_ANDROID、POG_IOS、POGPOG（兼容旧数据） */
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

  // —— APP 线上回归 ——
  async getOnlineRegressionAccounts(appId?: string) {
    const q = appId ? `?appId=${encodeURIComponent(appId)}` : ''
    return this.request<
      Array<{ id: string; appId: string; label?: string; phoneNumber: string; verificationCode: string }>
    >(`/online-regression/accounts${q}`)
  }

  async startOnlineRegressionRun(body: {
    appIds: string[]
    deviceIds: string[]
    featureIds: string[]
    excludeJobKeys?: string[]
    /** 多账号：两机回归时传两个不同账号，后端随机分配到设备 */
    accountIds?: string[]
    accountId?: string
    customPhones?: string[]
    customCodes?: string[]
    customPhone?: string
    customCode?: string
    enableOverseasProxy?: boolean
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
}

export const apiClient = new ApiClient(API_BASE_URL)
