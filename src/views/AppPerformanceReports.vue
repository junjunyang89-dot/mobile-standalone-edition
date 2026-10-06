<template>
  <div class="perf-reports">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <span class="page-title">完美世界电竞 · 性能报告</span>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/performance-baseline')">新建性能测试</el-button>
            <el-button type="primary" :loading="loading" @click="loadList">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <div class="filter-bar">
        <el-radio-group v-model="filterKind" size="small" @change="onFilterChange">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="SCENARIO_PERFORMANCE_TEST">流程性能测试</el-radio-button>
          <el-radio-button value="PERFORMANCE_BASELINE_TEST">性能遍历探索</el-radio-button>
        </el-radio-group>
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

      <el-table
        v-loading="loading"
        :data="pagedRows"
        stripe
        class="reports-table"
        :header-cell-style="{ background: '#f5f7fa' }"
        empty-text="暂无电竞性能报告，请先到「安卓性能测试」创建并执行"
      >
        <el-table-column label="任务名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.name || row.taskName || row.id }}
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag size="small" :type="row.taskType === 'SCENARIO_PERFORMANCE_TEST' ? 'warning' : 'primary'">
              {{ kindLabel(row.taskType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="platformElTagType(row.platform)"
              :class="['platform-tag', platformRowClass(row.platform)]"
            >
              {{ platformUiLabel(row.platform) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openOverview(row)">查看报告</el-button>
            <el-button type="success" link size="small" @click="openCurves(row)">看曲线</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredRows.length > 0" class="reports-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="filteredRows.length"
          layout="total, sizes, prev, pager, next"
          @size-change="page = 1"
        />
      </div>
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
const loading = ref(false)
const rows = ref<any[]>([])
const filterKind = ref('')
const filterPlatform = ref('')
const filterStatus = ref('')
const page = ref(1)
const pageSize = ref(10)

function isEsportsTask(row: any) {
  const id = String(row.appId || '').toUpperCase()
  const text = `${row.name || ''} ${row.taskName || ''} ${row.appId || ''}`.toLowerCase()
  if (id === 'DOMESTIC_ESPORTS' || id.includes('ESPORTS')) return true
  if (text.includes('电竞') || text.includes('esports') || text.includes('steam.esports')) return true
  // 无明确 appId 时：Android 性能任务默认归到电竞列表（当前主产品）
  if (!id && isAndroidFamilyPlatform(String(row.platform || ''))) return true
  return false
}

const filteredRows = computed(() => {
  return rows.value.filter((row) => {
    if (!isEsportsTask(row)) return false
    if (filterKind.value && String(row.taskType || '').toUpperCase() !== filterKind.value) return false
    if (filterPlatform.value && String(row.platform || '').toUpperCase() !== filterPlatform.value) return false
    if (filterStatus.value && String(row.status || '').toUpperCase() !== filterStatus.value) return false
    return true
  })
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

function kindLabel(t?: string) {
  if (t === 'SCENARIO_PERFORMANCE_TEST') return '流程性能'
  if (t === 'PERFORMANCE_BASELINE_TEST') return '遍历探索'
  return t || '—'
}

function statusText(s?: string) {
  const map: Record<string, string> = {
    COMPLETED: '已完成',
    FAILED: '失败',
    RUNNING: '运行中',
    PENDING: '待运行',
    STOPPED: '已停止'
  }
  return map[(s || '').toUpperCase()] || s || '—'
}

function statusTagType(s?: string) {
  const map: Record<string, string> = {
    COMPLETED: 'success',
    FAILED: 'danger',
    RUNNING: 'warning',
    PENDING: 'info',
    STOPPED: 'info'
  }
  return map[(s || '').toUpperCase()] || 'info'
}

function formatTime(value?: number | string) {
  if (value == null || value === '') return '—'
  const date = typeof value === 'number' ? (value < 1e12 ? new Date(value * 1000) : new Date(value)) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

const loadList = async () => {
  loading.value = true
  try {
    const [scenario, baseline] = await Promise.all([
      apiClient.getTasks(
        {
          taskType: 'SCENARIO_PERFORMANCE_TEST',
          platform: filterPlatform.value || undefined,
          status: (filterStatus.value || undefined) as any
        },
        { page: 1, size: 50 }
      ),
      apiClient.getTasks(
        {
          taskType: 'PERFORMANCE_BASELINE_TEST',
          platform: filterPlatform.value || undefined,
          status: (filterStatus.value || undefined) as any
        },
        { page: 1, size: 50 }
      )
    ])
    const merged = [...(scenario?.content || []), ...(baseline?.content || [])]
    merged.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return tb - ta
    })
    rows.value = merged
  } catch (e: any) {
    console.error(e)
    ElMessage.error(e?.message || '加载性能报告失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  page.value = 1
  loadList()
}

function openOverview(row: { id?: string }) {
  if (!row?.id) {
    ElMessage.warning('无法获取任务 ID')
    return
  }
  router.push({ name: 'TaskOverview', params: { id: row.id } })
}

function openCurves(row: { id?: string }) {
  if (!row?.id) {
    ElMessage.warning('无法获取任务 ID')
    return
  }
  router.push({ path: '/performance', query: { taskId: row.id } })
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.perf-reports {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.filter-select {
  width: 140px;
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
