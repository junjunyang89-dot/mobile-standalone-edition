<template>
  <el-dialog
    :model-value="modelValue"
    title="流程图"
    width="1280px"
    top="3vh"
    append-to-body
    destroy-on-close
    class="flow-chart-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="issues.length" class="issue-panel">
      <div class="issue-title">可能的问题（{{ issues.length }}）</div>
      <ul>
        <li v-for="(iss, idx) in issues" :key="idx" :class="iss.level">
          <strong>{{ iss.stepNo }}</strong> · {{ iss.message }}
        </li>
      </ul>
    </div>
    <div v-else-if="steps.length" class="issue-panel ok">
      <div class="issue-title">未发现明显「提前结束导致后面跑不到」类问题</div>
    </div>

    <div v-if="!steps.length" class="empty">暂无步骤</div>
    <div v-else class="flow-chart-scroll">
      <aside class="legend-box">
        <div class="legend-panel">
          <div class="legend-title">图例</div>
          <div class="legend-row">
            <span class="lg-diamond" />
            <span>条件判断 IF</span>
          </div>
          <div class="legend-row">
            <span class="lg-diamond race" />
            <span>竞速等待 WAIT_ANY（谁先出现走谁）</span>
          </div>
          <div class="legend-row">
            <span class="lg-rect action" />
            <span>操作步骤</span>
          </div>
          <div class="legend-row">
            <span class="lg-rect then" />
            <span>存在 / then 分支</span>
          </div>
          <div class="legend-row">
            <span class="lg-rect else" />
            <span>不存在 / else 分支</span>
          </div>
          <div class="legend-row">
            <span class="lg-line then" />
            <span>存在 √ 路径</span>
          </div>
          <div class="legend-row">
            <span class="lg-line else" />
            <span>不存在 × 路径</span>
          </div>
          <div class="legend-row">
            <span class="lg-oval stop" />
            <span>流程提前结束</span>
          </div>

          <div class="legend-title sub">结束判定</div>
          <p class="legend-note">
            流程没跑完就提前结束时，这一次算通过还是失败。由「成功结束 / 失败结束 / 跳过结束」三个关键字直接决定。
          </p>
          <div class="legend-row">
            <span class="lg-rect fail" />
            <span><b>■ 判失败</b> — 必现页面没出现（默认）</span>
          </div>
          <div class="legend-row">
            <span class="lg-rect ok" />
            <span><b>● 判通过</b> — 可选弹窗不出现很正常</span>
          </div>
          <div class="legend-row">
            <span class="lg-rect skip" />
            <span><b>◐ 判跳过</b> — 本次不适用，不计入通过率</span>
          </div>
        </div>
      </aside>

      <div class="flow-chart">
        <div class="node-oval start">
          <span class="oval-icon">▶</span>
          <span>开始 START</span>
        </div>
        <div class="connector main" />

        <template v-for="(item, i) in renderItems" :key="'r-' + i">
          <div class="chart-step" :class="{ unreachable: !item.reachable }">
            <div v-if="!item.reachable" class="unreachable-banner">⚠ 实际执行不到</div>
            <FlowChartNode
              :step="item.step"
              :path-no="item.pathNo"
              :is-last="item.isLast"
              :continue-label="item.continueLabel"
              :dimmed="!item.reachable"
            />
          </div>
          <div
            v-if="!item.isLast"
            class="connector main"
            :class="{ muted: !item.reachable || !renderItems[i + 1]?.reachable }"
          />
        </template>

        <!-- 最后一步已是 RETURN 时不再重复画 END；IF 收尾由节点内汇合线接到此处 -->
        <template v-if="showChartEnd">
          <div class="connector main" />
          <div class="node-oval end">
            <span>结束 END</span>
          </div>
        </template>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FlowChartNode from './FlowChartNode.vue'
import { analyzeFlowChart, pathAlwaysReturns, type FlowChartStep } from '@/utils/flowChartAnalyze'

const props = defineProps<{
  modelValue: boolean
  steps: FlowChartStep[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const analyzed = computed(() => analyzeFlowChart(props.steps || []))
const renderItems = computed(() => analyzed.value.items)
const issues = computed(() => analyzed.value.issues)

/** 末步是单独 RETURN 时图上已有 STOP，不再挂悬空 END；其余情况（含 IF 两支结束）保留 END 并靠汇合线接上 */
const showChartEnd = computed(() => {
  const list = props.steps || []
  if (!list.length) return false
  const last = list[list.length - 1]
  if (last?.keywordCode === 'RETURN_MESSAGE') return false
  // 非 IF 且整段必定 RETURN：通常末步已画终止，仍显示 END 会悬空
  if (last?.keywordCode !== 'IF_ELEMENT_EXISTS' && pathAlwaysReturns(list)) return false
  return true
})
</script>

<style scoped>
.issue-panel {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7e6;
  border: 1px solid #ffe1a6;
}
.issue-panel.ok {
  background: #f0f9eb;
  border-color: #c2e7b0;
}
.issue-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--app-text);
}
.issue-panel ul {
  margin: 0;
  padding-left: 18px;
}
.issue-panel li {
  font-size: 12px;
  line-height: 1.55;
  margin-bottom: 4px;
  color: var(--app-text-secondary);
}
.issue-panel li.error {
  color: #c45656;
}
.issue-panel li.warn {
  color: #b88230;
}
.empty {
  padding: 40px;
  text-align: center;
  color: #c0c4cc;
}
.flow-chart-scroll {
  position: relative;
  max-height: 64vh;
  overflow: auto;
  padding: 12px 16px 40px;
  background: #0f1419;
  border-radius: 10px;
  border: 1px solid #1f2933;
}
.flow-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 960px;
  /* 给右上角图例留空，避免节点被挡住；不额外加顶距 */
  padding: 0 280px 0 0;
  margin: 0;
}
.flow-chart > .node-oval.start {
  /* 开始上方不允许出现多余连线 */
  margin-top: 0;
}
.chart-step {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.chart-step.unreachable {
  opacity: 0.4;
  filter: grayscale(0.4);
}
.unreachable-banner {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  padding: 4px 12px;
  border-radius: 999px;
}
.node-oval {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;
  padding: 12px 28px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.node-oval.start {
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
}
.node-oval.end {
  background: linear-gradient(180deg, #64748b 0%, #475569 100%);
}
.oval-icon {
  font-size: 11px;
}
.connector {
  width: 2px;
  height: 22px;
  background: #64748b;
}
.connector.main {
  background: #38bdf8;
  width: 3px;
  height: 24px;
}
.connector.muted {
  background: #334155;
}

.legend-box {
  /* sticky 零高度锚点：不挤占下方流程图，仍贴在滚动区右上角 */
  position: sticky;
  top: 12px;
  float: right;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  z-index: 20;
  overflow: visible;
}
.legend-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 248px;
  max-width: min(248px, calc(100vw - 80px));
  padding: 12px 12px 10px;
  border-radius: 10px;
  background: rgba(15, 20, 25, 0.94);
  border: 1px solid #334155;
  color: #cbd5e1;
  font-size: 12px;
  backdrop-filter: blur(6px);
  box-sizing: border-box;
}
.legend-title.sub {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #334155;
}
.legend-note {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.55;
  color: #94a3b8;
  white-space: normal;
  word-break: break-word;
}
.legend-title {
  font-weight: 700;
  margin-bottom: 8px;
  color: #e2e8f0;
}
.legend-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 7px;
}
.legend-row > span:last-child {
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}
.lg-diamond {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  background: #fbbf24;
  transform: rotate(45deg);
  border: 1px solid #f59e0b;
  flex: none;
}
.lg-diamond.race {
  background: #a78bfa;
  border-color: #7c3aed;
}
.lg-rect {
  width: 22px;
  height: 12px;
  margin-top: 3px;
  border-radius: 3px;
  flex: none;
}
.lg-rect.action {
  background: #3b82f6;
}
.lg-rect.then {
  background: #22c55e;
}
.lg-rect.else {
  background: #ef4444;
}
.lg-rect.fail {
  background: linear-gradient(180deg, #f87171 0%, #dc2626 100%);
}
.lg-rect.ok {
  background: linear-gradient(180deg, #22c55e 0%, #15803d 100%);
}
.lg-rect.skip {
  background: linear-gradient(180deg, #fbbf24 0%, #d97706 100%);
}
.lg-line {
  width: 22px;
  height: 3px;
  margin-top: 7px;
  border-radius: 2px;
  flex: none;
}
.lg-line.then {
  background: #22c55e;
}
.lg-line.else {
  background: #ef4444;
}
.lg-oval {
  width: 22px;
  height: 12px;
  margin-top: 3px;
  border-radius: 999px;
  flex: none;
}
.lg-oval.stop {
  background: #ef4444;
}
</style>

<style>
.flow-chart-dialog.el-dialog,
.flow-chart-dialog .el-dialog__header,
.flow-chart-dialog .el-dialog__headerbtn {
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
}
</style>
