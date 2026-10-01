<template>
  <section class="must-board">
    <div class="mb-head">
      <div>
        <div class="mb-title">本次必测 · 接口测试要注意什么</div>
        <div class="mb-sub">
          <template v-if="meta">
            {{ meta.project || '最近一次分析' }} · {{ meta.baseRef }} → {{ meta.headRef }}
            <span v-if="meta.createdAt"> · {{ meta.createdAt }}</span>
          </template>
          <template v-else-if="!loading">还没有分析过提测分支，这里会列出必测接口和注意事项</template>
        </div>
      </div>
      <div class="mb-actions">
        <el-tag v-if="guide" size="small" type="danger">P0 {{ guide.p0 }}</el-tag>
        <el-tag v-if="guide" size="small" type="warning">P1 {{ guide.p1 }}</el-tag>
        <el-tag v-if="guide" size="small" type="info">P2 {{ guide.p2 }}</el-tag>
        <el-button size="small" @click="reload" :loading="loading">刷新</el-button>
        <el-button size="small" type="primary" @click="goAnalyze">去对比分析</el-button>
      </div>
    </div>

    <div v-if="guide?.hint" class="mb-hint">{{ guide.hint }}</div>

    <el-empty
      v-if="!loading && !rows.length"
      :description="emptyText"
      :image-size="64"
    >
      <el-button type="primary" @click="goAnalyze">用 master 和当前提测分支分析一次</el-button>
    </el-empty>

    <el-table
      v-else
      :data="visibleRows"
      size="small"
      border
      class="mb-table"
      :row-class-name="rowClass"
      @row-click="onRow"
    >
      <el-table-column label="优先级" width="72" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : 'info'">
            {{ row.priority }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="接口" min-width="200">
        <template #default="{ row }">
          <span v-if="row.httpMethod" class="mb-ep">{{ row.httpMethod }} {{ row.path }}</span>
          <span v-else>{{ row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="测什么" min-width="140" show-overflow-tooltip />
      <el-table-column prop="why" label="为什么必测" min-width="160" show-overflow-tooltip />
      <el-table-column label="要注意什么" min-width="280">
        <template #default="{ row }">
          <ul class="mb-notes">
            <li v-for="(n, i) in row.notes" :key="i">{{ n }}</li>
          </ul>
        </template>
      </el-table-column>
    </el-table>
    <el-button
      v-if="hiddenCount > 0"
      link
      type="primary"
      class="mb-more"
      @click="showAll = !showAll"
    >
      {{ showAll ? '只看 P0 / P1' : `展开其余 ${hiddenCount} 条 P2` }}
    </el-button>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/api'

export type MustTestItem = {
  priority: string
  kind: string
  httpMethod?: string
  path?: string
  title: string
  why: string
  notes: string[]
}

const props = defineProps<{
  project?: string
  highlightPath?: string
}>()

const emit = defineEmits<{
  select: [item: MustTestItem]
}>()

const router = useRouter()
const loading = ref(false)
const showAll = ref(false)
const guide = ref<{ p0: number; p1: number; p2: number; hint: string; items: MustTestItem[] } | null>(null)
const meta = ref<{ project?: string; baseRef?: string; headRef?: string; createdAt?: string } | null>(null)

const rows = computed(() => guide.value?.items || [])
const coreRows = computed(() => rows.value.filter((r) => r.priority !== 'P2'))
const hiddenCount = computed(() => rows.value.length - coreRows.value.length)
const visibleRows = computed(() => (showAll.value ? rows.value : coreRows.value.length ? coreRows.value : rows.value))

const emptyText = computed(() =>
  props.project
    ? `项目 ${props.project} 还没有提测分析，分析后这里会列出必测接口`
    : '分析后，P0 不兼容 / P1 新接口与实现变更会排在这'
)

function rowClass({ row }: { row: MustTestItem }) {
  const hit =
    props.highlightPath &&
    row.path &&
    (row.path === props.highlightPath || props.highlightPath.endsWith(row.path))
  return hit ? 'is-hit' : ''
}

function onRow(row: MustTestItem) {
  emit('select', row)
}

function goAnalyze() {
  router.push({ path: '/api-changes', query: props.project ? { project: props.project } : {} })
}

async function reload() {
  loading.value = true
  guide.value = null
  meta.value = null
  try {
    const list = await apiClient.listApiChangeReports({
      project: props.project || undefined,
      limit: 1
    })
    const head = list?.[0]
    if (!head?.id) return
    const detail = await apiClient.getApiChangeReport(head.id)
    const r = detail.report || {}
    guide.value = r.mustTest || null
    meta.value = {
      project: detail.project || r.project,
      baseRef: detail.baseRef || r.baseRef,
      headRef: detail.headRef || r.headRef,
      createdAt: detail.createdAt
    }
  } catch {
    /* 没有报告时保持空态，不弹错 */
  } finally {
    loading.value = false
  }
}

watch(() => props.project, () => reload())
onMounted(reload)
</script>

<style scoped>
.must-board {
  margin: 0 0 16px;
  padding: 12px 14px;
  background: #fff7f6;
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 8px;
}
.mb-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.mb-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-danger-dark-2);
}
.mb-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mb-hint {
  margin: 8px 0;
  font-size: 12.5px;
  color: #ad2102;
  line-height: 1.5;
}
.mb-ep {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
}
.mb-notes {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-regular);
}
.mb-more {
  margin-top: 6px;
}
.mb-table :deep(.is-hit) {
  background: var(--el-color-warning-light-8);
}
</style>
