<template>
  <el-popover
    v-model:visible="open"
    trigger="click"
    placement="bottom-start"
    :width="420"
    :show-arrow="false"
    :offset="4"
    :popper-style="{ padding: 0, borderRadius: '12px', overflow: 'hidden' }"
    @show="onShow"
  >
    <template #reference>
      <button type="button" class="pcs-trigger" :class="{ 'is-open': open }" :style="{ width }">
        <span v-if="selected" class="pcs-value">{{ labelOf(selected.project) }}</span>
        <span v-else class="pcs-placeholder">{{ placeholder }}</span>
        <el-icon class="pcs-arrow" :class="{ 'is-open': open }"><ArrowDown /></el-icon>
      </button>
    </template>

    <div class="pcs" @keydown="onKeydown">
      <div class="pcs-search">
        <el-icon class="pcs-search-icon"><Search /></el-icon>
        <input ref="searchRef" v-model="keyword" class="pcs-search-input" placeholder="搜索项目…" />
      </div>
      <div class="pcs-body">
        <div class="pcs-groups">
          <button
            v-for="(g, gi) in filteredGroups"
            :key="g.key"
            type="button"
            class="pcs-group"
            :class="{ active: gi === groupIdx }"
            @mouseenter="switchGroup(gi)"
            @click="switchGroup(gi)"
          >
            <span class="pcs-dot" :style="{ background: dotColor(g.key) }" />
            <span class="pcs-group-label">{{ g.label }}</span>
            <span class="pcs-group-count">{{ g.projects.length }}</span>
            <span class="pcs-chevron">›</span>
          </button>
          <div v-if="!filteredGroups.length" class="pcs-empty">没有匹配的项目</div>
        </div>
        <div ref="listRef" class="pcs-list">
          <button
            v-for="(p, pi) in currentProjects"
            :key="p.code"
            type="button"
            class="pcs-item"
            :class="{
              hover: pi === itemIdx,
              selected: p.code === modelValue,
              disabled: isDisabled(p)
            }"
            :data-idx="pi"
            :title="isDisabled(p) ? disabledReason : labelOf(p)"
            @mouseenter="itemIdx = pi"
            @click="pick(p)"
          >
            <span class="pcs-item-label">{{ labelOf(p) }}</span>
            <span v-if="isDisabled(p)" class="pcs-item-tip">{{ disabledReason }}</span>
            <span v-else-if="p.code === modelValue" class="pcs-check">✓</span>
          </button>
        </div>
      </div>
      <div class="pcs-foot">
        <span class="pcs-crumb">
          <template v-if="crumb">
            {{ crumb.group }}<span class="pcs-crumb-sep">›</span>{{ crumb.project }}
          </template>
        </span>
        <span class="pcs-keys">↑↓ 选择 · ←→ 切组 · ↵ 确认</span>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown, Search } from '@element-plus/icons-vue'

type Project = { code: string; name?: string; ready?: boolean; [k: string]: any }
type Group = { key: string; label: string; projects: Project[] }

const props = withDefaults(
  defineProps<{
    modelValue?: string
    groups: Group[]
    placeholder?: string
    width?: string
    /** 为 true 时 ready=false 的项目不可选 */
    requireReady?: boolean
    disabledReason?: string
  }>(),
  { modelValue: '', placeholder: '选择项目', width: '240px', requireReady: false, disabledReason: '没填 GitLab' }
)
const emit = defineEmits<{ 'update:modelValue': [string]; change: [string] }>()

const open = ref(false)
const keyword = ref('')
const groupIdx = ref(0)
const itemIdx = ref(-1)
const searchRef = ref<HTMLInputElement>()
const listRef = ref<HTMLElement>()

const DOTS = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']

function dotColor(key: string) {
  const i = props.groups.findIndex((g) => g.key === key)
  return DOTS[(i < 0 ? 0 : i) % DOTS.length]
}

function labelOf(p: Project) {
  return p.name || p.code
}

function isDisabled(p: Project) {
  return props.requireReady && p.ready === false
}

const filteredGroups = computed<Group[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  const groups = props.groups || []
  if (!kw) return groups.filter((g) => g.projects?.length)
  return groups
    .map((g) => ({
      ...g,
      projects: (g.projects || []).filter(
        (p) => p.code.toLowerCase().includes(kw) || String(p.name || '').toLowerCase().includes(kw)
      )
    }))
    .filter((g) => g.projects.length)
})

const currentProjects = computed(() => filteredGroups.value[groupIdx.value]?.projects || [])

const selected = computed(() => {
  for (const g of props.groups || []) {
    const p = (g.projects || []).find((x) => x.code === props.modelValue)
    if (p) return { group: g, project: p }
  }
  return null
})

const crumb = computed(() => {
  const g = filteredGroups.value[groupIdx.value]
  const p = currentProjects.value[itemIdx.value]
  if (g && p) return { group: g.label, project: labelOf(p) }
  if (selected.value) return { group: selected.value.group.label, project: labelOf(selected.value.project) }
  return null
})

function firstEnabled(list: Project[], from = 0, step = 1) {
  for (let i = from; i >= 0 && i < list.length; i += step) {
    if (!isDisabled(list[i])) return i
  }
  return -1
}

function onShow() {
  keyword.value = ''
  const gi = selected.value ? filteredGroups.value.findIndex((g) => g.key === selected.value!.group.key) : 0
  groupIdx.value = Math.max(0, gi)
  const pi = currentProjects.value.findIndex((p) => p.code === props.modelValue)
  itemIdx.value = pi >= 0 ? pi : firstEnabled(currentProjects.value)
  nextTick(() => {
    searchRef.value?.focus()
    scrollToItem()
  })
}

watch(keyword, () => {
  groupIdx.value = 0
  itemIdx.value = firstEnabled(currentProjects.value)
})

function switchGroup(gi: number) {
  if (gi === groupIdx.value) return
  groupIdx.value = gi
  itemIdx.value = firstEnabled(currentProjects.value)
  nextTick(() => listRef.value?.scrollTo({ top: 0 }))
}

function scrollToItem() {
  const el = listRef.value?.querySelector<HTMLElement>(`[data-idx="${itemIdx.value}"]`)
  el?.scrollIntoView({ block: 'nearest' })
}

function pick(p: Project) {
  if (isDisabled(p)) return
  open.value = false
  if (p.code !== props.modelValue) {
    emit('update:modelValue', p.code)
    emit('change', p.code)
  }
}

function onKeydown(e: KeyboardEvent) {
  const list = currentProjects.value
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    const next = firstEnabled(list, itemIdx.value + step, step)
    if (next >= 0) itemIdx.value = next
    nextTick(scrollToItem)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const n = filteredGroups.value.length
    if (!n) return
    switchGroup((groupIdx.value + (e.key === 'ArrowRight' ? 1 : -1) + n) % n)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const p = list[itemIdx.value]
    if (p) pick(p)
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<style scoped>
.pcs-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}
.pcs-trigger:hover {
  border-color: var(--el-border-color-hover);
}
.pcs-trigger.is-open {
  border-color: var(--el-color-primary);
}
.pcs-value,
.pcs-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pcs-value {
  color: var(--el-text-color-regular);
}
.pcs-placeholder {
  color: var(--el-text-color-placeholder);
}
.pcs-arrow {
  color: var(--el-text-color-placeholder);
  transition: transform 0.2s;
}
.pcs-arrow.is-open {
  transform: rotate(180deg);
}

.pcs {
  font-size: 13px;
}
.pcs-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.pcs-search-icon {
  color: var(--el-text-color-secondary);
}
.pcs-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.pcs-search-input::placeholder {
  color: var(--el-text-color-placeholder);
}
.pcs-body {
  display: flex;
  height: 288px;
}
.pcs-groups {
  width: 178px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
}
.pcs-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 12px 0 14px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.pcs-group:hover {
  background: var(--el-fill-color-light);
}
.pcs-group.active {
  background: #e8f0fe;
  color: var(--el-color-primary);
  font-weight: 600;
}
.pcs-group.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--el-color-primary);
}
.pcs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pcs-group-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pcs-group-count {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.pcs-group.active .pcs-group-count {
  color: var(--el-color-primary);
}
.pcs-chevron {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.pcs-list {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 4px 0;
}
.pcs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 14px;
  border: none;
  background: none;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.pcs-item.hover {
  background: var(--el-fill-color-light);
}
.pcs-item.selected {
  background: #e8f0fe;
  color: var(--el-color-primary);
  font-weight: 600;
}
.pcs-item.disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}
.pcs-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pcs-item-tip {
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  color: var(--el-color-danger);
}
.pcs-check {
  color: var(--el-color-primary);
}
.pcs-empty {
  padding: 16px 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.pcs-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 36px;
  padding: 0 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: #fafafa;
}
.pcs-crumb {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}
.pcs-crumb-sep {
  margin: 0 6px;
}
.pcs-keys {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
