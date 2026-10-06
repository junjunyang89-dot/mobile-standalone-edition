<template>
  <div class="home">
    <section class="panel day-panel">
      <div class="panel-head">
        <div class="title-line">
          <span class="panel-title">测试日报 · {{ dayLabel }}</span>
          <span class="refresh-meta">
            {{ lastUpdatedText || '加载中…' }}<template v-if="isToday"> · 约 30 秒自动刷新</template>
          </span>
        </div>
        <div class="head-right">
          <el-button size="small" @click="shiftWeek(-7)">‹ 上一周</el-button>
          <el-button size="small" :disabled="isThisWeek" @click="shiftWeek(7)">下一周 ›</el-button>
          <el-button size="small" :type="isToday ? 'primary' : ''" plain @click="pick(todayStr())">今天</el-button>
          <el-button size="small" :loading="loading" @click="load(false)">刷新</el-button>
        </div>
      </div>

      <div class="week-strip">
        <button
          v-for="d in week"
          :key="d.date"
          type="button"
          class="week-cell"
          :class="{ 'is-selected': d.date === selected, 'is-empty': !hasData(d), 'is-future': d.future }"
          :disabled="d.future"
          @click="pick(d.date)"
        >
          <i v-if="d.failed" class="week-badge" :title="`有 ${d.failed} 条失败`">✕ {{ d.failed }}</i>
          <div class="week-wd">{{ d.weekday }}</div>
          <div class="week-date">{{ dateCn(d.date) }}</div>
          <div v-if="hasData(d)" class="week-body">
            <span v-if="d.uiCases">UI {{ d.uiCases }}</span>
            <span>接口 {{ d.apiCases }}</span>
            <span v-if="d.perfRuns">性能 {{ d.perfRuns }}</span>
            <span v-if="d.added" class="add">+{{ d.added }} 用例</span>
          </div>
          <div v-else class="week-body muted">{{ d.future ? '' : '没有执行' }}</div>
        </button>
      </div>
    </section>

    <div v-if="data" class="grid">
      <!-- UI 自动化 -->
      <section class="panel card">
        <header class="card-head">
          <div class="card-title"><i class="dot dot-ui" />UI 自动化</div>
          <button type="button" class="card-link" @click="goRegression">执行记录 ›</button>
        </header>
        <div class="kpis">
          <div class="kpi"><b :class="numTone(ui.cases)">{{ ui.cases }}</b><span>条用例</span></div>
          <div class="kpi"><b :class="numTone(ui.batches)">{{ ui.batches }}</b><span>次执行</span></div>
          <div class="kpi"><b :class="rateTone(ui.passRate)">{{ rate(ui.passRate) }}</b><span>通过率</span></div>
          <div class="kpi" :class="{ 'is-bad': ui.failed }">
            <button v-if="ui.failed" type="button" class="fail-btn" title="看失败明细" @click="failOpen = true">{{ ui.failed }} ›</button>
            <b v-else class="muted">0</b>
            <span>失败</span>
          </div>
        </div>
        <table v-if="ui.rows.length" class="mini">
          <thead>
            <tr><th>类型</th><th>环境</th><th class="num">执行</th><th class="num">用例</th><th class="num">通过</th><th class="num">失败</th><th class="num">跳过</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in ui.rows" :key="`${r.track}-${r.env}`">
              <td><span class="tag" :class="`tag-${r.track.toLowerCase()}`">{{ TRACK[r.track] || r.track }}</span></td>
              <td><span class="env" :class="`env-${(r.env || 'none').toLowerCase()}`">{{ envText(r.env) }}</span></td>
              <td class="num">{{ r.batches }} {{ r.track === 'SINGLE' ? '次' : '批' }}</td>
              <td class="num">{{ r.cases }}</td>
              <td class="num" :class="r.passed ? 'ok' : 'muted'">{{ r.passed }}</td>
              <td class="num" :class="r.failed ? 'bad' : 'muted'">{{ r.failed }}</td>
              <td class="num muted">{{ r.skipped }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-box">
          <span class="empty-icon">📱</span>
          <div class="empty-text">
            <b>{{ dayWord }}没跑 UI 自动化</b>
            <span v-if="isToday">在「APP 自动化」里发起一次回归，或配置定时任务每天自动跑</span>
          </div>
          <button v-if="isToday" type="button" class="empty-go" @click="router.push('/app-online-regression')">去发起 ›</button>
        </div>
        <p v-if="ui.rows.length" class="card-note">回归批次里同一流程跑在两台设备上算两条；「单独执行」是在流程编排里点运行的，不含试跑。</p>
      </section>

      <!-- 接口自动化 -->
      <section class="panel card">
        <header class="card-head">
          <div class="card-title"><i class="dot dot-api" />接口自动化</div>
          <button type="button" class="card-link" @click="router.push('/api-reports')">执行报告 ›</button>
        </header>
        <div class="kpis">
          <div class="kpi"><b :class="numTone(api.cases)">{{ api.cases }}</b><span>条用例</span></div>
          <div class="kpi"><b :class="numTone(api.runs)">{{ api.runs }}</b><span>次执行</span></div>
          <div class="kpi"><b :class="rateTone(api.passRate)">{{ rate(api.passRate) }}</b><span>通过率</span></div>
          <div class="kpi" :class="{ 'is-bad': api.failed }">
            <b :class="api.failed ? 'bad' : 'muted'">{{ api.failed }}</b>
            <span>失败<template v-if="api.blocked"> · 没跑成 {{ api.blocked }}</template></span>
          </div>
        </div>
        <table v-if="api.rows.length" class="mini">
          <thead>
            <tr><th>来源</th><th>环境</th><th class="num">执行</th><th class="num">用例</th><th class="num">通过</th><th class="num">失败</th><th class="num">没跑成</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in api.rows" :key="`${r.trig}-${r.env}`">
              <td><span class="tag" :class="r.trig === 'SCHEDULE' ? 'tag-schedule' : 'tag-manual'">{{ r.trig === 'SCHEDULE' ? '定时任务' : '手动执行' }}</span></td>
              <td><span class="env" :class="`env-${(r.env || 'none').toLowerCase()}`">{{ envText(r.env) }}</span></td>
              <td class="num">{{ r.runs }} 次</td>
              <td class="num">{{ r.cases }}</td>
              <td class="num" :class="r.passed ? 'ok' : 'muted'">{{ r.passed }}</td>
              <td class="num" :class="r.failed ? 'bad' : 'muted'">{{ r.failed }}</td>
              <td class="num muted">{{ r.blocked }}</td>
            </tr>
          </tbody>
          <tfoot v-if="api.rows.length > 1">
            <tr>
              <td colspan="2">合计</td>
              <td class="num">{{ api.runs }} 次</td>
              <td class="num">{{ api.cases }}</td>
              <td class="num ok">{{ api.passed }}</td>
              <td class="num" :class="{ bad: api.failed }">{{ api.failed }}</td>
              <td class="num muted">{{ api.blocked }}</td>
            </tr>
          </tfoot>
        </table>
        <div v-else class="empty-box">
          <span class="empty-icon">🔌</span>
          <div class="empty-text">
            <b>{{ dayWord }}没跑接口用例</b>
            <span v-if="isToday">在「接口测试」里手动执行一个用例集，或配置定时任务</span>
          </div>
          <button v-if="isToday" type="button" class="empty-go" @click="router.push('/api-reports')">去发起 ›</button>
        </div>
        <div v-if="api.kinds.length" class="chips">
          <span class="chips-label">按用例类型</span>
          <span v-for="k in api.kinds" :key="k.kind" class="chip">
            {{ KIND[k.kind] || k.kind }} <b>{{ k.cases }}</b>
            <em v-if="k.failed" class="bad">失败 {{ k.failed }}</em>
          </span>
        </div>
        <template v-if="api.recent.length">
          <button type="button" class="fold" @click="recentOpen = !recentOpen">
            {{ recentOpen ? '收起执行明细' : `看这天的 ${api.recent.length} 次执行` }}
            <i class="fold-arrow" :class="{ open: recentOpen }">›</i>
          </button>
          <div v-if="recentOpen" class="recent">
            <div v-for="r in api.recent" :key="r.id" class="recent-row">
              <span class="mono">{{ timeOf(r.createdAt) }}</span>
              <span class="tag" :class="r.trig === 'SCHEDULE' ? 'tag-schedule' : 'tag-manual'">{{ r.trig === 'SCHEDULE' ? '定时' : '手动' }}</span>
              <span class="env" :class="`env-${(r.env || 'none').toLowerCase()}`">{{ envText(r.env) }}</span>
              <span class="recent-name" :title="r.collection || ''">{{ r.collection || '临时执行' }}</span>
              <span class="recent-res"><b class="ok">{{ r.passed }}</b> / {{ r.total }}<em v-if="r.failed" class="bad"> 失败 {{ r.failed }}</em></span>
              <span class="muted">{{ r.createdBy || '' }}</span>
            </div>
          </div>
        </template>
      </section>

      <!-- 性能测试 -->
      <section class="panel card">
        <header class="card-head">
          <div class="card-title"><i class="dot dot-perf" />性能测试</div>
          <button type="button" class="card-link" @click="router.push('/performance')">性能测试 ›</button>
        </header>
        <div class="kpis">
          <div class="kpi"><b :class="numTone(perf.runs)">{{ perf.runs }}</b><span>次执行</span></div>
          <div class="kpi"><b :class="perf.passed ? 'ok' : 'muted'">{{ perf.passed }}</b><span>完成</span></div>
          <div class="kpi" :class="{ 'is-bad': perf.failed }"><b :class="perf.failed ? 'bad' : 'muted'">{{ perf.failed }}</b><span>失败</span></div>
          <div class="kpi"><b :class="rateTone(perf.passRate)">{{ rate(perf.passRate) }}</b><span>完成率</span></div>
        </div>
        <table v-if="perf.rows.length" class="mini">
          <thead>
            <tr><th>类型</th><th>设备环境</th><th class="num">执行</th><th class="num">完成</th><th class="num">失败</th><th class="num">进行中</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in perf.rows" :key="`${r.type}-${r.env}`">
              <td>{{ PERF[r.type] || r.type }}</td>
              <td><span class="env" :class="`env-${(r.env || 'none').toLowerCase()}`">{{ envText(r.env) }}</span></td>
              <td class="num">{{ r.runs }} 次</td>
              <td class="num ok">{{ r.passed }}</td>
              <td class="num" :class="{ bad: r.failed }">{{ r.failed }}</td>
              <td class="num muted">{{ r.running }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-box">
          <span class="empty-icon">⚡</span>
          <div class="empty-text">
            <b>{{ dayWord }}没跑性能测试</b>
            <span v-if="isToday">在「性能测试」里发起一次压测</span>
          </div>
          <button v-if="isToday" type="button" class="empty-go" @click="router.push('/performance')">去发起 ›</button>
        </div>
      </section>

      <!-- 用例增加 -->
      <section class="panel card">
        <header class="card-head">
          <div class="card-title"><i class="dot dot-add" />用例增加</div>
          <div class="card-total" :class="{ muted: !added.total }">
            <b>+{{ added.total }}</b>
            <span>{{ isToday ? '今天' : '这天' }}新增</span>
          </div>
        </header>
        <div class="add-list">
          <div class="add-item">
            <button type="button" class="add-name" @click="router.push('/api-endpoints')">接口用例</button>
            <div class="add-chips">
              <span v-for="(n, k) in added.api.byKind" :key="'k' + k" class="chip">{{ KIND[k] || k }} <b>{{ n }}</b></span>
              <span v-for="(n, k) in added.api.bySource" :key="'s' + k" class="chip soft">{{ SOURCE[k] || k }} <b>{{ n }}</b></span>
            </div>
            <b class="add-num" :class="{ muted: !added.api.total }">+{{ added.api.total }}</b>
          </div>
          <div class="add-item">
            <button type="button" class="add-name" @click="router.push('/ui-flows')">UI 流程</button>
            <div class="add-chips">
              <span v-for="(n, k) in added.ui.byCatalog" :key="k" class="chip">{{ CATALOG[k] || k }} <b>{{ n }}</b></span>
            </div>
            <b class="add-num" :class="{ muted: !added.ui.total }">+{{ added.ui.total }}</b>
          </div>
          <div class="add-item">
            <button type="button" class="add-name" @click="router.push('/ai-test-cases')">功能用例</button>
            <div class="add-chips">
              <span v-for="(n, k) in added.func.bySource" :key="k" class="chip">{{ k === 'AI' ? 'AI 生成' : '手工' }} <b>{{ n }}</b></span>
            </div>
            <b class="add-num" :class="{ muted: !added.func.total }">+{{ added.func.total }}</b>
          </div>
        </div>
      </section>
    </div>
    <el-empty v-else-if="!loading" description="统计没取到，确认后端已启动后点刷新" />

    <el-dialog v-model="failOpen" :title="`${dayLabel} · UI 自动化失败（${ui.failures.length}）`" width="600px" append-to-body>
      <div class="fail-list">
        <div v-for="(f, i) in ui.failures" :key="i" class="fail-item">
          <div class="fail-head">
            <span class="tag" :class="`tag-${f.track.toLowerCase()}`">{{ TRACK[f.track] || f.track }}</span>
            <span class="env" :class="`env-${(f.env || 'none').toLowerCase()}`">{{ envText(f.env) }}</span>
            <b>{{ f.label }}</b>
            <span v-if="f.app || f.device" class="muted">{{ [f.app, endpointText(f.endpoint), f.device].filter(Boolean).join(' · ') }}</span>
          </div>
          <pre v-if="f.error" class="fail-msg">{{ f.error }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="failOpen = false">关闭</el-button>
        <el-button type="primary" @click="goRegression">去看执行记录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient, type DailyDashboard } from '@/api'

const router = useRouter()

const TRACK: Record<string, string> = {
  REGRESSION: '回归',
  AUTOMATION: '自动化编排',
  COMPATIBILITY: '兼容性',
  SINGLE: '单独执行'
}
const KIND: Record<string, string> = { BRANCH: '分支用例', REGRESSION: '回归用例', UNCLASSIFIED: '未分类' }
const SOURCE: Record<string, string> = {
  AI: 'AI 生成',
  SOURCE: '源码生成',
  CAPTURE: '抓包',
  ENDPOINT: '接口清单',
  SEED: '初始化',
  MANUAL: '手工'
}
const CATALOG: Record<string, string> = {
  AUTOMATION: '自动化编排',
  ONLINE: '线上回归',
  SHARED: '通用',
  PERFORMANCE: '性能',
  INSTALL: '安装'
}
const PERF: Record<string, string> = {
  PERFORMANCE_BASELINE_TEST: '性能基础质量',
  PERFORMANCE_QUALITY_TEST: '性能基础质量',
  SCENARIO_PERFORMANCE_TEST: '场景化性能',
  PERFORMANCE_MONITORING_TEST: '性能指标监控',
  POWER_CONSUMPTION_BASELINE_TEST: '功耗基础质量',
  POWER_CONSUMPTION_QUALITY_TEST: '功耗基础质量'
}

const EMPTY_UI: DailyDashboard['ui'] = { batches: 0, cases: 0, passed: 0, failed: 0, skipped: 0, passRate: null, rows: [], failures: [] }
const EMPTY_API: DailyDashboard['api'] = {
  runs: 0, cases: 0, passed: 0, failed: 0, skipped: 0, blocked: 0, passRate: null, rows: [], kinds: [], recent: []
}
const EMPTY_PERF: DailyDashboard['perf'] = { runs: 0, passed: 0, failed: 0, passRate: null, rows: [] }
const EMPTY_ADDED: DailyDashboard['added'] = {
  total: 0,
  api: { total: 0, byKind: {}, bySource: {}, byEnv: {} },
  ui: { total: 0, byCatalog: {} },
  func: { total: 0, bySource: {} }
}

const data = ref<DailyDashboard | null>(null)
const selected = ref(todayStr())
const loading = ref(false)
const lastUpdatedAt = ref<number | null>(null)
const failOpen = ref(false)
const recentOpen = ref(false)
let seq = 0
let timer: ReturnType<typeof setInterval> | null = null

const week = computed(() => data.value?.week || [])
const ui = computed(() => data.value?.ui || EMPTY_UI)
const api = computed(() => data.value?.api || EMPTY_API)
const perf = computed(() => data.value?.perf || EMPTY_PERF)
const added = computed(() => data.value?.added || EMPTY_ADDED)

const isToday = computed(() => selected.value === todayStr())
const isThisWeek = computed(() => week.value.some((d) => d.date === todayStr()))
const dayLabel = computed(() => {
  const [y, m, d] = selected.value.split('-').map(Number)
  return isToday.value ? `今天（${m}月${d}日）` : `${y}年${m}月${d}日`
})
const dayWord = computed(() => (isToday.value ? '今天还' : '这天'))
const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return ''
  const t = new Date(lastUpdatedAt.value)
  return `更新于 ${[t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')}`
})

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function addDays(date: string, n: number) {
  const t = new Date(`${date}T00:00:00`)
  t.setDate(t.getDate() + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function hasData(d: DailyDashboard['week'][number]) {
  return d.uiCases + d.apiCases + d.perfRuns + d.added > 0
}

function envText(env?: string | null) {
  const e = String(env || '').toUpperCase()
  if (e === 'PROD') return '线上'
  if (e === 'TEST') return '测试'
  if (e === 'ANY') return '通用'
  return '未标'
}

function endpointText(ep?: string | null) {
  const e = String(ep || '').toLowerCase()
  return e === 'ios' ? 'iOS' : e === 'android' ? '安卓' : ''
}

function rate(v: number | null | undefined) {
  return v == null ? '—' : `${v}%`
}

function dateCn(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日`
}

function numTone(n: number) {
  return n ? '' : 'muted'
}

function rateTone(v: number | null | undefined) {
  if (v == null) return 'muted'
  return v >= 100 ? 'ok' : v >= 90 ? 'warn' : 'bad'
}

function timeOf(v: string) {
  const m = /(\d{2}):(\d{2})/.exec(String(v || ''))
  return m ? `${m[1]}:${m[2]}` : ''
}

function pick(date: string) {
  if (date > todayStr()) return
  selected.value = date
  recentOpen.value = false
  void load(false)
}

function shiftWeek(days: number) {
  const next = addDays(selected.value, days)
  pick(next > todayStr() ? todayStr() : next)
}

function goRegression() {
  router.push({ path: '/app-online-regression', query: { date: selected.value, focus: 'history' } })
}

async function load(silent = true) {
  const my = ++seq
  if (!silent) loading.value = true
  try {
    const r = await apiClient.getDailyDashboard(selected.value)
    if (my !== seq) return
    data.value = r
    lastUpdatedAt.value = Date.now()
  } catch {
    /* 后端没起来时保持上一次的数据 */
  } finally {
    if (my === seq) loading.value = false
  }
}

function startPolling() {
  stopPolling()
  timer = setInterval(() => {
    if (document.visibilityState === 'hidden' || !isToday.value) return
    void load(true)
  }, 30_000)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function onVisible() {
  if (document.visibilityState === 'visible' && isToday.value) void load(true)
}

onMounted(() => {
  void load(false)
  startPolling()
  document.addEventListener('visibilitychange', onVisible)
})
onActivated(() => {
  void load(true)
  startPolling()
})
onDeactivated(stopPolling)
onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
.home {
  --num-font: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.panel {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.day-panel {
  padding: 16px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.title-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-top: 3px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}

.refresh-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.head-right .el-button + .el-button {
  margin-left: 0;
}

.week-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.week-cell {
  position: relative;
  min-height: 96px;
  padding: 12px 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: #fff;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.week-cell:hover:not(:disabled):not(.is-selected) {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.week-cell.is-selected {
  border-color: var(--app-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 1px var(--app-primary);
}

.week-cell.is-selected .week-wd,
.week-cell.is-selected .week-date {
  color: var(--app-primary);
}

.week-cell.is-future {
  opacity: 0.45;
  cursor: not-allowed;
}

.week-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--app-danger);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
  line-height: 17px;
  color: #fff;
}

.week-wd {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.week-date {
  margin-top: 3px;
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
}

.week-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-secondary);
}

.week-body .add {
  font-weight: 600;
  color: var(--app-success);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-ui { background: #3b82f6; }
.dot-api { background: #8b5cf6; }
.dot-perf { background: #f59e0b; }
.dot-add { background: #10b981; }

.card-link {
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.card-link:hover {
  color: var(--app-primary);
}

.card-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.card-total b {
  font-family: var(--num-font);
  font-size: 26px;
  font-weight: 700;
  color: var(--app-success);
}

.card-total span {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.card-total.muted b {
  color: var(--el-text-color-placeholder);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f6f7f9;
}

.kpi.is-bad {
  background: var(--el-color-danger-light-9);
}

.kpi b {
  font-family: var(--num-font);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--app-text);
}

.kpi span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fail-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--num-font);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--app-danger);
  cursor: pointer;
}

.fail-btn:hover {
  text-decoration: underline;
}

.ok { color: var(--app-success) !important; }
.warn { color: var(--el-color-warning) !important; }
.bad { color: var(--app-danger) !important; }
.muted { color: var(--el-text-color-placeholder) !important; }

.mini {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.mini th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--app-border);
  font-weight: 500;
  text-align: left;
  color: var(--el-text-color-secondary);
}

.mini td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  color: var(--app-text);
}

.mini tfoot td {
  border-bottom: none;
  font-weight: 600;
}

.mini .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.tag {
  display: inline-block;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}

.tag-regression { background: #e8f1ff; color: #1f5fbf; }
.tag-automation { background: #f3e8ff; color: #7a3fbf; }
.tag-compatibility { background: #e6f7f5; color: #11766a; }
.tag-single { background: #f2f3f5; color: #4e5969; }
.tag-schedule { background: #fff3e0; color: #b45309; }
.tag-manual { background: #eef2ff; color: #4338ca; }

.env {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.env-prod { color: #c2410c; font-weight: 500; }
.env-test { color: #0f766e; }

.empty-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 18px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: #fafbfc;
}

.empty-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  font-size: 17px;
}

.empty-text {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.empty-text b {
  margin-right: 6px;
  font-weight: 600;
  color: var(--app-text);
}

.empty-go {
  flex: none;
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--app-primary);
  cursor: pointer;
}

.empty-go:hover {
  text-decoration: underline;
}

.card-note {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.chips-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chip {
  padding: 1px 8px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.chip.soft {
  border-style: dashed;
}

.chip b {
  margin-left: 2px;
  color: var(--app-text);
}

.chip em {
  margin-left: 4px;
  font-style: normal;
}

.fold {
  align-self: flex-start;
  margin-top: 10px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--app-primary);
  cursor: pointer;
}

.fold-arrow {
  display: inline-block;
  margin-left: 4px;
  font-style: normal;
  transition: transform 0.15s;
}

.fold-arrow.open {
  transform: rotate(90deg);
}

.recent {
  margin-top: 6px;
  max-height: 260px;
  overflow: auto;
}

.recent-row {
  display: grid;
  grid-template-columns: 44px auto auto minmax(0, 1fr) auto 70px;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  font-size: 12.5px;
}

.recent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-res em {
  font-style: normal;
}

.mono {
  font-family: ui-monospace, Menlo, monospace;
  color: var(--el-text-color-secondary);
}

.add-list {
  display: flex;
  flex-direction: column;
}

.add-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 48px;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.add-name {
  padding: 0;
  border: none;
  background: none;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--app-text);
  cursor: pointer;
}

.add-name:hover {
  color: var(--app-primary);
}

.add-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.add-num {
  font-family: var(--num-font);
  font-size: 15px;
  text-align: right;
  color: var(--app-success);
}

.fail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 460px;
  overflow: auto;
}

.fail-item {
  padding: 10px 12px;
  border: 1px solid var(--el-color-danger-light-8);
  border-radius: 8px;
  background: var(--el-color-danger-light-9);
}

.fail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.fail-msg {
  margin: 8px 0 0;
  max-height: 160px;
  overflow: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-color-danger-dark-2);
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .week-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
