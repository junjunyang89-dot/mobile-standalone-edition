import { apiClient } from '../api'

export type ApiCaseKind = 'BRANCH' | 'REGRESSION' | 'UNCLASSIFIED'

/** 文案和后端 ApiCaseKind.label() 一致 */
export const CASE_KIND_META: Record<ApiCaseKind, { text: string; cls: string; hint: string }> = {
  BRANCH: {
    text: '分支用例',
    cls: 'is-branch',
    hint: '为某次提测写的。挂了＝这次改动有问题。分支合进 master 后要分诊：退役，或升级成回归用例'
  },
  REGRESSION: { text: '回归用例', cls: 'is-regression', hint: '长期守已有行为。挂了＝回归了' },
  UNCLASSIFIED: {
    text: '未分类',
    cls: 'is-unclassified',
    hint: '加这个字段之前就有的用例，执行上按回归对待，但没人确认过它该不该长期留着'
  }
}

export const CASE_KIND_OPTIONS = (Object.keys(CASE_KIND_META) as ApiCaseKind[]).map((k) => ({
  value: k,
  label: CASE_KIND_META[k].text
}))

/**
 * 行里根本没有 caseKind 这个键 → 后端还没带这个字段，返回 null（界面别显示，也别筛）。
 * 有键但值是空 / 认不出 → 未分类，和后端 ApiCaseKind.of() 的宽松解析一致。
 */
export function kindOf(row: any): ApiCaseKind | null {
  if (!row || !('caseKind' in row)) return null
  const s = String(row.caseKind ?? '').trim().toUpperCase()
  return s in CASE_KIND_META ? (s as ApiCaseKind) : 'UNCLASSIFIED'
}

export function hasCaseKind(rows: any[]) {
  return rows.some((r) => r && 'caseKind' in r)
}

export function caseKindTitle(row: any) {
  const k = kindOf(row)
  if (!k) return ''
  const branch = row.sourceBranch ? `\n来源分支：${row.sourceBranch}` : k === 'BRANCH' ? '\n没记来源分支（数据问题）' : ''
  return `${CASE_KIND_META[k].hint}${branch}`
}

type KindIndex = Map<string, { caseKind: ApiCaseKind; sourceBranch: string | null }>
let indexCache: { at: number; p: Promise<KindIndex | null> } | null = null

/**
 * 执行结果里只有 caseId，没有种类。按 id 回查用例拿种类，给报告按种类分组用。
 * 后端还没带 caseKind 时返回 null。
 */
export function loadCaseKindIndex(): Promise<KindIndex | null> {
  if (indexCache && Date.now() - indexCache.at < 60_000) return indexCache.p
  const p = apiClient
    .getApiTestCases()
    .then((list: any[]) => {
      if (!hasCaseKind(list || [])) return null
      const m: KindIndex = new Map()
      for (const c of list) m.set(String(c.id), { caseKind: kindOf(c)!, sourceBranch: c.sourceBranch || null })
      return m
    })
    .catch(() => null)
  indexCache = { at: Date.now(), p }
  return p
}

export function invalidateCaseKindIndex() {
  indexCache = null
}
