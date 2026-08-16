<template>
  <div class="settings-page">
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">应用设置</span>
            <p class="card-sub">
              Electron 客户端连<strong>控制面</strong>取流程和报告；插在这台电脑上的手机由本机执行节点跑。
              同一 WiFi 下控制面必须填那台电脑的局域网 IP，不要填
              <code>127.0.0.1</code>（那是本机）。例如
              <code>http://192.168.x.x:3000/api</code>
            </p>
          </div>
        </div>
      </template>

      <el-form :model="settings" label-width="120px" size="small">
        <el-form-item label="控制面地址" required>
          <el-input
            v-model="settings.apiBaseUrl"
            placeholder="http://192.168.x.x:3000/api"
            style="max-width: 480px"
          />
          <div class="form-tip">
            数据库和流程都在那台机器上。本机调试可填 <code>http://127.0.0.1:3000/api</code>
          </div>
        </el-form-item>
        <el-form-item label="本机执行节点">
          <template v-if="packaged">
            <div class="worker-status">
              <el-tag :type="workerOk ? 'success' : 'warning'" size="small" effect="plain">
                {{ workerOk ? '已随应用启动' : '未启动' }}
              </el-tag>
              <code>{{ settings.workerBaseUrl }}</code>
            </div>
            <div class="form-tip">安装包会在本机自动拉起，不用再跑 Maven。</div>
          </template>
          <template v-else>
            <el-input
              v-model="settings.workerBaseUrl"
              placeholder="http://127.0.0.1:3001/api"
              style="max-width: 480px"
            />
            <div class="form-tip">开发模式：和本机后端同一地址即可。安装包里这项会自动填。</div>
          </template>
        </el-form-item>
        <el-form-item>
          <el-button :loading="testing" @click="testConnection">测试连接</el-button>
          <el-button type="primary" @click="saveSettings">保存</el-button>
        </el-form-item>
        <el-form-item v-if="testHint" label="状态">
          <span class="form-tip inline">{{ testHint }}</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const testing = ref(false)
const testHint = ref('')
const packaged = ref(false)
const workerOk = ref(false)
const settings = ref({
  apiBaseUrl: '',
  workerBaseUrl: ''
})

onMounted(async () => {
  await loadSettings()
})

const loadSettings = async () => {
  settings.value.apiBaseUrl = apiClient.getBaseUrl()
  settings.value.workerBaseUrl = apiClient.getWorkerBaseUrl()
  const api = window.electronAPI
  if (!api?.isPackaged) return
  packaged.value = await api.isPackaged()
  if (!packaged.value) return
  const cfg = await api.getNodeConfig()
  settings.value.apiBaseUrl = cfg.controlPlaneUrl
  settings.value.workerBaseUrl = cfg.workerUrl
  apiClient.setBaseUrl(cfg.controlPlaneUrl)
  apiClient.setWorkerBaseUrl(cfg.workerUrl)
  const st = await api.getWorkerStatus()
  workerOk.value = st.ok
  testHint.value = st.message
}

const saveSettings = async () => {
  const control = settings.value.apiBaseUrl.trim()
  if (!control) {
    ElMessage.warning('请填写控制面地址')
    return
  }
  apiClient.setBaseUrl(control)
  settings.value.apiBaseUrl = apiClient.getBaseUrl()
  if (packaged.value && window.electronAPI?.setControlPlane) {
    const st = await window.electronAPI.setControlPlane(apiClient.getBaseUrl())
    workerOk.value = st.ok
    settings.value.workerBaseUrl = st.url
    apiClient.setWorkerBaseUrl(st.url)
    testHint.value = st.message
    if (!st.ok) {
      ElMessage.warning(st.message)
      return
    }
  } else {
    const worker = settings.value.workerBaseUrl.trim() || apiClient.getBaseUrl()
    apiClient.setWorkerBaseUrl(worker)
    settings.value.workerBaseUrl = apiClient.getWorkerBaseUrl()
  }
  ElMessage.success('已保存')
}

async function testConnection() {
  await saveSettings()
  testing.value = true
  try {
    const controlHealth = await apiClient.pingHealth(apiClient.getBaseUrl())
    const workerHealth = await apiClient.pingHealth(apiClient.getWorkerBaseUrl())
    testHint.value = `控制面 ${controlHealth.nodeRole || ''} · 本机 ${workerHealth.nodeRole || ''} ${workerHealth.nodeId || ''}`
    workerOk.value = workerHealth.executesLocally !== false
    ElMessage.success('已连通')
  } catch (e: any) {
    ElMessage.error(e?.message || '连不上，请确认控制面已启动')
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.settings-page {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.card-sub code,
.form-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
  font-size: 12px;
}
.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.form-tip.inline {
  margin-top: 0;
}
.worker-status {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
