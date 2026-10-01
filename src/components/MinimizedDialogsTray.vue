<template>
  <div v-if="minimizedDialogs.length" class="bg-tray" role="list" aria-label="放在后台的弹窗">
    <div class="bg-tray-head">后台弹窗（点一下继续）</div>
    <button
      v-for="d in minimizedDialogs"
      :key="d.id"
      type="button"
      role="listitem"
      class="bg-tray-item"
      :title="`回到「${d.tabLabel}」继续：${d.title}`"
      @click="restoreDialog(d.id)"
    >
      <span class="bg-tray-title">{{ d.title }}</span>
      <span class="bg-tray-tab">{{ d.tabLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { minimizedDialogs, restoreDialog } from '../composables/useDialogMinimize'
</script>

<style scoped>
.bg-tray {
  position: fixed;
  right: 20px;
  bottom: 64px;
  z-index: 1990;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 240px;
  padding: 8px;
  border: 1px solid var(--app-border, var(--el-border-color));
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}

.bg-tray-head {
  padding: 0 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.bg-tray-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.bg-tray-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.bg-tray-title {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.bg-tray-tab {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
