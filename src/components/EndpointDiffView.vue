<template>
  <div class="edv">
    <aside class="edv-list">
      <el-input v-model="keyword" size="small" clearable placeholder="搜路径 / 说明 / 字段 / 业务标签" class="edv-search" />
      <div class="edv-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="edv-filter"
          :class="{ active: filterKey === f.key }"
          @click="setFilter(f.key)"
        >
          {{ f.label }}<b>{{ f.count }}</b>
        </button>
      </div>

      <el-empty v-if="!filtered.length" :description="items.length ? '没有匹配的接口' : '没有接口变更'" :image-size="48" />
      <button
        v-for="it in pagedList"
        :key="it.key"
        type="button"
        class="edv-card"
        :class="[`p-${it.priority.toLowerCase()}`, { active: it.key === currentKey }]"
        @click="currentKey = it.key"
      >
        <span class="edv-prio" :class="`p-${it.priority.toLowerCase()}`">{{ it.priority }}</span>
        <span class="edv-method" :class="`m-${it.method.toLowerCase()}`">{{ it.method }}</span>
        <span class="edv-path">{{ it.e.path }}</span>
      </button>
      <el-pagination
        v-if="filtered.length > PAGE"
        v-model:current-page="page"
        small
        layout="prev, pager, next"
        :page-size="PAGE"
        :total="filtered.length"
        class="edv-pager"
      />
    </aside>

    <main v-if="current" class="edv-detail">
      <header class="edv-head">
        <div class="edv-head-line">
          <span class="edv-method lg" :class="`m-${current.method.toLowerCase()}`">{{ current.method }}</span>
          <span class="edv-head-path">{{ current.e.path }}</span>
          <el-button link size="small" title="复制路径" @click="copy(current.e.path)"><el-icon><CopyDocument /></el-icon></el-button>
        </div>
        <div class="edv-head-sub">
          <el-tag v-for="b in current.badges" :key="b.label" size="small" :type="b.type" effect="light">{{ b.label }}</el-tag>
          <span v-if="current.e.summary" class="edv-head-sum">{{ current.e.summary }}</span>
          <span v-if="current.e.file" class="edv-file">{{ current.e.file }}</span>
        </div>
        <div v-if="marks && tagsOf(current).length" class="edv-consumers">
          <span class="edv-consumers-label">前端在用</span>
          <span v-for="t in tagsOf(current)" :key="t.tag" class="edv-biz lg">{{ t.tag }} <b>{{ t.count }}</b> 个字段</span>
        </div>
      </header>
      <EndpointWorkbench
        :ctx="current"
        :project="project"
        :marks="marks"
        :schema-note="report?.schemaNote"
        :common-notes="report?.mustTest?.commonNotes"
        @open-table="(t: string) => emit('open-table', t)"
        @open-schema="(t: string) => emit('open-schema', t)"
        @edit-case="(v: any) => emit('edit-case', v)"
      />
    </main>
    <main v-else class="edv-detail edv-detail-empty">
      <el-empty description="左边选一个接口" :image-size="60" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import EndpointWorkbench from '@/components/EndpointWorkbench.vue'
import { useFieldMarks, type EndpointRef } from '@/composables/useFieldMarks'
import { endpointBadges, endpointRows } from '@/utils/fieldDiff'
import { CTX_FILTERS, linkReport } from '@/utils/endpointContext'

const props = defineProps<{
  report: any
  project: string
  /** base..head，确认记录跟着它走 */
  refs: string
  /** 快捷筛选，和页面顶部的统计卡片联动 */
  filter?: string
}>()
const emit = defineEmits<{
  (e: 'update:filter', v: string): void
  (e: 'open-table', table: string): void
  (e: 'open-schema', table: string): void
  (e: 'edit-case', v: { id: string; endpointId?: string; project?: string }): void
}>()

const PAGE = 20

const marks = computed(() => (props.project || props.refs ? useFieldMarks(props.project || '', props.refs || '') : null))

const items = computed(() =>
  linkReport(props.report).ctxs.map((c) => {
    const method = String(c.e.httpMethod || 'GET').toUpperCase()
    const rows = endpointRows(c.e)
    return {
      ...c,
      method,
      rows,
      badges: endpointBadges(c.e),
      ref: { method, path: c.e.path } as EndpointRef
    }
  })
)
type Item = (typeof items.value)[number]

function confirmedOf(it: Item) {
  const m = marks.value
  return m ? it.rows.filter((r) => m.isConfirmed(it.ref, r)).length : 0
}

function tagsOf(it: Item) {
  return marks.value ? marks.value.tagSummary(it.ref, it.rows) : []
}

const keyword = ref('')
const localFilter = ref('ALL')
const filterKey = computed(() => props.filter ?? localFilter.value)
const page = ref(1)

function setFilter(k: string) {
  localFilter.value = k
  emit('update:filter', k)
}

const TODO = { key: 'TODO', label: '未确认完', test: (it: Item) => it.rows.length > 0 && confirmedOf(it) < it.rows.length }
const allFilters = computed(() => [...CTX_FILTERS, ...(marks.value ? [TODO] : [])])

const filters = computed(() =>
  allFilters.value
    .map((f) => ({ key: f.key, label: f.label, count: items.value.filter((it) => f.test(it as Item)).length }))
    .filter((f) => f.key === 'ALL' || f.count > 0 || f.key === filterKey.value)
)

const filtered = computed(() => {
  const test = allFilters.value.find((f) => f.key === filterKey.value)?.test || (() => true)
  const words = keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return items.value.filter((it) => {
    if (!test(it as Item)) return false
    if (!words.length) return true
    const hay = [it.key, it.e.summary, it.e.handler, it.must?.title, ...it.rows.map((r) => r.name), ...tagsOf(it).map((t) => t.tag)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
})

const pagedList = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))

const currentKey = ref('')
const current = computed(() => filtered.value.find((it) => it.key === currentKey.value) || null)

watch([keyword, filterKey], () => {
  page.value = 1
})

watch(
  filtered,
  (list) => {
    if (!list.some((it) => it.key === currentKey.value)) currentKey.value = list[0]?.key || ''
  },
  { immediate: true }
)

watch(
  () => props.report,
  () => {
    keyword.value = ''
    page.value = 1
  }
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，手动选中复制')
  }
}
</script>

<style scoped>
.edv {
  display: grid;
  grid-template-columns: minmax(290px, 350px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.edv-list {
  position: sticky;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
  padding-right: 2px;
}

.edv-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 2px;
}

.edv-filter {
  padding: 1px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: #fff;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.edv-filter b {
  margin-left: 3px;
  font-weight: 600;
}

.edv-filter.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.edv-card {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-border-color);
  border-radius: 6px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.edv-card.p-p0 { border-left-color: #cf222e; }
.edv-card.p-p1 { border-left-color: #d4a72c; }

.edv-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.edv-card.active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.edv-prio {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 17px;
  background: #eef0f3;
  color: #57606a;
}

.edv-prio.p-p0 { background: #cf222e; color: #fff; }
.edv-prio.p-p1 { background: #fff1c2; color: #9a6700; }

.edv-method {
  flex-shrink: 0;
  min-width: 38px;
  padding: 0 4px;
  border-radius: 3px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
  background: #eef0f3;
  color: #57606a;
}

.edv-method.lg {
  font-size: 12px;
  line-height: 22px;
  min-width: 48px;
}

.edv-method.m-get { background: #dafbe1; color: #1a7f37; }
.edv-method.m-post { background: #ddf4ff; color: #0969da; }
.edv-method.m-put,
.edv-method.m-patch { background: #fff1c2; color: #9a6700; }
.edv-method.m-delete { background: #ffe2e0; color: #cf222e; }

.edv-path {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 17px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.edv-biz {
  padding: 0 7px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  background: #eef2ff;
  color: #4338ca;
}

.edv-biz.lg {
  font-size: 12px;
  line-height: 22px;
  padding: 0 10px;
}

.edv-pager {
  justify-content: center;
  margin-top: 4px;
}

.edv-detail {
  min-width: 0;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}

.edv-detail-empty {
  padding: 40px 0;
}

.edv-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edv-head-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edv-head-path {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.edv-head-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.edv-head-sum {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.edv-file {
  margin-left: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.edv-consumers {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.edv-consumers-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 1100px) {
  .edv {
    grid-template-columns: 1fr;
  }

  .edv-list {
    position: static;
    max-height: none;
  }
}
</style>
