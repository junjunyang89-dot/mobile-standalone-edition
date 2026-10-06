/**
 * 对比报告里一个接口的字段变化 → 统一的差异行。
 * 报告里入参（params）、请求体字段（bodyFields）、返回字段（fields）是三种结构，界面只认这一种。
 */

export type DiffSide = 'REQUEST' | 'RESPONSE'
export type DiffKind = 'ADDED' | 'REMOVED' | 'MODIFIED'

export interface DiffRow {
  key: string
  side: DiffSide
  /** QUERY / PATH / BODY / HEADER / RESPONSE */
  location: string
  name: string
  /** 完整字段树里的路径，如 heroLine[].heroId；顶层字段就是 name */
  treePath: string
  comment?: string
  kind: DiffKind
  changeType: string
  oldType?: string
  newType?: string
  /** 入参才有：现在是否必填 */
  required?: boolean
  wireEffect?: string
  wireNote?: string
  /** 老客户端可能挂：删字段、改了 JSON 形状、新增必填入参 */
  breaking: boolean
}

export const LOCATION_LABEL: Record<string, string> = {
  QUERY: 'Query',
  PATH: 'Path',
  BODY: 'Body',
  HEADER: 'Header',
  RESPONSE: 'Response'
}

export const KIND_META: Record<DiffKind, { label: string; tone: string; icon: string }> = {
  ADDED: { label: '新增', tone: 'added', icon: '+' },
  MODIFIED: { label: '变更', tone: 'modified', icon: '~' },
  REMOVED: { label: '删除', tone: 'removed', icon: '−' }
}

export const WIRE_LABEL: Record<string, string> = {
  SAME: 'JSON 无变化',
  WIDENING: '范围放宽',
  NULLABILITY: '可能为 null',
  SHAPE: 'JSON 形状变了',
  UNKNOWN: '影响未知'
}

function kindOf(changeType: string): DiffKind {
  if (changeType === 'ADDED') return 'ADDED'
  if (changeType === 'REMOVED') return 'REMOVED'
  return 'MODIFIED'
}

function shapeBreaking(changeType: string, wireEffect?: string) {
  if (changeType === 'REMOVED') return true
  if (changeType !== 'TYPE_CHANGED') return false
  return !wireEffect || wireEffect === 'SHAPE' || wireEffect === 'UNKNOWN'
}

function treePathOf(name: string, tree: any[] | undefined) {
  const hit = (tree || []).find((n: any) => n?.name === name && n?.changeType)
  return hit?.path || name
}

export function requestRows(e: any): DiffRow[] {
  if (!e) return []
  const rows: DiffRow[] = []
  for (const p of e.params || []) {
    const required = !!p.required
    rows.push({
      key: `REQUEST|${p.source || ''}|${p.name}`,
      side: 'REQUEST',
      location: p.source || 'QUERY',
      name: p.name,
      treePath: p.name,
      kind: kindOf(p.changeType),
      changeType: p.changeType,
      oldType: p.oldType || undefined,
      newType: p.newType || undefined,
      required,
      wireEffect: p.wireEffect || undefined,
      wireNote: p.wireNote || undefined,
      breaking:
        (p.changeType === 'ADDED' && required) ||
        (p.changeType === 'REQUIRED_CHANGED' && required) ||
        shapeBreaking(p.changeType, p.wireEffect)
    })
  }
  for (const f of e.bodyFields || []) {
    rows.push({
      key: `REQUEST|BODY|${f.name}`,
      side: 'REQUEST',
      location: 'BODY',
      name: f.name,
      treePath: treePathOf(f.name, e.requestFields),
      comment: f.comment || undefined,
      kind: kindOf(f.changeType),
      changeType: f.changeType,
      oldType: f.oldType || undefined,
      newType: f.newType || undefined,
      wireEffect: f.wireEffect || undefined,
      wireNote: f.wireNote || undefined,
      breaking: shapeBreaking(f.changeType, f.wireEffect)
    })
  }
  return rows
}

/** @param tree 完整返回字段树；孤立 DTO 没有 */
export function responseRows(fields: any[] | undefined, tree?: any[]): DiffRow[] {
  return (fields || []).map((f: any) => ({
    key: `RESPONSE|${f.name}`,
    side: 'RESPONSE' as const,
    location: 'RESPONSE',
    name: f.name,
    treePath: treePathOf(f.name, tree),
    comment: f.comment || undefined,
    kind: kindOf(f.changeType),
    changeType: f.changeType,
    oldType: f.oldType || undefined,
    newType: f.newType || undefined,
    wireEffect: f.wireEffect || undefined,
    wireNote: f.wireNote || undefined,
    breaking: shapeBreaking(f.changeType, f.wireEffect)
  }))
}

export function endpointRows(e: any): DiffRow[] {
  return [...requestRows(e), ...responseRows(e?.fields, e?.responseFields)]
}

export function diffStat(rows: DiffRow[]) {
  return {
    added: rows.filter((r) => r.kind === 'ADDED').length,
    modified: rows.filter((r) => r.kind === 'MODIFIED').length,
    removed: rows.filter((r) => r.kind === 'REMOVED').length,
    breaking: rows.filter((r) => r.breaking).length
  }
}

/** 接口级状态标签：新增接口 / 参数变更 / 返回值变更 / 可能不兼容 / 仅实现变更 */
export function endpointBadges(e: any): Array<{ label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }> {
  const out: Array<{ label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }> = []
  if (e?.changeType === 'ADDED' || e?.risk === 'NEW') out.push({ label: '新增接口', type: 'success' })
  if (e?.changeType === 'REMOVED') out.push({ label: '接口删除', type: 'danger' })
  if (e?.risk === 'BREAKING') out.push({ label: '可能不兼容', type: 'danger' })
  if ((e?.params?.length || 0) + (e?.bodyFields?.length || 0) > 0) out.push({ label: '参数变更', type: 'warning' })
  if (e?.fields?.length) out.push({ label: '返回值变更', type: 'primary' })
  if (!out.length && e?.changedImpls?.length) out.push({ label: '仅实现变更', type: 'info' })
  return out
}

export function methodTag(m?: string) {
  const v = String(m || '').toUpperCase()
  if (v === 'GET') return 'success'
  if (v === 'POST') return 'primary'
  if (v === 'DELETE') return 'danger'
  if (v === 'PUT' || v === 'PATCH') return 'warning'
  return 'info'
}

/** 一处变更的身份：同一分支重新分析还认得出来，变化本身变了就是另一处 */
export function changeSig(row: DiffRow, refs: string) {
  return [refs, row.changeType, row.oldType || '', row.newType || '', row.required ? 'req' : ''].join('|')
}

export function typeText(row: DiffRow) {
  if (row.changeType === 'TYPE_CHANGED') return `${row.oldType || '?'} → ${row.newType || '?'}`
  return row.newType || row.oldType || ''
}
