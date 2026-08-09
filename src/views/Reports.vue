<template>
  <div class="reports">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <span class="page-title">APP UI测试报告</span>
            <p class="page-sub">覆盖完美世界电竞 / PogPog（Android、iOS），鸿蒙预留；与 App 性能报告分开</p>
          </div>
          <el-button type="primary" :loading="loading" @click="loadReports">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-radio-group v-model="filterDays" size="small" @change="onFilterChange">
          <el-radio-button :value="0">全部</el-radio-button>
          <el-radio-button :value="3">近三天</el-radio-button>
          <el-radio-button :value="7">近一周</el-radio-button>
        </el-radio-group>

        <el-select
          v-model="filterApp"
          placeholder="全部应用"
          size="small"
          clearable
          class="filter-select"
          @change="onFilterChange"
        >
          <el-option label="全部应用" value="" />
          <el-option label="完美世界电竞" value="esports" />
          <el-option label="PogPog" value="pog" />
        </el-select>

        <el-select
          v-model="filterPlatform"
          placeholder="全部平台"
          size="small"
          clearable
          class="filter-select"
          @change="onFilterChange"
        >
          <el-option label="全部平台" value="" />
          <el-option label="Android" value="ANDROID" />
          <el-option label="iOS" value="IOS" />
          <el-option label="HarmonyOS（预留）" value="HARMONYOS" />
        </el-select>

        <el-select
          v-model="filterReportType"
          placeholder="全部类型"
          size="small"
          clearable
          class="filter-select"
          @change="onFilterChange"
        >
          <el-option label="全部类型" value="" />
          <el-option label="流程用例执行" value="UI_FLOW_TEST" />
          <el-option label="功能基础质量（已下线）" value="FUNCTIONAL_QUALITY_TEST" />
          <el-option label="兼容性测试" value="COMPATIBILITY_TEST" />
        </el-select>

        <el-select
          v-model="filterStatus"
          placeholder="全部状态"
          size="small"
          clearable
          class="filter-select"
          @change="onFilterChange"
        >
          <el-option label="全部状态" value="" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="失败" value="FAILED" />
          <el-option label="运行中" value="RUNNING" />
          <el-option label="待运行" value="PENDING" />
          <el-option label="已停止" value="STOPPED" />
        </el-select>
      </div>

      <el-table :data="pagedReports" v-loading="loading" class="reports-table" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column prop="taskName" label="任务名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.taskName || row.name || row.id || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="应用" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ appFamilyLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="taskType" label="测试类型" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ taskTypeLabel(row.taskType) }}
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="platformElTagType(row.platform)"
              :class="['platform-tag', platformRowClass(row.platform)]"
            >{{ platformUiLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt ?? row.created_at ?? row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openReport(row)">
              查看报告
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredReports.length > 0" class="reports-pagination">
        <el-pagination
          v-model:current-page="paginationPage"
          v-model:page-size="paginationSize"
          :page-sizes="[10, 20, 50]"
          :total="filteredReports.length"
          layout="total, sizes, prev, pager, next"
          @current-change="noop"
          @size-change="onSizeChange"
        />
      </div>
      <el-empty v-if="!loading && filteredReports.length === 0" description="暂无 APP UI 测试报告" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { platformElTagType, platformRowClass, platformUiLabel } from '@/utils/platform'

const router = useRouter()
const allReports = ref<any[]>([])
const loading = ref(false)
const filterDays = ref(0)
const filterStatus = ref('')
const filterApp = ref('')
const filterPlatform = ref('')
const filterReportType = ref('')
const paginationPage = ref(1)
const paginationSize = ref(10)

/** UI 报告：排除纯性能任务类型 */
const PERF_TYPES = new Set([
  'PERFORMANCE_BASELINE_TEST',
  'SCENARIO_PERFORMANCE_TEST',
  'PERFORMANCE_MONITORING_TEST',
  'PERFORMANCE_QUALITY_TEST'
])

function normalizeAppFamily(row: any): 'esports' | 'pog' | 'other' {
  const id = String(row.appId || row.app_id || '').toUpperCase()
  const name = `${row.taskName || ''} ${row.name || ''} ${row.appName || ''}`.toLowerCase()
  if (
    id === 'DOMESTIC_ESPORTS' ||
    id.includes('ESPORTS') ||
    name.includes('电竞') ||
    name.includes('esports') ||
    name.includes('steam.esports')
  ) {
    return 'esports'
  }
  if (
    id === 'OVERSEAS_POGPOG' ||
    id.includes('POG') ||
    name.includes('pog') ||
    name.includes('pogpog')
  ) {
    return 'pog'
  }
  return 'other'
}

function appFamilyLabel(row: any) {
  const f = normalizeAppFamily(row)
  if (f === 'esports') return '完美世界电竞'
  if (f === 'pog') return 'PogPog'
  return row.appId || '—'
}

function isUiReportType(taskType?: string) {
  const t = (taskType || '').toUpperCase()
  if (!t) return true
  return !PERF_TYPES.has(t)
}

function withinDays(row: any, days: number) {
  if (!days || days <= 0) return true
  const raw = row.createdAt ?? row.created_at ?? row.updatedAt
  if (raw == null || raw === '') return true
  const d = typeof raw === 'number' ? (raw < 1e12 ? new Date(raw * 1000) : new Date(raw)) : new Date(raw)
  if (Number.isNaN(d.getTime())) return true
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return d.getTime() >= cutoff
}

const filteredReports = computed(() => {
  return allReports.value.filter((row) => {
    if (!isUiReportType(row.taskType)) return false
    if (!withinDays(row, filterDays.value)) return false
    if (filterStatus.value && String(row.status || '').toUpperCase() !== filterStatus.value) return false
    if (filterPlatform.value && String(row.platform || '').toUpperCase() !== filterPlatform.value) {
      return false
    }
    if (filterReportType.value && String(row.taskType || '').toUpperCase() !== filterReportType.value) {
      return false
    }
    if (filterApp.value) {
      const family = normalizeAppFamily(row)
      if (family !== filterApp.value) return false
    }
    return true
  })
})

const pagedReports = computed(() => {
  const start = (paginationPage.value - 1) * paginationSize.value
  return filteredReports.value.slice(start, start + paginationSize.value)
})

const loadReports = async () => {
  loading.value = true
  try {
    // 拉多页合并，前端做应用/平台分类过滤（功能任务列表接口参数有限）
    const pages: any[] = []
    let page = 1
    const size = 50
    let totalPages = 1
    do {
      const data = await apiClient.getTasks(
        {
          status: (filterStatus.value || undefined) as any,
          platform: filterPlatform.value || undefined
        },
        { page, size }
      )
      pages.push(...(data?.content || []))
      totalPages = Math.max(1, data?.totalPages ?? 1)
      page += 1
    } while (page <= Math.min(totalPages, 6))

    // 兼容：功能测试列表也可能含专项任务
    try {
      const ft = await apiClient.getFunctionalTestTasks({
        page: 1,
        size: 50,
        days: filterDays.value > 0 ? filterDays.value : undefined,
        status: filterStatus.value || undefined
      })
      const existing = new Set(pages.map((r) => r.id))
      for (const row of ft?.content || []) {
        if (row?.id && !existing.has(row.id)) pages.push(row)
      }
    } catch {
      /* 功能列表可选 */
    }

    pages.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return tb - ta
    })
    allReports.value = pages
  } catch (error: any) {
    console.error('Load reports error:', error)
    ElMessage.error(error?.message || '加载报告失败')
    allReports.value = []
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  paginationPage.value = 1
  loadReports()
}

function onSizeChange() {
  paginationPage.value = 1
}

function noop() {
  /* pagination current-change handled by v-model */
}

const formatTime = (value: number | string | undefined) => {
  if (value == null || value === '') return '—'
  let date: Date
  if (typeof value === 'string') {
    date = new Date(value)
  } else {
    date = value < 1e12 ? new Date(value * 1000) : new Date(value)
  }
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

function taskTypeLabel(type: string) {
  const map: Record<string, string> = {
    FUNCTIONAL_QUALITY_TEST: '功能基础质量（已下线）',
    UI_FLOW_TEST: '流程用例执行',
    COMPATIBILITY_TEST: '兼容性测试',
    INSTALL_UNINSTALL_UPGRADE_TEST: '安装卸载升级',
    UI_ADAPTATION_TEST: '界面与适配',
    STABILITY_QUALITY_TEST: '稳定性基础质量',
    SECURITY_BASELINE_QUALITY_TEST: '安全基础质量',
    POWER_CONSUMPTION_BASELINE_TEST: '功耗基础质量'
  }
  return map[(type || '').toUpperCase()] || type || '—'
}

function statusText(s: string) {
  const map: Record<string, string> = {
    COMPLETED: '已完成',
    FAILED: '失败',
    RUNNING: '运行中',
    PENDING: '待运行',
    STOPPED: '已停止'
  }
  return map[(s || '').toUpperCase()] || s || '—'
}

function statusTagType(s: string) {
  const map: Record<string, string> = {
    COMPLETED: 'success',
    FAILED: 'danger',
    RUNNING: 'warning',
    PENDING: 'info',
    STOPPED: 'info'
  }
  return map[(s || '').toUpperCase()] || 'info'
}

const openReport = (row: { id?: string; taskId?: string }) => {
  const id = row?.id ?? row?.taskId
  if (id) router.push({ name: 'TaskOverview', params: { id } })
  else ElMessage.warning('无法获取任务 ID')
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.reports {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}

.page-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.filter-select {
  width: 150px;
}

.reports-table {
  width: 100%;
}

.reports-pagination {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}
</style>
