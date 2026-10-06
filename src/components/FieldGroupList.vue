<template>
  <ul class="fg-list">
    <li v-for="(g, i) in groups" :key="g.effect + i" class="fg-item" :class="toneOf(g)">
      <div class="fg-head" :class="{ clickable: canToggle(g) }" @click="canToggle(g) && toggle(i)">
        <el-icon v-if="canToggle(g)" class="fg-arrow" :class="{ open: isOpen(g, i) }"><ArrowRight /></el-icon>
        <span v-else class="fg-dot" />
        <span class="fg-headline">{{ g.headline }}</span>
      </div>
      <div v-if="g.action" class="fg-action">{{ g.action }}</div>
      <div v-if="isOpen(g, i) && g.fields?.length" class="fg-fields">
        <el-tooltip
          v-for="name in g.fields"
          :key="name"
          :disabled="!tipOf(name)"
          :content="tipOf(name)"
          placement="top"
          :show-after="200"
        >
          <span class="fg-field" :class="fieldTone(name)">
            {{ name }}<span v-if="typeOf(name)" class="fg-type">{{ typeOf(name) }}</span>
          </span>
        </el-tooltip>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'

export interface FieldGroup {
  effect: string
  count: number
  fields: string[]
  headline: string
  action: string
  breaking: boolean
  collapse: boolean
}

const props = defineProps<{
  groups: FieldGroup[]
  /** 逐字段差异，展开后按名字取类型和 wireNote */
  fields?: any[]
}>()

const toggled = ref<Set<number>>(new Set())
watch(() => props.groups, () => { toggled.value = new Set() })

const byName = computed(() => {
  const m = new Map<string, any>()
  for (const f of props.fields || []) {
    if (f?.name && !m.has(f.name)) m.set(f.name, f)
  }
  return m
})

function canToggle(g: FieldGroup) {
  return (g.fields?.length || 0) > 0
}

function isOpen(g: FieldGroup, i: number) {
  return toggled.value.has(i) ? g.collapse : !g.collapse
}

function toggle(i: number) {
  const next = new Set(toggled.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  toggled.value = next
}

function toneOf(g: FieldGroup) {
  if (g.breaking) return 'tone-danger'
  if (g.effect === 'NULLABILITY') return 'tone-warn'
  return 'tone-muted'
}

function fieldTone(name: string) {
  const f = byName.value.get(name)
  if (!f) return ''
  if (f.changeType === 'REMOVED') return 'tone-danger'
  if (f.changeType === 'ADDED') return 'tone-muted'
  const w = f.wireEffect || 'UNKNOWN'
  if (w === 'SHAPE' || w === 'UNKNOWN') return 'tone-danger'
  if (w === 'NULLABILITY') return 'tone-warn'
  return 'tone-muted'
}

function typeOf(name: string) {
  const f = byName.value.get(name)
  if (!f) return ''
  if (f.changeType === 'TYPE_CHANGED') return `${f.oldType} → ${f.newType}`
  return f.newType || f.oldType || ''
}

function tipOf(name: string) {
  const f = byName.value.get(name)
  if (!f) return ''
  return [f.comment, f.wireNote].filter(Boolean).join(' · ')
}
</script>

<style scoped>
.fg-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}

.fg-item + .fg-item {
  margin-top: 6px;
}

.fg-head {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.7;
}

.fg-head.clickable {
  cursor: pointer;
}

.fg-head.clickable:hover .fg-headline {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.fg-arrow {
  font-size: 12px;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.fg-arrow.open {
  transform: rotate(90deg);
}

.fg-dot {
  width: 6px;
  height: 6px;
  margin: 0 3px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.fg-headline {
  font-weight: 500;
}

.fg-action {
  margin: 1px 0 0 18px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fg-action::before {
  content: '→ ';
}

.fg-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 4px 0 0 18px;
}

.fg-field {
  padding: 0 6px;
  border-radius: 4px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 20px;
  background: var(--el-fill-color-light);
  color: var(--app-text-regular);
}

.fg-type {
  margin-left: 6px;
  color: var(--el-text-color-placeholder);
}

.tone-danger > .fg-head,
.fg-field.tone-danger {
  color: var(--app-danger);
}

.tone-warn > .fg-head,
.fg-field.tone-warn {
  color: var(--app-warning);
}

.tone-muted > .fg-head,
.fg-field.tone-muted {
  color: var(--el-text-color-secondary);
}
</style>
