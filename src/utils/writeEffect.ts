import { createApp, h } from 'vue'
import { ElMessageBox } from 'element-plus'
import { apiClient, type ApiEndpointVo, type ApiWriteEffect } from '../api'
import ProdRunConfirm, {
  type ProdConfirmBlocked,
  type ProdConfirmCase,
  type ProdConfirmResult
} from '../components/ProdRunConfirm.vue'

/**
 * 三态三种颜色。「未知」绝不能和「只读」画成一样：判不出来的接口按会写处理，
 * 界面上一旦看着像只读，就会被人拿去线上跑。
 */
export const WRITE_EFFECT_META: Record<ApiWriteEffect, { text: string; cls: string }> = {
  WRITES: { text: '写数据', cls: 'is-writes' },
  READ_ONLY: { text: '只读', cls: 'is-readonly' },
  UNKNOWN: { text: '读写未知', cls: 'is-unknown' }
}

export function writeEffectText(e?: ApiWriteEffect | null, label?: string | null) {
  return (e && WRITE_EFFECT_META[e]?.text) || label || ''
}

export type CaseRef = {
  id: string
  name?: string
  method?: string
  path?: string
  project?: string
  endpointId?: string | null
  testOnly?: boolean
  enabled?: boolean
  durationMs?: number | null
}

export type ProdVerdict = {
  c: CaseRef
  effect: ApiWriteEffect
  reason: string
  /** 只有只读的才放行；写、未知、找不到接口一律不给跑 */
  allowed: boolean
}

const TTL = 60_000
const cache = new Map<string, { at: number; list: Promise<ApiEndpointVo[]> }>()

/** project 为空时取全部项目的接口（报告详情里不知道是哪个项目） */
function endpointsOf(project: string): Promise<ApiEndpointVo[]> {
  const hit = cache.get(project)
  if (hit && Date.now() - hit.at < TTL) return hit.list
  const list = apiClient
    .fetchApiEndpoints(project ? { project } : {})
    .then((r) => r.items || [])
    .catch(() => [] as ApiEndpointVo[])
  cache.set(project, { at: Date.now(), list })
  return list
}

export function invalidateWriteEffectCache() {
  cache.clear()
}

function pathBase(p?: string) {
  const s = String(p || '').trim()
  const q = s.indexOf('?')
  return (q >= 0 ? s.slice(0, q) : s).replace(/\/+$/, '')
}

/** /user/{steamId}/games 这种模板要能匹配用例里填了真实值的路径 */
function pathMatches(template: string, actual: string) {
  const t = pathBase(template)
  const a = pathBase(actual)
  if (t === a) return true
  if (!t.includes('{')) return false
  const re = new RegExp('^' + t.split(/\{[^}]+\}/).map((s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[^/]+') + '$')
  return re.test(a)
}

function findEndpoint(list: ApiEndpointVo[], c: CaseRef): ApiEndpointVo | undefined {
  if (c.endpointId) {
    const byId = list.find((e) => e.id === c.endpointId)
    if (byId) return byId
  }
  const m = String(c.method || 'GET').toUpperCase()
  const hits = list.filter((e) => String(e.httpMethod || '').toUpperCase() === m && pathMatches(e.path, c.path || ''))
  // 同一路径命中多个（跨项目、或模板和精确路径都中）时取最严的：有一个不是只读就不放行
  return hits.find((e) => e.writeEffect !== 'READ_ONLY') || hits[0]
}

/**
 * 线上执行前逐条判定。
 * supported=false 表示后端还没下发 writeEffect（旧版本），调用方应退回原来的确认流程，
 * 而不是把所有用例都当成「未知」全拦掉。
 */
export async function judgeProdCases(
  cases: CaseRef[],
  defaultProject?: string
): Promise<{ supported: boolean; verdicts: ProdVerdict[] }> {
  const projects = [...new Set(cases.map((c) => c.project || defaultProject || ''))]
  const lists = new Map<string, ApiEndpointVo[]>()
  await Promise.all(projects.map(async (p) => lists.set(p, await endpointsOf(p))))
  const supported = [...lists.values()].some((l) => l.some((e) => e.writeEffect !== undefined))

  const verdicts = cases.map((c): ProdVerdict => {
    if (c.testOnly) {
      return { c, effect: 'UNKNOWN', reason: '标了「只在测试环境跑」，线上会跳过', allowed: false }
    }
    const ep = findEndpoint(lists.get(c.project || defaultProject || '') || [], c)
    if (!ep) {
      return { c, effect: 'UNKNOWN', reason: '接口清单里找不到这个接口，判不出会不会改数据，按会改处理', allowed: false }
    }
    const effect: ApiWriteEffect = ep.writeEffect || 'UNKNOWN'
    return {
      c,
      effect,
      reason: ep.writeEffectReason || writeEffectText(effect, ep.writeEffectLabel),
      allowed: effect === 'READ_ONLY'
    }
  })
  return { supported, verdicts }
}

function blockedList(list: ProdVerdict[]) {
  const shown = list.slice(0, 8)
  return h('ul', { class: 'we-guard-list' }, [
    ...shown.map((v) =>
      h('li', [
        h('span', { class: ['we-guard-tag', v.c.testOnly ? 'is-unknown' : WRITE_EFFECT_META[v.effect].cls] },
          v.c.testOnly ? '仅测试' : WRITE_EFFECT_META[v.effect].text),
        h('span', { class: 'we-guard-name' }, v.c.name || `${v.c.method || ''} ${v.c.path || ''}`),
        h('div', { class: 'we-guard-reason' }, v.reason)
      ])
    ),
    list.length > shown.length ? h('li', { class: 'we-guard-more' }, `…还有 ${list.length - shown.length} 条`) : null
  ])
}

export function confirmProdRun(opts: {
  cases: ProdConfirmCase[]
  blocked?: ProdConfirmBlocked[]
  title?: string
  allowTest?: boolean
}): Promise<ProdConfirmResult> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(ProdRunConfirm, {
      ...opts,
      onDone: (v: ProdConfirmResult) => resolve(v),
      onClosed: () => {
        app.unmount()
        host.remove()
      }
    })
    app.mount(host)
  })
}

/**
 * 单条 / 小批量的线上执行入口共用：只放行只读的，其余列出来、不给跑。
 * 后端还没下发 writeEffect 时不做拦截，只走确认。
 * env=TEST 表示用户选了「先去测试环境试跑」，ids 是传入的全部用例。
 */
export async function guardProdRun(
  cases: CaseRef[],
  defaultProject?: string,
  title?: string
): Promise<{ mode: 'cancel' } | { mode: 'ok'; ids: string[]; env: 'PROD' | 'TEST' }> {
  const { supported, verdicts } = await judgeProdCases(cases, defaultProject)
  const ok = supported ? verdicts.filter((v) => v.allowed) : verdicts.filter((v) => !v.c.testOnly)
  const blocked = verdicts.filter((v) => !ok.includes(v))
  if (!ok.length) {
    try {
      await ElMessageBox.alert(
        h('div', [h('p', '这些用例不能在线上跑：只有判定为「只读」的接口才放行。'), blockedList(blocked)]),
        '线上不给跑',
        { type: 'warning', confirmButtonText: '知道了', customClass: 'we-guard-box' }
      )
    } catch {
      /* closed */
    }
    return { mode: 'cancel' }
  }
  const r = await confirmProdRun({
    cases: ok.map((v) => v.c),
    blocked: blocked.map((v) => ({
      name: v.c.name || `${v.c.method || ''} ${v.c.path || ''}`,
      tag: v.c.testOnly ? '仅测试' : WRITE_EFFECT_META[v.effect].text,
      cls: v.c.testOnly ? 'is-unknown' : WRITE_EFFECT_META[v.effect].cls,
      reason: v.reason
    })),
    title
  })
  if (r === 'prod') return { mode: 'ok', ids: ok.map((v) => v.c.id), env: 'PROD' }
  if (r === 'test') return { mode: 'ok', ids: cases.map((c) => c.id), env: 'TEST' }
  return { mode: 'cancel' }
}
