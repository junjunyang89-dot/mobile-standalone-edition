<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card stat-card-devices" @click="goToDevices()">
          <div class="stat-content">
            <div class="stat-value">{{ connectedSummary.totalConnected }}</div>
            <div class="stat-label">已连接设备</div>
            <div class="stat-platform-links">
              <span class="stat-link" @click.stop="goToDevices('ANDROID')">安卓 {{ connectedSummary.androidCount }}</span>
              <span class="stat-divider">/</span>
              <span class="stat-link" @click.stop="goToDevices('IOS')">iOS {{ connectedSummary.iosCount }}</span>
              <span class="stat-divider">/</span>
              <span class="stat-link" @click.stop="goToDevices('HARMONYOS')">鸿蒙 {{ connectedSummary.harmonyosCount }}</span>
            </div>
          </div>
          <el-icon class="stat-icon"><Monitor /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.tasks }}</div>
            <div class="stat-label">测试任务</div>
          </div>
          <el-icon class="stat-icon"><List /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.running }}</div>
            <div class="stat-label">运行中任务</div>
          </div>
          <el-icon class="stat-icon"><Loading /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.reports }}</div>
            <div class="stat-label">测试报告</div>
          </div>
          <el-icon class="stat-icon"><Document /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card class="quick-test-card">
          <template #header>
            <span>快速测试</span>
          </template>
          <div class="quick-test-buttons">
            <el-button
              v-for="item in quickTestItems"
              :key="item.taskType"
              type="primary"
              size="large"
              @click="goToCreateTask(item.taskType)"
              class="quick-test-btn"
            >
              {{ item.label }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最近任务</span>
          </template>
          <el-table :data="recentTasks" style="width: 100%">
            <el-table-column prop="name" label="任务名称" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间">
              <template #default="{ row }">
                {{ formatTime(row.updatedAt ?? row.updated_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>设备状态</span>
          </template>
          <el-table :data="connectedDevices" style="width: 100%">
            <el-table-column prop="name" label="设备名称" />
            <el-table-column prop="platform" label="平台" width="100">
              <template #default="{ row }">
                {{ platformLabel(row.platform) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'CONNECTED' ? 'success' : 'info'" size="small">
                  {{ row.status === 'CONNECTED' ? '已连接' : '未连接' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <CreateTaskDialog
      v-model="showCreateDialog"
      :initial-task-type="createDialogTaskType"
      @success="onCreateTaskSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Monitor, List, Loading, Document } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import { apiClient } from '@/api'
import CreateTaskDialog from '@/components/CreateTaskDialog.vue'

const router = useRouter()
const taskStore = useTaskStore()

const showCreateDialog = ref(false)
const createDialogTaskType = ref('')

const connectedSummary = ref({
  totalConnected: 0,
  androidCount: 0,
  iosCount: 0,
  harmonyosCount: 0,
  devices: [] as any[]
})

const connectedDevices = ref<any[]>([])

const stats = ref({
  tasks: 0,
  running: 0,
  reports: 0
})
// 报告数暂无单独接口，保持 0；若后端后续提供可在此赋值

const recentTasks = ref([])

function platformLabel(p: string) {
  const map: Record<string, string> = {
    ANDROID: '安卓',
    IOS: 'iOS',
    HARMONYOS: '鸿蒙',
    POG_ANDROID: 'Pog-Android',
    POG_IOS: 'Pog-iOS',
    POGPOG: 'Pog（兼容）'
  }
  return map[(p || '').toUpperCase()] || (p || '—')
}

function goToDevices(platform?: string) {
  if (platform) {
    router.push({ path: '/devices', query: { platform } })
  } else {
    router.push('/devices')
  }
}

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    const summary = await apiClient.getConnectedSummary()
    connectedSummary.value = {
      totalConnected: summary.totalConnected ?? 0,
      androidCount: summary.androidCount ?? 0,
      iosCount: summary.iosCount ?? 0,
      harmonyosCount: summary.harmonyosCount ?? 0,
      devices: summary.devices ?? []
    }
    connectedDevices.value = summary.devices ?? []
  } catch (_e) {
    connectedSummary.value = { totalConnected: 0, androidCount: 0, iosCount: 0, harmonyosCount: 0, devices: [] }
    connectedDevices.value = []
  }
  try {
    await taskStore.fetchTasks()
    stats.value.tasks = taskStore.tasks.length
    stats.value.running = taskStore.tasks.filter(t => t.status === 'running').length
    recentTasks.value = taskStore.tasks.slice(0, 5)
  } catch (_e) {
    stats.value.tasks = 0
    stats.value.running = 0
    recentTasks.value = []
  }
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    stopped: 'info'
  }
  return map[(status || '').toLowerCase()] || 'info'
}

const formatTime = (value: number | string | undefined) => {
  if (value == null || value === '') return '-'
  let date: Date
  if (typeof value === 'string') {
    date = new Date(value)
  } else {
    // 后端可能是 Unix 秒（如 Node）或毫秒（如部分 Java），秒通常 < 1e12
    date = value < 1e12 ? new Date(value * 1000) : new Date(value)
  }
  return isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN')
}

const quickTestItems = [
  { taskType: 'INSTALL_UNINSTALL_UPGRADE_TEST', label: '安装卸载升级测试' },
  { taskType: 'FUNCTIONAL_QUALITY_TEST', label: '功能质量体验测试' },
  { taskType: 'PERFORMANCE_BASELINE_TEST', label: '性能基础质量测试' },
  { taskType: 'COMPATIBILITY_TEST', label: '兼容性测试' },
  { taskType: 'UI_ADAPTATION_TEST', label: '界面与适配测试' },
  { taskType: 'SECURITY_BASELINE_QUALITY_TEST', label: '安全基础质量测试' },
  { taskType: 'PERFORMANCE_MONITORING_TEST', label: '性能指标监控测试' }
]

const goToCreateTask = (taskType: string) => {
  createDialogTaskType.value = taskType
  showCreateDialog.value = true
}

const onCreateTaskSuccess = () => {
  router.push('/tasks')
}
</script>

<style scoped>
.home {
  width: 100%;
}

.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-content {
  display: flex;
  flex-direction: column;
  z-index: 1;
  position: relative;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-platform-links {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.stat-card-devices {
  cursor: pointer;
}

.stat-card-devices:hover {
  border-color: #409eff;
}

.stat-link {
  color: #409eff;
  cursor: pointer;
}

.stat-link:hover {
  text-decoration: underline;
}

.stat-divider {
  margin: 0 4px;
  color: #909399;
}

.stat-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 48px;
  opacity: 0.12;
  color: #409eff;
  pointer-events: none; /* 不阻挡下方内容点击 */
}

.quick-test-card :deep(.el-card__header),
.quick-test-card :deep(.el-card__body) {
  padding-left: 20px;
  padding-right: 20px;
}

.quick-test-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  gap: 12px 12px;
  justify-content: start;
  align-content: start;
}

.quick-test-btn {
  height: 44px;
  margin: 0;
  min-width: 0;
}
</style>
