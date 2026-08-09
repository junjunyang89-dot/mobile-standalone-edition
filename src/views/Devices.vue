<template>
  <div class="devices">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设备管理</span>
          <el-button type="primary" :loading="deviceStore.loading" @click="refreshDevices">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <div class="filter-bar">
        <span class="filter-label">平台：</span>
        <el-select
          v-model="platformFilter"
          placeholder="全部"
          size="small"
          class="platform-select"
          @change="onPlatformChange"
        >
          <el-option label="全部" value="" />
          <el-option label="Android" value="ANDROID" />
          <el-option label="iOS" value="IOS" />
          <el-option label="HarmonyOS" value="HARMONYOS" />
        </el-select>
        <span class="device-total" @click="onTotalClick">
          共 {{ deviceStore.devices.length }} 台设备（点击查看详情）
        </span>
      </div>

      <el-table
        :data="deviceStore.devices"
        v-loading="deviceStore.loading"
        style="width: 100%"
        :header-cell-style="{ background: '#f5f7fa' }"
        highlight-current-row
        @row-click="onRowClick"
      >
        <el-table-column prop="name" label="设备名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="device-name-link">{{ row.name || row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ platformLabel(row.platform) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="version-cell">{{ row.version || '—' }}</span>
          </template>
        </el-table-column>
        <!--
          环境绑在设备上：一台手机装的就是某个环境的包，不会一会儿线上一会儿测试。
          四台机同时跑（两台线上两台测试）时不用每次去勾一遍。
        -->
        <el-table-column label="环境" width="130">
          <template #default="{ row }">
            <el-select
              :model-value="row.environment || ''"
              size="small"
              placeholder="执行时再定"
              @click.stop
              @change="(v: string) => saveEnvironment(row, v)"
            >
              <el-option label="执行时再定" value="" />
              <el-option label="测试" value="TEST" />
              <el-option label="线上" value="PROD" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="deviceStatusType(row.status)" size="small">
              {{ deviceStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastSeen" label="最后可见时间" width="170">
          <template #default="{ row }">
            {{ formatLastSeen(row.lastSeen) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" @click.stop>
          <template #default="{ row }">
            <el-button
              v-if="!isConnected(row.status)"
              type="primary"
              size="small"
              @click="connectDevice(row.id)"
            >
              连接
            </el-button>
            <el-button
              v-else
              type="danger"
              size="small"
              @click="disconnectDevice(row.id)"
            >
              断开
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!deviceStore.loading && deviceStore.devices.length === 0"
        description="暂无设备，请确认设备已通过 USB 连接并开启调试后点击「刷新」" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { useDeviceStore } from '@/stores/device'
import { isSupportedDevicePlatform, platformUiLabel } from '@/utils/platform'

const route = useRoute()
const router = useRouter()
const deviceStore = useDeviceStore()
const platformFilter = ref('')

/**
 * 保存设备绑定的环境。
 *
 * 就地改 row 而不是整表刷新：刷新会重排/闪一下，人刚点完就被打断。
 * 保存失败再回滚——乐观更新的代价必须是「失败要退回去」，否则界面会跟数据库不一致。
 */
async function saveEnvironment(row: any, value: string) {
  const before = row.environment || ''
  row.environment = value
  try {
    await apiClient.setDeviceEnvironment(row.id, value)
    ElMessage.success(value ? `已绑定到${value === 'PROD' ? '线上' : '测试'}` : '已取消绑定')
  } catch (e: any) {
    row.environment = before
    ElMessage.error(e?.message || '保存失败')
  }
}

function platformLabel(p: string) {
  return platformUiLabel(p)
}

function isConnected(status: string) {
  return (status || '').toUpperCase() === 'CONNECTED'
}

function deviceStatusText(status: string) {
  return isConnected(status) ? '已连接' : '未连接'
}

function deviceStatusType(status: string) {
  return isConnected(status) ? 'success' : 'info'
}

function formatLastSeen(val: string | number | undefined) {
  if (val == null || val === '') return '—'
  const date = typeof val === 'string' ? new Date(val) : new Date(Number(val))
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

function onRowClick(row: { id: string }) {
  if (row?.id) router.push({ name: 'DeviceDetail', params: { id: row.id } })
}

function onTotalClick() {
  const first = deviceStore.devices[0]
  if (first) router.push({ name: 'DeviceDetail', params: { id: first.id } })
  else ElMessage.info('暂无设备')
}

onMounted(() => {
  const platform = route.query.platform as string
  const u = platform?.toUpperCase() || ''
  if (u && isSupportedDevicePlatform(u)) {
    platformFilter.value = u
  }
  deviceStore.fetchDevices(platformFilter.value || undefined)
})

const onPlatformChange = () => {
  deviceStore.fetchDevices(platformFilter.value || undefined)
}

/** 刷新：先触发后端扫描，再拉取设备列表 */
const refreshDevices = async () => {
  try {
    await deviceStore.scanAndFetchDevices(platformFilter.value || undefined)
    ElMessage.success('刷新成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  }
}

const connectDevice = async (deviceId: string) => {
  try {
    await deviceStore.connectDevice(deviceId)
    ElMessage.success('连接成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '连接失败')
  }
}

const disconnectDevice = async (deviceId: string) => {
  try {
    await deviceStore.disconnectDevice(deviceId)
    ElMessage.success('断开成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '断开失败')
  }
}
</script>

<style scoped>
.devices {
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
  gap: 8px;
  margin-bottom: 16px;
}

.filter-label {
  font-size: 13px;
  color: var(--app-text-secondary);
}

.platform-select {
  width: 140px;
}

.device-total {
  margin-left: 16px;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.device-total:hover {
  text-decoration: underline;
}

.device-name-link {
  color: var(--el-color-primary);
  cursor: pointer;
}

.device-name-link:hover {
  text-decoration: underline;
}

.version-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table .cell) {
  line-height: 23px;
}
</style>
