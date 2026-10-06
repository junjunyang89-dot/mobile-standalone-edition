<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="640px"
    destroy-on-close
    class="db-bind-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @opened="load"
  >
    <p class="hint">勾选这个项目在测试 / 线上要查的库。库要先在「数据库」里建好。</p>

    <el-tabs v-model="env">
      <el-tab-pane v-for="tab in TABS" :key="tab.id" :name="tab.id">
        <template #label>
          {{ tab.label }}
          <span v-if="picked[tab.id].length" class="tab-n">{{ picked[tab.id].length }}</span>
        </template>
      </el-tab-pane>
    </el-tabs>

    <div class="toolbar">
      <el-input
        v-model="query[env]"
        class="search"
        clearable
        placeholder="搜索库名或地址…"
        :prefix-icon="Search"
        :disabled="!listOf(env).length"
      />
      <span class="picked-pill">
        已选 <b>{{ picked[env].length }}</b>
      </span>
      <button type="button" class="text-btn" :disabled="!filtered(env).length" @click="selectAll(env)">全选</button>
      <button type="button" class="text-btn" :disabled="!picked[env].length" @click="clearPicked(env)">清空</button>
    </div>

    <div v-if="!listOf(env).length" class="empty-box">
      还没有{{ envLabel }}库，先去
      <button type="button" class="link" @click="emit('open-catalog')">「数据库」新建 ›</button>
    </div>
    <div v-else-if="!filtered(env).length" class="empty-box">没有匹配的库</div>
    <div v-else class="list">
      <button
        v-for="c in pageRows"
        :key="c.id"
        type="button"
        class="row"
        :class="{ on: isPicked(env, c.id) }"
        @click="toggle(env, c.id)"
      >
        <el-checkbox :model-value="isPicked(env, c.id)" @click.stop="toggle(env, c.id)" />
        <span class="name">{{ c.name }}</span>
        <span class="host">{{ c.dbHost }}</span>
        <span v-if="dbNameTag(c)" class="db-tag">库名 {{ dbNameTag(c) }}</span>
        <span v-if="isPicked(env, c.id)" class="bound">已关联</span>
      </button>
    </div>
    <div v-if="filtered(env).length > PAGE_SIZE" class="pager">
      <el-pagination
        v-model:current-page="page[env]"
        :page-size="PAGE_SIZE"
        :total="filtered(env).length"
        layout="prev, pager, next"
        size="small"
        background
      />
    </div>

    <template #footer>
      <div class="foot">
        <span class="foot-count">已选 {{ totalPicked }} 个库</span>
        <div class="foot-right">
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button v-perm:write type="primary" :loading="saving" @click="save">
            保存关联{{ totalPicked ? ` (${totalPicked})` : '' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { apiClient, type DbConnection } from '../api'

const TABS = [
  { id: 'TEST', label: '测试' },
  { id: 'PROD', label: '线上' }
]
const PAGE_SIZE = 10

const props = defineProps<{
  modelValue: boolean
  project: { code: string; name?: string } | null
  catalogRev?: number
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
  'open-catalog': []
}>()

const env = ref('TEST')
const all = ref<DbConnection[]>([])
const picked = reactive<Record<string, string[]>>({ TEST: [], PROD: [] })
const query = reactive<Record<string, string>>({ TEST: '', PROD: '' })
const page = reactive<Record<string, number>>({ TEST: 1, PROD: 1 })
const saving = ref(false)

const title = computed(() => {
  const p = props.project
  if (!p) return '关联库'
  return `关联库 · ${p.code}`
})

const envLabel = computed(() => TABS.find((t) => t.id === env.value)?.label || '')
const totalPicked = computed(() => picked.TEST.length + picked.PROD.length)

const pageRows = computed(() => {
  const rows = filtered(env.value)
  const max = Math.max(1, Math.ceil(rows.length / PAGE_SIZE) || 1)
  const cur = Math.min(page[env.value] || 1, max)
  const start = (cur - 1) * PAGE_SIZE
  return rows.slice(start, start + PAGE_SIZE)
})

function listOf(e: string) {
  return all.value.filter((c) => c.environment === e)
}

function filtered(e: string) {
  const q = (query[e] || '').trim().toLowerCase()
  const rows = listOf(e)
  if (!q) return rows
  return rows.filter((c) => {
    const name = (c.name || '').toLowerCase()
    const host = (c.dbHost || '').toLowerCase()
    const db = (c.dbName || '').toLowerCase()
    return name.includes(q) || host.includes(q) || db.includes(q)
  })
}

function isPicked(environment: string, id: string) {
  return picked[environment].includes(id)
}

function toggle(environment: string, id: string) {
  const i = picked[environment].indexOf(id)
  if (i >= 0) picked[environment].splice(i, 1)
  else picked[environment].push(id)
}

function selectAll(environment: string) {
  const ids = filtered(environment).map((c) => c.id)
  const set = new Set(picked[environment])
  ids.forEach((id) => set.add(id))
  picked[environment] = [...set]
}

function clearPicked(environment: string) {
  const hide = new Set(filtered(environment).map((c) => c.id))
  picked[environment] = picked[environment].filter((id) => !hide.has(id))
}

function dbNameTag(c: DbConnection) {
  const name = (c.name || '').trim()
  const db = (c.dbName || '').trim()
  if (!db || db.toLowerCase() === name.toLowerCase()) return ''
  return db
}

function boundIds(environment: string, code: string) {
  const key = code.toLowerCase()
  return listOf(environment)
    .filter((c) => (c.projects || []).some((p) => p.toLowerCase() === key))
    .map((c) => c.id)
}

async function load() {
  if (!props.project) return
  query.TEST = ''
  query.PROD = ''
  page.TEST = 1
  page.PROD = 1
  env.value = 'TEST'
  try {
    all.value = await apiClient.listDbConnections()
    picked.TEST = boundIds('TEST', props.project.code)
    picked.PROD = boundIds('PROD', props.project.code)
  } catch (e: any) {
    all.value = []
    ElMessage.error(e?.message || '加载数据库失败')
  }
}

async function save() {
  if (!props.project) return
  saving.value = true
  try {
    await apiClient.bindProjectDbConnections(props.project.code, 'TEST', picked.TEST)
    try {
      await apiClient.bindProjectDbConnections(props.project.code, 'PROD', picked.PROD)
    } catch (e: any) {
      ElMessage.warning('测试环境已保存；线上：' + (e?.message || '没权限或失败'))
      emit('saved')
      emit('update:modelValue', false)
      return
    }
    ElMessage.success('已保存关联')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.catalogRev,
  () => {
    if (props.modelValue) load()
  }
)

watch(() => query.TEST, () => {
  page.TEST = 1
})
watch(() => query.PROD, () => {
  page.PROD = 1
})
</script>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
:deep(.el-tabs__content) {
  display: none;
}
:deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.tab-n {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 10px;
}
.search {
  flex: 1;
  min-width: 0;
}
.search :deep(.el-input__wrapper) {
  border-radius: 8px;
}
.picked-pill {
  flex: none;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 999px;
  padding: 2px 8px;
}
.picked-pill b {
  margin-left: 2px;
}
.text-btn {
  flex: none;
  border: none;
  background: none;
  padding: 0 2px;
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 13px;
}
.text-btn:disabled {
  color: var(--el-text-color-placeholder);
  cursor: default;
}
.empty-box {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.link {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 13px;
}
.list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.row:last-child {
  border-bottom: none;
}
.row:hover {
  background: var(--el-fill-color-lighter);
}
.row.on {
  background: #edf4ff;
}
.name {
  flex: none;
  font-weight: 650;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.host {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, Menlo, monospace;
}
.db-tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 4px;
  border: 1px solid #f3d19e;
  background: #fdf6ec;
  color: #b88230;
  font-size: 11px;
}
.bound {
  flex: none;
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.foot-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.foot-right {
  display: flex;
  gap: 8px;
}
</style>
