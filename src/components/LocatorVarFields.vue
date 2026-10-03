<template>
  <div v-if="names.length" class="locator-vars">
    <div class="locator-vars-title">文案变量（定位里用了 ${'{'}…{'}'}，在此填值）</div>
    <div v-for="name in names" :key="name" class="locator-var-row">
      <span class="locator-var-name">${{ '{' + name + '}' }}</span>
      <el-input
        :model-value="String(params[name] ?? '')"
        size="small"
        :placeholder="placeholderOf(name)"
        @update:model-value="params[name] = $event"
      />
    </div>
    <p class="locator-vars-hint">
      同一页只差文案的控件共用一个元素，这里填本次要点/要匹配的字。每步可填不同值。
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  names: string[]
  params: Record<string, any>
}>()

function placeholderOf(name: string) {
  if (/text|title|label|name|tab/i.test(name)) return '如：26年TOP指数'
  return `填入 ${name}`
}
</script>

<style scoped>
.locator-vars {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
}
.locator-vars-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 6px;
}
.locator-var-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.locator-var-name {
  flex: none;
  width: 120px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--el-color-primary);
}
.locator-vars-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-secondary);
}
</style>
