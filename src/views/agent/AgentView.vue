<template>
  <div class="xk-shell">
    <header class="xk-top">
      <div class="xk-top-left">
        <span class="xk-brand">AI助手</span>
        <span class="xk-session">session: {{ sessionId }}</span>
      </div>
      <div class="xk-top-right">
        <span class="xk-pill" :class="status?.configured ? 'ok' : 'bad'">
          <i class="dot" />
          {{ status?.configured ? '千问在线' : '千问未配置' }}
        </span>
        <span v-if="status?.chatModel" class="xk-pill mute">{{ status.chatModel }}</span>
        <span class="xk-pill mute">知识库 {{ knowledgeCountDisplay }} 条</span>
        <button type="button" class="xk-link-btn" @click="tipsVisible = true">使用帮助</button>
      </div>
    </header>

    <div class="xk-body">
      <AgentSidebar
        :active-mode="activeMode"
        @switch-mode="switchMode"
        @quick="onQuick"
      />

      <main class="xk-center">
        <AgentChat :messages="messages" :loading="loading" />
        <AgentInput
          v-model="input"
          v-model:drag-over="dragOver"
          :pending-files="pendingFiles"
          :uploading="uploading"
          :loading="loading"
          :configured="!!status?.configured"
          @chip="onChip"
          @drop="onDrop"
          @paste="onPaste"
          @file-pick="onFilePick"
          @remove-file="removeFile"
          @upload="uploadPending"
          @send="sendChat"
        />
      </main>

      <AgentRightPanel
        :right-tab="rightTab"
        :configured="!!status?.codewordsConfigured"
        v-model:monitor-url="monitorUrl"
        v-model:monitor-schedule="monitorSchedule"
        v-model:show-last-monitor="showLastMonitor"
        :monitor-loading="monitorLoading"
        :monitor-result="monitorResult"
        :monitor-summary="monitorSummary"
        :knowledge-items="knowledgeItems"
        :workflow-logs="workflowLogs"
        :last-generated-cases="lastGeneratedCases"
        @tab="onRightTab"
        @run-monitor="runMonitor"
        @refresh-knowledge="loadKnowledge"
        @ask-knowledge="askAboutKnowledge"
        @add-knowledge="addKnowledgeManual"
      />
    </div>

    <el-dialog v-model="tipsVisible" title="AI助手使用指南" width="520px" align-center>
      <div class="tips-list">
        <div v-for="(item, i) in tipsItems" :key="i" class="tips-item">
          <div class="tips-you">你：「{{ item.you }}」</div>
          <div class="tips-agent">助手 → {{ item.agent }}</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeTips">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import AgentSidebar from './AgentSidebar.vue'
import AgentChat from './AgentChat.vue'
import AgentInput from './AgentInput.vue'
import AgentRightPanel from './AgentRightPanel.vue'
import { useAgent } from './composables/useAgent'

const tipsItems = [
  { you: 'Ctrl/Cmd+V 粘贴截图', agent: '图片入库并带给 Agent ✅' },
  { you: '拖入需求文档.md', agent: '解析并写入本地知识库 ✅' },
  { you: '点「生成测试用例」', agent: '需求文字/PDF/截图 → 用例卡片 ✅' },
  { you: '监控这个 H5 页面元素', agent: '浏览器爬取 → 返回定位库 ✅' }
]

const {
  messages,
  input,
  sessionId,
  loading,
  status,
  knowledgeItems,
  workflowLogs,
  activeMode,
  rightTab,
  tipsVisible,
  monitorUrl,
  monitorSchedule,
  monitorLoading,
  monitorResult,
  showLastMonitor,
  monitorSummary,
  knowledgeCountDisplay,
  pendingFiles,
  dragOver,
  uploading,
  lastGeneratedCases,
  switchMode,
  onRightTab,
  onChip,
  onQuick,
  askAboutKnowledge,
  addKnowledgeManual,
  runMonitor,
  removeFile,
  onFilePick,
  onDrop,
  onPaste,
  uploadPending,
  sendChat,
  closeTips,
  loadKnowledge
} = useAgent()
</script>

<style scoped>
.xk-shell {
  /* 略暗浅灰，减轻过白 */
  --bg: var(--app-border);
  --panel: #eceff3;
  --panel-2: #e2e6eb;
  --line: #cdd3dc;
  --text: var(--app-text);
  --muted: var(--app-text-secondary);
  --accent: var(--app-primary);
  --accent-2: #337ecc;
  --warn: var(--app-warning);
  --user: #d9ecff;
  --danger: var(--app-danger);

  height: 100%;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif;
}
.xk-shell,
.xk-shell * {
  scrollbar-width: thin;
  scrollbar-color: #c0c4cc transparent;
}
.xk-shell ::-webkit-scrollbar { width: 8px; height: 8px; }
.xk-shell ::-webkit-scrollbar-track { background: transparent; }
.xk-shell ::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.xk-top {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
  background: #eceff3;
}
.xk-brand { font-weight: 650; letter-spacing: 0.02em; margin-right: 14px; color: var(--app-text); }
.xk-session {
  color: var(--muted);
  font-size: 12px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
}
.xk-top-right { display: flex; align-items: center; gap: 10px; }
.xk-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--panel-2);
  border: 1px solid var(--line);
}
.xk-pill.mute { color: var(--muted); }
.xk-pill.ok { color: var(--accent); }
.xk-pill.bad { color: var(--danger); }
.xk-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}
.xk-link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
}
.xk-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 300px;
  overflow: hidden;
}
.xk-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #e8ebef;
}
.tips-list { display: flex; flex-direction: column; gap: 12px; }
.tips-item {
  padding: 12px 14px;
  background: var(--panel-2);
  border-radius: 8px;
  border: 1px solid var(--line);
}
.tips-you { font-size: 14px; color: var(--text); margin-bottom: 6px; }
.tips-agent { font-size: 13px; color: var(--app-primary); font-weight: 600; }

@media (max-width: 1100px) {
  .xk-body { grid-template-columns: 180px minmax(0, 1fr); }
}
</style>
