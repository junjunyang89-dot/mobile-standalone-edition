<template>
  <div class="specialized-testing">
    <!-- 面包屑导航 -->
    <div class="breadcrumb">
      <el-button link @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <span class="separator">|</span>
      <span class="current-page">功能体验基础质量测试</span>
    </div>

    <!-- 进度指示器 -->
    <div class="progress-steps">
      <el-steps :active="currentStep" finish-status="success">
        <el-step title="创建任务" />
        <el-step title="执行测试" />
        <el-step title="查看报告" />
      </el-steps>
    </div>

    <!-- 任务创建表单 -->
    <el-card class="task-form-card">
      <el-form
        ref="formRef"
        :model="taskForm"
        :rules="formRules"
        label-width="120px"
        label-position="left"
      >
        <!-- 任务名称 -->
        <el-form-item label="任务名称" prop="taskName">
          <el-input
            v-model="taskForm.taskName"
            placeholder="请输入任务名称（不填则自动生成）"
            maxlength="60"
            show-word-limit
            style="width: 400px" />
        </el-form-item>

        <!-- 备注信息 -->
        <el-form-item label="备注信息" prop="remarks">
          <el-input
            v-model="taskForm.remarks"
            type="textarea"
            :rows="3"
            placeholder="请输入任务备注信息"
            maxlength="80"
            show-word-limit
            style="width: 400px" />
        </el-form-item>

        <!-- 平台选择 -->
        <el-form-item label="平台类型" prop="platform" required>
          <el-radio-group v-model="taskForm.platform" @change="handlePlatformChange">
            <el-radio value="ANDROID">Android</el-radio>
            <el-radio value="IOS">iOS</el-radio>
            <el-radio value="HARMONYOS">HarmonyOS</el-radio>
            <el-radio value="POG_ANDROID">Pog-Android</el-radio>
            <el-radio value="POG_IOS">Pog-iOS</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-alert
          v-if="taskForm.platform === 'POG_ANDROID' || taskForm.platform === 'POG_IOS'"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 4px; margin-bottom: 8px; max-width: 640px"
        >
          设备与应用列表由后端按所选 platform 合并返回（Android 与 Pog-Android 等为同一池）；无需前端对设备/应用做二次合并。若选 Pog 后仍无数据，请核对库内 platform 标注或运营配置。
        </el-alert>

        <!-- 测试场景：明确要执行的任务（启动应用/登录/搜索/设置测试/设置-我的账号/设置-我的兴趣/设置-高校认证等） -->
        <el-form-item label="测试场景" prop="scenarioKey" required>
          <el-select
            v-model="taskForm.scenarioKey"
            placeholder="请选择测试场景，可按名称搜索"
            style="width: 400px"
            filterable
            :loading="scenariosLoading"
            :disabled="!taskForm.platform || (!scenariosLoading && scenarioOptions.length === 0)"
          >
            <el-option
              v-for="s in scenarioOptions"
              :key="s.scenarioKey"
              :label="s.name"
              :value="s.scenarioKey" />
          </el-select>
          <el-alert
            v-if="taskForm.platform && !scenariosLoading && scenarioOptions.length === 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: 8px; max-width: 640px"
          >
            暂无测试场景（当前平台暂无内置功能质量场景）。请更换平台或待后端配置；请勿改用不带 platform 的全量接口再在本地筛选。
          </el-alert>
          <el-alert
            v-if="taskForm.scenarioKey === 'settings' || taskForm.scenarioKey === 'settings_account' || taskForm.scenarioKey === 'settings_interests' || taskForm.scenarioKey === 'settings_school_cert'"
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 8px"
          >
            设置测试、设置-我的账号、设置-我的兴趣、设置-高校认证需使用完美世界电竞应用（包名含 steam.esports），请在「选择应用」中选择该应用。
          </el-alert>
        </el-form-item>

        <!-- 测试设备 -->
        <el-form-item label="测试设备" prop="deviceId" required>
          <el-select
            v-model="taskForm.deviceId"
            placeholder="请先选择平台类型，然后选择测试设备"
            style="width: 400px"
            filterable
            :disabled="!taskForm.platform"
            :loading="devicesLoading"
            @visible-change="loadDevices"
          >
            <el-option-group
              v-for="group in deviceGroups"
              :key="group.platform"
              :label="getPlatformLabel(group.platform)"
            >
              <el-option
                v-for="device in group.devices"
                :key="device.id"
                :label="`${device.name} (${device.version})`"
                :value="device.id"
                :disabled="device.status !== 'CONNECTED'"
              >
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <span>{{ device.name }} ({{ device.version }})</span>
                  <div style="display: flex; gap: 8px; align-items: center">
                    <el-tag :type="getStatusTagType(device.status)" size="small">
                      {{ device.status === 'CONNECTED' ? '已连接' : '未连接' }}
                    </el-tag>
                    <el-tag :type="getPlatformTagType(device.platform)" size="small">
                      {{ platformUiLabel(device.platform) }}
                    </el-tag>
                  </div>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
          <el-button
            link
            @click="refreshDevices"
            style="margin-left: 10px"
            :loading="devicesLoading"
            :disabled="!taskForm.platform"
          >
            <el-icon><Refresh /></el-icon>
            刷新设备
          </el-button>
        </el-form-item>

        <!-- 选择应用 -->
        <el-form-item label="选择应用" prop="appId" required>
          <el-tabs v-model="appTab" @tab-change="handleAppTabChange">
            <el-tab-pane label="已安装的应用" name="installed">
              <div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 10px">
                <el-select
                  v-model="taskForm.appId"
                  placeholder="请先选择测试设备，再选该设备上已安装应用"
                  style="width: 400px"
                  filterable
                  clearable
                  :loading="appsLoading"
                  :disabled="!taskForm.deviceId"
                  :filter-method="filterApplications"
                  default-first-option
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                  <el-option
                    v-for="app in filteredApps"
                    :key="app.id"
                    :label="app.packageName"
                    :value="app.id"
                  >
                    <div style="display: flex; justify-content: space-between">
                      <span>{{ app.packageName }}</span>
                      <span v-if="app.name && app.name !== app.packageName" style="color: #909399; font-size: 12px; margin-left: 8px">
                        ({{ app.name }})
                      </span>
                    </div>
                  </el-option>
                </el-select>
                <el-button
                  link
                  :loading="appsLoading"
                  :disabled="!taskForm.deviceId"
                  title="从设备重新拉取应用列表（含新装应用）"
                  @click="loadInstalledApps(true)"
                >
                  <el-icon><Refresh /></el-icon>
                  刷新应用
                </el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="安装新的应用" name="upload">
              <el-upload
                ref="uploadRef"
                :auto-upload="false"
                :on-change="handleFileChange"
                :file-list="fileList"
                :accept="uploadAccept"
                style="margin-top: 10px"
              >
                <template #trigger>
                  <el-button type="primary">选择应用文件</el-button>
                </template>
                <el-button
                  type="success"
                  style="margin-left: 10px"
                  :loading="uploading"
                  :disabled="!selectedFile || !taskForm.deviceId"
                  @click="uploadAndInstall"
                >
                  上传并安装
                </el-button>
              </el-upload>
              <div v-if="taskForm.platform" style="margin-top: 6px; color: #909399; font-size: 12px">
                {{ uploadFileHintForPlatform(taskForm.platform) }}
              </div>
              <div v-if="selectedFile" style="margin-top: 10px; color: #909399; font-size: 12px">
                已选择: {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-form-item>
      </el-form>

      <!-- 服务使用提醒 -->
      <el-alert
        type="warning"
        :closable="false"
        style="margin-top: 20px"
        show-icon
      >
        <template #title>
          <div>
            <strong>服务使用提醒</strong>
            <p style="margin: 5px 0 0 0; font-size: 12px">
              本服务功能已集成到应用上架预检服务,提供了更强的自主遍历和问题检测能力,推荐移步使用。
            </p>
          </div>
        </template>
      </el-alert>

      <!-- 创建任务按钮 -->
      <div style="margin-top: 30px; text-align: center">
        <el-button
          type="primary"
          size="large"
          :loading="creating"
          @click="createTask"
        >
          创建任务
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh, Search } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import type { SupportedDevicePlatform } from '@/utils/platform'
import {
  platformUiLabel,
  uploadAcceptForPlatform,
  uploadFileHintForPlatform,
  deviceRowMatchesTaskPlatform
} from '@/utils/platform'
import type { UploadFile, UploadFiles } from 'element-plus'

const router = useRouter()

const currentStep = ref(0)
const formRef = ref()
const uploadRef = ref()
const appTab = ref('installed')
const devicesLoading = ref(false)
const appsLoading = ref(false)
const uploading = ref(false)
const creating = ref(false)
const selectedFile = ref<File | null>(null)
const fileList = ref<UploadFiles>([])

const devices = ref<any[]>([])
const installedApps = ref<any[]>([])
const appSearchKeyword = ref('')
const scenarios = ref<Array<{ scenarioKey: string; name: string; platform?: string }>>([])
const scenariosLoading = ref(false)

const taskForm = reactive({
  taskName: '',
  remarks: '',
  platform: '' as SupportedDevicePlatform | '',
  scenarioKey: '',
  deviceId: '',
  appId: ''
})

/** 仅使用 functional-quality?platform= 当前所选平台 的接口返回，不在本地合并全量或按 ANDROID 补 Pog */
const scenarioOptions = computed(() => {
  if (!taskForm.platform) return []
  return scenarios.value
})

const uploadAccept = computed(() => uploadAcceptForPlatform(taskForm.platform))

// 过滤后的应用列表（仅设备已安装；应用池由后端按 platform 合并）
const filteredApps = computed(() => {
  const base = installedApps.value
  if (!appSearchKeyword.value.trim()) {
    return base
  }
  const keyword = appSearchKeyword.value.toLowerCase().trim()
  return base.filter(app => {
    const packageName = (app.packageName || '').toLowerCase()
    const name = (app.name || '').toLowerCase()
    return packageName.includes(keyword) || name.includes(keyword)
  })
})

// 应用搜索过滤方法
const filterApplications = (val: string) => {
  appSearchKeyword.value = val
}

const formRules = {
  taskName: [
    { max: 60, message: '任务名称最多60个字符', trigger: 'blur' }
  ],
  remarks: [
    { max: 80, message: '备注信息最多80个字符', trigger: 'blur' }
  ],
  platform: [
    { required: true, message: '请选择平台类型', trigger: 'change' }
  ],
  scenarioKey: [
    { required: true, message: '请选择测试场景', trigger: 'change' }
  ],
  deviceId: [
    { required: true, message: '请选择测试设备', trigger: 'change' }
  ],
  appId: [
    { required: true, message: '请选择测试应用', trigger: 'change' }
  ]
}

// 设备分组（按平台）
const deviceGroups = computed(() => {
  if (!taskForm.platform) {
    return []
  }
  
  const platformDevices = devices.value.filter(d => deviceRowMatchesTaskPlatform(d.platform, taskForm.platform))
  return [{
    platform: taskForm.platform,
    devices: platformDevices
  }]
})

// 获取平台标签
const getPlatformLabel = (platform: string) => {
  const map: Record<string, string> = {
    ANDROID: 'Android 设备',
    IOS: 'iOS 设备',
    HARMONYOS: 'HarmonyOS 设备',
    POG_ANDROID: 'Pog-Android 设备',
    POG_IOS: 'Pog-iOS 设备'
  }
  return map[platform] || platformUiLabel(platform)
}

// 获取平台标签类型
const getPlatformTagType = (platform: string) => {
  const map: Record<string, string> = {
    ANDROID: 'success',
    IOS: 'info',
    HARMONYOS: 'warning',
    POG_ANDROID: 'success',
    POG_IOS: 'info'
  }
  return map[platform] || ''
}

// 获取状态标签类型
const getStatusTagType = (status: string) => {
  return status === 'CONNECTED' ? 'success' : 'info'
}

// 返回上一页
const goBack = () => {
  router.push('/home')
}

// 处理平台变化
const handlePlatformChange = () => {
  taskForm.scenarioKey = ''
  taskForm.deviceId = ''
  taskForm.appId = ''
  devices.value = []
  installedApps.value = []
  scenarios.value = []
  if (taskForm.platform) {
    loadDevices(true)
    loadScenarios()
  }
}

// 加载测试场景列表（功能基础质量：GET .../functional-quality?platform=当前任务平台）
const loadScenarios = async () => {
  if (!taskForm.platform) return
  scenariosLoading.value = true
  try {
    scenarios.value = await apiClient.getFunctionalQualityScenarios(taskForm.platform)
  } catch (error) {
    console.error('Load scenarios error:', error)
    scenarios.value = []
  } finally {
    scenariosLoading.value = false
  }
}

// 加载设备列表
const loadDevices = async (force = false) => {
  if (!taskForm.platform) {
    ElMessage.warning('请先选择平台类型')
    return
  }

  if (!force && devices.value.length > 0) return
  
  devicesLoading.value = true
  try {
    devices.value = await apiClient.getDevicesByPlatform(taskForm.platform)
  } catch (error) {
    console.error('Load devices error:', error)
    ElMessage.error('加载设备列表失败')
  } finally {
    devicesLoading.value = false
  }
}

// 刷新设备
const refreshDevices = async () => {
  await loadDevices(true)
  ElMessage.success('设备列表已刷新')
}

// 处理应用标签切换
const handleAppTabChange = (tab: string) => {
  if (tab === 'installed') {
    loadInstalledApps()
  } else {
    taskForm.appId = ''
  }
}

// 加载已安装应用列表；refresh=true 时请求带 ?refresh=true，拉取设备真实安装列表（含新装应用）
const loadInstalledApps = async (refresh = false) => {
  if (!taskForm.deviceId) {
    ElMessage.warning('请先选择测试设备')
    appTab.value = 'installed'
    return
  }

  appsLoading.value = true
  try {
    installedApps.value = await apiClient.getDeviceApps(taskForm.deviceId, refresh)
  } catch (error) {
    console.error('Load apps error:', error)
    ElMessage.error('加载应用列表失败')
  } finally {
    appsLoading.value = false
  }
}

// 监听设备选择变化
watch(() => taskForm.deviceId, (newDeviceId) => {
  if (newDeviceId && appTab.value === 'installed') {
    loadInstalledApps()
  } else {
    taskForm.appId = ''
    installedApps.value = []
    appSearchKeyword.value = ''
  }
})

// 监听应用列表变化，清空搜索关键词
watch(() => installedApps.value, () => {
  appSearchKeyword.value = ''
})

// 文件选择变化
const handleFileChange = (file: UploadFile) => {
  const raw = file.raw || null
  if (!raw || !taskForm.platform) {
    selectedFile.value = raw
    fileList.value = [file]
    return
  }
  const name = (raw.name || '').toLowerCase()
  const p = (taskForm.platform || '').toUpperCase()
  const okApk = name.endsWith('.apk')
  const okIpa = name.endsWith('.ipa')
  const okApp = name.endsWith('.app')
  let allowed = true
  if (p === 'ANDROID' || p === 'POG_ANDROID') allowed = okApk
  else if (p === 'IOS' || p === 'POG_IOS') allowed = okIpa || okApp
  if (!allowed) {
    ElMessage.warning(uploadFileHintForPlatform(taskForm.platform))
    selectedFile.value = null
    fileList.value = []
    uploadRef.value?.clearFiles()
    return
  }
  selectedFile.value = raw
  fileList.value = [file]
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 上传并安装应用
const uploadAndInstall = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择应用文件')
    return
  }

  if (!taskForm.deviceId) {
    ElMessage.warning('请先选择测试设备')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('deviceId', taskForm.deviceId)
    formData.append('platform', taskForm.platform)

    const app = await apiClient.uploadAndInstallApp(formData)
    ElMessage.success('应用安装成功')
    
    // 安装成功后，切换到已安装应用标签并选中刚安装的应用
    appTab.value = 'installed'
    taskForm.appId = app.id
    await loadInstalledApps()
    
    // 清空上传文件
    selectedFile.value = null
    fileList.value = []
    uploadRef.value?.clearFiles()
  } catch (error: any) {
    console.error('Upload app error:', error)
    ElMessage.error(error.message || '应用安装失败')
  } finally {
    uploading.value = false
  }
}

// 创建任务
const createTask = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) {
      ElMessage.warning('请完善表单信息')
      return
    }

    if (!taskForm.platform) {
      ElMessage.warning('请选择平台类型')
      return
    }

    if (!taskForm.deviceId) {
      ElMessage.warning('请选择测试设备')
      return
    }

    if (!taskForm.appId && appTab.value === 'installed') {
      ElMessage.warning('请选择测试应用')
      return
    }

    if (!taskForm.scenarioKey?.trim()) {
      ElMessage.warning('请选择测试场景，以明确要执行的任务')
      return
    }

    creating.value = true
    try {
      const body = {
        taskType: 'FUNCTIONAL_QUALITY_TEST',
        platform: taskForm.platform,
        deviceId: taskForm.deviceId,
        appId: taskForm.appId,
        scenarioKey: taskForm.scenarioKey.trim().toLowerCase(),
        taskName: taskForm.taskName || undefined,
        remarks: taskForm.remarks || undefined
      }
      const res = await apiClient.createTestTask(body)
      const scenarioLabel = (res && (res as any).scenarioName) || (res && (res as any).scenarioKey) ? `，场景：${(res as any).scenarioName || (res as any).scenarioKey}` : ''
      ElMessage.success(`任务创建成功${scenarioLabel}`)
      
      // 跳转到任务列表
      router.push('/tasks')
    } catch (error: any) {
      console.error('Create task error:', error)
      ElMessage.error(error.message || '任务创建失败')
    } finally {
      creating.value = false
    }
  })
}
</script>

<style scoped>
.specialized-testing {
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
  color: #909399;
}

.current-page {
  color: #303133;
  font-weight: 500;
}

.progress-steps {
  margin-bottom: 30px;
  padding: 20px;
  background: #fff;
  border-radius: 4px;
}

.task-form-card {
  margin-top: 20px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-form-item.is-required .el-form-item__label::before) {
  content: '*';
  color: #f56c6c;
  margin-right: 4px;
}
</style>
