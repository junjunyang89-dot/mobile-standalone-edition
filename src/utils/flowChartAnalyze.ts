/** 流程图调试分析：与 UiFlowExecutor 语义对齐（RETURN 提前结束；IF 两支汇合） */

export type FlowChartStep = {
  keywordCode: string
  elementKey?: string
  description?: string
  expectation?: string
  params: Record<string, any>
}

/** 流程提前结束时的判定，与后端 FlowOutcome 一致 */
export type EndOutcome = 'FAIL' | 'PASS' | 'SKIP'

export const END_OUTCOME_LABEL: Record<EndOutcome, string> = {
  FAIL: '判失败',
  PASS: '判通过',
  SKIP: '判跳过'
}

/**
 * 读取步骤的结束判定。
 * 缺省与非法值一律按 FAIL，与后端 FlowOutcome.from 保持一致——
 * 存量流程没写 endStatus，不能默认成通过。
 */
/** 判定写在关键字名上的结束关键字 */
export const FINISH_CODES: Record<string, EndOutcome> = {
  FINISH_SUCCESS: 'PASS',
  FINISH_FAILED: 'FAIL',
  FINISH_SKIPPED: 'SKIP'
}

export function isFinishStep(code?: string): boolean {
  return !!FINISH_CODES[String(code || '').toUpperCase()]
}

/** 结束类步骤的判定：新关键字看名字，旧的 RETURN_MESSAGE 才看参数 */
export function stepEndOutcome(step: FlowChartStep): EndOutcome {
  return FINISH_CODES[String(step.keywordCode || '').toUpperCase()] || endOutcomeOf(step.params)
}

export function endOutcomeOf(params: Record<string, any> | undefined): EndOutcome {
  const raw = String(params?.endStatus || '').trim().toUpperCase()
  return raw === 'PASS' || raw === 'SKIP' ? raw : 'FAIL'
}

/** IF 走「返回提示」结束时的判定（有 elseSteps 时走不到这里） */
export function ifElseOutcome(step: FlowChartStep): EndOutcome {
  return endOutcomeOf(step.params)
}

/**
 * 文案看着像「正常收尾」的返回提示。
 * <p>
 * 存量流程的返回提示没有 endStatus，默认按 FAIL 处理——但「成功登录XXX」这类
 * 其实是把返回提示当断言用（找到成功标志就收尾），应该判 PASS。
 * 只用来提醒，不改变行为：判定仍以显式配置为准。
 */
const SUCCESS_LOOKING = /成功|完成|已登录|登录态|无需|已是|正常/
const FAILURE_LOOKING = /失败|不存在|异常|未出现|没有出现|找不到|超时/

export function looksLikeSuccessMessage(msg?: string): boolean {
  const m = String(msg || '').trim()
  if (!m) return false
  return SUCCESS_LOOKING.test(m) && !FAILURE_LOOKING.test(m)
}

export type FlowIssue = {
  level: 'error' | 'warn'
  stepNo: string
  message: string
}

export type FlowRenderItem = {
  step: FlowChartStep
  pathNo: string
  reachable: boolean
  continueLabel: string
  isLast: boolean
}

/** 一段步骤是否一定会 RETURN（提前结束整条流程） */
export function pathAlwaysReturns(list: FlowChartStep[]): boolean {
  if (!list?.length) return false
  const last = list[list.length - 1]
  if (last.keywordCode === 'RETURN_MESSAGE' || isFinishStep(last.keywordCode)) return true
  if (last.keywordCode === 'WAIT_ANY') return waitAnyAlwaysReturns(last)
  if (last.keywordCode === 'IF_ELEMENT_EXISTS') {
    const t: FlowChartStep[] = Array.isArray(last.params?.thenSteps) ? last.params.thenSteps : []
    const e: FlowChartStep[] = Array.isArray(last.params?.elseSteps) ? last.params.elseSteps : []
    const msg = String(last.params?.elseMessage || '').trim()
    const thenRet = t.length ? pathAlwaysReturns(t) : false
    const elseRet = e.length ? pathAlwaysReturns(e) : !!msg
    if (!t.length && !e.length && !msg) return false
    if (!t.length) return elseRet
    if (!e.length && !msg) return thenRet
    return thenRet && elseRet
  }
  return false
}

export type WaitAnyCandidate = { elementKey?: string; label?: string; steps?: FlowChartStep[] }

export function waitAnyCandidates(step: FlowChartStep): WaitAnyCandidate[] {
  return Array.isArray(step.params?.candidates) ? step.params.candidates : []
}

/** WAIT_ANY 是否所有出口都会提前结束（含「都没出现」那一支） */
export function waitAnyAlwaysReturns(step: FlowChartStep): boolean {
  const cands = waitAnyCandidates(step)
  if (!cands.length) return false
  const everyCandReturns = cands.every((c) =>
    Array.isArray(c.steps) && c.steps.length ? pathAlwaysReturns(c.steps) : false
  )
  const noneSteps: FlowChartStep[] = Array.isArray(step.params?.noneSteps) ? step.params.noneSteps : []
  const noneMsg = String(step.params?.noneMessage || '').trim()
  const noneReturns = noneSteps.length ? pathAlwaysReturns(noneSteps) : !!noneMsg
  return everyCandReturns && noneReturns
}

export function branchContinues(steps: FlowChartStep[], elseMessage = ''): boolean {
  if (steps?.length) return !pathAlwaysReturns(steps)
  return !String(elseMessage || '').trim()
}

function waitAfterTooSmall(s: FlowChartStep): boolean {
  if (s.keywordCode !== 'CLICK') return false
  const w = Number(s.params?.waitAfterMs)
  return Number.isFinite(w) && w > 0 && w < 100
}

/** 提示「文案像成功、判定却是失败」的返回提示，帮存量流程一次改对 */
function pushOutcomeMismatch(s: FlowChartStep, no: string, out: FlowIssue[]) {
  const checks: Array<[string, string]> = []
  if (s.keywordCode === 'RETURN_MESSAGE') {
    checks.push([String(s.params?.message || ''), '返回提示（旧写法）'])
  }
  if (s.keywordCode === 'IF_ELEMENT_EXISTS') {
    checks.push([String(s.params?.elseMessage || ''), '「不存在」支的返回提示'])
  }
  if (s.keywordCode === 'WAIT_ANY') {
    checks.push([String(s.params?.noneMessage || ''), '「都没出现」的返回提示'])
  }
  for (const [msg, what] of checks) {
    if (looksLikeSuccessMessage(msg) && endOutcomeOf(s.params) === 'FAIL') {
      out.push({
        level: 'warn',
        stepNo: no,
        message: `${what}写的是「${msg}」，看起来是正常收尾，但判定是 FAIL（默认值），这次会被记成失败——若确实是成功收尾请改成 PASS`
      })
    }
  }
}

function scanBranchIssues(list: FlowChartStep[], prefix: string, fromElse: boolean, out: FlowIssue[]) {
  list.forEach((s, i) => {
    const seg = fromElse ? `e${i + 1}` : String(i + 1)
    const no = prefix ? `${prefix}.${seg}` : String(i + 1)
    if (waitAfterTooSmall(s)) {
      out.push({
        level: 'warn',
        stepNo: no,
        message: `点击后等待仅 ${s.params.waitAfterMs}ms，页面多半还没出来；若本意是秒级请改成 1000+`
      })
    }
    pushOutcomeMismatch(s, no, out)
    if (s.keywordCode === 'IF_ELEMENT_EXISTS') {
      const thenSteps: FlowChartStep[] = Array.isArray(s.params?.thenSteps) ? s.params.thenSteps : []
      const elseSteps: FlowChartStep[] = Array.isArray(s.params?.elseSteps) ? s.params.elseSteps : []
      const elseMessage = String(s.params?.elseMessage || '').trim()
      const thenC = branchContinues(thenSteps)
      const elseC = branchContinues(elseSteps, elseMessage)
      if (!thenC && elseC) {
        out.push({
          level: 'warn',
          stepNo: no,
          message: `「存在」支会 RETURN 结束；只有「不存在」才能继续后面——请确认是否写反了`
        })
      }
      if (thenC && !elseC) {
        const outcome = endOutcomeOf(s.params)
        out.push({
          level: outcome === 'FAIL' ? 'warn' : 'error',
          stepNo: no,
          message:
            outcome === 'FAIL'
              ? `「不存在」支会提前结束整流程并${END_OUTCOME_LABEL[outcome]}；若这是第二条正常路径（如二次启动无弹窗），请在「不存在时执行」里补步骤，而不是返回提示`
              : `「不存在」支提前结束且${END_OUTCOME_LABEL[outcome]}，后面步骤都跑不到却仍算过——确认这真的是可跳过的场景`
        })
      }
      if (!thenC && !elseC) {
        out.push({
          level: 'error',
          stepNo: no,
          message: `存在/不存在两支都会 RETURN，后面的步骤实际上执行不到`
        })
      }
      scanBranchIssues(thenSteps, no, false, out)
      scanBranchIssues(elseSteps, no, true, out)
    }
  })
}

/** 主线渲染项 + 可达性 + 常见问题提示 */
export function analyzeFlowChart(steps: FlowChartStep[]): { items: FlowRenderItem[]; issues: FlowIssue[] } {
  const issues: FlowIssue[] = []
  const items: FlowRenderItem[] = []
  let reachable = true

  steps.forEach((s, i) => {
    const pathNo = String(i + 1)
    const continueLabel = i < steps.length - 1 ? `步骤 ${i + 2}` : ''
    items.push({
      step: s,
      pathNo,
      reachable,
      continueLabel,
      isLast: i === steps.length - 1
    })
    if (!reachable) {
      issues.push({
        level: 'error',
        stepNo: pathNo,
        message: `前面步骤已必定 RETURN，本步实际上执行不到（请检查上方 IF/返回提示）`
      })
    } else if (s.keywordCode === 'RETURN_MESSAGE' || isFinishStep(s.keywordCode)) {
      if (i < steps.length - 1) {
        issues.push({
          level: 'error',
          stepNo: pathNo,
          message: `这里 RETURN 后整流程结束，后面的步骤 ${i + 2}… 都不会执行`
        })
      }
      reachable = false
    } else if (s.keywordCode === 'IF_ELEMENT_EXISTS') {
      const thenSteps: FlowChartStep[] = Array.isArray(s.params?.thenSteps) ? s.params.thenSteps : []
      const elseSteps: FlowChartStep[] = Array.isArray(s.params?.elseSteps) ? s.params.elseSteps : []
      const elseMessage = String(s.params?.elseMessage || '').trim()
      const thenC = branchContinues(thenSteps)
      const elseC = branchContinues(elseSteps, elseMessage)
      if (!thenC && !elseC) reachable = false
    } else if (s.keywordCode === 'DISMISS_POPUPS') {
      const list = Array.isArray(s.params?.popups) ? s.params.popups : []
      if (!list.length) {
        issues.push({
          level: 'error',
          stepNo: pathNo,
          message: `清理已知弹窗没有配置任何弹窗，执行时会直接报错`
        })
      }
      list.forEach((pop: any, pi: number) => {
        if (!pop?.elementKey) {
          issues.push({
            level: 'error',
            stepNo: `${pathNo}.p${pi + 1}`,
            message: `第 ${pi + 1} 项弹窗没选「关闭它的元素」，执行时会直接报错`
          })
        }
      })
    } else if (s.keywordCode === 'WAIT_ANY') {
      const cands = waitAnyCandidates(s)
      if (cands.length < 2) {
        issues.push({
          level: 'warn',
          stepNo: pathNo,
          message: cands.length
            ? `竞速等待只配了 1 个候选，等同于普通「等待元素」；多入口场景请把另一条路径也加进来`
            : `竞速等待没有候选分支，执行时会直接报错`
        })
      }
      cands.forEach((c, ci) => {
        if (!c.elementKey) {
          issues.push({
            level: 'error',
            stepNo: `${pathNo}.c${ci + 1}`,
            message: `候选「${c.label || ci + 1}」没选判定元素，执行时会直接报错`
          })
        }
        scanBranchIssues(Array.isArray(c.steps) ? c.steps : [], `${pathNo}.c${ci + 1}`, false, issues)
      })
      scanBranchIssues(
        Array.isArray(s.params?.noneSteps) ? s.params.noneSteps : [], `${pathNo}.n`, true, issues
      )
      if (waitAnyAlwaysReturns(s)) reachable = false
    }
    if (waitAfterTooSmall(s)) {
      issues.push({
        level: 'warn',
        stepNo: pathNo,
        message: `点击后等待仅 ${s.params.waitAfterMs}ms，可能不够页面切换`
      })
    }
    pushOutcomeMismatch(s, pathNo, issues)
  })

  scanBranchIssues(steps, '', false, issues)

  // 去重（同一 stepNo+message）
  const seen = new Set<string>()
  const uniq = issues.filter((x) => {
    const k = `${x.level}|${x.stepNo}|${x.message}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { items, issues: uniq }
}
