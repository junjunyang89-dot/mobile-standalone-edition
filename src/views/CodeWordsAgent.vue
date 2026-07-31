<template>
  <div class="xk-shell">
    <!-- Top bar -->
    <header class="xk-top">
      <div class="xk-top-left">
        <span class="xk-brand">俊俊 AI 助手</span>
        <span class="xk-session">session: {{ sessionId }}</span>
      </div>
      <div class="xk-top-right">
        <span class="xk-pill" :class="status?.configured ? 'ok' : 'bad'">
          <i class="dot" />
          {{ status?.configured ? 'Agent 在线' : 'Agent 未配置' }}
        </span>
        <span class="xk-pill mute">GPT-5.4-mini</span>
        <span class="xk-pill mute">知识库 {{ knowledgeCountDisplay }} 条</span>
        <button type="button" class="xk-link-btn" @click="tipsVisible = true">使用帮助</button>
      </div>
    </header>

    <div class="xk-body">
      <!-- Left rail -->
      <aside class="xk-left">
        <div class="xk-sec-label">功能模式</div>
        <button
          v-for="m in modes"
          :key="m.id"
          type="button"
          class="xk-mode"
          :class="{ active: activeMode === m.id }"
          @click="switchMode(m.id)"
        >
          <span class="xk-mode-icon">{{ m.icon }}</span>
          <span>{{ m.label }}</span>
        </button>

        <div class="xk-sec-label" style="margin-top: 22px">快捷操作</div>
        <button
          v-for="q in quickOps"
          :key="q.id"
          type="button"
          class="xk-quick"
          @click="onQuick(q.id)"
        >
          <div class="xk-quick-title">{{ q.title }}</div>
          <div class="xk-quick-desc">{{ q.desc }}</div>
        </button>
      </aside>

      <!-- Center chat -->
      <main class="xk-center">
        <div ref="chatBoxRef" class="xk-chat">
          <div v-for="(m, i) in messages" :key="i" class="xk-msg" :class="m.role">
            <div class="xk-avatar" :class="m.role">
              <img v-if="m.role === 'assistant'" class="xk-avatar-img" :src="assistantAvatar" alt="俊俊" />
              <span v-else>杨</span>
            </div>
            <div class="xk-bubble-wrap">
              <div v-if="m.actions?.length" class="xk-tool-card">
                <div
                  v-for="(a, j) in m.actions"
                  :key="j"
                  class="xk-tool-row"
                >
                  <span class="xk-tool-badge">{{ formatAction(a) }}</span>
                  <pre class="xk-tool-meta">{{ formatActionDetail(a) }}</pre>
                </div>
              </div>
              <div class="xk-bubble">
                <pre class="xk-text">{{ m.content }}</pre>
              </div>
            </div>
          </div>
          <div v-if="loading" class="xk-msg assistant">
            <div class="xk-avatar assistant">
              <img class="xk-avatar-img" :src="assistantAvatar" alt="俊俊" />
            </div>
            <div class="xk-bubble muted">正在思考 / 调用工具…</div>
          </div>
        </div>

        <div class="xk-chips">
          <button
            v-for="c in chips"
            :key="c.id"
            type="button"
            class="xk-chip"
            @click="onChip(c.id)"
          >
            {{ c.label }}
          </button>
        </div>

        <div
          class="xk-drop"
          :class="{ active: dragOver, hasFiles: pendingFiles.length > 0 }"
          @dragenter.prevent="dragOver = true"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
          @paste="onPaste"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="xk-file-input"
            multiple
            accept=".txt,.md,.markdown,.docx,.pdf,.xlsx,.xls,.json,.csv,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.bmp,image/*"
            @change="onFilePick"
          />
          <div v-if="pendingFiles.length === 0" class="xk-drop-hint" @click="fileInputRef?.click()">
            <span>📎 上传文件 / 粘贴图片</span>
            <span class="muted">拖拽或 Ctrl/Cmd+V · 文档 + png/jpg/gif/webp</span>
          </div>
          <div v-else class="xk-file-list">
            <div v-for="(f, i) in pendingFiles" :key="f.name + i" class="xk-file-row">
              <img v-if="f.previewUrl" :src="f.previewUrl" class="xk-file-thumb" alt="" />
              <div class="xk-file-meta">
                <span class="xk-file-name">{{ f.file.name }}</span>
                <span class="xk-file-size">{{ formatSize(f.file.size) }}{{ f.isImage ? ' · 图片' : '' }}</span>
              </div>
              <button type="button" class="xk-file-rm" title="移除" @click="removeFile(i)">✕</button>
            </div>
            <div class="xk-file-actions">
              <button type="button" class="xk-chip" @click="fileInputRef?.click()">继续添加</button>
              <button
                type="button"
                class="xk-chip accent"
                :disabled="uploading || !status?.configured"
                @click="uploadPending(true)"
              >
                {{ uploading ? '入库中…' : '上传并入库' }}
              </button>
            </div>
          </div>
        </div>

        <div class="xk-composer">
          <textarea
            v-model="input"
            class="xk-input"
            rows="2"
            placeholder="输入消息，或 Ctrl/Cmd+V 粘贴截图…"
            :disabled="loading || uploading || !status?.configured"
            @keydown="onKeydown"
            @paste="onPaste"
          />
          <button
            type="button"
            class="xk-send"
            :disabled="loading || uploading || !status?.configured || (!input.trim() && pendingFiles.length === 0)"
            @click="sendChat"
          >
            发送
          </button>
        </div>
      </main>

      <!-- Right panel -->
      <aside class="xk-right">
        <div class="xk-tabs">
          <button
            v-for="t in rightTabs"
            :key="t.id"
            type="button"
            class="xk-tab"
            :class="{ active: rightTab === t.id }"
            @click="onRightTab(t.id)"
          >
            {{ t.label }}
          </button>
        </div>

        <div v-show="rightTab === 'monitor'" class="xk-panel">
          <div class="xk-panel-title">快速监控</div>
          <label class="xk-field-label">页面 URL</label>
          <input v-model="monitorUrl" class="xk-field" type="text" />
          <label class="xk-switch-row">
            <span>开启定时监控（每天）</span>
            <input v-model="monitorSchedule" type="checkbox" />
          </label>
          <button
            type="button"
            class="xk-primary-btn"
            :disabled="monitorLoading || !status?.configured"
            @click="runMonitor"
          >
            {{ monitorLoading ? '启动中…' : '启动监控' }}
          </button>
          <button
            type="button"
            class="xk-ghost-btn"
            :disabled="!monitorResult"
            @click="showLastMonitor = !showLastMonitor"
          >
            查看上次结果
          </button>

          <div class="xk-panel-title" style="margin-top: 18px">最近监控结果</div>
          <div v-if="monitorSummary" class="xk-result-card">
            <div class="xk-kv"><span>页面</span><b>{{ monitorSummary.page }}</b></div>
            <div class="xk-kv"><span>元素总数</span><b>{{ monitorSummary.total }}</b></div>
            <div class="xk-kv">
              <span>元素变化</span>
              <b class="ok">{{ monitorSummary.change }}</b>
            </div>
            <div class="xk-kv"><span>快照时间</span><b>{{ monitorSummary.snapshotAt }}</b></div>
            <div class="xk-kv"><span>下次检测</span><b class="warn">{{ monitorSummary.nextAt }}</b></div>
          </div>
          <div v-else class="xk-empty">暂无监控结果，启动后显示在这里</div>
          <pre v-if="showLastMonitor && monitorResult" class="xk-raw">{{ formatJson(monitorResult) }}</pre>
        </div>

        <div v-show="rightTab === 'knowledge'" class="xk-panel">
          <div class="xk-panel-title-row">
            <div class="xk-panel-title">知识库</div>
            <button type="button" class="xk-link-btn" @click="loadKnowledge">刷新</button>
          </div>
          <p class="xk-panel-desc">存测试流程、需求摘要等，对话时可让俊俊检索复用</p>
          <div v-if="knowledgeItems.length === 0" class="xk-empty">
            暂无条目。可上传文档、粘贴截图，或点下方新增。
          </div>
          <div
            v-for="(k, i) in knowledgeItems"
            :key="i"
            class="xk-know-card"
            @click="askAboutKnowledge(k)"
          >
            <div class="xk-know-title">{{ k.title }}</div>
            <div v-if="k.snippet" class="xk-know-snippet">{{ k.snippet }}</div>
            <div class="xk-know-tag">{{ k.tag }}</div>
          </div>
          <button type="button" class="xk-add-know" @click="addKnowledgeManual">+ 新增知识条目</button>
        </div>

        <div v-show="rightTab === 'workflow'" class="xk-panel">
          <div class="xk-panel-title">工作流日志</div>
          <div v-if="workflowLogs.length === 0" class="xk-empty">尚无调用记录</div>
          <div v-for="(log, i) in workflowLogs" :key="i" class="xk-log-item">
            <div class="xk-log-name">{{ log.name }}</div>
            <div class="xk-log-meta">{{ log.time }} · {{ log.status }}</div>
          </div>
        </div>

        <div v-if="rightTab === 'monitor'" class="xk-know-preview">
          <div class="xk-panel-title">知识库预览</div>
          <div v-if="knowledgeItems.length === 0" class="xk-empty">暂无知识</div>
          <div
            v-for="(k, i) in knowledgeItems.slice(0, 2)"
            :key="'p' + i"
            class="xk-know-card compact"
            @click="askAboutKnowledge(k)"
          >
            <div class="xk-know-title">{{ k.title }}</div>
            <div class="xk-know-tag">{{ k.tag }}</div>
          </div>
          <button type="button" class="xk-add-know" @click="addKnowledgeManual">+ 新增知识条目</button>
        </div>
      </aside>
    </div>

    <el-dialog
      v-model="tipsVisible"
      title="俊俊使用指南"
      width="520px"
      align-center
      class="xk-tips-dialog"
    >
      <div class="tips-list">
        <div v-for="(item, i) in tipsItems" :key="i" class="tips-item">
          <div class="tips-you">你：「{{ item.you }}」</div>
          <div class="tips-agent">俊俊 → {{ item.agent }}</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeTips">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

const assistantAvatar = '/avatars/junjun-avatar.jpg'

type ModeId = 'chat' | 'monitor' | 'knowledge' | 'logs'
type RightTab = 'monitor' | 'knowledge' | 'workflow'

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  actions?: unknown[]
}

type KnowledgeItem = { title: string; tag: string; hint?: string; snippet?: string }
type WorkflowLog = { name: string; time: string; status: string }

const status = ref<{
  enabled?: boolean
  configured?: boolean
  agentId?: string
  monitorWorkflowId?: string
  apiBase?: string
  knowledgeCount?: number
  storageReady?: boolean
} | null>(null)

const welcome: ChatMsg = {
  role: 'assistant',
  content:
    '你好！我是俊俊，你的测试专属助手。\n\n我可以帮你：\n• 监控 H5/App 页面元素变化\n• 记住并检索测试流程（知识库）\n• 执行自动化工作流 / 生成报告\n\n直接说需求，或点下方快捷按钮开始。'
}

type PendingFile = {
  file: File
  isImage: boolean
  previewUrl?: string
}

const messages = ref<ChatMsg[]>([welcome])
const input = ref('')
const sessionId = ref('yang_junjun')
const loading = ref(false)
const chatBoxRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingFiles = ref<PendingFile[]>([])
const dragOver = ref(false)
const uploading = ref(false)
const ACCEPT_EXTS = [
  '.txt', '.md', '.markdown', '.docx', '.pdf', '.xlsx', '.xls',
  '.json', '.csv', '.html', '.htm',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
]

const activeMode = ref<ModeId>('chat')
const rightTab = ref<RightTab>('monitor')

const monitorUrl = ref(
  'https://news.wmpvp.com/csgo-event.html#/match/2391093/data?forceTab=data&type=1'
)
const monitorSchedule = ref(true)
const monitorLoading = ref(false)
const monitorResult = ref<unknown>(null)
const showLastMonitor = ref(false)

const knowledgeItems = ref<KnowledgeItem[]>([])

const workflowLogs = ref<WorkflowLog[]>([])

const knowledgeCountDisplay = computed(
  () => status.value?.knowledgeCount ?? knowledgeItems.value.length
)

const modes = [
  { id: 'chat' as const, label: 'AI 对话', icon: '💬' },
  { id: 'monitor' as const, label: '元素监控', icon: '👁' },
  { id: 'knowledge' as const, label: '知识库', icon: '📚' },
  { id: 'logs' as const, label: '工作流日志', icon: '📋' }
]

const quickOps = [
  { id: 'monitor', title: '监控新页面', desc: '输入 URL 快速爬取' },
  { id: 'save', title: '存入知识', desc: '保存业务流程' },
  { id: 'run', title: '运行工作流', desc: '触发自动化任务' },
  { id: 'report', title: '测试报告', desc: '生成汇总报告' }
]

const chips = [
  { id: 'save', label: '存入流程' },
  { id: 'monitor', label: '监控页面' },
  { id: 'query', label: '查询知识' },
  { id: 'report', label: '生成报告' },
  { id: 'run', label: '运行工作流' }
]

const rightTabs = [
  { id: 'monitor' as const, label: '元素监控' },
  { id: 'knowledge' as const, label: '知识库' },
  { id: 'workflow' as const, label: '工作流' }
]

const TIPS_SEEN_KEY = 'codewords-agent-tips-seen'
const tipsVisible = ref(false)
const tipsItems = [
  { you: 'Ctrl/Cmd+V 粘贴截图', agent: '图片入库并带给 Agent ✅' },
  { you: '拖入需求文档.md', agent: '解析并写入本地知识库 ✅' },
  { you: '根据这份需求生成测试用例', agent: '结合知识库 / 工作流返回用例 ✅' },
  { you: '监控这个 H5 页面元素', agent: '浏览器爬取 → 返回定位库 ✅' }
]

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

function tryPageName(url: string) {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg || u.hostname
  } catch {
    return null
  }
}

function formatNow() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `今天 ${hh}:${mm}`
}

function closeTips() {
  tipsVisible.value = false
  try {
    localStorage.setItem(TIPS_SEEN_KEY, '1')
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

function onQuick(id: string) {
  onChip(id)
  if (id === 'monitor') {
    activeMode.value = 'monitor'
    rightTab.value = 'monitor'
  }
}

function onChip(id: string) {
  const presets: Record<string, string> = {
    save: '记住：登录流程是 打开APP → 点击登录按钮 → 输入用户名密码 → 点击确认 → 跳转首页。测试时要验证 token 是否正确存储。',
    monitor: `帮我监控这个 H5 页面元素：${monitorUrl.value}`,
    query: '登录流程怎么测？',
    report: '帮我生成一份最近测试的汇总报告',
    run: '执行 API 性能测试'
  }
  input.value = presets[id] || ''
}

function askAboutKnowledge(k: KnowledgeItem) {
  input.value = k.hint || `${k.title}怎么测？`
  activeMode.value = 'chat'
}

function formatJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function formatAction(a: unknown) {
  if (a == null) return String(a)
  if (typeof a === 'string') return a
  if (typeof a === 'object') {
    const o = a as Record<string, unknown>
    const name = o.name || o.tool || o.type || 'tool'
    const arg = o.input || o.args || o.topic || o.query || ''
    if (arg && typeof arg === 'string') return `${name}("${arg}")`
    if (arg && typeof arg === 'object') {
      const topic = (arg as any).topic || (arg as any).url || ''
      if (topic) return `${name}("${topic}")`
    }
    return String(name)
  }
  return String(a)
}

function formatActionDetail(a: unknown) {
  if (a != null && typeof a === 'object') {
    const o = a as Record<string, unknown>
    const lines = [
      `status: ${o.status ?? 'ok'}`,
      o.topic ? `topic: ${o.topic}` : null,
      o.result != null ? `result: ${typeof o.result === 'string' ? o.result : 'ok'}` : null
    ].filter(Boolean)
    if (lines.length) return lines.join('\n')
  }
  return formatJson(a)
}

function extractAssistant(resp: any): ChatMsg {
  const content =
    resp?.response ??
    resp?.message ??
    resp?.result ??
    (typeof resp === 'string' ? resp : formatJson(resp))
  const actions = resp?.actions_executed || resp?.actions || undefined
  return {
    role: 'assistant',
    content: typeof content === 'string' ? content : formatJson(content),
    actions: Array.isArray(actions) ? actions : undefined
  }
}

function pushLog(name: string, ok: boolean) {
  workflowLogs.value.unshift({
    name,
    time: formatNow(),
    status: ok ? '成功' : '失败'
  })
  if (workflowLogs.value.length > 20) workflowLogs.value.pop()
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
    ElMessage.error(e?.message || '获取 CodeWords 状态失败')
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
    if (mapped.length) {
      messages.value = [welcome, ...mapped]
    }
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
    /* Agent 侧也会存；前端失败不阻断 */
  }
}

async function sendChat() {
  let ingestNote = ''
  if (pendingFiles.value.length > 0) {
    try {
      uploading.value = true
      const files = pendingFiles.value.map((p) => p.file)
      const res = await apiClient.ingestAgentFiles(files, true)
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
        ingestNote =
          '我刚上传了附件并已存入知识库：\n' +
          [...docLines, ...imgLines].join('\n') +
          '\n请结合这些内容回答。\n\n'
        messages.value.push({
          role: 'assistant',
          content:
            `已入库 ${okItems.length} 个附件：\n` +
            okItems.map((i) => `• ${i.topic || i.filename}${i.kind === 'image' ? '（图片）' : ''}`).join('\n') +
            (failItems.length ? `\n失败：${failItems.map((f) => f.filename).join(', ')}` : '') +
            '\n\n可以说「根据这份需求生成测试用例」或继续提问。'
        })
        pushLog('文档入库', true)
      } else if (failItems.length) {
        ElMessage.error(failItems[0]?.message || '文件解析失败')
        pushLog('文档入库', false)
        return
      }
    } catch (e: any) {
      ElMessage.error(e?.message || '上传失败')
      pushLog('文档入库', false)
      return
    } finally {
      uploading.value = false
    }
  }

  const typed = input.value.trim()
  const text = (ingestNote + typed).trim()
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
    const msg = extractAssistant(resp)
    messages.value.push(msg)
    pushLog('Agent chat', true)
    await loadKnowledge()
    await persistConversation()
  } catch (e: any) {
    messages.value.push({
      role: 'assistant',
      content: `调用失败：${e?.message || e}`
    })
    pushLog('Agent chat', false)
  } finally {
    loading.value = false
    await scrollBottom()
  }
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function isImageFile(file: File) {
  if (file.type && file.type.startsWith('image/')) return true
  const name = file.name.toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((ext) => name.endsWith(ext))
}

function isAccepted(file: File) {
  if (isImageFile(file)) return true
  const name = file.name.toLowerCase()
  return ACCEPT_EXTS.some((ext) => name.endsWith(ext))
}

function addFiles(list: FileList | File[]) {
  const arr = Array.from(list)
  const next = [...pendingFiles.value]
  for (const f of arr) {
    if (!isAccepted(f)) {
      ElMessage.warning(`不支持的格式：${f.name}`)
      continue
    }
    if (next.some((x) => x.file.name === f.name && x.file.size === f.size)) continue
    const isImage = isImageFile(f)
    next.push({
      file: f,
      isImage,
      previewUrl: isImage ? URL.createObjectURL(f) : undefined
    })
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
  const inputEl = e.target as HTMLInputElement
  if (inputEl.files?.length) addFiles(inputEl.files)
  inputEl.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement
  if (!el.contains(e.relatedTarget as Node)) dragOver.value = false
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
      blob.name && blob.name !== 'image.png'
        ? blob.name
        : `paste-${Date.now()}.${ext}`
    files.push(new File([blob], name, { type: blob.type || 'image/png' }))
  }
  if (!files.length) return
  e.preventDefault()
  addFiles(files)
  ElMessage.success(`已粘贴 ${files.length} 张图片，可发送或点「上传并入库」`)
}

async function uploadPending(saveKnowledge: boolean) {
  if (!pendingFiles.value.length) return
  uploading.value = true
  try {
    const res = await apiClient.ingestAgentFiles(
      pendingFiles.value.map((p) => p.file),
      saveKnowledge
    )
    const okItems = (res.items || []).filter((i) => i.ok)
    const failItems = (res.items || []).filter((i) => !i.ok)
    clearPendingFiles()
    await loadKnowledge()
    messages.value.push({
      role: 'assistant',
      content:
        (saveKnowledge
          ? `已处理并入库 ${okItems.length} 个附件：\n`
          : `已处理 ${okItems.length} 个附件：\n`) +
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
        (saveKnowledge && okItems.length ? '\n\n接下来可以说：「根据这份需求生成测试用例」' : '')
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (!loading.value && !uploading.value) sendChat()
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

onMounted(async () => {
  await loadStatus()
  await Promise.all([loadKnowledge(), loadConversationHistory()])
  try {
    if (!localStorage.getItem(TIPS_SEEN_KEY)) tipsVisible.value = true
  } catch {
    tipsVisible.value = true
  }
})

onBeforeUnmount(() => {
  clearPendingFiles()
})
</script>

<style scoped>
.xk-shell {
  --bg: #0f1419;
  --panel: #151b22;
  --panel-2: #1a222c;
  --line: #2a3441;
  --text: #e8eef5;
  --muted: #8b9aab;
  --accent: #2dd4bf;
  --accent-2: #14b8a6;
  --warn: #f59e0b;
  --user: #243044;
  --danger: #f87171;

  height: 100%;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
}

/* 深色滚动条（WebKit + Firefox） */
.xk-shell,
.xk-shell * {
  scrollbar-width: thin;
  scrollbar-color: #3d4a5c transparent;
}
.xk-shell ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.xk-shell ::-webkit-scrollbar-track {
  background: transparent;
}
.xk-shell ::-webkit-scrollbar-thumb {
  background: #3d4a5c;
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.xk-shell ::-webkit-scrollbar-thumb:hover {
  background: #5a6a7e;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.xk-shell ::-webkit-scrollbar-corner {
  background: transparent;
}

.xk-top {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
  background: #12181f;
}
.xk-brand {
  font-weight: 650;
  letter-spacing: 0.02em;
  margin-right: 14px;
}
.xk-session {
  color: var(--muted);
  font-size: 12px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
}
.xk-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.xk-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel-2);
  border: 1px solid var(--line);
}
.xk-pill.mute { color: var(--muted); }
.xk-pill.ok { color: var(--accent); }
.xk-pill.bad { color: var(--danger); }
.xk-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}
.xk-link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
}

.xk-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 300px;
  overflow: hidden;
}

.xk-left {
  border-right: 1px solid var(--line);
  background: var(--panel);
  padding: 14px 10px;
  overflow-y: auto;
  min-height: 0;
}
.xk-sec-label {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 4px 8px 10px;
}
.xk-mode {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  margin-bottom: 2px;
  border-left: 2px solid transparent;
}
.xk-mode:hover { background: rgba(45, 212, 191, 0.06); color: var(--text); }
.xk-mode.active {
  background: rgba(45, 212, 191, 0.1);
  color: var(--accent);
  border-left-color: var(--accent);
}
.xk-mode-icon { width: 18px; text-align: center; }
.xk-quick {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.xk-quick:hover { border-color: var(--accent); }
.xk-quick-title { font-size: 13px; font-weight: 600; }
.xk-quick-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }

.xk-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #10161c;
}
.xk-chat {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 22px 8px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.xk-msg {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  align-items: flex-start;
}
.xk-msg.user {
  flex-direction: row-reverse;
}
.xk-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}
.xk-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  display: block;
}
.xk-avatar.assistant {
  background: #1c1917;
  color: #042f2e;
  padding: 0;
  border: 1px solid rgba(251, 191, 36, 0.45);
}
.xk-avatar.user {
  background: #334155;
  color: #e2e8f0;
}
.xk-bubble-wrap { max-width: min(720px, 85%); }
.xk-msg.user .xk-bubble-wrap { display: flex; flex-direction: column; align-items: flex-end; }
.xk-bubble {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
}
.xk-msg.user .xk-bubble {
  background: var(--user);
  border-color: #334155;
}
.xk-bubble.muted { color: var(--muted); font-size: 13px; }
.xk-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.55;
}
.xk-tool-card {
  margin-bottom: 8px;
  background: #0c1015;
  border: 1px solid #3f3a2a;
  border-radius: 10px;
  padding: 10px 12px;
  width: 100%;
}
.xk-tool-badge {
  display: inline-block;
  background: #fbbf24;
  color: #1c1917;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.xk-tool-meta {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  white-space: pre-wrap;
}

.xk-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 22px;
  border-top: 1px solid transparent;
  flex-shrink: 0;
}
.xk-chip {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.xk-chip:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.xk-chip.accent {
  color: var(--accent);
  border-color: var(--accent);
}

.xk-drop {
  margin: 0 22px 8px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: var(--panel);
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  flex-shrink: 0;
}
.xk-drop.active {
  border-color: var(--accent);
  background: rgba(45, 212, 191, 0.06);
}
.xk-drop.hasFiles {
  border-style: solid;
}
.xk-file-input {
  display: none;
}
.xk-drop-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.xk-drop-hint .muted {
  color: var(--muted);
  font-size: 12px;
}
.xk-file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xk-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
}
.xk-file-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--line);
}
.xk-file-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.xk-file-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xk-file-size {
  font-size: 11px;
  color: var(--muted);
}
.xk-file-rm {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
}
.xk-file-rm:hover {
  color: var(--danger);
}
.xk-file-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.xk-composer {
  display: flex;
  gap: 10px;
  padding: 10px 22px 16px;
  border-top: 1px solid var(--line);
  align-items: flex-end;
  flex-shrink: 0;
}
.xk-input {
  flex: 1;
  resize: none;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--text);
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 56px;
}
.xk-input:focus { border-color: var(--accent); }
.xk-input:disabled { opacity: 0.5; }
.xk-send {
  height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #042f2e;
  font-weight: 650;
  cursor: pointer;
}
.xk-send:disabled { opacity: 0.4; cursor: not-allowed; }
.xk-send:not(:disabled):hover { background: var(--accent-2); }

.xk-right {
  border-left: 1px solid var(--line);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.xk-tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.xk-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 12px 4px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.xk-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.xk-panel {
  padding: 14px;
  overflow-y: auto;
  flex: 1;
}
.xk-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.xk-panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.xk-panel-title-row .xk-panel-title {
  margin-bottom: 0;
}
.xk-panel-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}
.xk-know-snippet {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.xk-field-label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
.xk-field {
  width: 100%;
  box-sizing: border-box;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 10px;
  font-size: 12px;
  margin-bottom: 12px;
  outline: none;
}
.xk-field:focus { border-color: var(--accent); }
.xk-switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
.xk-primary-btn {
  width: 100%;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #042f2e;
  font-weight: 650;
  padding: 10px;
  cursor: pointer;
  margin-bottom: 8px;
}
.xk-primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.xk-ghost-btn {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  padding: 9px;
  cursor: pointer;
}
.xk-ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.xk-result-card {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
}
.xk-kv {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
  color: var(--muted);
}
.xk-kv b { color: var(--text); font-weight: 600; }
.xk-kv b.ok { color: var(--accent); }
.xk-kv b.warn { color: var(--warn); }
.xk-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 0;
}
.xk-raw {
  margin-top: 10px;
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-all;
  background: #0c1015;
  border-radius: 8px;
  padding: 8px;
}
.xk-know-preview {
  border-top: 1px solid var(--line);
  padding: 12px 14px 16px;
  flex-shrink: 0;
  max-height: 42%;
  overflow-y: auto;
}
.xk-know-card {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.xk-know-card:hover { border-color: var(--accent); }
.xk-know-card.compact { padding: 8px 10px; }
.xk-know-title { font-size: 13px; font-weight: 600; }
.xk-know-tag {
  display: inline-block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--accent);
  background: rgba(45, 212, 191, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
}
.xk-add-know {
  width: 100%;
  border: 1px dashed var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 8px;
  padding: 9px;
  cursor: pointer;
  font-size: 12px;
}
.xk-add-know:hover { color: var(--accent); border-color: var(--accent); }
.xk-log-item {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--panel-2);
}
.xk-log-name { font-size: 13px; }
.xk-log-meta { font-size: 11px; color: var(--muted); margin-top: 4px; }

.tips-list { display: flex; flex-direction: column; gap: 12px; }
.tips-item {
  padding: 12px 14px;
  background: var(--panel-2);
  border-radius: 8px;
  border: 1px solid var(--line);
}
.tips-you { font-size: 14px; color: var(--text); margin-bottom: 6px; }
.tips-agent { font-size: 13px; color: #0d9488; font-weight: 600; }

@media (max-width: 1100px) {
  .xk-body { grid-template-columns: 180px minmax(0, 1fr); }
  .xk-right { display: none; }
}
</style>
