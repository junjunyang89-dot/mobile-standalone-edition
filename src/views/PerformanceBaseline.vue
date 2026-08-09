<template>
  <div class="performance-baseline">
    <div class="breadcrumb">
      <el-button link @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <span class="separator">|</span>
      <span class="current-page">App 性能测试 · 完美世界电竞</span>
    </div>

    <div class="progress-steps">
      <el-steps :active="currentStep" finish-status="success">
        <el-step title="选择流程" />
        <el-step title="执行并采样" />
        <el-step title="性能监控" />
      </el-steps>
    </div>

    <el-card class="task-form-card">
      <el-alert
        type="success"
        :closable="false"
        show-icon
        style="margin-bottom: 16px; max-width: 800px"
      >
        <template #title>App 性能与 UI 功能分开</template>
        <div>
          <div>这里只跑用途为<strong>「仅性能测试」</strong>的流程，不和 APP 回归 / 自动化编排混用。</div>
          <div style="margin-top: 4px"><b>UI 功能</b>：流程编排里「两边共用 / 仅自动化 / 仅线上回归」，做断言与回归。</div>
          <div style="margin-top: 4px"><b>App 性能</b>：单独建「仅性能测试」流程（冷启/热启 + 路径），在此采 CPU/内存/FPS。</div>
          <div style="margin-top: 4px"><b>同设备互斥</b>：一台机不能同时跑功能任务和性能任务。</div>
        </div>
      </el-alert>

      <el-form
        ref="formRef"
        :model="taskForm"
        :rules="formRules"
        label-width="120px"
        label-position="left"
      >
        <el-form-item label="测试模式" prop="mode" required>
          <el-radio-group v-model="taskForm.mode" @change="onModeChange">
            <el-radio value="scenario">流程性能测试（推荐）</el-radio>
            <el-radio value="baseline">遍历探索</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="任务名称" prop="taskName">
          <el-input
            v-model="taskForm.taskName"
            placeholder="不填则自动生成"
            maxlength="60"
            show-word-limit
            style="width: 400px"
          />
        </el-form-item>

        <el-form-item label="平台类型" prop="platform" required>
          <el-radio-group v-model="taskForm.platform" @change="handlePlatformChange">
            <el-radio value="ANDROID">Android</el-radio>
            <el-radio value="IOS">iOS</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-alert
          v-if="isIosPlatform"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px; max-width: 800px"
        >
          iOS 请用「流程性能测试」。实时曲线依赖 Tidevice（建议先在 15.x 验证；17+ 可能不稳）。
          MetricKit 需测试包上报：<code>POST /api/functional-test/tasks/&#123;taskId&#125;/metrickit</code>
        </el-alert>

        <el-form-item
          v-if="taskForm.mode === 'scenario'"
          label="功能流程"
          prop="flowId"
          required
        >
          <el-select
            v-model="taskForm.flowId"
            placeholder="请选择「仅性能测试」用途的流程"
            style="width: 400px"
            filterable
            :loading="flowsLoading"
            :disabled="!taskForm.platform"
          >
            <el-option
              v-for="f in flowOptions"
              :key="f.id"
              :label="f.name || f.id"
              :value="f.id"
            >
              <div style="display: flex; flex-direction: column">
                <span>{{ f.name || f.id }}</span>
                <span style="font-size: 12px; color: #909399">
                  {{ f.id }}{{ f.appId ? ` · ${f.appId}` : '' }}{{ f.platform ? ` · ${f.platform}` : '' }}
                </span>
              </div>
            </el-option>
          </el-select>
          <el-button link style="margin-left: 10px" @click="router.push('/ui-flows')">
            去流程编排
          </el-button>
          <el-button link :loading="flowsLoading" :disabled="!taskForm.platform" @click="loadFlows">
            刷新流程
          </el-button>
          <el-alert
            v-if="taskForm.platform && !flowsLoading && flowOptions.length === 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: 8px; max-width: 640px"
          >
            当前平台暂无「仅性能测试」流程。请到「流程编排」新建，用途选「仅性能测试（App 性能专用）」。
          </el-alert>
        </el-form-item>

        <el-form-item
          v-if="taskForm.mode === 'baseline' && !isIosPlatform"
          label="执行时长"
          prop="traversalMinutes"
          required
        >
          <el-select v-model="taskForm.traversalMinutes" style="width: 400px">
            <el-option
              v-for="m in traversalMinutesOptions"
              :key="m"
              :label="m >= 30 ? `${m} 分钟（稳定性长跑）` : `${m} 分钟`"
              :value="m"
            />
          </el-select>
          <div class="form-tip">
            <strong>≥30 分钟即当稳定性测试用</strong>：遍历全程盯着 logcat，
            结束时把崩溃 / ANR 连堆栈一起写进报告，并计入版本基线（崩溃次数会和上个版本比）。
            短时遍历点不出偶发崩溃，而那正是稳定性要找的东西。<br />
            建议挂在功能测试期间的夜里跑，白天设备要用来跑回归。
          </div>
        </el-form-item>

        <el-alert
          v-if="taskForm.mode === 'baseline' && isIosPlatform"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 12px; max-width: 640px"
        >
          iOS 不支持「遍历探索」，请改用「流程性能测试」。
        </el-alert>

        <el-form-item label="测试设备" prop="deviceId" required>
          <el-select
            v-model="taskForm.deviceId"
            placeholder="请先选择平台，再选已连接设备"
            style="width: 400px"
            filterable
            :disabled="!taskForm.platform"
            :loading="devicesLoading"
            @visible-change="(v: boolean) => v && loadDevices()"
          >
            <el-option
              v-for="device in devices"
              :key="device.id"
              :label="`${device.name} (${device.version || '-'})`"
              :value="device.id"
              :disabled="device.status !== 'CONNECTED'"
            />
          </el-select>
          <el-button link style="margin-left: 10px" :loading="devicesLoading" :disabled="!taskForm.platform" @click="refreshDevices">
            <el-icon><Refresh /></el-icon>
            刷新设备
          </el-button>
        </el-form-item>

        <el-form-item label="选择应用" prop="appId" required>
          <el-select
            v-model="taskForm.appId"
            placeholder="设备上已安装应用（包名用于启动与采样）"
            style="width: 400px"
            filterable
            clearable
            :loading="appsLoading"
            :disabled="!taskForm.deviceId"
            :filter-method="filterApplications"
          >
            <el-option
              v-for="app in filteredApps"
              :key="app.id"
              :label="app.packageName"
              :value="app.id"
            />
          </el-select>
          <el-button link style="margin-left: 10px" :loading="appsLoading" :disabled="!taskForm.deviceId" @click="loadInstalledApps(true)">
            <el-icon><Refresh /></el-icon>
            刷新应用
          </el-button>
        </el-form-item>

        <el-form-item label="采集引擎" prop="collectorEngine">
          <el-select v-model="taskForm.collectorEngine" style="width: 400px">
            <template v-if="isIosPlatform">
              <el-option label="AUTO（优先 Tidevice，否则 NONE）" value="AUTO" />
              <el-option label="Tidevice（Python 旁路，需 pip 安装）" value="TIDEVICE" />
              <el-option label="NONE（只跑流程，不采实时曲线）" value="NONE" />
            </template>
            <template v-else>
              <el-option label="AUTO（优先 SoloX，否则 ADB）" value="AUTO" />
              <el-option label="ADB（Java dumpsys，默认可靠）" value="ADB" />
              <el-option label="SoloX（Python 旁路，需节点已安装）" value="SOLOX" />
            </template>
          </el-select>
          <div style="margin-top: 6px; font-size: 12px; color: #909399; max-width: 560px; line-height: 1.5">
            <template v-if="isIosPlatform">
              Tidevice：
              <code>pip install -r scripts/perf/requirements-ios-perf.txt</code>
              ，并用
              <code>python3 scripts/perf/ios_tidevice_sampler.py --ping</code>
              验证。iOS 17+ 可能采不到；报告会记
              <code>collectorEngineUsed</code>。MetricKit 为测试包终报，与引擎选择独立。
            </template>
            <template v-else>
              SoloX 需执行机已安装：
              <code>pip install -r scripts/perf/requirements-solox.txt</code>
              ；未安装时 AUTO/强制 SoloX 会回退 ADB。报告中会记录实际生效引擎。
            </template>
          </div>
        </el-form-item>

        <el-form-item label="创建后执行">
          <el-switch v-model="taskForm.autoRun" active-text="创建后立即运行" />
        </el-form-item>
      </el-form>

      <div style="margin-top: 24px; text-align: center">
        <el-button type="primary" size="large" :loading="creating" @click="createTask">
          创建并开始
        </el-button>
        <el-button size="large" @click="router.push('/performance')">
          查看性能监控
        </el-button>
      </div>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>最近性能任务</span>
          <el-button link :loading="tasksLoading" @click="loadRecentTasks">刷新</el-button>
        </div>
      </template>
      <el-table v-loading="tasksLoading" :data="recentTasks" stripe empty-text="暂无性能任务">
        <el-table-column prop="name" label="任务名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            {{ row.taskType === 'SCENARIO_PERFORMANCE_TEST' ? '流程性能' : '遍历探索' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status === 'RUNNING'" @click="runTask(row.id)">运行</el-button>
            <el-button link type="primary" @click="goOverview(row.id)">详情</el-button>
            <el-button link type="primary" @click="goMonitor(row.id)">监控</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import type { SupportedDevicePlatform } from '@/utils/platform'
import { deviceRowMatchesTaskPlatform, isIosFamilyPlatform } from '@/utils/platform'

const router = useRouter()
const currentStep = ref(0)
const formRef = ref()
const devicesLoading = ref(false)
const appsLoading = ref(false)
const flowsLoading = ref(false)
const creating = ref(false)
const tasksLoading = ref(false)
const devices = ref<any[]>([])
const installedApps = ref<any[]>([])
const flowOptions = ref<any[]>([])
const appSearchKeyword = ref('')
const recentTasks = ref<any[]>([])

/**
 * 后端上限 60 分钟。
 * 30 分钟以上是「稳定性长跑」的量级——短时遍历点不出偶发崩溃，
 * 而偶发崩溃恰恰是稳定性测试唯一要找的东西。
 */
const traversalMinutesOptions = [1, 2, 3, 5, 10, 15, 30, 45, 60]

const taskForm = reactive({
  mode: 'scenario' as 'scenario' | 'baseline',
  taskName: '',
  platform: 'ANDROID' as SupportedDevicePlatform | '',
  flowId: '',
  deviceId: '',
  appId: '',
  traversalMinutes: 2,
  collectorEngine: 'AUTO' as 'AUTO' | 'ADB' | 'SOLOX' | 'TIDEVICE' | 'NONE',
  autoRun: true
})

const isIosPlatform = computed(
  () => isIosFamilyPlatform(taskForm.platform)
)

const filteredApps = computed(() => {
  const base = installedApps.value
  if (!appSearchKeyword.value.trim()) return base
  const keyword = appSearchKeyword.value.toLowerCase().trim()
  return base.filter((app) => {
    const packageName = (app.packageName || '').toLowerCase()
    const name = (app.name || '').toLowerCase()
    return packageName.includes(keyword) || name.includes(keyword)
  })
})

const formRules = computed(() => ({
  mode: [{ required: true, message: '请选择测试模式', trigger: 'change' }],
  platform: [{ required: true, message: '请选择平台类型', trigger: 'change' }],
  flowId:
    taskForm.mode === 'scenario' || isIosPlatform.value
      ? [{ required: true, message: '请选择流程编排中的流程', trigger: 'change' }]
      : [],
  traversalMinutes:
    taskForm.mode === 'baseline' && !isIosPlatform.value
      ? [{ required: true, message: '请选择执行时长', trigger: 'change' }]
      : [],
  deviceId: [{ required: true, message: '请选择测试设备', trigger: 'change' }],
  appId: [{ required: true, message: '请选择测试应用', trigger: 'change' }]
}))

const filterApplications = (val: string) => {
  appSearchKeyword.value = val
}

const goBack = () => router.push('/home')

const onModeChange = () => {
  if (taskForm.mode === 'scenario' && taskForm.platform) loadFlows()
}

const handlePlatformChange = () => {
  taskForm.deviceId = ''
  taskForm.appId = ''
  taskForm.flowId = ''
  devices.value = []
  installedApps.value = []
  flowOptions.value = []
  taskForm.collectorEngine = 'AUTO'
  if (isIosPlatform.value) {
    taskForm.mode = 'scenario'
  }
  if (taskForm.platform) {
    loadDevices(true)
    if (taskForm.mode === 'scenario') loadFlows()
  }
}

const loadFlows = async () => {
  if (!taskForm.platform) return
  flowsLoading.value = true
  try {
    const list = await apiClient.getUiFlows({
      platform: taskForm.platform,
      componentOnly: false
    })
    // App 性能测试流程与 UI 功能/回归彻底分开：只认 catalog=PERFORMANCE
    flowOptions.value = (list || []).filter((f: any) => {
      if (f.enabled === false || f.isComponent === true) return false
      return String(f.catalog || '').toUpperCase() === 'PERFORMANCE'
    })
    if (taskForm.flowId && !flowOptions.value.some((f) => f.id === taskForm.flowId)) {
      taskForm.flowId = ''
    }
  } catch (e) {
    console.error(e)
    flowOptions.value = []
  } finally {
    flowsLoading.value = false
  }
}

const loadDevices = async (force = false) => {
  if (!taskForm.platform) return
  if (!force && devices.value.length > 0) return
  devicesLoading.value = true
  try {
    const list = await apiClient.getDevicesByPlatform(taskForm.platform)
    devices.value = (list || []).filter((d: any) =>
      deviceRowMatchesTaskPlatform(d.platform, taskForm.platform)
    )
  } catch (e) {
    console.error(e)
    ElMessage.error('加载设备列表失败')
  } finally {
    devicesLoading.value = false
  }
}

const refreshDevices = async () => {
  await loadDevices(true)
  ElMessage.success('设备列表已刷新')
}

const loadInstalledApps = async (refresh = false) => {
  if (!taskForm.deviceId) return
  appsLoading.value = true
  try {
    installedApps.value = await apiClient.getDeviceApps(taskForm.deviceId, refresh)
  } catch (e) {
    console.error(e)
    ElMessage.error('加载应用列表失败')
  } finally {
    appsLoading.value = false
  }
}

watch(
  () => taskForm.deviceId,
  (id) => {
    taskForm.appId = ''
    installedApps.value = []
    appSearchKeyword.value = ''
    if (id) loadInstalledApps()
  }
)

const statusText = (s?: string) =>
  ({ PENDING: '待执行', RUNNING: '运行中', COMPLETED: '已完成', FAILED: '失败', STOPPED: '已停止' } as Record<string, string>)[
    s || ''
  ] || s || '-'

const statusTagType = (s?: string) =>
  ({ PENDING: 'info', RUNNING: 'warning', COMPLETED: 'success', FAILED: 'danger', STOPPED: 'info' } as Record<string, string>)[
    s || ''
  ] || 'info'

const loadRecentTasks = async () => {
  tasksLoading.value = true
  try {
    const [scenario, baseline] = await Promise.all([
      apiClient.getTasks({ taskType: 'SCENARIO_PERFORMANCE_TEST' }, { page: 1, size: 10 }),
      apiClient.getTasks({ taskType: 'PERFORMANCE_BASELINE_TEST' }, { page: 1, size: 10 })
    ])
    const merged = [...(scenario?.content || []), ...(baseline?.content || [])]
    merged.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return tb - ta
    })
    recentTasks.value = merged.slice(0, 15)
  } catch (e) {
    console.error(e)
    recentTasks.value = []
  } finally {
    tasksLoading.value = false
  }
}

const runTask = async (taskId: string) => {
  try {
    await apiClient.runTask(taskId)
    ElMessage.success('已开始运行')
    currentStep.value = 1
    await loadRecentTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '运行失败')
  }
}

const goOverview = (taskId: string) => router.push({ name: 'TaskOverview', params: { id: taskId } })
const goMonitor = (taskId: string) => router.push({ path: '/performance', query: { taskId } })

const createTask = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) {
      ElMessage.warning('请完善表单信息')
      return
    }
    creating.value = true
    try {
      if (isIosPlatform.value && taskForm.mode === 'baseline') {
        ElMessage.warning('iOS 请使用流程性能测试')
        creating.value = false
        return
      }
      const isScenario = taskForm.mode === 'scenario' || isIosPlatform.value
      const selectedApp = installedApps.value.find((a) => a.id === taskForm.appId)
      const selectedFlow = flowOptions.value.find((f) => f.id === taskForm.flowId)
      const body: Parameters<typeof apiClient.createTestTask>[0] = {
        taskType: isScenario ? 'SCENARIO_PERFORMANCE_TEST' : 'PERFORMANCE_BASELINE_TEST',
        platform: taskForm.platform,
        deviceId: taskForm.deviceId,
        appId: taskForm.appId,
        taskName:
          taskForm.taskName ||
          (isScenario && selectedFlow
            ? `性能-${selectedFlow.name || selectedFlow.id}`
            : undefined)
      }
      if (isScenario) {
        body.scenarioKey = 'ui_flow'
        body.config = JSON.stringify({
          flowId: taskForm.flowId,
          uiAppId: selectedFlow?.appId || undefined,
          packageName: selectedApp?.packageName || undefined,
          collectorEngine: taskForm.collectorEngine || 'AUTO'
        })
      } else {
        body.config = JSON.stringify({
          traversalMinutes: taskForm.traversalMinutes,
          collectorEngine: taskForm.collectorEngine || 'AUTO'
        })
      }
      const res = await apiClient.createTestTask(body)
      const taskId = res?.id || res?.taskId
      ElMessage.success(isScenario ? '流程性能测试已创建' : '遍历探索任务已创建')
      currentStep.value = 1
      if (taskForm.autoRun && taskId) {
        await apiClient.runTask(taskId)
        ElMessage.success('已开始执行，完成后可在性能监控查看结果')
        currentStep.value = 2
        router.push({ path: '/performance', query: { taskId: String(taskId) } })
        return
      }
      await loadRecentTasks()
      if (taskId) router.push({ path: '/performance', query: { taskId: String(taskId) } })
    } catch (e: any) {
      console.error(e)
      ElMessage.error(e?.message || '创建失败')
    } finally {
      creating.value = false
    }
  })
}

onMounted(() => {
  loadDevices(true)
  loadFlows()
  loadRecentTasks()
})
</script>

<style scoped>
.performance-baseline {
  padding: 20px;
}
.breadcrumb {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  font-size: 14px;
}
.separator {
  margin: 0 10px;
  color: var(--el-text-color-placeholder);
}
.current-page {
  color: var(--app-text);
  font-weight: 500;
}
.progress-steps {
  margin-bottom: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
:deep(.el-form-item__label) {
  font-weight: 500;
}

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
  max-width: 620px;
}
</style>
