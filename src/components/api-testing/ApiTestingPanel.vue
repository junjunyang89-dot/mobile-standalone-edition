<template>
  <section class="api-testing" :class="{ 'is-page': variant === 'page' }">
    <div class="at-head">
      <div class="at-title">API Testing</div>
      <div class="at-head-actions">
        <el-button size="small" :loading="loading" @click="refresh()">刷新</el-button>
        <el-button type="primary" size="small" :loading="running" @click="runAll">
          <el-icon class="at-play"><VideoPlay /></el-icon>
          全部运行
        </el-button>
      </div>
    </div>
    <div class="at-meta">
      接口测试概览
      <template v-if="updatedText"> · {{ updatedText }}</template>
      · 约每 30 秒自动刷新
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">用例</span>
          <span class="kpi-icon is-blue"><el-icon><Document /></el-icon></span>
        </div>
        <div class="kpi-value">
          {{ stats.cases }}
          <span v-if="stats.casesDelta7d" class="kpi-delta is-up">+{{ stats.casesDelta7d }}</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">通过率</span>
          <span class="kpi-icon is-green"><el-icon><CircleCheck /></el-icon></span>
        </div>
        <div class="kpi-value">
          {{ formatRate(stats.passRate) }}
          <span
            v-if="stats.passRateDelta != null"
            class="kpi-delta"
            :class="stats.passRateDelta >= 0 ? 'is-up' : 'is-down'"
          >
            {{ formatSigned(stats.passRateDelta, '%') }}
          </span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">失败</span>
          <span class="kpi-icon is-red"><el-icon><CircleClose /></el-icon></span>
        </div>
        <div class="kpi-value">
          {{ stats.failed }}
          <span
            v-if="stats.failedDelta != null && stats.failedDelta !== 0"
            class="kpi-delta"
            :class="stats.failedDelta > 0 ? 'is-down' : 'is-up'"
          >
            {{ formatSigned(stats.failedDelta) }}
          </span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">平均延迟</span>
          <span class="kpi-icon is-amber"><el-icon><Timer /></el-icon></span>
        </div>
        <div class="kpi-value">
          {{ formatLatency(stats.avgLatencyMs) }}
          <span
            v-if="stats.avgLatencyDeltaMs != null && stats.avgLatencyDeltaMs !== 0"
            class="kpi-delta is-warn"
          >
            {{ formatSignedLatency(stats.avgLatencyDeltaMs) }}
          </span>
        </div>
      </div>
    </div>

    <div class="at-grid">
      <div class="at-panel">
        <div class="panel-bar">
          <span class="panel-title">最近执行</span>
          <button type="button" class="panel-link" @click="goCases()">查看全部 ›</button>
        </div>
        <div v-if="!stats.recentRuns.length" class="at-empty">
          暂无执行记录。在接口列表跑用例后，这里会展示最近结果。
        </div>
        <ul v-else class="run-list">
          <li v-for="r in stats.recentRuns" :key="r.id" class="run-row">
            <span class="run-dot" :class="r.status === 'PASSED' ? 'ok' : 'fail'" />
            <span class="method-tag" :class="methodClass(r.method)">{{ methodLabel(r.method) }}</span>
            <span class="run-path" :title="r.path || r.name">{{ r.path || r.name || '—' }}</span>
            <span class="run-latency">{{ formatLatency(r.durationMs) }}</span>
            <span class="run-ago">{{ relativeTime(r.createdAt) }}</span>
          </li>
        </ul>
      </div>

      <div class="at-panel">
        <div class="panel-bar">
          <!-- 显示的是按「项目」聚合的数据，不是 api_test_collections 那个集合。
               现在真的有「用例集合」这个东西了，这里再叫集合就是同名两义 -->
          <span class="panel-title">项目</span>
          <button type="button" class="panel-link" @click="goCases()">管理</button>
        </div>
        <div v-if="!stats.collections.length" class="at-empty">暂无项目用例。</div>
        <ul v-else class="coll-list">
          <li
            v-for="c in stats.collections"
            :key="c.project"
            class="coll-row"
            @click="goCases(c.project)"
          >
            <div>
              <div class="coll-name">{{ c.name }}</div>
              <div class="coll-meta">{{ c.caseCount }} 个用例</div>
            </div>
            <div class="coll-rate" :class="{ muted: c.passRate == null }">
              {{ c.passRate == null ? '—' : `${c.passRate}%` }}
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose, Document, Timer, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '@/api'

defineProps<{
  variant?: 'embed' | 'page'
}>()

const router = useRouter()
const loading = ref(false)
const running = ref(false)
const lastFetchedAt = ref<number | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const stats = reactive({
  cases: 0,
  casesDelta7d: 0,
  passRate: null as number | null,
  passRateDelta: null as number | null,
  failed: 0,
  failedDelta: null as number | null,
  avgLatencyMs: null as number | null,
  avgLatencyDeltaMs: null as number | null,
  recentRuns: [] as Array<{
    id: string
    caseId?: string
    name?: string
    method?: string
    path?: string
    status?: string
    durationMs?: number | null
    createdAt?: string
  }>,
  collections: [] as Array<{
    project: string
    name: string
    caseCount: number
    passRate: number | null
  }>,
  updatedAt: null as string | null
})

const updatedText = computed(() => {
  if (!lastFetchedAt.value) return ''
  const sec = Math.max(0, Math.round((Date.now() - lastFetchedAt.value) / 1000))
  if (sec < 5) return '刚刚更新'
  if (sec < 60) return `${sec} 秒前更新`
  const min = Math.round(sec / 60)
  return `${min} 分钟前更新`
})

async function refresh(silent = false) {
  if (!silent) loading.value = true
  try {
    const data = await apiClient.getApiTestStats()
    stats.cases = data.cases ?? 0
    stats.casesDelta7d = data.casesDelta7d ?? 0
    stats.passRate = data.passRate ?? null
    stats.passRateDelta = data.passRateDelta ?? null
    stats.failed = data.failed ?? 0
    stats.failedDelta = data.failedDelta ?? null
    stats.avgLatencyMs = data.avgLatencyMs ?? null
    stats.avgLatencyDeltaMs = data.avgLatencyDeltaMs ?? null
    stats.recentRuns = data.recentRuns ?? []
    stats.collections = data.collections ?? []
    stats.updatedAt = data.updatedAt ?? null
    lastFetchedAt.value = Date.now()
  } catch (e: any) {
    if (!silent) {
      ElMessage.error(e?.message || '加载 API Testing 统计失败')
    }
  } finally {
    loading.value = false
  }
}

async function runAll() {
  try {
    await ElMessageBox.confirm('将执行全部已启用的接口用例（测试环境），确认继续？', '全部运行', {
      type: 'warning',
      confirmButtonText: '开始执行',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  running.value = true
  try {
    const list = await apiClient.getApiTestCases({ enabledOnly: true })
    const cases = Array.isArray(list) ? list : (list as any)?.content || []
    const ids = cases.map((c: any) => c.id).filter(Boolean)
    if (!ids.length) {
      ElMessage.warning('没有已启用的用例')
      return
    }
    const result = await apiClient.runApiTest({
      caseIds: ids,
      environment: 'TEST'
    })
    if (result.ok) {
      ElMessage.success(result.message || `全部通过（${result.total}）`)
    } else {
      ElMessage.warning(result.message || `失败 ${result.failed}/${result.total}`)
    }
    await refresh(true)
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

function goCases(project?: string) {
  if (project && project !== '(未分组)') {
    router.push({ path: '/api-collections', query: { project } })
  } else {
    router.push('/api-collections')
  }
}

function formatRate(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v}%`
}

function formatSigned(v: number, suffix = '') {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v}${suffix}`
}

function formatLatency(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function formatSignedLatency(ms: number) {
  const sign = ms > 0 ? '+' : ''
  if (Math.abs(ms) >= 1000) return `${sign}${(ms / 1000).toFixed(1)}s`
  return `${sign}${Math.round(ms)}ms`
}

function methodLabel(m?: string) {
  const u = (m || '').toUpperCase()
  if (u === 'DELETE') return 'DEL'
  if (u === 'GRAPHQL' || u === 'GQL') return 'GQL'
  return u || '—'
}

function methodClass(m?: string) {
  const u = (m || '').toUpperCase()
  if (u === 'POST') return 'm-post'
  if (u === 'GET') return 'm-get'
  if (u === 'PUT' || u === 'PATCH') return 'm-put'
  if (u === 'DELETE') return 'm-del'
  if (u === 'GRAPHQL' || u === 'GQL') return 'm-gql'
  return 'm-other'
}

function relativeTime(iso?: string) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (sec < 60) return `${sec} 秒前`
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟前`
  if (sec < 86400) return `${Math.round(sec / 3600)} 小时前`
  return `${Math.round(sec / 86400)} 天前`
}

onMounted(() => {
  refresh()
  pollTimer = setInterval(() => refresh(true), 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.api-testing {
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 16px 16px 16px;
  box-shadow: none;
}

.api-testing.is-page {
  margin: 0;
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 0;
}

.at-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.at-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.4;
}

.at-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 14px;
  line-height: 1.4;
}

.at-head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.at-play {
  margin-right: 4px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.kpi-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px 14px;
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.kpi-label {
  font-size: 12px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

.kpi-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.kpi-icon.is-blue {
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
}

.kpi-icon.is-green {
  background: var(--el-color-success-light-9);
  color: var(--app-success);
}

.kpi-icon.is-red {
  background: var(--el-color-danger-light-9);
  color: var(--app-danger);
}

.kpi-icon.is-amber {
  background: var(--el-color-warning-light-9);
  color: var(--app-warning);
}

.kpi-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.15;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.kpi-delta {
  font-size: 12px;
  font-weight: 600;
}

.kpi-delta.is-up {
  color: var(--app-primary);
}

.kpi-delta.is-down {
  color: var(--app-danger);
}

.kpi-delta.is-warn {
  color: var(--app-warning);
}

.at-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 10px;
}

.at-panel {
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px 14px 8px;
  min-height: 180px;
}

.panel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.panel-link {
  border: none;
  background: none;
  color: var(--app-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.panel-link:hover {
  text-decoration: underline;
}

.at-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  line-height: 1.6;
}

.run-list,
.coll-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.run-row {
  display: grid;
  grid-template-columns: 10px 48px minmax(0, 1fr) 64px 72px;
  gap: 8px;
  align-items: center;
  padding: 9px 2px;
  border-top: 1px solid var(--el-border-color-extra-light);
  font-size: 12px;
}

.run-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  justify-self: center;
}

.run-dot.ok {
  background: var(--app-success);
}

.run-dot.fail {
  background: var(--app-danger);
}

.method-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.m-post {
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
}

.m-get {
  background: var(--el-color-success-light-9);
  color: var(--app-success);
}

.m-put {
  background: var(--el-color-warning-light-9);
  color: #d48806;
}

.m-del {
  background: var(--el-color-danger-light-9);
  color: var(--app-danger);
}

.m-gql {
  background: #f3e8ff;
  color: #7c3aed;
}

.m-other {
  background: var(--app-surface);
  color: var(--app-text-secondary);
}

.run-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.run-latency,
.run-ago {
  text-align: right;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.coll-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  cursor: pointer;
  transition: border-color 0.15s;
}

.coll-row:hover {
  border-color: var(--el-color-primary-light-5);
}

.coll-name {
  font-weight: 600;
  color: var(--app-text);
  font-size: 13px;
}

.coll-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.coll-rate {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-success);
}

.coll-rate.muted {
  color: var(--el-text-color-placeholder);
  font-weight: 500;
}

@media (max-width: 1100px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .at-grid {
    grid-template-columns: 1fr;
  }
}
</style>
