<template>
  <div class="app-pack">
    <div class="pack-head">
      <div class="pack-head-main">
        <h2 class="pack-title">APP 打包</h2>
        <p class="pack-sub">鸿蒙、完美电竞 iOS 按所选分支打包；完美电竞安卓固定 testing 分支 Debug。</p>
      </div>
      <div v-if="currentVersion" class="ver-card">
        <span class="ver-cap">当前版本</span>
        <span class="ver-num">{{ currentVersion.name }}</span>
        <span v-if="currentVersion.code" class="ver-code">vc {{ currentVersion.code }}</span>
      </div>
    </div>

    <div class="panel">
      <el-tabs v-model="platform" class="pack-tabs" @tab-change="onPlatformChange">
        <el-tab-pane label="鸿蒙" name="HARMONYOS">
          <el-alert
            v-if="options?.harmony && !options.harmony.ready && options.harmony.hint"
            type="warning"
            :closable="false"
            show-icon
            :title="options.harmony.hint"
            class="pack-alert"
          />

          <div class="pack-form">
            <div class="form-row">
              <span class="form-label">分支</span>
              <div class="form-body">
                <el-select
                  v-model="harmonyBranch"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入分支"
                  class="branch-select"
                >
                  <el-option v-for="b in harmonyBranches" :key="b" :label="b" :value="b" />
                </el-select>
                <div class="field-hint">
                  每次打包按所选分支 <code>fetch</code>，并对齐 <code>origin</code>（本地同名分支分叉会被覆盖）
                </div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">包类型</span>
              <div class="form-body">
                <div class="opt-group">
                  <button
                    v-for="p in products"
                    :key="p.id"
                    type="button"
                    class="opt-card"
                    :class="{ on: product === p.id, off: p.signingReady === false }"
                    :disabled="p.signingReady === false"
                    :title="p.signingReady === false ? p.hint || '本机没有签名' : ''"
                    @click="product = p.id"
                  >
                    <span class="opt-radio" />
                    <span class="opt-text">
                      <span class="opt-name">{{ p.label }}</span>
                      <span class="opt-desc">{{ productDesc(p) }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">产物</span>
              <div class="form-body">
                <div class="opt-group">
                  <button
                    v-for="t in outputTypes"
                    :key="t.id"
                    type="button"
                    class="opt-card wide"
                    :class="{ on: outputType === t.id }"
                    @click="outputType = t.id"
                  >
                    <span class="opt-radio" />
                    <span class="opt-text">
                      <span class="opt-name">{{ t.id }}</span>
                      <span class="opt-desc">{{ outputDesc(t.id) }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="outputType === 'HAP'" class="form-row">
              <span class="form-label">安装到设备</span>
              <div class="form-body">
                <div class="device-row">
                  <div class="device-select-wrap">
                    <el-select
                      v-model="harmonyDeviceId"
                      filterable
                      clearable
                      placeholder="可选：打完自动"
                      class="device-select"
                    >
                      <el-option v-for="d in harmonyDevices" :key="d.id" :label="deviceLabel(d)" :value="d.id" />
                    </el-select>
                    <span v-if="!harmonyDeviceId" class="device-cmd">hdc install</span>
                  </div>
                  <el-button @click="loadHarmonyDevices">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </div>
                <div class="field-hint">选中后打包成功会自动装到该机；也可稍后在记录里点「安装」</div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label" />
              <div class="form-body">
                <el-button
                  v-perm:write
                  type="primary"
                  class="start-btn"
                  :loading="starting"
                  :disabled="!canStart"
                  @click="startPack"
                >
                  <el-icon v-if="!starting"><CaretRight /></el-icon>
                  {{ harmonyDeviceId && outputType === 'HAP' ? '开始打包并安装' : '开始打包' }}
                </el-button>
                <span v-if="options?.busy" class="busy-hint">已有任务在跑，同时打会抢同一份工程</span>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="完美电竞安卓" name="ANDROID">
          <el-alert
            v-if="options?.android && !options.android.ready && options.android.hint"
            type="warning"
            :closable="false"
            show-icon
            :title="options.android.hint"
            class="pack-alert"
          />

          <div class="pack-form">
            <div class="form-row">
              <span class="form-label">分支</span>
              <div class="form-body">
                <div class="fixed-field">{{ options?.android?.branch || 'testing' }}</div>
                <div class="field-hint">
                  每次打包前会 <code>fetch</code> 并快进到 <code>origin</code> 上这条分支，页面上不能改
                </div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">包类型</span>
              <div class="form-body">
                <div class="opt-group">
                  <div class="opt-card on static">
                    <span class="opt-radio" />
                    <span class="opt-text">
                      <span class="opt-name">Debug</span>
                      <span class="opt-desc">APK · assembleDebug</span>
                    </span>
                  </div>
                </div>
                <div class="field-hint">打包时会自动写入本机 debug 抓包配置（信任用户证书）</div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">安装到设备</span>
              <div class="form-body">
                <div class="device-row">
                  <div class="device-select-wrap">
                    <el-select
                      v-model="androidDeviceId"
                      filterable
                      clearable
                      placeholder="可选：打完自动"
                      class="device-select"
                    >
                      <el-option v-for="d in androidDevices" :key="d.id" :label="deviceLabel(d)" :value="d.id" />
                    </el-select>
                    <span v-if="!androidDeviceId" class="device-cmd">adb install</span>
                  </div>
                  <el-button @click="loadAndroidDevices">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </div>
                <div class="field-hint">选中后打包成功会自动装到该机；也可稍后在记录里点「安装」</div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label" />
              <div class="form-body">
                <el-button
                  v-perm:write
                  type="primary"
                  class="start-btn"
                  :loading="starting"
                  :disabled="!canStart"
                  @click="startPack"
                >
                  <el-icon v-if="!starting"><CaretRight /></el-icon>
                  {{ androidDeviceId ? '开始打包并安装' : '开始打包' }}
                </el-button>
                <span v-if="options?.busy" class="busy-hint">已有任务在跑，同时打会抢同一台机器</span>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="完美电竞 iOS" name="IOS">
          <el-alert
            v-if="options?.ios && !options.ios.ready && options.ios.hint"
            type="warning"
            :closable="false"
            show-icon
            :title="options.ios.hint"
            class="pack-alert"
          />

          <div class="pack-form">
            <div class="form-row">
              <span class="form-label">分支</span>
              <div class="form-body">
                <el-select
                  v-model="iosBranch"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入分支"
                  class="branch-select"
                >
                  <el-option v-for="b in iosBranches" :key="b" :label="b" :value="b" />
                </el-select>
                <div class="field-hint">
                  每次打包按所选分支 <code>fetch</code>，并对齐 <code>origin</code>（本地同名分支分叉会被覆盖）
                </div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">包类型</span>
              <div class="form-body">
                <div class="opt-group">
                  <div class="opt-card on static">
                    <span class="opt-radio" />
                    <span class="opt-text">
                      <span class="opt-name">Debug</span>
                      <span class="opt-desc">IPA · development · scheme esport-app</span>
                    </span>
                  </div>
                </div>
                <div class="field-hint">对应仓库 Fastlane gym 的 Debug / development，签完可装到已注册的开发设备</div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label">安装到设备</span>
              <div class="form-body">
                <div class="device-row">
                  <div class="device-select-wrap">
                    <el-select
                      v-model="iosDeviceId"
                      filterable
                      clearable
                      placeholder="可选：打完自动"
                      class="device-select"
                    >
                      <el-option v-for="d in iosDevices" :key="d.id" :label="deviceLabel(d)" :value="d.id" />
                    </el-select>
                    <span v-if="!iosDeviceId" class="device-cmd">ideviceinstaller</span>
                  </div>
                  <el-button @click="loadIosDevices">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </div>
                <div class="field-hint">选中后打包成功会自动装到该机；也可稍后在记录里点「安装」</div>
              </div>
            </div>

            <div class="form-row">
              <span class="form-label" />
              <div class="form-body">
                <el-button
                  v-perm:write
                  type="primary"
                  class="start-btn"
                  :loading="starting"
                  :disabled="!canStart"
                  @click="startPack"
                >
                  <el-icon v-if="!starting"><CaretRight /></el-icon>
                  {{ iosDeviceId ? '开始打包并安装' : '开始打包' }}
                </el-button>
                <span v-if="options?.busy" class="busy-hint">已有任务在跑，同时打会抢同一份工程</span>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="platform === 'HARMONYOS' || platform === 'ANDROID' || platform === 'IOS'" class="panel jobs-panel">
      <div class="jobs-head">
        <span class="jobs-title">打包记录</span>
        <el-button link type="primary" size="small" @click="loadJobs">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <el-table
        v-loading="jobsLoading"
        :data="jobs"
        class="jobs-table"
        empty-text="还没有打包记录"
        :header-cell-style="{ background: '#f7f8fa', color: '#86909c', fontWeight: 500 }"
      >
        <el-table-column label="开始时间" width="130">
          <template #default="{ row }">
            <span class="mono">{{ fmtShort(row.startedAt || row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <span :title="row.gitBranch ? '分支 ' + row.gitBranch : ''">{{ jobTypeLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="产物" width="80">
          <template #default="{ row }">
            <span class="mono muted-mono">{{ row.outputType || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="120">
          <template #default="{ row }">
            <span class="mono ver-cell">{{ row.versionName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tooltip :content="statusTip(row)" :disabled="!statusTip(row)" placement="top">
              <span class="status-pill" :class="`is-${statusType(row.status)}`">
                <i class="dot" />{{ statusLabel(row.status) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作人" min-width="120">
          <template #default="{ row }">{{ row.createdBy || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="right">
          <template #default="{ row }">
            <div class="job-ops">
              <el-button type="primary" link size="small" @click="openLog(row)">日志</el-button>
              <el-button
                v-if="row.status === 'SUCCESS' && row.artifactName"
                type="primary"
                link
                size="small"
                :loading="downloadingId === row.id"
                @click="download(row)"
              >
                下载
              </el-button>
              <el-button
                v-if="canInstallRow(row)"
                v-perm:write
                type="primary"
                link
                size="small"
                :loading="installingId === row.id"
                @click="installToDevice(row)"
              >
                安装
              </el-button>
              <el-button
                v-if="row.status === 'QUEUED' || row.status === 'RUNNING'"
                v-perm:write
                type="primary"
                link
                size="small"
                @click="cancel(row)"
              >
                取消
              </el-button>
              <el-button
                v-if="row.status === 'FAILED' || row.status === 'CANCELLED'"
                v-perm:write
                type="primary"
                link
                size="small"
                :loading="retryingId === row.id"
                :disabled="!!options?.busy"
                @click="retry(row)"
              >
                重试
              </el-button>
              <el-button
                v-if="row.status !== 'QUEUED' && row.status !== 'RUNNING'"
                v-perm:delete
                type="danger"
                link
                size="small"
                @click="remove(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="logVisible" :title="logTitle" size="48%">
      <pre class="pack-log">{{ logText || '暂无日志' }}</pre>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CaretRight, Refresh } from '@element-plus/icons-vue'
import { apiClient, type AppPackJob, type AppPackOptions } from '@/api'

const platform = ref('HARMONYOS')
const product = ref('devTest')
const outputType = ref('HAP')
const harmonyBranch = ref('dev')
const iosBranch = ref('testing')
const options = ref<AppPackOptions | null>(null)
const jobs = ref<AppPackJob[]>([])
const jobsLoading = ref(false)
const starting = ref(false)
const downloadingId = ref('')
const installingId = ref('')
const retryingId = ref('')
const androidDeviceId = ref('')
const androidDevices = ref<any[]>([])
const harmonyDeviceId = ref('')
const harmonyDevices = ref<any[]>([])
const iosDeviceId = ref('')
const iosDevices = ref<any[]>([])
const logVisible = ref(false)
const logJobId = ref('')
const logText = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const products = computed(() => options.value?.harmony?.products ?? [])
const harmonyBranches = computed(() => {
  const list = options.value?.harmony?.branches ?? []
  const preferred = options.value?.harmony?.branch || harmonyBranch.value || 'dev'
  if (preferred && !list.includes(preferred)) {
    return [preferred, ...list]
  }
  return list.length ? list : [preferred]
})
const iosBranches = computed(() => {
  const list = options.value?.ios?.branches ?? []
  const preferred = options.value?.ios?.branch || iosBranch.value || 'testing'
  if (preferred && !list.includes(preferred)) {
    return [preferred, ...list]
  }
  return list.length ? list : [preferred]
})
const outputTypes = computed(() => options.value?.harmony?.outputTypes ?? [
  { id: 'HAP', label: 'HAP（装真机 / 模拟器）' },
  { id: 'APP', label: 'APP（上架包）' }
])
const selectedProduct = computed(() => products.value.find((p) => p.id === product.value))
const canStart = computed(() => {
  if (options.value?.busy) return false
  if (platform.value === 'HARMONYOS') {
    return !!options.value?.harmony?.ready
      && selectedProduct.value?.signingReady !== false
      && !!harmonyBranch.value?.trim()
  }
  if (platform.value === 'ANDROID') {
    return !!options.value?.android?.ready
  }
  if (platform.value === 'IOS') {
    return !!options.value?.ios?.ready && !!iosBranch.value?.trim()
  }
  return false
})
const logTitle = computed(() => {
  const job = jobs.value.find((j) => j.id === logJobId.value)
  return job ? `打包日志 · ${statusLabel(job.status)}` : '打包日志'
})

const currentVersion = computed(() => {
  const src =
    platform.value === 'ANDROID'
      ? options.value?.android
      : platform.value === 'IOS'
        ? options.value?.ios
        : options.value?.harmony
  if (!src?.versionName) return null
  return { name: src.versionName, code: src.versionCode || '' }
})

const PRODUCT_DESC: Record<string, string> = {
  devTest: 'buildMode devTest · 可切环境',
  debug: '带调试信息',
  release: '正式包'
}

function productDesc(p: { id: string; hint?: string; signingReady?: boolean }) {
  if (p.signingReady === false) return '本机没有签名'
  return PRODUCT_DESC[p.id] || p.hint || ''
}

function outputDesc(id: string) {
  if (id === 'HAP') return '装机 / 模拟器'
  if (id === 'APP') return '上架包'
  return ''
}

function productLabel(id: string) {
  return products.value.find((p) => p.id === id)?.label
    || ({ devTest: 'Testing', debug: 'Debug', release: 'Release' } as Record<string, string>)[id]
    || id
}

function jobTypeLabel(row: AppPackJob) {
  if (row.platform === 'ANDROID') return 'Debug'
  if (row.platform === 'IOS') return row.gitBranch ? `Debug · ${row.gitBranch}` : 'Debug'
  return productLabel(row.product)
}

function statusLabel(s: string) {
  return ({ QUEUED: '排队', RUNNING: '打包中', SUCCESS: '成功', FAILED: '失败', CANCELLED: '已取消' } as Record<string, string>)[s] || s
}

function statusType(s: string) {
  return ({
    QUEUED: 'info',
    RUNNING: 'primary',
    SUCCESS: 'success',
    FAILED: 'danger',
    CANCELLED: 'info'
  } as Record<string, string>)[s] || 'info'
}

function statusTip(row: AppPackJob) {
  const parts: string[] = []
  if (row.gitBranch) parts.push('分支 ' + row.gitBranch)
  if (row.errorMessage) parts.push(row.errorMessage)
  if (row.installStatus === 'SUCCESS') parts.push('已安装 ' + (row.installMessage || row.installDeviceId || ''))
  else if (row.installStatus === 'FAILED') parts.push('安装失败：' + (row.installMessage || ''))
  else if (row.installStatus === 'PENDING') parts.push('安装中…')
  return parts.join(' · ').trim()
}

function fmtShort(v: unknown) {
  if (!v) return '—'
  const s = String(v).replace('T', ' ')
  return s.length >= 16 ? s.slice(5, 16) : s
}

async function loadOptions() {
  try {
    options.value = await apiClient.getAppPackOptions()
    const preferredBranch = options.value.harmony?.branch || 'dev'
    // 首次/仍是旧默认时跟随后端；人手改过的分支保留
    if (!harmonyBranch.value || harmonyBranch.value === 'dev222') {
      harmonyBranch.value = preferredBranch
    }
    const iosPreferred = options.value.ios?.branch || 'testing'
    if (!iosBranch.value || iosBranch.value === 'testing') {
      iosBranch.value = iosPreferred
    }
    const list = options.value.harmony?.products || []
    if (list.length && !list.some((p) => p.id === product.value && p.signingReady !== false)) {
      // 默认 Testing（dev 分支测包）；没有再退 Debug / 第一个可签的
      const preferred =
        list.find((p) => p.id === 'devTest' && p.signingReady !== false) ||
        list.find((p) => p.id === 'debug' && p.signingReady !== false) ||
        list.find((p) => p.signingReady !== false) ||
        list[0]
      product.value = preferred.id
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '读取打包环境失败')
  }
}

async function loadJobs() {
  jobsLoading.value = true
  try {
    const res = await apiClient.listAppPacks(platform.value)
    jobs.value = res.jobs || []
  } catch (e: any) {
    jobs.value = []
    ElMessage.error(e?.message || '读取打包记录失败')
  } finally {
    jobsLoading.value = false
  }
}

function deviceLabel(d: any) {
  const name = d.name || d.model || d.id
  const st = d.status === 'CONNECTED' ? '空闲/已连接' : d.status || ''
  return `${name}（${d.id}${st ? ' · ' + st : ''}）`
}

async function loadAndroidDevices() {
  try {
    await apiClient.scanDevices().catch(() => null)
    const list = await apiClient.getDevicesByPlatform('ANDROID')
    androidDevices.value = (Array.isArray(list) ? list : []).filter(
      (d: any) => d?.status === 'CONNECTED' || d?.status === 'BUSY' || d?.status === 'RESERVED'
    )
    if (
      androidDeviceId.value &&
      !androidDevices.value.some((d: any) => d.id === androidDeviceId.value)
    ) {
      androidDeviceId.value = ''
    }
  } catch (e: any) {
    androidDevices.value = []
    ElMessage.warning(e?.message || '读取安卓设备失败')
  }
}

async function loadHarmonyDevices() {
  try {
    await apiClient.scanDevices().catch(() => null)
    const list = await apiClient.getDevicesByPlatform('HARMONYOS')
    harmonyDevices.value = (Array.isArray(list) ? list : []).filter(
      (d: any) => d?.status === 'CONNECTED' || d?.status === 'BUSY' || d?.status === 'RESERVED'
    )
    if (
      harmonyDeviceId.value &&
      !harmonyDevices.value.some((d: any) => d.id === harmonyDeviceId.value)
    ) {
      harmonyDeviceId.value = ''
    }
  } catch (e: any) {
    harmonyDevices.value = []
    ElMessage.warning(e?.message || '读取鸿蒙设备失败')
  }
}

async function loadIosDevices() {
  try {
    await apiClient.scanDevices().catch(() => null)
    const list = await apiClient.getDevicesByPlatform('IOS')
    iosDevices.value = (Array.isArray(list) ? list : []).filter(
      (d: any) => d?.status === 'CONNECTED' || d?.status === 'BUSY' || d?.status === 'RESERVED'
    )
    if (iosDeviceId.value && !iosDevices.value.some((d: any) => d.id === iosDeviceId.value)) {
      iosDeviceId.value = ''
    }
  } catch (e: any) {
    iosDevices.value = []
    ElMessage.warning(e?.message || '读取 iOS 设备失败')
  }
}

function canInstallRow(row: AppPackJob) {
  if (row.status !== 'SUCCESS' || !row.artifactName) return false
  if (row.platform === 'ANDROID' || row.platform === 'IOS') return true
  return row.platform === 'HARMONYOS' && row.outputType === 'HAP'
}

function onPlatformChange() {
  if (platform.value === 'HARMONYOS' || platform.value === 'ANDROID' || platform.value === 'IOS') loadJobs()
  if (platform.value === 'ANDROID') loadAndroidDevices()
  if (platform.value === 'HARMONYOS') loadHarmonyDevices()
  if (platform.value === 'IOS') loadIosDevices()
}

async function startPack() {
  starting.value = true
  try {
    if (platform.value === 'ANDROID') {
      await apiClient.startAppPack({
        platform: 'ANDROID',
        product: 'debug',
        outputType: 'APK',
        deviceId: androidDeviceId.value || undefined
      })
      ElMessage.success(
        androidDeviceId.value ? '已开始打包，成功后会自动安装到所选设备' : '已开始打包，完成后可在下方下载或安装'
      )
    } else if (platform.value === 'IOS') {
      await apiClient.startAppPack({
        platform: 'IOS',
        product: 'debug',
        outputType: 'IPA',
        branch: iosBranch.value.trim(),
        deviceId: iosDeviceId.value || undefined
      })
      ElMessage.success(
        iosDeviceId.value ? '已开始打包，成功后会自动安装到所选设备' : '已开始打包，完成后可在下方下载或安装'
      )
    } else {
      const installNow = outputType.value === 'HAP' && !!harmonyDeviceId.value
      await apiClient.startAppPack({
        platform: 'HARMONYOS',
        product: product.value,
        outputType: outputType.value,
        branch: harmonyBranch.value.trim(),
        deviceId: installNow ? harmonyDeviceId.value : undefined
      })
      ElMessage.success(
        installNow ? '已开始打包，成功后会自动安装到所选设备' : '已开始打包，完成后可在下方下载或安装'
      )
    }
    await Promise.all([loadOptions(), loadJobs()])
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    starting.value = false
  }
}

/** 按这条记录当时的参数再打一次；不带设备，免得装到一台已经换掉的机器上 */
async function retry(row: AppPackJob) {
  retryingId.value = row.id
  try {
    if (row.platform === 'ANDROID') {
      await apiClient.startAppPack({ platform: 'ANDROID', product: 'debug', outputType: 'APK' })
    } else if (row.platform === 'IOS') {
      await apiClient.startAppPack({
        platform: 'IOS',
        product: 'debug',
        outputType: 'IPA',
        branch: row.gitBranch || iosBranch.value.trim()
      })
    } else {
      await apiClient.startAppPack({
        platform: 'HARMONYOS',
        product: row.product,
        outputType: row.outputType,
        branch: row.gitBranch || harmonyBranch.value.trim()
      })
    }
    ElMessage.success('已重新开始打包')
    await Promise.all([loadOptions(), loadJobs()])
  } catch (e: any) {
    ElMessage.error(e?.message || '重试失败')
  } finally {
    retryingId.value = ''
  }
}

async function installToDevice(row: AppPackJob) {
  const deviceId =
    row.platform === 'HARMONYOS'
      ? harmonyDeviceId.value
      : row.platform === 'IOS'
        ? iosDeviceId.value
        : androidDeviceId.value
  if (!deviceId) {
    ElMessage.warning(
      row.platform === 'HARMONYOS'
        ? '请先在上方选择要安装的鸿蒙设备'
        : row.platform === 'IOS'
          ? '请先在上方选择要安装的 iOS 设备'
          : '请先在上方选择要安装的安卓设备'
    )
    return
  }
  installingId.value = row.id
  try {
    await apiClient.installAppPack(row.id, deviceId)
    ElMessage.success('已安装到设备')
    await loadJobs()
  } catch (e: any) {
    ElMessage.error(e?.message || '安装失败')
    await loadJobs()
  } finally {
    installingId.value = ''
  }
}

async function cancel(row: AppPackJob) {
  try {
    await apiClient.cancelAppPack(row.id)
    ElMessage.success('已取消')
    await Promise.all([loadOptions(), loadJobs()])
  } catch (e: any) {
    ElMessage.error(e?.message || '取消失败')
  }
}

async function remove(row: AppPackJob) {
  try {
    await ElMessageBox.confirm(
      '确定删除这条打包记录？产物文件也会一起删掉。',
      '删除',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deleteAppPack(row.id)
    if (logJobId.value === row.id) {
      logVisible.value = false
      logJobId.value = ''
      logText.value = ''
    }
    ElMessage.success('已删除')
    await Promise.all([loadOptions(), loadJobs()])
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function download(row: AppPackJob) {
  downloadingId.value = row.id
  try {
    await apiClient.downloadAppPackArtifact(row.id, row.artifactName)
  } catch (e: any) {
    ElMessage.error(e?.message || '下载失败')
  } finally {
    downloadingId.value = ''
  }
}

async function openLog(row: AppPackJob) {
  logJobId.value = row.id
  logVisible.value = true
  await refreshLog()
}

async function refreshLog() {
  if (!logJobId.value) return
  try {
    const job = await apiClient.getAppPack(logJobId.value)
    logText.value = job.logText || ''
    const i = jobs.value.findIndex((j) => j.id === job.id)
    if (i >= 0) jobs.value[i] = { ...jobs.value[i], ...job }
  } catch {
    /* 轮询失败不弹窗 */
  }
}

function live() {
  return jobs.value.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') || options.value?.busy
}

async function tick() {
  if (!live() && !logVisible.value) return
  await loadOptions()
  await loadJobs()
  if (logVisible.value) await refreshLog()
}

onMounted(async () => {
  await loadOptions()
  await loadJobs()
  if (platform.value === 'ANDROID') await loadAndroidDevices()
  if (platform.value === 'HARMONYOS') await loadHarmonyDevices()
  if (platform.value === 'IOS') await loadIosDevices()
  timer = setInterval(tick, 2500)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.app-pack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pack-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.pack-head-main {
  min-width: 0;
}
.pack-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.pack-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ver-card {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
}
.ver-cap {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ver-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.ver-code {
  padding: 8px 12px;
  border-radius: 6px;
  background: #1d2129;
  color: #c9cdd4;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.panel {
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.pack-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.pack-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.pack-tabs :deep(.el-tabs__item) {
  height: 44px;
  font-size: 13px;
  padding: 0 14px;
}
.pack-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
}
.pack-tabs :deep(.el-tabs__content) {
  padding: 16px 20px 20px;
}
.tab-ios em {
  margin-left: 4px;
  font-style: normal;
  font-size: 11px;
  color: var(--el-text-color-disabled);
}

.pack-alert {
  margin-bottom: 14px;
}

.pack-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.form-label {
  flex: none;
  width: 72px;
  padding-top: 7px;
  text-align: right;
  font-size: 13px;
  color: var(--app-text-regular);
}
.form-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.field-hint code {
  padding: 0 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--app-text-regular);
}

.branch-select {
  width: 330px;
}
.fixed-field {
  width: 330px;
  height: 32px;
  line-height: 30px;
  padding: 0 11px;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  color: var(--app-text-regular);
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.opt-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.opt-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 108px;
  min-height: 44px;
  padding: 8px 10px;
  box-sizing: content-box;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.opt-card.wide {
  width: 142px;
}
.opt-card:hover:not(:disabled):not(.static) {
  border-color: var(--el-color-primary-light-5);
}
.opt-card.on {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.opt-card.off {
  cursor: not-allowed;
  opacity: 0.55;
}
.opt-card.static {
  cursor: default;
}
.opt-radio {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 2px;
  border: 1px solid #c9cdd4;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}
.opt-card.on .opt-radio {
  border: 4px solid var(--el-color-primary);
}
.opt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.opt-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.opt-card.on .opt-name {
  color: var(--el-color-primary);
}
.opt-desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.device-row {
  display: flex;
  gap: 8px;
}
.device-select-wrap {
  position: relative;
  width: 284px;
}
.device-select {
  width: 100%;
}
.device-cmd {
  position: absolute;
  top: 50%;
  right: 30px;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 12px;
  color: var(--app-text-regular);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.start-btn {
  height: 34px;
  padding: 0 20px;
  font-weight: 600;
}
.start-btn :deep(.el-icon) {
  margin-right: 4px;
}
.busy-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-warning);
}

.jobs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}
.jobs-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.jobs-head :deep(.el-icon) {
  margin-right: 2px;
}
.jobs-table :deep(.el-table__cell) {
  padding: 9px 0;
}
.jobs-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.muted-mono {
  color: var(--el-text-color-secondary);
}
.ver-cell {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}
.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-pill.is-success {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.status-pill.is-primary {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.status-pill.is-danger {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.job-ops {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.job-ops .el-button + .el-button {
  margin-left: 10px;
}

.pack-log {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-text-color-primary);
}
</style>
