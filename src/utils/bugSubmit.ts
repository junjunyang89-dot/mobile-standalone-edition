export type BugLinkedIssue = { relation: string; ref: string }

export type BugSubmitValue = {
  id?: string
  requirementNo?: string
  caseId?: string
  environment?: string
  issueType?: string
  priority?: string
  summary?: string
  module?: string
  modules?: string[]
  appVersion?: string
  description?: string
  images?: string[]
  reporter?: string
  assignee?: string
  linkedIssues?: BugLinkedIssue[]
  note?: string
  status?: string
  fixed?: boolean
  verified?: boolean
}

const ISSUE_TYPE_RE = /^\[问题类型:([^\]]+)\]\s*/
const LINKED_RE = /\[链接:([^|\]]+)\|([^\]]+)\]/g

export function parseBugDescription(raw: string): { summary: string; body: string } {
  const text = String(raw || '').trim()
  if (!text) return { summary: '', body: '' }
  const parts = text.split(/\n{2,}/)
  const first = parts[0]?.trim() || ''
  const rest = parts.slice(1).join('\n\n').trim()
  if (rest) return { summary: first, body: rest }
  if (first.includes('【实际结果】') || first.includes('【期望结果】')) {
    return { summary: '', body: first }
  }
  return { summary: first, body: '' }
}

export function parseBugNote(raw: string): {
  issueType: string
  linkedIssues: BugLinkedIssue[]
  note: string
} {
  let note = String(raw || '')
  let issueType = '故障'
  const typeMatch = note.match(ISSUE_TYPE_RE)
  if (typeMatch) {
    issueType = typeMatch[1]
    note = note.replace(ISSUE_TYPE_RE, '')
  }
  const linkedIssues: BugLinkedIssue[] = []
  note = note.replace(LINKED_RE, (_, relation, ref) => {
    linkedIssues.push({ relation, ref })
    return ''
  })
  return { issueType, linkedIssues, note: note.trim() }
}

export function composeBugDescription(summary: string, body: string): string {
  const s = summary.trim()
  const b = body.trim()
  if (s && b) return `${s}\n\n${b}`
  return s || b
}

export function composeBugNote(issueType: string, linkedIssues: BugLinkedIssue[], note: string): string {
  const parts: string[] = []
  if (issueType) parts.push(`[问题类型:${issueType}]`)
  for (const li of linkedIssues) {
    if (li.ref.trim()) parts.push(`[链接:${li.relation}|${li.ref.trim()}]`)
  }
  const tail = note.trim()
  if (tail) parts.push(tail)
  return parts.join(' ')
}

export function bugValueToApiPayload(v: BugSubmitValue) {
  const modules = v.modules?.length ? v.modules : v.module ? [v.module] : []
  const description = composeBugDescription(v.summary || '', v.description || '')
  return {
    id: v.id,
    requirementNo: v.requirementNo,
    caseId: v.caseId,
    environment: v.environment,
    appVersion: v.appVersion,
    module: modules.join('、') || v.module || '',
    description,
    images: JSON.stringify(v.images || []),
    developer: v.assignee || '',
    tester: v.reporter || '',
    priority: v.priority || 'MEDIUM',
    status: v.status || 'OPEN',
    fixed: v.fixed ?? false,
    verified: v.verified ?? false,
    note: composeBugNote(v.issueType || '故障', v.linkedIssues || [], v.note || '')
  }
}

export function apiRowToBugValue(row: Record<string, any>): BugSubmitValue {
  const { summary, body } = parseBugDescription(String(row.description || ''))
  const noteParsed = parseBugNote(String(row.note || ''))
  let images: string[] = []
  try {
    const parsed = JSON.parse(row.images || '[]')
    images = Array.isArray(parsed) ? parsed : []
  } catch {
    images = []
  }
  const moduleStr = String(row.module || '')
  return {
    id: row.id,
    requirementNo: row.requirementNo,
    caseId: row.caseId,
    environment: row.environment,
    issueType: noteParsed.issueType,
    priority: row.priority || 'MEDIUM',
    summary,
    module: moduleStr,
    modules: moduleStr ? moduleStr.split(/[、,，/]/).map((s) => s.trim()).filter(Boolean) : [],
    appVersion: row.appVersion || '',
    description: body,
    images,
    reporter: row.tester || '',
    assignee: row.developer || '',
    linkedIssues: noteParsed.linkedIssues,
    note: noteParsed.note,
    status: row.status || 'OPEN',
    fixed: !!row.fixed,
    verified: !!row.verified
  }
}

export function defaultBugValue(partial?: Partial<BugSubmitValue>): BugSubmitValue {
  return {
    issueType: '故障',
    priority: 'MEDIUM',
    summary: '',
    module: '',
    modules: [],
    appVersion: '',
    description: '【实际结果】\n描述实际发生了什么...\n\n【期望结果】\n描述期望的正确行为...',
    images: [],
    reporter: '',
    assignee: '',
    linkedIssues: [],
    note: '',
    status: 'OPEN',
    fixed: false,
    verified: false,
    ...partial
  }
}
