<template>
  <div v-if="actions?.length" class="xk-tool-card">
    <div v-for="(a, j) in actions" :key="j" class="xk-tool-row">
      <span class="xk-tool-badge">{{ formatAction(a) }}</span>
      <pre class="xk-tool-meta">{{ formatActionDetail(a) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatAction, formatActionDetail } from './types'

defineProps<{
  actions?: unknown[]
}>()
</script>

<style scoped>
.xk-tool-card {
  margin-bottom: 8px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 10px;
  padding: 10px 12px;
  width: 100%;
}
.xk-tool-badge {
  display: inline-block;
  background: #e6a23c;
  color: #ffffff;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.xk-tool-meta {
  margin: 0;
  color: #909399;
  font-size: 12px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  white-space: pre-wrap;
}
</style>
