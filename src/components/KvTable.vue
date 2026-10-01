<template>
  <div class="kv">
    <div class="kv-row kv-head">
      <span class="kv-c">用</span>
      <span class="kv-k">{{ keyPh || '名称' }}</span>
      <span class="kv-v">{{ valPh || '值' }}</span>
      <span class="kv-ops">操作</span>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="kv-row">
      <span class="kv-c"><el-checkbox v-model="r.enabled" /></span>
      <el-input v-model="r.key" :placeholder="keyPh" class="kv-k" @input="onFieldInput(i)" />

      <div v-if="variables && varRef(r.value)" class="kv-v kv-var" :class="varState(r.value)">
        <span class="kv-var-badge">变量</span>
        <span class="kv-var-name">{{ varRef(r.value) }}</span>
        <span class="kv-var-preview" :title="previewTitle(r.value)">{{ previewText(r.value) }}</span>
        <el-popover
          trigger="click"
          placement="bottom-end"
          :width="380"
          popper-class="kv-var-popper"
          :ref="(el: any) => (pops[i] = el)"
          @show="pickerKeyword = ''; pickingRow = i"
        >
          <template #reference>
            <button type="button" class="kv-var-btn" title="换一个变量">换</button>
          </template>
          <VarPicker />
        </el-popover>
        <button type="button" class="kv-var-btn" title="改成手动填写" @click="toManual(i)">手填</button>
      </div>
      <el-input v-else v-model="r.value" :placeholder="valPh" class="kv-v" @input="onFieldInput(i)">
        <template v-if="variables" #suffix>
          <el-popover
            trigger="click"
            placement="bottom-end"
            :width="380"
            popper-class="kv-var-popper"
            :ref="(el: any) => (pops[i] = el)"
            @show="pickerKeyword = ''; pickingRow = i"
          >
            <template #reference>
              <button type="button" class="kv-pick" title="从环境变量取值" @click="pickingRow = i">{x}</button>
            </template>
            <VarPicker />
          </el-popover>
        </template>
      </el-input>

      <div class="kv-ops">
        <button type="button" class="kv-btn is-del" title="删除" :disabled="isOnlyEmptyRow" @click="remove(i)">
          <el-icon><Delete /></el-icon>
        </button>
        <button type="button" class="kv-btn" title="在下方新增一行" @click="insertAfter(i)">
          <el-icon><Plus /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElInput } from 'element-plus'

export type KvRow = { enabled: boolean; key: string; value: string }

/** 可选的变量：同名变量在测试 / 线上各有一个值；builtin 表示执行时才有（如自动登录拿到的 token） */
export type KvVariable = { name: string; test?: string; prod?: string; secret?: boolean; builtin?: string }

const props = defineProps<{
  modelValue: KvRow[]
  keyPh?: string
  valPh?: string
  /** 传了才显示「从环境变量取」 */
  variables?: KvVariable[]
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: KvRow[]): void }>()

const rows = ref<KvRow[]>([])
const pickingRow = ref(-1)
const pickerKeyword = ref('')
const pops: Record<number, any> = {}

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

// ---------- 变量 ----------

const VAR_ONLY = /^\s*\{\{\s*([\w.$\-]+)\s*\}\}\s*$/

/** 值整个就是一个 {{name}} 时返回 name；混着别的文字的按普通文本编辑 */
function varRef(v: string) {
  return VAR_ONLY.exec(v || '')?.[1] || ''
}

function varOf(v: string) {
  const name = varRef(v)
  return (props.variables || []).find((x) => x.name === name)
}

function varState(v: string) {
  const hit = varOf(v)
  if (!hit) return 'is-missing'
  if (hit.builtin) return 'is-builtin'
  return ''
}

function short(s?: string) {
  if (s == null || s === '') return '空'
  return s.length > 18 ? s.slice(0, 8) + '…' + s.slice(-6) : s
}

function shown(x: KvVariable, s?: string) {
  return x.secret && s ? '••••••' : short(s)
}

function previewText(v: string) {
  const x = varOf(v)
  if (!x) return '环境变量里没有，需前面的用例 extract 出来'
  if (x.builtin) return x.builtin
  if (x.test === x.prod) return shown(x, x.test)
  return `测试 ${x.test != null ? shown(x, x.test) : '未配'} · 线上 ${x.prod != null ? shown(x, x.prod) : '未配'}`
}

function previewTitle(v: string) {
  const x = varOf(v)
  if (!x || x.builtin || x.secret) return previewText(v)
  return `测试：${x.test ?? '未配'}\n线上：${x.prod ?? '未配'}`
}

function applyVar(name: string) {
  const r = rows.value[pickingRow.value]
  if (!r) return
  r.value = `{{${name}}}`
  if (!r.key.trim() && /^[A-Za-z_]\w*$/.test(name)) r.key = name
  syncEnabled(r)
  pops[pickingRow.value]?.hide?.()
  ensureEmptyTail()
}

function toManual(i: number) {
  const r = rows.value[i]
  const x = varOf(r.value)
  r.value = x && !x.secret && !x.builtin ? x.test ?? x.prod ?? '' : ''
}

const filteredVars = computed(() => {
  const kw = pickerKeyword.value.trim().toLowerCase()
  const list = props.variables || []
  return kw ? list.filter((x) => x.name.toLowerCase().includes(kw)) : list
})

/** 两个输入框共用同一块选择面板，写成内联组件免得模板里抄两遍 */
const VarPicker = defineComponent({
  setup() {
    return () =>
      h('div', { class: 'kv-picker' }, [
        h(ElInput, {
          modelValue: pickerKeyword.value,
          'onUpdate:modelValue': (v: string) => (pickerKeyword.value = v),
          size: 'small',
          placeholder: '搜变量名',
          clearable: true
        }),
        h(
          'div',
          { class: 'kv-picker-list' },
          filteredVars.value.length
            ? filteredVars.value.map((x) =>
                h('button', { type: 'button', class: 'kv-picker-item', onClick: () => applyVar(x.name) }, [
                  h('span', { class: 'kv-picker-name' }, x.name),
                  h(
                    'span',
                    { class: 'kv-picker-val' },
                    x.builtin
                      ? x.builtin
                      : x.test === x.prod
                        ? shown(x, x.test)
                        : `测试 ${x.test != null ? shown(x, x.test) : '未配'} · 线上 ${x.prod != null ? shown(x, x.prod) : '未配'}`
                  )
                ])
              )
            : [h('div', { class: 'kv-picker-empty' }, '没有匹配的变量')]
        ),
        h('div', { class: 'kv-picker-foot' }, '变量在「环境变量」页维护；测试 / 线上执行时各取各的值')
      ])
  }
})

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
.kv {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.kv-row + .kv-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.kv-head {
  padding-top: 9px;
  padding-bottom: 9px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-regular);
}

.kv-c {
  display: inline-flex;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
}

.kv-k,
.kv-v {
  flex: 1;
  min-width: 0;
}

.kv-row :deep(.el-input__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.kv-pick {
  border: none;
  background: transparent;
  padding: 0 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.kv-pick:hover {
  color: var(--el-color-primary);
}

.kv-var {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 6px 0 8px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  font-size: 12px;
  overflow: hidden;
}

.kv-var.is-builtin {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}

.kv-var.is-missing {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-warning-light-9);
}

.kv-var-badge {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  color: #fff;
  background: var(--el-color-primary);
}

.kv-var.is-builtin .kv-var-badge {
  background: var(--el-color-success);
}

.kv-var.is-missing .kv-var-badge {
  background: var(--el-color-warning);
}

.kv-var-name {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.kv-var-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.kv-var-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 2px 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  border-radius: 4px;
}

.kv-var-btn:hover {
  background: rgba(51, 112, 255, 0.08);
}

.kv-ops {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  flex-shrink: 0;
  gap: 2px;
}

.kv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 15px;
}

.kv-btn:hover:not(:disabled) {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.kv-btn.is-del:hover:not(:disabled) {
  color: var(--el-color-danger);
}

.kv-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>

<style>
.kv-var-popper .kv-picker-list {
  max-height: 260px;
  overflow: auto;
  margin: 8px -4px 0;
}

.kv-var-popper .kv-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.kv-var-popper .kv-picker-item:hover {
  background: #f2f6ff;
}

.kv-var-popper .kv-picker-name {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.kv-var-popper .kv-picker-val {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

.kv-var-popper .kv-picker-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.kv-var-popper .kv-picker-foot {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}
</style>
