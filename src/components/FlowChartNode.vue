<template>
  <div class="fc-block" :class="{ dimmed }">
    <template v-if="step.keywordCode === 'WAIT_ANY'">
      <div class="wa-block" :title="tooltip">
        <div class="diamond-wrap">
          <div class="diamond race">
            <div class="diamond-inner">
              <div class="no">{{ pathNo }}</div>
              <div class="code">谁先出现?</div>
              <div class="code-sub">{{ waitAnyCands.length }} 个候选</div>
              <div class="meta">最多等 {{ step.params?.timeoutSec || 20 }}s</div>
            </div>
          </div>
        </div>

        <div class="wa-arms">
          <div
            v-for="(c, ci) in waitAnyCands"
            :key="'wa-' + ci"
            class="arm then"
          >
            <div class="edge-label then">{{ c.label || c.elementKey || `候选${ci + 1}` }}</div>
            <div class="pipe then" />
            <div class="branch-panel then">
              <template v-if="(c.steps || []).length">
                <FlowChartNode
                  v-for="(cs, si) in c.steps"
                  :key="`wa-${ci}-${si}`"
                  :step="cs"
                  :path-no="`${pathNo}.c${ci + 1}.${si + 1}`"
                  :is-last="si === (c.steps || []).length - 1"
                  branch-tone="then"
                  nested
                />
              </template>
              <div v-else class="node-ghost">命中后无步骤</div>
            </div>
          </div>

          <div class="arm else">
            <div class="edge-label else">都没出现</div>
            <div class="pipe else" />
            <div class="branch-panel else">
              <template v-if="(step.params?.noneSteps || []).length">
                <FlowChartNode
                  v-for="(cs, si) in step.params.noneSteps"
                  :key="'wa-n-' + si"
                  :step="cs"
                  :path-no="`${pathNo}.n${si + 1}`"
                  :is-last="si === step.params.noneSteps.length - 1"
                  branch-tone="else"
                  nested
                />
              </template>
              <template v-else-if="noneMessage">
                <div class="node-card" :class="outcomeTone(noneOutcome)">
                  <div class="no">{{ pathNo }}.n</div>
                  <div class="code">返回提示</div>
                  <div class="return-msg">「{{ noneMessage }}」</div>
                </div>
                <div class="pipe else" />
                <div
                  class="node-oval"
                  :class="outcomeTone(noneOutcome) === 'fail' ? 'stop' : outcomeTone(noneOutcome)"
                >
                  <span>{{ outcomeMark(noneOutcome) }}</span>
                  <span>{{ END_OUTCOME_LABEL[noneOutcome] }}</span>
                </div>
              </template>
              <div v-else class="node-ghost">超时即失败</div>
            </div>
          </div>
        </div>

        <div v-if="!isLast" class="node-join">
          <div class="join-title">汇合 → {{ continueLabel || '后续步骤' }}</div>
          <div class="join-body">命中任一候选并跑完其步骤后继续</div>
        </div>
      </div>
    </template>

    <template v-else-if="step.keywordCode === 'IF_ELEMENT_EXISTS'">
      <div class="if-block" :title="tooltip">
        <div class="diamond-wrap">
          <div class="diamond">
            <div class="diamond-inner">
              <div class="no">{{ pathNo }}</div>
              <div class="code">元素是否存在?</div>
              <div class="code-sub">{{ step.elementKey || '未选元素' }}</div>
              <div v-if="waitHint" class="meta">{{ waitHint }}</div>
            </div>
          </div>
        </div>

        <!-- 分叉一整笔：菱形底 → 横梁 → 左右列中心 -->
        <svg class="split-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="0" x2="50" y2="18" class="ink muted" />
          <line x1="25" y1="18" x2="75" y2="18" class="ink muted" />
          <line x1="25" y1="18" x2="25" y2="40" class="ink then" />
          <line x1="75" y1="18" x2="75" y2="40" class="ink else" />
        </svg>

        <div class="y-row">
          <div class="arm then">
            <div class="edge-label then">存在 √</div>
            <div class="pipe then" />
            <div class="branch-panel then">
              <template v-if="thenSteps.length">
                <FlowChartNode
                  v-for="(cs, ci) in thenSteps"
                  :key="'t-' + ci"
                  :step="cs"
                  :path-no="`${pathNo}.${ci + 1}`"
                  :is-last="ci === thenSteps.length - 1"
                  branch-tone="then"
                  nested
                />
              </template>
              <div v-else class="node-ghost">无子步骤</div>
            </div>
            <div class="pipe then" />
            <div class="branch-foot" :class="thenContinues ? 'go' : 'stop'">
              {{ thenContinues ? '继续下一步' : '本支结束' }}
            </div>
            <!-- 需要接到汇合/END 时用弹性竖线填满剩余高度，避免断档 -->
            <div v-if="thenLinkDown" class="pipe then grow" />
            <div v-else class="grow-spacer" />
          </div>

          <div class="arm else">
            <div class="edge-label else">不存在 ×</div>
            <div class="pipe else" />
            <div class="branch-panel else">
              <template v-if="elseSteps.length">
                <FlowChartNode
                  v-for="(cs, ci) in elseSteps"
                  :key="'e-' + ci"
                  :step="cs"
                  :path-no="`${pathNo}.e${ci + 1}`"
                  :is-last="ci === elseSteps.length - 1"
                  branch-tone="else"
                  nested
                />
              </template>
              <template v-else-if="elseMessage">
                <div class="node-card" :class="outcomeTone(elseOutcome)">
                  <div class="no">{{ pathNo }}.e</div>
                  <div class="code">返回提示</div>
                  <div class="return-msg">「{{ elseMessage }}」</div>
                </div>
                <div class="pipe else" />
                <div
                  class="node-oval"
                  :class="outcomeTone(elseOutcome) === 'fail' ? 'stop' : outcomeTone(elseOutcome)"
                >
                  <span>{{ outcomeMark(elseOutcome) }}</span>
                  <span>{{ END_OUTCOME_LABEL[elseOutcome] }}</span>
                </div>
              </template>
              <div v-else class="node-ghost">无子步骤</div>
            </div>
            <div class="pipe else" />
            <div class="branch-foot" :class="elseContinues ? 'go' : 'stop'">
              {{ elseContinues ? '继续下一步' : `本支结束 · ${END_OUTCOME_LABEL[elseOutcome]}` }}
            </div>
            <div v-if="elseLinkDown" class="pipe else grow" />
            <div v-else class="grow-spacer" />
          </div>
        </div>

        <!-- 汇合横梁+中干（竖段已由两侧 grow pipe 接到此处） -->
        <template v-if="showMergeJoin">
          <svg class="merge-svg" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
            <line
              v-if="thenLinkDown && elseLinkDown"
              x1="25" y1="0" x2="75" y2="0"
              class="ink join"
            />
            <line
              v-else-if="thenLinkDown"
              x1="25" y1="0" x2="50" y2="0"
              class="ink join"
            />
            <line
              v-else
              x1="50" y1="0" x2="75" y2="0"
              class="ink join"
            />
            <line x1="50" y1="0" x2="50" y2="24" class="ink join" />
          </svg>
          <div v-if="!isLast" class="node-join">
            <div class="join-title">汇合 → {{ continueLabel || '后续步骤' }}</div>
            <div class="join-body">只有「继续下一步」的分支会到这里</div>
          </div>
        </template>
        <div v-else-if="!isLast" class="node-join dead">
          <div class="join-title">{{ continueLabel || '后续步骤' }} 跑不到</div>
          <div class="join-body">两支都会提前结束</div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="node-card"
        :class="[
          isReturn
            ? returnTone
            : branchTone === 'then'
              ? 'then'
              : branchTone === 'else'
                ? 'else'
                : 'action'
        ]"
        :title="tooltip"
      >
        <div class="no">{{ pathNo }}</div>
        <div class="code">{{ actionTitle }}</div>
        <div class="code-sub">
          {{ step.keywordCode }}{{ step.elementKey ? ` · ${step.elementKey}` : '' }}
        </div>
        <div v-if="desc" class="desc">{{ desc }}</div>
        <div v-if="waitHint" class="meta">{{ waitHint }}</div>
        <div v-if="inputHint" class="meta">{{ inputHint }}</div>
        <div v-if="returnMsg" class="return-msg">「{{ returnMsg }}」</div>
      </div>
      <template v-if="isReturn">
        <div class="pipe" :class="isReturnFail ? 'else' : 'then'" />
        <div class="node-oval" :class="returnTone === 'fail' ? 'stop' : returnTone">
          <span>{{ outcomeMark(returnOutcome) }}</span>
          <span>{{ END_OUTCOME_LABEL[returnOutcome] }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  END_OUTCOME_LABEL,
  branchContinues,
  endOutcomeOf,
  isFinishStep,
  stepEndOutcome,
  type EndOutcome,
  type FlowChartStep
} from '@/utils/flowChartAnalyze'

defineOptions({ name: 'FlowChartNode' })

const props = defineProps<{
  step: FlowChartStep
  pathNo: string
  isLast?: boolean
  continueLabel?: string
  dimmed?: boolean
  branchTone?: 'then' | 'else' | ''
  /** 嵌套在 IF 分支内 */
  nested?: boolean
}>()

/**
 * 流程图节点标题。关键字已按平台合并，*_IOS 仅为存量流程的兼容显示。
 */
const ACTION_TITLE: Record<string, string> = {
  LAUNCH_APP: '启动应用',
  COLD_START: '冷启动',
  HOT_START: '热启动',
  CLICK: '点击',
  INPUT: '输入',
  INPUT_EDITTEXT: 'EditText输入',
  EDITTEXT: 'EditText输入',
  CLEAR: '清空',
  WAIT: '固定延迟',
  WAIT_ELEMENT: '等待元素',
  RETURN_MESSAGE: '返回提示',
  SWIPE: '滑动',
  SCROLL_UNTIL: '滑到元素',
  SCREENSHOT: '截图',
  BACK: '返回',
  UNINSTALL_APP: '卸载应用',
  INSTALL_APP: '安装应用',
  INSTALL_FROM_STORE: '安装应用',
  ASSERT_TEXT: '断言文案',
  ASSERT_NO_ERROR: '断言无错误提示',
  CALL_COMPONENT: '调用组件',
  DISMISS_POPUPS: '清理已知弹窗',
  FINISH_SUCCESS: '成功结束',
  FINISH_FAILED: '失败结束',
  FINISH_SKIPPED: '跳过结束',
  WAIT_ANY: '竞速等待',
  // —— 存量流程里的旧 code，执行时按别名归一，这里只负责显示 ——
  LAUNCH_APP_IOS: '启动应用',
  COLD_START_IOS: '冷启动',
  HOT_START_IOS: '热启动',
  SWIPE_IOS: '滑动',
  SCROLL_UNTIL_IOS: '滑到元素',
  SCROLL_UNTIL_SHORT: '小幅滑到'
}

const desc = computed(() => (props.step.description || '').trim())
const actionTitle = computed(
  () => ACTION_TITLE[props.step.keywordCode] || props.step.keywordCode
)

const thenSteps = computed<FlowChartStep[]>(() =>
  Array.isArray(props.step.params?.thenSteps) ? props.step.params.thenSteps : []
)
const elseSteps = computed<FlowChartStep[]>(() =>
  Array.isArray(props.step.params?.elseSteps) ? props.step.params.elseSteps : []
)
const elseMessage = computed(() => String(props.step.params?.elseMessage || '').trim())

const thenContinues = computed(() => branchContinues(thenSteps.value))
const elseContinues = computed(() => branchContinues(elseSteps.value, elseMessage.value))

/** 接到汇合或流程 END */
const thenLinkDown = computed(() => !!(props.isLast || thenContinues.value))
const elseLinkDown = computed(() => !!(props.isLast || elseContinues.value))
const showMergeJoin = computed(() => thenLinkDown.value || elseLinkDown.value)

const waitHint = computed(() => {
  const p = props.step.params || {}
  const parts: string[] = []
  if (props.step.keywordCode === 'CLICK' && p.waitAfterMs != null && Number(p.waitAfterMs) >= 0) {
    parts.push(`点击后等 ${p.waitAfterMs}ms`)
  }
  if (
    (props.step.keywordCode === 'CLICK' || props.step.keywordCode === 'CLICK_WHEN_ENABLED')
    && (Number(p.offsetXPercent) !== 50 || Number(p.offsetYPercent) !== 50)
    && (p.offsetXPercent != null || p.offsetYPercent != null)
  ) {
    const x = p.offsetXPercent != null ? p.offsetXPercent : 50
    const y = p.offsetYPercent != null ? p.offsetYPercent : 50
    parts.push(`点位置 ${x}%,${y}%`)
  }
  if (props.step.keywordCode === 'CLICK_WHEN_ENABLED' && p.timeoutSec != null) {
    parts.push(`等可点 ${p.timeoutSec}s`)
  }
  if (props.step.keywordCode === 'WAIT' && p.durationMs != null) {
    parts.push(`延迟 ${p.durationMs}ms`)
  }
  if (
    (props.step.keywordCode === 'WAIT_ELEMENT' || props.step.keywordCode === 'IF_ELEMENT_EXISTS') &&
    p.timeoutSec != null
  ) {
    parts.push(`timeout ${p.timeoutSec}s`)
  }
  return parts.join(' · ')
})

const inputHint = computed(() => {
  const code = String(props.step.keywordCode || '').toUpperCase()
  if (code !== 'INPUT' && code !== 'INPUT_EDITTEXT' && code !== 'EDITTEXT') return ''
  const t = String(props.step.params?.text || '').trim()
  return t ? `内容「${t.slice(0, 36)}」` : ''
})

const isReturn = computed(
  () => props.step.keywordCode === 'RETURN_MESSAGE' || isFinishStep(props.step.keywordCode)
)
const returnMsg = computed(() =>
  isReturn.value ? String(props.step.params?.message || '').trim() : ''
)
/**
 * 结束判定直接读步骤上的 endStatus，不再从提示文案里猜。
 * 以前靠 /失败|不存在|异常/ 这类正则推断，写「侧栏没打开」就猜不中。
 */
const returnOutcome = computed<EndOutcome>(() => stepEndOutcome(props.step))
const isReturnFail = computed(() => isReturn.value && returnOutcome.value === 'FAIL')

/** 判定 → 卡片/终点样式：失败红、通过绿、跳过琥珀 */
function outcomeTone(outcome: EndOutcome) {
  return outcome === 'FAIL' ? 'fail' : outcome === 'SKIP' ? 'skip' : 'ok'
}
function outcomeMark(outcome: EndOutcome) {
  return outcome === 'FAIL' ? '■' : outcome === 'SKIP' ? '◐' : '●'
}

const returnTone = computed(() => outcomeTone(returnOutcome.value))
/** IF 走「返回提示」结束时的判定（有 elseSteps 时走不到） */
const elseOutcome = computed<EndOutcome>(() => endOutcomeOf(props.step.params))

/** 竞速等待：候选列表与「都没出现」时的判定 */
const waitAnyCands = computed(() =>
  Array.isArray(props.step.params?.candidates) ? props.step.params.candidates : []
)
const noneMessage = computed(() => String(props.step.params?.noneMessage || '').trim())
const noneOutcome = computed<EndOutcome>(() => endOutcomeOf(props.step.params))

const tooltip = computed(() => {
  const bits = [props.pathNo, props.step.keywordCode, props.step.elementKey, desc.value]
  return bits.filter(Boolean).join(' · ')
})
</script>

<style scoped>
.fc-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.fc-block.dimmed {
  pointer-events: none;
}

.if-block {
  width: min(100%, 1080px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.diamond-wrap {
  width: 210px;
  height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: -8px;
  position: relative;
  z-index: 2;
}
.diamond {
  width: 142px;
  height: 142px;
  transform: rotate(45deg);
  background: linear-gradient(135deg, var(--el-color-warning-light-3) 0%, var(--el-color-warning) 100%);
  border: 2px solid var(--el-color-warning-light-5);
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}
.diamond-inner {
  transform: rotate(-45deg);
  width: 168px;
  text-align: center;
  color: var(--el-text-color-primary);
}
.diamond-inner .no {
  color: var(--el-color-warning-dark-2);
  font-size: 11px;
  font-weight: 800;
}
.diamond-inner .code {
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
}
.diamond-inner .code-sub,
.diamond-inner .meta {
  margin-top: 3px;
  color: #78350f;
  font-size: 11px;
  word-break: break-all;
}

.split-svg,
.merge-svg {
  width: 100%;
  display: block;
  overflow: visible;
}
.split-svg {
  height: 52px;
}
.merge-svg {
  height: 28px;
  /* 压住两侧 grow pipe 底端，横梁与竖线相接 */
  margin-top: -2px;
}

.ink {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: butt;
  vector-effect: non-scaling-stroke;
}
.ink.muted {
  stroke: #94a3b8;
}
.ink.then {
  stroke: var(--el-color-success);
}
.ink.else {
  stroke: var(--el-color-danger);
}
.ink.join {
  stroke: #38bdf8;
}

.y-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  align-items: stretch;
}
.arm {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 0 12px;
  min-height: 100%;
}

.pipe {
  width: 3px;
  height: 12px;
  flex: none;
  border-radius: 1px;
}
.pipe.then {
  background: var(--el-color-success);
}
.pipe.else {
  background: var(--el-color-danger);
}
.pipe.grow {
  flex: 1 1 auto;
  height: auto;
  min-height: 16px;
  width: 3px;
}
.grow-spacer {
  flex: 1 1 auto;
  min-height: 16px;
  width: 3px;
  visibility: hidden;
}

.edge-label {
  font-size: 12px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 999px;
  margin: 0;
  flex: none;
}
.edge-label.then {
  color: var(--el-color-success-light-5);
  background: rgba(34, 197, 94, 0.16);
  border: 1px solid rgba(34, 197, 94, 0.4);
}
.edge-label.else {
  color: var(--el-color-danger-light-5);
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.branch-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.92);
  flex: none;
}
.branch-panel.then {
  border-color: rgba(34, 197, 94, 0.45);
}
.branch-panel.else {
  border-color: rgba(239, 68, 68, 0.45);
}

.branch-foot {
  width: 100%;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 8px;
  border-radius: 8px;
  flex: none;
}
.branch-foot.go {
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.12);
}
.branch-foot.stop {
  color: var(--el-color-danger-light-5);
  background: rgba(239, 68, 68, 0.12);
}

.node-ghost {
  min-width: 130px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed #64748b;
  color: var(--el-text-color-disabled);
  font-size: 12px;
  text-align: center;
}

.node-card {
  min-width: 200px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: 10px;
  text-align: center;
  color: #fff;
  border: 1px solid transparent;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
}
.node-card.action {
  background: linear-gradient(180deg, var(--el-color-primary-light-3) 0%, var(--el-color-primary) 100%);
  border-color: var(--el-color-primary-light-3);
}
.node-card.then {
  background: linear-gradient(180deg, var(--el-color-success-light-3) 0%, var(--el-color-success) 100%);
  border-color: #4ade80;
}
.node-card.else {
  background: linear-gradient(180deg, var(--el-color-danger-light-3) 0%, var(--el-color-danger) 100%);
  border-color: var(--el-color-danger-light-5);
}
.node-card.ok {
  background: linear-gradient(180deg, var(--el-color-success) 0%, var(--el-color-success-dark-2) 100%);
}
.node-card.fail {
  background: linear-gradient(180deg, var(--el-color-danger-light-3) 0%, var(--el-color-danger) 100%);
}
/* 判跳过：既不算过也不算挂，用琥珀与红绿区分开 */
.diamond.race {
  background: linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%);
  border-color: #c4b5fd;
}
.wa-arms {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}
.node-card.skip {
  background: linear-gradient(180deg, var(--el-color-warning) 0%, var(--el-color-warning-dark-2) 100%);
}
.node-card .no {
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 800;
}
.node-card .code {
  font-size: 14px;
  font-weight: 800;
}
.node-card .code-sub,
.node-card .meta,
.node-card .desc,
.node-card .return-msg {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
}
.node-card .desc {
  font-size: 12px;
  font-weight: 600;
}

.node-oval {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 110px;
  justify-content: center;
  padding: 10px 20px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 12px;
  color: #fff;
  flex: none;
}
.node-oval.stop {
  background: linear-gradient(180deg, var(--el-color-danger) 0%, var(--el-color-danger-dark-2) 100%);
}
.node-oval.ok {
  background: linear-gradient(180deg, var(--el-color-success) 0%, var(--el-color-success-dark-2) 100%);
}
.node-oval.skip {
  background: linear-gradient(180deg, var(--el-color-warning) 0%, var(--el-color-warning-dark-2) 100%);
}

.node-join {
  min-width: 250px;
  max-width: 420px;
  padding: 10px 14px;
  border-radius: 10px;
  text-align: center;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #e0f2fe;
  margin-top: 0;
}
.node-join.dead {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.4);
  color: var(--el-color-danger-light-7);
  margin-top: 10px;
}
.join-title {
  font-size: 13px;
  font-weight: 700;
}
.join-body {
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.85;
}

.no {
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 2px;
  font-variant-numeric: tabular-nums;
}
</style>
