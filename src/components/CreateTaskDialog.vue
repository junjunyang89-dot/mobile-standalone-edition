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
              <span v-if="app.name && app.name !== app.packageName" style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 8px">({{ app.name }})</span>
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
const devicesLoading = ref(false)
const appsLoading = ref(false)

const deviceList = computed(() => {
  if (!form.platform) return []
  return devices.value.filter((d) => deviceRowMatchesTaskPlatform(d.platform, form.platform))
})
const appList = computed(() => installedApps.value)

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

/** 性能基础质量测试可选执行时长（分钟），后端限制 1～60，未传则默认 2 */
const traversalMinutesOptions = [2, 5, 10, 30, 60]

const form = reactive({
  taskType: 'UI_FLOW_TEST',
  platform: 'ANDROID' as SupportedDevicePlatform,
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
  }
)

watch(
  () => form.platform,
  (platform, oldPlatform) => {
    if (oldPlatform !== undefined) {
      form.deviceId = ''
      form.appId = ''
      devices.value = []
      installedApps.value = []
    }
    if (platform) {
      loadDevices(true)
    }
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
  form.taskType = 'UI_FLOW_TEST'
  form.platform = 'ANDROID'
  form.deviceId = ''
  form.appId = ''
  form.taskName = ''
  form.remarks = ''
  form.traversalMinutes = 2
  devices.value = []
  installedApps.value = []
}

const submit = async () => {
  const { taskType, platform, deviceId, appId } = form
  if (!taskType || !platform || !deviceId?.trim() || !appId?.trim()) {
    ElMessage.warning('请填写必填项：任务类型、平台、设备ID、应用ID')
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
    if (taskType === 'PERFORMANCE_BASELINE_TEST') {
      body.config = JSON.stringify({ traversalMinutes: form.traversalMinutes })
    }
    await taskStore.createTestTask(body)
    ElMessage.success('创建成功')
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
