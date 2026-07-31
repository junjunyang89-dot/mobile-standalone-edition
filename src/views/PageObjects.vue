<template>
  <div class="page-objects">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="card-title">页面对象 · 元素库（旧）</span>
          <el-button type="primary" @click="openAddDialog">
            <el-icon><Plus /></el-icon>
            新增页面对象
          </el-button>
        </div>
      </template>

      <!-- 元素目录：自动化 / 线上回归 / 公共 -->
      <el-tabs v-model="filterCatalog" class="catalog-tabs" @tab-change="onCatalogChange">
        <el-tab-pane
          v-for="c in catalogTabs"
          :key="c.value"
          :label="c.label"
          :name="c.value" />
      </el-tabs>
      <p class="catalog-hint">{{ catalogHint }}</p>

      <!-- 筛选 -->
      <div class="filter-bar">
        <el-form :inline="true" class="filter-form">
          <el-form-item label="应用 ID">
            <el-input
              v-model="filterAppId"
              placeholder="输入应用 ID 筛选"
              clearable
              style="width: 220px"
              @keyup.enter="loadList" />
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filterPlatform" placeholder="选择平台" clearable style="width: 140px">
              <el-option label="Android" value="ANDROID" />
              <el-option label="iOS" value="IOS" />
              <el-option label="HarmonyOS" value="HARMONYOS" />
              <el-option label="Pog-Android" value="POG_ANDROID" />
              <el-option label="Pog-iOS" value="POG_IOS" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 按平台分组折叠展示 -->
      <div v-loading="loading" class="platform-group-wrap">
        <el-collapse v-model="activePlatformNames" class="platform-collapse">
          <el-collapse-item
            v-for="platform in platformOrder"
            :key="platform"
            :name="platform"
          >
            <template #title>
              <span class="platform-collapse-title">
                <el-tag size="small" :type="platformTagType(platform)">{{ platformLabel(platform) }}</el-tag>
                <span class="platform-count">（{{ listByPlatform[platform]?.length ?? 0 }} 个页面）</span>
              </span>
            </template>
            <el-table
              :data="listByPlatform[platform] || []"
              stripe
              style="width: 100%"
             :header-cell-style="{ background: 'var(--el-fill-color-light)' }"
              row-key="id"
              :expand-row-keys="expandedRowKeys"
              @expand-change="onExpandChange"
            >
              <el-table-column type="expand" width="48">
                <template #default="{ row }">
                  <div class="expand-elements">
                    <template v-if="expandingLoad[row.id]">
                      <div class="expand-loading"><el-icon class="is-loading"><Loading /></el-icon> 正在加载元素…</div>
                    </template>
                    <template v-else-if="getExpandGroupedList(row).length">
                      <div
                        v-for="group in getExpandGroupedList(row)"
                        :key="group.type"
                        class="expand-section"
                      >
                        <div class="expand-section-title">{{ selectorTypeLabel(group.type) }}</div>
                        <div class="expand-section-list">
                          <div
                            v-for="(el, idx) in group.items"
                            :key="`${group.type}-${el.key}-${idx}`"
                            class="expand-element-row"
                          >
                            <span class="expand-element-key">{{ el.key }}</span>
                            <span class="expand-element-selector" :title="el.selector">{{ el.selector }}</span>
                            <span v-if="el.description" class="expand-element-desc">{{ el.description }}</span>
                            <el-button
                              type="danger"
                              link
                              size="small"
                              class="expand-element-delete"
                              @click="deleteElementFromExpand(row, el.key)"
                            >
                              删除
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </template>
                    <el-empty v-else description="该页面暂无元素" :image-size="48" />
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="pagePath" label="页面标识" min-width="120" />
              <el-table-column prop="name" label="页面名称" min-width="120">
                <template #default="{ row }">
                  {{ row.name || row.pagePath || '—' }}
                </template>
              </el-table-column>
              <el-table-column label="目录" width="110" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="catalogTagType(row.catalog)">{{ catalogLabel(row.catalog) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="appId" label="应用 ID" min-width="140" show-overflow-tooltip />
              <el-table-column label="元素数量" width="100" align="center">
                <template #default="{ row }">
                  <el-tag type="info" size="small">{{ row.elementCount ?? elementCount(row.elements) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="updatedAt" label="更新时间" width="170">
                <template #default="{ row }">
                  {{ formatTime(row.updatedAt) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="toggleExpandRow(row)">
                    {{ expandedRowKeys.includes(row.id) ? '收起元素' : '查看元素' }}
                  </el-button>
                  <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
                  <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty
              v-if="(listByPlatform[platform]?.length ?? 0) === 0 && !loading"
              description="该平台下暂无页面对象"
              :image-size="60" />
          </el-collapse-item>
        </el-collapse>
        <el-empty v-if="!loading && list.length === 0" description="暂无数据，可先选择应用与平台查询或新增页面对象" />
      </div>
    </el-card>

    <!-- 新增对话框 -->
    <el-dialog
      v-model="addVisible"
      title="新增页面对象"
      width="520px"
      class="page-dialog"
      destroy-on-close
      @close="resetAddForm"
    >
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="100px">
        <el-form-item label="元素目录" prop="catalog">
          <el-select v-model="addForm.catalog" style="width: 100%">
            <el-option
              v-for="c in catalogTabs"
              :key="c.value"
              :label="c.label"
              :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="应用 ID" prop="appId">
          <el-input v-model="addForm.appId" placeholder="必填" />
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-select v-model="addForm.platform" placeholder="请选择" style="width: 100%">
            <el-option label="Android" value="ANDROID" />
            <el-option label="iOS" value="IOS" />
            <el-option label="HarmonyOS" value="HARMONYOS" />
            <el-option label="Pog-Android" value="POG_ANDROID" />
            <el-option label="Pog-iOS" value="POG_IOS" />
          </el-select>
        </el-form-item>
        <el-form-item label="页面标识" prop="pagePath">
          <el-input v-model="addForm.pagePath" placeholder="如 Login、Home、Settings_PersonalInfo" />
        </el-form-item>
        <el-form-item label="页面名称">
          <el-input v-model="addForm.name" placeholder="不填则使用页面标识" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="addForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSubmitting" @click="submitAdd">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑抽屉（按定位方式分块展示） -->
    <el-drawer
      v-model="editVisible"
      title="编辑页面对象"
      size="600px"
      class="page-drawer"
      destroy-on-close
      @close="resetEditForm"
    >
      <div v-if="editRecord" class="drawer-body">
        <el-form ref="editFormRef" :model="editForm" label-width="100px" class="edit-meta-form">
          <el-form-item label="元素目录">
            <el-select v-model="editForm.catalog" style="width: 100%">
              <el-option
                v-for="c in catalogTabs"
                :key="c.value"
                :label="c.label"
                :value="c.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="页面标识">
            <el-input v-model="editForm.pagePath" placeholder="如 Login" />
          </el-form-item>
          <el-form-item label="页面名称">
            <el-input v-model="editForm.name" placeholder="可选" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="editForm.description" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>

        <el-divider content-position="left">页面元素（按定位方式分类）</el-divider>
        <div class="elements-toolbar">
          <span class="toolbar-label">添加元素：</span>
          <el-dropdown trigger="click" @command="addElementToSection">
            <el-button type="primary" size="small">
              <el-icon><Plus /></el-icon>
              选择定位方式并添加
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <el-dropdown-menu>
              <el-dropdown-item v-for="opt in selectorTypeAddOptions" :key="opt.type" :command="opt.type">
                {{ opt.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>

        <div class="elements-by-section">
          <template v-for="(typeKey, idx) in selectorTypeOrder" :key="typeKey">
            <div v-if="(editForm.groupedElements[typeKey]?.length ?? 0) > 0" class="section-block">
              <div class="section-title">{{ selectorTypeLabel(typeKey) }}</div>
              <div class="section-list">
                <div
                  v-for="(item, itemIdx) in editForm.groupedElements[typeKey]"
                  :key="`${typeKey}-${item.key}-${itemIdx}`"
                  class="element-card"
                >
                  <div class="element-card-header">
                    <span class="element-key">{{ item.key || '（未填 key）' }}</span>
                    <el-button type="danger" link size="small" @click="deleteElementInEdit(typeKey, itemIdx)">删除</el-button>
                  </div>
                  <el-form label-position="top" class="element-fields">
                    <el-form-item label="元素名（key）" required>
                      <el-input v-model="item.key" placeholder="如 SIDE_MENU_BUTTON、NICKNAME_INPUT" size="small" />
                    </el-form-item>
                    <el-form-item label="定位方式" required>
                      <el-select
                        v-model="item.selectorType"
                        placeholder="必选：xpath / id / …"
                        size="small"
                        style="width: 100%"
                        @change="(v: string) => onSelectorTypeChange(item, typeKey, itemIdx, v)"
                      >
                        <el-option
                          v-for="opt in selectorTypeAddOptions"
                          :key="opt.type"
                          :label="opt.label"
                          :value="opt.type === 'other' ? 'other' : opt.type" />
                      </el-select>
                    </el-form-item>
                    <el-form-item :label="selectorValueLabel(item.selectorType)" required>
                      <el-input
                        v-model="item.selector"
                        :placeholder="selectorPlaceholder(item.selectorType)"
                        size="small"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 3 }" />
                    </el-form-item>
                    <el-form-item label="说明">
                      <el-input v-model="item.description" placeholder="可选，如：侧边栏入口" size="small" />
                    </el-form-item>
                    <el-form-item label="超时（秒）">
                      <el-input-number v-model="item.timeout" :min="0" :max="120" size="small" style="width: 100%" />
                    </el-form-item>
                  </el-form>
                </div>
              </div>
            </div>
          </template>
        </div>
        <el-empty
          v-if="totalElementCount(editForm.groupedElements) === 0"
          description="暂无元素，点击上方「选择定位方式并添加」"
          :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown, Loading } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import type { SupportedDevicePlatform } from '@/utils/platform'
import { SUPPORTED_DEVICE_PLATFORMS, platformElTagType, platformUiLabel } from '@/utils/platform'

/** 定位方式展示顺序与中文标签（兼容后端 id / xpath / name / text / accessibility-id / other） */
const SELECTOR_TYPE_ORDER = ['id', 'xpath', 'name', 'text', 'accessibilityId', 'className', 'other'] as const
const SELECTOR_TYPE_LABELS: Record<string, string> = {
  id: 'ID 定位',
  xpath: 'XPath 定位',
  name: 'Text 定位',
  text: 'Text 定位',
  accessibilityId: 'Accessibility ID 定位',
  'accessibility-id': 'Accessibility ID 定位',
  className: 'Class 定位',
  other: '其他'
}
const selectorTypeOrder = SELECTOR_TYPE_ORDER
const selectorTypeLabel = (typeKey: string) => SELECTOR_TYPE_LABELS[typeKey] || typeKey
const selectorTypeAddOptions = SELECTOR_TYPE_ORDER.map((t) => ({ type: t, label: SELECTOR_TYPE_LABELS[t] || t }))

/** 定位值表单项标题 */
function selectorValueLabel(selectorType?: string) {
  const t = (selectorType || '').toLowerCase()
  if (t === 'xpath') return 'XPath 表达式'
  if (t === 'id') return 'resource-id / id'
  if (t === 'accessibilityid' || t === 'accessibility-id') return 'Accessibility ID'
  if (t === 'name' || t === 'text') return '文本 / name'
  if (t === 'classname') return 'className'
  return '定位值（selector）'
}

/** 按定位方式给占位示例 */
function selectorPlaceholder(selectorType?: string) {
  const t = (selectorType || '').toLowerCase()
  if (t === 'xpath') return "如 //android.widget.TextView[@text='点击登录']"
  if (t === 'id') return '如 com.pwrd.steam.esports:id/sideView'
  if (t === 'accessibilityid' || t === 'accessibility-id') return '如 icon menu dark'
  if (t === 'name' || t === 'text') return '如 点击登录'
  if (t === 'classname') return '如 android.widget.Button'
  return '按所选定位方式填写'
}

/**
 * 切换定位方式：若元素仍在原分组，同步 selectorType；
 * 若改到另一类定位，搬到对应分组（保持「按定位方式分块」一致）。
 */
function onSelectorTypeChange(item: ElementWithKey, fromType: string, itemIdx: number, newType: string) {
  const norm = newType === 'accessibility-id' ? 'accessibilityId' : newType
  item.selectorType = norm
  const targetSection = SELECTOR_TYPE_ORDER.includes(norm as any) ? norm : 'other'
  if (targetSection === fromType) return
  const list = editForm.groupedElements[fromType]
  if (!list || itemIdx < 0 || itemIdx >= list.length) return
  const [moved] = list.splice(itemIdx, 1)
  if (!moved) return
  moved.selectorType = targetSection === 'other' ? 'other' : targetSection
  if (!editForm.groupedElements[targetSection]) editForm.groupedElements[targetSection] = []
  editForm.groupedElements[targetSection].push(moved)
}

/** 元素库目录：默认维护「自动化元素」 */
const catalogTabs = [
  { value: 'AUTOMATION', label: '自动化元素' },
  { value: 'ONLINE', label: '线上回归' },
  { value: 'SHARED', label: '公共（两边共用）' }
] as const
type CatalogValue = (typeof catalogTabs)[number]['value']

const filterCatalog = ref<CatalogValue>('AUTOMATION')
const catalogHint = computed(() => {
  if (filterCatalog.value === 'ONLINE') return '线上回归专用元素（商店安装按钮等）；后续脚本将从此目录读 selector。'
  if (filterCatalog.value === 'SHARED') return '登录/退出/侧边栏等两边共用元素，避免自动化与线上回归各写一份。'
  return '用例/场景自动化维护的元素（当前截图中这套）。改 xpath 只改这里，不要改 Java 硬编码。'
})

function catalogLabel(c?: string) {
  const hit = catalogTabs.find((x) => x.value === c)
  return hit?.label || c || '自动化元素'
}
function catalogTagType(c?: string): 'success' | 'warning' | 'info' | 'primary' {
  if (c === 'ONLINE') return 'warning'
  if (c === 'SHARED') return 'success'
  return 'primary'
}

const loading = ref(false)
const list = ref<any[]>([])
const filterAppId = ref('')
const filterPlatform = ref<string>('')
const expandedRowKeys = ref<string[]>([])
const expandedElementsCache = ref<Record<string, Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }>>>({})
const expandingLoad = ref<Record<string, boolean>>({})
const platformOrder = [...SUPPORTED_DEVICE_PLATFORMS]
const activePlatformNames = ref<string[]>([])

/** 按平台分组，用于折叠面板展示 */
const listByPlatform = computed(() => {
  const map: Record<string, any[]> = {}
  platformOrder.forEach((p) => {
    map[p] = []
  })
  list.value.forEach((row) => {
    const p = (row.platform || '').toUpperCase()
    if (map[p]) map[p].push(row)
  })
  return map
})

const loadList = async () => {
  loading.value = true
  expandedElementsCache.value = {}
  expandedRowKeys.value = []
  try {
    list.value = await apiClient.getPageObjects({
      catalog: filterCatalog.value,
      appId: filterAppId.value.trim() || undefined,
      platform: filterPlatform.value || undefined
    })
  } catch (e: any) {
    const msg = e?.message || ''
    const isNetworkError = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network')
    ElMessage.error(
      isNetworkError
        ? '无法连接后端服务，请确认后端已启动（http://127.0.0.1:3000/api）'
        : msg || '加载失败'
    )
  } finally {
    loading.value = false
  }
}

const onCatalogChange = () => {
  loadList()
}

const resetFilters = () => {
  filterAppId.value = ''
  filterPlatform.value = ''
  // 目录保持当前 Tab，仅清空应用/平台
  loadList()
}

function platformLabel(p: string) {
  return platformUiLabel(p)
}

function platformTagType(p: string) {
  return platformElTagType(p)
}

function elementCount(elements: Record<string, any> | null | undefined) {
  if (!elements || typeof elements !== 'object') return 0
  return Object.keys(elements).length
}

/** 将 elements 按 selectorType 分组，用于列表展开展示 */
function getGroupedElements(elements: Record<string, any> | null | undefined): Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }> {
  if (!elements || typeof elements !== 'object') return []
  const byType: Record<string, Array<{ key: string; selector: string; description?: string }>> = {}
  Object.entries(elements).forEach(([key, v]) => {
    const type = (v?.selectorType || 'other') as string
    const norm = type === 'accessibility-id' ? 'accessibilityId' : type
    const sectionKey = SELECTOR_TYPE_ORDER.includes(norm as any) ? norm : 'other'
    if (!byType[sectionKey]) byType[sectionKey] = []
    byType[sectionKey].push({
      key,
      selector: v?.selector ?? '',
      description: v?.description
    })
  })
  const result: Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }> = []
  SELECTOR_TYPE_ORDER.forEach((typeKey) => {
    const items = byType[typeKey]
    if (items?.length) result.push({ type: typeKey, items })
  })
  if (byType.other?.length) result.push({ type: 'other', items: byType.other })
  return result
}

/** 展开区显示用：优先用缓存的分类数据，否则用列表的 elements 分组 */
function getExpandGroupedList(row: any): Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }> {
  if (expandedElementsCache.value[row.id]?.length) return expandedElementsCache.value[row.id]
  return getGroupedElements(row.elements)
}

/** 将 /categorized 返回的 elementsBySelectorType 转为展开区用的分组列表 */
function categorizedToGroupedList(byType: Record<string, any[]>): Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }> {
  const bySection: Record<string, Array<{ key: string; selector: string; description?: string }>> = {}
  const norm = (k: string) => (k === 'accessibility-id' ? 'accessibilityId' : k)
  const known = new Set([...SELECTOR_TYPE_ORDER, 'accessibility-id'])
  Object.entries(byType || {}).forEach(([rawKey, arr]) => {
    if (!Array.isArray(arr)) return
    const typeKey = known.has(norm(rawKey)) ? norm(rawKey) : 'other'
    if (!bySection[typeKey]) bySection[typeKey] = []
    arr.forEach((item: any) =>
      bySection[typeKey].push({
        key: item.key ?? '',
        selector: item.selector ?? '',
        description: item.description
      })
    )
  })
  const result: Array<{ type: string; items: Array<{ key: string; selector: string; description?: string }> }> = []
  SELECTOR_TYPE_ORDER.forEach((typeKey) => {
    if (bySection[typeKey]?.length) result.push({ type: typeKey, items: bySection[typeKey] })
  })
  if (bySection.other?.length) result.push({ type: 'other', items: bySection.other })
  return result
}

async function loadExpandElements(row: any) {
  if (expandingLoad.value[row.id] || expandedElementsCache.value[row.id]) return
  expandingLoad.value[row.id] = true
  try {
    const res = await apiClient.getPageObjectCategorized(row.id)
    const byType = res?.elementsBySelectorType
    if (byType && typeof byType === 'object') {
      expandedElementsCache.value[row.id] = categorizedToGroupedList(byType)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载元素失败')
  } finally {
    expandingLoad.value[row.id] = false
  }
}

function onExpandChange(_row: any, expandedRows: any[]) {
  expandedRowKeys.value = expandedRows.map((r) => r.id)
  expandedRows.forEach((row) => {
    const hasElements = row.elements && Object.keys(row.elements).length > 0
    const hasCount = (row.elementCount ?? elementCount(row.elements)) > 0
    if (!hasElements && hasCount) loadExpandElements(row)
  })
}

function toggleExpandRow(row: any) {
  const idx = expandedRowKeys.value.indexOf(row.id)
  if (idx >= 0) {
    expandedRowKeys.value = expandedRowKeys.value.filter((id) => id !== row.id)
  } else {
    expandedRowKeys.value = [...expandedRowKeys.value, row.id]
    const hasElements = row.elements && Object.keys(row.elements).length > 0
    const hasCount = (row.elementCount ?? elementCount(row.elements)) > 0
    if (!hasElements && hasCount) loadExpandElements(row)
  }
}

/** 在展开区删除单个元素：调用按元素删除接口，用返回的 PageObject 更新展示 */
async function deleteElementFromExpand(row: any, elementKey: string) {
  try {
    await ElMessageBox.confirm(`确定删除元素「${elementKey}」吗？`, '删除元素', { type: 'warning' })
    const updated = await apiClient.deletePageObjectElement(row.id, elementKey)
    row.elements = updated?.elements ?? row.elements
    if (updated?.elementCount != null) row.elementCount = updated.elementCount
    expandedElementsCache.value[row.id] = getGroupedElements(updated?.elements)
    ElMessage.success('已删除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

function formatTime(val: string | number | null | undefined) {
  if (!val) return '—'
  const d = typeof val === 'string' ? new Date(val) : new Date(Number(val) * 1000)
  return d.toLocaleString('zh-CN')
}

// 新增
const addVisible = ref(false)
const addFormRef = ref()
const addSubmitting = ref(false)
const addForm = reactive({
  catalog: 'AUTOMATION' as CatalogValue,
  appId: '',
  platform: '' as '' | SupportedDevicePlatform,
  pagePath: '',
  name: '',
  description: ''
})
const addRules = {
  catalog: [{ required: true, message: '请选择元素目录', trigger: 'change' }],
  appId: [{ required: true, message: '请输入应用 ID', trigger: 'blur' }],
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  pagePath: [{ required: true, message: '请输入页面标识', trigger: 'blur' }]
}

const openAddDialog = () => {
  addForm.catalog = filterCatalog.value
  addVisible.value = true
}

const resetAddForm = () => {
  addForm.catalog = filterCatalog.value
  addForm.appId = ''
  addForm.platform = ''
  addForm.pagePath = ''
  addForm.name = ''
  addForm.description = ''
}

const submitAdd = async () => {
  try {
    await addFormRef.value?.validate()
  } catch {
    return
  }
  if (!addForm.appId?.trim() || !addForm.platform || !addForm.pagePath?.trim()) {
    ElMessage.warning('请填写应用 ID、平台、页面标识')
    return
  }
  addSubmitting.value = true
  try {
    await apiClient.createPageObject({
      catalog: addForm.catalog,
      platform: addForm.platform,
      appId: addForm.appId.trim(),
      pagePath: addForm.pagePath.trim(),
      name: addForm.name?.trim() || undefined,
      description: addForm.description?.trim() || undefined,
      elements: {}
    })
    ElMessage.success('新增成功')
    addVisible.value = false
    if (filterCatalog.value !== addForm.catalog) {
      filterCatalog.value = addForm.catalog
    }
    loadList()
  } catch (e: any) {
    ElMessage.error(e.message || '新增失败')
  } finally {
    addSubmitting.value = false
  }
}

// 编辑（按定位方式分块，使用 GET /api/page-objects/{id}/categorized）
type ElementWithKey = {
  key: string
  name?: string
  selector: string
  selectorType: string
  description?: string
  timeout: number
}
type GroupedElements = Record<string, ElementWithKey[]>

const editVisible = ref(false)
const editRecord = ref<any>(null)
const editFormRef = ref()
const editSubmitting = ref(false)
const editForm = reactive<{
  catalog: CatalogValue
  pagePath: string
  name: string
  description: string
  groupedElements: GroupedElements
}>({
  catalog: 'AUTOMATION',
  pagePath: '',
  name: '',
  description: '',
  groupedElements: {}
})

function ensureGroupedKeys(record: GroupedElements) {
  SELECTOR_TYPE_ORDER.forEach((k) => {
    if (!Array.isArray(record[k])) record[k] = []
  })
}

function groupedToElements(grouped: GroupedElements): Record<string, any> {
  const r: Record<string, any> = {}
  Object.values(grouped).forEach((arr) => {
    arr.forEach((item) => {
      const key = (item.key || '').trim()
      if (!key) return
      r[key] = {
        name: item.name ?? key,
        selector: item.selector ?? '',
        selectorType: item.selectorType || 'id',
        description: item.description ?? '',
        timeout: typeof item.timeout === 'number' ? item.timeout : 10
      }
    })
  })
  return r
}

function totalElementCount(grouped: GroupedElements) {
  return Object.values(grouped).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
}

/** 用 categorized 接口返回的数据填充编辑表单 */
function applyCategorizedToEditForm(res: any) {
  const cat = (res?.catalog || 'AUTOMATION') as string
  editForm.catalog = (['AUTOMATION', 'ONLINE', 'SHARED'].includes(cat) ? cat : 'AUTOMATION') as CatalogValue
  editForm.pagePath = res?.pagePath ?? ''
  editForm.name = res?.name ?? ''
  editForm.description = res?.description ?? ''
  const byType = res?.elementsBySelectorType
  const normSectionKey = (k: string) => (k === 'accessibility-id' ? 'accessibilityId' : k)
  const knownKeys = new Set([...SELECTOR_TYPE_ORDER, 'accessibility-id'])
  if (byType && typeof byType === 'object') {
    editForm.groupedElements = {}
    Object.entries(byType).forEach(([rawKey, arr]) => {
      const typeKey = normSectionKey(rawKey)
      if (!Array.isArray(arr)) return
      const list = (editForm.groupedElements[typeKey] ?? []).concat(
        arr.map((item: any) => ({
          key: item.key ?? '',
          name: item.name,
          selector: item.selector ?? '',
          selectorType: item.selectorType ?? rawKey,
          description: item.description ?? '',
          timeout: typeof item.timeout === 'number' ? item.timeout : 10
        }))
      )
      editForm.groupedElements[typeKey] = list
    })
    SELECTOR_TYPE_ORDER.forEach((k) => {
      if (!Array.isArray(editForm.groupedElements[k])) editForm.groupedElements[k] = []
    })
    const otherKeys = Object.keys(byType).filter((k) => !knownKeys.has(k))
    const otherList: ElementWithKey[] = [...(editForm.groupedElements.other ?? [])]
    otherKeys.forEach((k) => {
      const arr = byType[k]
      if (!Array.isArray(arr)) return
      arr.forEach((item: any) =>
        otherList.push({
          key: item.key ?? '',
          name: item.name,
          selector: item.selector ?? '',
          selectorType: item.selectorType ?? k,
          description: item.description ?? '',
          timeout: typeof item.timeout === 'number' ? item.timeout : 10
        })
      )
    })
    if (otherList.length) editForm.groupedElements.other = otherList
  } else {
    ensureGroupedKeys(editForm.groupedElements)
  }
  ensureGroupedKeys(editForm.groupedElements)
}

const openEdit = async (row: any) => {
  editRecord.value = row
  try {
    const res = await apiClient.getPageObjectCategorized(row.id)
    applyCategorizedToEditForm(res)
    editVisible.value = true
  } catch (e: any) {
    ElMessage.error(e.message || '加载详情失败')
  }
}

const resetEditForm = () => {
  editRecord.value = null
  editForm.catalog = 'AUTOMATION'
  editForm.pagePath = ''
  editForm.name = ''
  editForm.description = ''
  editForm.groupedElements = {}
}

const addElementToSection = (typeKey: string) => {
  if (!editForm.groupedElements[typeKey]) editForm.groupedElements[typeKey] = []
  editForm.groupedElements[typeKey].push({
    key: '',
    selector: '',
    selectorType: typeKey === 'other' ? 'id' : typeKey,
    description: '',
    timeout: 10
  })
}

/** 编辑抽屉内删除单个元素：调用按元素删除接口，用返回数据刷新当前编辑表单 */
async function deleteElementInEdit(typeKey: string, itemIdx: number) {
  const item = editForm.groupedElements[typeKey]?.[itemIdx]
  if (!item?.key || !editRecord.value) return
  try {
    await ElMessageBox.confirm(`确定删除元素「${item.key}」吗？`, '删除元素', { type: 'warning' })
    await apiClient.deletePageObjectElement(editRecord.value.id, item.key)
    const res = await apiClient.getPageObjectCategorized(editRecord.value.id)
    applyCategorizedToEditForm(res)
    ElMessage.success('已删除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

const submitEdit = async () => {
  if (!editRecord.value) return
  const elements = groupedToElements(editForm.groupedElements)
  const missing: string[] = []
  Object.entries(elements).forEach(([key, el]: [string, any]) => {
    if (!el?.selectorType) missing.push(`${key}：未选定位方式`)
    if (!el?.selector?.trim()) missing.push(`${key}：定位值为空`)
  })
  if (missing.length) {
    ElMessage.warning(`请补全元素定位信息：${missing.slice(0, 3).join('；')}${missing.length > 3 ? '…' : ''}`)
    return
  }
  editSubmitting.value = true
  try {
    await apiClient.updatePageObject(editRecord.value.id, {
      catalog: editForm.catalog,
      pagePath: editForm.pagePath,
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      elements
    })
    ElMessage.success('保存成功')
    editVisible.value = false
    if (filterCatalog.value !== editForm.catalog) {
      filterCatalog.value = editForm.catalog
    }
    loadList()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editSubmitting.value = false
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定删除页面「${row.pagePath}」吗？`, '提示', { type: 'warning' })
    await apiClient.deletePageObject(row.id)
    ElMessage.success('已删除')
    loadList()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.page-objects {
  width: 100%;
}

.main-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.catalog-tabs {
  margin-bottom: 4px;
}

.catalog-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.platform-group-wrap {
  min-height: 120px;
}

.platform-collapse {
  border: none;
}

.platform-collapse :deep(.el-collapse-item__header) {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-left: 12px;
}

.platform-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.platform-collapse :deep(.el-collapse-item__content) {
  padding: 0 0 12px 0;
}

.platform-collapse-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.platform-count {
  font-weight: normal;
  color: #909399;
  font-size: 13px;
}

.drawer-body {
  padding: 0 8px;
}

.edit-meta-form {
  margin-bottom: 8px;
}

.elements-toolbar {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 13px;
  color: #606266;
}

.elements-by-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-block {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}

.section-title {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid #ebeef5;
}

.section-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.element-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
}

.element-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.element-index {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.element-fields :deep(.el-form-item) {
  margin-bottom: 12px;
}

.element-fields :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.page-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}

.page-drawer :deep(.el-drawer__body) {
  padding: 16px;
  overflow-y: auto;
}

/* 列表展开：页面下元素展示 */
.expand-elements {
  padding: 12px 16px 12px 56px;
  background: #fafbfc;
  border-left: 3px solid var(--el-color-primary);
  max-height: 420px;
  overflow-y: auto;
}

.expand-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #909399;
  font-size: 13px;
}

.expand-loading .el-icon {
  margin-right: 8px;
}

.expand-section {
  margin-bottom: 14px;
}

.expand-section:last-child {
  margin-bottom: 0;
}

.expand-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ebeef5;
}

.expand-section-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expand-element-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.expand-element-key {
  flex: 0 0 160px;
  font-weight: 500;
  color: #303133;
}

.expand-element-selector {
  flex: 1;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 11px;
}

.expand-element-desc {
  flex: 0 0 120px;
  color: #909399;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-element-delete {
  flex-shrink: 0;
}
</style>
