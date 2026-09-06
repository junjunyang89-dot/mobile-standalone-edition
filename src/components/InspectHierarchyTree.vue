<template>
  <div class="tree-wrap">
    <el-input
      v-model="query"
      size="small"
      clearable
      placeholder="搜 text / id / class"
    />
    <div class="tree-scroll">
      <button
        v-for="row in visibleRows"
        :key="row.node.nodePath || row.node.xpath || row.depth + row.title"
        type="button"
        class="tree-row"
        :class="{ selected: row.node.nodePath && row.node.nodePath === selectedPath, clickable: row.node.clickable }"
        :style="{ paddingLeft: `${8 + row.depth * 12}px` }"
        @click="emit('pick', row.node)"
      >
        <span class="tree-cls">{{ row.cls }}</span>
        <span class="tree-title">{{ row.title }}</span>
      </button>
      <el-empty v-if="!root" description="刷新截图后出现控件树" :image-size="48" />
      <el-empty v-else-if="!visibleRows.length" description="没有匹配的节点" :image-size="48" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InspectNode } from '@/utils/inspectHierarchy'
import { nodeMatchesQuery, nodeTitle } from '@/utils/inspectHierarchy'

const props = defineProps<{
  root: InspectNode | null
  selectedPath?: string
}>()

const emit = defineEmits<{
  pick: [node: InspectNode]
}>()

const query = ref('')

const visibleRows = computed(() => {
  const q = query.value.trim()
  const rowOf = (n: InspectNode, depth: number) => ({
    node: n,
    depth,
    title: nodeTitle(n),
    cls: String(n.className || '').split('.').pop() || 'node'
  })
  const collect = (n: InspectNode, depth: number): ReturnType<typeof rowOf>[] => {
    const kids = (n.children || []).flatMap((c) => collect(c, depth + 1))
    const self = !q || nodeMatchesQuery(n, q)
    if (!self && !kids.length) return []
    return [rowOf(n, depth), ...kids]
  }
  return props.root ? collect(props.root, 0) : []
})
</script>

<style scoped>
.tree-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 8px;
}
.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.35;
  color: var(--app-text);
}
.tree-row:hover {
  background: var(--el-fill-color-light);
}
.tree-row.selected {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}
.tree-cls {
  flex: none;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
.tree-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-row.clickable .tree-title {
  font-weight: 600;
}
</style>
