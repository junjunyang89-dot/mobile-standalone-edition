<template>
  <div class="issue-track">
    <header class="page-nav">
      <div class="nav-left">
        <span class="nav-title">问题跟踪</span>
        <span class="nav-sub">线上 / 测试反馈 · 持续跟进 · 防止遗漏</span>
      </div>
      <div class="nav-right">
        <div class="nav-actions">
          <button type="button" class="btn-nav" :disabled="!filteredIssues.length" @click="exportIssues">
            导出
          </button>
          <button type="button" class="btn-nav btn-nav-primary" @click="openCreate">+ 新建记录</button>
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
          线上环境
        </button>
      </div>
      <el-select v-model="filters.priority" class="f-item" size="small" clearable placeholder="全部优先级">
        <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <el-select v-model="filters.trackingTester" class="f-item" size="small" clearable filterable placeholder="跟踪测试">
        <el-option v-for="t in testerOptions" :key="t" :label="t" :value="t" />
      </el-select>
      <el-input
        v-model="filters.q"
        class="f-search"
        size="small"
        clearable
        placeholder="搜索编号 / 标题 / 开发 / 模块"
        @keyup.enter="load"
      />
      <el-button type="primary" size="small" :loading="loading" @click="load">查询</el-button>
      <el-button size="small" @click="resetFilters">重置</el-button>
    </div>

    <div class="status-bar">
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

    <div class="table-wrap" v-loading="loading">
      <el-table
        :data="filteredIssues"
        stripe
        border
        size="small"
        height="100%"
        highlight-current-row
        @row-click="openDetail"
      >
        <el-table-column prop="issueCode" label="编号" width="88" fixed />
        <el-table-column prop="title" label="问题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="module" label="模块" width="120" show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="100" show-overflow-tooltip />
        <el-table-column prop="developers" label="开发" width="100" show-overflow-tooltip />
        <el-table-column prop="trackingTester" label="跟踪测试" width="96" />
        <el-table-column label="开发修复" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.devFixed ? 'success' : 'info'">
              {{ row.devFixed ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已验证" width="72" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.verified ? 'success' : 'warning'">
              {{ row.verified ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已上线" width="72" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.deployed ? 'success' : 'info'">
              {{ row.deployed ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="statusLabel" label="状态" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="priorityTagType(row.priority)">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="100">
          <template #default="{ row }">{{ fmtDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openDetail(row)">编辑</el-button>
            <el-button v-perm:delete link type="danger" size="small" @click.stop="removeIssue(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !filteredIssues.length" description="暂无跟踪记录，点右上角新建" />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建问题跟踪' : '编辑问题跟踪'"
      width="720px"
      destroy-on-close
      @closed="form = defaultForm()"
    >
      <el-form label-width="100px" size="default">
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="问题标题" required>
              <el-input v-model="form.title" placeholder="一句话概括问题" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="环境">
              <el-select v-model="form.environment" style="width: 100%">
                <el-option label="测试环境" value="TEST" />
                <el-option label="线上环境" value="PROD" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="反馈来源">
              <el-select v-model="form.source" filterable allow-create clearable placeholder="选择或输入" style="width: 100%">
                <el-option v-for="s in sourceOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="所属模块">
              <el-input v-model="form.module" placeholder="如：登录、赛事" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%">
                <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="问题描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="详细描述问题现象" />
        </el-form-item>
        <el-form-item label="复现步骤">
          <el-input v-model="form.reproductionSteps" type="textarea" :rows="3" placeholder="1. …&#10;2. …" />
        </el-form-item>
        <el-form-item label="测试情况">
          <el-input v-model="form.testStatus" type="textarea" :rows="2" placeholder="已测什么、结果如何、还缺什么" />
        </el-form-item>
        <el-form-item label="怎么产生">
          <el-input v-model="form.originNote" type="textarea" :rows="2" placeholder="需求变更 / 漏测 / 配置错误 / …" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="涉及开发">
              <el-select
                v-model="form.developersList"
                multiple
                filterable
                allow-create
                collapse-tags
                collapse-tags-tooltip
                placeholder="可多选或输入"
                style="width: 100%"
              >
                <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="跟踪测试">
              <el-select v-model="form.trackingTester" filterable allow-create clearable style="width: 100%">
                <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="开发修复">
              <el-switch v-model="form.devFixed" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="已验证">
              <el-switch v-model="form.verified" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="已上线">
              <el-switch v-model="form.deployed" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="跟进状态">
          <el-select v-model="form.status" style="width: 200px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import { useAuthStore } from '../stores/auth'
import { bugPriorityLabel } from '../utils/bugPriority'

type IssueRow = Record<string, any>

const auth = useAuthStore()
const user = computed(() => auth.user)

const loading = ref(false)
const saving = ref(false)
const issues = ref<IssueRow[]>([])
const testerOptions = ref<string[]>([])
const userOptions = ref<string[]>([])
const statusCounts = ref<Record<string, number>>({})

const environment = ref<'TEST' | 'PROD'>('TEST')
const statusTab = ref('ALL')
const filters = ref({ priority: '', trackingTester: '', q: '' })

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')

interface IssueForm {
  id?: string
  title: string
  environment: string
  source: string
  module: string
  description: string
  reproductionSteps: string
  testStatus: string
  originNote: string
  developersList: string[]
  trackingTester: string
  devFixed: boolean
  verified: boolean
  deployed: boolean
  status: string
  priority: string
  note: string
}

const form = ref<IssueForm>(defaultForm())

const priorityOptions = [
  { value: 'CRITICAL', label: '紧急' },
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' }
]

const statusOptions = [
  { value: 'TRACKING', label: '跟踪中' },
  { value: 'VERIFYING', label: '待验证' },
  { value: 'FIXED', label: '已修复' },
  { value: 'DEPLOYED', label: '已上线' },
  { value: 'CLOSED', label: '已关闭' }
]

const sourceOptions = ['同事反馈', '用户反馈', '自测发现', '运营反馈', '客服反馈', '监控告警']

function defaultForm(): IssueForm {
  return {
    title: '',
    environment: environment.value,
    source: '',
    module: '',
    description: '',
    reproductionSteps: '',
    testStatus: '',
    originNote: '',
    developersList: [],
    trackingTester: user.value?.displayName || user.value?.username || '',
    devFixed: false,
    verified: false,
    deployed: false,
    status: 'TRACKING',
    priority: 'MEDIUM',
    note: ''
  }
}

const statusPills = computed(() => [
  { key: 'ALL', label: '全部', count: statusCounts.value.ALL || 0 },
  { key: 'TRACKING', label: '跟踪中', count: statusCounts.value.TRACKING || 0 },
  { key: 'VERIFYING', label: '待验证', count: statusCounts.value.VERIFYING || 0 },
  { key: 'FIXED', label: '已修复', count: statusCounts.value.FIXED || 0 },
  { key: 'DEPLOYED', label: '已上线', count: statusCounts.value.DEPLOYED || 0 },
  { key: 'CLOSED', label: '已关闭', count: statusCounts.value.CLOSED || 0 }
])

const filteredIssues = computed(() => {
  if (statusTab.value === 'ALL') return issues.value
  return issues.value.filter((r) => r.status === statusTab.value)
})

function switchEnv(env: 'TEST' | 'PROD') {
  environment.value = env
  load()
}

function resetFilters() {
  filters.value = { priority: '', trackingTester: '', q: '' }
  statusTab.value = 'ALL'
  load()
}

function priorityLabel(p: string) {
  return bugPriorityLabel(p)
}

function priorityTagType(p: string) {
  if (p === 'CRITICAL') return 'danger'
  if (p === 'HIGH') return 'warning'
  return 'info'
}

function statusTagType(s: string) {
  if (s === 'CLOSED') return 'success'
  if (s === 'VERIFYING' || s === 'FIXED') return 'warning'
  if (s === 'DEPLOYED') return 'primary'
  return 'info'
}

function fmtDate(v?: string) {
  if (!v) return '—'
  return String(v).slice(0, 10)
}

function rowToForm(row: IssueRow): IssueForm {
  const devs = String(row.developers || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    id: row.id,
    title: row.title || '',
    environment: row.environment || 'TEST',
    source: row.source || '',
    module: row.module || '',
    description: row.description || '',
    reproductionSteps: row.reproductionSteps || '',
    testStatus: row.testStatus || '',
    originNote: row.originNote || '',
    developersList: devs,
    trackingTester: row.trackingTester || '',
    devFixed: !!row.devFixed,
    verified: !!row.verified,
    deployed: !!row.deployed,
    status: row.status || 'TRACKING',
    priority: row.priority || 'MEDIUM',
    note: row.note || ''
  }
}

function formToBody(f: IssueForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: f.title,
    environment: f.environment,
    source: f.source,
    module: f.module,
    description: f.description,
    reproductionSteps: f.reproductionSteps,
    testStatus: f.testStatus,
    originNote: f.originNote,
    developers: f.developersList.join('、'),
    trackingTester: f.trackingTester,
    devFixed: f.devFixed,
    verified: f.verified,
    deployed: f.deployed,
    status: f.status,
    priority: f.priority,
    note: f.note
  }
  if (f.id) body.id = f.id
  return body
}

function openCreate() {
  dialogMode.value = 'create'
  form.value = defaultForm()
  dialogVisible.value = true
}

function openDetail(row: IssueRow) {
  dialogMode.value = 'edit'
  form.value = rowToForm(row)
  dialogVisible.value = true
}

async function save() {
  if (!form.value.title.trim()) {
    ElMessage.warning('请填写问题标题')
    return
  }
  saving.value = true
  try {
    const body = formToBody(form.value)
    if (form.value.id) {
      await apiClient.updateIssueTracking(form.value.id, body)
      ElMessage.success('已保存')
    } else {
      await apiClient.createIssueTracking(body)
      ElMessage.success('记录已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeIssue(row: IssueRow) {
  try {
    await ElMessageBox.confirm(`删除 ${row.issueCode}？`, '确认', { type: 'warning' })
    await apiClient.deleteIssueTracking(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

async function exportIssues() {
  const rows = filteredIssues.value
  if (!rows.length) return
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html =
    '<table><tbody><tr><th>编号</th><th>环境</th><th>标题</th><th>模块</th><th>来源</th><th>开发</th><th>跟踪测试</th><th>开发修复</th><th>已验证</th><th>已上线</th><th>状态</th><th>复现步骤</th><th>测试情况</th></tr>'
  for (const r of rows) {
    html += `<tr><td>${esc(r.issueCode)}</td><td>${esc(r.environmentLabel)}</td><td>${esc(r.title)}</td><td>${esc(r.module || '')}</td><td>${esc(r.source || '')}</td><td>${esc(r.developers || '')}</td><td>${esc(r.trackingTester || '')}</td><td>${r.devFixed ? '是' : '否'}</td><td>${r.verified ? '是' : '否'}</td><td>${r.deployed ? '是' : '否'}</td><td>${esc(r.statusLabel)}</td><td>${esc(r.reproductionSteps || '')}</td><td>${esc(r.testStatus || '')}</td></tr>`
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
    const names = rows.map((u) => u.displayName || u.username).filter(Boolean) as string[]
    userOptions.value = [...new Set([...names, ...testerOptions.value])]
  } catch {
    userOptions.value = [...testerOptions.value]
  }
}

async function load() {
  loading.value = true
  try {
    const res = await apiClient.listIssueTracking({
      environment: environment.value,
      status: undefined,
      priority: filters.value.priority || undefined,
      trackingTester: filters.value.trackingTester || undefined,
      q: filters.value.q || undefined
    })
    issues.value = res.issues || []
    testerOptions.value = res.testers || []
    statusCounts.value = res.statusCounts || {}
    await loadPlatformUsers()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onNavUserCommand(cmd: string) {
  if (cmd === 'logout') auth.logout()
}

onMounted(load)
</script>

<style scoped>
.issue-track {
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
.btn-nav:hover {
  background: rgba(255, 255, 255, 0.08);
}
.btn-nav-primary {
  background: #2563eb;
  border-color: #2563eb;
}
.btn-nav-primary:hover {
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
.f-item {
  width: 130px;
}
.f-search {
  width: 220px;
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
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8ecf0;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.status-pill {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: #606266;
}
.status-pill.active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #2563eb;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
  position: relative;
}
.table-wrap :deep(.el-table) {
  cursor: pointer;
}
</style>
