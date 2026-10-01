<template>
  <div class="bug-mgmt">
    <header class="page-nav">
      <div class="nav-left">
        <span class="nav-title">Bug 管理</span>
      </div>
      <div class="nav-right">
        <div class="nav-actions">
          <button type="button" class="btn-nav" :disabled="!filteredBugs.length" @click="exportBugs">
            导出
          </button>
          <button type="button" class="btn-nav btn-nav-danger" @click="openCreate">+ 新建 Bug</button>
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
      <el-select v-model="filters.priority" class="f-item" size="small" clearable placeholder="全部优先级">
        <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <el-select v-model="filters.status" class="f-item" size="small" clearable placeholder="全部状态">
        <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-select v-model="filters.assignee" class="f-item" size="small" clearable filterable placeholder="全部负责人">
        <el-option v-for="a in assigneeOptions" :key="a" :label="a" :value="a" />
      </el-select>
      <el-input
        v-model="filters.q"
        class="f-search"
        size="small"
        clearable
        placeholder="搜索 Bug 编号 / 概要"
        @keyup.enter="load"
      />
      <el-button type="primary" size="small" :loading="loading" @click="load">查询</el-button>
      <el-button size="small" @click="resetFilters">重置</el-button>
    </div>

    <div class="body" v-loading="loading">
      <aside class="side-pane">
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
        <div class="side-tree">
          <template v-for="node in treeNodes" :key="node.key">
            <div class="tree-block">
              <button
                type="button"
                class="tree-row"
                :class="{ active: selectedKey === node.key, expanded: expanded[node.key] }"
                @click="onTreeClick(node)"
              >
                <span class="tree-caret">{{ expanded[node.key] ? '▾' : '▸' }}</span>
                <span class="tree-label">{{ node.label }}</span>
                <span class="tree-count">{{ node.count }}</span>
              </button>
              <div v-if="expanded[node.key] && node.children?.length" class="tree-children">
                <template v-for="child in node.children" :key="child.key">
                  <button
                    type="button"
                    class="tree-row is-child"
                    :class="{ active: selectedKey === child.key, expanded: expanded[child.key] }"
                    @click="onTreeClick(child)"
                  >
                    <span class="tree-caret">{{ child.children?.length ? (expanded[child.key] ? '▾' : '▸') : '' }}</span>
                    <span class="tree-label">{{ child.label }}</span>
                    <span class="tree-count">{{ child.count }}</span>
                  </button>
                  <div v-if="expanded[child.key] && child.children?.length" class="tree-children is-deep">
                    <template v-for="leaf in child.children" :key="leaf.key">
                      <button
                        type="button"
                        class="tree-row is-leaf"
                        :class="{ active: selectedKey === leaf.key, expanded: expanded[leaf.key] }"
                        @click="onTreeClick(leaf)"
                      >
                        <span class="tree-caret">{{ leaf.children?.length ? (expanded[leaf.key] ? '▾' : '▸') : '' }}</span>
                        <span class="tree-label">{{ leaf.label }}</span>
                        <span class="tree-count">{{ leaf.count }}</span>
                      </button>
                      <div v-if="expanded[leaf.key] && leaf.children?.length" class="tree-children is-deeper">
                        <button
                          v-for="sub in leaf.children"
                          :key="sub.key"
                          type="button"
                          class="tree-row is-sub"
                          :class="{ active: selectedKey === sub.key }"
                          @click="onTreeClick(sub)"
                        >
                          <span class="tree-caret" />
                          <span class="tree-label">{{ sub.label }}</span>
                          <span class="tree-count">{{ sub.count }}</span>
                        </button>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </template>
          <el-empty v-if="!treeNodes.length" description="暂无 Bug" :image-size="56" />
        </div>
      </aside>

      <main class="main-pane">
        <div class="pane-head">
          <div class="pane-tags">
            <h2 class="pane-title">{{ paneTitle }}</h2>
            <span class="pill pill-env">{{ environment === 'PROD' ? '生产环境' : '测试环境' }}</span>
            <span v-if="selectedMeta.requirementNo" class="pill pill-req">{{ selectedMeta.requirementNo }}</span>
          </div>
          <div class="status-pills">
            <button
              v-for="pill in statusPills"
              :key="pill.key"
              type="button"
              class="status-pill"
              :class="{ active: statusTab === pill.key }"
              @click="statusTab = pill.key"
            >
              {{ pill.label }} {{ pill.count }}
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <div class="table-head">
            <span class="c-check">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate.prop="someSelected && !allSelected"
                @change="toggleSelectAll"
              />
            </span>
            <span>Bug 编号</span>
            <span>概要</span>
            <span>优先级</span>
            <span>状态</span>
            <span>负责人</span>
            <span>发现时间</span>
            <span>操作</span>
          </div>
          <el-empty v-if="!tableRows.length" description="当前筛选下暂无 Bug" />
          <div v-for="row in tableRows" :key="row.id" class="table-row">
            <span class="c-check">
              <input type="checkbox" :checked="selectedIds.includes(row.id)" @change="toggleRow(row.id)" />
            </span>
            <span class="c-id">{{ row.bugCode }}</span>
            <span class="c-summary">
              <span class="sum-title">{{ summaryTitle(row.description) }}</span>
              <span v-if="row.module" class="sum-sub">{{ row.module }}</span>
            </span>
            <span class="c-prio" :class="'prio-' + row.priority">{{ priorityLabel(row.priority) }}</span>
            <span class="c-status" :class="'st-' + row.status">{{ row.statusLabel }}</span>
            <span class="c-assignee">{{ row.developer || '—' }}</span>
            <span class="c-time">{{ fmtDate(row.createdAt) }}</span>
            <span class="c-ops">
              <button type="button" class="op-view" @click="openDetail(row)">查看</button>
              <button type="button" class="op-del" @click="removeBug(row)">删除</button>
            </span>
          </div>
        </div>
      </main>
    </div>

    <BugSubmitDialog
      v-if="dialogVisible"
      v-model="dialogVisible"
      :mode="dialogMode === 'create' ? 'create' : 'edit'"
      :value="bugDialogValue"
      :show-requirement="true"
      :user-options="userOptions"
      :submitting="saving"
      @submit="onBugDialogSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import BugSubmitDialog from '../components/BugSubmitDialog.vue'
import { apiClient } from '../api'
import { logout, user } from '../stores/auth'
import { apiRowToBugValue, defaultBugValue, type BugSubmitValue } from '../utils/bugSubmit'
import { BUG_PRIORITIES, bugPriorityLabel } from '../utils/bugPriority'

type BugRow = {
  id: string
  bugCode: string
  bugNo?: number
  requirementNo: string
  module?: string
  description: string
  images?: string
  developer?: string
  tester?: string
  priority: string
  status: string
  statusLabel: string
  environment: string
  projectCode?: string
  lang?: string
  appVersion?: string
  caseSides?: string
  createdAt?: string
}

type TreeNode = {
  key: string
  label: string
  count: number
  children?: TreeNode[]
  channel?: string
  projectCode?: string
  requirementNo?: string
  lang?: string
}

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const environment = ref<'TEST' | 'PROD'>('TEST')
const allBugs = ref<BugRow[]>([])
const assigneeOptions = ref<string[]>([])
const userOptions = ref<string[]>([])
const statusCounts = ref<Record<string, number>>({})
const selectedKey = ref('')
const expanded = ref<Record<string, boolean>>({})
const statusTab = ref('ALL')
const selectedIds = ref<string[]>([])
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'view' | 'edit'>('create')
const bugDialogValue = ref<BugSubmitValue>(defaultBugValue())

const filters = reactive({
  priority: '',
  status: '',
  assignee: '',
  q: ''
})

const priorityOptions = BUG_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))

const statusOptions = [
  { value: 'OPEN', label: '待修复' },
  { value: 'FIXING', label: '修复中' },
  { value: 'TO_VERIFY', label: '待验证' },
  { value: 'CLOSED', label: '已关闭' }
]

const filteredBugs = computed(() => {
  let rows = allBugs.value.filter((b) => (b.environment || 'TEST') === environment.value)
  if (statusTab.value !== 'ALL') {
    rows = rows.filter((b) => b.status === statusTab.value)
  }
  if (!selectedKey.value) return rows
  const sel = findNode(treeNodes.value, selectedKey.value)
  if (!sel) return rows
  return rows.filter((b) => matchTreeNode(b, sel))
})

const treeNodes = computed(() => buildTree(allBugs.value.filter((b) => (b.environment || 'TEST') === environment.value)))

const selectedMeta = computed(() => {
  const node = findNode(treeNodes.value, selectedKey.value)
  return {
    requirementNo: node?.requirementNo || '',
    label: node?.label || '全部 Bug'
  }
})

const paneTitle = computed(() => selectedMeta.value.label || '全部 Bug')

const statusPills = computed(() => {
  const base = filteredBugs.value
  const count = (st: string) =>
    st === 'ALL' ? base.length : base.filter((b) => b.status === st).length
  return [
    { key: 'ALL', label: '全部', count: count('ALL') },
    { key: 'OPEN', label: '待修复', count: count('OPEN') },
    { key: 'FIXING', label: '修复中', count: count('FIXING') },
    { key: 'TO_VERIFY', label: '待验证', count: count('TO_VERIFY') },
    { key: 'CLOSED', label: '已关闭', count: count('CLOSED') }
  ]
})

const tableRows = computed(() => filteredBugs.value)

const allSelected = computed(
  () => tableRows.value.length > 0 && tableRows.value.every((r) => selectedIds.value.includes(r.id))
)
const someSelected = computed(() => selectedIds.value.length > 0)

function onNavUserCommand(cmd: string) {
  if (cmd === 'logout') {
    logout()
    router.replace('/login')
  }
}

function switchEnv(env: 'TEST' | 'PROD') {
  environment.value = env
  selectedKey.value = ''
  statusTab.value = 'ALL'
}

function resetFilters() {
  filters.priority = ''
  filters.status = ''
  filters.assignee = ''
  filters.q = ''
  load()
}

async function load() {
  loading.value = true
  try {
    const data = await apiClient.fetchBugManage({
      environment: environment.value,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      assignee: filters.assignee || undefined,
      q: filters.q || undefined
    })
    allBugs.value = (data.bugs || []) as BugRow[]
    assigneeOptions.value = data.assignees || []
    userOptions.value = [...new Set([...userOptions.value, ...assigneeOptions.value])]
    statusCounts.value = data.statusCounts || {}
    if (treeNodes.value.length && !selectedKey.value) {
      const first = treeNodes.value[0]
      selectedKey.value = first.key
      expanded.value = { ...expanded.value, [first.key]: true }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function bugChannel(b: BugRow): 'APP' | 'PWA' | 'WEB' {
  const req = String(b.requirementNo || '')
  const ver = String(b.appVersion || '')
  if (/web/i.test(ver) || ver.includes('网站')) return 'WEB'
  if (/^PWA-|^POG-/i.test(req)) return 'PWA'
  if (/^APP-\d+/i.test(req)) return 'APP'
  return 'APP'
}

function isOverseasBug(b: BugRow): boolean {
  const ver = String(b.appVersion || '')
  return /海外|pog/i.test(ver)
}

function buildTree(bugs: BugRow[]): TreeNode[] {
  const channels = new Map<string, Map<string, Map<string, BugRow[]>>>()
  for (const b of bugs) {
    const ch = bugChannel(b)
    const proj = String(b.projectCode || '未指定项目').trim() || '未指定项目'
    const req = String(b.requirementNo || '未归类').trim() || '未归类'
    if (!channels.has(ch)) channels.set(ch, new Map())
    const projMap = channels.get(ch)!
    if (!projMap.has(proj)) projMap.set(proj, new Map())
    const reqMap = projMap.get(proj)!
    if (!reqMap.has(req)) reqMap.set(req, [])
    reqMap.get(req)!.push(b)
  }

  const out: TreeNode[] = []
  for (const ch of ['APP', 'PWA', 'WEB']) {
    const projMap = channels.get(ch)
    if (!projMap) continue
    let chCount = 0
    const chChildren: TreeNode[] = []
    for (const [proj, reqMap] of projMap) {
      let projCount = 0
      const projChildren: TreeNode[] = []
      for (const [req, rows] of reqMap) {
        projCount += rows.length
        const overseas = rows.some(isOverseasBug)
        if (!overseas) {
          projChildren.push({
            key: `${ch}|${proj}|${req}`,
            label: reqGroupTitle(req, rows),
            count: rows.length,
            channel: ch,
            projectCode: proj,
            requirementNo: req
          })
          continue
        }
        const reqNode: TreeNode = {
          key: `${ch}|${proj}|${req}|folder`,
          label: reqGroupTitle(req, rows),
          count: rows.length,
          channel: ch,
          projectCode: proj,
          requirementNo: req,
          children: []
        }
        const zh = rows.filter((r) => (r.lang || 'zh') === 'zh')
        const en = rows.filter((r) => r.lang === 'en')
        if (zh.length) {
          reqNode.children!.push({
            key: `${ch}|${proj}|${req}|zh`,
            label: '海外 · 中文',
            count: zh.length,
            channel: ch,
            projectCode: proj,
            requirementNo: req,
            lang: 'zh'
          })
        }
        if (en.length) {
          reqNode.children!.push({
            key: `${ch}|${proj}|${req}|en`,
            label: '海外 · 英文',
            count: en.length,
            channel: ch,
            projectCode: proj,
            requirementNo: req,
            lang: 'en'
          })
        }
        if (reqNode.children!.length) projChildren.push(reqNode)
      }
      if (projChildren.length) {
        chCount += projCount
        chChildren.push({
          key: `${ch}|${proj}`,
          label: proj,
          count: projCount,
          channel: ch,
          projectCode: proj,
          children: projChildren
        })
      }
    }
    if (chChildren.length) {
      out.push({ key: ch, label: ch, count: chCount, channel: ch, children: chChildren })
    }
  }
  return out
}

function reqGroupTitle(req: string, rows: BugRow[]): string {
  if (req === '未归类') return req
  const names = new Map<string, number>()
  for (const r of rows) {
    const m = String(r.module || '').trim()
    if (m && m !== req && !m.includes(req)) names.set(m, (names.get(m) || 0) + 1)
  }
  let best = ''
  let bestN = 0
  for (const [m, n] of names) {
    if (n > bestN) {
      best = m
      bestN = n
    }
  }
  return best ? `${best} · ${req}` : req
}

function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const n of nodes) {
    if (n.key === key) return n
    if (n.children) {
      const hit = findNode(n.children, key)
      if (hit) return hit
    }
  }
  return null
}

function matchTreeNode(b: BugRow, node: TreeNode): boolean {
  if (node.channel && bugChannel(b) !== node.channel) return false
  if (node.projectCode && String(b.projectCode || '未指定项目') !== node.projectCode) return false
  if (node.requirementNo && String(b.requirementNo || '') !== node.requirementNo) return false
  if (node.lang && (b.lang || 'zh') !== node.lang) return false
  return true
}

function onTreeClick(node: TreeNode) {
  if (node.children?.length) {
    expanded.value = { ...expanded.value, [node.key]: !expanded.value[node.key] }
  }
  selectedKey.value = node.key
  statusTab.value = 'ALL'
}

function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  selectedIds.value = checked ? tableRows.value.map((r) => r.id) : []
}

function toggleRow(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

function priorityLabel(p: string) {
  return bugPriorityLabel(p)
}

function summaryTitle(desc: string) {
  const t = String(desc || '').trim()
  const line = t.split('\n')[0]
  return line.length > 80 ? line.slice(0, 80) + '…' : line
}

function fmtDate(v?: string) {
  if (!v) return '—'
  return String(v).slice(0, 10)
}

function resolveImage(u: string) {
  return apiClient.resolveAssetUrl(u)
}

function openCreate() {
  dialogMode.value = 'create'
  const node = findNode(treeNodes.value, selectedKey.value)
  bugDialogValue.value = defaultBugValue({
    requirementNo: node?.requirementNo || '',
    reporter: user.value?.displayName || user.value?.username || '',
    assignee: '',
    environment: environment.value
  })
  dialogVisible.value = true
}

function openDetail(row: BugRow) {
  dialogMode.value = 'edit'
  bugDialogValue.value = apiRowToBugValue({
    ...row,
    images: row.images,
    note: (row as any).note
  })
  dialogVisible.value = true
}

async function onBugDialogSubmit(body: Record<string, unknown>) {
  saving.value = true
  try {
    if (body.id) {
      await apiClient.updateBug(String(body.id), body)
      ElMessage.success('已保存')
    } else {
      await apiClient.createBug(body)
      ElMessage.success('Bug 已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeBug(row: BugRow) {
  try {
    await ElMessageBox.confirm(`删除 ${row.bugCode}？`, '确认', { type: 'warning' })
    await apiClient.deleteBug(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

async function exportBugs() {
  const rows = tableRows.value
  if (!rows.length) return
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html =
    '<table><tbody><tr><th>编号</th><th>需求单</th><th>模块</th><th>概要</th><th>优先级</th><th>状态</th><th>负责人</th><th>发现时间</th></tr>'
  for (const r of rows) {
    html += `<tr><td>${esc(r.bugCode)}</td><td>${esc(r.requirementNo || '')}</td><td>${esc(r.module || '')}</td><td>${esc(r.description || '')}</td><td>${esc(r.priority)}</td><td>${esc(r.statusLabel)}</td><td>${esc(r.developer || '')}</td><td>${esc(fmtDate(r.createdAt))}</td></tr>`
  }
  html += '</tbody></table>'
  try {
    await navigator.clipboard.writeText(html)
    ElMessage.success('已复制 HTML 表格到剪贴板')
  } catch {
    ElMessage.error('复制失败，请检查浏览器权限')
  }
}

async function loadPlatformUsers() {
  try {
    const rows = await apiClient.fetchPlatformUsers()
    const names = rows
      .map((u) => u.displayName || u.username)
      .filter(Boolean) as string[]
    userOptions.value = [...new Set([...names, ...assigneeOptions.value])]
  } catch {
    userOptions.value = [...assigneeOptions.value]
  }
}

onMounted(async () => {
  await load()
  await loadPlatformUsers()
})
</script>

<style scoped>
.bug-mgmt {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--el-fill-color-light);
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
.btn-nav:hover {
  background: rgba(255, 255, 255, 0.08);
}
.btn-nav-danger {
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
}
.btn-nav-danger:hover {
  background: var(--el-color-danger-dark-2);
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
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.f-item {
  width: 130px;
}
.f-search {
  width: 220px;
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
}

.side-pane {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.env-tabs {
  display: flex;
  border-bottom: 1px solid var(--el-border-color);
}
.env-tab {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.env-tab.active {
  background: #fff;
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--el-color-primary);
}
.side-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.tree-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  color: var(--app-text-regular);
}
.tree-row:hover {
  background: var(--el-fill-color-lighter);
}
.tree-row.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.tree-row.is-child {
  padding-left: 22px;
}
.tree-row.is-leaf {
  padding-left: 34px;
}
.tree-row.is-sub {
  padding-left: 46px;
  font-size: 12px;
}
.tree-caret {
  width: 12px;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--el-text-color-disabled);
}
.tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-count {
  font-size: 11px;
  color: var(--el-text-color-disabled);
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 0 6px;
  min-width: 18px;
  text-align: center;
}

.main-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
  gap: 10px;
}
.pane-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pane-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}
.pill-env {
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning-dark-2);
}
.pill-req {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary-dark-2);
}
.status-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.status-pill {
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.status-pill.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.table-wrap {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.table-head,
.table-row {
  display: grid;
  grid-template-columns: 32px 100px minmax(0, 1fr) 90px 88px 80px 100px 100px;
  column-gap: 10px;
  align-items: center;
  padding: 8px 16px;
  box-sizing: border-box;
}
.table-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-disabled);
  font-size: 11px;
  font-weight: 700;
}
.table-row {
  border-bottom: 1px solid #f8fafc;
  font-size: 13px;
}
.table-row:hover {
  background: var(--el-fill-color-lighter);
}
.c-id {
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 12px;
}
.c-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sum-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}
.sum-sub {
  font-size: 11px;
  color: var(--el-text-color-disabled);
}
.c-prio {
  font-size: 11px;
  font-weight: 700;
}
.prio-CRITICAL {
  color: var(--el-color-danger);
}
.prio-HIGH {
  color: var(--el-color-warning-dark-2);
}
.prio-MEDIUM {
  color: var(--el-color-primary);
}
.prio-LOW {
  color: var(--el-text-color-secondary);
}
.c-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}
.st-OPEN {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.st-FIXING {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.st-TO_VERIFY {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.st-CLOSED {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.c-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.c-ops {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  column-gap: 8px;
}
.op-view,
.op-del {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.op-view {
  color: var(--el-color-primary);
}
.op-del {
  color: var(--el-color-danger);
}
.shots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.shot {
  width: 56px;
  height: 56px;
  border-radius: 4px;
}
</style>
