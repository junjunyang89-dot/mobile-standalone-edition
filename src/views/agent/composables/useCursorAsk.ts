import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

export type ChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMsg[]
  /** 后端 Cursor agent 会话键 */
  backendSessionId: string
}

const welcome: ChatMsg = {
  role: 'assistant',
  content:
    '你好。这里接的是本机 Cursor Agent（不是千问）。\n\n' +
    '适合问：代码在哪、某字段怎么判断、环境怎么搭。\n' +
    '写代码、改平台请继续在 Cursor IDE 里跟我对话。\n\n' +
    '先确认上方「代码目录」，再直接提问即可。'
}

const CWD_KEY = 'cursor-ask:cwd'
const SESSIONS_KEY = 'cursor-ask:sessions-v1'
const ACTIVE_KEY = 'cursor-ask:active-v1'

export const QUICK_PROMPTS = [
  '这个文件在哪里？',
  '某字段如何取值？',
  '怎么新增一个步骤类型？',
  '元素定位器格式说明',
  '环境变量在哪配？',
  '项目目录结构'
]

function recallCwd(fallback: string) {
  try {
    return localStorage.getItem(CWD_KEY) || fallback
  } catch {
    return fallback
  }
}

function rememberCwd(v: string) {
  try {
    if (v.trim()) localStorage.setItem(CWD_KEY, v.trim())
  } catch {
    /* ignore */
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveSessions(list: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* ignore */
  }
}

function titleFromMessages(msgs: ChatMsg[]) {
  const firstUser = msgs.find((m) => m.role === 'user')
  if (!firstUser) return '新对话'
  const t = firstUser.content.replace(/\s+/g, ' ').trim()
  return t.length > 28 ? `${t.slice(0, 28)}…` : t
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function useCursorAsk() {
  const sessions = ref<ChatSession[]>(loadSessions())
  const activeId = ref('')
  const messages = ref<ChatMsg[]>([{ ...welcome }])
  const input = ref('')
  const loading = ref(false)
  const cwdEditing = ref(false)
  const status = ref<{
    configured?: boolean
    model?: string
    cwd?: string
    hint?: string
    hasApiKey?: boolean
    sdkInstalled?: boolean
  } | null>(null)
  const cwd = ref('')

  function ensureActive() {
    if (!sessions.value.length) {
      const id = `local-${Date.now()}`
      const s: ChatSession = {
        id,
        title: '新对话',
        updatedAt: Date.now(),
        messages: [{ ...welcome }],
        backendSessionId: `ask-${Date.now()}`
      }
      sessions.value = [s]
      activeId.value = id
      messages.value = [...s.messages]
      saveSessions(sessions.value)
      try {
        localStorage.setItem(ACTIVE_KEY, id)
      } catch {
        /* ignore */
      }
      return
    }
    let id = ''
    try {
      id = localStorage.getItem(ACTIVE_KEY) || ''
    } catch {
      /* ignore */
    }
    const found = sessions.value.find((s) => s.id === id) || sessions.value[0]
    activeId.value = found.id
    messages.value = found.messages?.length ? [...found.messages] : [{ ...welcome }]
  }

  function persistActive() {
    const idx = sessions.value.findIndex((s) => s.id === activeId.value)
    if (idx < 0) return
    const next = [...sessions.value]
    next[idx] = {
      ...next[idx],
      messages: [...messages.value],
      title: titleFromMessages(messages.value),
      updatedAt: Date.now()
    }
    sessions.value = next.sort((a, b) => b.updatedAt - a.updatedAt)
    saveSessions(sessions.value)
  }

  const sessionGroups = computed(() => {
    const now = startOfDay(Date.now())
    const yesterday = now - 86400000
    const groups: Array<{ label: string; items: ChatSession[] }> = [
      { label: '今天', items: [] },
      { label: '昨天', items: [] },
      { label: '更早', items: [] }
    ]
    for (const s of sessions.value) {
      const day = startOfDay(s.updatedAt)
      if (day >= now) groups[0].items.push(s)
      else if (day >= yesterday) groups[1].items.push(s)
      else groups[2].items.push(s)
    }
    return groups.filter((g) => g.items.length)
  })

  async function loadStatus() {
    try {
      status.value = await apiClient.cursorAskStatus()
      if (!cwd.value) {
        cwd.value = recallCwd(status.value?.cwd || '')
      }
    } catch (e: any) {
      status.value = { configured: false, hint: e?.message || '无法连接后端' }
    }
  }

  function selectSession(id: string) {
    if (loading.value || id === activeId.value) return
    persistActive()
    const s = sessions.value.find((x) => x.id === id)
    if (!s) return
    activeId.value = id
    messages.value = s.messages?.length ? [...s.messages] : [{ ...welcome }]
    try {
      localStorage.setItem(ACTIVE_KEY, id)
    } catch {
      /* ignore */
    }
  }

  async function sendChat(textOverride?: string) {
    if (loading.value) return
    const text = (textOverride ?? input.value).trim()
    if (!text) {
      ElMessage.warning('请输入问题')
      return
    }
    if (!status.value?.configured) {
      ElMessage.warning(status.value?.hint || 'Cursor SDK 未就绪')
      return
    }
    const cur = sessions.value.find((s) => s.id === activeId.value)
    const backendSessionId = cur?.backendSessionId || `ask-${Date.now()}`
    messages.value.push({ role: 'user', content: text })
    if (!textOverride) input.value = ''
    loading.value = true
    rememberCwd(cwd.value)
    persistActive()
    try {
      const resp = await apiClient.cursorAskChat({
        message: text,
        sessionId: backendSessionId,
        cwd: cwd.value.trim() || undefined,
        mode: 'ask'
      })
      messages.value.push({
        role: 'assistant',
        content: String(resp.answer || resp.error || '（无回复）')
      })
    } catch (e: any) {
      messages.value.push({
        role: 'assistant',
        content: `调用失败：${e?.message || e}`
      })
    } finally {
      loading.value = false
      persistActive()
    }
  }

  async function newChat() {
    persistActive()
    const old = sessions.value.find((s) => s.id === activeId.value)
    if (old?.backendSessionId) {
      try {
        await apiClient.cursorAskReset(old.backendSessionId, 'ask')
      } catch {
        /* ignore */
      }
    }
    const id = `local-${Date.now()}`
    const s: ChatSession = {
      id,
      title: '新对话',
      updatedAt: Date.now(),
      messages: [{ ...welcome }],
      backendSessionId: `ask-${Date.now()}`
    }
    sessions.value = [s, ...sessions.value].slice(0, 40)
    activeId.value = id
    messages.value = [{ ...welcome }]
    saveSessions(sessions.value)
    try {
      localStorage.setItem(ACTIVE_KEY, id)
    } catch {
      /* ignore */
    }
  }

  function formatSessionTime(ts: number) {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  watch(cwd, (v) => rememberCwd(v))

  onMounted(() => {
    ensureActive()
    loadStatus()
  })

  return {
    messages,
    input,
    loading,
    status,
    cwd,
    cwdEditing,
    sessions,
    activeId,
    sessionGroups,
    sendChat,
    newChat,
    selectSession,
    formatSessionTime,
    loadStatus
  }
}
