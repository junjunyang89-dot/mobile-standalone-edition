<template>
  <div class="jn">
    <div
      class="jn-line"
      :class="{ 'is-fold': foldable, 'is-match': selfMatch }"
      @click="onLineClick"
    >
      <span v-if="foldable" class="jn-arrow">{{ open ? '▼' : '▶' }}</span>
      <span v-else class="jn-pad" />
      <template v-if="label !== undefined">
        <span class="jn-key" v-html="hl(label)" />
        <span class="jn-colon">: </span>
      </template>
      <template v-if="!foldable">
        <span :class="['jn-val', primKind]" v-html="hl(primText)" />
      </template>
      <template v-else-if="!open">
        <span class="jn-preview">{{ preview }}</span>
      </template>
      <template v-else>
        <span class="jn-preview">{{ isArr ? '[' : '{' }}</span>
      </template>
    </div>
    <div v-if="foldable && open" class="jn-kids">
      <CaptureJsonNode
        v-for="child in kids"
        :key="child.path"
        :value="child.value"
        :label="child.label"
        :path="child.path"
        :collapsed="collapsed"
        :query="query"
        @toggle="emit('toggle', $event)"
      />
      <div class="jn-line jn-end">{{ isArr ? ']' : '}' }}</div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: 'CaptureJsonNode' }
</script>

<script setup lang="ts">
import { computed } from 'vue'
import CaptureJsonNode from './CaptureJsonNode.vue'

const props = defineProps<{
  value: unknown
  label?: string
  path: string
  collapsed: Set<string>
  query?: string
}>()

const emit = defineEmits<{ toggle: [path: string] }>()

const isArr = computed(() => Array.isArray(props.value))
const foldable = computed(() => props.value !== null && typeof props.value === 'object')
const open = computed(() => !props.collapsed.has(props.path))

const kids = computed(() => {
  const v = props.value
  if (Array.isArray(v)) {
    return v.map((item, i) => ({
      label: String(i),
      value: item,
      path: props.path ? `${props.path}.${i}` : String(i)
    }))
  }
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
      label: k,
      value: val,
      path: props.path ? `${props.path}.${k}` : k
    }))
  }
  return []
})

const preview = computed(() => {
  if (Array.isArray(props.value)) return `[${props.value.length}]`
  if (props.value && typeof props.value === 'object') {
    return `{${Object.keys(props.value).length}}`
  }
  return ''
})

const primKind = computed(() => {
  if (props.value === null) return 'is-null'
  const t = typeof props.value
  if (t === 'string') return 'is-str'
  if (t === 'number') return 'is-num'
  if (t === 'boolean') return 'is-bool'
  return 'is-null'
})

const primText = computed(() => {
  if (props.value === null) return 'null'
  if (typeof props.value === 'string') return JSON.stringify(props.value)
  return String(props.value)
})

const selfMatch = computed(() => {
  const q = (props.query || '').trim().toLowerCase()
  if (!q) return false
  if ((props.label || '').toLowerCase().includes(q)) return true
  if (!foldable.value && primText.value.toLowerCase().includes(q)) return true
  return false
})

function onLineClick() {
  if (!foldable.value) return
  const sel = window.getSelection()
  if (sel && sel.toString()) return
  emit('toggle', props.path)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hl(text: string) {
  const escaped = escapeHtml(text)
  const q = (props.query || '').trim()
  if (!q) return escaped
  return escaped.replace(new RegExp(escapeRegExp(q), 'gi'), (m) => `<mark class="cap-hl">${m}</mark>`)
}
</script>

<style scoped>
.jn-line {
  display: flex;
  align-items: flex-start;
  min-height: 20px;
  line-height: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}
.jn-line.is-fold {
  cursor: pointer;
}
.jn-line.is-fold:hover {
  background: var(--el-fill-color-light);
}
.jn-arrow,
.jn-pad {
  flex: 0 0 16px;
  width: 16px;
  color: var(--el-text-color-secondary);
  font-size: 9px;
  line-height: 20px;
  user-select: none;
}
.jn-key {
  color: #164;
}
.jn-colon {
  color: var(--el-text-color-secondary);
}
.jn-val.is-str {
  color: #a31515;
  word-break: break-all;
}
.jn-val.is-num {
  color: #098658;
}
.jn-val.is-bool,
.jn-val.is-null {
  color: #0431fa;
}
.jn-preview {
  color: var(--el-text-color-secondary);
}
.jn-kids {
  margin-left: 16px;
  border-left: 1px dotted var(--el-border-color);
  padding-left: 4px;
}
.jn-end {
  color: var(--el-text-color-secondary);
  cursor: default;
}
.jn :deep(mark.cap-hl) {
  background: var(--el-color-warning-light-7);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}
.jn :deep(mark.cap-hl-active) {
  background: var(--el-color-warning-light-3);
  outline: 1px solid var(--el-color-warning);
}
</style>
