<template>
  <div class="ask-shell">
    <aside class="ask-side">
      <div class="ask-side-head">
        <span class="ask-side-title">对话记录</span>
        <button type="button" class="ask-new" :disabled="loading" @click="newChat">
          <span class="ask-new-plus">+</span>
          新对话
        </button>
      </div>
      <div class="ask-side-list">
        <div v-for="g in sessionGroups" :key="g.label" class="ask-group">
          <div class="ask-group-label">{{ g.label }}</div>
          <button
            v-for="s in g.items"
            :key="s.id"
            type="button"
            class="ask-session"
            :class="{ active: s.id === activeId }"
            :disabled="loading"
            @click="selectSession(s.id)"
          >
            <div class="ask-session-title">{{ s.title }}</div>
            <div class="ask-session-meta">
              {{ formatSessionTime(s.updatedAt) }} ·
              {{ Math.max(0, (s.messages?.length || 1) - 1) }} 条消息
            </div>
          </button>
        </div>
        <div v-if="!sessionGroups.length" class="ask-side-empty">还没有对话</div>
      </div>
    </aside>

    <section class="ask-main">
      <header class="ask-top">
        <div class="ask-top-left">
          <span class="ask-logo" aria-hidden="true">AI</span>
          <span class="ask-brand">AI 助手</span>
          <span class="ask-pill soft">Cursor SDK</span>
          <span class="ask-pill" :class="status?.configured ? 'ok' : 'bad'">
            <i class="dot" />
            {{ status?.configured ? 'Cursor 就绪' : '未就绪' }}
          </span>
          <span v-if="status?.model" class="ask-pill mute">{{ status.model }}</span>
        </div>
      </header>

      <p v-if="status && !status.configured" class="ask-banner">
        {{ status.hint || '请配置 CURSOR_API_KEY，并在 scripts/cursor-ask 执行 npm install' }}
      </p>

      <div class="ask-cwd">
        <span class="ask-cwd-ico" aria-hidden="true">📁</span>
        <input
          v-if="cwdEditing"
          ref="cwdInputRef"
          v-model="cwd"
          class="ask-cwd-input"
          :disabled="loading"
          @blur="cwdEditing = false"
          @keydown.enter="cwdEditing = false"
        />
        <button v-else type="button" class="ask-cwd-path" @click="startEditCwd">
          <span>{{ cwd || '未设置代码目录' }}</span>
          <span class="ask-cwd-edit">✎</span>
        </button>
        <span class="ask-cwd-hint">AI 只能读取此目录下的代码</span>
      </div>

      <div class="ask-body">
        <AgentChat :messages="messages" :loading="loading" />
        <AgentInput
          v-model="input"
          :loading="loading"
          :configured="!!status?.configured"
          @send="sendChat()"
          @quick="sendChat"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import AgentChat from './AgentChat.vue'
import AgentInput from './AgentInput.vue'
import { useCursorAsk } from './composables/useCursorAsk'

const {
  messages,
  input,
  loading,
  status,
  cwd,
  cwdEditing,
  activeId,
  sessionGroups,
  sendChat,
  newChat,
  selectSession,
  formatSessionTime
} = useCursorAsk()

const cwdInputRef = ref<HTMLInputElement | null>(null)

async function startEditCwd() {
  cwdEditing.value = true
  await nextTick()
  cwdInputRef.value?.focus()
  cwdInputRef.value?.select()
}
</script>

<style scoped>
.ask-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #f4f6fa;
  color: var(--el-text-color-primary);
}

.ask-side {
  width: 268px;
  flex: 0 0 268px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid var(--el-border-color);
  min-height: 0;
}

.ask-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 14px 12px;
}

.ask-side-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.ask-new {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
}

.ask-new-plus {
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
}

.ask-new:hover:not(:disabled) {
  background: var(--el-color-primary-dark-2);
}

.ask-new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ask-side-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 10px 14px;
}

.ask-group-label {
  padding: 10px 8px 6px;
  font-size: 11px;
  color: var(--el-text-color-disabled);
  font-weight: 600;
}

.ask-session {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 10px 10px;
  cursor: pointer;
  margin-bottom: 4px;
}

.ask-session:hover {
  background: var(--el-fill-color-light);
}

.ask-session.active {
  background: #e8f1ff;
}

.ask-session-title {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ask-session-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-disabled);
}

.ask-side-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--el-text-color-disabled);
  font-size: 12px;
}

.ask-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f7f9fc;
}

.ask-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color);
}

.ask-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ask-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--el-color-primary-light-3), var(--el-color-primary));
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: grid;
  place-items: center;
  letter-spacing: -0.02em;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.35);
}

.ask-brand {
  font-size: 15px;
  font-weight: 700;
}

.ask-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  color: var(--app-text-regular);
}

.ask-pill.soft {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary-dark-2);
}

.ask-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.ask-pill.ok {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}

.ask-pill.ok .dot {
  background: var(--el-color-success);
}

.ask-pill.bad {
  color: var(--el-color-danger-dark-2);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}

.ask-pill.bad .dot {
  background: var(--el-color-danger);
}

.ask-pill.mute {
  color: var(--el-text-color-secondary);
}

.ask-banner {
  margin: 0;
  padding: 10px 20px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
  border-bottom: 1px solid var(--el-color-warning-light-8);
}

.ask-cwd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
}

.ask-cwd-ico {
  flex: none;
  font-size: 13px;
  opacity: 0.75;
}

.ask-cwd-path {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  color: var(--app-text-regular);
  text-align: left;
}

.ask-cwd-path span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ask-cwd-edit {
  color: var(--el-text-color-disabled);
  flex: none;
}

.ask-cwd-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 6px;
  font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  outline: none;
  background: #fff;
}

.ask-cwd-hint {
  flex: none;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.ask-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0;
  padding: 0 24px 18px;
  box-sizing: border-box;
}

@media (max-width: 960px) {
  .ask-side {
    width: 220px;
  }
  .ask-cwd-hint {
    display: none;
  }
  .ask-body {
    padding: 0 16px 16px;
  }
}
</style>
