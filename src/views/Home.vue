<template>
  <div class="home">
    <!-- APP 回归（线上 + 测试环境）：周历看趋势；自动刷新；最新一批 + 当日全量汇总 -->
    <section class="panel main-panel">
      <div class="panel-head">
        <div class="panel-kicker">APP 回归</div>
        <div class="panel-head-right">
          <div v-if="dayStats.runCount > 0" class="day-summary">
            {{ selectedDayLabel }} ·
            <span class="stat-pass">通过 {{ dayStats.passedCases }}</span>
            <template v-if="dayStats.passedAndroid || dayStats.passedIos">
              （Android {{ dayStats.passedAndroid }} · iOS {{ dayStats.passedIos }}）
            </template>
            · <span class="stat-skip">跳过 {{ dayStats.skippedCases }}</span>
            ·
            <button
              v-if="dayStats.failedCases > 0"
              type="button"
              class="stat-fail-btn"
              @click="failDialogVisible = true"
            >
              失败 {{ dayStats.failedCases }}
            </button>
            <span v-else class="stat-fail-zero">失败 0</span>
            <template v-if="dayStats.stoppedRuns > 0"> · 停止 {{ dayStats.stoppedRuns }} 批</template>
          </div>
          <div v-else class="day-summary muted">{{ selectedDayLabel }}暂无执行</div>
          <el-button
            size="small"
            :loading="loading"
            @click="() => loadData({ silent: false, keepDay: true })"
          >
            刷新
          </el-button>
        </div>
      </div>
      <div v-if="lastUpdatedText" class="refresh-meta">
        {{ lastUpdatedText }} · 约每 15 秒自动刷新
      </div>

      <el-dialog
        v-model="failDialogVisible"
        :title="`${selectedDayLabel} · 失败原因（${failedFeatures.length}）`"
        width="560px"
        append-to-body
        destroy-on-close
      >
        <div v-if="!failedFeatures.length" class="fail-empty">当日暂无失败用例明细。</div>
        <div v-else class="fail-list">
          <div v-for="(f, idx) in failedFeatures" :key="`${f.featureKey || f.stepId}-${idx}`" class="fail-item">
            <div class="fail-item-head">
              <el-tag size="small" type="danger" effect="plain">失败</el-tag>
              <span class="fail-label">{{ f.label }}</span>
              <el-tag v-if="f.endpoint" size="small" type="info" effect="plain">
                {{ endpointShort(f.endpoint) }}
              </el-tag>
              <span v-if="f.deviceName" class="fail-device">{{ f.deviceName }}</span>
            </div>
            <pre class="fail-msg">{{ f.errorMessage || '未记录具体错误信息（多为设备断开/会话未建成功，可到回归详情或任务执行日志查看）' }}</pre>
          </div>
        </div>
        <template #footer>
          <el-button @click="failDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="goToRegression">去看执行记录</el-button>
        </template>
      </el-dialog>

      <div class="week-strip">
        <button
          v-for="d in weekDays"
          :key="d.date"
          type="button"
          class="week-cell"
          :class="weekCellClass(d)"
          @click="selectDay(d.date)"
        >
          <div class="week-wd">{{ d.weekday }}</div>
          <div class="week-date">{{ d.dateText }}</div>
          <div v-if="d.runCount > 0" class="week-body">
            <strong>{{ formatRate(d.passRate) }}</strong>
            <span>{{ d.runCount }} 批</span>
          </div>
          <div v-else class="week-body muted">—</div>
        </button>
      </div>

      <div class="latest-block">
        <div class="latest-head">
          <span class="latest-dot" />
          <span class="latest-title">完美世界电竞 · 最新一批</span>
          <span v-if="latestRun" class="latest-sub">仅最近一次；上方数字含当日全部批次</span>
        </div>

        <template v-if="latestRun">
          <div class="latest-info">
            <span class="latest-time">{{ latestRun.dayText || latestRun.dateText || '—' }}</span>
            <el-tag size="small" :type="runStatusTag(latestRun.status)" effect="plain">
              {{ runStatusText(latestRun.status) }}
            </el-tag>
            <el-tag size="small" type="success" effect="plain">{{ formatRate(latestRun.passRate) }}</el-tag>
            <el-tag v-if="latestRun.appsText" size="small" type="info" effect="plain">
              {{ latestRun.appsText }}
            </el-tag>
          </div>

          <div v-if="latestRun.features?.length" class="feat-row">
            <span
              v-for="f in latestRun.features"
              :key="`${latestRun.id}-${f.featureKey || f.stepId}-${f.endpoint || ''}-${f.deviceName || ''}`"
              class="feat"
              :class="[
                `is-${(f.status || '').toLowerCase()}`,
                f.endpoint ? `ep-${f.endpoint}` : '',
                (f.status || '').toLowerCase() === 'failed' ? 'is-clickable' : ''
              ]"
              :title="featureTitle(f)"
              @click="(f.status || '').toLowerCase() === 'failed' && (failDialogVisible = true)"
            >
              <i v-if="f.endpoint" class="feat-ep">{{ endpointShort(f.endpoint) }}</i>
              {{ f.label }}
              <em>{{ featureStatusText(f.status) }}</em>
            </span>
          </div>
          <div v-else class="empty-inline">本批暂无用例明细</div>
        </template>

        <div v-else class="empty-inline">
          {{ selectedDayLabel }}暂无回归执行。跑完后这里会展示最新结果。
        </div>
      </div>

      <button type="button" class="panel-foot" @click="goToRegression">
        <span>查看 {{ selectedDayLabel }} 全部执行记录 · 共 {{ dayStats.runCount }} 次</span>
        <el-icon><ArrowRight /></el-icon>
      </button>
    </section>

    <ApiTestingPanel class="api-testing-home" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import ApiTestingPanel from '@/components/api-testing/ApiTestingPanel.vue'

type WeekDay = {
  date: string
  dateText: string
  weekday: string
  runCount: number
  passRate: number | null
  allPassed: boolean | null
}

type Feature = {
  stepId: string
  label: string
  status: string
  sortOrder?: number
  endpoint?: string
  deviceName?: string
  featureKey?: string
  errorMessage?: string | null
  taskId?: string | null
}

type RegressionRun = {
  id: string
  status: string
  passRate?: number | null
  dateText?: string
  dayText?: string
  date?: string
  appsText?: string
  jobCount?: number
  features?: Feature[]
}

const router = useRouter()

const selectedDate = ref('')
const loading = ref(false)
const lastUpdatedAt = ref<number | null>(null)
const failDialogVisible = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const workbench = ref({
  taskPassRate7d: null as number | null,
  tasksFinished7d: 0,
  tasksPassed7d: 0,
  tasksFailed7d: 0,
  regressionPassRate7d: null as number | null,
  latestRegressionPassRate: null as number | null,
  regressionRuns7d: 0,
  regressionWeekDays: [] as WeekDay[],
  recentRegressionRuns: [] as RegressionRun[]
})

const weekDays = computed(() => workbench.value.regressionWeekDays || [])

const selectedDay = computed(() => weekDays.value.find((d) => d.date === selectedDate.value) || null)

const selectedDayLabel = computed(() => {
  const d = selectedDay.value
  if (!d) return '当日'
  return formatDayLabel(d.date) || d.dateText || '当日'
})

const runsOnSelectedDay = computed(() => {
  const date = selectedDate.value
  if (!date) return workbench.value.recentRegressionRuns
  return workbench.value.recentRegressionRuns.filter((r) => runMatchesDate(r, date))
})

const latestRun = computed(() => runsOnSelectedDay.value[0] || null)

const failedFeatures = computed(() => {
  const list: Feature[] = []
  for (const run of runsOnSelectedDay.value) {
    for (const f of run.features || []) {
      if ((f.status || '').toLowerCase() === 'failed') list.push(f)
    }
  }
  return list
})

const dayStats = computed(() => {
  const day = selectedDay.value
  const runs = runsOnSelectedDay.value
  let passed = 0
  let skipped = 0
  let failed = 0
  let stopped = 0
  let passedAndroid = 0
  let passedIos = 0
  for (const run of runs) {
    const st = (run.status || '').toUpperCase()
    if (st === 'STOPPED') stopped += 1
    for (const f of run.features || []) {
      const fs = (f.status || '').toLowerCase()
      const ep = (f.endpoint || '').toLowerCase()
      if (fs === 'success') {
        passed += 1
        if (ep === 'android') passedAndroid += 1
        else if (ep === 'ios') passedIos += 1
      } else if (fs === 'skipped') skipped += 1
      else if (fs === 'failed') failed += 1
    }
  }
  return {
    runCount: day?.runCount ?? runs.length,
    passedCases: passed,
    passedAndroid,
    passedIos,
    skippedCases: skipped,
    failedCases: failed,
    stoppedRuns: stopped
  }
})

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return ''
  const d = new Date(lastUpdatedAt.value)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `更新于 ${hh}:${mm}:${ss}`
})

function endpointShort(endpoint?: string) {
  const e = (endpoint || '').toLowerCase()
  if (e === 'ios') return 'iOS'
  if (e === 'android') return '安卓'
  return endpoint || ''
}

function featureTitle(f: Feature) {
  const parts = [f.label]
  if (f.endpoint) parts.push(endpointShort(f.endpoint))
  if (f.deviceName) parts.push(f.deviceName)
  return parts.filter(Boolean).join(' · ')
}

function formatDayLabel(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function runMatchesDate(run: RegressionRun, date: string) {
  if (run.date && run.date === date) return true
  const text = `${run.dateText || ''} ${run.dayText || ''}`
  const [y, m, day] = date.split('-')
  if (!y || !m || !day) return false
  const compact = `${Number(m)}/${Number(day)}`
  const zh = `${Number(y)}年${Number(m)}月${Number(day)}日`
  return text.includes(date) || text.includes(zh) || text.includes(compact)
}

function selectDay(date: string) {
  selectedDate.value = date
}

function formatRate(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return `${Math.round(Number(v))}%`
}

function goToRegression() {
  const q: Record<string, string> = {}
  if (selectedDate.value) {
    q.date = selectedDate.value
  }
  q.focus = 'history'
  router.push({ path: '/app-online-regression', query: q })
}

function weekCellClass(d: WeekDay) {
  const classes: string[] = []
  if (d.date === selectedDate.value) classes.push('is-selected')
  if (!d.runCount) classes.push('is-empty')
  else if (d.allPassed === true || (d.passRate != null && d.passRate >= 100)) classes.push('is-pass')
  else if (d.passRate != null && d.passRate < 100) classes.push('is-fail')
  else classes.push('is-run')
  return classes
}

function runStatusText(status?: string) {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED') return '已完成'
  if (s === 'FAILED') return '失败'
  if (s === 'STOPPED') return '已停止'
  if (s === 'RUNNING') return '执行中'
  if (s === 'PENDING') return '排队中'
  return status || '-'
}

function runStatusTag(status?: string): 'success' | 'danger' | 'warning' | 'info' {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED') return 'success'
  if (s === 'FAILED') return 'danger'
  if (s === 'RUNNING') return 'warning'
  return 'info'
}

function featureStatusText(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'success') return '通过'
  if (s === 'failed') return '失败'
  if (s === 'skipped') return '跳过'
  if (s === 'running') return '执行中'
  if (s === 'pending') return '待执行'
  return status || '-'
}

function pickDefaultDate(days: WeekDay[]) {
  if (!days.length) return ''
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (days.some((d) => d.date === todayStr)) return todayStr
  const withRuns = [...days].reverse().find((d) => d.runCount > 0)
  return withRuns?.date || days[days.length - 1]?.date || ''
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void loadData({ silent: true, keepDay: true })
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return
    void loadData({ silent: true, keepDay: true })
  }, 15_000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await loadData({ silent: false, keepDay: false })
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onActivated(() => {
  void loadData({ silent: true, keepDay: true })
  startPolling()
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function loadData(opts?: { silent?: boolean; keepDay?: boolean }) {
  const silent = opts?.silent !== false
  const keepDay = !!opts?.keepDay
  if (!silent) loading.value = true
  try {
    const wb = await apiClient.getWorkbenchStats()
    const prevDate = selectedDate.value
    workbench.value = {
      taskPassRate7d: wb.taskPassRate7d ?? null,
      tasksFinished7d: wb.tasksFinished7d ?? 0,
      tasksPassed7d: wb.tasksPassed7d ?? 0,
      tasksFailed7d: wb.tasksFailed7d ?? 0,
      latestRegressionPassRate: wb.latestRegressionPassRate ?? null,
      regressionPassRate7d: wb.regressionPassRate7d ?? null,
      regressionRuns7d: wb.regressionRuns7d ?? 0,
      regressionWeekDays: wb.regressionWeekDays ?? [],
      recentRegressionRuns: wb.recentRegressionRuns ?? []
    }
    if (!keepDay || !prevDate) {
      selectedDate.value = pickDefaultDate(workbench.value.regressionWeekDays)
    } else if (!workbench.value.regressionWeekDays.some((d) => d.date === prevDate)) {
      selectedDate.value = pickDefaultDate(workbench.value.regressionWeekDays)
    } else {
      selectedDate.value = prevDate
    }
    lastUpdatedAt.value = Date.now()
  } catch {
    /* 后端未就绪时保持空态 */
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.home {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  overflow: hidden;
}

.main-panel {
  padding: 16px 16px 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.panel-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel-kicker {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.4;
}

.day-summary {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.day-summary.muted {
  color: var(--el-text-color-disabled);
}

.stat-pass {
  color: var(--app-success);
  font-weight: 600;
}

.stat-skip {
  color: var(--el-text-color-placeholder);
}

.stat-fail-zero {
  color: var(--el-text-color-placeholder);
}

.stat-fail-btn {
  appearance: none;
  border: none;
  background: var(--el-color-danger-light-9);
  color: var(--app-danger);
  font-weight: 700;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1.4;
}

.stat-fail-btn:hover {
  background: var(--el-color-danger-light-8);
  color: var(--el-color-danger);
}

.fail-empty {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  padding: 8px 0;
}

.fail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 420px;
  overflow: auto;
}

.fail-item {
  border: 1px solid var(--el-color-danger-light-8);
  background: var(--el-color-danger-light-9);
  border-radius: 8px;
  padding: 10px 12px;
}

.fail-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.fail-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.fail-device {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.fail-msg {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-danger-dark-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-height: 160px;
  overflow: auto;
}

.refresh-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 12px;
  line-height: 1.4;
}

.week-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.week-cell {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px 6px;
  text-align: center;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  min-height: 84px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.week-cell:hover {
  border-color: var(--el-color-primary-light-7);
}

.week-cell.is-selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--app-primary);
  box-shadow: inset 0 -3px 0 var(--app-primary);
}

.week-cell.is-selected.is-pass {
  background: var(--el-color-success-light-9);
  border-color: var(--app-success);
  box-shadow: inset 0 -3px 0 var(--app-success);
}

.week-cell.is-pass:not(.is-selected) {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.week-cell.is-fail:not(.is-selected) {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}

.week-wd {
  font-size: 11px;
  color: var(--el-text-color-disabled);
}

.week-date {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.week-body {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.week-body strong {
  font-size: 14px;
  color: var(--app-primary);
}

.week-cell.is-pass .week-body strong,
.week-cell.is-selected.is-pass .week-body strong {
  color: var(--app-success);
}

.week-cell.is-fail .week-body strong {
  color: var(--app-danger);
}

.latest-block {
  margin-top: 18px;
  padding: 4px 4px 16px;
}

.latest-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.latest-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--app-success);
}

.latest-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.latest-sub {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.latest-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border);
}

.latest-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--app-text);
}

.feat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--app-surface);
  color: var(--app-text-secondary);
  border: 1px solid var(--app-border);
}

.feat-ep {
  font-style: normal;
  font-size: 11px;
  padding: 0 5px;
  border-radius: 4px;
  background: #eef1f6;
  color: var(--app-text-secondary);
  flex-shrink: 0;
}

.feat.ep-ios .feat-ep {
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
}

.feat.ep-android .feat-ep {
  background: var(--el-color-success-light-9);
  color: var(--app-success);
}

.feat em {
  font-style: normal;
  color: var(--el-text-color-placeholder);
}

.feat.is-success {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.feat.is-success em {
  color: var(--app-success);
}

.feat.is-failed {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}

.feat.is-failed.is-clickable {
  cursor: pointer;
}

.feat.is-failed.is-clickable:hover {
  border-color: var(--app-danger);
  box-shadow: 0 0 0 1px var(--app-danger)33;
}

.feat.is-failed em {
  color: var(--app-danger);
}

.feat.is-skipped {
  background: var(--el-fill-color-light);
}

.empty-inline {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  padding: 4px 0 8px;
  line-height: 1.6;
}

.muted {
  color: var(--el-text-color-disabled);
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -16px;
  width: calc(100% + 32px);
  padding: 14px 20px;
  border: 0;
  border-top: 1px solid var(--app-border);
  background: var(--el-fill-color-lighter);
  color: var(--app-text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.panel-foot:hover {
  color: var(--app-primary);
  background: var(--el-color-primary-light-9);
}

@media (max-width: 900px) {
  .week-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
