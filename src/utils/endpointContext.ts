import { diffStat, endpointRows } from '@/utils/fieldDiff'

/**
 * 把对比报告按接口归拢：必测优先级、并发风险、安全/设计问题、表结构变更、改了的实现文件，
 * 能挂到哪个接口上就挂上去，挂不上的才放进「没关联到接口」。
 */

export function sigOf(method?: string, path?: string) {
  return `${String(method || '').toUpperCase()} ${path || ''}`
}

const PRIORITY_ORDER = ['P0', 'P1', 'P2']

export interface EndpointCtx {
  key: string
  e: any
  must: any | null
  priority: string
  risks: any[]
  findings: any[]
  tableChanges: any[]
  others: any[]
  breaking: number
}

function className(o: any) {
  const f = String(o?.fileName || o?.file || '')
  const base = f.slice(f.lastIndexOf('/') + 1)
  return base.replace(/\.java$/, '')
}

export function linkReport(report: any) {
  const endpoints: any[] = report?.endpoints || []
  const mustBySig = new Map<string, any>()
  for (const m of report?.mustTest?.items || []) {
    if (m?.kind === 'ENDPOINT') mustBySig.set(sigOf(m.httpMethod, m.path), m)
  }
  const usedFindings = new Set<any>()
  const usedTables = new Set<any>()
  const usedOthers = new Set<any>()

  const ctxs: EndpointCtx[] = endpoints.map((e) => {
    const key = sigOf(e.httpMethod, e.path)
    const must = mustBySig.get(key) || null
    const risks = (report?.concurrencyRisks || []).filter((r: any) => sigOf(r.httpMethod, r.path) === key)
    const findings = (report?.findings || []).filter((f: any) => String(f.target || '').trim() === key)
    const tableChanges = (report?.tables || []).filter((t: any) =>
      (t.usedByEndpoints || []).some((u: string) => String(u).trim() === key)
    )
    const classes = new Set<string>([...(e.changedImpls || []), ...(e.usedServices || [])])
    const others = (report?.otherChanges || []).filter((o: any) => {
      if (o.trivial) return false
      const c = className(o)
      return !!c && (classes.has(c) || classes.has(c.replace(/Impl$/, '')))
    })
    findings.forEach((x: any) => usedFindings.add(x))
    tableChanges.forEach((x: any) => usedTables.add(x))
    others.forEach((x: any) => usedOthers.add(x))
    return {
      key,
      e,
      must,
      priority: must?.priority || 'P2',
      risks,
      findings,
      tableChanges,
      others,
      breaking: diffStat(endpointRows(e)).breaking
    }
  })

  ctxs.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))

  const unlinked = {
    tables: (report?.tables || []).filter((t: any) => !usedTables.has(t)),
    others: (report?.otherChanges || []).filter((o: any) => !o.trivial && !usedOthers.has(o)),
    findings: (report?.findings || []).filter((f: any) => !usedFindings.has(f)),
    dtos: report?.orphanDtos || [],
    /** 没实质改动的（挪位置 / 只改日志 / 已合进基线）和没人引用的返回体：只列出来，不算数 */
    trivial: (report?.otherChanges || []).filter((o: any) => !!o.trivial),
    unusedDtos: (report?.unusedDtos || []) as string[]
  }
  const unlinkedCount =
    unlinked.tables.length + unlinked.others.length + unlinked.findings.length + unlinked.dtos.length
  return { ctxs, unlinked, unlinkedCount }
}

/** 左侧和顶部共用的快捷筛选 */
export const CTX_FILTERS: Array<{ key: string; label: string; test: (c: EndpointCtx) => boolean }> = [
  { key: 'ALL', label: '全部', test: () => true },
  { key: 'P0', label: 'P0', test: (c) => c.priority === 'P0' },
  { key: 'P1', label: 'P1', test: (c) => c.priority === 'P1' },
  { key: 'BREAKING', label: '可能不兼容', test: (c) => c.breaking > 0 },
  { key: 'NEW', label: '新增接口', test: (c) => c.e?.changeType === 'ADDED' || c.e?.risk === 'NEW' },
  { key: 'PARAM', label: '参数变更', test: (c) => (c.e?.params?.length || 0) + (c.e?.bodyFields?.length || 0) > 0 },
  { key: 'RESP', label: '返回值变更', test: (c) => (c.e?.fields?.length || 0) > 0 },
  { key: 'CONC', label: '并发风险', test: (c) => c.risks.length > 0 },
  { key: 'FINDING', label: '安全/设计', test: (c) => c.findings.length > 0 },
  { key: 'TABLE', label: '动了表', test: (c) => c.tableChanges.length > 0 },
  { key: 'NOCASE', label: '没有用例', test: (c) => !(c.e?.testCases > 0) }
]
