<template>
  <div class="jtree">
    <div class="jtree-bar">
      <el-button size="small" plain @click="expandAll">全部展开</el-button>
      <el-button size="small" plain @click="collapseAll">全部收起</el-button>
    </div>
    <div class="jtree-body">
      <CaptureJsonNode
        :value="value"
        :path="''"
        :collapsed="collapsed"
        :query="query || ''"
        @toggle="toggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import CaptureJsonNode from './CaptureJsonNode.vue'

const props = defineProps<{
  value: unknown
  query?: string
}>()

const collapsed = ref<Set<string>>(new Set())

function toggle(path: string) {
  const next = new Set(collapsed.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  collapsed.value = next
}

function collect(node: unknown, path: string, out: string[]) {
  if (node == null || typeof node !== 'object') return
  out.push(path)
  if (Array.isArray(node)) {
    node.forEach((item, i) => collect(item, path ? `${path}.${i}` : String(i), out))
    return
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    collect(v, path ? `${path}.${k}` : k, out)
  }
}

function expandAll() {
  collapsed.value = new Set()
}

function collapseAll() {
  const paths: string[] = []
  collect(props.value, '', paths)
  collapsed.value = new Set(paths)
}

function ancestorPaths(path: string): string[] {
  if (!path) return ['']
  const parts = path.split('.')
  const out = ['']
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(0, i + 1).join('.'))
  return out
}

function matchPaths(node: unknown, path: string, query: string, out: string[]) {
  const q = query.toLowerCase()
  if (node == null || typeof node !== 'object') {
    if (String(node).toLowerCase().includes(q)) out.push(path)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      const child = path ? `${path}.${i}` : String(i)
      if (String(i).includes(q)) out.push(child)
      matchPaths(item, child, query, out)
    })
    return
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const child = path ? `${path}.${k}` : k
    if (k.toLowerCase().includes(q)) out.push(child)
    matchPaths(v, child, query, out)
  }
}

watch(
  () => props.query,
  (q) => {
    const query = (q || '').trim()
    if (!query) return
    const hits: string[] = []
    matchPaths(props.value, '', query, hits)
    if (!hits.length) return
    const next = new Set(collapsed.value)
    for (const hit of hits) {
      for (const a of ancestorPaths(hit)) next.delete(a)
    }
    collapsed.value = next
  }
)

watch(
  () => props.value,
  () => {
    collapsed.value = new Set()
  }
)
</script>

<style scoped>
.jtree-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.jtree-body {
  max-height: 52vh;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}
</style>
