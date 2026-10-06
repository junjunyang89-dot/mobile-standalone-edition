<template>
  <div class="proj-tree">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">统一项目树</span>
            <p class="sub">
              左侧选分类或项目，右侧看这一层的覆盖数。零就是没人测，不用点开也能看见。
            </p>
          </div>
          <el-checkbox v-model="includeEmpty" @change="load">显示空项目</el-checkbox>
        </div>
      </template>

      <div class="body" v-loading="loading">
        <aside class="tree-pane">
          <el-tree
            v-if="navTree.length"
            ref="treeRef"
            :data="navTree"
            :props="{ label: 'label', children: 'children' }"
            node-key="key"
            highlight-current
            default-expand-all
            :expand-on-click-node="false"
            :current-node-key="selectedKey"
            @node-click="onTreeClick"
          >
            <template #default="{ data }">
              <span class="tree-node">
                <el-tag v-if="data.type === 'CATEGORY'" size="small" type="info">{{ data.label }}</el-tag>
                <el-tag v-else-if="data.type === 'KIND'" size="small" :type="kindType(data.kind)">{{ data.label }}</el-tag>
                <template v-else>
                  <el-tag size="small" :type="kindType(data.kind)">{{ kindLabel(data.kind) }}</el-tag>
                  <span class="pname" :title="data.label">{{ data.label }}</span>
                </template>
              </span>
            </template>
          </el-tree>
          <el-empty v-else-if="!loading" description="暂无数据" :image-size="72" />
        </aside>

        <section class="table-pane">
          <div class="crumb">{{ crumb }}</div>

          <el-table
            v-if="tableRows.length"
            :data="tableRows"
            class="cov-table"
            stripe
            height="100%"
            :header-cell-style="{ background: '#fafafa', color: '#909399', fontWeight: 500 }"
            @row-click="onRowClick"
          >
            <template v-if="tableMode === 'project'">
              <el-table-column label="类型" width="88">
                <template #default="{ row }">
                  <el-tag size="small" :type="kindType(row.kind)">{{ kindLabel(row.kind) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="label" label="项目" min-width="220" show-overflow-tooltip />
              <el-table-column label="合计" width="80" align="right">
                <template #default="{ row }">
                  <span class="num" :class="{ zero: !row.total }">{{ row.total || 0 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in MODULE_COLS"
                :key="col.key"
                :label="col.label"
                min-width="92"
                align="right"
              >
                <template #default="{ row }">
                  <span class="num" :class="{ zero: !countOf(row, col.key) }">{{ countOf(row, col.key) }}</span>
                </template>
              </el-table-column>
            </template>
            <template v-else>
              <el-table-column prop="label" label="模块" min-width="160" />
              <el-table-column label="数量" width="120" align="right">
                <template #default="{ row }">
                  <span class="num" :class="{ zero: !row.count }">{{ row.count || 0 }}</span>
                </template>
              </el-table-column>
              <el-table-column label="" width="88" align="right">
                <template #default>
                  <el-button link type="primary" size="small">查看</el-button>
                </template>
              </el-table-column>
            </template>
          </el-table>
          <el-empty v-else-if="!loading" description="这一层没有数据" :image-size="80" />
        </section>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

type ModuleKey = 'API_CASES' | 'API_ENDPOINTS' | 'API_COLLECTIONS' | 'UI_FLOWS' | 'UI_ELEMENTS' | 'BUGS'

type ModuleNode = {
  key: ModuleKey
  label: string
  type: 'MODULE'
  count: number
  projectCode: string
}

type ProjectNode = {
  key: string
  label: string
  type: 'PROJECT'
  kind: string
  total: number
  counts: Record<string, number>
  children: ModuleNode[]
}

type KindNode = {
  key: string
  label: string
  type: 'KIND'
  kind: string
  total?: number
  projectCount?: number
  counts?: Record<string, number>
  children: ProjectNode[]
}

type CategoryNode = {
  key: string
  label: string
  type: 'CATEGORY'
  projectCount?: number
  counts?: Record<string, number>
  children: KindNode[]
}

const MODULE_COLS: Array<{ key: ModuleKey; label: string; route: string }> = [
  { key: 'API_CASES', label: '接口用例', route: '/api-collections' },
  { key: 'API_ENDPOINTS', label: '接口清单', route: '/api-endpoints' },
  { key: 'API_COLLECTIONS', label: '用例集合', route: '/api-collections' },
  { key: 'UI_FLOWS', label: 'UI 流程', route: '/ui-flows' },
  { key: 'UI_ELEMENTS', label: 'UI 元素', route: '/ui-elements' },
  { key: 'BUGS', label: 'Bug', route: '/bug-management' }
]

const router = useRouter()
const treeRef = ref()
const nodes = ref<CategoryNode[]>([])
const includeEmpty = ref(true)
const loading = ref(false)
const selectedKey = ref('')

const navTree = computed(() =>
  nodes.value.map((cat) => ({
    ...cat,
    children: (cat.children || []).map((k) => ({
      ...k,
      children: (k.children || []).map((p) => ({ ...p, children: undefined }))
    }))
  }))
)

const selected = computed(() => findNode(selectedKey.value))

const tableMode = computed(() => {
  const t = selected.value?.type
  if (t === 'PROJECT') return 'module'
  return 'project'
})

const tableRows = computed(() => {
  const node = selected.value
  if (!node) return []
  if (node.type === 'CATEGORY') {
    return (node.children || []).flatMap((k) => k.children || [])
  }
  return node.children || []
})

const crumb = computed(() => {
  const node = selected.value
  if (!node) return '选左侧一层，右边列出对应数据'
  if (node.type === 'CATEGORY') return `${node.label} · 项目`
  if (node.type === 'KIND') return `${parentLabel(node.key)} / ${node.label} · 项目`
  return `${parentLabel(node.key)} / ${node.label} · 模块`
})

async function load() {
  loading.value = true
  try {
    const t = await apiClient.getUnifiedTree(includeEmpty.value)
    nodes.value = (t.nodes || []) as CategoryNode[]
    const keep = findNode(selectedKey.value)
    selectedKey.value = keep?.key || nodes.value[0]?.key || ''
    await nextTick()
    if (selectedKey.value) treeRef.value?.setCurrentKey(selectedKey.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onTreeClick(data: CategoryNode | KindNode | ProjectNode) {
  selectedKey.value = data.key
}

function onRowClick(row: ProjectNode | ModuleNode) {
  if ((row as ProjectNode).type === 'PROJECT') {
    selectedKey.value = row.key
    nextTick(() => treeRef.value?.setCurrentKey(row.key))
    return
  }
  const mod = row as ModuleNode
  const col = MODULE_COLS.find((c) => c.key === mod.key)
  if (!col) return
  const query = mod.projectCode ? { project: mod.projectCode } : {}
  router.push({ path: col.route, query })
}

function findNode(key: string): CategoryNode | KindNode | ProjectNode | null {
  if (!key) return null
  for (const cat of nodes.value) {
    if (cat.key === key) return cat
    for (const kind of cat.children || []) {
      if (kind.key === key) return kind
      const proj = (kind.children || []).find((p) => p.key === key)
      if (proj) return proj
    }
  }
  return null
}

function parentLabel(nodeKey: string) {
  for (const cat of nodes.value) {
    if (cat.key === nodeKey) return cat.label
    for (const kind of cat.children || []) {
      if (kind.key === nodeKey) return cat.label
      if ((kind.children || []).some((p) => p.key === nodeKey)) return `${cat.label} / ${kind.label}`
    }
  }
  return ''
}

function countOf(row: ProjectNode, key: ModuleKey) {
  if (row.counts && row.counts[key] != null) return Number(row.counts[key]) || 0
  const child = (row.children || []).find((c) => c.key === key)
  return child?.count || 0
}

function kindType(k: string) {
  return k === 'CLIENT' ? 'success' : k === 'FRONTEND' || k === 'H5' ? 'warning' : ''
}

function kindLabel(k: string) {
  return k === 'CLIENT' ? '客户端' : k === 'FRONTEND' || k === 'H5' ? '前端' : '后端'
}

onMounted(load)
</script>

<style scoped>
.proj-tree {
  height: 100%;
  min-height: 0;
}
.page-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.page-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  max-width: 720px;
}
.body {
  flex: 1;
  min-height: calc(100vh - 240px);
  display: flex;
}
.tree-pane {
  width: 300px;
  flex-shrink: 0;
  padding: 12px 10px 16px;
  border-right: 1px solid var(--el-border-color);
  overflow: auto;
}
.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pname {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
}
.crumb {
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--app-text-regular);
}
.cov-table {
  flex: 1;
  --el-table-border-color: #f0f2f5;
  --el-table-row-hover-bg-color: var(--el-color-primary-light-9);
}
.num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.num.zero {
  font-weight: 400;
  color: var(--el-text-color-disabled);
}
</style>
