<template>
  <div class="reports-page" v-loading="loading">
    <!-- 顶栏：环境 + 时间 + 刷新/导出 -->
    <header class="rp-toolbar">
      <div class="env-seg">
        <button
          v-for="s in SCOPES"
          :key="s.key"
          type="button"
          class="env-seg-btn"
          :class="{ active: scope === s.key }"
          @click="scope = s.key"
        >
          <span class="env-dot" :class="s.dot" />
          {{ s.label }}
          <span class="env-count">{{ scopeCount(s.key) }}</span>
        </button>
      </div>
      <span class="tb-label">时间</span>
      <div class="range-pills">
        <button
          v-for="r in RANGES"
          :key="r.days"
          type="button"
          class="range-pill"
          :class="{ active: days === r.days }"
          @click="days = r.days"
        >{{ r.label }}</button>
      </div>
      <span class="tb-spacer" />
      <button type="button" class="tb-btn" :disabled="loading" @click="load">
        <el-icon><Refresh /></el-icon>刷新
      </button>
      <button type="button" class="tb-btn" @click="exportCsv">
        <el-icon><Download /></el-icon>导出
      </button>
    </header>

    <!-- KPI -->
    <section class="kpi-row">
      <div class="kpi">
        <span class="kpi-ico is-green"><el-icon><Check /></el-icon></span>
        <div>
          <div class="kpi-val is-green">
            <template v-if="kpi.total">{{ kpi.passed }}<span class="kpi-of"> / {{ kpi.total }}</span></template>
            <template v-else>—</template>
          </div>
          <div class="kpi-label">用例通过</div>
          <div
            class="kpi-sub"
            title="分支用例挂了是这次改动有问题，回归用例挂了是回归了。两类混在一个分母里算出的百分比看不出该找谁，后端按用例类型拆开统计后再显示通过率"
          >{{ rangeLabel }} · 跑到的用例 · 暂不算百分比</div>
        </div>
      </div>
      <div class="kpi">
        <span class="kpi-ico is-blue"><el-icon><RefreshRight /></el-icon></span>
        <div>
          <div class="kpi-val">{{ kpi.runs }}</div>
          <div class="kpi-label">执行次数</div>
          <div class="kpi-sub">
            {{ kpi.okRuns }} 通过 · {{ kpi.badRuns }} 失败<template v-if="kpi.blockedRuns"> · <span class="is-amber">{{ kpi.blockedRuns }} 没跑成</span></template>
          </div>
        </div>
      </div>
      <div class="kpi">
        <span class="kpi-ico is-orange"><el-icon><Timer /></el-icon></span>
        <div>
          <div class="kpi-val is-orange">{{ kpi.runs ? dur(kpi.avgMs) : '—' }}</div>
          <div class="kpi-label">平均耗时</div>
          <div class="kpi-sub">每次执行</div>
        </div>
      </div>
      <div class="kpi">
        <span class="kpi-ico is-red"><el-icon><Close /></el-icon></span>
        <div>
          <div class="kpi-val" :class="{ 'is-red': kpi.badRuns }">{{ kpi.badRuns }}</div>
          <div class="kpi-label">失败批次</div>
          <div class="kpi-sub">
            共 {{ kpi.failedCases }} 条用例失败<template v-if="kpi.blockedCases"> · <span class="is-amber">另有 {{ kpi.blockedCases }} 条没跑成</span></template>
          </div>
        </div>
      </div>
    </section>

    <div class="rp-split">
      <!-- 左：接口树 -->
      <aside class="nav-panel">
        <div class="nav-search">
          <el-input v-model="treeKeyword" placeholder="搜索接口名或路径…" clearable size="small">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div class="nav-filter">
          <el-switch v-model="onlyWithRuns" size="small" />
          <span class="nav-filter-text" @click="onlyWithRuns = !onlyWithRuns">只看有执行的</span>
          <span v-if="onlyWithRuns && hiddenEmptyCount" class="nav-filter-hint">已收起 {{ hiddenEmptyCount }} 个</span>
        </div>
        <div class="nav-tree-wrap">
          <el-tree
            v-if="treeData.length"
            ref="treeRef"
            :data="treeData"
            node-key="nodeKey"
            :props="treeProps"
            :indent="10"
            :expand-on-click-node="true"
            :filter-node-method="filterNode"
            class="report-tree"
            @node-click="onTreeClick"
          >
            <template #default="{ data }">
              <span
                class="tree-row"
                :class="[
                  'k-' + data.kind,
                  { 'is-active': selectedNodeKey === data.nodeKey }
                ]"
                :title="data.path || data.label"
              >
                <template v-if="data.kind === 'category'">
                  <span class="cat-dot" :class="catDotClass(data.label)" />
                  <span class="tree-text">{{ data.label }}</span>
                </template>
                <template v-else-if="data.isFolder">
                  <span class="tree-text">{{ data.label }}</span>
                </template>
                <template v-else>
                  <span class="m-tag" :class="methodClass(data.method)">{{ data.method }}</span>
                  <span class="tree-text leaf-path">
                    <span v-if="pathParts(data.path).prefix" class="leaf-prefix">{{ pathParts(data.path).prefix }}</span>{{ pathParts(data.path).last }}
                  </span>
                  <span v-if="data.last === 'fail'" class="state-dot is-fail" title="最近一次执行这个接口有用例失败" />
                  <span v-else-if="data.last === 'blocked'" class="state-dot is-blocked" title="最近一次执行这个接口没跑成（连不上/超时/登录失败），先看服务" />
                </template>
                <span class="tree-count" :class="{ 'is-zero': !Number(data.meta) }">{{ Number(data.meta) || 0 }}</span>
              </span>
            </template>
          </el-tree>
          <div v-else-if="!loading" class="nav-empty">
            {{ onlyWithRuns && fullTree.length ? `${rangeLabel}这个环境下还没有执行记录` : '暂无用例集合' }}
          </div>
        </div>
      </aside>

      <!-- 右：接口报告 -->
      <main class="detail-panel">
        <template v-if="selectedInterface">
          <div class="d-head">
            <div class="d-crumb">
              <template v-for="(c, i) in breadcrumb" :key="i">
                <span v-if="i" class="crumb-sep">›</span>
                <span>{{ c }}</span>
              </template>
            </div>
            <div class="d-title-row">
              <span class="m-tag m-tag-lg" :class="methodClass(selectedInterface.method)">{{ selectedInterface.method }}</span>
              <h2 class="d-title">{{ selectedInterface.path }}</h2>
              <span class="tb-spacer" />
              <button type="button" class="btn-run" :disabled="runningNow" @click="runNow">
                <el-icon><VideoPlay /></el-icon>{{ runningNow ? '执行中…' : '立即执行' }}
              </button>
            </div>
            <div class="d-tags">
              <span class="d-tag" :class="scope === 'LIVE' ? 'is-prod' : 'is-test'">{{ scope === 'LIVE' ? '生产环境' : '测试环境' }}</span>
              <span class="d-tag is-proj">{{ selectedInterface.project }}</span>
            </div>
          </div>

          <div class="i-stats">
            <div class="i-stat">
              <span class="i-num is-green">{{ ifaceStats.passed }}</span>
              <span class="i-lab">通过次数<br /><em>{{ rangeLabel }}</em></span>
            </div>
            <div class="i-stat">
              <span class="i-num" :class="{ 'is-red': ifaceStats.failed }">{{ ifaceStats.failed }}</span>
              <span class="i-lab">失败次数<br />
                <em v-if="ifaceStats.blocked" class="is-amber">另有 {{ ifaceStats.blocked }} 次没跑成</em>
                <em v-else>{{ ifaceStats.failed ? '需排查' : '无' }}</em>
              </span>
            </div>
            <div class="i-stat">
              <span class="i-num">{{ ifaceRuns.length ? dur(ifaceStats.avgMs) : '—' }}</span>
              <span class="i-lab">平均耗时<br /><em>{{ ifaceRuns.length ? '最长 ' + dur(ifaceStats.maxMs) : '—' }}</em></span>
            </div>
            <div class="i-stat">
              <span class="i-num" :class="httpClass(ifaceStats.lastHttp)">{{ ifaceStats.lastHttp || '—' }}</span>
              <span class="i-lab">最近 HTTP<br /><em>{{ ifaceStats.lastAt ? shortTime(ifaceStats.lastAt) : '—' }}</em></span>
            </div>
          </div>

          <div class="r-filter">
            <el-input v-model="runKeyword" placeholder="搜索批次或时间…" clearable size="small" class="r-search">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <button
              v-for="f in RUN_FILTERS.filter((x) => x.key !== 'BLOCKED' || filterCount('BLOCKED'))"
              :key="f.key"
              type="button"
              class="r-chip"
              :class="{ active: runFilter === f.key }"
              @click="runFilter = f.key"
            >
              {{ f.label }}<span class="r-chip-n">{{ filterCount(f.key) }}</span>
            </button>
            <span class="tb-spacer" />
            <el-checkbox
              :model-value="allVisibleSelected"
              :indeterminate="someVisibleSelected && !allVisibleSelected"
              :disabled="!visibleRuns.length"
              @change="toggleSelectAll"
            >全选</el-checkbox>
            <button
              type="button"
              class="btn-del"
              :disabled="!selectedRunIds.length || batchDeleting"
              @click="batchDelete"
            >{{ batchDeleting ? '删除中…' : '批量删除' }}</button>
          </div>

          <div class="r-table-wrap">
            <table class="r-table">
              <colgroup>
                <col style="width: 40px" />
                <col />
                <col style="width: 84px" />
                <col style="width: 108px" />
                <col style="width: 72px" />
                <col style="width: 128px" />
                <col style="width: 76px" />
                <col style="width: 92px" />
              </colgroup>
              <thead>
                <tr>
                  <th />
                  <th>报告</th>
                  <th>触发</th>
                  <th>时间</th>
                  <th>结果</th>
                  <th>通过 / 跑到</th>
                  <th>耗时</th>
                  <th class="t-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!visibleRuns.length">
                  <td colspan="8" class="empty-tip">
                    {{ ifaceRuns.length ? '没有符合筛选条件的报告' : `${rangeLabel}该接口还没有执行记录` }}
                  </td>
                </tr>
                <template v-for="row in visibleRuns" :key="row.id">
                  <tr
                    class="r-row"
                    :class="['is-' + rowState(row), { 'is-checked': selectedRunIds.includes(row.id), 'has-err': !!errorOf(row) }]"
                  >
                    <td class="t-center">
                      <el-checkbox
                        :model-value="selectedRunIds.includes(row.id)"
                        @change="(v: boolean) => toggleRun(row.id, v)"
                      />
                    </td>
                    <td>
                      <div class="r-title">{{ runReportLabel(row) }}</div>
                      <div class="r-sub">{{ triggerText(row) }}触发 · {{ row.total }} 个用例</div>
                    </td>
                    <td>
                      <span class="trig" :class="row.triggerType === 'SCHEDULE' ? 'is-sched' : 'is-manual'">
                        <el-icon><AlarmClock v-if="row.triggerType === 'SCHEDULE'" /><User v-else /></el-icon>
                        {{ triggerText(row) }}
                      </span>
                    </td>
                    <td>
                      <div class="mono r-time">{{ shortTime(row.createdAt) }}</div>
                      <div class="r-sub">{{ relDay(row.createdAt) }}</div>
                    </td>
                    <td>
                      <span class="res" :class="'is-' + rowState(row)">{{ STATE_TEXT[rowState(row)] }}</span>
                    </td>
                    <td>
                      <div v-if="ranOf(row) > 0" class="rate">
                        <span class="rate-pct mono" :class="Number(row.failed || 0) ? 'bad' : 'good'">
                          {{ row.passed || 0 }} / {{ ranOf(row) }}
                        </span>
                        <span v-if="Number(row.failed || 0)" class="r-sub is-red">{{ row.failed }} 条失败</span>
                      </div>
                      <div v-else class="rate">
                        <span class="rate-pct mono is-none" title="这批用例一条都没跑到断言">—</span>
                      </div>
                      <div v-if="Number(row.blocked || 0) > 0 && ranOf(row) > 0" class="r-sub is-amber">{{ row.blocked }} 条没跑成未计入</div>
                    </td>
                    <td class="mono r-dur">{{ dur(row.durationMs) }}</td>
                    <td class="t-right">
                      <button type="button" class="op op-view" @click="openRun(row)">查看</button>
                      <button type="button" class="op op-del" @click="deleteOne(row)">删除</button>
                    </td>
                  </tr>
                  <tr v-if="errorOf(row)" class="r-err-row" :class="'is-' + rowState(row)">
                    <td />
                    <td colspan="7">
                      <div class="r-err" :title="errorOf(row)">
                        <span class="r-err-ico">!</span>
                        <span v-if="rowState(row) === 'blocked'" class="r-err-kind">没跑成，先看服务：</span>
                        <span class="r-err-text">{{ errorOf(row) }}</span>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <footer class="r-foot">
            <span>共 <b>{{ visibleRuns.length }}</b> 条报告</span>
            <span class="r-foot-sep" />
            <span>已选 <b>{{ selectedRunIds.length }}</b> 条</span>
            <span class="tb-spacer" />
            <span class="r-foot-hint">统计范围：{{ rangeLabel }}</span>
          </footer>
        </template>

        <div v-else class="panel-empty">在左侧选中一个接口，查看该接口的执行报告</div>
      </main>
    </div>

    <ApiRunReportDialog v-model="drawer" :run-id="detailRunId" @changed="onReportChanged" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AlarmClock,
  Check,
  Close,
  Download,
  Refresh,
  RefreshRight,
  Search,
  Timer,
  User,
  VideoPlay
} from '@element-plus/icons-vue'
import { apiClient } from '../api'
import ApiRunReportDialog from '../components/ApiRunReportDialog.vue'
import { guardProdRun, type CaseRef } from '../utils/writeEffect'

type RunIface = {
  project: string
  method: string
  path: string
  caseCount?: number
  failedCount?: number
  blockedCount?: number
  error?: string | null
  httpStatus?: number | null
}

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
  blocked?: number
  durationMs: number
  message?: string
  triggerType?: string | null
  createdBy?: string | null
  createdAt: string
  interfaces: RunIface[]
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
  /** 最近一次执行这个接口的结果，用来画红/橙点 */
  last?: 'pass' | 'fail' | 'blocked'
  children?: TreeNode[]
}

const SCOPES = [
  { key: 'TEST' as const, label: '测试环境', dot: 'is-green' },
  { key: 'LIVE' as const, label: '生产环境', dot: 'is-red' }
]
const RANGES = [
  { days: 1, label: '今天' },
  { days: 7, label: '近 7 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' }
]
const RUN_FILTERS = [
  { key: 'ALL' as const, label: '全部' },
  { key: 'FAIL' as const, label: '有失败' },
  { key: 'BLOCKED' as const, label: '没跑成' },
  { key: 'PASS' as const, label: '全部通过' }
]

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

const route = useRoute()
const allRuns = ref<RunRow[]>([])
const collectionCategories = ref<any[]>([])
const days = ref(Number(localStorage.getItem('apiReports.days')) || 7)
const loading = ref(false)
const scope = ref<'TEST' | 'LIVE'>('TEST')
const selectedNodeKey = ref('')
const selectedRunIds = ref<string[]>([])
const batchDeleting = ref(false)
const treeRef = ref<any>(null)
const treeKeyword = ref('')
const runKeyword = ref('')
const runFilter = ref<'ALL' | 'FAIL' | 'BLOCKED' | 'PASS'>('ALL')
const runningNow = ref(false)

const drawer = ref(false)
const detailRunId = ref('')

const treeProps = { children: 'children', label: 'label' }

watch(days, (v) => localStorage.setItem('apiReports.days', String(v)))

const rangeLabel = computed(() => RANGES.find((r) => r.days === days.value)?.label.replace(/\s/g, '') || `近${days.value}天`)

function parseTime(s?: string): Date | null {
  if (!s) return null
  const d = new Date(String(s).replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

const windowStart = computed(() => {
  const now = new Date()
  if (days.value <= 1) return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return new Date(now.getTime() - days.value * 86400000)
})

function inWindow(run: RunRow) {
  const t = parseTime(run.createdAt)
  return !!t && t >= windowStart.value
}

function runScope(run: RunRow): 'TEST' | 'LIVE' {
  return String(run.environment || '').toUpperCase() === 'PROD' ? 'LIVE' : 'TEST'
}

function scopeCount(s: 'TEST' | 'LIVE') {
  return allRuns.value.filter((r) => runScope(r) === s && inWindow(r)).length
}

/** 当前环境 + 时间范围内的执行，按时间倒序 */
const windowRuns = computed(() =>
  allRuns.value
    .filter((r) => runScope(r) === scope.value && inWindow(r))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
)

type RunState = 'pass' | 'fail' | 'blocked'

/** 有真失败 → 失败；只是没跑成（连不上/超时/登录失败）→ 没跑成。两者不能混：后者该去看服务，不是查用例 */
function stateOf(failed: number, blocked: number): RunState {
  if (failed > 0) return 'fail'
  if (blocked > 0) return 'blocked'
  return 'pass'
}

function runState(r: RunRow): RunState {
  return stateOf(Number(r.failed || 0), Number(r.blocked || 0))
}

const kpi = computed(() => {
  const list = windowRuns.value
  let ran = 0
  let passed = 0
  let failedCases = 0
  let blockedCases = 0
  let ms = 0
  let badRuns = 0
  let blockedRuns = 0
  for (const r of list) {
    ran += Number(r.total || 0) - Number(r.blocked || 0)
    passed += Number(r.passed || 0)
    failedCases += Number(r.failed || 0)
    blockedCases += Number(r.blocked || 0)
    ms += Number(r.durationMs || 0)
    const s = runState(r)
    if (s === 'fail') badRuns++
    else if (s === 'blocked') blockedRuns++
  }
  return {
    runs: list.length,
    total: ran,
    passed,
    okRuns: list.length - badRuns - blockedRuns,
    badRuns,
    blockedRuns,
    failedCases,
    blockedCases,
    avgMs: list.length ? ms / list.length : 0
  }
})

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

/** 树上只显示最后两段：倒数第二段灰色，最后一段正常色；完整路径放 title */
function pathParts(path?: string) {
  const segs = pathBase(path).split('/').filter(Boolean)
  if (!segs.length) return { prefix: '', last: path || '—' }
  const last = segs[segs.length - 1]
  const prefix = segs.length >= 2 ? segs[segs.length - 2] + '/' : ''
  return { prefix, last }
}

function runReportLabel(row: RunRow) {
  if (row.collectionName) return row.collectionName
  const sk = sourceKeyOf(row)
  if (sk.startsWith('req:')) return sk.slice(4)
  if (sk.startsWith('br:')) return `分支 ${sk.slice(3)}`
  return '单次执行'
}

function triggerText(row: RunRow) {
  return row.triggerType === 'SCHEDULE' ? '定时' : '手动'
}

function ifaceOf(run: RunRow, project: string, method: string, path: string): RunIface | undefined {
  const pk = ifaceKey(method, path)
  return (run.interfaces || []).find((it) => projectsMatch(it.project, project) && ifaceKey(it.method, it.path) === pk)
}

function ifaceStateOf(it?: RunIface): RunState {
  return stateOf(Number(it?.failedCount || 0), Number(it?.blockedCount || 0))
}

/** 每个接口在当前范围内：执行次数 + 最近一次的结果 */
const ifaceIndex = computed(() => {
  const m = new Map<string, { count: number; last: RunState }>()
  for (const run of windowRuns.value) {
    for (const it of run.interfaces || []) {
      const k = `${canonicalProjectKey(it.project)}:${ifaceKey(it.method, it.path)}`
      const hit = m.get(k)
      if (hit) hit.count++
      else m.set(k, { count: 1, last: ifaceStateOf(it) })
    }
  }
  return m
})

function ifaceInfo(project: string, method: string, path: string) {
  return ifaceIndex.value.get(`${canonicalProjectKey(project)}:${ifaceKey(method, pathBase(path))}`)
}

function leafNode(nodeKey: string, project: string, rawMethod: string, rawPath: string, kind: 'interface' | 'endpoint'): TreeNode | null {
  const path = pathBase(rawPath)
  if (!path) return null
  const method = String(rawMethod || 'GET').toUpperCase()
  const info = ifaceInfo(project, method, path)
  return {
    nodeKey: `${nodeKey}:${ifaceKey(method, path)}`,
    label: path,
    kind,
    isFolder: false,
    method,
    path,
    project,
    meta: info?.count || 0,
    last: info?.last
  }
}

/** 同一接口多条用例（或 query 不同）会出现多次，树上只留一个叶子，否则 node-key 冲突 */
function uniqLeaves(nodes: Array<TreeNode | null>): TreeNode[] {
  const seen = new Set<string>()
  return nodes.filter((n): n is TreeNode => !!n && !seen.has(n.nodeKey) && !!seen.add(n.nodeKey))
}

function bubbleUpMeta(node: TreeNode): number {
  if (!node.isFolder) return Number(node.meta || 0)
  const sum = (node.children || []).reduce((s, c) => s + bubbleUpMeta(c), 0)
  node.meta = sum
  return sum
}

/** 与 ApiCollections 相同的用例集合树，接口节点 meta 为执行报告数 */
function buildCollectionTree(categories: any[]): TreeNode[] {
  let root: TreeNode[]

  if (scope.value === 'LIVE') {
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
        children: (proj.controllers || []).map((ctrl: any) => ({
          nodeKey: `ctrl:${proj.code}:${ctrl.label}`,
          label: ctrl.label,
          kind: 'controller' as const,
          isFolder: true,
          project: proj.code,
          meta: 0,
          children: uniqLeaves(
            (ctrl.previews || []).map((p: any) =>
              leafNode(`ep:${proj.code}:${ctrl.label}`, proj.code, p.method, p.path, 'endpoint')
            )
          )
        }))
      }))
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
        children: (proj.groups || []).map((g: any) => ({
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
              children: uniqLeaves(
                (col.interfaces || []).map((it: any) =>
                  leafNode(`if:${nodeKey}`, proj.code, it.method, it.path, 'interface')
                )
              )
            }
          })
        }))
      }))
    }))
  }

  for (const n of root) bubbleUpMeta(n)
  return root
}

function findInterfaceNodeKey(nodes: TreeNode[], project: string, method: string, path: string): string | null {
  const pk = ifaceKey(method, path)
  for (const n of nodes) {
    if (!n.isFolder && n.path && projectsMatch(n.project || '', project) && ifaceKey(n.method || 'GET', n.path) === pk) {
      return n.nodeKey
    }
    if (n.children?.length) {
      const hit = findInterfaceNodeKey(n.children, project, method, path)
      if (hit) return hit
    }
  }
  return null
}

const onlyWithRuns = ref(localStorage.getItem('apiReports.onlyWithRuns') !== '0')
watch(onlyWithRuns, (v) => localStorage.setItem('apiReports.onlyWithRuns', v ? '1' : '0'))

const fullTree = computed(() => buildCollectionTree(collectionCategories.value))

/** 去掉 0 次执行的分支。不能依赖选中项：选中一变 data 就重建，el-tree 的展开状态会全丢 */
function pruneEmpty(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  for (const n of nodes) {
    const children = n.children?.length ? pruneEmpty(n.children) : n.children
    if (Number(n.meta) > 0 || children?.length) out.push({ ...n, children })
  }
  return out
}

function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countNodes(n.children || []), 0)
}

const treeData = computed(() => (onlyWithRuns.value ? pruneEmpty(fullTree.value) : fullTree.value))
const hiddenEmptyCount = computed(() =>
  onlyWithRuns.value ? countNodes(fullTree.value) - countNodes(treeData.value) : 0
)

function filterNode(kw: string, data: TreeNode) {
  if (!kw) return true
  const k = kw.toLowerCase()
  return String(data.label || '').toLowerCase().includes(k) || String(data.path || '').toLowerCase().includes(k)
}

watch(treeKeyword, (kw) => treeRef.value?.filter(kw.trim()))

function findPath(nodes: TreeNode[], key: string, trail: TreeNode[] = []): TreeNode[] | null {
  for (const n of nodes) {
    const next = [...trail, n]
    if (n.nodeKey === key) return next
    if (n.children?.length) {
      const hit = findPath(n.children, key, next)
      if (hit) return hit
    }
  }
  return null
}

const selectedTrail = computed(() => (selectedNodeKey.value ? findPath(treeData.value, selectedNodeKey.value) : null))

const selectedInterface = computed(() => {
  const node = selectedTrail.value?.[selectedTrail.value.length - 1]
  if (!node || node.isFolder || !node.project || !node.path) return null
  return { project: node.project, method: node.method || 'GET', path: node.path }
})

const breadcrumb = computed(() => (selectedTrail.value || []).slice(0, -1).map((n) => n.label))

/** 选中接口在当前范围内的执行记录 */
const ifaceRuns = computed(() => {
  const sel = selectedInterface.value
  if (!sel) return []
  return windowRuns.value.filter((run) => !!ifaceOf(run, sel.project, sel.method, sel.path))
})

function selIface(run: RunRow) {
  const sel = selectedInterface.value
  return sel ? ifaceOf(run, sel.project, sel.method, sel.path) : undefined
}

/** 「结果」看的是这个接口在那次执行里的结果；通过率仍是整批的 */
function rowState(run: RunRow): RunState {
  return ifaceStateOf(selIface(run))
}

const STATE_TEXT: Record<RunState, string> = { pass: '通过', fail: '失败', blocked: '没跑成' }

function errorOf(run: RunRow): string {
  if (rowState(run) === 'pass') return ''
  return String(selIface(run)?.error || run.message || '').trim()
}

const ifaceStats = computed(() => {
  const list = ifaceRuns.value
  let failed = 0
  let blocked = 0
  let ms = 0
  let maxMs = 0
  for (const r of list) {
    const s = rowState(r)
    if (s === 'fail') failed++
    else if (s === 'blocked') blocked++
    const d = Number(r.durationMs || 0)
    ms += d
    if (d > maxMs) maxMs = d
  }
  const latest = list[0]
  return {
    passed: list.length - failed - blocked,
    failed,
    blocked,
    avgMs: list.length ? ms / list.length : 0,
    maxMs,
    lastHttp: latest ? Number(selIface(latest)?.httpStatus || 0) : 0,
    lastAt: latest?.createdAt || ''
  }
})

type RunFilter = 'ALL' | 'FAIL' | 'BLOCKED' | 'PASS'

function matchesRunFilter(r: RunRow, f: RunFilter) {
  if (f === 'FAIL') return rowState(r) === 'fail'
  if (f === 'BLOCKED') return rowState(r) === 'blocked'
  if (f === 'PASS') return rowState(r) === 'pass'
  return true
}

function filterCount(f: RunFilter) {
  return ifaceRuns.value.filter((r) => matchesRunFilter(r, f)).length
}

const visibleRuns = computed(() => {
  const kw = runKeyword.value.trim().toLowerCase()
  return ifaceRuns.value.filter((r) => {
    if (!matchesRunFilter(r, runFilter.value)) return false
    if (!kw) return true
    return (
      runReportLabel(r).toLowerCase().includes(kw) ||
      fmt(r.createdAt).includes(kw) ||
      String(r.createdBy || '').toLowerCase().includes(kw)
    )
  })
})

const allVisibleSelected = computed(
  () => visibleRuns.value.length > 0 && visibleRuns.value.every((r) => selectedRunIds.value.includes(r.id))
)
const someVisibleSelected = computed(() => visibleRuns.value.some((r) => selectedRunIds.value.includes(r.id)))

/** 没跑成的不进分母；全部没跑成时返回 null（显示「—」），不是 0% */
/** 分支 / 回归还没拆开统计，只给原始数，不算百分比 */
function ranOf(row: RunRow): number {
  return Math.max(0, Number(row.total || 0) - Number(row.blocked || 0))
}

function httpClass(code: number) {
  if (!code) return ''
  return code >= 200 && code < 400 ? 'is-green' : 'is-red'
}

function methodClass(m?: string) {
  const k = String(m || 'GET').toUpperCase()
  return {
    GET: 'is-get',
    POST: 'is-post',
    PUT: 'is-put',
    PATCH: 'is-patch',
    DELETE: 'is-delete'
  }[k] || 'is-get'
}

function catDotClass(label: string) {
  if (label === 'APP') return 'is-green'
  if (label === 'PWA') return 'is-blue'
  return 'is-orange'
}

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function shortTime(s: string) {
  return fmt(s).slice(5)
}

function relDay(s: string) {
  const t = parseTime(s)
  if (!t) return ''
  const today = new Date()
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const d1 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const diff = Math.round((d0 - d1) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${diff} 天前`
  return fmt(s).slice(0, 10)
}

function dur(ms: number) {
  const n = Number(ms || 0)
  if (n < 1000) return Math.round(n) + 'ms'
  if (n < 60000) return (n / 1000).toFixed(1) + 's'
  return Math.floor(n / 60000) + 'm' + Math.round((n % 60000) / 1000) + 's'
}

function onTreeClick(data: TreeNode) {
  if (!data.isFolder) {
    selectedNodeKey.value = data.nodeKey
    selectedRunIds.value = []
    runKeyword.value = ''
    runFilter.value = 'ALL'
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

watch(treeData, async () => {
  await nextTick()
  if (selectedNodeKey.value && !findPath(treeData.value, selectedNodeKey.value)) {
    selectedNodeKey.value = ''
  }
  if (treeKeyword.value.trim()) treeRef.value?.filter(treeKeyword.value.trim())
  if (selectedNodeKey.value) treeRef.value?.setCurrentKey?.(selectedNodeKey.value)
})

async function load() {
  loading.value = true
  try {
    const [, runs] = await Promise.all([
      loadCollectionTree(),
      apiClient.browseApiTestRuns(500) as Promise<RunRow[]>
    ])
    allRuns.value = runs
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openRun(row: { id: string }) {
  detailRunId.value = row.id
  drawer.value = true
}

async function onReportChanged(runId?: string) {
  await load()
  if (runId) openRun({ id: runId })
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

/** 重跑最近一次执行里覆盖这个接口的那几条用例 */
async function runNow() {
  const sel = selectedInterface.value
  if (!sel) return
  const latest = allRuns.value
    .filter((r) => runScope(r) === scope.value && !!ifaceOf(r, sel.project, sel.method, sel.path))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
  if (!latest) {
    ElMessage.warning('这个接口还没有执行过，去「用例集合」里执行一次后才能在这里重跑')
    return
  }
  runningNow.value = true
  try {
    const detail = await apiClient.getApiTestRunDetail(latest.id)
    const pk = ifaceKey(sel.method, sel.path)
    const refs = new Map<string, CaseRef>()
    for (const c of detail?.cases || []) {
      if (c.caseId && ifaceKey(c.method || 'GET', c.path || '') === pk && !refs.has(c.caseId)) {
        refs.set(c.caseId, {
          id: String(c.caseId),
          name: c.name,
          method: c.method,
          path: c.path,
          project: sel.project,
          durationMs: c.durationMs
        })
      }
    }
    let ids = [...refs.keys()]
    if (!ids.length) {
      ElMessage.warning('最近一次执行里找不到这个接口对应的用例（可能已被删除）')
      return
    }
    let env: 'PROD' | 'TEST' = scope.value === 'LIVE' ? 'PROD' : 'TEST'
    if (env === 'PROD') {
      const g = await guardProdRun([...refs.values()], sel.project)
      if (g.mode === 'cancel') return
      ids = g.ids
      env = g.env
    }
    const r = await apiClient.runApiTest({ caseIds: ids, environment: env, confirmProd: env === 'PROD' })
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await load()
    if (r.runId) openRun({ id: r.runId })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningNow.value = false
  }
}

function csvCell(v: unknown) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv() {
  const list = selectedInterface.value ? visibleRuns.value : windowRuns.value
  if (!list.length) {
    ElMessage.info('当前范围内没有可导出的执行记录')
    return
  }
  const head = ['时间', '环境', '报告', '触发', '执行人', '用例数', '通过', '失败', '没跑成', '耗时']
  const lines = list.map((r) =>
    [
      fmt(r.createdAt),
      r.environment,
      runReportLabel(r),
      triggerText(r),
      r.createdBy || '',
      r.total,
      r.passed,
      Number(r.failed || 0),
      Number(r.blocked || 0),
      dur(r.durationMs)
    ]
      .map(csvCell)
      .join(',')
  )
  const blob = new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const scopeName = scope.value === 'LIVE' ? '生产' : '测试'
  a.download = `执行报告-${scopeName}-${rangeLabel.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function revealNode(key: string) {
  const tree = treeRef.value
  if (!tree) return
  let parent = tree.getNode?.(key)?.parent
  while (parent && parent.level > 0) {
    parent.expanded = true
    parent = parent.parent
  }
  tree.setCurrentKey?.(key)
}

async function focusRun(runId: string) {
  const run = allRuns.value.find((r) => r.id === runId)
  if (run) {
    const target = runScope(run)
    if (scope.value !== target) {
      scope.value = target
      await nextTick()
    }
    if (!inWindow(run)) days.value = 90
    await loadCollectionTree()
    const it = run.interfaces?.[0]
    if (it) {
      const key = findInterfaceNodeKey(treeData.value, it.project, it.method, it.path)
      if (key) {
        selectedNodeKey.value = key
        selectedRunIds.value = []
        await nextTick()
        revealNode(key)
      }
    }
  }
  openRun({ id: runId })
}

onMounted(async () => {
  await load()
  const runId = String(route.query.runId || '')
  if (runId) await focusRun(runId)
})

watch(
  () => String(route.query.runId || ''),
  async (runId, prev) => {
    if (!runId || runId === prev) return
    await load()
    await focusRun(runId)
  }
)
</script>

<style scoped>
.reports-page {
  --line: #eef0f3;
  --muted: #8a919f;
  --text: #1f2329;
  --green: #2f9e44;
  --red: #e03131;
  --orange: #f08c00;
  --amber: var(--el-color-warning-dark-2);
  --blue: #1971c2;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: var(--text);
  font-size: 13px;
}

.mono { font-family: var(--mono); }
.tb-spacer { flex: 1; }

/* ---------- 顶栏 ---------- */
.rp-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
}

.env-seg {
  display: inline-flex;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.env-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 0;
  background: #fff;
  color: var(--app-text-regular);
  font-size: 12px;
  cursor: pointer;
}

.env-seg-btn + .env-seg-btn { border-left: 1px solid var(--el-border-color); }
.env-seg-btn.active { background: var(--el-color-primary-light-9); color: var(--text); font-weight: 600; }

.env-dot { width: 6px; height: 6px; border-radius: 50%; }
.env-dot.is-green { background: var(--green); }
.env-dot.is-red { background: var(--red); }

.env-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--el-fill-color-light);
  color: var(--app-text-regular);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-weight: 500;
}

.env-seg-btn.active .env-count { background: var(--el-color-primary-light-8); color: var(--blue); }

.tb-label { margin-left: 6px; color: var(--muted); font-size: 12px; }

.range-pills { display: inline-flex; gap: 4px; }

.range-pill {
  height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--app-text-regular);
  font-size: 12px;
  cursor: pointer;
}

.range-pill:hover { background: var(--el-fill-color-lighter); }
.range-pill.active { border-color: #c9d6ea; background: var(--el-color-primary-light-9); color: var(--text); font-weight: 600; }

.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.tb-btn:hover:not(:disabled) { border-color: #b8c2d0; }
.tb-btn:disabled { opacity: 0.5; cursor: default; }

/* ---------- KPI ---------- */
.kpi-row {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--line);
}

.kpi {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
}

.kpi + .kpi { border-left: 1px solid var(--line); }

.kpi-ico {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 15px;
}

.kpi-ico.is-green { background: var(--el-color-success-light-9); color: var(--green); }
.kpi-ico.is-blue { background: var(--el-color-primary-light-9); color: var(--blue); }
.kpi-ico.is-orange { background: var(--el-color-warning-light-9); color: var(--orange); }
.kpi-ico.is-red { background: var(--el-color-danger-light-9); color: var(--red); }

.kpi-val { font-size: 20px; font-weight: 700; line-height: 1.15; font-family: var(--mono); }
.kpi-val.is-green { color: var(--green); }
.kpi-val.is-orange { color: var(--orange); }
.kpi-val.is-red { color: var(--red); }
.kpi-label { margin-top: 2px; font-size: 12px; color: var(--app-text-regular); }
.kpi-sub { font-size: 11px; color: var(--muted); }

/* ---------- 分栏 ---------- */
.rp-split { flex: 1; min-height: 0; display: flex; }

.nav-panel {
  width: 328px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  min-height: 0;
}

.nav-search { padding: 10px 10px 6px; }

.nav-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 6px;
  font-size: 12px;
}

.nav-filter-text { color: var(--app-text-regular); cursor: pointer; user-select: none; }
.nav-filter-hint { margin-left: auto; color: var(--el-text-color-disabled); font-size: 11px; }

.nav-tree-wrap { flex: 1; min-height: 0; overflow: auto; padding: 0 4px 12px; }
.nav-empty { padding: 32px 12px; color: var(--muted); text-align: center; font-size: 12px; }

.report-tree { background: transparent; }

.report-tree :deep(.el-tree-node__content) {
  height: 28px;
  border-radius: 4px;
}

.report-tree :deep(.el-tree-node__content:hover) { background: var(--el-fill-color-lighter); }
.report-tree :deep(.el-tree-node.is-current > .el-tree-node__content) { background: transparent; }
.report-tree :deep(.el-tree-node__expand-icon) { color: var(--el-text-color-disabled); padding: 4px; }

.tree-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 6px;
  height: 28px;
  font-size: 12px;
}

.tree-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tree-row.k-category .tree-text { font-weight: 700; font-size: 13px; }
.tree-row.k-controller .tree-text { font-family: var(--mono); color: var(--app-text-regular); }
.tree-row.k-project .tree-text,
.tree-row.k-collection .tree-text { color: var(--app-text-regular); }

.cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.cat-dot.is-green { background: var(--green); }
.cat-dot.is-blue { background: var(--blue); }
.cat-dot.is-orange { background: var(--orange); }

.leaf-path { font-family: var(--mono); color: var(--text); }
.leaf-prefix { color: #a4abb6; }

.tree-row.is-active {
  margin-left: -4px;
  padding-left: 4px;
  background: var(--el-color-primary-light-9);
  box-shadow: inset 2px 0 0 var(--el-color-primary);
  border-radius: 3px;
}

.tree-row.is-active .leaf-path { color: var(--el-color-primary-dark-2); font-weight: 600; }

.state-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.state-dot.is-fail { background: var(--red); }
.state-dot.is-blocked { background: var(--amber); }
.is-amber { color: var(--amber); }

.tree-count {
  min-width: 16px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--app-text-regular);
  text-align: right;
  flex-shrink: 0;
}

.tree-count.is-zero { color: var(--el-text-color-disabled); }

/* 方法标签（树 + 标题共用） */
.m-tag {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 700;
  line-height: 15px;
  letter-spacing: 0.02em;
}

.m-tag-lg { font-size: 11px; line-height: 18px; padding: 0 6px; }
.m-tag.is-get { background: var(--el-color-success-light-9); color: var(--green); }
.m-tag.is-post { background: var(--el-color-primary-light-9); color: var(--blue); }
.m-tag.is-put { background: var(--el-color-warning-light-9); color: var(--orange); }
.m-tag.is-patch { background: #f3f0ff; color: #7048e8; }
.m-tag.is-delete { background: var(--el-color-danger-light-9); color: var(--red); }

/* ---------- 右侧 ---------- */
.detail-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.panel-empty { margin: auto; color: var(--muted); font-size: 13px; }

.d-head { padding: 12px 20px 10px; }

.d-crumb { font-family: var(--mono); font-size: 11px; color: var(--muted); }
.crumb-sep { margin: 0 6px; color: var(--el-text-color-disabled); }

.d-title-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }

.d-title {
  margin: 0;
  min-width: 0;
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-run {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid #c9dafc;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  cursor: pointer;
}

.btn-run:hover:not(:disabled) { background: #e0ebff; }
.btn-run:disabled { opacity: 0.6; cursor: default; }

.d-tags { display: flex; gap: 6px; margin-top: 8px; }

.d-tag {
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 20px;
  border: 1px solid transparent;
}

.d-tag.is-prod { background: var(--el-color-danger-light-9); color: var(--red); border-color: var(--el-color-danger-light-7); }
.d-tag.is-test { background: var(--el-color-success-light-9); color: var(--green); border-color: #c3eccb; }
.d-tag.is-proj { background: var(--el-fill-color-lighter); color: var(--app-text-regular); border-color: #e6e8ec; }

.i-stats {
  margin: 0 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.i-stat { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
.i-stat + .i-stat { border-left: 1px solid var(--line); }
.i-num { font-family: var(--mono); font-size: 18px; font-weight: 700; }
.i-num.is-green { color: var(--green); }
.i-num.is-red { color: var(--red); }
.i-lab { font-size: 11px; color: var(--app-text-regular); line-height: 1.35; }
.i-lab em { font-style: normal; color: var(--muted); }

.r-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 20px 10px;
}

.r-search { width: 200px; margin-right: 4px; }

.r-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  color: var(--app-text-regular);
  font-size: 12px;
  cursor: pointer;
}

.r-chip.active { border-color: #9ec0f7; background: var(--el-color-primary-light-9); color: var(--el-color-primary-dark-2); font-weight: 600; }

.r-chip-n {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-weight: 500;
}

.r-chip.active .r-chip-n { background: var(--el-color-primary-light-8); }

.btn-del {
  margin-left: 8px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid #ffc9c9;
  border-radius: 6px;
  background: #fff;
  color: var(--red);
  font-size: 12px;
  cursor: pointer;
}

.btn-del:disabled { border-color: var(--el-border-color-lighter); color: var(--el-text-color-disabled); cursor: default; }

.r-table-wrap {
  margin: 0 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.r-table { width: 100%; border-collapse: collapse; table-layout: fixed; }

.r-table th {
  height: 34px;
  padding: 0 10px;
  background: var(--el-fill-color-lighter);
  color: var(--app-text-regular);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

.r-table td { padding: 9px 10px; vertical-align: middle; }
.r-row td { border-bottom: 1px solid var(--line); }
.r-row.has-err td { border-bottom: 0; }
.r-row.is-fail { background: var(--el-color-danger-light-9); }
.r-row.is-blocked { background: var(--el-color-warning-light-9); }
.r-row.is-checked.is-pass { background: #f7faff; }
.t-center { text-align: center; }
.t-right { text-align: right; }

.r-title { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-sub { margin-top: 2px; font-size: 11px; color: var(--muted); }
.r-time { font-size: 12px; }
.r-dur { font-size: 12px; color: var(--app-text-regular); }

.trig {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 20px;
  border: 1px solid;
}

.trig.is-manual { background: var(--el-fill-color-lighter); border-color: var(--el-border-color); color: var(--app-text-regular); }
.trig.is-sched { background: var(--el-color-warning-light-9); border-color: #ffd8a8; color: #d9480f; }

.res {
  display: inline-block;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  color: #fff;
}

.res.is-pass { background: var(--green); }
.res.is-fail { background: var(--red); }
.res.is-blocked { background: var(--amber); }
.rate-pct.is-none { color: var(--el-text-color-disabled); }

.rate { display: flex; flex-direction: column; gap: 3px; }
.r-sub.is-red { color: var(--red); }
.kpi-of { font-size: 0.6em; font-weight: 500; color: var(--el-text-color-secondary); }
.rate-pct { font-size: 12px; font-weight: 700; }
.rate-pct.good { color: var(--green); }
.rate-pct.warn { color: var(--orange); }
.rate-pct.bad { color: var(--red); }
.rate-bar { height: 4px; border-radius: 2px; background: var(--el-fill-color-light); overflow: hidden; }
.rate-fill { height: 100%; border-radius: 2px; }
.rate-fill.good { background: var(--green); }
.rate-fill.warn { background: var(--orange); }
.rate-fill.bad { background: var(--red); }

.op {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  cursor: pointer;
}

.op + .op { margin-left: 12px; }
.op-view { color: var(--blue); }
.op-del { color: var(--red); }
.op:hover { text-decoration: underline; }

.r-err-row td { padding: 0 10px 10px; border-bottom: 1px solid var(--line); background: var(--el-color-danger-light-9); }
.r-err-row.is-blocked td { background: var(--el-color-warning-light-9); }
.r-err-row.is-blocked .r-err { border-color: var(--el-color-warning-light-7); }
.r-err-row.is-blocked .r-err-ico { background: var(--amber); }
.r-err-kind { flex-shrink: 0; color: var(--amber); font-weight: 600; }

.r-err {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: var(--app-text-regular);
}

.r-err-ico {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--red);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  flex-shrink: 0;
}

.r-err-text {
  font-family: var(--mono);
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-tip { padding: 36px 0 !important; text-align: center; color: var(--muted); }

.r-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px 16px;
  font-size: 12px;
  color: var(--app-text-regular);
}

.r-foot b { color: var(--text); }
.r-foot-sep { width: 1px; height: 12px; background: #dde1e6; }
.r-foot-hint { color: var(--muted); }
</style>
