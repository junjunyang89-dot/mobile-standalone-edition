<template>
  <div class="tasks">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>APP测试任务</span>
          <div class="card-header-actions">
            <el-button type="primary" @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon>
              新建任务
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选区域 -->
      <div class="filter-bar">
        <div class="filter-row">
          <span class="filter-label">任务类型：</span>
          <el-radio-group v-model="selectedTaskType" size="small" @change="onFilterChange" class="filter-radio-group">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button
              v-for="item in taskTypeOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
          <!-- 不是任务类型：不产生任务、不进通过率，所以不放进上面的单选组 -->
          <span class="convention-sep" aria-hidden="true" />
          <el-button size="small" type="primary" plain class="convention-entry" @click="showConvention = true">
            <el-icon><DocumentChecked /></el-icon>
            源码约定检查
          </el-button>
        </div>
        <div class="filter-row">
          <span class="filter-label">平台：</span>
          <el-radio-group v-model="selectedPlatform" size="small" @change="onFilterChange" class="filter-radio-group">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button
              v-for="item in platformOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
          <span class="filter-label filter-label-status">状态：</span>
          <el-select
            v-model="selectedStatus"
            placeholder="全部状态"
            size="small"
            clearable
            class="filter-status-select"
            @change="onFilterChange"
          >
            <el-option label="全部状态" :value="''" />
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value" />
          </el-select>
        </div>
        <div class="filter-row filter-row-inputs">
          <span class="filter-label">设备 / 应用：</span>
          <el-input
            v-model="deviceIdKeyword"
            placeholder="设备ID"
            size="small"
            clearable
            class="filter-input"
            @keyup.enter="onFilterChange"
          >
            <template #prepend>设备</template>
          </el-input>
          <el-input
            v-model="appIdKeyword"
            placeholder="应用ID"
            size="small"
            clearable
            class="filter-input"
            @keyup.enter="onFilterChange"
          >
            <template #prepend>应用</template>
          </el-input>
          <el-button type="primary" size="small" @click="onFilterChange">
            筛选
          </el-button>
          <el-button size="small" @click="resetFilters">
            重置
          </el-button>
        </div>
      </div>

      <el-table
        :data="taskStore.tasks"
        v-loading="taskStore.loading"
        class="tasks-table"
        style="width: 100%"
        :header-cell-style="{ background: '#f5f7fa' }"
      >
        <el-table-column
          prop="name"
          label="任务名称"
          min-width="200"
          class-name="col-wrap" />
        <!-- 测试场景：绑定列表接口返回的 scenarioName；老数据后端可能返回「未选择场景(Android)」等，有值即展示，无值显示 - -->
        <el-table-column
          label="测试场景"
          min-width="200"
          class-name="col-wrap"
        >
          <template #default="{ row }">
            {{ (row.scenarioName != null && row.scenarioName !== '') ? String(row.scenarioName).trim() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="taskType" label="任务类型" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" class="cell-tag">{{ getTaskTypeText(row.taskType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="120">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="platformElTagType(row.platform)"
              :class="['platform-tag', 'cell-tag', platformRowClass(row.platform)]"
            >
              {{ getPlatformText(row.platform) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deviceId" label="设备ID" min-width="120" show-overflow-tooltip />
        <el-table-column prop="appId" label="应用ID" min-width="120" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="168" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="op-btns">
              <el-button
                type="primary"
                link
                size="small"
                @click="goToTaskDetail(row)"
              >
                查看详情
              </el-button>
              <el-button
                v-if="isRunnable(row.status)"
                type="primary"
                size="small"
                @click="runTask(row.id)"
              >
                运行
              </el-button>
              <el-button
                v-if="isStoppable(row.status)"
                type="warning"
                size="small"
                @click="stopTask(row.id)"
              >
                停止
              </el-button>
              <el-button v-perm:delete
                type="danger"
                size="small"
                @click="deleteTask(row.id)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="currentPageSize"
          :page-sizes="[10, 20, 50]"
          :total="taskStore.pagination.totalElements"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="onPageChange"
          @size-change="onSizeChange" />
      </div>
    </el-card>

    <CreateTaskDialog
      v-model="showCreateDialog"
      :initial-task-type="createDialogTaskType"
      @success="onCreateTaskSuccess" />

    <ConventionCheckDrawer v-model="showConvention" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, DocumentChecked } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import type { TaskQuery } from '@/stores/task'
import CreateTaskDialog from '@/components/CreateTaskDialog.vue'
import ConventionCheckDrawer from '@/components/ConventionCheckDrawer.vue'
import { platformElTagType, platformRowClass, platformUiLabel } from '@/utils/platform'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const showCreateDialog = ref(false)
const showConvention = ref(false)
const createDialogTaskType = ref('')

// 筛选相关状态
const selectedTaskType = ref<string>('')
const selectedPlatform = ref<string>('')
const selectedStatus = ref<string>('')
const deviceIdKeyword = ref('')
const appIdKeyword = ref('')

/**
 * 任务类型筛选（展示用）：
 * - 现在主用：流程用例、流程性能、性能遍历
 * - 以后可能用：功耗 / 安全 / 稳定 / 兼容
 * - 已下线新建：功能基础质量（历史任务仍可查看，见 getTaskTypeText）
 * - 已拿掉：性能指标监控（看监控页即可）、安装卸载升级（已并入流程关键字）、
 *   界面与适配（暂无落地）、场景化性能重复项
 */
const taskTypeOptions = [
  { value: 'UI_FLOW_TEST', label: '流程用例执行' },
  { value: 'SCENARIO_PERFORMANCE_TEST', label: '流程性能测试' },
  { value: 'PERFORMANCE_BASELINE_TEST', label: '性能遍历探索' },
  { value: 'POWER_CONSUMPTION_BASELINE_TEST', label: '功耗基础质量' },
  { value: 'SECURITY_BASELINE_QUALITY_TEST', label: '安全基础质量' },
  { value: 'STABILITY_QUALITY_TEST', label: '稳定性基础质量' },
  { value: 'COMPATIBILITY_TEST', label: '兼容性测试' }
]

const platformOptions = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' },
]

const statusOptions = [
  { value: 'PENDING', label: '待运行' },
  { value: 'RUNNING', label: '运行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'SKIPPED', label: '已跳过' },
  { value: 'STOPPED', label: '已停止' }
]

const buildFilters = (): TaskQuery | undefined => {
  const filters: TaskQuery = {}

  if (selectedTaskType.value) filters.taskType = selectedTaskType.value
  if (selectedPlatform.value) {
    filters.platform = selectedPlatform.value as TaskQuery['platform']
  }
  if (selectedStatus.value) {
    filters.status = selectedStatus.value as TaskQuery['status']
  }
  if (deviceIdKeyword.value.trim()) filters.deviceId = deviceIdKeyword.value.trim()
  if (appIdKeyword.value.trim()) filters.appId = appIdKeyword.value.trim()

  if (
    !filters.taskType &&
    !filters.platform &&
    !filters.status &&
    !filters.deviceId &&
    !filters.appId
  ) {
    return undefined
  }

  return filters
}

const currentPage = ref(1)
const currentPageSize = ref(10)

const loadTasks = async (opts?: { page?: number; size?: number }) => {
  const page = opts?.page ?? currentPage.value
  const size = opts?.size ?? currentPageSize.value
  const filters = buildFilters()
  await taskStore.fetchTasks(filters, { page, size })
  currentPage.value = taskStore.pagination.page
  currentPageSize.value = taskStore.pagination.size
}

const onPageChange = (page: number) => {
  currentPage.value = page
  loadTasks({ page, size: currentPageSize.value })
}

const onSizeChange = (size: number) => {
  currentPageSize.value = size
  currentPage.value = 1
  loadTasks({ page: 1, size })
}

const validTaskTypes = [
  'UI_FLOW_TEST',
  'SCENARIO_PERFORMANCE_TEST',
  'PERFORMANCE_BASELINE_TEST',
  'POWER_CONSUMPTION_BASELINE_TEST',
  'SECURITY_BASELINE_QUALITY_TEST',
  'STABILITY_QUALITY_TEST',
  'COMPATIBILITY_TEST',
  // 兼容旧链接/历史任务创建入口
  'INSTALL_UNINSTALL_UPGRADE_TEST',
  'PERFORMANCE_MONITORING_TEST',
  'UI_ADAPTATION_TEST'
]

onMounted(() => {
  loadTasks()
  const q = route.query
  if (q.openCreate === '1' && typeof q.taskType === 'string' && validTaskTypes.includes(q.taskType)) {
    createDialogTaskType.value = q.taskType
    showCreateDialog.value = true
    router.replace({ path: '/tasks', query: {} })
  }
})

const onCreateTaskSuccess = () => {
  loadTasks()
}

const getStatusType = (status: string) => {
  const key = status ? status.toLowerCase() : ''
  const map: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    stopped: 'info'
  }
  return map[key] || 'info'
}

const getStatusText = (status: string) => {
  const key = status ? status.toLowerCase() : ''
  const map: Record<string, string> = {
    pending: '待运行',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    stopped: '已停止'
  }
  return map[key] || status
}

const getPlatformText = (platform: string) => {
  if (!platform) return '-'
  return platformUiLabel(platform)
}

const getTaskTypeText = (taskType?: string) => {
  if (!taskType) return '-'
  const map: Record<string, string> = {
    FUNCTIONAL_QUALITY_TEST: '功能基础质量（已下线）',
    UI_FLOW_TEST: '流程用例执行',
    PERFORMANCE_BASELINE_TEST: '性能遍历探索',
    POWER_CONSUMPTION_BASELINE_TEST: '功耗基础质量',
    SCENARIO_PERFORMANCE_TEST: '流程性能测试',
    SECURITY_BASELINE_QUALITY_TEST: '安全基础质量',
    STABILITY_QUALITY_TEST: '稳定性基础质量',
    PERFORMANCE_MONITORING_TEST: '性能指标监控',
    COMPATIBILITY_TEST: '兼容性测试',
    INSTALL_UNINSTALL_UPGRADE_TEST: '安装卸载升级测试',
    UI_ADAPTATION_TEST: '界面与适配测试'
  }
  return map[taskType] || taskType
}

const formatTime = (value: number | string) => {
  if (!value) return '-'
  let date: Date
  if (typeof value === 'string') {
    date = new Date(value)
  } else {
    // 兼容旧数据：后端如果是秒级时间戳
    date = new Date(value * 1000)
  }
  return date.toLocaleString('zh-CN')
}

const onFilterChange = () => {
  currentPage.value = 1
  loadTasks({ page: 1, size: currentPageSize.value })
}

const resetFilters = () => {
  selectedTaskType.value = ''
  selectedPlatform.value = ''
  selectedStatus.value = ''
  deviceIdKeyword.value = ''
  appIdKeyword.value = ''
  currentPage.value = 1
  loadTasks({ page: 1, size: currentPageSize.value })
}

const isRunnable = (status: string) => {
  const s = (status || '').toLowerCase()
  // 已完成也可再跑，方便同配置重复采样对比
  return s === 'pending' || s === 'stopped' || s === 'failed' || s === 'completed'
}
const isStoppable = (status: string) => (status || '').toLowerCase() === 'running'

const runTask = async (taskId: string) => {
  try {
    await taskStore.runTask(taskId)
    ElMessage.success('任务已启动')
    await loadTasks({ page: currentPage.value, size: currentPageSize.value })
  } catch (error: any) {
    ElMessage.error(error.message || '启动失败')
  }
}

const stopTask = async (taskId: string) => {
  try {
    await taskStore.stopTask(taskId)
    ElMessage.success('任务已停止')
    await loadTasks({ page: currentPage.value, size: currentPageSize.value })
  } catch (error: any) {
    ElMessage.error(error.message || '停止失败')
  }
}

/** 跳转到任务详情概览页（自动化测试任务详情） */
const goToTaskDetail = (row: { id?: string; taskId?: string }) => {
  const id = row?.id ?? row?.taskId
  if (id) router.push({ name: 'TaskOverview', params: { id } })
}

const deleteTask = async (taskId: string) => {
  try {
    await ElMessageBox.confirm(
      '删除将先停止任务（若正在运行），再删除任务及关联记录。确定要删除此任务吗？',
      '删除任务',
      { type: 'warning' }
    )
    await taskStore.deleteTask(taskId)
    ElMessage.success('删除成功')
    await loadTasks({ page: currentPage.value, size: currentPageSize.value })
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}
</script>

<style scoped>
.tasks {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 筛选区字号对齐「流程编排」：13px 标签/选项，内边距更紧 */
.filter-bar {
  padding: 14px 16px 12px;
  margin-bottom: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--app-border);
  font-family: var(--app-font-family);
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 10px;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-row-inputs {
  margin-top: 2px;
}

.filter-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 400;
  line-height: 22px;
  min-width: 72px;
}

.filter-label-status {
  margin-left: 8px;
}

.filter-radio-group {
  margin-right: 8px;
}

.filter-radio-group :deep(.el-radio-button__inner) {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 400;
  line-height: 22px;
  font-family: var(--app-font-family);
}

.filter-status-select {
  width: 150px;
}

.convention-sep {
  width: 1px;
  height: 16px;
  background: var(--el-border-color);
}

.convention-entry {
  height: 24px;
  padding: 0 10px;
  border-radius: 4px;
  font-size: 12px;
}

.convention-entry :deep(.el-icon) {
  margin-right: 2px;
  font-size: 13px;
}

.filter-status-select :deep(.el-select__wrapper),
.filter-status-select :deep(.el-input__inner),
.filter-input :deep(.el-input__wrapper),
.filter-input :deep(.el-input__inner),
.filter-input :deep(.el-input-group__prepend) {
  font-size: 13px;
}

.filter-bar :deep(.el-button) {
  font-size: 13px;
  --el-button-size: 28px;
}

.filter-input {
  width: 200px;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 表格：标签列限制溢出；名称/场景列允许换行完整展示 */
.tasks-table :deep(.el-table__cell) {
  vertical-align: middle;
}

.tasks-table :deep(.el-table .cell) {
  line-height: 1.4;
}

.tasks-table :deep(.col-wrap .cell) {
  white-space: normal;
  word-break: break-word;
  line-height: 1.5;
  overflow: visible;
  text-overflow: unset;
}

.cell-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.op-btns {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}

/* Pog 平台标签：与 Android / iOS 色系对齐，便于区分 */
.platform-tag.pog_android {
  border-color: #95d475;
}
.platform-tag.pog_ios {
  border-color: var(--el-color-primary-light-7);
}
</style>
