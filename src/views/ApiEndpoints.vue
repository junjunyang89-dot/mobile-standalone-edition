<template>
  <div class="api-endpoints">
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="card-head">
          <span>接口清单</span>
          <span class="head-sub">
            这里回答「有哪些接口、覆盖到没有」；「这个接口对不对」是用例的事
          </span>
        </div>
      </template>

      <div class="ep-layout">
        <aside class="ep-sidebar" v-loading="treeLoading">
          <div v-for="cat in tree" :key="cat.key" class="ep-cat">
            <div class="ep-cat-head" @click="toggleCat(cat.key)">
              <span class="ep-caret">{{ isCatCollapsed(cat.key) ? '▸' : '▾' }}</span>
              <span class="ep-cat-name">{{ cat.label }}</span>
              <span class="ep-cat-num">{{ cat.total }}</span>
              <span v-if="cat.pending > 0" class="ep-pending">{{ cat.pending }} 没在验</span>
            </div>
            <div v-show="!isCatCollapsed(cat.key)">
              <div
                v-for="p in pagedProjects(cat)"
                :key="p.project"
                class="ep-proj-block"
              >
                <div
                  class="ep-proj"
                  :class="{
                    active: project === p.project && !railType,
                    'is-empty': !p.total,
                    'is-missing': p.missing
                  }"
                  @click="pickProject(p.project)"
                >
                  <span class="ep-proj-name">{{ p.label || p.project }}</span>
                  <span class="ep-proj-num">{{ p.total }}</span>
                  <span v-if="p.pending > 0" class="ep-pending">{{ p.pending }}</span>
                </div>
                <div v-if="project === p.project && p.rails?.length" class="ep-rails">
                  <div v-for="rail in p.rails" :key="(rail.type || '') + (rail.branch || '')">
                    <div
                      class="ep-rail"
                      :class="{ active: railType === rail.type && railBranch === (rail.branch || '') }"
                      @click.stop="pickRail(p.project, rail)"
                    >
                      {{ rail.label }}
                      <span class="ep-rail-num">{{ rail.total }}</span>
                    </div>
                    <div
                      v-for="ctl in rail.controllers || []"
                      :key="ctl.name"
                      class="ep-ctl"
                      :class="{ active: controllerFilter === ctl.name && railType === rail.type }"
                      @click.stop="pickController(p.project, rail, ctl.name)"
                    >
                      {{ ctl.name }}
                      <span class="ep-rail-num">{{ ctl.total }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="projectPages(cat) > 1" class="ep-proj-pagination">
                <el-pagination
                  small
                  layout="prev, pager, next"
                  :total="(cat.children || []).length"
                  :page-size="projPageSize"
                  :current-page="projPageOf(cat.key)"
                  @current-change="(p: number) => setProjPage(cat.key, p)"
                />
              </div>
            </div>
          </div>
        </aside>

        <section class="ep-main">
          <button
            v-if="weakCount > 0 && !statusFilter"
            type="button"
            class="weak-tip"
            @click="pick('WEAK_COVERED')"
          >
            <el-icon><WarningFilled /></el-icon>
            有 {{ weakCount }} 个接口「有用例，但没有一条在真正验东西」——点这里筛选
          </button>

          <div class="status-chips">
            <button
              type="button"
              class="chip"
              :class="{ active: todoOnly, actionable: true }"
              @click="toggleTodoOnly"
            >
              只看待办
              <span class="chip-num">{{ todoCount }}</span>
            </button>
            <button
              v-for="s in statuses"
              :key="s.code"
              type="button"
              class="chip"
              :class="{ active: statusFilter === s.code, actionable: s.actionable }"
              @click="pick(s.code)"
            >
              {{ s.label }}
              <span class="chip-num">{{ counts[s.code] ?? 0 }}</span>
            </button>
          </div>

          <div class="filters">
            <el-select v-model="project" placeholder="项目" style="width: 200px" @change="onProjectChange">
              <el-option v-for="p in projects" :key="p.code" :label="p.name || p.code" :value="p.code" />
            </el-select>
            <el-input
              v-model="keyword"
              placeholder="路径 / Controller / 说明"
              clearable
              style="width: 260px"
              @keyup.enter="load"
              @clear="load"
            />
            <el-button type="primary" :loading="loading" @click="load">查询</el-button>
            <el-button plain @click="openImportDoc">导入文档（参考）</el-button>
            <el-button
              v-if="requirementNo && batchMissingCount > 0"
              type="success"
              :loading="batchGenerating"
              @click="generateAllMissing"
            >
              批量生成 {{ batchMissingCount }} 条
            </el-button>
          </div>

          <el-alert
            v-if="requirementNo"
            type="info"
            :closable="false"
            show-icon
            class="req-banner"
          >
            <template #title>
              为 <b>{{ requirementNo }}</b> 生成接口用例
              <span v-if="targetCollectionName"> · 归入集合「{{ targetCollectionName }}」</span>
            </template>
            <div class="req-banner-body">
              下面只显示这个需求涉及的 {{ reqPathKeys.size }} 个接口。点「生成用例」后会自动挂进所选集合。
              <el-button v-if="targetCollectionId" link type="primary" @click="openCollection">
                看集合用例
              </el-button>
            </div>
          </el-alert>

          <el-table :data="pagedTableRows" v-loading="loading" size="small" style="width: 100%">
            <el-table-column label="方法" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="methodTag(row.httpMethod)">{{ row.httpMethod }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" min-width="280" show-overflow-tooltip />
            <el-table-column prop="handler" label="Controller" width="180" show-overflow-tooltip />
            <el-table-column label="涉及的表" min-width="160">
              <template #default="{ row }">
                <el-tag
                  v-for="t in parseTables(row.tablesJson)"
                  :key="t"
                  size="small"
                  effect="plain"
                  style="margin: 1px 3px 1px 0"
                >{{ t }}</el-tag>
                <span v-if="!parseTables(row.tablesJson).length" class="text-faint">—</span>
              </template>
            </el-table-column>
            <el-table-column label="覆盖" width="120">
              <template #default="{ row }">
                <span :class="row.actionable ? 'text-warn' : ''">{{ row.statusLabel }}</span>
              </template>
            </el-table-column>
            <el-table-column label="用例" width="72" align="center">
              <template #default="{ row }">{{ row.caseCount ?? 0 }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openCases(row)">看用例</el-button>
                <el-button
                  v-if="row.caseCount > 0"
                  link
                  type="warning"
                  @click="openReadiness(row)"
                >
                  还差什么
                </el-button>
                <el-button
                  link
                  type="success"
                  :loading="generatingId === row.id"
                  :disabled="row.statusCode === 'DEPRECATED'"
                  @click="generate(row)"
                >
                  生成用例
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="tableRows.length > pageSize" class="pagination-wrap">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="tableRows.length"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              small
              background
            />
          </div>

          <el-empty
            v-if="!loading && !tableRows.length"
            :description="
              requirementNo
                ? '涉及接口还没进清单，先跑接口对比分析或从需求单抓包补上'
                : statusFilter
                  ? '这一档下没有接口'
                  : '这个项目还没有接口清单'
            "
          />
        </section>
      </div>
    </el-card>

    <el-dialog v-model="importVisible" title="导入接口文档（仅参考）" width="640px">
      <p class="import-hint">
        各开发文档格式不一，也不能默认和线上一致——<b>导入后只供查阅</b>，不会据此生成字段断言。
      </p>
      <el-input
        v-model="importContent"
        type="textarea"
        :rows="14"
        placeholder='{"openapi":"3.0.0","paths":{...}}'
      />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImportDoc">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="readyVisible" :title="readyTitle" width="640px">
      <div v-loading="readyLoading">
        <el-empty v-if="!readyCases.length" description="这个接口下还没有用例" />
        <div v-for="c in readyCases" :key="c.id" class="ready-item" :class="{ highlight: c.id === focusCaseId }">
          <div class="ready-head">
            <el-tag size="small" :type="c.enabled ? 'success' : 'info'">{{ c.enabled ? '已启用' : '已停用' }}</el-tag>
            <span class="ready-name">{{ c.name }}</span>
          </div>
          <ul v-if="c.todos?.length" class="ready-todos">
            <li v-for="(t, i) in c.todos" :key="i">{{ t }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="readyVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { apiClient, type ApiEndpointVo } from '../api'

type EpRail = {
  type: string
  label: string
  branch?: string | null
  total: number
  controllers?: Array<{ name: string; total: number }>
}

type CatNode = {
  key: string
  label: string
  total: number
  pending?: number
  children?: Array<{
    project: string
    label?: string
    total: number
    pending?: number
    missing?: boolean
    rails?: EpRail[]
  }>
}

const router = useRouter()
const route = useRoute()

const allRows = ref<ApiEndpointVo[]>([])
const projects = ref<Array<{ code: string; name?: string }>>([])
const statuses = ref<Array<{ code: string; label: string; hint: string; actionable: boolean }>>([])
const counts = ref<Record<string, number>>({})
const tree = ref<CatNode[]>([])
const treeLoading = ref(false)
const loading = ref(false)
const batchGenerating = ref(false)
const generatingId = ref('')

const requirementNo = computed(() => String(route.query.requirementNo || '').trim())
const targetCollectionId = computed(() => String(route.query.collectionId || '').trim())
const targetCollectionName = ref('')
const reqPathKeys = ref(new Set<string>())

const project = ref(
  typeof route.query.project === 'string' && route.query.project ? route.query.project : 'app-data-center'
)
const keyword = ref('')
const statusFilter = ref('')
const todoOnly = ref(false)
const railType = ref('')
const railBranch = ref('')
const controllerFilter = ref('')
const focusCaseId = computed(() => String(route.query.caseId || '').trim())
const currentPage = ref(1)
const pageSize = ref(20)

const expandedCat = ref<string | null>(null)
const projPageByCat = ref<Record<string, number>>({})
const projPageSize = 10

const actionableCodes = computed(() => new Set(statuses.value.filter((s) => s.actionable).map((s) => s.code)))

const todoCount = computed(() =>
  allRows.value.filter((r) => r.actionable || actionableCodes.value.has(r.statusCode)).length
)

function controllerName(handler?: string) {
  if (!handler) return '未标注 Controller'
  let h = handler.trim()
  const slash = h.lastIndexOf('/')
  if (slash >= 0) h = h.slice(slash + 1)
  const dot = h.indexOf('.')
  return dot > 0 ? h.slice(0, dot) : h
}

const visibleRows = computed(() => {
  let rows = allRows.value
  if (railType.value === 'branch') {
    rows = rows.filter((r) => {
      const b = String((r as any).sourceBranch || '').trim()
      return b && (!railBranch.value || b === railBranch.value)
    })
  } else if (railType.value === 'master') {
    rows = rows.filter((r) => !String((r as any).sourceBranch || '').trim())
  }
  if (controllerFilter.value) {
    rows = rows.filter((r) => controllerName((r as any).handler) === controllerFilter.value)
  }
  if (statusFilter.value) return rows.filter((r) => r.statusCode === statusFilter.value)
  if (todoOnly.value) {
    return rows.filter((r) => r.actionable || actionableCodes.value.has(r.statusCode))
  }
  return rows
})

const tableRows = computed(() => {
  if (!requirementNo.value || reqPathKeys.value.size === 0) return visibleRows.value
  return visibleRows.value.filter((r) => reqPathKeys.value.has(epKey(r.httpMethod, r.path)))
})

const pagedTableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return tableRows.value.slice(start, start + pageSize.value)
})

const batchMissingCount = computed(() =>
  tableRows.value.filter((r) => r.statusCode !== 'DEPRECATED' && (r.caseCount ?? 0) === 0).length
)

const weakCount = computed(() => counts.value.WEAK_COVERED ?? 0)

function epKey(method?: string, path?: string) {
  return `${String(method || '').toUpperCase()}:${String(path || '').trim()}`
}

function methodTag(method: string) {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'warning'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

function isCatCollapsed(key: string) {
  return expandedCat.value !== key
}

function toggleCat(key: string) {
  expandedCat.value = expandedCat.value === key ? null : key
  if (expandedCat.value === key) {
    projPageByCat.value[key] = 1
  }
}

function projPageOf(catKey: string) {
  return projPageByCat.value[catKey] || 1
}

function setProjPage(catKey: string, page: number) {
  projPageByCat.value = { ...projPageByCat.value, [catKey]: page }
}

function projectPages(cat: CatNode) {
  return Math.ceil((cat.children || []).length / projPageSize) || 1
}

function pagedProjects(cat: CatNode) {
  const list = cat.children || []
  const page = projPageOf(cat.key)
  const start = (page - 1) * projPageSize
  return list.slice(start, start + projPageSize)
}

function pick(code: string) {
  todoOnly.value = false
  statusFilter.value = statusFilter.value === code ? '' : code
  currentPage.value = 1
}

function toggleTodoOnly() {
  todoOnly.value = !todoOnly.value
  statusFilter.value = ''
  currentPage.value = 1
}

function pickProject(code: string) {
  project.value = code
  railType.value = ''
  railBranch.value = ''
  controllerFilter.value = ''
  onProjectChange()
}

function pickRail(code: string, rail: EpRail) {
  const needLoad = project.value !== code
  project.value = code
  railType.value = rail.type
  railBranch.value = rail.branch || ''
  controllerFilter.value = ''
  if (needLoad) onProjectChange()
}

function pickController(code: string, rail: EpRail, name: string) {
  pickRail(code, rail)
  controllerFilter.value = name
}

async function loadTree() {
  treeLoading.value = true
  try {
    const r = await apiClient.fetchApiEndpointTree()
    tree.value = r.categories || []
    syncProjectsFromTree()
  } catch {
    tree.value = []
    projects.value = []
  } finally {
    treeLoading.value = false
  }
}

function syncProjectsFromTree() {
  const list: Array<{ code: string; name?: string }> = []
  for (const cat of tree.value) {
    for (const p of cat.children || []) {
      list.push({ code: p.project, name: p.label || p.project })
    }
  }
  projects.value = list
  if (list.length && !list.some((p) => p.code === project.value)) {
    const withData = list.find((p) => {
      const node = tree.value.flatMap((c) => c.children || []).find((n) => n.project === p.code)
      return (node?.total ?? 0) > 0
    })
    project.value = withData?.code || list[0].code
  }
}

function onProjectChange() {
  currentPage.value = 1
  load()
  if (requirementNo.value) loadReqContext()
}

async function load() {
  loading.value = true
  currentPage.value = 1
  try {
    const res = await apiClient.fetchApiEndpoints({
      project: project.value,
      keyword: keyword.value.trim() || undefined
    })
    allRows.value = res.items
    counts.value = res.counts || {}
    await openFromQuery()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function openFromQuery() {
  const id = String(route.query.endpointId || '').trim()
  if (!id) return
  const row = allRows.value.find((r) => r.id === id)
  if (row) await openReadiness(row)
}

async function assignToCollection(caseId?: string) {
  if (!targetCollectionId.value || !caseId) return
  try {
    await apiClient.assignApiTestCases(targetCollectionId.value, [caseId])
  } catch (e: any) {
    ElMessage.warning(e?.message || '用例已生成，但归入集合失败，请在用例列表手动拖入')
  }
}

async function generate(row: ApiEndpointVo) {
  generatingId.value = row.id
  try {
    const res = await apiClient.generateCaseFromEndpoint(row.id)
    await assignToCollection(res.case?.id)
    ElMessageBox.alert(res.note, res.enabled ? '已生成并启用' : '已生成，但是停用状态', {
      confirmButtonText: '知道了',
      type: res.enabled ? 'success' : 'warning'
    })
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generatingId.value = ''
  }
}

async function generateAllMissing() {
  const rows = tableRows.value.filter((r) => r.statusCode !== 'DEPRECATED' && (r.caseCount ?? 0) === 0)
  if (!rows.length) return
  batchGenerating.value = true
  let ok = 0
  let skipped = 0
  try {
    for (const row of rows) {
      try {
        const res = await apiClient.generateCaseFromEndpoint(row.id)
        await assignToCollection(res.case?.id)
        ok += 1
        if (!res.enabled) skipped += 1
      } catch {
        /* 单条失败不挡后面的 */
      }
    }
    await load()
    ElMessage.success(
      skipped
        ? `已生成 ${ok} 条（其中 ${skipped} 条为停用，需补断言后再启用）`
        : `已生成 ${ok} 条并归入集合`
    )
  } finally {
    batchGenerating.value = false
  }
}

function openCollection() {
  const q: Record<string, string> = {}
  if (project.value) q.project = project.value
  if (requirementNo.value) q.requirementNo = requirementNo.value
  router.push({ path: '/api-collections', query: q })
}

function parseTables(json: string | null | undefined): string[] {
  if (!json) return []
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : [] } catch { return [] }
}

function openCases(row: ApiEndpointVo) {
  router.push({ path: '/api-collections', query: { project: row.project } })
}

const readyVisible = ref(false)
const readyLoading = ref(false)
const readyTitle = ref('')
const readyCases = ref<any[]>([])

async function openReadiness(row: ApiEndpointVo) {
  readyVisible.value = true
  readyLoading.value = true
  readyTitle.value = `${row.httpMethod} ${row.path} · 还差什么`
  readyCases.value = []
  try {
    const d = await apiClient.getApiEndpointDetail(row.id)
    readyCases.value = d.cases || []
  } catch (e: any) {
    ElMessage.error(e?.message || '读取失败')
  } finally {
    readyLoading.value = false
  }
}

async function loadReqContext() {
  reqPathKeys.value = new Set()
  targetCollectionName.value = ''
  if (!requirementNo.value) return
  try {
    const eps = await apiClient.fetchRequirementEndpoints(requirementNo.value)
    reqPathKeys.value = new Set(eps.map((e) => epKey(e.httpMethod, e.path)))
  } catch {
    reqPathKeys.value = new Set()
  }
  if (targetCollectionId.value) {
    try {
      const cols = await apiClient.getApiTestCollections({ project: project.value })
      targetCollectionName.value =
        cols.find((c) => c.id === targetCollectionId.value)?.name || targetCollectionId.value
    } catch {
      targetCollectionName.value = targetCollectionId.value
    }
  }
}

const importVisible = ref(false)
const importContent = ref('')
const importing = ref(false)

function openImportDoc() {
  importContent.value = ''
  importVisible.value = true
}

async function submitImportDoc() {
  const content = importContent.value.trim()
  if (!content) {
    ElMessage.warning('先粘贴 OpenAPI JSON')
    return
  }
  importing.value = true
  try {
    const r = await apiClient.importOpenApi(project.value, content)
    importVisible.value = false
    await load()
    const warn = r.warnings?.length ? `（${r.warnings.length} 条警告）` : ''
    ElMessage.success(`已导入 ${r.imported} 个接口${warn}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  try {
    const statusList = await apiClient.fetchApiEndpointStatuses()
    statuses.value = statusList
    await loadTree()
  } catch {
    /* 项目列表拿不到时仍然让页面能用 */
  }
  await loadReqContext()
  await load()
})

watch(
  () => route.query.requirementNo,
  async () => {
    currentPage.value = 1
    await loadReqContext()
    await load()
  }
)

watch(
  () => route.query.endpointId,
  async (id) => {
    if (!id || loading.value) return
    await openFromQuery()
  }
)

watch([tableRows, pageSize], () => {
  const maxPage = Math.max(1, Math.ceil(tableRows.value.length / pageSize.value) || 1)
  if (currentPage.value > maxPage) currentPage.value = maxPage
})
</script>

<style scoped>
.api-endpoints {
  max-width: 100%;
}

.main-card {
  border: none;
}

.card-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-head > span:first-child {
  font-size: 16px;
  font-weight: 600;
}

.head-sub {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: normal;
}

.ep-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  min-height: 480px;
}

.ep-sidebar {
  border-right: 1px solid #f0f0f0;
  padding-right: 8px;
  max-height: calc(100vh - 220px);
  overflow: auto;
}

.ep-cat {
  margin-bottom: 4px;
}

.ep-cat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 6px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.ep-cat-head:hover {
  background: #f5f5f5;
}

.ep-caret {
  width: 12px;
  color: #8c8c8c;
  flex-shrink: 0;
}

.ep-cat-name {
  flex: 1;
}

.ep-cat-num {
  color: #bfbfbf;
  font-size: 12px;
}

.ep-proj-block {
  margin-bottom: 2px;
}

.ep-rails {
  padding: 2px 0 8px 14px;
}

.ep-rail,
.ep-ctl {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 8px;
  font-size: 12px;
  color: #595959;
  cursor: pointer;
  border-radius: 4px;
}

.ep-rail {
  font-weight: 600;
  color: #ad2102;
}

.ep-rail.active,
.ep-ctl.active {
  background: #fff1f0;
  color: #cf1322;
}

.ep-ctl {
  padding-left: 16px;
  color: #8c8c8c;
}

.ep-rail-num {
  color: #bfbfbf;
}

.ep-proj {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 24px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #595959;
}

.ep-proj:hover {
  background: #f5f5f5;
}

.ep-proj.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.ep-proj.is-empty {
  opacity: 0.55;
}

.ep-proj.is-missing {
  font-style: italic;
}

.ep-proj-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ep-proj-num,
.ep-pending {
  flex-shrink: 0;
  font-size: 11px;
  color: #bfbfbf;
}

.ep-pending {
  color: #fa8c16;
}

.ep-proj-pagination {
  padding: 4px 0 8px 24px;
}

.ep-main {
  min-width: 0;
}

.weak-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid #ffe58f;
  border-radius: 6px;
  background: #fffbe6;
  color: #ad6800;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.chip.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.chip.actionable {
  border-color: #ffa940;
}

.chip-num {
  margin-left: 4px;
  color: #8c8c8c;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.req-banner {
  margin-bottom: 12px;
}

.req-banner-body {
  font-size: 12px;
  line-height: 1.5;
}

.text-warn {
  color: #fa8c16;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.import-hint {
  font-size: 13px;
  line-height: 1.7;
  color: #8c8c8c;
  margin: 0 0 12px;
}

.ready-item.highlight {
  background: #fff7e6;
  margin: 0 -12px;
  padding: 10px 12px;
  border-radius: 6px;
}

.ready-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.ready-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ready-todos {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #595959;
}

.text-faint{color:#c0c4cc}
</style>
