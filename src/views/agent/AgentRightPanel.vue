<template>
  <aside class="xk-right">
    <div class="xk-tabs">
      <button
        v-for="t in rightTabs"
        :key="t.id"
        type="button"
        class="xk-tab"
        :class="{ active: rightTab === t.id }"
        @click="$emit('tab', t.id)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-show="rightTab === 'monitor'" class="xk-panel">
      <div class="xk-panel-title">快速监控</div>
      <label class="xk-field-label">页面 URL</label>
      <input
        :value="monitorUrl"
        class="xk-field"
        type="text"
        @input="$emit('update:monitorUrl', ($event.target as HTMLInputElement).value)"
      />
      <label class="xk-switch-row">
        <span>开启定时监控（每天）</span>
        <input
          :checked="monitorSchedule"
          type="checkbox"
          @change="$emit('update:monitorSchedule', ($event.target as HTMLInputElement).checked)"
        />
      </label>
      <button
        type="button"
        class="xk-primary-btn"
        :disabled="monitorLoading || !configured"
        @click="$emit('run-monitor')"
      >
        {{ monitorLoading ? '启动中…' : '启动监控' }}
      </button>
      <button
        type="button"
        class="xk-ghost-btn"
        :disabled="!monitorResult"
        @click="$emit('update:showLastMonitor', !showLastMonitor)"
      >
        查看上次结果
      </button>

      <div class="xk-panel-title" style="margin-top: 18px">最近监控结果</div>
      <div v-if="monitorSummary" class="xk-result-card">
        <div class="xk-kv"><span>页面</span><b>{{ monitorSummary.page }}</b></div>
        <div class="xk-kv"><span>元素总数</span><b>{{ monitorSummary.total }}</b></div>
        <div class="xk-kv">
          <span>元素变化</span>
          <b class="ok">{{ monitorSummary.change }}</b>
        </div>
        <div class="xk-kv"><span>快照时间</span><b>{{ monitorSummary.snapshotAt }}</b></div>
        <div class="xk-kv"><span>下次检测</span><b class="warn">{{ monitorSummary.nextAt }}</b></div>
      </div>
      <div v-else class="xk-empty">暂无监控结果，启动后显示在这里</div>
      <pre v-if="showLastMonitor && monitorResult" class="xk-raw">{{ formatJson(monitorResult) }}</pre>
    </div>

    <div v-show="rightTab === 'knowledge'" class="xk-panel">
      <div class="xk-panel-title-row">
        <div class="xk-panel-title">知识库</div>
        <button type="button" class="xk-link-btn" @click="$emit('refresh-knowledge')">刷新</button>
      </div>
      <p class="xk-panel-desc">存测试流程、需求摘要等，对话时可让助手检索复用</p>
      <div v-if="knowledgeItems.length === 0" class="xk-empty">
        暂无条目。可上传文档、粘贴截图，或点下方新增。
      </div>
      <div
        v-for="(k, i) in knowledgeItems"
        :key="i"
        class="xk-know-card"
        @click="$emit('ask-knowledge', k)"
      >
        <div class="xk-know-title">{{ k.title }}</div>
        <div v-if="k.snippet" class="xk-know-snippet">{{ k.snippet }}</div>
        <div class="xk-know-tag">{{ k.tag }}</div>
      </div>
      <button type="button" class="xk-add-know" @click="$emit('add-knowledge')">+ 新增知识条目</button>
    </div>

    <div v-show="rightTab === 'workflow'" class="xk-panel">
      <div class="xk-panel-title">工作流日志</div>
      <div v-if="workflowLogs.length === 0" class="xk-empty">尚无调用记录</div>
      <div v-for="(log, i) in workflowLogs" :key="i" class="xk-log-item">
        <div class="xk-log-name">{{ log.name }}</div>
        <div class="xk-log-meta">{{ log.time }} · {{ log.status }}</div>
      </div>
    </div>

    <div v-if="rightTab === 'monitor'" class="xk-know-preview">
      <div class="xk-panel-title">知识库预览</div>
      <div v-if="knowledgeItems.length === 0" class="xk-empty">暂无知识</div>
      <div
        v-for="(k, i) in knowledgeItems.slice(0, 2)"
        :key="'p' + i"
        class="xk-know-card compact"
        @click="$emit('ask-knowledge', k)"
      >
        <div class="xk-know-title">{{ k.title }}</div>
        <div class="xk-know-tag">{{ k.tag }}</div>
      </div>
      <button type="button" class="xk-add-know" @click="$emit('add-knowledge')">+ 新增知识条目</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  formatJson,
  type KnowledgeItem,
  type RightTab,
  type WorkflowLog
} from './types'

defineProps<{
  rightTab: RightTab
  configured: boolean
  monitorUrl: string
  monitorSchedule: boolean
  monitorLoading: boolean
  monitorResult: unknown
  showLastMonitor: boolean
  monitorSummary: {
    page: string
    total: string | number
    change: string
    snapshotAt: string
    nextAt: string
  } | null
  knowledgeItems: KnowledgeItem[]
  workflowLogs: WorkflowLog[]
}>()

defineEmits<{
  tab: [id: RightTab]
  'update:monitorUrl': [v: string]
  'update:monitorSchedule': [v: boolean]
  'update:showLastMonitor': [v: boolean]
  'run-monitor': []
  'refresh-knowledge': []
  'ask-knowledge': [k: KnowledgeItem]
  'add-knowledge': []
}>()

const rightTabs = [
  { id: 'monitor' as const, label: '元素监控' },
  { id: 'knowledge' as const, label: '知识库' },
  { id: 'workflow' as const, label: '工作流' }
]
</script>

<style scoped>
.xk-right {
  --panel: #eceff3;
  --panel-2: #e2e6eb;
  --line: #cdd3dc;
  --text: #303133;
  --muted: #606266;
  --accent: #409eff;
  --warn: #e6a23c;

  border-left: 1px solid var(--line);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.xk-tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.xk-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 12px 4px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.xk-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.xk-panel {
  padding: 14px;
  overflow-y: auto;
  flex: 1;
}
.xk-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
.xk-panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.xk-panel-title-row .xk-panel-title {
  margin-bottom: 0;
}
.xk-panel-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}
.xk-know-snippet {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.xk-field-label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
.xk-field {
  width: 100%;
  box-sizing: border-box;
  background: #f5f7fa;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 10px;
  font-size: 12px;
  margin-bottom: 12px;
  outline: none;
}
.xk-field:focus { border-color: var(--accent); }
.xk-switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
.xk-primary-btn {
  width: 100%;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #ffffff;
  font-weight: 650;
  padding: 10px;
  cursor: pointer;
  margin-bottom: 8px;
}
.xk-primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.xk-ghost-btn {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  padding: 9px;
  cursor: pointer;
}
.xk-ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.xk-result-card {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
}
.xk-kv {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 5px 0;
  color: var(--muted);
}
.xk-kv b { color: var(--text); font-weight: 600; }
.xk-kv b.ok { color: var(--accent); }
.xk-kv b.warn { color: var(--warn); }
.xk-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 0;
}
.xk-raw {
  margin-top: 10px;
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
  background: #e4e7ed;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px;
}
.xk-know-preview {
  border-top: 1px solid var(--line);
  padding: 12px 14px 16px;
  flex-shrink: 0;
  max-height: 42%;
  overflow-y: auto;
}
.xk-know-card {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.xk-know-card:hover { border-color: var(--accent); }
.xk-know-card.compact { padding: 8px 10px; }
.xk-know-title { font-size: 13px; font-weight: 600; }
.xk-know-tag {
  display: inline-block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--accent);
  background: rgba(64, 158, 255, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
}
.xk-add-know {
  width: 100%;
  border: 1px dashed var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 8px;
  padding: 9px;
  cursor: pointer;
  font-size: 12px;
}
.xk-add-know:hover { color: var(--accent); border-color: var(--accent); }
.xk-log-item {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--panel-2);
}
.xk-log-name { font-size: 13px; }
.xk-log-meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
.xk-link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .xk-right { display: none; }
}
</style>
