<template>
  <el-dialog
    :model-value="modelValue"
    title="新建任务"
    width="560px"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="resetForm"
  >
    <el-form :model="form" label-width="100px">
      <el-form-item label="任务类型" required>
        <el-select v-model="form.taskType" placeholder="请选择任务类型" style="width: 100%">
          <el-option
            v-for="item in taskTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="平台" required>
        <el-select v-model="form.platform" placeholder="请选择平台" style="width: 100%">
          <el-option
            v-for="item in platformOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.taskType === 'FUNCTIONAL_QUALITY_TEST'" label="测试场景" required>
        <el-select
          v-model="form.scenarioKey"
          placeholder="请选择测试场景，可按名称搜索"
          style="width: 100%"
          filterable
          :loading="scenariosLoading"
          :disabled="!form.platform || (!scenariosLoading && scenarioOptions.length === 0)"
        >
          <el-option
            v-for="s in scenarioOptions"
            :key="s.scenarioKey"
            :label="s.name"
            :value="s.scenarioKey" />
        </el-select>
        <el-alert
          v-if="form.platform && !scenariosLoading && scenarioOptions.length === 0"
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 8px"
        >
          暂无测试场景（当前平台暂无内置功能质量场景）。请更换平台或待后端配置；请勿改用不带 platform 的全量接口再在本地筛选，以免混入其它平台场景。
        </el-alert>
        <el-alert
          v-if="needsSteamEsportsApp"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 8px"
        >
          {{ steamEsportsHint }}
        </el-alert>
      </el-form-item>
      <el-alert
        v-if="form.taskType === 'PERFORMANCE_BASELINE_TEST'"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
      >
        性能基础质量测试当前仅支持 Android / Pog-Android，请选择 Android 或 Pog-Android 平台与设备。
      </el-alert>
      <el-form-item v-if="form.taskType === 'PERFORMANCE_BASELINE_TEST'" label="执行时长" required>
        <el-select v-model="form.traversalMinutes" placeholder="请选择遍历时长" style="width: 100%">
          <el-option
            v-for="m in traversalMinutesOptions"
            :key="m"
            :label="`${m} 分钟`"
            :value="m" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备ID" required>
        <el-select
          v-model="form.deviceId"
          placeholder="请先选择平台，然后选择测试设备"
          style="width: 100%"
          filterable
          clearable
          :disabled="!form.platform"
          :loading="devicesLoading"
          @visible-change="onDeviceDropdownVisible"
        >
          <el-option
            v-for="d in deviceList"
            :key="d.id"
            :label="`${d.name || d.id} (${d.version || '-'})`"
            :value="d.id"
            :disabled="d.status !== 'CONNECTED'"
          >
            <span>{{ d.name || d.id }} ({{ d.version || '-' }})</span>
            <el-tag v-if="d.status" size="small" :type="d.status === 'CONNECTED' ? 'success' : 'info'" style="margin-left: 8px">
              {{ d.status === 'CONNECTED' ? '已连接' : '未连接' }}
            </el-tag>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="应用ID" required>
        <div class="app-select-row">
          <el-select
            v-model="form.appId"
            placeholder="请先选择测试设备，再选该设备上已安装应用"
            class="app-select-input"
            filterable
            clearable
            :disabled="!form.deviceId"
            :loading="appsLoading"
            @visible-change="onAppDropdownVisible"
          >
            <el-option
              v-for="app in appList"
              :key="app.id"
              :label="app.packageName || app.id"
              :value="app.id"
            >
              <span>{{ app.packageName || app.id }}</span>
              <span v-if="app.name && app.name !== app.packageName" style="color: #909399; font-size: 12px; margin-left: 8px">({{ app.name }})</span>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            link
            :loading="appsLoading"
            :disabled="!form.deviceId"
            title="从设备重新拉取应用列表（含新装应用）"
            @click="loadInstalledApps(true)"
          >
            刷新
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="任务名称">
        <el-input v-model="form.taskName" placeholder="不填则后端按任务类型自动生成" maxlength="60" show-word-limit />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="可选，建议 ≤80 字符" maxlength="80" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.app-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.app-select-row .app-select-input {
  flex: 1;
  min-width: 0;
}
</style>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '@/stores/task'
import { apiClient } from '@/api'
import type { SupportedDevicePlatform } from '@/utils/platform'
import { deviceRowMatchesTaskPlatform } from '@/utils/platform'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    initialTaskType?: string
  }>(),
  { initialTaskType: '' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const taskStore = useTaskStore()
const submitting = ref(false)
const devices = ref<{ id: string; name?: string; version?: string; platform?: string; status?: string }[]>([])
const installedApps = ref<{ id: string; packageName?: string; name?: string }[]>([])
const scenarios = ref<{ scenarioKey: string; name: string; platform?: string }[]>([])
const devicesLoading = ref(false)
const appsLoading = ref(false)
const scenariosLoading = ref(false)

const deviceList = computed(() => {
  if (!form.platform) return []
  return devices.value.filter((d) => deviceRowMatchesTaskPlatform(d.platform, form.platform))
})
const appList = computed(() => installedApps.value)
/** 功能基础质量场景：仅使用 GET .../functional-quality?platform= 的返回列表，不在本地再筛或合并全量数据 */
const scenarioOptions = computed(() => {
  if (form.taskType !== 'FUNCTIONAL_QUALITY_TEST' || !form.platform) return []
  return scenarios.value
})

/** 需使用完美世界电竞应用（steam.esports）的场景 */
const STEAM_ESPORTS_SCENARIOS = [
  'settings',
  'settings_account',
  'settings_interests',
  'settings_school_cert',
  'cs_event_schedule_browse_android',
  'cs_ended_match_detail_data_android',
  'cs_ended_match_detail_analysis_android'
]
const needsSteamEsportsApp = computed(() =>
  STEAM_ESPORTS_SCENARIOS.includes(form.scenarioKey || '')
)
const steamEsportsHint = computed(() => {
  const k = form.scenarioKey || ''
  if (k.startsWith('cs_event_schedule') || k.startsWith('cs_ended_match_detail')) {
    return 'CS-赛事-赛程相关场景（赛程浏览、赛事详情-数据、赛事详情-分析）需使用完美世界电竞应用（包名含 steam.esports），请在「应用ID」中选择该应用。'
  }
  return '设置测试、设置-我的账号、设置-我的兴趣、设置-高校认证需使用完美世界电竞应用（包名含 steam.esports），请在「应用ID」中选择该应用。'
})

const taskTypeOptions = [
  { value: 'INSTALL_UNINSTALL_UPGRADE_TEST', label: '安装卸载升级测试' },
  { value: 'FUNCTIONAL_QUALITY_TEST', label: '功能基础质量' },
  { value: 'PERFORMANCE_BASELINE_TEST', label: '性能基础质量测试' },
  { value: 'POWER_CONSUMPTION_BASELINE_TEST', label: '功耗基础质量' },
  { value: 'SCENARIO_PERFORMANCE_TEST', label: '场景化性能' },
  { value: 'SECURITY_BASELINE_QUALITY_TEST', label: '安全基础质量' },
  { value: 'STABILITY_QUALITY_TEST', label: '稳定性基础质量' },
  { value: 'PERFORMANCE_MONITORING_TEST', label: '性能指标监控' },
  { value: 'COMPATIBILITY_TEST', label: '兼容性测试' },
  { value: 'UI_ADAPTATION_TEST', label: '界面与适配测试' }
]

const platformOptions = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' },
  { value: 'POG_ANDROID', label: 'Pog-Android' },
  { value: 'POG_IOS', label: 'Pog-iOS' }
]

/** 性能基础质量测试可选执行时长（分钟），后端限制 1～60，未传则默认 2 */
const traversalMinutesOptions = [2, 5, 10, 30, 60]

const form = reactive({
  taskType: 'FUNCTIONAL_QUALITY_TEST',
  platform: 'ANDROID' as SupportedDevicePlatform,
  scenarioKey: '' as string,
  deviceId: '',
  appId: '',
  taskName: '',
  remarks: '',
  traversalMinutes: 2 as number
})

watch(
  () => [props.modelValue, props.initialTaskType],
  ([visible, initial]) => {
    if (visible && initial && taskTypeOptions.some((o) => o.value === initial)) {
      form.taskType = initial
    }
    if (visible && form.platform) {
      loadDevices(true)
    }
    if (visible && form.taskType === 'FUNCTIONAL_QUALITY_TEST') {
      loadScenarios()
    }
  }
)

watch(
  () => form.platform,
  (platform, oldPlatform) => {
    if (oldPlatform !== undefined) {
      form.scenarioKey = ''
      form.deviceId = ''
      form.appId = ''
      devices.value = []
      installedApps.value = []
    }
    if (platform) {
      loadDevices(true)
    }
    if (form.taskType === 'FUNCTIONAL_QUALITY_TEST') {
      loadScenarios()
    }
  }
)

async function loadScenarios() {
  if (form.taskType !== 'FUNCTIONAL_QUALITY_TEST') return
  if (!form.platform) {
    scenarios.value = []
    return
  }
  scenariosLoading.value = true
  try {
    scenarios.value = await apiClient.getFunctionalQualityScenarios(form.platform)
  } catch (e) {
    console.error('Load scenarios error:', e)
    scenarios.value = []
  } finally {
    scenariosLoading.value = false
  }
}

watch(
  () => form.taskType,
  (taskType) => {
    form.scenarioKey = ''
    if (taskType === 'FUNCTIONAL_QUALITY_TEST') loadScenarios()
  }
)

watch(
  () => form.deviceId,
  (deviceId) => {
    form.appId = ''
    installedApps.value = []
    if (deviceId) {
      loadInstalledApps()
    }
  }
)

async function loadDevices(force = false) {
  if (!form.platform) return
  if (!force && devices.value.length > 0) return
  devicesLoading.value = true
  try {
    devices.value = await apiClient.getDevicesByPlatform(form.platform)
  } catch (e) {
    console.error('Load devices error:', e)
    ElMessage.error('加载设备列表失败')
  } finally {
    devicesLoading.value = false
  }
}

async function loadInstalledApps(refresh = false) {
  if (!form.deviceId) return
  appsLoading.value = true
  try {
    installedApps.value = await apiClient.getDeviceApps(form.deviceId, refresh)
  } catch (e) {
    console.error('Load apps error:', e)
    ElMessage.error('加载应用列表失败')
  } finally {
    appsLoading.value = false
  }
}

function onDeviceDropdownVisible(visible: boolean) {
  if (visible && form.platform) loadDevices(true)
}

function onAppDropdownVisible(visible: boolean) {
  if (visible && form.deviceId) loadInstalledApps()
}

function resetForm() {
  form.taskType = 'FUNCTIONAL_QUALITY_TEST'
  form.platform = 'ANDROID'
  form.scenarioKey = ''
  form.deviceId = ''
  form.appId = ''
  form.taskName = ''
  form.remarks = ''
  form.traversalMinutes = 2
  devices.value = []
  installedApps.value = []
  scenarios.value = []
}

const submit = async () => {
  const { taskType, platform, deviceId, appId, scenarioKey } = form
  if (!taskType || !platform || !deviceId?.trim() || !appId?.trim()) {
    ElMessage.warning('请填写必填项：任务类型、平台、设备ID、应用ID')
    return
  }
  if (taskType === 'FUNCTIONAL_QUALITY_TEST' && !scenarioKey?.trim()) {
    ElMessage.warning('请选择测试场景，以明确要执行的任务')
    return
  }
  submitting.value = true
  try {
    const body: Parameters<typeof taskStore.createTestTask>[0] = {
      taskType,
      platform,
      deviceId: deviceId.trim(),
      appId: appId.trim(),
      taskName: form.taskName?.trim() || undefined,
      remarks: form.remarks?.trim() || undefined
    }
    if (taskType === 'FUNCTIONAL_QUALITY_TEST' && scenarioKey?.trim()) {
      body.scenarioKey = scenarioKey.trim().toLowerCase()
    }
    if (taskType === 'PERFORMANCE_BASELINE_TEST') {
      body.config = JSON.stringify({ traversalMinutes: form.traversalMinutes })
    }
    const res = await taskStore.createTestTask(body)
    const scenarioLabel = res && (res as any).scenarioName ? `，场景：${(res as any).scenarioName}` : res && (res as any).scenarioKey ? `，scenarioKey：${(res as any).scenarioKey}` : ''
    ElMessage.success(`创建成功${scenarioLabel}`)
    emit('update:modelValue', false)
    resetForm()
    emit('success')
  } catch (error: any) {
    ElMessage.error(error?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>
