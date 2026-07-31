<template>
  <div class="reports">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>测试报告</span>
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
          v-model="filterStatus"
          placeholder="全部状态"
          size="small"
          clearable
          class="filter-status"
          @change="onFilterChange"
        >
          <el-option label="全部状态" value="" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="失败" value="FAILED" />
          <el-option label="运行中" value="RUNNING" />
          <el-option label="待运行" value="PENDING" />
        </el-select>
      </div>

      <el-table :data="reports" v-loading="loading" class="reports-table" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column prop="taskName" label="任务名称" min-width="140" width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.taskName || row.name || row.id || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="taskType" label="测试类型" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ taskTypeLabel(row.taskType) }}
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="platformElTagType(row.platform)"
              :class="['platform-tag', platformRowClass(row.platform)]"
            >{{ platformUiLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt ?? row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openReport(row)">
              查看报告
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="paginationTotal > 0" class="reports-pagination">
        <el-pagination
          v-model:current-page="paginationPage"
          v-model:page-size="paginationSize"
          :page-sizes="[10, 20, 50]"
          :total="paginationTotal"
          layout="total, sizes, prev, pager, next"
          @current-change="loadReports"
          @size-change="loadReports" />
      </div>
      <el-empty v-if="!loading && reports.length === 0" description="暂无测试报告" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { platformElTagType, platformRowClass, platformUiLabel } from '@/utils/platform'

const router = useRouter()
const reports = ref<any[]>([])
const loading = ref(false)
const filterDays = ref(0)
const filterStatus = ref('')
const paginationPage = ref(1)
const paginationSize = ref(10)
const paginationTotal = ref(0)

const loadReports = async () => {
  loading.value = true
  try {
    const params: { page: number; size: number; days?: number; status?: string } = {
      page: paginationPage.value,
      size: paginationSize.value
    }
    if (filterDays.value > 0) params.days = filterDays.value
    if (filterStatus.value) params.status = filterStatus.value
    const data = await apiClient.getFunctionalTestTasks(params)
    reports.value = Array.isArray(data?.content) ? data.content : []
    paginationTotal.value = data?.totalElements ?? 0
  } catch (error: any) {
    console.error('Load reports error:', error)
    ElMessage.error(error?.message || '加载报告失败')
    reports.value = []
    paginationTotal.value = 0
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  paginationPage.value = 1
  loadReports()
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
    FUNCTIONAL_QUALITY_TEST: '功能体验基础质量测试',
    PERFORMANCE_BASELINE_TEST: '性能基础质量测试',
    PERFORMANCE_MONITORING_TEST: '性能指标监控测试',
    STABILITY_QUALITY_TEST: '稳定性基础质量测试',
    COMPATIBILITY_TEST: '兼容性测试',
    INSTALL_UNINSTALL_UPGRADE_TEST: '安装卸载升级测试',
    UI_ADAPTATION_TEST: '界面与适配测试'
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

/** 查看报告：跳转到任务详情概览页（overview + 达标率 + 检测规则 + 执行日志 + 截图） */
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
  align-items: center;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-status {
  width: 140px;
}

.reports-table {
  width: 100%;
}

.reports-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
</style>
