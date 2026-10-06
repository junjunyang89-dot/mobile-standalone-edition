<template>
  <div class="fdt">
    <div class="fdt-bar">
      <div class="fdt-filter" role="tablist">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="fdt-chip"
          :class="[`is-${f.tone}`, { active: kindFilter === f.key }]"
          :disabled="!f.count && f.key !== 'ALL'"
          @click="kindFilter = f.key"
        >
          {{ f.label }} <b>{{ f.count }}</b>
        </button>
        <el-checkbox v-if="marks" v-model="onlyTodo" size="small" class="fdt-todo">只看未确认</el-checkbox>
      </div>
      <div class="fdt-actions">
        <template v-if="selected.length">
          <span class="fdt-muted">已选 {{ selected.length }}</span>
          <el-button v-if="marks" size="small" @click="openTag(selected)">关联页面/模块</el-button>
          <el-button v-if="marks" size="small" @click="confirm(selected, true)">标记已确认</el-button>
          <el-button v-if="canAssert" size="small" type="primary" plain @click="openAssert(selected)">转为断言</el-button>
        </template>
        <template v-else-if="marks && rows.length">
          <span class="fdt-muted">已确认 {{ confirmedCount }}/{{ rows.length }}</span>
          <el-button v-if="confirmedCount < rows.length" size="small" link type="primary" @click="confirm(rows, true)">
            全部标记已确认
          </el-button>
        </template>
        <slot name="extra" />
      </div>
    </div>

    <el-empty v-if="!rows.length" :description="emptyText || '没有变化'" :image-size="48" />
    <div v-else-if="!groups.length" class="fdt-muted fdt-none">筛选条件下没有字段</div>

    <section v-for="g in groups" :key="g.kind" class="fdt-group" :class="`is-${g.tone}`">
      <header class="fdt-group-head">
        <span class="fdt-sign">{{ g.icon }}</span>
        <b>{{ g.label }}</b>
        <span class="fdt-count">{{ g.rows.length }}</span>
      </header>
      <el-table
        :data="g.rows"
        size="small"
        row-key="key"
        :row-class-name="rowClass"
        class="fdt-table"
        @selection-change="(v: DiffRow[]) => onSelect(g.kind, v)"
      >
        <el-table-column type="selection" width="36" />
        <el-table-column label="位置" width="86">
          <template #default="{ row }">
            <span class="fdt-loc" :class="`loc-${row.location.toLowerCase()}`">{{ LOCATION_LABEL[row.location] || row.location }}</span>
          </template>
        </el-table-column>
        <el-table-column label="字段" min-width="200">
          <template #default="{ row }">
            <div class="fdt-name">
              <code :class="{ struck: row.kind === 'REMOVED' }">{{ row.name }}</code>
              <span v-if="row.treePath !== row.name" class="fdt-tree">{{ row.treePath }}</span>
            </div>
            <div v-if="row.comment" class="fdt-comment">{{ row.comment }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型 / 属性" min-width="170">
          <template #default="{ row }">
            <span v-if="row.changeType === 'TYPE_CHANGED'" class="fdt-type">
              <del>{{ row.oldType }}</del><span class="fdt-arrow">→</span><b>{{ row.newType }}</b>
            </span>
            <span v-else class="fdt-type">{{ row.newType || row.oldType || '' }}</span>
            <template v-if="row.side === 'REQUEST' && row.required !== undefined">
              <span v-if="row.changeType === 'REQUIRED_CHANGED'" class="fdt-req changed">
                {{ row.required ? '可选 → 必填' : '必填 → 可选' }}
              </span>
              <span v-else class="fdt-req" :class="{ must: row.required }">{{ row.required ? '必填' : '可选' }}</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="影响" width="118">
          <template #default="{ row }">
            <el-tooltip :disabled="!row.wireNote" :content="row.wireNote" placement="top">
              <span v-if="row.breaking" class="fdt-impact danger">可能不兼容</span>
              <span v-else-if="row.wireEffect" class="fdt-impact" :class="{ warn: row.wireEffect === 'NULLABILITY' }">
                {{ WIRE_LABEL[row.wireEffect] || row.wireEffect }}
              </span>
              <span v-else class="fdt-muted">—</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column v-if="marks" label="业务标签" min-width="140">
          <template #default="{ row }">
            <button v-if="marks.tagOf(endpoint!, row)" type="button" class="fdt-tag" @click="openTag([row])">
              {{ marks.tagOf(endpoint!, row) }}
            </button>
            <button v-else type="button" class="fdt-tag empty" @click="openTag([row])">＋ 关联</button>
          </template>
        </el-table-column>
        <el-table-column label="" :width="canAssert ? 170 : 96" align="right">
          <template #default="{ row }">
            <el-button v-if="canAssert" link type="primary" size="small" @click="openAssert([row])">转为断言</el-button>
            <template v-if="marks">
              <el-button
                v-if="marks.isConfirmed(endpoint!, row)"
                link
                type="success"
                size="small"
                title="点一下撤销"
                @click="confirm([row], false)"
              >✓ 已确认</el-button>
              <el-button v-else link size="small" @click="confirm([row], true)">确认</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <FieldTagDialog v-model="tagOpen" :rows="tagRows" :endpoint="endpoint" :marks="marks" />

    <FieldAssertDialog v-model="assertOpen" :project="project" :endpoint="endpoint" :rows="assertRows" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import FieldAssertDialog from '@/components/FieldAssertDialog.vue'
import FieldTagDialog from '@/components/FieldTagDialog.vue'
import { KIND_META, LOCATION_LABEL, WIRE_LABEL, type DiffKind, type DiffRow } from '@/utils/fieldDiff'
import type { EndpointRef, FieldMarks } from '@/composables/useFieldMarks'

const props = defineProps<{
  rows: DiffRow[]
  project: string
  /** 标签、确认、断言都挂在接口上；孤立 DTO 传 { method: 'DTO', path: 类名 } */
  endpoint: EndpointRef | null
  marks?: FieldMarks | null
  /** 返回字段才能转断言，且得是真接口 */
  canAssert?: boolean
  emptyText?: string
}>()

const KINDS: DiffKind[] = ['ADDED', 'MODIFIED', 'REMOVED']
const kindFilter = ref<'ALL' | DiffKind>('ALL')
const onlyTodo = ref(false)
const selection = reactive<Record<string, DiffRow[]>>({})

const marks = computed(() => (props.endpoint && props.marks ? props.marks : null))

const filters = computed(() => [
  { key: 'ALL' as const, label: '全部', tone: 'all', count: props.rows.length },
  ...KINDS.map((k) => ({
    key: k,
    label: KIND_META[k].label,
    tone: KIND_META[k].tone,
    count: props.rows.filter((r) => r.kind === k).length
  }))
])

const confirmedCount = computed(() =>
  marks.value ? props.rows.filter((r) => marks.value!.isConfirmed(props.endpoint!, r)).length : 0
)

const groups = computed(() =>
  KINDS.filter((k) => kindFilter.value === 'ALL' || kindFilter.value === k)
    .map((k) => ({
      kind: k,
      ...KIND_META[k],
      rows: props.rows.filter(
        (r) => r.kind === k && !(onlyTodo.value && marks.value?.isConfirmed(props.endpoint!, r))
      )
    }))
    .filter((g) => g.rows.length)
)

const selected = computed(() => KINDS.flatMap((k) => selection[k] || []))

function onSelect(kind: string, v: DiffRow[]) {
  selection[kind] = v
}

function rowClass({ row }: { row: DiffRow }) {
  const done = marks.value?.isConfirmed(props.endpoint!, row)
  return `fdt-row-${KIND_META[row.kind].tone}${done ? ' fdt-row-done' : ''}`
}

watch(
  () => props.rows,
  () => {
    kindFilter.value = 'ALL'
    for (const k of Object.keys(selection)) delete selection[k]
  }
)

async function confirm(rows: DiffRow[], value: boolean) {
  if (!marks.value) return
  try {
    await marks.value.setConfirmed(props.endpoint!, rows, value)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

const tagOpen = ref(false)
const tagRows = ref<DiffRow[]>([])

function openTag(rows: DiffRow[]) {
  if (!marks.value) return
  tagRows.value = rows
  tagOpen.value = true
}

const assertOpen = ref(false)
const assertRows = ref<DiffRow[]>([])

function openAssert(rows: DiffRow[]) {
  assertRows.value = rows
  assertOpen.value = true
}
</script>

<style scoped>
.fdt {
  --diff-add: #1a7f37;
  --diff-add-bg: #dafbe1;
  --diff-add-soft: #f0fff4;
  --diff-mod: #9a6700;
  --diff-mod-bg: #fff1c2;
  --diff-mod-soft: #fffbea;
  --diff-del: #cf222e;
  --diff-del-bg: #ffe2e0;
  --diff-del-soft: #fff5f5;
}

.fdt-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.fdt-filter,
.fdt-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fdt-chip {
  padding: 2px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.fdt-chip b {
  margin-left: 2px;
}

.fdt-chip:disabled {
  opacity: 0.45;
  cursor: default;
}

.fdt-chip.is-added b { color: var(--diff-add); }
.fdt-chip.is-modified b { color: var(--diff-mod); }
.fdt-chip.is-removed b { color: var(--diff-del); }

.fdt-chip.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.fdt-todo {
  margin-left: 8px;
}

.fdt-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fdt-none {
  padding: 16px 0;
  text-align: center;
}

.fdt-group {
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

.fdt-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 13px;
}

.fdt-group.is-added .fdt-group-head { background: var(--diff-add-bg); color: var(--diff-add); }
.fdt-group.is-modified .fdt-group-head { background: var(--diff-mod-bg); color: var(--diff-mod); }
.fdt-group.is-removed .fdt-group-head { background: var(--diff-del-bg); color: var(--diff-del); }

.fdt-sign {
  width: 16px;
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 700;
  text-align: center;
}

.fdt-count {
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.fdt-table :deep(.fdt-row-added td.el-table__cell) { background: var(--diff-add-soft); }
.fdt-table :deep(.fdt-row-modified td.el-table__cell) { background: var(--diff-mod-soft); }
.fdt-table :deep(.fdt-row-removed td.el-table__cell) { background: var(--diff-del-soft); }
.fdt-table :deep(.fdt-row-done td.el-table__cell) { opacity: 0.62; }

.fdt-loc {
  display: inline-block;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11.5px;
  line-height: 18px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}

.fdt-loc.loc-query { background: #e8f1ff; color: #1f5fbf; }
.fdt-loc.loc-body { background: #f3e8ff; color: #7a3fbf; }
.fdt-loc.loc-path { background: #e6f7f5; color: #11766a; }
.fdt-loc.loc-header { background: #f2f2f2; color: #555; }
.fdt-loc.loc-response { background: #fff0e6; color: #b45309; }

.fdt-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.fdt-name code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.fdt-name code.struck {
  text-decoration: line-through;
  color: var(--diff-del);
}

.fdt-tree {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.fdt-comment {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fdt-type {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
}

.fdt-type del {
  color: var(--diff-del);
}

.fdt-type b {
  color: var(--diff-add);
  font-weight: 600;
}

.fdt-arrow {
  margin: 0 4px;
  color: var(--el-text-color-placeholder);
}

.fdt-req {
  margin-left: 6px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.fdt-req.must { color: var(--diff-del); }
.fdt-req.changed { color: var(--diff-mod); font-weight: 600; }

.fdt-impact {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fdt-impact.danger { color: var(--diff-del); font-weight: 600; }
.fdt-impact.warn { color: var(--diff-mod); }

.fdt-tag {
  max-width: 100%;
  padding: 1px 8px;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  background: #eef2ff;
  font-size: 12px;
  color: #4338ca;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fdt-tag.empty {
  border-style: dashed;
  border-color: var(--el-border-color);
  background: transparent;
  color: var(--el-text-color-placeholder);
}
</style>
