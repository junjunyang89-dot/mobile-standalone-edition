<template>
  <div class="app-auto-cases">
    <header class="page-nav">
      <div class="nav-left">
        <span class="nav-title">自动化用例</span>
        <span class="nav-sub">按 环境 · 产品 · 端查看，同一条流程两边都能跑</span>
      </div>
      <div class="nav-right">
        <el-button :disabled="!selectedRows.length" @click="openBatch">批量执行</el-button>
        <el-button type="primary" @click="goFlows">去编排</el-button>
        <div v-if="user" class="nav-user">
          <el-tag size="small" :type="roleTagType">{{ user.roleLabel }}</el-tag>
          <el-dropdown trigger="click" @command="onNavUserCommand">
            <span class="nav-user-name">
              <el-icon><User /></el-icon>
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

    <div class="filter-panel">
      <div class="filter-row">
        <span class="filter-label">环境</span>
        <div class="seg">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: environment === 'TEST' }"
            @click="switchEnv('TEST')"
          >
            测试环境
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: environment === 'PROD' }"
            @click="switchEnv('PROD')"
          >
            生产环境
          </button>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">产品</span>
        <div class="seg">
          <button
            v-for="p in PRODUCTS"
            :key="p.value"
            type="button"
            class="seg-btn"
            :class="{ active: product === p.value }"
            @click="switchProduct(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">平台</span>
        <div class="seg">
          <button
            v-for="p in platformTabs"
            :key="p.value"
            type="button"
            class="seg-btn"
            :class="['is-' + p.value.toLowerCase(), { active: platform === p.value }]"
            @click="switchPlatform(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="filter-search">
          <el-input
            v-model="keyword"
            class="f-search"
            size="small"
            clearable
            placeholder="搜索流程名称..."
            @keyup.enter="load"
          />
          <el-button type="primary" size="small" :loading="loading" @click="load">查询</el-button>
          <span class="flow-count">共 {{ rows.length }} 条流程</span>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="path-left">
        <span class="path-seg">{{ envLabel }}</span>
        <span class="path-dot">·</span>
        <span class="path-seg">{{ productLabel }}</span>
        <span class="path-dot">·</span>
        <span class="path-seg" :class="'is-' + platform.toLowerCase()">{{ platformLabel }}</span>
        <span class="path-count">{{ rows.length }}条</span>
      </div>
      <div class="stat-pills">
        <span class="stat-pill">总数 <em class="is-total">{{ stats.total }}</em></span>
        <span class="stat-pill">已绑 <em class="is-bound">{{ stats.bound }}</em></span>
        <span class="stat-pill">未跑 <em class="is-idle">{{ stats.idle }}</em></span>
        <span class="stat-pill">失败 <em class="is-fail">{{ stats.failed }}</em></span>
      </div>
    </div>
    <el-alert
      v-if="product === 'POGPOG'"
      type="warning"
      :closable="false"
      show-icon
      class="proxy-alert"
      title="海外 PogPog：开跑时会走海外代理，请确认执行端 VPN 就绪。"
    />

    <div class="table-wrap" v-loading="loading">
      <el-table
        :data="rows"
        height="100%"
        class="case-table"
        :header-cell-style="{ background: '#fafafa', color: '#909399', fontWeight: 500 }"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="name" label="名称" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-text">{{ row.name }}</span>
              <el-tag v-if="row.enabled === false" size="small" type="info">停用</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="覆盖用例" width="110" align="center">
          <template #default="{ row }">
            <span v-if="row.caseCount == null" class="pill pill-muted">…</span>
            <span v-else-if="row.caseCount === 0" class="pill pill-muted">未挂</span>
            <span v-else class="pill pill-ok">{{ row.caseCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="步骤" width="80" align="center">
          <template #default="{ row }">{{ stepCount(row) }}</template>
        </el-table-column>
        <el-table-column label="用途" width="120" align="center">
          <template #default="{ row }">
            <span class="pill" :class="catalogPillClass(row.catalog)">{{ catalogLabel(row.catalog) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.lastRunStatus" size="small" :type="runTagType(row.lastRunStatus)">
              {{ runLabel(row.lastRunStatus) }}
            </el-tag>
            <span v-else class="result-idle">未跑</span>
          </template>
        </el-table-column>
        <el-table-column label="更新" width="120">
          <template #default="{ row }">{{ fmtDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="success" size="small" @click="openExecute(row)">执行</el-button>
            <el-button link type="primary" size="small" @click="openFlowEditor(row)">编排</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !rows.length" :description="emptyHint" />
    </div>

    <el-dialog
      v-model="execVisible"
      width="560px"
      destroy-on-close
      align-center
      class="auto-exec-dialog"
      :show-close="false"
    >
      <template #header>
        <div class="exec-dlg-header">
          <div class="exec-dlg-title">执行流程</div>
          <button type="button" class="exec-dlg-close" aria-label="关闭" @click="execVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>

      <div v-if="execRow" v-loading="execLoading" class="exec-body">
        <div class="exec-flow-card">
          <div class="exec-flow-title-row">
            <span class="exec-flow-name">{{ execRow.name }}</span>
            <span class="exec-plat-pill" :class="'plat-' + platform.toLowerCase()">{{ platformLabel }}</span>
          </div>
          <div class="exec-flow-meta">{{ envLabel }} • {{ productLabel }}</div>
          <div class="exec-flow-stats">
            <span class="exec-stat">
              <el-icon><Operation /></el-icon>
              步骤 <b>{{ stepCount(execRow) }} 步</b>
            </span>
            <span class="exec-stat">
              <el-icon><Clock /></el-icon>
              上次 <b :class="'run-' + lastRunTone(execRow.lastRunStatus)">{{ execRow.lastRunStatus ? runLabel(execRow.lastRunStatus) : '未跑' }}</b>
            </span>
            <span class="exec-stat">
              <el-icon><CircleCheck /></el-icon>
              覆盖用例 <b>{{ execRow.caseCount == null ? '—' : execRow.caseCount + ' 条' }}</b>
            </span>
          </div>
        </div>

        <div class="exec-field">
          <div class="exec-dev-head">
            <div class="exec-field-label">选择执行设备</div>
            <el-button link type="primary" class="exec-refresh-btn" :loading="execRefreshing" @click="refreshExecDevices">
              <el-icon v-if="!execRefreshing"><Refresh /></el-icon>
              刷新设备
            </el-button>
          </div>
          <div v-if="!execDevices.length" class="exec-hint">当前没有在线设备，点「刷新设备」扫描，或先到设备管理连接</div>
          <div v-else class="exec-dev-list">
            <button
              v-for="d in execDevices"
              :key="d.id"
              type="button"
              class="exec-dev-card"
              :class="[execDeviceKind(d), { selected: execDeviceId === d.id }]"
              :disabled="execDeviceKind(d) === 'offline'"
              @click="selectExecDevice(d)"
            >
              <span class="exec-dev-radio" :class="{ on: execDeviceId === d.id }" />
              <span class="exec-dev-icon"><el-icon><Iphone /></el-icon></span>
              <span class="exec-dev-main">
                <span class="exec-dev-name">{{ execDeviceTitle(d) }}</span>
                <span class="exec-dev-sub">{{ execDeviceSub(d) }}</span>
              </span>
              <span class="exec-dev-status" :class="execDeviceKind(d)">
                <i />{{ execDeviceStatusText(d) }}
              </span>
            </button>
          </div>
        </div>

        <div class="exec-opt-card">
          <div class="exec-opt-row">
            <div>
              <div class="exec-opt-title">立即执行</div>
              <div class="exec-opt-sub">开启后创建任务并马上开始跑；关闭则只创建待执行任务</div>
            </div>
            <el-switch v-model="execRunNow" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="exec-dlg-footer">
          <div class="exec-picked">
            <template v-if="selectedExecDevice">已选: {{ execDeviceTitle(selectedExecDevice) }}</template>
            <template v-else>尚未选择设备</template>
          </div>
          <div class="exec-dlg-actions">
            <el-button @click="execVisible = false">取消</el-button>
            <el-button type="primary" :loading="executing" @click="submitExecute">
              <el-icon v-if="!executing" class="el-icon--left"><VideoPlay /></el-icon>
              开始执行
            </el-button>
          </div>
        </div>
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

    <ProdExecuteConfirm
      v-model="prodDlg"
      :flow-name="prodMeta.flowName"
      :device-name="prodMeta.deviceName"
      @confirm="onProdConfirmed"
      @cancel="onProdCancelled"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, CircleCheck, Clock, Close, Iphone, Operation, Refresh, User, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import ProdExecuteConfirm from '@/components/ProdExecuteConfirm.vue'
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
const execRunNow = ref(true)
const execLoading = ref(false)
const execRefreshing = ref(false)
const execDevices = ref<any[]>([])
const executing = ref(false)
const selectedExecDevice = computed(() =>
  execDevices.value.find((d) => d.id === execDeviceId.value) || null
)

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

const envLabel = computed(() => (environment.value === 'TEST' ? '测试环境' : '生产环境'))
const productLabel = computed(() => (product.value === 'ESPORTS' ? '完美电竞' : 'POGPOG'))
const platformLabel = computed(() =>
  platform.value === 'HARMONYOS' ? 'HarmonyOS' : platform.value === 'IOS' ? 'iOS' : 'ANDROID'
)
const pathLabel = computed(() => `${envLabel.value} · ${productLabel.value} · ${platformLabel.value}`)

const roleTagType = computed(() => {
  const r = user.value?.role
  if (user.value?.bootstrapping) return 'info'
  if (r === 'ADMIN') return 'danger'
  if (r === 'TESTER') return 'warning'
  return 'info'
})

const stats = computed(() => {
  const list = rows.value
  return {
    total: list.length,
    bound: list.filter((r) => Number(r.caseCount) > 0).length,
    idle: list.filter((r) => !r.lastRunStatus).length,
    failed: list.filter((r) => String(r.lastRunStatus || '').toUpperCase() === 'FAILED').length
  }
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

function catalogPillClass(c: string) {
  if (c === 'AUTOMATION') return 'pill-auto'
  if (c === 'SHARED') return 'pill-shared'
  if (c === 'ONLINE') return 'pill-online'
  return 'pill-muted'
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

function lastRunTone(status?: string | null) {
  const u = String(status || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return 'pass'
  if (u === 'FAILED') return 'fail'
  if (u === 'RUNNING' || u === 'PENDING') return 'warn'
  return 'idle'
}

function execDeviceTitle(d: any) {
  return String(d?.id || d?.name || '—')
}

function execDeviceSub(d: any) {
  const plat =
    String(d?.platform || '').toUpperCase().includes('IOS')
      ? 'iOS'
      : String(d?.platform || '').toUpperCase().includes('HARMONY')
        ? 'HarmonyOS'
        : 'Android'
  const ver = String(d?.version || '').replace(/^(android|ios|harmonyos)\s*/i, '').trim()
  const model = d?.name && d.name !== d.id ? String(d.name) : ''
  const os = plat + (ver ? ' ' + ver : '')
  return [model, os].filter(Boolean).join(' • ') || '—'
}

function execDeviceKind(d: any): 'idle' | 'busy' | 'offline' {
  if (String(d?.status || '').toUpperCase() !== 'CONNECTED') return 'offline'
  if (d?.locked) return 'busy'
  return 'idle'
}

function execDeviceStatusText(d: any) {
  const k = execDeviceKind(d)
  if (k === 'idle') return '空闲'
  if (k === 'busy') return '执行中'
  return '离线'
}

function selectExecDevice(d: any) {
  if (execDeviceKind(d) === 'offline') return
  execDeviceId.value = d.id
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

const prodDlg = ref(false)
const prodMeta = ref({ flowName: '', deviceName: '' })
let prodResolve: ((ok: boolean) => void) | null = null

function execDeviceModel(d: any) {
  const name = String(d?.name || '').trim()
  const id = String(d?.id || '').trim()
  if (name && name !== id) return name
  return name || id || '—'
}

function confirmProd(meta: { flowName?: string; deviceName?: string }) {
  if (environment.value !== 'PROD') return Promise.resolve(true)
  prodMeta.value = { flowName: meta.flowName || '—', deviceName: meta.deviceName || '—' }
  prodDlg.value = true
  return new Promise<boolean>((resolve) => {
    prodResolve = resolve
  })
}

function onProdConfirmed() {
  prodResolve?.(true)
  prodResolve = null
}

function onProdCancelled() {
  prodResolve?.(false)
  prodResolve = null
}

async function loadExecDevices() {
  try {
    const all = await apiClient.getDevices()
    const rowsAll = Array.isArray(all) ? all : []
    const seen = new Set<string>()
    const list = rowsAll.filter((d: any) => {
      const id = d?.id
      if (!id || seen.has(id)) return false
      if (String(d.status || '').toUpperCase() !== 'CONNECTED') return false
      if (!deviceMatchesPlatform(d)) return false
      seen.add(id)
      return true
    })
    const lockPairs = await Promise.all(
      list
        .filter((d: any) => String(d.status || '').toUpperCase() === 'CONNECTED')
        .map((d: any) =>
          apiClient
            .getDeviceLock(d.id)
            .then((r) => [d.id, !!r?.locked] as const)
            .catch(() => [d.id, false] as const)
        )
    )
    const lockedIds = new Set(lockPairs.filter(([, locked]) => locked).map(([id]) => id))
    execDevices.value = list.map((d: any) => ({ ...d, locked: lockedIds.has(d.id) }))
    const stillOk = execDevices.value.some(
      (d) => d.id === execDeviceId.value && execDeviceKind(d) !== 'offline'
    )
    if (!stillOk) {
      execDeviceId.value = execDevices.value.find((d) => execDeviceKind(d) === 'idle')?.id || ''
    }
  } catch {
    execDevices.value = []
  }
}

async function refreshExecDevices() {
  execRefreshing.value = true
  try {
    await apiClient.scanDevices()
  } catch {
    /* 扫描失败仍拉现有列表 */
  }
  try {
    await loadExecDevices()
    if (!execDevices.value.some((d) => execDeviceKind(d) === 'idle')) {
      ElMessage.warning('当前没有空闲且匹配该端的设备')
    }
  } finally {
    execRefreshing.value = false
  }
}

async function openExecute(row: any) {
  execRow.value = row
  execDeviceId.value = ''
  execRunNow.value = true
  execDevices.value = []
  execVisible.value = true
  execLoading.value = true
  try {
    await loadExecDevices()
  } finally {
    execLoading.value = false
  }
}

async function submitExecute() {
  if (!execRow.value?.id) return
  if (!execDeviceId.value) {
    ElMessage.warning('请选择设备')
    return
  }
  const picked = selectedExecDevice.value
  if (picked && execDeviceKind(picked) === 'busy') {
    ElMessage.warning('这台设备正在执行中，请换一台空闲设备')
    return
  }
  if (picked && execDeviceKind(picked) === 'offline') {
    ElMessage.warning('这台设备已离线，请换一台或先刷新设备')
    return
  }
  if (
    !(await confirmProd({
      flowName: execRow.value.name,
      deviceName: execDeviceModel(picked)
    }))
  )
    return
  executing.value = true
  try {
    const res = await apiClient.executeUiFlow(execRow.value.id, {
      deviceId: execDeviceId.value,
      platform: execRow.value.platform || platform.value,
      appId: execRow.value.appId || currentAppId.value,
      environment: environment.value,
      runNow: execRunNow.value
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
  if (
    !(await confirmProd({
      flowName:
        selectedRows.value.length === 1
          ? selectedRows.value[0].name
          : `${selectedRows.value.length} 条用例`,
      deviceName:
        batchDeviceIds.value.length === 1
          ? execDeviceModel(deviceOptions.value.find((d) => d.id === batchDeviceIds.value[0]))
          : `${batchDeviceIds.value.length} 台设备`
    }))
  )
    return
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
  background: #fff;
}

.page-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #eef0f3;
  color: #1f2329;
  flex-shrink: 0;
}
.nav-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.nav-title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2329;
  white-space: nowrap;
}
.nav-sub {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.nav-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
}
.nav-user-name {
  color: #1f2329;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  outline: none;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px 8px;
  background: #fff;
  flex-shrink: 0;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}
.filter-label {
  width: 36px;
  flex: none;
  font-size: 13px;
  color: #909399;
}
.seg {
  display: flex;
  gap: 8px;
}
.seg-btn {
  padding: 5px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 16px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #606266;
}
.seg-btn:hover {
  border-color: #409eff;
  color: #409eff;
}
.seg-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.seg-btn.is-android.active {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
}
.seg-btn.is-ios.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.seg-btn.is-harmonyos.active {
  background: #e6a23c;
  border-color: #e6a23c;
  color: #fff;
}
.filter-search {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.f-search {
  width: 220px;
}
.flow-count {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 24px 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}
.path-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.path-seg {
  color: #409eff;
}
.path-seg.is-android {
  color: #67c23a;
}
.path-seg.is-ios {
  color: #409eff;
}
.path-seg.is-harmonyos {
  color: #e6a23c;
}
.path-dot {
  color: #c0c4cc;
  font-weight: 400;
}
.path-count {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #f4f4f5;
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}
.stat-pills {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 18px;
}
.stat-pill {
  font-size: 12px;
  color: #909399;
}
.stat-pill em {
  margin-left: 4px;
  font-style: normal;
  font-weight: 700;
  font-size: 14px;
}
.stat-pill .is-total {
  color: #409eff;
}
.stat-pill .is-bound {
  color: #67c23a;
}
.stat-pill .is-idle {
  color: #909399;
}
.stat-pill .is-fail {
  color: #f56c6c;
}
.proxy-alert {
  margin: 0 24px 8px;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  padding: 0 12px 8px;
  position: relative;
}
.case-table {
  --el-table-border-color: #f0f2f5;
  --el-table-header-bg-color: #fafafa;
  --el-table-row-hover-bg-color: #f5f9ff;
}
.table-wrap :deep(.el-table__inner-wrapper::before) {
  display: none;
}
.table-wrap :deep(.el-table th.el-table__cell),
.table-wrap :deep(.el-table td.el-table__cell) {
  border-right: none;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name-text {
  font-weight: 600;
  color: #1f2329;
}
.pill {
  display: inline-block;
  min-width: 28px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 20px;
}
.pill-muted {
  background: #f4f4f5;
  color: #909399;
}
.pill-ok {
  background: #f0f9eb;
  color: #67c23a;
}
.pill-auto {
  background: #ecf5ff;
  color: #409eff;
}
.pill-shared {
  background: #f4f4f5;
  color: #606266;
}
.pill-online {
  background: #f0f9eb;
  color: #67c23a;
}
.result-idle {
  color: #c0c4cc;
}

.exec-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.exec-flow-card {
  padding: 14px 16px 12px;
  border-radius: 10px;
  background: #f5f7fa;
}
.exec-flow-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.exec-flow-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f2329;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exec-plat-pill {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  background: #e8f8ee;
  color: #237804;
}
.exec-plat-pill.plat-ios {
  background: #fff7e6;
  color: #d48806;
}
.exec-plat-pill.plat-harmonyos {
  background: #ecf5ff;
  color: #1677ff;
}
.exec-flow-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.exec-flow-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}
.exec-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.exec-stat .el-icon {
  font-size: 14px;
  color: #909399;
}
.exec-stat b {
  font-weight: 600;
  color: #303133;
}
.exec-stat b.run-pass { color: #52c41a; }
.exec-stat b.run-fail { color: #f5222d; }
.exec-stat b.run-warn { color: #fa8c16; }
.exec-stat b.run-idle { color: #909399; font-weight: 500; }
.exec-field-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.exec-dev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.exec-refresh-btn {
  padding: 0;
  height: auto;
  font-size: 13px;
}
.exec-dev-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}
.exec-dev-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  color: #303133;
}
.exec-dev-card:hover:not(:disabled) {
  border-color: #b3d8ff;
}
.exec-dev-card.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.exec-dev-card.offline {
  opacity: 0.55;
  cursor: not-allowed;
  background: #fafafa;
}
.exec-dev-radio {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  border: 1.5px solid #c0c4cc;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}
.exec-dev-radio.on {
  border-color: #409eff;
  box-shadow: inset 0 0 0 4px #409eff;
}
.exec-dev-icon {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f0f9eb;
  color: #67c23a;
  font-size: 16px;
}
.exec-dev-card.offline .exec-dev-icon {
  background: #f5f7fa;
  color: #c0c4cc;
}
.exec-dev-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.exec-dev-name {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
}
.exec-dev-sub {
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exec-dev-status {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
}
.exec-dev-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.exec-dev-status.idle { color: #52c41a; }
.exec-dev-status.busy { color: #fa8c16; }
.exec-dev-status.offline { color: #c0c4cc; }
.exec-opt-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.exec-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}
.exec-opt-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.exec-opt-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.exec-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #e6a23c;
}
.exec-dlg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.exec-picked {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}
.exec-dlg-actions {
  display: flex;
  gap: 8px;
}
</style>

<style>
.auto-exec-dialog.el-dialog {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
}
.auto-exec-dialog .el-dialog__header {
  margin: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid #ebeef5;
}
.auto-exec-dialog .el-dialog__body {
  padding: 18px 20px;
  max-height: min(70vh, 640px);
  overflow-y: auto;
}
.auto-exec-dialog .el-dialog__footer {
  padding: 14px 20px 18px;
  border-top: 1px solid #ebeef5;
}
.auto-exec-dialog .exec-dlg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.auto-exec-dialog .exec-dlg-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.auto-exec-dialog .exec-dlg-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f0f2f5;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.auto-exec-dialog .exec-dlg-close:hover {
  background: #e4e7ed;
  color: #606266;
}
</style>
