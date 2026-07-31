<template>
  <aside class="xk-left">
    <div class="xk-sec-label">功能模式</div>
    <button
      v-for="m in modes"
      :key="m.id"
      type="button"
      class="xk-mode"
      :class="{ active: activeMode === m.id }"
      @click="$emit('switch-mode', m.id)"
    >
      <span class="xk-mode-icon">{{ m.icon }}</span>
      <span>{{ m.label }}</span>
    </button>

    <div class="xk-sec-label" style="margin-top: 22px">快捷操作</div>
    <button
      v-for="q in quickOps"
      :key="q.id"
      type="button"
      class="xk-quick"
      @click="$emit('quick', q.id)"
    >
      <div class="xk-quick-title">{{ q.title }}</div>
      <div class="xk-quick-desc">{{ q.desc }}</div>
    </button>
  </aside>
</template>

<script setup lang="ts">
import type { ModeId } from './types'

defineProps<{
  activeMode: ModeId
}>()

defineEmits<{
  'switch-mode': [id: ModeId]
  quick: [id: string]
}>()

const modes = [
  { id: 'chat' as const, label: 'AI 对话', icon: '💬' },
  { id: 'monitor' as const, label: '元素监控', icon: '👁' },
  { id: 'knowledge' as const, label: '知识库', icon: '📚' },
  { id: 'logs' as const, label: '工作流日志', icon: '📋' }
]

const quickOps = [
  { id: 'monitor', title: '监控新页面', desc: '输入 URL 快速爬取' },
  { id: 'save', title: '存入知识', desc: '保存业务流程' },
  { id: 'run', title: '运行工作流', desc: '触发自动化任务' },
  { id: 'report', title: '测试报告', desc: '生成汇总报告' }
]
</script>

<style scoped>
.xk-left {
  --panel: #eceff3;
  --panel-2: #e2e6eb;
  --line: #cdd3dc;
  --text: #303133;
  --muted: #606266;
  --accent: #409eff;

  border-right: 1px solid var(--line);
  background: var(--panel);
  padding: 14px 10px;
  overflow-y: auto;
  min-height: 0;
}
.xk-sec-label {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 4px 8px 10px;
}
.xk-mode {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  margin-bottom: 2px;
  border-left: 2px solid transparent;
}
.xk-mode:hover { background: rgba(64, 158, 255, 0.08); color: var(--text); }
.xk-mode.active {
  background: rgba(64, 158, 255, 0.12);
  color: var(--accent);
  border-left-color: var(--accent);
}
.xk-mode-icon { width: 18px; text-align: center; }
.xk-quick {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--text);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.xk-quick:hover { border-color: var(--accent); }
.xk-quick-title { font-size: 13px; font-weight: 600; }
.xk-quick-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
</style>
