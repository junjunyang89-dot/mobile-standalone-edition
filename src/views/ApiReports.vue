<template>
  <div class="reports-page">
    <!-- 设计稿：深蓝顶栏 -->
    <header class="rp-topbar">
      <h1 class="rp-topbar-title">执行报告</h1>
      <div v-if="user" class="rp-topbar-user">
        <span class="rp-role-badge">{{ user.roleLabel }}</span>
        <el-dropdown trigger="click" @command="onUserCommand">
          <span class="rp-user-trigger">
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
    </header>

    <div class="rp-main" v-loading="loading">
      <!-- KPI + 左右分栏：同一白色容器 -->
      <div class="page-shell">
        <section class="kpi-bar">
          <div class="kpi-cards">
            <div class="kpi-card">
              <div class="kpi-icon is-green"><el-icon><CircleCheck /></el-icon></div>
              <div class="kpi-body">
                <div class="kpi-label">通过率（{{ days }}天）</div>
                <div class="kpi-value is-green">{{ summary.total ? summary.rate + '%' : '—' }}</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon is-blue"><el-icon><Clock /></el-icon></div>
              <div class="kpi-body">
                <div class="kpi-label">执行次数</div>
                <div class="kpi-value is-blue">{{ summary.runs }}</div>
                <div class="kpi-sub">
                  <span class="ok">{{ summary.passed }} 通过</span>
                  <span class="bad">{{ summary.failed }} 失败</span>
                </div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon is-orange"><el-icon><TrendCharts /></el-icon></div>
              <div class="kpi-body">
                <div class="kpi-label">平均耗时</div>
                <div class="kpi-value is-orange">{{ avgDuration }}</div>
                <div class="kpi-sub muted">每次执行</div>
              </div>
            </div>
          </div>
          <el-select v-model="days" class="kpi-filter" @change="loadTrend">
            <el-option :value="7" label="近7天" />
            <el-option :value="30" label="近30天" />
            <el-option :value="90" label="近90天" />
          </el-select>
        </section>

        <div class="page-split">
          <aside class="nav-panel">
            <div class="scope-tabs">
              <button type="button" class="scope-tab" :class="{ active: scope === 'TEST' }" @click="scope = 'TEST'">
                测试环境
              </button>
              <button type="button" class="scope-tab" :class="{ active: scope === 'LIVE' }" @click="scope = 'LIVE'">
                生产环境
              </button>
            </div>
            <div class="nav-tree-wrap">
              <el-tree
                v-if="treeData.length"
                ref="treeRef"
                :data="treeData"
                node-key="nodeKey"
                :props="treeProps"
            highlight-current
            :expand-on-click-node="false"
            class="report-tree"
                @node-click="onTreeClick"
              >
                <template #default="{ data }">
                  <span class="tree-row" :class="{ 'is-leaf': !data.isFolder, 'is-active': selectedNodeKey === data.nodeKey }">
                    <span v-if="!data.isFolder" class="tree-dot" />
                    <el-icon v-if="data.isFolder" class="tree-folder"><Folder /></el-icon>
                    <span class="tree-text" :title="data.label">{{ data.label }}</span>
                    <span
                      v-if="(!data.isFolder && data.meta != null) || (data.isFolder && Number(data.meta) > 0)"
                      class="tree-badge"
                    >{{ data.meta }}</span>
                  </span>
                </template>
              </el-tree>
              <div v-else-if="!loading" class="nav-empty">暂无用例集合</div>
            </div>
          </aside>

          <main class="detail-panel">
            <template v-if="selectedInterface">
              <div class="detail-head">
                <div class="head-main">
                  <h2 class="iface-title">{{ selectedPathDisplay }}</h2>
                  <div class="head-tags">
                    <span class="tag tag-method">{{ selectedInterface.method || 'GET' }}</span>
                    <span class="tag tag-env">{{ scope === 'TEST' ? '测试环境' : '生产环境' }}</span>
                    <span class="tag tag-proj">{{ selectedInterface.project }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-batch-del"
                  :disabled="!selectedRunIds.length || batchDeleting"
                  @click="batchDelete"
                >
                  {{ batchDeleting ? '删除中…' : '批量删除' }}
                </button>
              </div>

              <div class="run-table-wrap">
                <table class="run-table">
                  <thead>
                    <tr>
                      <th class="col-check">
                        <el-checkbox
                          :model-value="allVisibleSelected"
                          :indeterminate="someVisibleSelected && !allVisibleSelected"
                          @change="toggleSelectAll"
                        />
                      </th>
                      <th class="col-report">报告</th>
                      <th class="col-time">时间</th>
                      <th class="col-result">结果</th>
                      <th class="col-rate">通过率</th>
                      <th class="col-dur">耗时</th>
                      <th class="col-ops">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!visibleRuns.length">
                      <td colspan="7" class="empty-tip">该接口下还没有执行记录</td>
                    </tr>
                    <tr v-for="row in visibleRuns" :key="row.id">
                      <td class="col-check">
                        <el-checkbox
                          :model-value="selectedRunIds.includes(row.id)"
                          @change="(v: boolean) => toggleRun(row.id, v)"
                        />
                      </td>
                      <td class="col-report">
                        <div class="report-title">{{ runReportLabel(row) }}</div>
                        <div class="report-sub">{{ runReportSub(row) }}</div>
                      </td>
                      <td class="col-time">{{ fmt(row.createdAt) }}</td>
                      <td class="col-result">
                        <span class="result-cell" :class="row.failed ? 'is-fail' : 'is-ok'">
                          <el-icon><CircleCheck v-if="!row.failed" /><Close v-else /></el-icon>
                          {{ row.passed }}/{{ row.total }}
                        </span>
                      </td>
                      <td class="col-rate">
                        <div class="rate-cell">
                          <div class="rate-bar">
                            <div
                              class="rate-fill"
                              :class="rateClass(ifacePct(row))"
                              :style="{ width: ifacePct(row) + '%' }"
                            />
                          </div>
                          <span class="rate-pct">{{ ifacePct(row) }}%</span>
                        </div>
                      </td>
                      <td class="col-dur">{{ dur(row.durationMs) }}</td>
                      <td class="col-ops">
                        <button type="button" class="op-view" @click="openRun(row)">查看</button>
                        <button type="button" class="op-del" @click="deleteOne(row)">删除</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

            <div v-else class="panel-empty">
              在左侧选中一个接口，查看该接口的执行报告
            </div>
          </main>
        </div>
      </div>
    </div>

    <el-drawer
      v-model="drawer"
      size="720px"
      :show-close="false"
      destroy-on-close
      class="report-drawer"
    >
      <template #header>
        <div class="rp-header">
          <div class="rp-header-main">
            <h2 class="rp-title">报告详情</h2>
            <p v-if="detail?.run" class="rp-meta">
              <span>{{ fmt(detail.run.createdAt) }}</span>
              <span class="rp-meta-dot">·</span>
              <span>{{ detail.run.environment || 'TEST' }}</span>
              <span class="rp-meta-dot">·</span>
              <span class="rp-meta-pass">通过 {{ detail.run.passed }}/{{ detail.run.total }}</span>
              <span class="rp-meta-dot">·</span>
              <span>{{ dur(detail.run.durationMs) }}</span>
            </p>
          </div>
          <button type="button" class="rp-close" aria-label="关闭" @click="drawer = false">✕</button>
        </div>
      </template>

      <div v-loading="detailLoading" class="rp-body">
        <div v-for="c in detail?.cases || []" :key="c.id" class="rp-case">
          <div class="rp-status-bar" :class="c.status === 'PASSED' ? 'is-pass' : 'is-fail'">
            <span class="rp-pill rp-pill-status">{{ c.status === 'PASSED' ? '通过' : '失败' }}</span>
            <span class="rp-pill rp-pill-method">{{ (c.method || 'GET').toUpperCase() }}</span>
            <span class="rp-case-title">{{ caseIfaceTitle(c) }}</span>
            <span class="rp-spacer" />
            <span v-if="c.httpStatus" class="rp-http" :class="c.status === 'PASSED' ? 'is-ok' : 'is-bad'">
              HTTP {{ c.httpStatus }}
            </span>
            <span class="rp-duration">{{ c.durationMs }}ms</span>
          </div>

          <div v-if="c.url" class="rp-url-box">
            <el-icon class="rp-url-icon"><Link /></el-icon>
            <a class="rp-url-text" :href="c.url" target="_blank" rel="noopener noreferrer">{{ c.url }}</a>
            <button type="button" class="rp-copy-btn" @click="copyText(c.url)">复制</button>
          </div>

          <div v-if="c.error" class="rp-error">{{ c.error }}</div>

          <div v-if="parseAssertions(c).length" class="rp-asserts">
            <div
              v-for="(a, idx) in parseAssertions(c)"
              :key="c.id + '-a-' + idx"
              class="rp-assert-row"
            >
              <span class="rp-assert-icon" :class="a.ok ? 'is-ok' : 'is-fail'">
                {{ a.ok ? '✓' : '✕' }}
              </span>
              <span class="rp-assert-expr">{{ a.expr }}</span>
              <template v-if="a.actual">
                <span class="rp-assert-sep">|</span>
                <span class="rp-assert-label">Actual:</span>
                <span class="rp-assert-val" :class="a.ok ? 'is-ok' : 'is-fail'">{{ a.actual }}</span>
              </template>
            </div>
          </div>

          <div v-if="hasCaseDetail(c)" class="rp-detail">
            <button type="button" class="rp-detail-toggle" @click="toggleCaseDetail(c.id)">
              <span class="rp-detail-arrow" :class="{ open: isCaseDetailOpen(c.id) }">▾</span>
              请求 / 响应明细
            </button>

            <div v-if="isCaseDetailOpen(c.id)" class="rp-detail-body">
              <div v-if="headerEntries(c.reqHeaders).length" class="rp-block">
                <div class="rp-block-title">请求头</div>
                <div class="rp-kv-list">
                  <div v-for="row in headerEntries(c.reqHeaders)" :key="row.key" class="rp-kv-line">
                    <span class="rp-k">{{ row.key }}</span><span class="rp-kv-sep">:</span>
                    <span class="rp-v">{{ maskHeaderValue(row.key, row.value) }}</span>
                  </div>
                </div>
              </div>

              <div v-if="c.reqBody" class="rp-block">
                <div class="rp-block-title">请求体</div>
                <pre class="rp-json-pre">{{ pretty(c.reqBody) }}</pre>
              </div>

              <div v-if="headerEntries(c.respHeaders).length" class="rp-block">
                <div class="rp-block-head-row">
                  <div class="rp-block-title">响应头</div>
                  <button
                    type="button"
                    class="rp-expand-link"
                    @click="toggleRespHeaders(c.id)"
                  >
                    {{ isRespHeadersOpen(c.id) ? '收起' : '展开' }}
                  </button>
                </div>
                <div class="rp-kv-list">
                  <div
                    v-for="row in visibleRespHeaders(c)"
                    :key="'resp-' + row.key"
                    class="rp-kv-line"
                  >
                    <span class="rp-k">{{ row.key }}</span><span class="rp-kv-sep">:</span>
                    <span class="rp-v">{{ row.value }}</span>
                  </div>
                </div>
              </div>

              <div v-if="c.bodyPreview" class="rp-block">
                <div class="rp-block-title">响应体</div>
                <pre class="rp-json-pre" v-html="highlightJson(pretty(c.bodyPreview))" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, CircleCheck, Clock, Close, Folder, Link, TrendCharts } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import { logout, user } from '../stores/auth'

type RunRow = {
  id: string
  environment: string
  collectionId?: string | null
  collectionName?: string | null
  collectionProject?: string | null
  requirementNo?: string | null
  sourceBranch?: string | null
  total: number
  passed: number
  failed: number
  durationMs: number
  createdAt: string
  interfaces: Array<{ project: string; method: string; path: string }>
}

type TreeNode = {
  nodeKey: string
  label: string
  isFolder: boolean
  kind?:
    | 'category'
    | 'project'
    | 'req-group'
    | 'branch-group'
    | 'collection'
    | 'controller'
    | 'interface'
    | 'endpoint'
  project?: string
  method?: string
  path?: string
  meta?: number
  children?: TreeNode[]
}

const APP_ALIASES: Record<string, string> = {
  'data-center': 'app-data-center',
  'data-agent': 'app-data-agent',
  'data-provider': 'app-data-provider',
  'esports-api': 'app-esports-api',
  'global-agent': 'app-global-agent',
  'global-data': 'app-global-data',
  'app_esports_api': 'app-esports-api'
}

function canonicalProjectKey(code: string): string {
  const lower = String(code || '').trim().toLowerCase()
  if (!lower) return ''
  if (APP_ALIASES[lower]) return APP_ALIASES[lower]
  if (lower.startsWith('app-')) return lower
  if (lower.startsWith('app_')) return ('app-' + lower.slice(4)).replace(/_/g, '-')
  return lower
}

function projectsMatch(a: string, b: string): boolean {
  const ca = canonicalProjectKey(a)
  const cb = canonicalProjectKey(b)
  return (!!ca && ca === cb) || String(a || '').trim() === String(b || '').trim()
}


function categoryTreeLabel(cat: { key?: string; label?: string }) {
  if (cat.key === 'APP') return 'APP'
  if (cat.key === 'PVP') return 'PWA'
  if (cat.key === 'WEB') return 'WEB'
  return cat.label || cat.key || ''
}

function interfaceTreeLabel(path?: string) {
  const p = String(path || '').trim()
  return p || '—'
}

function onUserCommand(cmd: string) {
  if (cmd === 'logout') {
    logout()
    router.replace('/login')
  }
}

const route = useRoute()
const router = useRouter()
const allRuns = ref<RunRow[]>([])
const collectionCategories = ref<any[]>([])
const trendRows = ref<any[]>([])
const days = ref(7)
const loading = ref(false)
const scope = ref<'TEST' | 'LIVE'>('TEST')
const selectedNodeKey = ref('')
const selectedRunIds = ref<string[]>([])
const batchDeleting = ref(false)
const treeRef = ref<any>(null)

const drawer = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)
const caseDetailOpen = ref<Record<string, boolean>>({})
const respHeadersOpen = ref<Record<string, boolean>>({})

const treeProps = { children: 'children', label: 'label' }

function runScope(run: RunRow): 'TEST' | 'LIVE' {
  return String(run.environment || '').toUpperCase() === 'PROD' ? 'LIVE' : 'TEST'
}

function sourceKeyOf(run: RunRow): string {
  const req = String(run.requirementNo || '').trim()
  if (req) return `req:${req}`
  const br = String(run.sourceBranch || '').trim()
  if (br) return `br:${br}`
  return ''
}

/** 左侧树只展示 path，不带 query */
function pathBase(raw?: string): string {
  const p = String(raw || '').trim()
  const q = p.indexOf('?')
  return q >= 0 ? p.slice(0, q) : p
}

function ifaceKey(method: string, path: string) {
  return `${String(method || '').toUpperCase()}:${pathBase(path)}`
}

function treeIfaceLabel(method: string, path: string): string {
  return pathBase(path) || String(path || '').trim() || '(未知路径)'
}


function runReportLabel(row: RunRow) {
  if (row.collectionName) return row.collectionName
  const sk = sourceKeyOf(row)
  if (sk.startsWith('req:')) return sk.slice(4)
  if (sk.startsWith('br:')) return `分支 ${sk.slice(3)}`
  return '单次执行'
}

function runReportSub(row: RunRow): string {
  const mode = row.collectionName ? '集合执行' : '手动执行'
  return `${mode}，${row.total} 个用例`
}

function runMatchesInterface(run: RunRow, project: string, method: string, path: string) {
  const pk = ifaceKey(method, path)
  return (run.interfaces || []).some(
    (it) => projectsMatch(it.project, project) && ifaceKey(it.method, it.path) === pk
  )
}

function scopedRuns() {
  return allRuns.value.filter((r) => runScope(r) === scope.value)
}

const runCountByIface = computed(() => {
  const m = new Map<string, number>()
  for (const run of scopedRuns()) {
    for (const it of run.interfaces || []) {
      const k = `${canonicalProjectKey(it.project)}:${ifaceKey(it.method, it.path)}`
      m.set(k, (m.get(k) || 0) + 1)
    }
  }
  return m
})

function runCountFor(project: string, method: string, path: string): number {
  const k = `${canonicalProjectKey(project)}:${ifaceKey(method, pathBase(path))}`
  return runCountByIface.value.get(k) || 0
}

function interfaceNodesFromCol(col: any, projectCode: string, parentNodeKey: string): TreeNode[] {
  return (col.interfaces || [])
    .map((item: any) => {
      const path = pathBase(item.path)
      if (!path) return null
      const method = String(item.method || 'GET').toUpperCase()
      return {
        nodeKey: `if:${parentNodeKey}:${ifaceKey(method, path)}`,
        label: interfaceTreeLabel(path),
        kind: 'interface' as const,
        isFolder: false,
        method,
        path,
        project: projectCode,
        meta: runCountFor(projectCode, method, path)
      }
    })
    .filter(Boolean) as TreeNode[]
}

function bubbleUpMeta(node: TreeNode): number {
  if (node.kind === 'interface' || node.kind === 'endpoint') {
    node.meta = node.meta ?? 0
    return Number(node.meta)
  }
  const sum = (node.children || []).reduce((s, c) => s + bubbleUpMeta(c), 0)
  node.meta = sum
  return sum
}

/** 与 ApiCollections 相同的用例集合树，接口节点 meta 为执行报告数 */
function buildCollectionTree(categories: any[]): TreeNode[] {
  let root: TreeNode[] = []

  if (scope.value === 'LIVE') {
    root = (categories || []).map((cat) => ({
      nodeKey: `cat:${cat.key}`,
      label: categoryTreeLabel(cat),
      kind: 'category' as const,
      isFolder: true,
      meta: 0,
      children: (cat.projects || []).flatMap((proj: any) => {
        const projectNode: TreeNode = {
          nodeKey: `proj:${cat.key}:${proj.code}`,
          label: proj.code || proj.label,
          kind: 'project',
          isFolder: true,
          project: proj.code,
          meta: 0,
          children: (proj.controllers || []).map((ctrl: any) => ({
            nodeKey: `ctrl:${proj.code}:${ctrl.label}`,
            label: ctrl.label,
            kind: 'controller' as const,
            isFolder: true,
            project: proj.code,
            meta: 0,
            children: (ctrl.previews || []).map((p: any) => {
              const path = pathBase(p.path)
              const method = String(p.method || 'GET').toUpperCase()
              return {
                nodeKey: `ep:${proj.code}:${ctrl.label}:${ifaceKey(method, path)}`,
                label: interfaceTreeLabel(path),
                kind: 'endpoint' as const,
                isFolder: false,
                method,
                path,
                project: proj.code,
                meta: runCountFor(proj.code, method, path)
              }
            })
          }))
        }
        return [projectNode]
      })
    }))
  } else {
    root = (categories || []).map((cat) => ({
      nodeKey: `cat:${cat.key}`,
      label: categoryTreeLabel(cat),
      kind: 'category' as const,
      isFolder: true,
      meta: 0,
      children: (cat.projects || []).map((proj: any) => ({
        nodeKey: `proj:${cat.key}:${proj.code}`,
        label: proj.code || proj.label,
        kind: 'project' as const,
        isFolder: true,
        project: proj.code,
        meta: 0,
        children: (proj.groups || []).flatMap((g: any) => {
          const groupNode: TreeNode = {
            nodeKey: g.key || `grp:${proj.code}:${g.label}`,
            label: g.label,
            kind: (g.kind || 'req-group') as TreeNode['kind'],
            isFolder: true,
            project: proj.code,
            meta: 0,
            children: (g.collections || []).map((col: any) => {
              const nodeKey = col.id
                ? `col:${col.id}`
                : `leaf:${proj.code}:${col.requirementNo || col.sourceBranch || col.label}`
              return {
                nodeKey,
                label: col.label || col.requirementNo || col.sourceBranch || col.name,
                kind: 'collection' as const,
                isFolder: true,
                project: proj.code,
                meta: 0,
                children: interfaceNodesFromCol(col, proj.code, nodeKey)
              }
            })
          }
          return [groupNode]
        })
      }))
    }))
  }

  for (const n of root) bubbleUpMeta(n)
  return root
}

function findInterfaceNodeKey(
  nodes: TreeNode[],
  project: string,
  method: string,
  path: string
): string | null {
  const pk = ifaceKey(method, path)
  for (const n of nodes) {
    if ((n.kind === 'interface' || n.kind === 'endpoint') && n.path) {
      if (projectsMatch(n.project || '', project) && ifaceKey(n.method || 'GET', n.path) === pk) {
        return n.nodeKey
      }
    }
    if (n.children?.length) {
      const hit = findInterfaceNodeKey(n.children, project, method, path)
      if (hit) return hit
    }
  }
  return null
}

const treeData = computed(() => buildCollectionTree(collectionCategories.value))

const selectedInterface = computed(() => {
  if (!selectedNodeKey.value) return null
  const find = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.nodeKey === selectedNodeKey.value && (n.kind === 'interface' || n.kind === 'endpoint')) return n
      if (n.children?.length) {
        const hit = find(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  const node = find(treeData.value)
  if (!node?.project || !node.path) return null
  return { project: node.project, method: node.method || 'GET', path: node.path }
})

const selectedPathDisplay = computed(() => {
  const sel = selectedInterface.value
  if (!sel) return ''
  return treeIfaceLabel(sel.method || 'GET', sel.path || '')
})

const visibleRuns = computed(() => {
  const sel = selectedInterface.value
  if (!sel) return []
  return scopedRuns()
    .filter((run) => runMatchesInterface(run, sel.project, sel.method, sel.path))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
})

const allVisibleSelected = computed(
  () => visibleRuns.value.length > 0 && visibleRuns.value.every((r) => selectedRunIds.value.includes(r.id))
)
const someVisibleSelected = computed(() => visibleRuns.value.some((r) => selectedRunIds.value.includes(r.id)))

const summary = computed(() => {
  let runsN = 0
  let total = 0
  let passed = 0
  let failed = 0
  for (const r of trendRows.value) {
    runsN += Number(r.runs || 0)
    total += Number(r.total || 0)
    passed += Number(r.passed || 0)
    failed += Number(r.failed || 0)
  }
  return { runs: runsN, total, passed, failed, rate: total ? Math.round((passed * 100) / total) : 0 }
})

const avgDuration = computed(() => {
  const list = scopedRuns()
  if (!list.length) return '—'
  const ms = list.reduce((n, r) => n + Number(r.durationMs || 0), 0) / list.length
  return dur(ms)
})

function ifacePct(row: RunRow) {
  return pct(row)
}

function pct(row: any) {
  const t = Number(row.total || 0)
  return t ? Math.round((Number(row.passed || 0) * 100) / t) : 0
}

function rateClass(rate: number) {
  if (rate >= 95) return 'good'
  if (rate >= 80) return 'warn'
  return 'bad'
}

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function dur(ms: number) {
  const n = Number(ms || 0)
  if (n < 1000) return Math.round(n) + 'ms'
  if (n < 60000) return (n / 1000).toFixed(1) + 's'
  return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's'
}

function kv(h?: string | Record<string, string>) {
  if (!h) return ''
  const o = typeof h === 'string' ? safeParse(h) : h
  if (!o) return typeof h === 'string' ? h : ''
  return Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function safeParse(raw: string): Record<string, string> | null {
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

function assertLines(raw?: string | string[]) {
  if (!raw) return []
  return Array.isArray(raw) ? raw : raw.split('\n').filter(Boolean)
}

type ParsedAssert = { ok: boolean; expr: string; actual: string }

function parseAssertions(c: any): ParsedAssert[] {
  return assertLines(c?.assertionResults)
    .filter((line) => !line.startsWith('WARN'))
    .map((line) => {
      const ok = line.startsWith('OK')
      const body = line.replace(/^(OK|FAIL)\s+/, '').trim()
      const idx = body.indexOf(' 实际=')
      if (idx >= 0) {
        return {
          ok,
          expr: formatAssertExpr(body.slice(0, idx).trim()),
          actual: body.slice(idx + 4).trim()
        }
      }
      if (body.includes('exists=')) {
        const m = body.match(/^jsonPath\s+(\S+)\s+exists=(true|false)$/i)
        if (m) {
          return { ok, expr: `jsonPath ${m[1]} exists`, actual: m[2] }
        }
      }
      return { ok, expr: formatAssertExpr(body), actual: '' }
    })
}

function formatAssertExpr(raw: string): string {
  return raw
    .replace(/==/g, ' == ')
    .replace(/!=/g, ' != ')
    .replace(/\s+/g, ' ')
    .trim()
}

function caseIfaceTitle(c: any): string {
  const method = String(c?.method || 'GET').toUpperCase()
  const path = pathBase(String(c?.path || c?.url || ''))
  const parts = path.split('/').filter(Boolean)
  const short = parts.length >= 2 ? parts.slice(-2).join('/') : parts.join('/') || path
  return `${method} ${short}`
}

function headerEntries(raw?: string | Record<string, string>): Array<{ key: string; value: string }> {
  const o = typeof raw === 'string' ? safeParse(raw) : raw
  if (!o) return []
  return Object.entries(o).map(([key, value]) => ({ key, value: String(value ?? '') }))
}

const SENSITIVE_HEADERS = ['token', 'authorization', 'cookie', 'x-api-key', 'x-auth-token']

function maskHeaderValue(key: string, value: string): string {
  const k = key.toLowerCase()
  if (!SENSITIVE_HEADERS.some((h) => k.includes(h))) return value
  const v = String(value || '').trim()
  if (!v) return v
  if (v.length <= 12) return '*** (已遮掩)'
  return `${v.slice(0, 8)}...${v.slice(-4)} (已遮掩)`
}

function hasCaseDetail(c: any): boolean {
  return !!(c?.reqHeaders || c?.reqBody || c?.respHeaders || c?.bodyPreview)
}

function isCaseDetailOpen(id?: string) {
  return !!id && caseDetailOpen.value[id] !== false
}

function toggleCaseDetail(id?: string) {
  if (!id) return
  caseDetailOpen.value[id] = !isCaseDetailOpen(id)
}

function isRespHeadersOpen(id?: string) {
  return !!id && !!respHeadersOpen.value[id]
}

function toggleRespHeaders(id?: string) {
  if (!id) return
  respHeadersOpen.value[id] = !isRespHeadersOpen(id)
}

function visibleRespHeaders(c: any) {
  const rows = headerEntries(c.respHeaders)
  if (isRespHeadersOpen(c.id)) return rows
  return rows.slice(0, 5)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightJson(raw: string): string {
  const text = escapeHtml(raw)
  return text.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
    (match, str, colon) => {
      if (colon) return `<span class="jk">${str}</span>${colon}`
      if (str) return `<span class="js">${str}</span>`
      if (match === 'true' || match === 'false' || match === 'null') return `<span class="jb">${match}</span>`
      return `<span class="jn">${match}</span>`
    }
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function pretty(raw?: string) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function onTreeClick(data: TreeNode) {
  if (data.kind === 'interface' || data.kind === 'endpoint') {
    selectedNodeKey.value = data.nodeKey
    selectedRunIds.value = []
  }
}

function toggleRun(id: string, checked?: boolean) {
  const on = typeof checked === 'boolean' ? checked : !selectedRunIds.value.includes(id)
  if (on) {
    if (!selectedRunIds.value.includes(id)) selectedRunIds.value = [...selectedRunIds.value, id]
  } else {
    selectedRunIds.value = selectedRunIds.value.filter((x) => x !== id)
  }
}

function toggleSelectAll(v: boolean) {
  selectedRunIds.value = v ? visibleRuns.value.map((r) => r.id) : []
}

watch(scope, async () => {
  selectedNodeKey.value = ''
  selectedRunIds.value = []
  await loadCollectionTree()
})

async function loadCollectionTree() {
  try {
    const res = await apiClient.getApiTestCollectionTree({ scope: scope.value })
    collectionCategories.value = res.categories || []
  } catch {
    collectionCategories.value = []
  }
}

function nodeExists(nodes: TreeNode[], key: string): boolean {
  for (const n of nodes) {
    if (n.nodeKey === key) return true
    if (n.children?.length && nodeExists(n.children, key)) return true
  }
  return false
}

watch(treeData, async () => {
  await nextTick()
  if (selectedNodeKey.value && !nodeExists(treeData.value, selectedNodeKey.value)) {
    selectedNodeKey.value = ''
  }
})

async function load() {
  loading.value = true
  try {
    const [, runs] = await Promise.all([
      loadCollectionTree(),
      apiClient.browseApiTestRuns(300) as Promise<RunRow[]>
    ])
    allRuns.value = runs
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadTrend() {
  try {
    trendRows.value = await apiClient.getApiTestTrend(days.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载趋势失败')
  }
}

async function openRun(row: any) {
  drawer.value = true
  detailLoading.value = true
  detail.value = null
  caseDetailOpen.value = {}
  respHeadersOpen.value = {}
  try {
    detail.value = await apiClient.getApiTestRunDetail(row.id)
    for (const c of detail.value?.cases || []) {
      if (c?.id) caseDetailOpen.value[c.id] = true
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function deleteOne(row: RunRow) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确定删除这份报告？', '删除报告', { type: 'warning' })
    await apiClient.deleteApiTestRun(row.id)
    ElMessage.success('已删除')
    selectedRunIds.value = selectedRunIds.value.filter((id) => id !== row.id)
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!selectedRunIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedRunIds.value.length} 份报告？`, '批量删除', {
      type: 'warning'
    })
    batchDeleting.value = true
    const r = await apiClient.deleteApiTestRuns(selectedRunIds.value)
    ElMessage.success(`已删除 ${r.deleted} 份`)
    selectedRunIds.value = []
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  } finally {
    batchDeleting.value = false
  }
}

onMounted(async () => {
  await Promise.all([load(), loadTrend()])
  const runId = String(route.query.runId || '')
  if (runId) {
    const run = allRuns.value.find((r) => r.id === runId)
    if (run) {
      scope.value = runScope(run)
      const it = run.interfaces?.[0]
      if (it) {
        const key = findInterfaceNodeKey(treeData.value, it.project, it.method, it.path)
        if (key) {
          selectedNodeKey.value = key
          await nextTick()
          treeRef.value?.setCurrentKey?.(selectedNodeKey.value)
        }
      }
      openRun(run)
    } else {
      openRun({ id: runId })
    }
  }
})
</script>

<style scoped>
.reports-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-sizing: border-box;
  background: #fff;
}

.rp-topbar {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #2b3648;
}

.rp-topbar-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.rp-topbar-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rp-role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  color: #fff;
  background: #e85d6a;
}

.rp-user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  outline: none;
}

.rp-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  box-sizing: border-box;
}

.page-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: none;
  border-radius: 0;
  overflow: hidden;
}

.kpi-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  min-height: 56px;
}

.kpi-cards {
  display: flex;
  flex: 1;
  gap: 36px;
  flex-wrap: wrap;
  align-items: center;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.kpi-icon.is-green { background: #f0faf0; color: #3cb371; }
.kpi-icon.is-blue { background: #eef5ff; color: #4a90e2; }
.kpi-icon.is-orange { background: #fff8ef; color: #f5a623; }

.kpi-label {
  font-size: 12px;
  color: #999;
  line-height: 1.3;
}

.kpi-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.kpi-value.is-green { color: #3cb371; }
.kpi-value.is-blue { color: #4a90e2; }
.kpi-value.is-orange { color: #f5a623; }

.kpi-sub {
  margin-top: 1px;
  font-size: 11px;
  display: flex;
  gap: 6px;
  line-height: 1.3;
}

.kpi-sub.muted { color: #999; }

.kpi-filter {
  width: 96px;
  flex-shrink: 0;
}

.kpi-filter :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  border-radius: 4px;
  background: #fff;
  min-height: 28px;
}

.kpi-filter :deep(.el-input__inner) {
  font-size: 12px;
}

.page-split {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.nav-panel {
  width: 272px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0f0f0;
  min-height: 0;
  background: #fff;
}

.scope-tabs {
  display: flex;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
  flex-shrink: 0;
}

.scope-tab {
  border: none;
  background: transparent;
  padding: 14px 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
}

.scope-tab.active {
  color: #4a90e2;
  font-weight: 500;
}

.scope-tab.active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 2px;
  background: #4a90e2;
}

.nav-tree-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 0 12px;
}

.report-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
  margin: 0 8px;
}

.report-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eef5ff;
}

.report-tree :deep(.el-tree-node.is-current > .el-tree-node__content .tree-text) {
  color: #4a90e2;
}

.nav-empty,
.panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: #bbb;
  font-size: 14px;
}

.detail-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 24px 28px;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.head-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.iface-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
  word-break: break-all;
}

.head-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-block;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  line-height: 20px;
}

.tag-method {
  border: 1px solid #b7eb8f;
  color: #52a832;
  background: #f6ffed;
}

.tag-env {
  border: 1px solid #91caff;
  color: #4a90e2;
  background: #eef5ff;
}

.tag-proj {
  border: 1px solid #b7eb8f;
  color: #52a832;
  background: #f6ffed;
}

.btn-batch-del {
  flex-shrink: 0;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #666;
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-batch-del:hover:not(:disabled) {
  border-color: #c0c4cc;
  color: #333;
}

.btn-batch-del:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
}

.tree-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #bfbfbf;
  flex-shrink: 0;
}

.tree-row.is-active .tree-dot {
  background: #4a90e2;
}

.tree-row.is-active .tree-text {
  color: #4a90e2;
}

.tree-folder {
  flex-shrink: 0;
  color: #f5a623;
  font-size: 15px;
}

.tree-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #262626;
}

.tree-badge {
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
}

.run-table-wrap {
  flex: 1;
  min-height: 0;
}

.run-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.run-table thead {
  background: #fafafa;
}

.run-table th {
  padding: 11px 12px;
  text-align: left;
  font-weight: 500;
  color: #999;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
  font-size: 13px;
}

.run-table td {
  padding: 14px;
  border-bottom: 1px solid #f5f5f5;
  vertical-align: middle;
  color: #262626;
}

.run-table tbody tr:last-child td {
  border-bottom: none;
}

.col-check { width: 44px; }
.col-time { width: 150px; white-space: nowrap; }
.col-result { width: 100px; }
.col-rate { width: 100px; }
.col-dur { width: 80px; white-space: nowrap; }
.col-ops { width: 110px; white-space: nowrap; }

.report-title {
  font-weight: 600;
  color: #262626;
}

.report-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #8c8c8c;
}

.result-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.result-cell.is-ok { color: #3cb371; }
.result-cell.is-fail { color: #e85d6a; }

.rate-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.rate-bar {
  width: 60px;
  flex: none;
  height: 6px;
  border-radius: 3px;
  background: #f0f0f0;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  border-radius: 4px;
}

.rate-fill.good { background: #3cb371; }
.rate-fill.warn { background: #f5a623; }
.rate-fill.bad { background: #e85d6a; }

.rate-pct {
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
  min-width: 32px;
}

.op-view,
.op-del {
  border: none;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}

.op-view { color: #4a90e2; }
.op-view:hover { color: #357abd; }
.op-del { color: #e85d6a; margin-left: 10px; }
.op-del:hover { color: #c0392b; }

.ok { color: #3cb371; }
.bad { color: #e85d6a; }

.empty-tip {
  padding: 32px;
  text-align: center;
  color: #8c8c8c;
}

.report-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #eef0f3;
}

.report-drawer :deep(.el-drawer__body) {
  padding: 0;
  background: #f7f8fa;
}

.rp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.rp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.rp-meta {
  margin: 8px 0 0;
  font-size: 13px;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rp-meta-dot {
  color: #cbd5e1;
}

.rp-meta-pass {
  color: #16a34a;
  font-weight: 600;
}

.rp-close {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}

.rp-close:hover {
  color: #4b5563;
}

.rp-body {
  padding: 16px 20px 24px;
}

.rp-case {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.rp-case + .rp-case {
  margin-top: 16px;
}

.rp-status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef0f3;
  flex-wrap: wrap;
}

.rp-status-bar.is-pass {
  background: linear-gradient(180deg, #f6fffb 0%, #fff 100%);
}

.rp-status-bar.is-fail {
  background: linear-gradient(180deg, #fff5f5 0%, #fff 100%);
}

.rp-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 6px 10px;
}

.rp-pill-status {
  background: #dcfce7;
  color: #15803d;
}

.rp-status-bar.is-fail .rp-pill-status {
  background: #fee2e2;
  color: #b91c1c;
}

.rp-pill-method {
  background: #ecfdf5;
  color: #047857;
  font-weight: 700;
}

.rp-case-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.rp-spacer {
  flex: 1;
  min-width: 8px;
}

.rp-http {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
}

.rp-http.is-ok { color: #16a34a; }
.rp-http.is-bad { color: #dc2626; }

.rp-duration {
  font-size: 13px;
  color: #6b7280;
}

.rp-url-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 14px 16px 0;
  padding: 12px 14px;
  background: #f3f4f6;
  border-radius: 8px;
}

.rp-url-icon {
  color: #6b7280;
  margin-top: 2px;
  flex-shrink: 0;
}

.rp-url-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #374151;
  word-break: break-all;
  text-decoration: none;
}

.rp-url-text:hover {
  color: #2563eb;
}

.rp-copy-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.rp-copy-btn:hover {
  color: #1d4ed8;
}

.rp-error {
  margin: 12px 16px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.5;
}

.rp-asserts {
  margin: 14px 16px 0;
  padding-top: 2px;
}

.rp-assert-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
}

.rp-assert-row:last-child {
  border-bottom: none;
}

.rp-assert-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.rp-assert-icon.is-ok {
  background: #dcfce7;
  color: #16a34a;
}

.rp-assert-icon.is-fail {
  background: #fee2e2;
  color: #dc2626;
}

.rp-assert-expr {
  color: #374151;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.rp-assert-sep {
  color: #cbd5e1;
}

.rp-assert-label {
  color: #9ca3af;
}

.rp-assert-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
}

.rp-assert-val.is-ok { color: #16a34a; }
.rp-assert-val.is-fail { color: #dc2626; }

.rp-detail {
  border-top: 1px solid #eef0f3;
  margin-top: 12px;
}

.rp-detail-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: #fff;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  text-align: left;
}

.rp-detail-arrow {
  color: #6b7280;
  transition: transform 0.15s ease;
}

.rp-detail-arrow.open {
  transform: rotate(0deg);
}

.rp-detail-arrow:not(.open) {
  transform: rotate(-90deg);
}

.rp-detail-body {
  padding: 0 16px 16px;
}

.rp-block + .rp-block {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.rp-block-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.rp-block-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 10px;
}

.rp-block-head-row .rp-block-title {
  margin-bottom: 0;
}

.rp-expand-link {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.rp-kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rp-kv-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.7;
  word-break: break-all;
}

.rp-k {
  color: #2563eb;
}

.rp-kv-sep {
  color: #6b7280;
}

.rp-v {
  color: #374151;
}

.rp-json-pre {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  max-height: 48vh;
}

.rp-json-pre :deep(.jk) { color: #2563eb; }
.rp-json-pre :deep(.js) { color: #16a34a; }
.rp-json-pre :deep(.jn) { color: #ea580c; }
.rp-json-pre :deep(.jb) { color: #7c3aed; }

</style>
