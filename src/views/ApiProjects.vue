<template>
  <div class="api-projects">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">项目管理</span>
            <p class="sub">
              按分类维护项目编码，可从常用分类选择或直接输入新分类。URL 管理、接口测试均从这里选择归属项目。
            </p>
          </div>
          <el-button type="primary" @click="openCreate">新建项目</el-button>
        </div>
      </template>

      <div class="layout" v-loading="loading">
        <aside class="tree-pane">
          <div class="side-nav-head">
            <span class="side-nav-title">分类</span>
            <el-button link type="primary" size="small" @click="openAddCategory">+ 添加分类</el-button>
          </div>
          <div class="side-nav">
            <div v-for="cat in categories" :key="cat.key" class="side-cat-block">
              <button
                type="button"
                class="side-cat"
                :class="{
                  active: selectedCategoryKey === cat.key && !selectedProjectCode,
                  expanded: !isCatCollapsed(cat.key)
                }"
                @click="toggleCategory(cat.key)"
              >
                <span class="side-caret">{{ isCatCollapsed(cat.key) ? '▸' : '▾' }}</span>
                <span class="side-cat-label">{{ cat.label }}</span>
                <span class="side-cat-num">{{ cat.count ?? cat.projects.length }}</span>
                <span
                  class="side-cat-edit"
                  title="重命名"
                  @click.stop="openRenameCategory(cat)"
                >✎</span>
                <span
                  v-if="cat.custom && (cat.count ?? 0) === 0"
                  class="side-cat-del"
                  title="删除空分类"
                  @click.stop="removeCategory(cat)"
                >×</span>
              </button>

              <div v-show="!isCatCollapsed(cat.key)" class="side-cat-children">
                <button
                  v-if="selectedProjectCode && selectedCategoryKey === cat.key"
                  type="button"
                  class="side-back-btn"
                  @click="clearProjectFilter"
                >
                  ← 全部
                </button>
                <button
                  v-for="p in pagedProjectsOf(cat)"
                  :key="p.code"
                  type="button"
                  class="side-proj"
                  :class="{ active: selectedProjectCode === p.code, missing: p.missing }"
                  @click="selectProject(p, cat.key)"
                >
                  {{ p.missing ? p.code : p.name || p.code }}
                </button>
                <div
                  v-if="selectedCategoryKey === cat.key && cat.projects.length > pageSize"
                  class="side-pagination"
                >
                  <el-pagination
                    v-model:current-page="currentPage"
                    v-model:page-size="pageSize"
                    :total="cat.projects.length"
                    :page-sizes="[10, 15, 20]"
                    layout="prev, pager, next"
                    small
                    background
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main class="table-pane">
          <div v-if="selectedCategory" class="pane-head">
            <h3>{{ selectedCategory.label }}</h3>
            <span class="muted">共 {{ tableRows.length }} 项</span>
          </div>

          <el-table :data="pagedTableRows" size="small" border stripe highlight-current-row>
            <el-table-column prop="code" label="编码" width="180">
              <template #default="{ row }">
                <span :class="{ 'text-muted': row.missing }">{{ row.code }}</span>
                <el-tag v-if="row.missing" size="small" type="info" effect="plain" class="ml-6">未建</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" min-width="180" />
            <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
            <el-table-column label="启用" width="70">
              <template #default="{ row }">
                <el-tag v-if="!row.missing" size="small" :type="row.enabled ? 'success' : 'info'">
                  {{ row.enabled ? '是' : '否' }}
                </el-tag>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="业务成功码" width="150">
              <template #default="{ row }">
                <code v-if="row.successCodePath">{{ row.successCodePath }} == {{ row.successCodeValue }}</code>
                <el-tooltip v-else-if="!row.missing" content="没配的话，用例只断言 HTTP 200" placement="top">
                  <el-tag size="small" type="warning" effect="plain">未配</el-tag>
                </el-tooltip>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="70" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <template v-if="row.missing">
                  <el-button size="small" link type="primary" @click="openCreateWithCode(row.code)">创建</el-button>
                </template>
                <template v-else>
                  <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
                  <el-button v-perm:delete size="small" link type="danger" @click="remove(row)">删</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="tableRows.length > pageSize" class="pagination-wrap">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="tableRows.length"
              :page-sizes="[10, 15, 20]"
              layout="total, sizes, prev, pager, next"
              small
              background
            />
          </div>
        </main>
      </div>
    </el-card>

    <el-drawer
      v-model="drawer"
      :title="form.code && !creating ? '编辑项目' : '新建项目'"
      size="460px"
      destroy-on-close
    >
      <el-form label-width="90px" size="small">
        <el-form-item label="分类" required>
          <el-select
            v-model="form.category"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="选择或输入新分类"
            style="width: 100%"
            @change="categoryTouched = true"
          >
            <el-option v-for="opt in categoryOptions" :key="opt.key" :label="opt.label" :value="opt.key" />
          </el-select>
          <div class="tip">
            可直接输入新分类名称（回车确认）。内置 APP / PVP / WEB / 其他 仍可用；编码推断仅作新建时的默认值。
          </div>
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input
            v-model="form.code"
            :disabled="!creating"
            placeholder="如 app-seckill（创建后不可改）"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="展示名称" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="业务成功码">
          <div class="biz-code-row">
            <el-input v-model="form.successCodePath" placeholder="$.code" style="width: 140px" />
            <span class="eq">==</span>
            <el-input v-model="form.successCodeValue" placeholder="0" style="width: 100px" />
          </div>
          <div class="tip">
            配上之后，执行时会给每条用例<strong>自动追加</strong>这条断言。
            业务失败也是 HTTP 200 —— 只断言 status=200 的用例会误判通过。
          </div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawer = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

type ProjectRow = {
  code: string
  name: string
  description?: string
  enabled?: boolean
  sortOrder?: number
  successCodePath?: string
  successCodeValue?: string
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

const categoryOptions = computed(() =>
  categories.value.map((cat) => ({ key: cat.key, label: cat.label || cat.key }))
)

const PVP_CODES = new Set([
  'android-domestic-esports',
  'ios-domestic-esports',
  'harmonyos-domestic-esports',
  'android-overseas-pogpog',
  'ios-overseas-pogpog'
])

const WEB_CODES = new Set([
  'app-steam-web',
  'steam-web',
  'steam-admin',
  'pogpog-h5',
  'overseas_service_host_and_tool_url'
])

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
const selectedProjectCode = ref<string | null>(null)
const expandedCats = ref<Record<string, boolean>>({})
const currentPage = ref(1)
const pageSize = ref(10)

const form = reactive({
  code: '',
  name: '',
  description: '',
  category: 'APP',
  successCodePath: '',
  successCodeValue: '',
  enabled: true,
  sortOrder: 100
})

const categoryTouched = ref(false)

const selectedCategory = computed(() =>
  categories.value.find((c) => c.key === selectedCategoryKey.value) ?? null
)

const categoryProjects = computed(() => selectedCategory.value?.projects ?? [])

function isCatCollapsed(key: string) {
  return expandedCats.value[key] !== false
}

function pagedProjectsOf(cat: CategoryVo) {
  if (cat.key !== selectedCategoryKey.value) {
    return cat.projects
  }
  const start = (currentPage.value - 1) * pageSize.value
  return cat.projects.slice(start, start + pageSize.value)
}

const tableRows = computed(() => {
  const cat = selectedCategory.value
  if (!cat) return []
  if (selectedProjectCode.value) {
    const hit = cat.projects.find((p) => p.code === selectedProjectCode.value)
    return hit ? [hit] : cat.projects.filter((p) => !p.missing)
  }
  return cat.projects
})

const pagedTableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return tableRows.value.slice(start, start + pageSize.value)
})

watch([categoryProjects, pageSize], () => {
  const maxPage = Math.max(1, Math.ceil(categoryProjects.value.length / pageSize.value) || 1)
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

function inferCategory(code: string): string {
  const lower = String(code || '').trim().toLowerCase()
  if (!lower) return 'APP'
  if (PVP_CODES.has(lower)) return 'PVP'
  if (WEB_CODES.has(lower)) return 'WEB'
  if (lower.startsWith('debug-') || lower.startsWith('auth-')) return 'OTHER'
  if (lower.startsWith('app-') || lower.startsWith('app_')) return 'APP'
  if (lower.includes('esports') && (lower.includes('android') || lower.includes('ios'))) return 'PVP'
  return 'OTHER'
}

watch(
  () => form.code,
  (code) => {
    if (!creating.value || categoryTouched.value) return
    form.category = inferCategory(code)
  }
)

async function load() {
  loading.value = true
  try {
    const data = await apiClient.getApiProjectsTree()
    categories.value = data.categories ?? []
    if (!categories.value.some((c) => c.key === selectedCategoryKey.value)) {
      selectedCategoryKey.value = categories.value[0]?.key ?? 'APP'
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
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
      if (created?.key) {
        selectedCategoryKey.value = created.key
        expandedCats.value = { ...expandedCats.value, [created.key]: true }
      }
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

function toggleCategory(key: string) {
  if (expandedCats.value[key] === false) {
    expandedCats.value = { ...expandedCats.value, [key]: true }
    return
  }
  const next: Record<string, boolean> = {}
  for (const cat of categories.value) {
    next[cat.key] = cat.key !== key
  }
  expandedCats.value = next
  selectedCategoryKey.value = key
  selectedProjectCode.value = null
  currentPage.value = 1
}

function selectProject(p: ProjectRow, catKey: string) {
  selectedCategoryKey.value = catKey
  selectedProjectCode.value = p.code
  const next: Record<string, boolean> = {}
  for (const cat of categories.value) {
    next[cat.key] = cat.key !== catKey
  }
  expandedCats.value = next
}

function clearProjectFilter() {
  selectedProjectCode.value = null
}

function openCreate() {
  creating.value = true
  categoryTouched.value = false
  form.code = ''
  form.name = ''
  form.description = ''
  form.category = 'APP'
  form.successCodePath = ''
  form.successCodeValue = ''
  form.enabled = true
  form.sortOrder = 100
  drawer.value = true
}

function openCreateWithCode(code: string) {
  creating.value = true
  categoryTouched.value = false
  form.code = code
  form.name = code
  form.description = ''
  form.category = inferCategory(code)
  form.successCodePath = ''
  form.successCodeValue = ''
  form.enabled = true
  form.sortOrder = 100
  drawer.value = true
}

function openEdit(row: ProjectRow) {
  creating.value = false
  categoryTouched.value = true
  form.code = row.code
  form.name = row.name
  form.description = row.description || ''
  form.category = row.category || inferCategory(row.code)
  form.successCodePath = row.successCodePath || ''
  form.successCodeValue = row.successCodeValue || ''
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  drawer.value = true
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
      name: form.name.trim(),
      description: form.description,
      category: String(form.category).trim(),
      successCodePath: form.successCodePath.trim(),
      successCodeValue: form.successCodeValue.trim(),
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
  await ElMessageBox.confirm(
    `删除项目「${row.name}」？不会自动删除其下 URL/用例，但之后无法再选此编码。`,
    '确认',
    { type: 'warning' }
  )
  await apiClient.deleteApiProject(row.code)
  ElMessage.success('已删除')
  selectedProjectCode.value = null
  await load()
}

onMounted(load)
</script>

<style scoped>
.layout {
  display: flex;
  gap: 16px;
  min-height: 420px;
}
.tree-pane {
  width: 240px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 8px;
  max-height: calc(100vh - 220px);
  overflow: hidden;
}
.side-nav-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 6px;
  flex-shrink: 0;
}
.side-nav-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.side-nav {
  height: calc(100% - 36px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.side-cat-block {
  flex-shrink: 0;
}
.side-cats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.side-cat {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  color: var(--el-text-color-primary);
}
.side-caret {
  width: 12px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.side-cat-children {
  padding: 2px 0 6px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.side-cat:hover {
  background: var(--el-fill-color-light);
}
.side-cat.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.side-cat-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-cat-num {
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}
.side-cat-edit {
  margin-left: 4px;
  width: 16px;
  height: 16px;
  line-height: 14px;
  text-align: center;
  border-radius: 3px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  opacity: 0;
}
.side-cat:hover .side-cat-edit {
  opacity: 1;
}
.side-cat-edit:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}
.side-cat-del {
  margin-left: 4px;
  width: 16px;
  height: 16px;
  line-height: 14px;
  text-align: center;
  border-radius: 3px;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.side-cat-del:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.side-back-btn {
  padding: 4px 8px;
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.side-proj {
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  text-align: left;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-proj:hover {
  background: var(--el-fill-color-light);
}
.side-proj.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.side-proj.missing {
  color: var(--el-text-color-secondary);
}
.side-pagination {
  display: flex;
  justify-content: center;
  padding-top: 6px;
}
.side-pagination :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: center;
}
.table-pane {
  flex: 1;
  min-width: 0;
}
.pane-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.pane-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.text-muted {
  color: var(--el-text-color-secondary);
}
.ml-6 {
  margin-left: 6px;
}
.biz-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.eq {
  color: var(--el-text-color-secondary);
}
.tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.tip-inline {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
