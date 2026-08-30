<template>
  <div class="kv">
    <div v-for="(r, i) in rows" :key="i" class="kv-row">
      <el-checkbox v-model="r.enabled" />
      <el-input
        v-model="r.key"
        size="small"
        :placeholder="keyPh"
        class="kv-k"
        @input="onFieldInput(i)"
      />
      <el-input
        v-model="r.value"
        size="small"
        :placeholder="valPh"
        class="kv-v"
        @input="onFieldInput(i)"
      />
      <div class="kv-ops">
        <el-button
          size="small"
          text
          type="danger"
          :disabled="isOnlyEmptyRow"
          @click="remove(i)"
        >
          删
        </el-button>
        <el-button size="small" text type="primary" @click="insertAfter(i)">+</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export type KvRow = { enabled: boolean; key: string; value: string }

const props = defineProps<{
  modelValue: KvRow[]
  keyPh?: string
  valPh?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: KvRow[]): void }>()

const rows = ref<KvRow[]>([])

const isOnlyEmptyRow = computed(
  () => rows.value.length === 1 && isBlank(rows.value[0])
)

function isBlank(r?: KvRow) {
  return !r?.key.trim() && !r?.value.trim()
}

function blankRow(): KvRow {
  return { enabled: false, key: '', value: '' }
}

function syncEnabled(row: KvRow) {
  row.enabled = !!row.key.trim()
}

function normalizeRows() {
  for (const r of rows.value) {
    syncEnabled(r)
  }
}

/** 末尾保留且仅保留一个空行 */
function ensureEmptyTail() {
  while (rows.value.length > 1) {
    const n = rows.value.length
    if (isBlank(rows.value[n - 1]) && isBlank(rows.value[n - 2])) {
      rows.value.splice(n - 2, 1)
      continue
    }
    break
  }
  if (!rows.value.length || !isBlank(rows.value[rows.value.length - 1])) {
    rows.value.push(blankRow())
  }
}

function onFieldInput(i: number) {
  syncEnabled(rows.value[i])
  ensureEmptyTail()
}

function insertAfter(i: number) {
  rows.value.splice(i + 1, 0, blankRow())
  ensureEmptyTail()
}

function remove(i: number) {
  if (rows.value.length === 1 && isBlank(rows.value[0])) return
  rows.value.splice(i, 1)
  normalizeRows()
  ensureEmptyTail()
}

function syncFromParent(v: KvRow[] | undefined) {
  rows.value = (v || []).map((r) => ({
    enabled: !!r.enabled,
    key: r.key || '',
    value: r.value || ''
  }))
  normalizeRows()
  ensureEmptyTail()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v === rows.value) return
    syncFromParent(v)
  },
  { immediate: true }
)

watch(rows, () => emit('update:modelValue', rows.value), { deep: true })
</script>

<style scoped>
.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.kv-k {
  width: 190px;
}

.kv-v {
  flex: 1;
  min-width: 120px;
}

.kv-ops {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0;
}

.kv-ops .el-button {
  min-width: 28px;
  padding: 0 4px;
  margin: 0;
}
</style>
