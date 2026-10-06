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
        <!-- 分支用例和回归用例混在一个分母里，算出来的百分比看不出该找谁；后端按类型拆开前不显示 -->
        <div
          class="kpi-value is-pending"
          title="分支用例挂了是这次改动有问题，回归用例挂了是回归了。混在一起的通过率没有意义，等后端按用例类型拆开统计后再显示"
        >
          待分开统计
        </div>
        <div class="kpi-pending-sub">分支 / 回归分开后显示</div>
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
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose, Document, Timer, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
defineProps<{
  variant?: 'embed' | 'page'
}>()

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

.kpi-value.is-pending {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.kpi-pending-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
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

@media (max-width: 1100px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
