<template>
  <div class="page-tabs" role="tablist" aria-label="已打开页面">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :ref="(el) => setTabEl(tab.key, el)"
      type="button"
      role="tab"
      class="page-tab"
      :class="{ 'is-active': tab.key === activeKey }"
      :aria-selected="tab.key === activeKey"
      :title="tab.label"
      @click="emit('select', tab.key)"
      @auxclick="onAuxClick($event, tab.key)"
    >
      <span class="page-tab-label">{{ tab.label }}</span>
      <span
        class="page-tab-dup"
        role="button"
        title="再开一个同样的页面（两个互不影响）"
        :aria-label="`再开一个${tab.label}`"
        @click.stop="emit('duplicate', tab.key)"
      >
        <el-icon><CopyDocument /></el-icon>
      </span>
      <span
        v-if="tabs.length > 1 || lastClosable"
        class="page-tab-close"
        role="button"
        :aria-label="`关闭${tab.label}`"
        @click.stop="emit('close', tab.key)"
      >
        <el-icon><Close /></el-icon>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { Close, CopyDocument } from '@element-plus/icons-vue'

type Tab = { key: string; label: string }

const props = defineProps<{
  tabs: Tab[]
  activeKey: string
  /** 只剩一个标签时也能关（关掉回工作台）；最后一个就是工作台时没得回，不给关 */
  lastClosable?: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  duplicate: [key: string]
  close: [key: string]
}>()

const tabEls = new Map<string, HTMLElement>()

function setTabEl(key: string, el: unknown) {
  if (el instanceof HTMLElement) tabEls.set(key, el)
  else tabEls.delete(key)
}

function onAuxClick(e: MouseEvent, key: string) {
  if (e.button !== 1 || (props.tabs.length < 2 && !props.lastClosable)) return
  e.preventDefault()
  emit('close', key)
}

watch(
  () => props.activeKey,
  async (key) => {
    await nextTick()
    tabEls.get(key)?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }
)
</script>

<style scoped>
.page-tabs {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 38px;
  padding: 6px 10px 0;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--app-border);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  scrollbar-width: none;
}

.page-tabs::-webkit-scrollbar {
  display: none;
}

.page-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 220px;
  height: 32px;
  margin: 0;
  padding: 0 8px 0 12px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--app-text-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.page-tab:hover {
  color: var(--app-text);
  background: rgba(255, 255, 255, 0.55);
}

.page-tab.is-active {
  background: var(--app-card-bg);
  color: var(--app-text);
  border-color: var(--app-border);
  font-weight: 500;
  box-shadow: inset 0 2px 0 var(--app-primary);
}

.page-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-tab-dup {
  display: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--el-text-color-disabled);
  flex-shrink: 0;
}

.page-tab:hover .page-tab-dup,
.page-tab.is-active .page-tab-dup {
  display: inline-flex;
}

.page-tab-dup:hover {
  background: rgba(15, 23, 42, 0.08);
  color: var(--app-primary);
}

.page-tab-dup .el-icon {
  font-size: 12px;
}

.page-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--el-text-color-disabled);
  flex-shrink: 0;
}

.page-tab-close:hover {
  background: rgba(15, 23, 42, 0.08);
  color: var(--app-text);
}

.page-tab-close .el-icon {
  font-size: 12px;
}
</style>
