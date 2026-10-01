<template>
  <div class="api-projects">
    <div class="page-head">
      <div class="page-head-main">
        <h2 class="page-title">项目管理</h2>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <b class="stat-num">{{ stats.total }}</b>
        <div class="stat-text">
          <div class="stat-name">全部项目</div>
          <div class="stat-desc">{{ categorySummary || '—' }}</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-full">{{ stats.FULL }}</b>
        <div class="stat-text">
          <div class="stat-name">已配全</div>
          <div class="stat-desc">地址 · 接口 · 用例 都有</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-partial">{{ stats.PARTIAL }}</b>
        <div class="stat-text">
          <div class="stat-name">部分缺失</div>
          <div class="stat-desc">有地址，接口或用例为空</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-empty">{{ stats.EMPTY }}</b>
        <div class="stat-text">
          <div class="stat-name">尚未开始</div>
          <div class="stat-desc">三个环节都空着</div>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索项目编码、名称或说明…"
        class="search"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div class="status-chips">
        <button
          v-for="s in statusOptions"
          :key="s.value"
          type="button"
          class="s-chip"
          :class="[`is-${s.value.toLowerCase()}`, { on: statusFilter === s.value }]"
          @click="statusFilter = s.value"
        >
          {{ s.label }} <b>{{ s.count }}</b>
        </button>
      </div>
    </div>

    <div class="layout" v-loading="loading">
      <aside class="cat-pane">
        <div class="cat-head">
          <span class="cat-title">分类</span>
          <el-button link type="primary" size="small" @click="openAddCategory">+ 添加分类</el-button>
        </div>
        <div class="cat-list">
          <button
            v-for="(cat, i) in categories"
            :key="cat.key"
            type="button"
            class="cat-item"
            :class="{ active: selectedCategoryKey === cat.key }"
            @click="selectCategory(cat.key)"
          >
            <i class="cat-dot" :style="{ background: catColor(cat.key, i) }" />
            <span class="cat-label">{{ cat.label }}</span>
            <span class="cat-edit" title="重命名" @click.stop="openRenameCategory(cat)">✎</span>
            <span
              v-if="cat.custom && (cat.count ?? 0) === 0"
              class="cat-del"
              title="删除空分类"
              @click.stop="removeCategory(cat)"
            >×</span>
            <span class="cat-num">{{ realCount(cat) }}</span>
          </button>
        </div>
      </aside>

      <main class="table-pane">
        <el-table
          :data="pagedRows"
          class="proj-table"
          empty-text="没有符合条件的项目"
          :header-cell-style="{ background: '#f7f8fa', color: '#86909c', fontWeight: 500 }"
        >
          <el-table-column label="项目" min-width="210">
            <template #default="{ row }">
              <div class="proj-name" :class="{ missing: row.missing }">
                {{ row.missing ? row.code : row.name || row.code }}
                <span v-if="row.missing" class="missing-tag">未建</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="配置完整度" width="210">
            <template #default="{ row }">
              <div v-if="!row.missing" class="fill-chips">
                <button
                  type="button"
                  class="fill-chip"
                  :class="{ has: urlCount(row.code) > 0 }"
                  title="查看 / 修改这个项目各环境的地址"
                  @click="openUrls(row)"
                >地址 {{ urlCount(row.code) }}</button>
                <button
                  type="button"
                  class="fill-chip"
                  :class="{ has: assetCount(row.code, 'endpoints') > 0 }"
                  title="去接口清单，只看这个项目"
                  @click="goAsset(row, '/api-endpoints')"
                >接口 {{ assetCount(row.code, 'endpoints') }}</button>
                <button
                  type="button"
                  class="fill-chip"
                  :class="{ has: assetCount(row.code, 'apiCases') > 0 }"
                  title="去用例集合，只看这个项目"
                  @click="goAsset(row, '/api-collections')"
                >用例 {{ assetCount(row.code, 'apiCases') }}</button>
              </div>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="代码仓库" min-width="170">
            <template #default="{ row }">
              <div v-if="!row.missing" class="repo-cell">
                <a
                  v-if="row.gitUrl"
                  class="repo-link"
                  :title="row.gitUrl"
                  @click="openGitlab(row.gitUrl)"
                >{{ repoName(row.gitUrl) }}</a>
                <span v-else class="muted">未填 GitLab</span>
                <span
                  class="repo-state"
                  :class="row.repoPath ? 'is-ok' : 'is-none'"
                  :title="row.repoPath || ''"
                >{{ row.repoPath ? '已同步' : '未同步' }}</span>
              </div>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ muted: !row.description }">{{ row.description || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="110">
            <template #default="{ row }">
              <div v-if="!row.missing" class="enable-cell">
                <el-switch
                  :model-value="row.enabled !== false"
                  size="small"
                  :loading="togglingCode === row.code"
                  @change="(v: string | number | boolean) => toggleEnabled(row, v === true)"
                />
                <span :class="{ muted: row.enabled === false }">{{ row.enabled !== false ? '启用' : '停用' }}</span>
              </div>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" align="right">
            <template #default="{ row }">
              <template v-if="row.missing">
                <el-button size="small" link type="primary" @click="openCreateWithCode(row.code)">创建</el-button>
              </template>
              <template v-else>
                <el-button
                  size="small"
                  link
                  type="primary"
                  :disabled="!row.gitUrl && !row.repoPath"
                  :loading="syncingCode === row.code"
                  @click="syncRepo(row)"
                >同步代码</el-button>
                <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button v-perm:delete size="small" link type="danger" @click="remove(row)">删除</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>

        <div class="table-foot">
          <span class="foot-total">共 <b>{{ filteredRows.length }}</b> 条</span>
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="filteredRows.length"
            :page-sizes="[10, 20, 50]"
            layout="sizes, prev, pager, next"
            size="small"
            background
          />
        </div>
      </main>
    </div>

    <el-drawer v-model="drawer" size="600px" destroy-on-close class="pj-drawer" :show-close="false">
      <template #header>
        <div class="pj-head">
          <div class="pj-head-main">
            <div class="pj-title">{{ creating ? '新建项目' : '编辑项目' }}</div>
            <div v-if="!creating" class="pj-sub">
              当前 <code class="pj-chip">{{ form.code }}</code>
              <template v-if="form.nameZh"> · {{ form.nameZh }}</template>
              · {{ assetCount(form.code, 'endpoints') }} 个接口
            </div>
            <div v-else class="pj-sub">编码创建后不可修改，其余随时能改</div>
          </div>
          <button type="button" class="pj-close" aria-label="关闭" @click="drawer = false">×</button>
        </div>
      </template>

      <el-form label-width="76px" class="pj-form">
        <div class="pj-sec">
          <span class="pj-sec-title">基础信息</span>
          <span class="pj-sec-line" />
          <span class="pj-sec-hint">影响展示与归属</span>
        </div>
        <el-form-item label="分类" required>
          <el-select
            v-model="form.category"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入新分类"
            style="width: 100%"
          >
            <el-option v-for="opt in categoryOptions" :key="opt.key" :label="opt.label" :value="opt.key" />
          </el-select>
          <div class="tip">可直接输入新分类名，回车确认</div>
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-if="creating" v-model="form.code" class="pj-mono" placeholder="如 app-seckill" />
          <div v-else class="pj-code">
            <code class="pj-code-val">{{ form.code }}</code>
            <span class="pj-lock">不可改</span>
          </div>
          <div class="tip">编码用于接口地址拼接，创建后不可修改</div>
        </el-form-item>
        <el-form-item label="名称" required>
          <div class="pj-name">
            <el-input v-model="form.name" placeholder="展示名，通常与编码一致" />
            <el-input v-model="form.nameZh" placeholder="中文名，如 数据中心" />
          </div>
          <div class="tip">左：展示名（通常与编码一致）· 右：中文名</div>
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            placeholder="选填，一句话描述这个项目"
          />
        </el-form-item>

        <div class="pj-sec">
          <span class="pj-sec-title">代码仓库</span>
          <span class="pj-sec-line" />
          <span class="pj-sec-hint">接口对比分析用</span>
        </div>
        <el-form-item label="GitLab">
          <el-input
            v-model="form.gitUrl"
            clearable
            class="pj-mono"
            placeholder="http://gitlab.shdev.net/SteamCN/data-center.git"
          />
        </el-form-item>
        <el-form-item label="本地仓库">
          <el-input
            v-model="form.repoPath"
            clearable
            class="pj-mono"
            placeholder="留空则按 GitLab 地址自动 clone"
            :title="form.repoPath"
          />
        </el-form-item>
        <el-form-item label="基线分支">
          <el-input v-model="form.baseBranch" clearable class="pj-mono" placeholder="master" />
          <div class="tip">接口对比分析从这个分支读代码，默认 master</div>
        </el-form-item>

        <div class="pj-sec">
          <span class="pj-sec-title">执行配置</span>
          <span class="pj-sec-line" />
        </div>
        <div class="pj-card">
          <button type="button" class="pj-card-head" @click="bizOpen = !bizOpen">
            <el-icon class="pj-caret" :class="{ open: bizOpen }"><ArrowRight /></el-icon>
            <span class="pj-card-title">业务成功码断言</span>
            <span v-if="!form.successCodePath.trim()" class="pj-reco">推荐配置</span>
            <span v-else class="pj-on">已配置 {{ form.successCodePath }} = {{ form.successCodeValue || '?' }}</span>
          </button>
          <div v-show="bizOpen" class="pj-card-body">
            <el-form-item label="判断规则">
              <div class="pj-rule">
                <div class="pj-rule-col">
                  <span class="pj-rule-k">响应字段</span>
                  <el-input v-model="form.successCodePath" class="pj-mono" placeholder="$.code" />
                </div>
                <span class="pj-eq">=</span>
                <div class="pj-rule-col">
                  <span class="pj-rule-k">期望值</span>
                  <el-input v-model="form.successCodeValue" class="pj-mono" placeholder="0" />
                </div>
              </div>
              <div class="tip">
                配上之后，每条用例执行时会自动追加这条断言。<b>业务失败也是 HTTP 200</b>
                —— 只断言 status 的用例会误判通过。
              </div>
            </el-form-item>
          </div>
        </div>

        <div class="pj-toggle">
          <div>
            <div class="pj-toggle-title">启用该项目</div>
            <div class="tip">关闭后项目下的接口与用例会从列表隐藏，但不会删除</div>
          </div>
          <el-switch v-model="form.enabled" style="--el-switch-on-color: var(--el-color-success)" />
        </div>
        <el-form-item label="排序" class="pj-sort">
          <el-input-number v-model="form.sortOrder" :min="0" :step="10" />
          <span class="pj-sort-hint">数字越小越靠前</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="pj-foot">
          <span class="pj-foot-hint">保存后立即生效</span>
          <el-button @click="drawer = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="categoryDialog"
      :title="categoryDialogMode === 'rename' ? '重命名分类' : '添加分类'"
      width="400px"
      destroy-on-close
    >
      <el-form label-width="80px" size="small">
        <el-form-item v-if="categoryDialogMode === 'rename'" label="标识">
          <code>{{ categoryForm.key }}</code>
          <div class="tip">只改显示名称，标识不变；不会新建分类。</div>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="categoryForm.label" placeholder="如：开放平台、中间件" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialog = false">取消</el-button>
        <el-button type="primary" :loading="categorySaving" @click="saveCategory">
          {{ categoryDialogMode === 'rename' ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <ProjectUrlsDialog v-model="urlsDialog" :project="urlsProject" @changed="loadUrlCounts" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import ProjectUrlsDialog from '../components/ProjectUrlsDialog.vue'

type ProjectRow = {
  code: string
  name: string
  description?: string
  enabled?: boolean
  sortOrder?: number
  successCodePath?: string
  successCodeValue?: string
  gitUrl?: string
  repoPath?: string
  baseBranch?: string
  missing?: boolean
  category?: string
}

type CategoryVo = {
  key: string
  label: string
  count: number
  projects: ProjectRow[]
  builtin?: boolean
  custom?: boolean
  sortOrder?: number
}

type FillStatus = 'FULL' | 'PARTIAL' | 'EMPTY'
type StatusFilter = 'ALL' | FillStatus

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({ key: cat.key, label: cat.label || cat.key }))
)

/** 已下线的分类；连到还没升级的后端时它仍会返回，这里兜底藏掉 */
const RETIRED_CATEGORY_KEYS = new Set(['PVP', 'WEB', 'OTHER'])
const OLD_APP_LABELS = new Set(['APP', 'APP 后端', 'APP后端'])

const CAT_COLORS: Record<string, string> = {
  APP: '#3370ff',
  POGPOG: '#ff7d00'
}
const CAT_PALETTE = ['#14c9c9', '#f5319d', '#f7ba1e', '#165dff', '#9fdb1d']

const loading = ref(false)
const saving = ref(false)
const categoryDialog = ref(false)
const categoryDialogMode = ref<'add' | 'rename'>('add')
const categorySaving = ref(false)
const categoryForm = reactive({ key: '', label: '', sortOrder: 500 })
const drawer = ref(false)
const creating = ref(true)
const categories = ref<CategoryVo[]>([])
const selectedCategoryKey = ref('APP')
const keyword = ref('')
const statusFilter = ref<StatusFilter>('ALL')
const currentPage = ref(1)
const pageSize = ref(10)
const togglingCode = ref('')
const syncingCode = ref('')

function repoName(url: string) {
  return String(url || '').replace(/\.git\/?$/, '').replace(/\/+$/, '').split(/[/:]/).pop() || url
}

/** clone 地址 → 网页地址：git@host:a/b.git 和 http://host/a/b.git 都转成 http(s)://host/a/b */
function openGitlab(url: string) {
  let web = String(url || '').trim().replace(/\.git\/?$/, '')
  const ssh = web.match(/^git@([^:]+):(.+)$/)
  if (ssh) web = `http://${ssh[1]}/${ssh[2]}`
  web = web.replace(/^ssh:\/\/git@/, 'http://').replace(/\/\/[^/@]+@/, '//')
  window.open(web, '_blank')
}

async function syncRepo(row: ProjectRow) {
  syncingCode.value = row.code
  try {
    const r = await apiClient.syncApiProjectRepo(row.code)
    row.repoPath = r.repoPath
    ElMessage.success(r.message)
  } catch (e: any) {
    ElMessage.error({ message: e?.message || '同步失败', duration: 8000 })
  } finally {
    syncingCode.value = ''
  }
}

/** 库里只有一个 name，约定写成「展示名（中文名）」；表单拆成两格编辑，保存时再拼回去 */
function splitName(full: string) {
  const m = String(full || '').trim().match(/^(.*?)\s*[（(]([^（()）]+)[）)]\s*$/)
  return m ? { name: m[1].trim(), nameZh: m[2].trim() } : { name: String(full || '').trim(), nameZh: '' }
}

function joinName(name: string, nameZh: string) {
  const n = name.trim()
  const z = nameZh.trim()
  return z ? `${n}（${z}）` : n
}

const bizOpen = ref(true)

const form = reactive({
  code: '',
  name: '',
  nameZh: '',
  description: '',
  category: 'APP',
  successCodePath: '',
  successCodeValue: '',
  gitUrl: '',
  repoPath: '',
  baseBranch: '',
  enabled: true,
  sortOrder: 100
})

const selectedCategory = computed(() =>
  categories.value.find((c) => c.key === selectedCategoryKey.value) ?? null
)

function catColor(key: string, i: number) {
  return CAT_COLORS[key] || CAT_PALETTE[i % CAT_PALETTE.length]
}

function realCount(cat: CategoryVo) {
  return cat.projects.filter((p) => !p.missing).length
}

function fillStatus(p: ProjectRow): FillStatus {
  const u = urlCount(p.code) > 0
  const e = assetCount(p.code, 'endpoints') > 0
  const c = assetCount(p.code, 'apiCases') > 0
  if (u && e && c) return 'FULL'
  if (!u && !e && !c) return 'EMPTY'
  return 'PARTIAL'
}

const allProjects = computed(() => categories.value.flatMap((c) => c.projects.filter((p) => !p.missing)))

const stats = computed(() => {
  const s = { total: allProjects.value.length, FULL: 0, PARTIAL: 0, EMPTY: 0 }
  for (const p of allProjects.value) s[fillStatus(p)] += 1
  return s
})

const categorySummary = computed(() =>
  categories.value
    .map((c) => ({ label: c.label, n: realCount(c) }))
    .filter((c) => c.n > 0)
    .slice(0, 4)
    .map((c) => `${c.label} ${c.n}`)
    .join(' · ')
)

function matchesKeyword(p: ProjectRow) {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return true
  return [p.code, p.name, p.description].some((v) => String(v || '').toLowerCase().includes(k))
}

const categoryRows = computed(() => (selectedCategory.value?.projects ?? []).filter(matchesKeyword))

const statusOptions = computed<{ value: StatusFilter; label: string; count: number }[]>(() => {
  const counts = { FULL: 0, PARTIAL: 0, EMPTY: 0 }
  for (const p of categoryRows.value) {
    if (!p.missing) counts[fillStatus(p)] += 1
  }
  return [
    { value: 'ALL', label: '全部', count: categoryRows.value.length },
    { value: 'FULL', label: '已配全', count: counts.FULL },
    { value: 'PARTIAL', label: '部分缺失', count: counts.PARTIAL },
    { value: 'EMPTY', label: '尚未开始', count: counts.EMPTY }
  ]
})

const filteredRows = computed(() => {
  if (statusFilter.value === 'ALL') return categoryRows.value
  return categoryRows.value.filter((p) => !p.missing && fillStatus(p) === statusFilter.value)
})

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

watch([selectedCategoryKey, keyword, statusFilter, pageSize], () => {
  currentPage.value = 1
})

watch(
  () => filteredRows.value.length,
  (n) => {
    const maxPage = Math.max(1, Math.ceil(n / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  }
)

const router = useRouter()
const assetCounts = ref<Record<string, Record<string, number>>>({})
const urlCounts = ref<Record<string, number>>({})
const urlsDialog = ref(false)
const urlsProject = ref<{ code: string; name?: string } | null>(null)

function assetCount(code: string, field: 'endpoints' | 'apiCases') {
  return assetCounts.value[code]?.[field] ?? 0
}

function urlCount(code: string) {
  return urlCounts.value[code] ?? 0
}

async function loadAssetCounts() {
  try {
    const tree = await apiClient.getUnifiedTree(true)
    const map: Record<string, Record<string, number>> = {}
    for (const cat of tree.nodes || []) {
      for (const p of (cat as any).children || []) {
        map[p.key] = p.counts || {}
      }
    }
    assetCounts.value = map
  } catch {
    /* 数字拿不到时表格照常能用 */
  }
}

async function loadUrlCounts() {
  try {
    const rows = await apiClient.getApiUrls()
    const map: Record<string, number> = {}
    for (const r of rows || []) {
      if (r?.project) map[r.project] = (map[r.project] ?? 0) + 1
    }
    urlCounts.value = map
  } catch {
    /* 同上 */
  }
}

function openUrls(row: ProjectRow) {
  urlsProject.value = { code: row.code, name: row.name }
  urlsDialog.value = true
}

function goAsset(row: ProjectRow, path: string) {
  router.push({ path, query: { project: row.code } })
}

async function load() {
  loading.value = true
  try {
    const data = await apiClient.getApiProjectsTree()
    categories.value = (data.categories ?? [])
      .filter((c: CategoryVo) => !RETIRED_CATEGORY_KEYS.has(String(c.key).toUpperCase()))
      .map((c: CategoryVo) => (c.key === 'APP' && OLD_APP_LABELS.has(c.label) ? { ...c, label: '电竞APP' } : c))
    if (!categories.value.some((c) => c.key === selectedCategoryKey.value)) {
      selectedCategoryKey.value = categories.value[0]?.key ?? 'APP'
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
  void loadAssetCounts()
  void loadUrlCounts()
}

function selectCategory(key: string) {
  selectedCategoryKey.value = key
}

function openAddCategory() {
  categoryDialogMode.value = 'add'
  categoryForm.key = ''
  categoryForm.label = ''
  categoryForm.sortOrder = 500
  categoryDialog.value = true
}

function openRenameCategory(cat: CategoryVo) {
  categoryDialogMode.value = 'rename'
  categoryForm.key = cat.key
  categoryForm.label = cat.label
  categoryForm.sortOrder = cat.sortOrder ?? 500
  categoryDialog.value = true
}

async function saveCategory() {
  const label = categoryForm.label.trim()
  if (!label) {
    ElMessage.warning('请输入分类名称')
    return
  }
  categorySaving.value = true
  try {
    if (categoryDialogMode.value === 'rename') {
      const key = String(categoryForm.key || '').trim()
      if (!key) {
        ElMessage.warning('分类标识缺失，请关闭后重试')
        return
      }
      await apiClient.updateApiProjectCategory(key, {
        label,
        sortOrder: categoryForm.sortOrder
      })
      ElMessage.success('分类已重命名')
    } else {
      const created = await apiClient.createApiProjectCategory({
        label,
        sortOrder: categoryForm.sortOrder
      })
      ElMessage.success('分类已添加')
      if (created?.key) selectedCategoryKey.value = created.key
    }
    categoryDialog.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || (categoryDialogMode.value === 'rename' ? '重命名失败' : '添加失败'))
  } finally {
    categorySaving.value = false
  }
}

async function removeCategory(cat: CategoryVo) {
  try {
    await ElMessageBox.confirm(`删除空分类「${cat.label}」？`, '确认', { type: 'warning' })
    await apiClient.deleteApiProjectCategory(cat.key)
    ElMessage.success('已删除')
    if (selectedCategoryKey.value === cat.key) {
      selectedCategoryKey.value = categories.value.find((c) => c.key !== cat.key)?.key ?? 'APP'
    }
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

function openCreate() {
  creating.value = true
  form.code = ''
  form.name = ''
  form.nameZh = ''
  form.description = ''
  form.category = selectedCategoryKey.value || 'APP'
  form.successCodePath = ''
  form.successCodeValue = ''
  form.gitUrl = ''
  form.repoPath = ''
  form.baseBranch = ''
  form.enabled = true
  form.sortOrder = 100
  drawer.value = true
}

function openCreateWithCode(code: string) {
  creating.value = true
  form.code = code
  form.name = code
  form.nameZh = ''
  form.description = ''
  form.category = 'APP'
  form.successCodePath = ''
  form.successCodeValue = ''
  form.gitUrl = ''
  form.repoPath = ''
  form.baseBranch = ''
  form.enabled = true
  form.sortOrder = 100
  drawer.value = true
}

function openEdit(row: ProjectRow) {
  creating.value = false
  form.code = row.code
  Object.assign(form, splitName(row.name))
  form.description = row.description || ''
  form.category = row.category || selectedCategoryKey.value || 'APP'
  form.successCodePath = row.successCodePath || ''
  form.successCodeValue = row.successCodeValue || ''
  form.gitUrl = row.gitUrl || ''
  form.repoPath = row.repoPath || ''
  form.baseBranch = row.baseBranch || ''
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  drawer.value = true
}

/** 列表里直接开关；请求带上整行字段，免得后端把没传的字段当成清空 */
async function toggleEnabled(row: ProjectRow, enabled: boolean) {
  const before = row.enabled
  row.enabled = enabled
  togglingCode.value = row.code
  try {
    await apiClient.updateApiProject(row.code, {
      code: row.code,
      name: row.name,
      description: row.description || '',
      category: row.category || selectedCategoryKey.value,
      successCodePath: row.successCodePath || '',
      successCodeValue: row.successCodeValue || '',
      enabled,
      sortOrder: row.sortOrder ?? 100
    })
    ElMessage.success(enabled ? '已启用' : '已停用')
  } catch (e: any) {
    row.enabled = before
    ElMessage.error(e?.message || '保存失败')
  } finally {
    togglingCode.value = ''
  }
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) {
    ElMessage.warning('编码和名称必填')
    return
  }
  if (!String(form.category || '').trim()) {
    ElMessage.warning('请选择或输入分类')
    return
  }
  saving.value = true
  try {
    const body = {
      code: form.code.trim(),
      name: joinName(form.name, form.nameZh),
      description: form.description,
      category: String(form.category).trim(),
      successCodePath: form.successCodePath.trim(),
      successCodeValue: form.successCodeValue.trim(),
      gitUrl: (form.gitUrl || '').trim(),
      repoPath: (form.repoPath || '').trim(),
      baseBranch: (form.baseBranch || '').trim(),
      enabled: form.enabled,
      sortOrder: form.sortOrder
    }
    if (creating.value) await apiClient.createApiProject(body)
    else await apiClient.updateApiProject(form.code, body)
    ElMessage.success('已保存')
    drawer.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: ProjectRow) {
  try {
    await ElMessageBox.confirm(
      `删除项目「${row.name}」？不会自动删除其下地址 / 接口 / 用例，但之后无法再选此编码。`,
      '确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deleteApiProject(row.code)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.api-projects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-head-main {
  min-width: 0;
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.page-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.page-sub code {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-family: inherit;
  font-weight: 500;
}
.page-head-actions {
  flex: none;
  display: flex;
  gap: 8px;
}
.page-head-actions :deep(.el-icon) {
  margin-right: 4px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-width: 0;
}
.stat + .stat {
  border-left: 1px solid var(--el-border-color-lighter);
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}
.stat-num.is-full {
  color: var(--el-color-success);
}
.stat-num.is-partial {
  color: var(--el-color-warning);
}
.stat-num.is-empty {
  color: var(--el-text-color-secondary);
}
.stat-text {
  min-width: 0;
}
.stat-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.stat-desc {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
}
.search {
  flex: 1;
}
.search :deep(.el-input__wrapper) {
  background: var(--el-fill-color-lighter);
  box-shadow: 0 0 0 1px #eef0f3 inset;
}
.status-chips {
  flex: none;
  display: flex;
  gap: 8px;
}
.s-chip {
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  border-radius: 999px;
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--app-text-regular);
  cursor: pointer;
}
.s-chip b {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color-dark);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.s-chip.is-partial {
  border-color: var(--el-color-warning-light-7);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.s-chip.is-partial b {
  background: var(--el-color-warning-light-7);
}
.s-chip.on {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.s-chip.on b {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}
.s-chip.is-partial.on {
  border-color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.s-chip.is-partial.on b {
  background: var(--el-color-warning-light-7);
  color: var(--el-color-warning);
}

.layout {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.cat-pane {
  width: 200px;
  flex: none;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
  padding: 10px 8px;
}
.cat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 8px;
}
.cat-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cat-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--el-text-color-primary);
  cursor: pointer;
}
.cat-item:hover {
  background: var(--el-fill-color-lighter);
}
.cat-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.cat-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.cat-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-num {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.cat-item.active .cat-num {
  color: var(--el-color-primary);
  font-weight: 600;
}
.cat-edit,
.cat-del {
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 3px;
  font-size: 12px;
  color: var(--el-text-color-disabled);
  opacity: 0;
}
.cat-item:hover .cat-edit,
.cat-item:hover .cat-del {
  opacity: 1;
}
.cat-edit:hover {
  background: var(--el-fill-color-dark);
  color: var(--el-color-primary);
}
.cat-del:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.table-pane {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}
.proj-table :deep(.el-table__cell) {
  padding: 9px 0;
}
.proj-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
.proj-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-name.missing {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
.missing-tag {
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 400;
  font-family: inherit;
}

.fill-chips {
  display: flex;
  gap: 4px;
}
.fill-chip {
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-text-color-disabled);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
}
.fill-chip.has {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-weight: 600;
}
.fill-chip:hover {
  border-color: var(--el-color-primary-light-5);
}

.enable-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.table-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.foot-total {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.foot-total b {
  color: var(--el-text-color-primary);
}

.muted {
  color: var(--el-text-color-disabled);
}
.repo-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}
.repo-link {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-color-primary);
  cursor: pointer;
}
.repo-link:hover {
  text-decoration: underline;
}
.repo-state {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 4px;
  line-height: 18px;
}
.repo-state.is-ok {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}
.repo-state.is-none {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}
.tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

/* ---------- 编辑项目抽屉 ---------- */
.pj-head { display: flex; align-items: flex-start; gap: 12px; }
.pj-head-main { flex: 1; min-width: 0; }
.pj-title { font-size: 18px; font-weight: 600; color: var(--el-text-color-primary); }
.pj-sub { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); }
.pj-chip {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
}
.pj-close {
  border: 0;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.pj-close:hover { color: var(--el-text-color-primary); }

.pj-form :deep(.el-form-item) { margin-bottom: 16px; }
.pj-form :deep(.el-form-item__label) { color: var(--el-text-color-regular); }
.pj-form :deep(.el-input__wrapper),
.pj-form :deep(.el-textarea__inner),
.pj-form :deep(.el-select__wrapper) { min-height: 36px; border-radius: 8px; }
.pj-mono :deep(input) { font-family: ui-monospace, Menlo, monospace; font-size: 13px; }

.pj-sec { display: flex; align-items: center; gap: 10px; margin: 22px 0 14px; }
.pj-form > .pj-sec:first-child { margin-top: 0; }
.pj-sec-title {
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 14px;
  color: var(--el-text-color-primary);
}
.pj-sec-line { flex: 1; height: 1px; background: var(--el-border-color-lighter); }
.pj-sec-hint { font-size: 12px; color: var(--el-text-color-placeholder); }

.pj-code {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.pj-code-val {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
}
.pj-lock {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.pj-name { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.pj-card {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  overflow: hidden;
}
.pj-card-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 0;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  text-align: left;
}
.pj-caret { color: var(--el-text-color-secondary); transition: transform 0.15s; }
.pj-caret.open { transform: rotate(90deg); }
.pj-card-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); }
.pj-reco {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.pj-on { font-size: 12px; color: var(--el-color-success); font-family: ui-monospace, Menlo, monospace; }
.pj-card-body { padding: 14px 14px 0; border-top: 1px solid var(--el-border-color-lighter); }
.pj-rule { width: 100%; display: flex; align-items: flex-end; gap: 10px; }
.pj-rule-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.pj-rule-k { font-size: 12px; line-height: 1.2; color: var(--el-text-color-secondary); }
.pj-eq { padding-bottom: 8px; color: var(--el-text-color-secondary); }

.pj-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0 14px;
}
.pj-toggle .tip { margin-top: 2px; }
.pj-toggle-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.pj-sort-hint { margin-left: 12px; font-size: 12px; color: var(--el-text-color-placeholder); }

.pj-foot { display: flex; align-items: center; gap: 8px; }
.pj-foot-hint { flex: 1; text-align: left; font-size: 12px; color: var(--el-text-color-placeholder); }
</style>

<style>
.pj-drawer .el-drawer__header {
  margin-bottom: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.pj-drawer .el-drawer__body { padding: 20px 24px; }
.pj-drawer .el-drawer__footer {
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
