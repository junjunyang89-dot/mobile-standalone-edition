<template>
  <div class="app-auto-cases">
    <header class="page-nav">
      <div class="nav-left">
        <span class="nav-title">自动化用例</span>
        <span class="nav-sub">按环境 · 产品 · 端查看 · 同一条流程两边都能跑</span>
      </div>
      <div class="nav-right">
        <div class="nav-actions">
          <button
            type="button"
            class="btn-nav"
            :disabled="!selectedRows.length"
            @click="openBatch"
          >
            批量执行{{ selectedRows.length ? `（${selectedRows.length}）` : '' }}
          </button>
          <button type="button" class="btn-nav btn-nav-primary" @click="goFlows">去编排</button>
        </div>
        <div v-if="user" class="nav-user">
          <el-tag size="small" effect="dark" class="nav-user-role">{{ user.roleLabel }}</el-tag>
          <el-dropdown trigger="click" @command="onNavUserCommand">
            <span class="nav-user-name">
              {{ user.displayName || user.username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="!user.bootstrapping" command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <div class="filter-bar">
      <div class="env-tabs">
        <button
          type="button"
          class="env-tab"
          :class="{ active: environment === 'TEST' }"
          @click="switchEnv('TEST')"
        >
          测试环境
        </button>
        <button
          type="button"
          class="env-tab"
          :class="{ active: environment === 'PROD' }"
          @click="switchEnv('PROD')"
        >
          生产环境
        </button>
      </div>
      <div class="env-tabs">
        <button
          v-for="p in PRODUCTS"
          :key="p.value"
          type="button"
          class="env-tab"
          :class="{ active: product === p.value }"
          @click="switchProduct(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="env-tabs">
        <button
          v-for="p in platformTabs"
          :key="p.value"
          type="button"
          class="env-tab"
          :class="{ active: platform === p.value }"
          @click="switchPlatform(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
      <el-input
        v-model="keyword"
        class="f-search"
        size="small"
        clearable
        placeholder="搜索流程名"
        @keyup.enter="load"
      />
      <el-button type="primary" size="small" :loading="loading" @click="load">查询</el-button>
    </div>

    <div class="status-bar">
      <span class="path-label">{{ pathLabel }}</span>
      <span class="path-meta">{{ rows.length }} 条</span>
      <el-alert
        v-if="product === 'POGPOG'"
        type="warning"
        :closable="false"
        show-icon
        class="proxy-alert"
        title="海外 PogPog：开跑时会走海外代理，请确认执行端 VPN 就绪。"
      />
    </div>

    <div class="table-wrap" v-loading="loading">
      <el-table
        :data="rows"
        stripe
        border
        size="small"
        height="100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <span>{{ row.name }}</span>
              <el-tag v-if="row.enabled === false" size="small" type="info">停用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="覆盖用例" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.caseCount == null" class="muted">…</span>
            <span v-else-if="row.caseCount === 0" class="muted">未挂</span>
            <el-tag v-else size="small" type="success">{{ row.caseCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="步骤" width="72" align="center">
          <template #default="{ row }">{{ stepCount(row) }}</template>
        </el-table-column>
        <el-table-column label="用途" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="catalogTagType(row.catalog)" effect="light">
              {{ catalogLabel(row.catalog) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.lastRunStatus" size="small" :type="runTagType(row.lastRunStatus)">
              {{ runLabel(row.lastRunStatus) }}
            </el-tag>
            <span v-else class="muted">未跑</span>
          </template>
        </el-table-column>
        <el-table-column label="更新" width="110">
          <template #default="{ row }">{{ fmtDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="148" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openExecute(row)">执行</el-button>
            <el-button link type="primary" size="small" @click="openFlowEditor(row)">编排</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !rows.length" :description="emptyHint" />
    </div>

    <el-dialog v-model="execVisible" title="执行流程" width="480px" destroy-on-close>
      <div v-if="execRow" class="exec-body">
        <div class="exec-name">{{ execRow.name }}</div>
        <div class="exec-ctx">{{ pathLabel }}</div>
        <div class="exec-field">
          <div class="exec-field-label">执行设备</div>
          <el-select v-model="execDeviceId" filterable placeholder="选择已连接设备" style="width: 100%">
            <el-option
              v-for="d in deviceOptions"
              :key="d.id"
              :label="`${d.name || d.id}（${d.platform || '-'}）`"
              :value="d.id"
            />
          </el-select>
          <div v-if="!deviceOptions.length" class="exec-hint">当前没有已连接且匹配该端的设备</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="execVisible = false">取消</el-button>
        <el-button type="primary" :loading="executing" @click="submitExecute">开始执行</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchVisible" title="批量执行" width="560px" destroy-on-close>
      <el-form label-width="88px">
        <el-form-item label="范围">{{ pathLabel }} · {{ selectedRows.length }} 条</el-form-item>
        <el-form-item label="执行设备">
          <el-select v-model="batchDeviceIds" multiple clearable placeholder="选择已连接设备" style="width: 100%">
            <el-option
              v-for="d in deviceOptions"
              :key="d.id"
              :label="`${d.name || d.id}（${d.platform || '-'}）`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchStarting" @click="submitBatch">开始执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { logout, user } from '@/stores/auth'
import { isAndroidFamilyPlatform, isIosFamilyPlatform } from '@/utils/platform'

type Env = 'TEST' | 'PROD'
type Product = 'ESPORTS' | 'POGPOG'
type Platform = 'ANDROID' | 'IOS' | 'HARMONYOS'

const PRODUCTS = [
  { value: 'ESPORTS' as const, label: '完美电竞' },
  { value: 'POGPOG' as const, label: 'POGPOG' }
]

const router = useRouter()
const NAV_KEY = 'app-automation-nav'

function readNav(): { environment: Env; product: Product; platform: Platform } {
  try {
    const raw = sessionStorage.getItem(NAV_KEY)
    if (!raw) return { environment: 'TEST', product: 'ESPORTS', platform: 'ANDROID' }
    const n = JSON.parse(raw) as { environment?: string; product?: string; platform?: string }
    const env: Env = n.environment === 'PROD' ? 'PROD' : 'TEST'
    const prod: Product = n.product === 'POGPOG' ? 'POGPOG' : 'ESPORTS'
    let plat: Platform = n.platform === 'IOS' ? 'IOS' : n.platform === 'HARMONYOS' ? 'HARMONYOS' : 'ANDROID'
    if (prod === 'POGPOG' && plat === 'HARMONYOS') plat = 'ANDROID'
    return { environment: env, product: prod, platform: plat }
  } catch {
    return { environment: 'TEST', product: 'ESPORTS', platform: 'ANDROID' }
  }
}

const stored = readNav()
const environment = ref<Env>(stored.environment)
const product = ref<Product>(stored.product)
const platform = ref<Platform>(stored.platform)
const keyword = ref('')
const loading = ref(false)
const rows = ref<any[]>([])
const selectedRows = ref<any[]>([])

const execVisible = ref(false)
const execRow = ref<any | null>(null)
const execDeviceId = ref('')
const executing = ref(false)

const batchVisible = ref(false)
const batchDeviceIds = ref<string[]>([])
const batchStarting = ref(false)
const deviceOptions = ref<any[]>([])

const platformTabs = computed(() => {
  const tabs = [
    { value: 'ANDROID' as const, label: 'ANDROID' },
    { value: 'IOS' as const, label: 'iOS' }
  ]
  if (product.value === 'ESPORTS') {
    tabs.push({ value: 'HARMONYOS' as const, label: 'HarmonyOS' })
  }
  return tabs
})

const currentAppId = computed(() => {
  if (product.value === 'POGPOG') return 'OVERSEAS_POGPOG'
  if (platform.value === 'HARMONYOS') return 'DOMESTIC_ESPORTS_HARMONY'
  return 'DOMESTIC_ESPORTS'
})

const pathLabel = computed(() => {
  const env = environment.value === 'TEST' ? '测试环境' : '生产环境'
  const prod = product.value === 'ESPORTS' ? '完美电竞' : 'POGPOG'
  const plat = platform.value === 'HARMONYOS' ? 'HarmonyOS' : platform.value === 'IOS' ? 'iOS' : 'ANDROID'
  return `${env} · ${prod} · ${plat}`
})

const emptyHint = computed(() => {
  if (platform.value === 'HARMONYOS') {
    return '鸿蒙暂无自动化用例。先在元素管理采集鸿蒙元素，再在流程编排为国内电竞·鸿蒙建流程。'
  }
  if (product.value === 'POGPOG') {
    return '海外 PogPog 暂无自动化用例。请在流程编排中为 OVERSEAS_POGPOG 创建「仅自动化」或「回归+自动化」流程。'
  }
  return '该端暂无自动化用例。去流程编排新建，用途选「仅自动化」或「回归+自动化」。'
})

function switchEnv(env: Env) {
  if (environment.value === env) return
  environment.value = env
}

function switchProduct(next: Product) {
  if (product.value === next) return
  product.value = next
  if (next === 'POGPOG' && platform.value === 'HARMONYOS') {
    platform.value = 'ANDROID'
  }
}

function switchPlatform(next: Platform) {
  if (platform.value === next) return
  platform.value = next
}

watch([environment, product, platform], () => {
  try {
    sessionStorage.setItem(
      NAV_KEY,
      JSON.stringify({
        environment: environment.value,
        product: product.value,
        platform: platform.value
      })
    )
  } catch {
    /* ignore */
  }
  selectedRows.value = []
  void load()
})

function onSelectionChange(sel: any[]) {
  selectedRows.value = sel
}

function stepCount(row: any): number {
  try {
    const raw = row?.steps
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function catalogLabel(c: string) {
  if (c === 'AUTOMATION') return '仅自动化'
  if (c === 'SHARED') return '回归+自动化'
  if (c === 'ONLINE') return '仅回归'
  return c || '—'
}

function catalogTagType(c: string): 'primary' | 'success' | 'warning' | 'info' {
  if (c === 'AUTOMATION') return 'primary'
  if (c === 'SHARED') return 'info'
  if (c === 'ONLINE') return 'success'
  return 'info'
}

function runLabel(status: string) {
  const u = String(status || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return '通过'
  if (u === 'FAILED') return '失败'
  if (u === 'RUNNING') return '执行中'
  if (u === 'STOPPED') return '已停止'
  if (u === 'PENDING') return '排队'
  return status || '未跑'
}

function runTagType(status: string): 'success' | 'danger' | 'warning' | 'info' {
  const u = String(status || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return 'success'
  if (u === 'FAILED') return 'danger'
  if (u === 'RUNNING' || u === 'PENDING') return 'warning'
  return 'info'
}

function fmtDate(v: unknown) {
  if (!v) return '—'
  const s = String(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function deviceMatchesPlatform(d: any): boolean {
  const p = String(d?.platform || '')
  if (platform.value === 'HARMONYOS') return p.toUpperCase().startsWith('HARMONY')
  if (platform.value === 'IOS') return isIosFamilyPlatform(p)
  return isAndroidFamilyPlatform(p)
}

async function loadConnectedDevices() {
  try {
    const all = await apiClient.getDevices()
    const rowsAll = Array.isArray(all) ? all : []
    const seen = new Set<string>()
    deviceOptions.value = rowsAll.filter((d: any) => {
      const id = d?.id
      if (!id || seen.has(id)) return false
      if (String(d.status || '').toUpperCase() !== 'CONNECTED') return false
      if (!deviceMatchesPlatform(d)) return false
      seen.add(id)
      return true
    })
  } catch {
    deviceOptions.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const list = await apiClient.getUiFlows({
      appId: currentAppId.value,
      platform: platform.value,
      forRegression: true,
      track: 'AUTOMATION',
      environment: environment.value,
      name: keyword.value.trim() || undefined
    })
    rows.value = (list || []).map((row: any) => ({
      ...row,
      caseCount: null as number | null,
      lastRunStatus: null as string | null,
      lastRunTaskId: null as string | null
    }))
    void enrichRows(rows.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function enrichRows(list: any[]) {
  const slice = list.slice(0, 40)
  const ids = slice.map((r) => r.id).filter(Boolean)
  try {
    const lastRuns = await apiClient.getUiFlowLastRuns(ids)
    for (const row of slice) {
      const hit = lastRuns?.[row.id]
      row.lastRunStatus = hit?.lastRunStatus || null
      row.lastRunTaskId = hit?.lastRunTaskId || null
    }
  } catch {
    /* 最近结果查不到就保持「未跑」，别挡整张表 */
  }
  await Promise.all(
    slice.map(async (row) => {
      try {
        const cases = await apiClient.getFlowCases(row.id)
        row.caseCount = Array.isArray(cases) ? cases.length : 0
      } catch {
        row.caseCount = 0
      }
    })
  )
}

function applyLastRun(row: any, status: string | null, taskId?: string | null) {
  const target = rows.value.find((r) => r.id === row?.id) || row
  if (!target) return
  target.lastRunStatus = status
  if (taskId) target.lastRunTaskId = taskId
}

const DONE_STATUS = new Set(['COMPLETED', 'FAILED', 'STOPPED', 'SKIPPED'])

async function watchTask(row: any, taskId: string) {
  applyLastRun(row, 'RUNNING', taskId)
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    if (!rows.value.some((r) => r.id === row.id)) return
    try {
      const t = await apiClient.getTask(taskId)
      const st = String(t?.status || '').toUpperCase()
      if (!st) continue
      applyLastRun(row, st, taskId)
      if (DONE_STATUS.has(st)) return
    } catch {
      /* 轮询失败再试，别把「执行中」清掉 */
    }
  }
}

function goFlows() {
  void router.push('/ui-flows')
}

function openFlowEditor(row: any) {
  const id = String(row?.id || '').trim()
  if (!id) {
    ElMessage.warning('流程 ID 为空，无法打开编辑')
    return
  }
  const name = String(row?.name || '').trim()
  try {
    sessionStorage.setItem(
      'ui-flows-pending-edit',
      JSON.stringify({ id, name, at: Date.now() })
    )
  } catch {
    /* ignore */
  }
  void router
    .push({
      path: '/ui-flows',
      query: { edit: id, ...(name ? { name } : {}), _t: String(Date.now()) }
    })
    .catch(() => ElMessage.error('跳转流程编排失败'))
}

async function confirmProd() {
  if (environment.value !== 'PROD') return true
  try {
    await ElMessageBox.confirm(
      '当前选的是<span style="color:#ff4d4f;font-weight:700">生产环境</span>',
      '生产环境提醒',
      {
        type: 'error',
        dangerouslyUseHTMLString: true,
        confirmButtonText: '仍要执行',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
    return true
  } catch {
    return false
  }
}

async function openExecute(row: any) {
  execRow.value = row
  execDeviceId.value = ''
  execVisible.value = true
  await loadConnectedDevices()
  if (deviceOptions.value.length === 1) {
    execDeviceId.value = deviceOptions.value[0].id
  }
}

async function submitExecute() {
  if (!execRow.value?.id) return
  if (!execDeviceId.value) {
    ElMessage.warning('请选择设备')
    return
  }
  if (!(await confirmProd())) return
  executing.value = true
  try {
    const res = await apiClient.executeUiFlow(execRow.value.id, {
      deviceId: execDeviceId.value,
      platform: execRow.value.platform || platform.value,
      appId: execRow.value.appId || currentAppId.value,
      environment: environment.value,
      runNow: true
    })
    ElMessage.success(res.message || '已开始执行')
    execVisible.value = false
    const taskId = res.taskId || res.task?.id
    if (taskId) {
      applyLastRun(execRow.value, res.started ? 'RUNNING' : 'PENDING', taskId)
      void watchTask(execRow.value, taskId)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    executing.value = false
  }
}

async function openBatch() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先勾选用例')
    return
  }
  batchDeviceIds.value = []
  batchVisible.value = true
  await loadConnectedDevices()
}

async function submitBatch() {
  if (!batchDeviceIds.value.length) {
    ElMessage.warning('请选择至少一台设备')
    return
  }
  if (!(await confirmProd())) return
  batchStarting.value = true
  try {
    const res = await apiClient.startOnlineRegressionRun({
      appIds: [currentAppId.value],
      deviceIds: batchDeviceIds.value,
      flowIds: selectedRows.value.map((f) => f.id),
      environment: environment.value,
      track: 'AUTOMATION',
      enableOverseasProxy: product.value === 'POGPOG'
    })
    batchVisible.value = false
    ElMessage.success(`已开始执行（批次 ${res.id}），可在「APP回归」页看进度`)
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    batchStarting.value = false
  }
}

function onNavUserCommand(cmd: string) {
  if (cmd === 'logout') logout()
}

onMounted(load)
</script>

<style scoped>
.app-auto-cases {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f0f2f5;
}

.page-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  background: linear-gradient(90deg, #0f2744 0%, #1a365d 100%);
  color: #fff;
  flex-shrink: 0;
}
.nav-title {
  font-size: 16px;
  font-weight: 600;
}
.nav-sub {
  margin-left: 12px;
  font-size: 12px;
  opacity: 0.75;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.nav-actions {
  display: flex;
  gap: 8px;
}
.btn-nav {
  padding: 6px 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn-nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}
.btn-nav:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-nav-primary {
  background: #2563eb;
  border-color: #2563eb;
}
.btn-nav-primary:hover:not(:disabled) {
  background: #1d4ed8;
}
.nav-user {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-user-name {
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #e8ecf0;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.f-search {
  width: 200px;
}
.env-tabs {
  display: flex;
  gap: 4px;
  margin-right: 8px;
}
.env-tab {
  padding: 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #606266;
}
.env-tab.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8ecf0;
  flex-shrink: 0;
}
.path-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.path-meta {
  font-size: 12px;
  color: #909399;
}
.proxy-alert {
  margin-left: auto;
  max-width: 520px;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  position: relative;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: #c0c4cc;
}

.exec-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.exec-name {
  font-size: 15px;
  font-weight: 600;
}
.exec-ctx {
  font-size: 12px;
  color: #909399;
}
.exec-field-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: #606266;
}
.exec-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #e6a23c;
}
</style>
