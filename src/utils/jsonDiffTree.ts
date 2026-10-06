/**
 * 字段树（requestFields / responseFields）+ 差异行 → 可折叠的 JSON 节点。
 * 字段树只有待测那一侧，删掉的字段不在里面，挂到根上；内部类的字段也算在返回体名下，
 * 按名字找回它在树里的位置，同名时优先顶层。
 */
import { requestRows, responseRows, type DiffRow } from './fieldDiff'

export interface JNode {
  id: string
  name: string
  type?: string
  comment?: string
  /** 集合：展开时画成 [ { … } ] */
  array: boolean
  children: JNode[]
  row?: DiffRow
  /** 自己加子孙里有几处变化 */
  changes: number
}

export interface JBlock {
  key: string
  loc: string
  title: string
  sub?: string
  root: JNode
  /** 整个返回体就是个列表 */
  list: boolean
  rows: DiffRow[]
}

function count(n: JNode): number {
  n.changes = (n.row ? 1 : 0) + n.children.reduce((s, c) => s + count(c), 0)
  return n.changes
}

export function buildJsonTree(tree: any[] | undefined, rows: DiffRow[]): JNode {
  const root: JNode = { id: '', name: '', array: false, children: [], changes: 0 }
  const byPath = new Map<string, JNode>()
  const all: Array<{ node: JNode; depth: number; flagged: boolean }> = []

  for (const f of tree || []) {
    const path = String(f?.path || f?.name || '')
    if (!path) continue
    const dot = path.lastIndexOf('.')
    const parent = (dot > 0 && byPath.get(path.slice(0, dot))) || root
    const node: JNode = {
      id: path,
      name: String(f.name || path.slice(dot + 1).replace(/\[\]$/, '')),
      type: f.type || undefined,
      comment: f.comment || undefined,
      array: path.endsWith('[]'),
      children: [],
      changes: 0
    }
    parent.children.push(node)
    byPath.set(path, node)
    all.push({ node, depth: Number(f.depth) || 0, flagged: !!f.changeType })
  }

  for (const r of rows) {
    let target: JNode | undefined
    if (r.kind !== 'REMOVED') {
      target = all
        .filter((a) => a.node.name === r.name && !a.node.row)
        .sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.depth - b.depth)[0]?.node
    }
    if (target) {
      target.row = r
      if (!target.comment && r.comment) target.comment = r.comment
    } else {
      root.children.push({
        id: `~${r.key}`,
        name: r.name,
        type: r.newType || r.oldType,
        comment: r.comment,
        array: false,
        children: [],
        row: r,
        changes: 0
      })
    }
  }
  count(root)
  return root
}

const REQ_LOCS: Array<{ loc: string; title: string; sub?: string }> = [
  { loc: 'PATH', title: 'Path 参数', sub: '只列出这次变了的参数' },
  { loc: 'QUERY', title: 'Query 参数', sub: '只列出这次变了的参数' },
  { loc: 'HEADER', title: 'Header', sub: '只列出这次变了的参数' },
  { loc: 'BODY', title: '请求体 Body' }
]

export function requestBlocks(e: any): JBlock[] {
  const rows = requestRows(e)
  const out: JBlock[] = []
  for (const { loc, title, sub } of REQ_LOCS) {
    const rs = rows.filter((r) => r.location === loc)
    const tree = loc === 'BODY' ? e?.requestFields || [] : []
    if (!rs.length && !tree.length) continue
    out.push({ key: `REQ-${loc}`, loc, title, sub, root: buildJsonTree(tree, rs), list: false, rows: rs })
  }
  return out
}

function isListType(t: string) {
  return /^(List|Set|Collection)</.test(t) || t.endsWith('[]')
}

export function responseBlocks(e: any): JBlock[] {
  const rows = responseRows(e?.fields, e?.responseFields)
  const tree = e?.responseFields || []
  if (!rows.length && !tree.length) return []
  const pt = String(e?.payloadType || '')
  return [
    {
      key: 'RESP',
      loc: 'RESPONSE',
      title: '返回体',
      sub: [pt, '字段相对返回体，外层包装（如 result）没画'].filter(Boolean).join(' · '),
      root: buildJsonTree(tree, rows),
      list: isListType(pt),
      rows
    }
  ]
}

/** 没连回接口的返回体：只有变化的字段，没有完整树 */
export function dtoBlocks(d: any): JBlock[] {
  const rows = responseRows(d?.fields)
  if (!rows.length) return []
  return [{ key: `DTO-${d.type}`, loc: 'RESPONSE', title: d.type, root: buildJsonTree([], rows), list: false, rows }]
}
