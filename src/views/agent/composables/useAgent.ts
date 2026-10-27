import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'
import {
  ACCEPT_EXTS,
  formatJson,
  formatNow,
  tryPageName,
  type AgentStatus,
  type ChatMsg,
  type KnowledgeItem,
  type ModeId,
  type PendingFile,
  type RightTab,
  type WorkflowLog
} from '../types'

const welcome: ChatMsg = {
  role: 'assistant',
  content:
    '你好！我是 AI 助手。\n\n我可以帮你：\n• 按问题检索「知识手册」短记并展示命中卡片\n• 记住并检索测试流程（知识库）\n• 拖入需求/截图后点「生成测试用例」\n• 监控 H5/App 页面元素变化\n\n直接说需求即可。例如：接口测试要覆盖哪些点？'
}

const TIPS_SEEN_KEY = 'codewords-agent-tips-seen'

export function useAgent() {
  const messages = ref<ChatMsg[]>([welcome])
  const input = ref('')
  const sessionId = ref('yang_junjun')
  const loading = ref(false)
  const chatBoxRef = ref<HTMLElement | null>(null)

  const status = ref<AgentStatus>(null)
  const knowledgeItems = ref<KnowledgeItem[]>([])
  const workflowLogs = ref<WorkflowLog[]>([])
  const activeMode = ref<ModeId>('chat')
  const rightTab = ref<RightTab>('monitor')
  const tipsVisible = ref(false)

  const monitorUrl = ref(
    'https://news.wmpvp.com/csgo-event.html#/match/2391093/data?forceTab=data&type=1'
  )
  const monitorSchedule = ref(true)
  const monitorLoading = ref(false)
  const monitorResult = ref<unknown>(null)
  const showLastMonitor = ref(false)

  const pendingFiles = ref<PendingFile[]>([])
  const dragOver = ref(false)
  const uploading = ref(false)
  /** 最近一次生成的用例（右侧「用例」面板） */
  const lastGeneratedCases = ref<{
    page?: string
    total?: number
    category?: string
    cases: Array<{
      case_id?: string
      caseId?: string
      title?: string
      priority?: string
      type?: string
      precondition?: string
      steps?: Array<{ step?: number; action?: string; target?: string; expected?: string }>
    }>
  } | null>(null)

  const knowledgeCountDisplay = computed(
    () => status.value?.knowledgeCount ?? knowledgeItems.value.length
  )

  const monitorSummary = computed(() => {
    if (!monitorResult.value) return null
    const r: any = monitorResult.value
    const page =
      tryPageName(monitorUrl.value) ||
      r?.page ||
      r?.result?.page ||
      'csgo-event.html'
    const total =
      r?.element_count ??
      r?.elementCount ??
      r?.result?.element_count ??
      r?.result?.total ??
      '—'
    return {
      page,
      total,
      change: '未变化 ✓',
      snapshotAt: formatNow(),
      nextAt: monitorSchedule.value ? '明天同时间' : '未开启定时'
    }
  })

  function pushLog(name: string, ok: boolean) {
    workflowLogs.value.unshift({
      name,
      time: formatNow(),
      status: ok ? '成功' : '失败'
    })
    if (workflowLogs.value.length > 20) workflowLogs.value.pop()
  }

  function extractAssistant(resp: any): ChatMsg {
    const content =
      resp?.response ??
      resp?.message ??
      resp?.result ??
      (typeof resp === 'string' ? resp : formatJson(resp))
    const actions = resp?.actions_executed || resp?.actions || undefined
    const handbookHits = Array.isArray(resp?.handbookHits) ? resp.handbookHits : undefined
    return {
      role: 'assistant',
      content: typeof content === 'string' ? content : formatJson(content),
      actions: Array.isArray(actions) ? actions : undefined,
      handbookHits
    }
  }

  async function scrollBottom() {
    await nextTick()
    const el = chatBoxRef.value
    if (el) el.scrollTop = el.scrollHeight
  }

  async function loadStatus() {
    try {
      status.value = await apiClient.getCodeWordsStatus()
    } catch (e: any) {
      ElMessage.error(e?.message || '获取 AI 助手状态失败')
    }
  }

  async function loadKnowledge() {
    try {
      const res = await apiClient.searchAgentKnowledge('', 50)
      knowledgeItems.value = (res?.results || []).map((r) => ({
        title: r.topic,
        tag: '知识库',
        snippet: r.snippet || '',
        hint: `请根据知识「${r.topic}」说明要点，并回答我怎么测`
      }))
      if (status.value) {
        status.value.knowledgeCount = res?.count ?? knowledgeItems.value.length
      }
    } catch (e: any) {
      console.warn('loadKnowledge failed', e)
      ElMessage.warning(e?.message || '知识库加载失败')
    }
  }

  async function loadConversationHistory() {
    try {
      const sid = sessionId.value.trim() || 'yang_junjun'
      const res = await apiClient.loadAgentConversation(sid)
      const list = Array.isArray(res?.messages) ? res.messages : []
      if (list.length === 0) return
      const mapped: ChatMsg[] = list
        .map((m: any) => {
          const role = m.role === 'user' || m.role === 'assistant' ? m.role : null
          const content = typeof m.content === 'string' ? m.content : m.message || m.text
          if (!role || !content) return null
          return { role, content: String(content), actions: m.actions_executed || m.actions } as ChatMsg
        })
        .filter(Boolean) as ChatMsg[]
      if (mapped.length) messages.value = [welcome, ...mapped]
    } catch {
      /* ignore */
    }
  }

  async function persistConversation() {
    try {
      const sid = sessionId.value.trim() || 'yang_junjun'
      const payload = messages.value
        .filter((m) => m !== welcome && m.content)
        .map((m) => ({ role: m.role, content: m.content }))
      await apiClient.saveAgentConversation({ session_id: sid, messages: payload })
    } catch {
      /* ignore */
    }
  }

  function switchMode(id: ModeId) {
    activeMode.value = id
    if (id === 'monitor') rightTab.value = 'monitor'
    if (id === 'knowledge') {
      rightTab.value = 'knowledge'
      loadKnowledge()
    }
    if (id === 'logs') rightTab.value = 'workflow'
  }

  function onRightTab(id: RightTab) {
    rightTab.value = id
    if (id === 'knowledge') loadKnowledge()
  }

  function onChip(id: string) {
    if (id === 'cases') {
      void generateTestCasesFromAgent()
      return
    }
    const presets: Record<string, string> = {
      save: '记住：登录流程是 打开APP → 点击登录按钮 → 输入用户名密码 → 点击确认 → 跳转首页。测试时要验证 token 是否正确存储。',
      monitor: `帮我监控这个 H5 页面元素：${monitorUrl.value}`,
      query: '登录流程怎么测？',
      report: '帮我生成一份最近测试的汇总报告',
      run: '执行 API 性能测试'
    }
    input.value = presets[id] || ''
  }

  function onQuick(id: string) {
    if (id === 'cases') {
      void generateTestCasesFromAgent()
      return
    }
    onChip(id)
    if (id === 'monitor') {
      activeMode.value = 'monitor'
      rightTab.value = 'monitor'
    }
  }

  function guessPageName(text: string): string {
    const m = text.match(/(?:页面|模块|功能)[：:]\s*([^\n，,。]{2,40})/)
    if (m?.[1]) return m[1].trim()
    const line = text
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s.length >= 2 && s.length <= 40 && !s.startsWith('请根据'))
    if (line && line !== '测试页面') return line
    return ''
  }

  async function askPageName(defaultName = ''): Promise<string | null> {
    try {
      const { value } = await ElMessageBox.prompt(
        '请填写真实页面名（如：战绩详情页 / 击杀集锦页）',
        '生成测试用例',
        {
          confirmButtonText: '开始生成',
          cancelButtonText: '取消',
          inputValue: defaultName || '战绩详情页',
          inputPattern: /.{2,40}/,
          inputErrorMessage: '请填写 2～40 字的页面名'
        }
      )
      const v = String(value || '').trim()
      return v || null
    } catch {
      return null
    }
  }

  function pickTestCases(payload: any): any[] | null {
    if (Array.isArray(payload?.test_cases) && payload.test_cases.length) return payload.test_cases
    if (Array.isArray(payload?.data?.test_cases) && payload.data.test_cases.length) {
      return payload.data.test_cases
    }
    if (Array.isArray(payload?.result?.test_cases) && payload.result.test_cases.length) {
      return payload.result.test_cases
    }
    return null
  }

  function formatTestCasesMessage(cases: any[], page?: string, savedHint?: string): string {
    let msg = `✅ 已生成 **${cases.length}** 条测试用例`
    if (page) msg += `（${page}）`
    msg += '：\n\n'
    for (const c of cases) {
      const id = c.case_id || c.caseId || 'TC'
      const prio = c.priority || 'P1'
      msg += `**${id}** ${c.title || ''} \`${prio}\`\n`
      if (c.precondition) msg += `前置：${c.precondition}\n`
      const steps = Array.isArray(c.steps) ? c.steps : []
      for (const s of steps) {
        msg += `  ${s.step ?? ''}. ${s.action || ''} → ${s.target || ''} → 预期：${s.expected || ''}\n`
      }
      msg += '\n'
    }
    if (savedHint) msg += savedHint
    return msg
  }

  /**
   * 快捷「生成测试用例」：输入框文字 + 待上传文件 → multipart（图转 base64）→ 聊天 + 右侧面板。
   */
  async function generateTestCasesFromAgent() {
    if (loading.value || uploading.value) return
    if (!status.value?.configured) {
      ElMessage.warning('AI 未配置：千问填 diagnosis.ai.api-key，ChatGPT 填 ai.openai.api-key（application.yml）')
      return
    }

    const typed = input.value.trim()
    const pending = [...pendingFiles.value]
    if (!typed && !pending.length) {
      ElMessage.warning('请先输入需求文字，或拖入/粘贴 PDF、Word、截图')
      return
    }

    const guessed = guessPageName(typed)
    const pageName = await askPageName(guessed)
    if (!pageName) return

    messages.value.push({
      role: 'user',
      content: typed
        ? `【生成测试用例】页面：${pageName}\n${typed}`
        : `【生成测试用例】页面：${pageName} · 已上传 ${pending.length} 个文件`
    })
    messages.value.push({ role: 'assistant', content: '正在生成测试用例…' })
    input.value = ''
    clearPendingFiles()
    await scrollBottom()
    loading.value = true
    uploading.value = true

    try {
      const generated = await apiClient.generateAiTestCasesUpload({
        page_name: pageName,
        text_content: typed || undefined,
        requirements: typed || undefined,
        files: pending.map((p) => p.file)
      })
      const cases = pickTestCases(generated)
      messages.value.pop()
      if (!cases?.length) {
        messages.value.push({
          role: 'assistant',
          content: '生成器未返回 test_cases，原始响应：\n' + formatJson(generated)
        })
        pushLog('测试用例生成', false)
        await persistConversation()
        await scrollBottom()
        return
      }

      const category =
        localStorage.getItem('ai-test-case-category') || 'wmpvp-android'
      let savedHint = ''
      try {
        await apiClient.saveAiTestCasesBatch({
          page_name: (generated as any)?.page || pageName,
          category,
          status: 'DRAFT',
          test_cases: cases
        })
        savedHint = `\n已保存到用例库「${category}」，可在侧栏「测试用例」中查看。\n`
      } catch (e: any) {
        savedHint = `\n（落库失败：${e?.message || '未知错误'}，仍可在下方查看生成结果）\n`
      }

      lastGeneratedCases.value = {
        page: (generated as any)?.page || pageName,
        total: cases.length,
        category,
        cases
      }
      rightTab.value = 'cases'
      messages.value.push({
        role: 'assistant',
        content: formatTestCasesMessage(
          cases,
          (generated as any)?.page || pageName,
          savedHint
        )
      })
      pushLog('测试用例生成', true)
      await persistConversation()
      ElMessage.success(`已生成 ${cases.length} 条用例`)
    } catch (e: any) {
      if (messages.value[messages.value.length - 1]?.content?.includes('正在生成')) {
        messages.value.pop()
      }
      messages.value.push({
        role: 'assistant',
        content: `❌ 生成失败：${e?.message || '请检查网络与 AI 模型配置'}`
      })
      pushLog('测试用例生成', false)
      await persistConversation()
    } finally {
      loading.value = false
      uploading.value = false
      await scrollBottom()
    }
  }

  function askAboutKnowledge(k: KnowledgeItem) {
    input.value = k.hint || `${k.title}怎么测？`
    activeMode.value = 'chat'
  }

  async function addKnowledgeManual() {
    const topic = window.prompt('知识主题（如：登录流程）')
    if (!topic?.trim()) return
    const content = window.prompt('知识内容（流程步骤、注意点等）')
    if (!content?.trim()) return
    try {
      await apiClient.saveAgentKnowledge({ topic: topic.trim(), content: content.trim() })
      ElMessage.success('已写入知识库')
      await loadKnowledge()
      rightTab.value = 'knowledge'
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    }
  }

  async function runMonitor() {
    if (!monitorUrl.value.trim()) {
      ElMessage.warning('请填写页面 URL')
      return
    }
    monitorLoading.value = true
    showLastMonitor.value = false
    try {
      monitorResult.value = await apiClient.codeWordsMonitor({
        url: monitorUrl.value.trim(),
        schedule: monitorSchedule.value
      })
      pushLog('元素监控 ' + (status.value?.monitorWorkflowId || 'monitor'), true)
      ElMessage.success('监控工作流已调用')
      rightTab.value = 'monitor'
    } catch (e: any) {
      pushLog('元素监控', false)
      ElMessage.error(e?.message || '监控调用失败')
    } finally {
      monitorLoading.value = false
    }
  }

  function isImageFile(file: File) {
    if (file.type?.startsWith('image/')) return true
    const name = file.name.toLowerCase()
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext))
  }

  function isAccepted(file: File) {
    if (isImageFile(file)) return true
    return ACCEPT_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext))
  }

  function addFiles(list: FileList | File[]) {
    const next = [...pendingFiles.value]
    for (const f of Array.from(list)) {
      if (!isAccepted(f)) {
        ElMessage.warning(`不支持的格式：${f.name}`)
        continue
      }
      if (next.some((x) => x.file.name === f.name && x.file.size === f.size)) continue
      const isImage = isImageFile(f)
      next.push({ file: f, isImage, previewUrl: isImage ? URL.createObjectURL(f) : undefined })
    }
    pendingFiles.value = next
  }

  function clearPendingFiles() {
    for (const p of pendingFiles.value) {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
    }
    pendingFiles.value = []
  }

  function removeFile(i: number) {
    const item = pendingFiles.value[i]
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    pendingFiles.value = pendingFiles.value.filter((_, idx) => idx !== i)
  }

  function onFilePick(e: Event) {
    const el = e.target as HTMLInputElement
    if (el.files?.length) addFiles(el.files)
    el.value = ''
  }

  function onDrop(e: DragEvent) {
    dragOver.value = false
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }

  function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items?.length) return
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') continue
      const blob = item.getAsFile()
      if (!blob) continue
      if (!blob.type.startsWith('image/') && !isAccepted(blob)) continue
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      const name =
        blob.name && blob.name !== 'image.png' ? blob.name : `paste-${Date.now()}.${ext}`
      files.push(new File([blob], name, { type: blob.type || 'image/png' }))
    }
    if (!files.length) return
    e.preventDefault()
    addFiles(files)
    ElMessage.success(`已粘贴 ${files.length} 张图片，可发送或点「上传并入库」`)
  }

  async function ingestPendingForChat(): Promise<{
    ingestNote: string
    assistantNote: string
  } | null> {
    if (!pendingFiles.value.length) return { ingestNote: '', assistantNote: '' }
    try {
      uploading.value = true
      const res = await apiClient.ingestAgentFiles(
        pendingFiles.value.map((p) => p.file),
        true
      )
      const okItems = (res.items || []).filter((i) => i.ok)
      const failItems = (res.items || []).filter((i) => !i.ok)
      clearPendingFiles()
      await loadKnowledge()
      if (okItems.length) {
        const imgLines = okItems
          .filter((i) => i.kind === 'image' && i.url)
          .map((i) => `- 图片 ${i.filename}: ${apiClient.getBaseUrl()}${i.url}`)
        const docLines = okItems
          .filter((i) => i.kind !== 'image')
          .map((i) => `- ${i.topic || i.filename}（${i.chars || 0} 字）`)
        pushLog('文档入库', true)
        return {
          ingestNote:
            '我刚上传了附件并已存入知识库：\n' +
            [...docLines, ...imgLines].join('\n') +
            '\n请结合这些内容回答。\n\n',
          assistantNote:
            `已入库 ${okItems.length} 个附件：\n` +
            okItems
              .map((i) => `• ${i.topic || i.filename}${i.kind === 'image' ? '（图片）' : ''}`)
              .join('\n') +
            (failItems.length ? `\n失败：${failItems.map((f) => f.filename).join(', ')}` : '') +
            '\n\n可以说「根据这份需求生成测试用例」或继续提问。'
        }
      }
      if (failItems.length) {
        ElMessage.error(failItems[0]?.message || '文件解析失败')
        pushLog('文档入库', false)
        return null
      }
      return { ingestNote: '', assistantNote: '' }
    } catch (e: any) {
      ElMessage.error(e?.message || '上传失败')
      pushLog('文档入库', false)
      return null
    } finally {
      uploading.value = false
    }
  }

  async function uploadPending() {
    if (!pendingFiles.value.length) return
    uploading.value = true
    try {
      const res = await apiClient.ingestAgentFiles(
        pendingFiles.value.map((p) => p.file),
        true
      )
      const okItems = (res.items || []).filter((i) => i.ok)
      const failItems = (res.items || []).filter((i) => !i.ok)
      clearPendingFiles()
      await loadKnowledge()
      messages.value.push({
        role: 'assistant',
        content:
          `已处理并入库 ${okItems.length} 个附件：\n` +
          okItems
            .map((i) => {
              const tag = i.kind === 'image' ? '图片' : '文档'
              const link = i.url ? ` → ${apiClient.getBaseUrl()}${i.url}` : ''
              return `• [${tag}] ${i.topic || i.filename}${link}`
            })
            .join('\n') +
          (failItems.length
            ? `\n\n失败：\n` + failItems.map((f) => `• ${f.filename}: ${f.message || '错误'}`).join('\n')
            : '') +
          (okItems.length ? '\n\n接下来可以说：「根据这份需求生成测试用例」' : '')
      })
      pushLog('文档入库', okItems.length > 0)
      await scrollBottom()
      if (okItems.length) ElMessage.success(`成功处理 ${okItems.length} 个文件`)
    } catch (e: any) {
      ElMessage.error(e?.message || '上传失败')
      pushLog('文档入库', false)
    } finally {
      uploading.value = false
    }
  }

  async function sendChat() {
    if (loading.value || uploading.value) return
    const ingest = await ingestPendingForChat()
    if (ingest === null) return
    if (ingest.assistantNote) {
      messages.value.push({ role: 'assistant', content: ingest.assistantNote })
    }
    const typed = input.value.trim()
    const text = (ingest.ingestNote + typed).trim()
    if (!text) {
      ElMessage.warning('请输入消息或上传/粘贴文件')
      return
    }
    messages.value.push({
      role: 'user',
      content: typed || '（已上传附件，请结合知识库继续）'
    })
    input.value = ''
    await scrollBottom()
    loading.value = true
    try {
      const resp = await apiClient.codeWordsChat({
        message: text,
        sessionId: sessionId.value.trim() || 'yang_junjun'
      })
      messages.value.push(extractAssistant(resp))
      pushLog('Agent chat', true)
      await loadKnowledge()
      await persistConversation()
    } catch (e: any) {
      messages.value.push({ role: 'assistant', content: `调用失败：${e?.message || e}` })
      pushLog('Agent chat', false)
    } finally {
      loading.value = false
      await scrollBottom()
    }
  }

  function closeTips() {
    tipsVisible.value = false
    try {
      localStorage.setItem(TIPS_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  onMounted(async () => {
    await loadStatus()
    await Promise.all([loadKnowledge(), loadConversationHistory()])
    try {
      if (!localStorage.getItem(TIPS_SEEN_KEY)) tipsVisible.value = true
    } catch {
      tipsVisible.value = true
    }
  })

  onBeforeUnmount(() => clearPendingFiles())

  return {
    messages,
    input,
    sessionId,
    loading,
    chatBoxRef,
    status,
    knowledgeItems,
    workflowLogs,
    activeMode,
    rightTab,
    tipsVisible,
    monitorUrl,
    monitorSchedule,
    monitorLoading,
    monitorResult,
    showLastMonitor,
    monitorSummary,
    knowledgeCountDisplay,
    pendingFiles,
    dragOver,
    uploading,
    lastGeneratedCases,
    switchMode,
    onRightTab,
    onChip,
    onQuick,
    askAboutKnowledge,
    addKnowledgeManual,
    runMonitor,
    removeFile,
    onFilePick,
    onDrop,
    onPaste,
    uploadPending,
    sendChat,
    closeTips,
    loadKnowledge,
    scrollBottom
  }
}
