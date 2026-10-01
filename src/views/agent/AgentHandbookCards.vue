<template>
  <div v-if="hits?.length" class="xk-hb-card">
    <div class="xk-hb-head">知识手册命中 {{ hits.length }} 条</div>
    <div v-for="(h, i) in hits" :key="h.id ?? i" class="xk-hb-item">
      <div class="xk-hb-title">
        <span class="xk-hb-badge">{{ h.categoryLabel || h.category || '手册' }}</span>
        <span v-if="h.project" class="xk-hb-proj">{{ h.project }}</span>
        {{ h.title }}
      </div>
      <div class="xk-hb-row"><em>现象</em>{{ h.symptom }}</div>
      <div class="xk-hb-row"><em>原因</em>{{ h.cause }}</div>
      <div class="xk-hb-row"><em>处理</em>{{ h.fix }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HandbookHit } from './types'

defineProps<{
  hits?: HandbookHit[]
}>()
</script>

<style scoped>
.xk-hb-card {
  margin-bottom: 8px;
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-8);
  border-radius: 10px;
  padding: 10px 12px;
  width: 100%;
}
.xk-hb-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-success);
  margin-bottom: 8px;
}
.xk-hb-item + .xk-hb-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #d9eccb;
}
.xk-hb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 6px;
  line-height: 1.4;
}
.xk-hb-badge {
  display: inline-block;
  background: var(--app-success);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: 1px;
}
.xk-hb-proj {
  display: inline-block;
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
}
.xk-hb-row {
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.5;
  margin-bottom: 2px;
  word-break: break-word;
}
.xk-hb-row em {
  font-style: normal;
  color: var(--el-text-color-placeholder);
  margin-right: 6px;
  font-weight: 600;
}
</style>
