export type ModeId = 'chat' | 'monitor' | 'knowledge' | 'logs'
export type RightTab = 'monitor' | 'knowledge' | 'workflow'

export type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  actions?: unknown[]
}

export type KnowledgeItem = {
  title: string
  tag: string
  hint?: string
  snippet?: string
}

export type WorkflowLog = {
  name: string
  time: string
  status: string
}

export type PendingFile = {
  file: File
  isImage: boolean
  previewUrl?: string
}

export type AgentStatus = {
  enabled?: boolean
  configured?: boolean
  agentId?: string
  monitorWorkflowId?: string
  apiBase?: string
  knowledgeCount?: number
  storageReady?: boolean
} | null

export const ACCEPT_EXTS = [
  '.txt', '.md', '.markdown', '.docx', '.pdf', '.xlsx', '.xls',
  '.json', '.csv', '.html', '.htm',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
]

export const assistantAvatar = '/avatars/junjun-avatar.jpg'

export function formatNow() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `今天 ${hh}:${mm}`
}

export function formatJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatAction(a: unknown) {
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

export function formatActionDetail(a: unknown) {
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

export function tryPageName(url: string) {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg || u.hostname
  } catch {
    return null
  }
}
