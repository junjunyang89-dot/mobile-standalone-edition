<template>
  <div class="issue-track">
    <header class="page-nav">
      <div class="nav-left">
        <span class="nav-title">线上问题跟踪</span>
        <span class="nav-sub">线上反馈 · 持续跟进 · 防止遗漏</span>
      </div>
      <div class="nav-right">
        <div class="nav-actions">
          <button type="button" class="btn-nav" :disabled="wikiSyncing" @click="syncWiki">
            {{ wikiSyncing ? '同步中…' : '同步到 Wiki' }}
          </button>
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
          :class="{ active: environment === 'PROD' }"
          @click="switchEnv('PROD')"
        >
          线上环境
        </button>
        <button
          type="button"
          class="env-tab"
          :class="{ active: environment === 'TEST' }"
          @click="switchEnv('TEST')"
        >
          测试环境
        </button>
      </div>
      <div class="env-tabs">
        <button
          v-for="p in projectTabOptions"
          :key="p.value"
          type="button"
          class="env-tab"
          :class="{ active: projectTab === p.value }"
          @click="switchProject(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
      <el-select v-model="filters.priority" class="f-item" size="small" clearable placeholder="全部优先级">
        <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
      </el-select>
      <el-select v-model="filters.developer" class="f-item" size="small" clearable filterable placeholder="跟进开发">
        <el-option v-for="d in developerOptions" :key="d" :label="d" :value="d" />
      </el-select>
      <el-select v-model="filters.trackingTester" class="f-item" size="small" clearable filterable placeholder="跟进测试">
        <el-option v-for="t in testerOptions" :key="t" :label="t" :value="t" />
      </el-select>
      <el-input
        v-model="filters.q"
        class="f-search"
        size="small"
        clearable
        placeholder="搜索编号 / Title / 开发 / 接口 / 模块"
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
        <el-table-column label="图" width="64" align="center">
          <template #default="{ row }">
            <el-image
              v-if="firstImage(row)"
              :src="imgSrc(firstImage(row))"
              :preview-src-list="imageList(row).map(imgSrc)"
              fit="cover"
              class="row-shot"
              preview-teleported
              @click.stop
            />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="Title" min-width="200" show-overflow-tooltip />
        <el-table-column label="涉及的接口" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.relatedApis || []).join('、') || '—' }}</template>
        </el-table-column>
        <el-table-column prop="projectType" label="项目" width="72">
          <template #default="{ row }">
            <el-tag size="small" :type="projectTagType(row.projectType)">{{ row.projectTypeLabel || row.projectType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="100" show-overflow-tooltip />
        <el-table-column prop="developers" label="跟进开发" width="110" show-overflow-tooltip />
        <el-table-column prop="trackingTester" label="跟进测试" width="96" />
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
        <el-table-column prop="note" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="168" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openDetail(row)">编辑</el-button>
            <el-button link type="primary" size="small" :disabled="wikiSyncing" @click.stop="syncWikiOne(row)">同步</el-button>
            <el-button v-perm:delete link type="danger" size="small" @click.stop="removeIssue(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !filteredIssues.length" description="暂无跟踪记录，点右上角新建" />
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建线上问题' : '编辑线上问题'"
      width="880px"
      destroy-on-close
      @closed="form = defaultForm()"
    >
      <el-form label-width="100px" size="default">
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="问题标题" required>
              <el-input v-model="form.title" placeholder="一句话概括问题（Title）" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="环境">
              <el-select v-model="form.environment" style="width: 100%">
                <el-option label="线上环境" value="PROD" />
                <el-option label="测试环境" value="TEST" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="10">
            <el-form-item label="归属项目">
              <el-radio-group v-model="form.projectType">
                <el-radio-button v-for="p in projectTypeOptions" :key="p.value" :value="p.value">
                  {{ p.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="7">
            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%">
                <el-option v-for="p in priorityOptions" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="7">
            <el-form-item label="反馈来源">
              <el-select v-model="form.source" filterable allow-create clearable placeholder="选择或输入" style="width: 100%">
                <el-option v-for="s in sourceOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="所属模块">
          <el-input v-model="form.module" placeholder="如：登录、赛事、房间" />
        </el-form-item>
        <el-form-item label="涉及的接口">
          <el-select
            v-model="form.relatedApis"
            multiple
            filterable
            allow-create
            default-first-option
            reserve-keyword
            collapse-tags
            collapse-tags-tooltip
            :filter-method="onApiFilter"
            :loading="endpointLoading"
            placeholder="搜索接口清单，或输入后按回车添加"
            style="width: 100%"
            @visible-change="onApiDropdown"
          >
            <el-option v-for="e in apiSelectOptions" :key="e" :label="e" :value="e" />
          </el-select>
          <div class="field-hint">输入完整路径后按回车添加；点保存前请确认标签已出现在框里</div>
        </el-form-item>
        <el-form-item label="问题描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="详细描述问题现象" />
        </el-form-item>
        <el-form-item label="复现步骤">
          <el-input v-model="form.reproductionSteps" type="textarea" :rows="3" placeholder="1. …&#10;2. …" />
        </el-form-item>
        <el-form-item label="截图">
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            hidden
            @change="onPickFiles"
          />
          <div
            class="upload-zone"
            :class="{ dragover: dragOver, uploading }"
            @click="fileInput?.click()"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
          >
            {{ uploading ? '上传中…' : '拖拽或点击上传（png/jpg/gif/webp，单张 ≤ 10MB，最多 8 张）' }}
          </div>
          <div v-if="form.images.length" class="shot-grid">
            <div v-for="(u, i) in form.images" :key="u + i" class="shot-item">
              <el-image
                :src="imgSrc(u)"
                :preview-src-list="form.images.map(imgSrc)"
                :initial-index="i"
                fit="cover"
                preview-teleported
              />
              <button type="button" class="shot-del" @click="removeImage(i)">×</button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="测试情况">
          <el-input v-model="form.testStatus" type="textarea" :rows="2" placeholder="已测什么、结果如何、还缺什么" />
        </el-form-item>
        <el-form-item label="怎么产生">
          <el-input v-model="form.originNote" type="textarea" :rows="2" placeholder="需求变更 / 漏测 / 配置错误 / …" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="跟进开发">
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
            <el-form-item label="跟进测试">
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
          <el-input v-model="form.note" type="textarea" :rows="2" placeholder="跟进进展、临时结论、还差什么" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :loading="wikiSyncing" :disabled="saving" @click="saveThenSync">保存并同步 Wiki</el-button>
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
import { logout, user } from '../stores/auth'
import { bugPriorityLabel } from '../utils/bugPriority'

type IssueRow = Record<string, any>

const loading = ref(false)
const saving = ref(false)
const wikiSyncing = ref(false)
const uploading = ref(false)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const issues = ref<IssueRow[]>([])
const testerOptions = ref<string[]>([])
const developerOptions = ref<string[]>([])
const userOptions = ref<string[]>([])
const endpointOptions = ref<string[]>([])
const endpointLoading = ref(false)
const endpointQuery = ref('')
const statusCounts = ref<Record<string, number>>({})

const environment = ref<'TEST' | 'PROD'>('PROD')
const projectTab = ref('ALL')
const statusTab = ref('ALL')
const filters = ref({ priority: '', trackingTester: '', developer: '', q: '' })

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')

interface IssueForm {
  id?: string
  title: string
  environment: string
  projectType: string
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
  images: string[]
  relatedApis: string[]
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

const projectTypeOptions = [
  { value: 'APP', label: 'APP' },
  { value: 'PVP', label: 'PVP' },
  { value: 'WEB', label: 'WEB' }
]

const projectTabOptions = [
  { value: 'ALL', label: '全部项目' },
  { value: 'APP', label: 'APP' },
  { value: 'PVP', label: 'PVP' }
]

const sourceOptions = ['同事反馈', '用户反馈', '自测发现', '运营反馈', '客服反馈', '监控告警']

function defaultForm(): IssueForm {
  return {
    title: '',
    environment: environment.value,
    projectType: projectTab.value === 'ALL' ? 'APP' : projectTab.value,
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
    note: '',
    images: [],
    relatedApis: []
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

const apiSelectOptions = computed(() => [
  ...new Set([...(form.value.relatedApis || []), ...endpointOptions.value])
])

function switchEnv(env: 'TEST' | 'PROD') {
  environment.value = env
  load()
}

function switchProject(tab: string) {
  projectTab.value = tab
  load()
}

function resetFilters() {
  filters.value = { priority: '', trackingTester: '', developer: '', q: '' }
  statusTab.value = 'ALL'
  projectTab.value = 'ALL'
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

function projectTagType(p: string) {
  if (p === 'PVP') return 'warning'
  if (p === 'WEB') return ''
  return 'primary'
}

function fmtDate(v?: string) {
  if (!v) return '—'
  return String(v).slice(0, 10)
}

function imageList(row: IssueRow): string[] {
  const raw = row?.images
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

function apiList(row: IssueRow): string[] {
  const raw = row?.relatedApis
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [raw]
    } catch {
      return raw.split(/[\n,，、]/).map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

function firstImage(row: IssueRow) {
  return imageList(row)[0] || ''
}

function imgSrc(path?: string) {
  return apiClient.resolveAssetUrl(path)
}

function rowToForm(row: IssueRow): IssueForm {
  const devs = String(row.developers || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    id: row.id,
    title: row.title || '',
    environment: row.environment || 'PROD',
    projectType: row.projectType || 'APP',
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
    note: row.note || '',
    images: imageList(row),
    relatedApis: apiList(row)
  }
}

function formToBody(f: IssueForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: f.title,
    environment: f.environment,
    projectType: f.projectType,
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
    note: f.note,
    images: f.images,
    relatedApis: f.relatedApis
  }
  if (f.id) body.id = f.id
  return body
}

function openCreate() {
  dialogMode.value = 'create'
  form.value = defaultForm()
  endpointOptions.value = []
  endpointQuery.value = ''
  dialogVisible.value = true
}

function openDetail(row: IssueRow) {
  dialogMode.value = 'edit'
  form.value = rowToForm(row)
  endpointOptions.value = [...form.value.relatedApis]
  endpointQuery.value = ''
  dialogVisible.value = true
}

function commitPendingApi() {
  const q = endpointQuery.value.trim()
  if (!q) return
  if (!form.value.relatedApis.includes(q)) {
    form.value.relatedApis = [...form.value.relatedApis, q]
  }
  if (!endpointOptions.value.includes(q)) {
    endpointOptions.value = [...endpointOptions.value, q]
  }
  endpointQuery.value = ''
}

function onApiDropdown(open: boolean) {
  if (!open) commitPendingApi()
}

async function onApiFilter(q: string) {
  endpointQuery.value = q || ''
  const keyword = endpointQuery.value.trim()
  if (keyword.length < 2) return
  endpointLoading.value = true
  try {
    const res = await apiClient.fetchApiEndpoints({ keyword })
    const found = (res.items || []).slice(0, 50).map((e) => {
      const sig = `${e.httpMethod || 'GET'} ${e.path || ''}`.trim()
      return e.summary ? `${sig}  ${e.summary}` : sig
    }).filter(Boolean)
    endpointOptions.value = [...new Set([...(form.value.relatedApis || []), ...found])]
  } catch {
    endpointOptions.value = [...(form.value.relatedApis || [])]
  } finally {
    endpointLoading.value = false
  }
}

async function save(options?: { syncWiki?: boolean }) {
  if (!form.value.title.trim()) {
    ElMessage.warning('请填写问题标题')
    return
  }
  commitPendingApi()
  saving.value = true
  try {
    const body = formToBody(form.value)
    let id = form.value.id
    if (id) {
      await apiClient.updateIssueTracking(id, body)
    } else {
      const created = await apiClient.createIssueTracking(body)
      id = created.id
      form.value.id = id
    }
    if (options?.syncWiki && id) {
      wikiSyncing.value = true
      try {
        await doSyncWiki(id)
      } finally {
        wikiSyncing.value = false
      }
    } else {
      ElMessage.success(dialogMode.value === 'edit' ? '已保存' : '记录已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function saveThenSync() {
  await save({ syncWiki: true })
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

async function uploadFiles(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name))
  if (!images.length) {
    ElMessage.warning('仅支持 png/jpg/gif/webp')
    return
  }
  if (form.value.images.length + images.length > 8) {
    ElMessage.warning('最多 8 张截图')
    return
  }
  uploading.value = true
  try {
    const r = await apiClient.uploadIssueImages(images)
    form.value.images = [...form.value.images, ...(r.urls || [])]
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onPickFiles(e: Event) {
  uploadFiles(Array.from((e.target as HTMLInputElement).files || []))
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  uploadFiles(Array.from(e.dataTransfer?.files || []))
}

function removeImage(i: number) {
  form.value.images.splice(i, 1)
}

async function doSyncWiki(id?: string) {
  const r = await apiClient.syncIssueTrackingWiki(id)
  const appended = r.appended ?? r.count ?? 0
  const skipped = r.skipped ?? 0
  if (appended === 0) {
    ElMessage.info(skipped ? '这条已在 Wiki 表格中，未重复追加' : '没有可追加的新记录')
  } else {
    ElMessage.success(
      skipped ? `已追加 ${appended} 条到 Wiki（${skipped} 条已在表中）` : `已追加 ${appended} 条到 Wiki`
    )
  }
  return r
}

async function syncWiki() {
  try {
    await ElMessageBox.confirm(
      '将尚未出现在 Wiki 表格里的记录追加到末尾（不会覆盖已有行）。确定？',
      '同步到 Wiki',
      { type: 'warning', confirmButtonText: '追加', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  wikiSyncing.value = true
  try {
    await doSyncWiki()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    wikiSyncing.value = false
  }
}

async function syncWikiOne(row: IssueRow) {
  try {
    await ElMessageBox.confirm(
      `将 ${row.issueCode} 追加到 Wiki 表格末尾。确定？`,
      '同步到 Wiki',
      { type: 'warning', confirmButtonText: '追加', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  wikiSyncing.value = true
  try {
    await doSyncWiki(row.id)
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    wikiSyncing.value = false
  }
}

async function exportIssues() {
  const rows = filteredIssues.value
  if (!rows.length) return
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let html =
    '<table><tbody><tr><th>编号</th><th>环境</th><th>项目</th><th>Title</th><th>涉及的接口</th><th>模块</th><th>来源</th><th>跟进开发</th><th>跟进测试</th><th>开发修复</th><th>已验证</th><th>已上线</th><th>状态</th><th>复现步骤</th><th>测试情况</th><th>备注</th></tr>'
  for (const r of rows) {
    const apis = (Array.isArray(r.relatedApis) ? r.relatedApis : []).join('、')
    html += `<tr><td>${esc(r.issueCode)}</td><td>${esc(r.environmentLabel)}</td><td>${esc(r.projectTypeLabel || r.projectType || '')}</td><td>${esc(r.title)}</td><td>${esc(apis)}</td><td>${esc(r.module || '')}</td><td>${esc(r.source || '')}</td><td>${esc(r.developers || '')}</td><td>${esc(r.trackingTester || '')}</td><td>${r.devFixed ? '是' : '否'}</td><td>${r.verified ? '是' : '否'}</td><td>${r.deployed ? '是' : '否'}</td><td>${esc(r.statusLabel)}</td><td>${esc(r.reproductionSteps || '')}</td><td>${esc(r.testStatus || '')}</td><td>${esc(r.note || '')}</td></tr>`
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
    userOptions.value = [...new Set([...names, ...testerOptions.value, ...developerOptions.value])]
  } catch {
    userOptions.value = [...new Set([...testerOptions.value, ...developerOptions.value])]
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
      projectType: projectTab.value === 'ALL' ? undefined : projectTab.value,
      developer: filters.value.developer || undefined,
      q: filters.value.q || undefined
    })
    issues.value = res.issues || []
    testerOptions.value = res.testers || []
    developerOptions.value = res.developers || []
    statusCounts.value = res.statusCounts || {}
    await loadPlatformUsers()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onNavUserCommand(cmd: string) {
  if (cmd === 'logout') logout()
}

onMounted(load)
</script>

<style scoped>
.issue-track {
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
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.btn-nav-primary:hover {
  background: var(--el-color-primary-dark-2);
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
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: var(--app-text-regular);
}
.env-tab.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.status-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.status-pill {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: var(--app-text-regular);
}
.status-pill.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
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
.row-shot {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
}
.muted {
  color: var(--el-text-color-disabled);
}

.upload-zone {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  padding: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
}
.upload-zone:hover,
.upload-zone.dragover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.upload-zone.uploading {
  pointer-events: none;
  opacity: 0.7;
}
.shot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.shot-item {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
}
.shot-item :deep(.el-image) {
  width: 100%;
  height: 100%;
}
.shot-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  line-height: 18px;
  font-size: 14px;
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
