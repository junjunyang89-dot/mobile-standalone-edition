/**
 * 断言出处：生成用例时后端在每条断言上写了 source + evidence。
 * 验过的和猜的跑出来一样是绿的，列表上不标出来，人没法判断这条用例可不可信。
 */

export type AssertionSourceKey =
  | 'capture'
  | 'tryrun'
  | 'fields'
  | 'ai'
  | 'convention'
  | 'code'
  | 'default'
  | 'manual'

export const ASSERTION_SOURCE_META: Record<AssertionSourceKey, { text: string; verified: boolean | null }> = {
  capture: { text: '抓包响应验证过', verified: true },
  tryrun: { text: '试跑响应验证过', verified: true },
  fields: { text: '接口对比 / 抓包记录的字段', verified: true },
  manual: { text: '人工写的', verified: true },
  ai: { text: 'AI 写的，没验证', verified: false },
  convention: { text: '按项目成功码约定，没验证', verified: false },
  code: { text: '读源码推出来的，没跑过', verified: false },
  default: { text: '平台默认', verified: null }
}

const OP_TEXT: Record<string, string> = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' }

export interface AssertionLine {
  /** 给人看的一行：$.code = 0 */
  what: string
  source?: AssertionSourceKey
  evidence?: string
}

function describe(a: any): string {
  if (a?.type === 'status') return `HTTP 状态码 = ${a.equals}`
  const target = a?.path ?? a?.name ?? a?.sql ?? a?.type ?? ''
  if (a?.op === 'type') return `${target} 类型是 ${a.value ?? ''}`
  if (a?.op) return `${target} ${OP_TEXT[a.op] || a.op} ${a.value ?? ''}`.trim()
  if (a?.exists !== undefined) return `${target} ${a.exists ? '存在' : '不存在'}`
  if (a?.equals !== undefined) return `${target} = ${JSON.stringify(a.equals)}`
  if (a?.notEquals !== undefined) return `${target} ≠ ${JSON.stringify(a.notEquals)}`
  if (a?.contains !== undefined) return `${target} 包含 ${a.contains}`
  if (a?.value !== undefined) return `${target} ${a.value}`
  return String(target)
}

export function assertionLines(raw?: string | null): AssertionLine[] {
  let arr: any[] = []
  try {
    const p = JSON.parse(raw || '[]')
    arr = Array.isArray(p) ? p : []
  } catch {
    return []
  }
  return arr.map((a) => ({
    what: describe(a),
    source: a?.source in ASSERTION_SOURCE_META ? (a.source as AssertionSourceKey) : undefined,
    evidence: a?.evidence ? String(a.evidence) : undefined
  }))
}

/**
 * 整条用例的结论：有一条没验证的就算未验证；每条都有出处且至少一条验过才算已验证。
 * 有断言说不清出处（老用例、手写用例）就不敢说已验证，返回 null 不打标签。
 */
export function assertionVerdict(raw?: string | null): 'verified' | 'unverified' | null {
  const lines = assertionLines(raw)
  if (lines.some((l) => l.source && ASSERTION_SOURCE_META[l.source].verified === false)) return 'unverified'
  if (!lines.length || lines.some((l) => !l.source)) return null
  return lines.some((l) => ASSERTION_SOURCE_META[l.source!].verified) ? 'verified' : null
}
