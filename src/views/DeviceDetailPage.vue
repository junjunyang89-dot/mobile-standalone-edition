<template>
  <div class="device-detail-page">
    <div class="page-header">
      <el-button link type="primary" class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回设备列表
      </el-button>
      <h1 class="page-title">设备详情</h1>
    </div>

    <template v-if="loading">
      <div class="detail-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载中...
      </div>
    </template>
    <template v-else-if="error">
      <div class="detail-error">{{ error }}</div>
    </template>
    <template v-else-if="detailData">
      <div class="detail-body">
        <div class="detail-section detail-section-card">
          <div class="detail-row">
            <span class="detail-label">设备名称</span>
            <span class="detail-value detail-value-emphasis">{{ detailData.name || detailData.id || '—' }}</span>
            <el-tag
              v-if="detailData.platform"
              size="small"
              :type="platformTagType"
              class="platform-tag"
              :class="platformTagCssClass(detailData.platform)"
            >{{ platformLabel }}</el-tag>
          </div>
          <div class="detail-row">
            <span class="detail-label">电量</span>
            <el-tag :type="batteryTagType" size="small" effect="light" class="battery-tag">{{ batteryText }}</el-tag>
          </div>
        </div>

        <div v-if="installedApps.length" class="detail-section">
          <div class="detail-section-title">已安装应用</div>
          <el-table :data="installedApps" class="detail-apps-table" max-height="400" stripe>
            <el-table-column prop="name" label="应用名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="packageName" label="包名 / Bundle ID" min-width="200" show-overflow-tooltip />
            <el-table-column prop="version" label="版本" min-width="130" show-overflow-tooltip class-name="version-cell" />
          </el-table>
        </div>
        <div v-else class="detail-section">
          <div class="detail-section-title">已安装应用</div>
          <div class="detail-empty">暂无数据</div>
        </div>

        <div v-if="isIos && iosDetailEntries.length" class="detail-section detail-section-block">
          <div class="detail-section-title">iOS 设备信息</div>
          <div class="ios-detail-grid">
            <div v-for="item in iosDetailEntries" :key="item.key" class="detail-row">
              <span class="detail-label">{{ item.label }}</span>
              <span class="detail-value">{{ item.value ?? '—' }}</span>
            </div>
          </div>
        </div>

        <div v-if="isIos && detailData.iosDetailRaw" class="detail-section">
          <div class="detail-section-title">设备信息完整输出（iOS）</div>
          <pre class="device-info-raw">{{ detailData.iosDetailRaw }}</pre>
        </div>

        <template v-if="isAndroidOrHarmonyos && androidDetailSections.length">
          <div
            v-for="section in androidDetailSections"
            :key="section.key"
            class="detail-section detail-section-block"
          >
            <div class="detail-section-title">{{ section.title }}</div>
            <div class="detail-kv-list">
              <div v-for="item in section.entries" :key="item.key" class="detail-row">
                <span class="detail-label">{{ item.key }}</span>
                <span class="detail-value">{{ item.value ?? '—' }}</span>
              </div>
            </div>
          </div>
        </template>

        <div v-if="isAndroidOrHarmonyos && detailData.androidDetailRaw" class="detail-section">
          <div class="detail-section-title">设备信息完整输出（Android/HarmonyOS）</div>
          <pre class="device-info-raw">{{ detailData.androidDetailRaw }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { isIosFamilyPlatform, platformElTagType, platformRowClass as platformTagCssClass, platformUiLabel } from '@/utils/platform'

type DetailData = {
  name?: string
  id?: string
  platform?: string
  batteryLevel?: number | null
  installedApplications?: Array<{ name?: string; packageName?: string; version?: string }>
  iosDetail?: Record<string, string | number | undefined>
  iosDetailRaw?: string
  androidDetail?: {
    systemInfo?: Record<string, string | number | undefined>
    hardwareInfo?: Record<string, string | number | undefined>
    batteryInfo?: Record<string, string | number | undefined>
    storageInfo?: Record<string, string | number | undefined>
    networkInfo?: Record<string, string | number | undefined>
    securityInfo?: Record<string, string | number | undefined>
    sensorInfo?: Record<string, string | number | boolean | undefined>
  }
  androidDetailRaw?: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const detailData = ref<DetailData | null>(null)

const deviceId = computed(() => (route.params.id as string) || '')

const batteryText = computed(() => {
  if (detailData.value == null) return '—'
  const level = detailData.value.batteryLevel
  if (level == null || level < 0 || level > 100) return '电量未知'
  return `${level}%`
})

const batteryTagType = computed(() => {
  const level = detailData.value?.batteryLevel
  if (level == null || level < 0) return 'info'
  if (level > 60) return 'success'
  if (level > 20) return 'warning'
  return 'danger'
})

const platformLabel = computed(() => platformUiLabel(detailData.value?.platform || ''))

const platformTagType = computed(() => platformElTagType(detailData.value?.platform || ''))

const installedApps = computed(() => {
  const list = detailData.value?.installedApplications
  return Array.isArray(list) ? list : []
})

const isIos = computed(() => isIosFamilyPlatform(detailData.value?.platform || ''))
const isAndroidOrHarmonyos = computed(() => {
  const p = (detailData.value?.platform || '').toUpperCase()
  return p === 'ANDROID' || p === 'HARMONYOS' || p === 'POG_ANDROID'
})

const androidDetailSectionTitles: Record<string, string> = {
  systemInfo: '系统基础信息',
  hardwareInfo: '硬件配置',
  batteryInfo: '电池',
  storageInfo: '存储',
  networkInfo: '网络与连接',
  securityInfo: '安全与权限',
  sensorInfo: '传感器'
}

const androidDetailSections = computed(() => {
  const ad = detailData.value?.androidDetail
  if (!ad || typeof ad !== 'object') return []
  const order: (keyof NonNullable<DetailData['androidDetail']>)[] = [
    'systemInfo',
    'hardwareInfo',
    'batteryInfo',
    'storageInfo',
    'networkInfo',
    'securityInfo',
    'sensorInfo'
  ]
  return order
    .filter((key) => ad[key] && typeof ad[key] === 'object' && Object.keys(ad[key] as object).length > 0)
    .map((key) => {
      const obj = ad[key] as Record<string, unknown>
      const entries = Object.entries(obj)
        .map(([k, v]) => ({
          key: k,
          value: v != null && v !== '' ? String(v) : undefined
        }))
        .filter((e) => e.value !== undefined)
      return { key, title: androidDetailSectionTitles[key] || key, entries }
    })
    .filter((s) => s.entries.length > 0)
})

const iosDetailKeyLabels: Record<string, string> = {
  DeviceName: '设备名称',
  ProductName: '产品/型号',
  ProductVersion: '系统版本',
  SerialNumber: '序列号',
  UniqueDeviceID: 'UDID',
  CarrierName: '运营商',
  DeviceClass: '设备类型',
  ModelNumber: '型号',
  PhoneNumber: '电话号码',
  ActivationState: '激活状态',
  BuildVersion: 'Build 版本'
}

const iosDetailEntries = computed(() => {
  const raw = detailData.value?.iosDetail
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw).map(([key, value]) => ({
    key,
    label: iosDetailKeyLabels[key] || key,
    value: value != null && value !== '' ? String(value) : undefined
  }))
})

async function loadDetail() {
  const id = deviceId.value
  if (!id) {
    error.value = '缺少设备 ID'
    return
  }
  loading.value = true
  error.value = ''
  detailData.value = null
  try {
    const data = await apiClient.getDeviceDetail(id)
    detailData.value = data
  } catch (e: any) {
    if (e?.message && (e.message.includes('404') || e.message.includes('Not Found'))) {
      error.value = '设备不存在或无效'
    } else {
      error.value = e?.message || '加载详情失败'
    }
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'Devices' })
}

onMounted(() => {
  loadDetail()
})

watch(deviceId, (id) => {
  if (id) loadDetail()
})
</script>

<style scoped>
.device-detail-page {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px 32px;
}

.page-header {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ecf5ff 0%, #e1efff 100%);
  border-radius: 10px;
  border-left: 4px solid var(--el-color-primary);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 14px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.detail-loading,
.detail-error {
  padding: 48px 32px;
  text-align: center;
  font-size: 15px;
}

.detail-error {
  color: #f56c6c;
}

.detail-body {
  min-width: 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-card {
  padding: 18px 22px;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
  border-radius: 10px;
  border: 1px solid #b3d8ff;
  border-left: 4px solid var(--el-color-primary);
}

.platform-tag {
  margin-left: 8px;
}

.battery-tag {
  font-weight: 500;
}

.detail-section-block {
  padding: 16px 18px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  border-left: 4px solid #67c23a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.detail-section-block:nth-of-type(4n + 2) {
  border-left-color: #e6a23c;
}

.detail-section-block:nth-of-type(4n + 3) {
  border-left-color: var(--el-color-primary);
}

.detail-section-block:nth-of-type(4n) {
  border-left-color: #909399;
}

.detail-section-title {
  font-weight: 600;
  margin-bottom: 14px;
  font-size: 15px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--el-color-primary);
  display: inline-block;
  color: var(--el-color-primary);
}

.detail-section:not(.detail-section-card) .detail-section-title {
  color: #303133;
  border-bottom-color: var(--el-color-primary);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: #606266;
  min-width: 140px;
  flex-shrink: 0;
  font-size: 14px;
  padding: 2px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #606266;
}

.detail-value {
  color: #303133;
  word-break: break-all;
  font-size: 14px;
}

.detail-value-emphasis {
  font-weight: 600;
  color: #303133;
}

.detail-empty {
  color: #909399;
  font-size: 14px;
  padding: 16px 0;
}

.ios-detail-grid,
.detail-kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-apps-table :deep(.el-table__header th) {
  font-size: 14px;
  padding: 10px 12px;
  color: #303133;
  font-weight: 600;
  background: #ecf5ff !important;
  border-bottom: 2px solid var(--el-color-primary);
}

.detail-apps-table :deep(.el-table__body td) {
  font-size: 14px;
  padding: 10px 12px;
}

/* 版本列预留足够宽度，避免长版本号换行 */
.detail-apps-table :deep(.version-cell) {
  white-space: nowrap;
}
.detail-apps-table :deep(.version-cell .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-apps-table :deep(.el-table__row:hover) {
  background: #f5f7fa !important;
}

.detail-apps-table :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: #fafbfc;
}

.device-info-raw {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
  background: #f5f7fa;
  border-radius: 8px;
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #303133;
  border: 1px solid #c0c4cc;
  border-left: 4px solid #909399;
}
</style>
