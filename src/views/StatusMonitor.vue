<template>
  <div class="status-monitor">
    <div class="page-head">
      <div class="page-head-left">
        <h2 class="page-title">业务状态监控</h2>
        <el-tag size="small" type="success" effect="light">测试环境</el-tag>
        <el-tag size="small" type="danger" effect="plain">管理员</el-tag>
      </div>
      <div class="page-head-right">
        <el-button link type="primary" @click="goUrlManage">去项目管理改地址</el-button>
        <el-button type="primary" plain :loading="checking" @click="checkNow">立即检查</el-button>
        <el-button type="primary" @click="openAdd">添加监控</el-button>
      </div>
    </div>

    <div v-if="abnormalCount > 0" class="alert-banner">
      <div class="alert-banner-text">
        <span class="alert-icon">⚠</span>
        {{ abnormalCount }} 个服务异常：{{ abnormalSummary }}。请尽快处理，可能影响相关回归用例。
      </div>
      <el-button size="small" type="danger" plain>
        {{ abnormalCount }} 未处理
      </el-button>
    </div>
    <el-alert
      v-else
      type="info"
      :closable="false"
      show-icon
      class="hint-alert"
      title="点「立即检查」会对项目管理里各项目「地址」发健康检查；也可等自动轮询（约 30 秒）。"
    />

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon is-blue">⏱</div>
        <div>
          <div class="stat-label">监控服务总数</div>
          <div class="stat-value">{{ targets.length }}</div>
          <div class="stat-sub">每 30s 检查一次</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon is-green">✓</div>
        <div>
          <div class="stat-label">运行正常</div>
          <div class="stat-value">{{ onlineCount }}</div>
          <div class="stat-sub">{{ onlineRate }}% 在线</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon is-red">✕</div>
        <div>
          <div class="stat-label">服务异常</div>
          <div class="stat-value">{{ abnormalCount }}</div>
          <div class="stat-sub">需立即处理</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon is-yellow">↓</div>
        <div>
          <div class="stat-label">性能降级</div>
          <div class="stat-value">{{ degradedCount }}</div>
          <div class="stat-sub">响应变慢</div>
        </div>
      </div>
    </div>

    <div class="body-grid">
      <el-card class="list-card" shadow="never">
        <template #header>
          <div class="list-head">
            <div>
              <span class="list-title">服务列表</span>
              <span class="list-meta">最近检查：{{ lastCheckText }}</span>
            </div>
            <el-button size="small" :loading="checking" @click="checkNow">立即检查</el-button>
          </div>
        </template>

        <el-table :data="targets" size="small" stripe empty-text="还没有监控项，点右上角「添加监控」并从项目地址里选">
          <el-table-column label="服务" min-width="220">
            <template #default="{ row }">
              <div class="svc-cell">
                <span class="dot" :class="statusClass(row.status)" />
                <div>
                  <div class="svc-name">{{ row.name }}</div>
                  <div class="svc-url">{{ displayUrl(row) }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="110" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span class="status-text" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="响应时间" width="100">
            <template #default="{ row }">
              <span :class="latencyClass(row)">{{ latencyText(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="可用率 (7天)" width="110">
            <template #default="{ row }">
              {{ row.availability7d != null ? `${row.availability7d}%` : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="最后检查" width="100">
            <template #default="{ row }">
              {{ row.lastCheckedAt ? formatTime(row.lastCheckedAt) : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="showDetail(row)">详情</el-button>
              <el-button
                v-if="isAbnormal(row.status)"
                link
                type="primary"
                size="small"
                @click="ack(row)"
              >
                标记处理
              </el-button>
              <el-button link type="danger" size="small" @click="removeTarget(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="alert-card" shadow="never">
        <template #header>
          <span class="list-title">告警记录</span>
        </template>
        <div v-if="!alerts.length" class="alert-empty">暂无告警。探测接入后，宕机 / 超时 / 恢复会出现在这里。</div>
        <div v-else class="alert-list">
          <div v-for="a in alerts" :key="a.id" class="alert-item">
            <span class="alert-dot" :class="a.level" />
            <div class="alert-body">
              <div class="alert-title">{{ a.title }}</div>
              <div class="alert-desc">{{ a.desc }}</div>
              <div class="alert-time">{{ a.time }}</div>
            </div>
            <el-button v-if="a.level !== 'ok'" size="small" plain>{{ a.action || '处理中' }}</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="addVisible" title="添加监控" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="服务名" required>
          <el-input v-model="form.name" placeholder="如 app-data-center" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" filterable allow-create style="width: 100%">
            <el-option v-for="c in CATEGORIES" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="访问地址" required>
          <el-select
            v-model="form.urlId"
            filterable
            style="width: 100%"
            placeholder="从项目地址里选择（域名或 IP+端口）"
            @change="onUrlPicked"
          >
            <el-option
              v-for="u in urlOptions"
              :key="u.id"
              :label="`${u.name} · ${u.baseUrl}`"
              :value="u.id"
            />
          </el-select>
          <div class="field-hint">
            地址统一在「资产管理 → 项目管理」点项目的「地址」维护；这里只引用，不重复填 IP/域名。
          </div>
        </el-form-item>
        <el-form-item label="健康路径">
          <el-input v-model="form.healthPath" placeholder="/appdatacenter/basic/healthCheck" />
        </el-form-item>
        <el-form-item label="部署方式">
          <el-radio-group v-model="form.deployType">
            <el-radio-button value="k8s">K8s</el-radio-button>
            <el-radio-button value="docker">Docker</el-radio-button>
            <el-radio-button value="host">实体机</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAdd">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="监控详情" size="420px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="服务">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ detail.category }}</el-descriptions-item>
          <el-descriptions-item label="部署">{{ detail.deployType }}</el-descriptions-item>
          <el-descriptions-item label="Base URL">{{ detail.baseUrl || '—' }}</el-descriptions-item>
          <el-descriptions-item label="健康路径">{{ detail.healthPath || '—' }}</el-descriptions-item>
          <el-descriptions-item label="完整探活">{{ probeUrl(detail) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(detail.status) }}</el-descriptions-item>
          <el-descriptions-item label="说明">{{ detail.lastError || '—' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

type Status = 'online' | 'down' | 'timeout' | 'degraded' | 'unknown'

interface MonitorTarget {
  id: string
  name: string
  category: string
  urlId: string
  baseUrl: string
  healthPath: string
  deployType: 'k8s' | 'docker' | 'host'
  status: Status
  latencyMs: number | null
  availability7d: number | null
  lastCheckedAt: string | null
  lastError: string | null
  acked?: boolean
}

interface AlertItem {
  id: string
  level: 'danger' | 'warn' | 'ok'
  title: string
  desc: string
  time: string
  action?: string
}

const STORAGE_KEY = 'status-monitor-targets-v1'
const CATEGORIES = ['数据中心', '活动中心', '接口服务', '网关', '缓存', '数据库', '设备池', '其它']

/** 与后端 ApiUrlService.seedIntranetHostUrls 的固定 urlId / 主健康路径对齐 */
const DEFAULT_HOST_TARGETS: Array<{
  id: string
  name: string
  category: string
  urlId: string
  healthPath: string
}> = [
  { id: 'm-host-app-data-center', name: 'data-center', category: '数据中心', urlId: 'url-host-app-data-center-178', healthPath: '/appdatacenter/basic/healthCheck' },
  { id: 'm-host-app-video', name: 'app-video', category: '接口服务', urlId: 'url-host-app-video-178', healthPath: '/avo/basic/healthCheck' },
  { id: 'm-host-app-user', name: 'app-user', category: '接口服务', urlId: 'url-host-app-user-178', healthPath: '/appuser/basic/healthCheck' },
  { id: 'm-host-app-activity-center', name: 'activity-center', category: '活动中心', urlId: 'url-host-app-activity-center-178', healthPath: '/activitycenter/basic/healthCheck' },
  { id: 'm-host-app-partneragent', name: 'partneragent', category: '接口服务', urlId: 'url-host-app-partneragent-178', healthPath: '/partner/basic/healthCheck' },
  { id: 'm-host-app-robot', name: 'app-robot', category: '接口服务', urlId: 'url-host-app-robot-178', healthPath: '/robot/basic/healthCheck' },
  { id: 'm-host-app-community', name: 'app-community', category: '接口服务', urlId: 'url-host-app-community-178', healthPath: '/acty/basic/healthCheck' },
  { id: 'm-host-app-event', name: 'app-event', category: '接口服务', urlId: 'url-host-app-event-178', healthPath: '/eventcenter/basic/healthCheck' },
  { id: 'm-host-app-task-center', name: 'task-center', category: '接口服务', urlId: 'url-host-app-task-center-178', healthPath: '/task-center/basic/healthCheck' },
  { id: 'm-host-app-coupon', name: 'coupon', category: '接口服务', urlId: 'url-host-app-coupon-178', healthPath: '/coupon/basic/healthCheck' },
  { id: 'm-host-app-push', name: 'app-push', category: '接口服务', urlId: 'url-host-app-push-178', healthPath: '/apppush/basic/healthCheck' },
  { id: 'm-host-app-decoration', name: 'app-decoration', category: '接口服务', urlId: 'url-host-app-decoration-178', healthPath: '/appdecoration/basic/healthCheck' },
  { id: 'm-host-app-activity', name: 'app-activity', category: '活动中心', urlId: 'url-host-app-activity-120', healthPath: '/basic/healthCheck' },
  { id: 'm-host-app-mall-center', name: 'mall-center', category: '接口服务', urlId: 'url-host-app-mall-center-120', healthPath: '/mallCenter/basic/healthCheck' },
  { id: 'm-host-app-message-center', name: 'comment-service', category: '接口服务', urlId: 'url-host-app-message-center-120', healthPath: '/basic/healthCheck' },
  { id: 'm-host-app-data-provider', name: 'data-provider', category: '数据中心', urlId: 'url-host-app-data-provider-120', healthPath: '/basic/healthCheck' },
  { id: 'm-host-app-news-publish', name: 'news-publish', category: '接口服务', urlId: 'url-host-app-news-publish-120', healthPath: '/basic/healthCheck' },
  { id: 'm-host-app-global-agent', name: 'global-agent', category: '接口服务', urlId: 'url-host-app-global-agent-120', healthPath: '/global-agent/basic/healthCheck' },
  { id: 'm-host-app-admin', name: 'app-admin', category: '接口服务', urlId: 'url-host-app-admin-120', healthPath: '/basic/healthCheck' },
]

const router = useRouter()
const targets = ref<MonitorTarget[]>([])
const urlOptions = ref<any[]>([])
const urlMap = ref<Record<string, any>>({})
const alerts = ref<AlertItem[]>([])
const checking = ref(false)
const addVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<MonitorTarget | null>(null)
const lastCheckAt = ref<string | null>(null)

const form = reactive({
  name: '',
  category: '接口服务',
  urlId: '',
  healthPath: '/basic/healthCheck',
  deployType: 'host' as MonitorTarget['deployType'],
})

const abnormalCount = computed(
  () => targets.value.filter((t) => isAbnormal(t.status) && !t.acked).length
)
const degradedCount = computed(() => targets.value.filter((t) => t.status === 'degraded').length)
const onlineCount = computed(() => targets.value.filter((t) => t.status === 'online').length)
const onlineRate = computed(() => {
  if (!targets.value.length) return 0
  return Math.round((onlineCount.value / targets.value.length) * 100)
})
const abnormalSummary = computed(() => {
  const list = targets.value.filter((t) => isAbnormal(t.status) && !t.acked)
  return list.map((t) => `${t.name} (${statusLabel(t.status)})`).join('、') || '—'
})
const lastCheckText = computed(() => {
  if (!lastCheckAt.value) return '尚未检查'
  return formatTime(lastCheckAt.value)
})

function isAbnormal(s: Status) {
  return s === 'down' || s === 'timeout'
}

function statusLabel(s: Status) {
  return (
    {
      online: '在线',
      down: '宕机',
      timeout: '连接超时',
      degraded: '降级',
      unknown: '未检查',
    }[s] || s
  )
}

function statusClass(s: Status) {
  if (s === 'online') return 'ok'
  if (s === 'degraded') return 'warn'
  if (s === 'down' || s === 'timeout') return 'danger'
  return 'muted'
}

function latencyText(row: MonitorTarget) {
  if (row.latencyMs == null) return '—'
  if (row.latencyMs >= 5000) return '>5s'
  if (row.latencyMs >= 1000) return `${(row.latencyMs / 1000).toFixed(1)}s`
  return `${row.latencyMs}ms`
}

function latencyClass(row: MonitorTarget) {
  if (row.latencyMs == null) return ''
  if (row.latencyMs >= 5000 || row.status === 'down' || row.status === 'timeout') return 'lat-bad'
  if (row.latencyMs >= 1000 || row.status === 'degraded') return 'lat-warn'
  return 'lat-ok'
}

function displayUrl(row: MonitorTarget) {
  const base = row.baseUrl || urlMap.value[row.urlId]?.baseUrl || ''
  if (!base) return '（URL 已删除，请重新关联）'
  return base
}

function probeUrl(row: MonitorTarget) {
  const base = (row.baseUrl || '').replace(/\/$/, '')
  const path = row.healthPath?.startsWith('/') ? row.healthPath : `/${row.healthPath || ''}`
  return base ? `${base}${path}` : '—'
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(targets.value))
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    targets.value = JSON.parse(raw)
  } catch {
    targets.value = []
  }
}

/** 把后端种好的内网 URL + 健康路径补进监控名单（已有同 id / 同 urlId 的不重复加） */
function ensureDefaultTargets() {
  const haveId = new Set(targets.value.map((t) => t.id))
  const haveUrl = new Set(targets.value.map((t) => t.urlId))
  let added = 0
  for (const d of DEFAULT_HOST_TARGETS) {
    if (haveId.has(d.id) || haveUrl.has(d.urlId)) continue
    const u = urlMap.value[d.urlId]
    targets.value.push({
      id: d.id,
      name: d.name,
      category: d.category,
      urlId: d.urlId,
      baseUrl: u?.baseUrl || '',
      healthPath: d.healthPath,
      deployType: 'host',
      status: 'unknown',
      latencyMs: null,
      availability7d: null,
      lastCheckedAt: null,
      lastError: null,
    })
    haveId.add(d.id)
    haveUrl.add(d.urlId)
    added++
  }
  if (added > 0) persist()
}

async function loadUrls() {
  const rows = await apiClient.getApiUrls({ environment: 'TEST', enabledOnly: true })
  urlOptions.value = rows || []
  const map: Record<string, any> = {}
  for (const u of urlOptions.value) map[u.id] = u
  urlMap.value = map
  ensureDefaultTargets()
  // 同步最新 baseUrl
  for (const t of targets.value) {
    if (map[t.urlId]) t.baseUrl = map[t.urlId].baseUrl
  }
  persist()
}

function goUrlManage() {
  router.push('/api-projects')
}

function openAdd() {
  form.name = ''
  form.category = '接口服务'
  form.urlId = ''
  form.healthPath = '/basic/healthCheck'
  form.deployType = 'host'
  addVisible.value = true
}

function onUrlPicked(id: string) {
  const u = urlMap.value[id]
  if (!u) return
  if (!form.name) form.name = u.project || u.name
}

function saveAdd() {
  if (!form.name.trim() || !form.urlId) {
    ElMessage.warning('请填写服务名并选择 URL')
    return
  }
  const u = urlMap.value[form.urlId]
  targets.value.unshift({
    id: `m-${Date.now()}`,
    name: form.name.trim(),
    category: form.category || '其它',
    urlId: form.urlId,
    baseUrl: u?.baseUrl || '',
    healthPath: form.healthPath.trim() || '/health',
    deployType: form.deployType,
    status: 'unknown',
    latencyMs: null,
    availability7d: null,
    lastCheckedAt: null,
    lastError: null,
  })
  persist()
  addVisible.value = false
  ElMessage.success('已添加')
}

function showDetail(row: MonitorTarget) {
  detail.value = row
  detailVisible.value = true
}

function ack(row: MonitorTarget) {
  row.acked = true
  persist()
  ElMessage.success('已标记处理')
}

async function removeTarget(row: MonitorTarget) {
  await ElMessageBox.confirm(`移除监控「${row.name}」？不会删除项目里的地址。`, '确认', {
    type: 'warning',
  })
  targets.value = targets.value.filter((t) => t.id !== row.id)
  persist()
  refreshAlerts()
}

async function checkNow() {
  if (!targets.value.length) {
    ElMessage.warning('还没有监控项')
    return
  }
  checking.value = true
  try {
    const payload = targets.value.map((t) => ({
      id: t.id,
      urlId: t.urlId,
      healthPath: t.healthPath,
    }))
    const res = await apiClient.probeStatusMonitor(payload)
    const now = new Date().toISOString()
    lastCheckAt.value = now
    const byId = new Map((res?.results || []).map((r) => [r.id, r]))
    for (const t of targets.value) {
      const r = byId.get(t.id)
      t.lastCheckedAt = (r?.checkedAt as string) || now
      if (!r) {
        t.status = 'unknown'
        t.lastError = '未返回探测结果'
        continue
      }
      if (r.baseUrl) t.baseUrl = r.baseUrl
      t.status = (r.status as Status) || 'unknown'
      t.latencyMs = r.latencyMs ?? null
      t.lastError = r.error || null
      if (t.status === 'online') t.acked = false
    }
    persist()
    refreshAlerts()
    const bad = targets.value.filter((t) => isAbnormal(t.status)).length
    if (bad > 0) {
      ElMessage.warning(`检查完成：${bad} 个异常`)
    } else {
      ElMessage.success('检查完成')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '探测失败')
  } finally {
    checking.value = false
  }
}

/** 设计稿示意用的示例告警（无真实探测时给空态；有异常目标时生成简要记录） */
function refreshAlerts() {
  const items: AlertItem[] = []
  for (const t of targets.value) {
    if (!isAbnormal(t.status) && t.status !== 'degraded') continue
    items.push({
      id: `a-${t.id}`,
      level: t.status === 'degraded' ? 'warn' : 'danger',
      title: `${t.name} ${statusLabel(t.status)}`,
      desc: t.lastError || '健康检查未通过',
      time: t.lastCheckedAt ? formatTime(t.lastCheckedAt) : '—',
      action: t.acked ? '已处理' : '处理中',
    })
  }
  alerts.value = items
}

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  loadLocal()
  try {
    await loadUrls()
  } catch (e: any) {
    ElMessage.warning(e?.message || '加载 URL 列表失败')
  }
  refreshAlerts()
  if (targets.value.length) {
    checkNow()
  }
  pollTimer = setInterval(() => {
    if (!checking.value && targets.value.length) checkNow()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.status-monitor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.page-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.page-head-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  color: var(--el-color-danger-dark-2);
  font-size: 13px;
}
.alert-icon {
  margin-right: 6px;
}
.hint-alert {
  border-radius: 8px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 16px;
}
.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 16px;
  flex-shrink: 0;
}
.stat-icon.is-blue {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.stat-icon.is-green {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.stat-icon.is-red {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.stat-icon.is-yellow {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  margin: 2px 0;
}
.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.body-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: start;
}
.list-card,
.alert-card {
  border-radius: 10px;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.list-title {
  font-weight: 600;
  margin-right: 10px;
}
.list-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.svc-cell {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  background: #d9d9d9;
  flex-shrink: 0;
}
.dot.ok {
  background: var(--el-color-success);
}
.dot.warn {
  background: var(--el-color-warning);
}
.dot.danger {
  background: var(--el-color-danger);
}
.svc-name {
  font-weight: 600;
  font-size: 13px;
}
.svc-url {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.status-text.ok {
  color: var(--el-color-success);
}
.status-text.warn {
  color: var(--el-color-warning-dark-2);
}
.status-text.danger {
  color: var(--el-color-danger);
}
.status-text.muted {
  color: var(--el-text-color-secondary);
}
.lat-ok {
  color: var(--el-color-success);
}
.lat-warn {
  color: var(--el-color-warning-dark-2);
}
.lat-bad {
  color: var(--el-color-danger);
}
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 62vh;
  overflow: auto;
}
.alert-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.alert-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.alert-dot.danger {
  background: var(--el-color-danger);
}
.alert-dot.warn {
  background: var(--el-color-warning);
}
.alert-dot.ok {
  background: var(--el-color-success);
}
.alert-title {
  font-size: 13px;
  font-weight: 600;
}
.alert-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 2px 0;
}
.alert-time {
  font-size: 12px;
  color: var(--el-text-color-disabled);
}
.alert-empty {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
@media (max-width: 1100px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .body-grid {
    grid-template-columns: 1fr;
  }
}
</style>
