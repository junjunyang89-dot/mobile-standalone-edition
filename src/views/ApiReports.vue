<template>
  <div class="api-reports">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">执行报告</span>
            <p class="card-sub">每次执行都留一份。打开一份报告，失败的用例排在最前面。</p>
          </div>
          <el-select v-model="days" style="width: 130px" @change="loadTrend">
            <el-option :value="7" label="近 7 天" />
            <el-option :value="30" label="近 30 天" />
            <el-option :value="90" label="近 90 天" />
          </el-select>
        </div>
      </template>

      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-label">通过率（{{ days }}天）</div>
          <div class="stat-num" :class="rateClass(summary.rate)">
            {{ summary.total ? summary.rate + '%' : '—' }}
          </div>
          <!-- 迷你趋势线：不引图表库，一条 polyline 够看走向了 -->
          <svg v-if="spark.length > 1" class="spark" viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline :points="sparkPoints" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <div class="stat-card">
          <div class="stat-label">执行次数</div>
          <div class="stat-num">{{ summary.runs }}</div>
          <div class="stat-sub">
            <span class="ok">{{ summary.passed }} 通过</span>
            <span class="bad">{{ summary.failed }} 失败</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均耗时</div>
          <div class="stat-num">{{ avgDuration }}</div>
          <div class="stat-sub">每次执行</div>
        </div>
      </div>

      <div class="section-head">执行历史</div>
      <el-table :data="runs" v-loading="loading" @row-click="openRun" class="run-table">
        <el-table-column label="报告" min-width="220">
          <template #default="{ row }">
            <span class="run-name">{{ row.collectionName || '手动选择用例' }}</span>
            <el-tag size="small" :type="row.environment === 'PROD' ? 'danger' : 'info'" effect="plain">
              {{ row.environment === 'PROD' ? '线上' : '测试' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="结果" width="150">
          <template #default="{ row }">
            <span class="ok">{{ row.passed }}</span> / {{ row.total }}
            <span v-if="row.failed" class="bad">（{{ row.failed }} 失败）</span>
          </template>
        </el-table-column>
        <el-table-column label="通过率" width="180">
          <template #default="{ row }">
            <div class="rate-bar">
              <div class="rate-fill" :class="rateClass(pct(row))" :style="{ width: pct(row) + '%' }" />
              <span class="rate-text">{{ pct(row) }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">{{ dur(row.durationMs) }}</template>
        </el-table-column>
        <template #empty>
          <div class="empty-tip">还没有执行记录。去「用例集合」或「接口列表」跑一次。</div>
        </template>
      </el-table>
    </el-card>

    <el-drawer v-model="drawer" size="60%" destroy-on-close>
      <template #header>
        <div class="drawer-head">
          <span class="drawer-title">{{ detail?.run?.collectionId ? '集合执行' : '手动执行' }}</span>
          <span v-if="detail?.run" class="drawer-sub">
            {{ fmt(detail.run.createdAt) }} · {{ detail.run.environment }} ·
            通过 {{ detail.run.passed }}/{{ detail.run.total }} · {{ dur(detail.run.durationMs) }}
          </span>
        </div>
      </template>
      <div v-loading="detailLoading">
        <el-alert
          v-if="detail?.run && detail.run.failed > 0"
          type="error"
          :closable="false"
          :title="`${detail.run.failed} 条失败，已排在最前面`"
          class="drawer-alert"
        />
        <div v-for="c in detail?.cases || []" :key="c.id" class="case-row" :class="c.status.toLowerCase()">
          <div class="case-head">
            <el-tag size="small" :type="c.status === 'PASSED' ? 'success' : 'danger'">
              {{ c.status === 'PASSED' ? '通过' : '失败' }}
            </el-tag>
            <el-tag size="small" effect="plain">{{ c.method }}</el-tag>
            <span class="case-name">{{ c.name }}</span>
            <span class="case-spacer" />
            <span class="case-meta">
              <template v-if="c.httpStatus">HTTP {{ c.httpStatus }} · </template>{{ c.durationMs }}ms
            </span>
          </div>
          <div class="case-url">{{ c.url }}</div>
          <div v-if="c.error" class="case-error">{{ c.error }}</div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

/**
 * 执行报告。对应参考页的 Reports。
 *
 * 趋势按天聚合而不是逐次画：一天里手动重跑十几次很正常，
 * 逐次画出来是一片锯齿，看不出走向，只会让人以为质量在剧烈波动。
 */

const route = useRoute()
const runs = ref<any[]>([])
const trendRows = ref<any[]>([])
const days = ref(7)
const loading = ref(false)
const drawer = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)

const summary = computed(() => {
  let runsN = 0
  let total = 0
  let passed = 0
  let failed = 0
  for (const r of trendRows.value) {
    runsN += Number(r.runs || 0)
    total += Number(r.total || 0)
    passed += Number(r.passed || 0)
    failed += Number(r.failed || 0)
  }
  return { runs: runsN, total, passed, failed, rate: total ? Math.round((passed * 100) / total) : 0 }
})

/** 每天的通过率，给迷你趋势线 */
const spark = computed(() =>
  trendRows.value.map((r) => {
    const t = Number(r.total || 0)
    return t ? (Number(r.passed || 0) * 100) / t : 0
  })
)

const sparkPoints = computed(() => {
  const v = spark.value
  if (v.length < 2) return ''
  const step = 100 / (v.length - 1)
  // 固定 0-100 的纵轴而不是按数据范围自适应：自适应会把 98%→97% 画成断崖，
  // 看板骗人比看板难看糟糕得多
  return v.map((y, i) => `${(i * step).toFixed(1)},${(30 - (y / 100) * 28).toFixed(1)}`).join(' ')
})

const avgDuration = computed(() => {
  if (!runs.value.length) return '—'
  const ms = runs.value.reduce((n, r) => n + Number(r.durationMs || 0), 0) / runs.value.length
  return dur(ms)
})

function pct(row: any) {
  const t = Number(row.total || 0)
  return t ? Math.round((Number(row.passed || 0) * 100) / t) : 0
}

function rateClass(rate: number) {
  if (rate >= 95) return 'good'
  if (rate >= 80) return 'warn'
  return 'bad'
}

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function dur(ms: number) {
  const n = Number(ms || 0)
  if (n < 1000) return Math.round(n) + 'ms'
  if (n < 60000) return (n / 1000).toFixed(1) + 's'
  return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's'
}

async function load() {
  loading.value = true
  try {
    runs.value = await apiClient.getApiTestRuns({ limit: 50 })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadTrend() {
  try {
    trendRows.value = await apiClient.getApiTestTrend(days.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载趋势失败')
  }
}

async function openRun(row: any) {
  drawer.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await apiClient.getApiTestRunDetail(row.id)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([load(), loadTrend()])
  // 刚跑完从集合页跳过来，直接把那份报告打开
  const runId = String(route.query.runId || '')
  if (runId) openRun({ id: runId })
})
</script>

<style scoped>
.api-reports {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px 18px;
  position: relative;
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat-num {
  font-size: 32px;
  font-weight: 700;
  margin-top: 6px;
  line-height: 1.2;
}
.stat-num.good {
  color: var(--el-color-success);
}
.stat-num.warn {
  color: var(--el-color-warning);
}
.stat-num.bad {
  color: var(--el-color-danger);
}
.stat-sub {
  margin-top: 6px;
  font-size: 12px;
  display: flex;
  gap: 12px;
}
.spark {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 90px;
  height: 30px;
  color: var(--el-color-success);
  opacity: 0.7;
}
.ok {
  color: var(--el-color-success);
}
.bad {
  color: var(--el-color-danger);
}
.section-head {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.run-table :deep(tr) {
  cursor: pointer;
}
.run-name {
  font-weight: 500;
  margin-right: 8px;
}
.rate-bar {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  display: flex;
  align-items: center;
}
.rate-fill {
  height: 100%;
  border-radius: 4px;
}
.rate-fill.good {
  background: var(--el-color-success);
}
.rate-fill.warn {
  background: var(--el-color-warning);
}
.rate-fill.bad {
  background: var(--el-color-danger);
}
.rate-text {
  position: absolute;
  right: -34px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.empty-tip {
  padding: 24px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.drawer-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
}
.drawer-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.drawer-alert {
  margin-bottom: 14px;
}
.case-row {
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-success);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 8px;
}
.case-row.failed {
  border-left-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.case-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.case-name {
  font-size: 13px;
  font-weight: 500;
}
.case-spacer {
  flex: 1;
}
.case-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: none;
}
.case-url {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.case-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
  line-height: 1.6;
  word-break: break-all;
}
</style>
