<template>
  <div class="xk-chat-block">
    <div ref="chatBoxEl" class="xk-chat">
      <div v-for="(m, i) in messages" :key="i" class="xk-msg" :class="m.role">
        <div class="xk-avatar" :class="m.role">
          <img v-if="m.role === 'assistant'" class="xk-avatar-img" :src="assistantAvatar" alt="AI助手" />
          <span v-else>杨</span>
        </div>
        <div class="xk-bubble-wrap">
          <AgentHandbookCards :hits="m.handbookHits" />
          <AgentToolCards :actions="m.actions" />
          <div class="xk-bubble">
            <pre class="xk-text">{{ m.content }}</pre>
          </div>
        </div>
      </div>
      <div v-if="loading" class="xk-msg assistant">
        <div class="xk-avatar assistant">
          <img class="xk-avatar-img" :src="assistantAvatar" alt="AI助手" />
        </div>
        <div class="xk-bubble muted">正在思考 / 调用工具…</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AgentHandbookCards from './AgentHandbookCards.vue'
import AgentToolCards from './AgentToolCards.vue'
import { assistantAvatar, type ChatMsg } from './types'

const props = defineProps<{
  messages: ChatMsg[]
  loading: boolean
}>()

const chatBoxEl = ref<HTMLElement | null>(null)

async function scrollBottom() {
  await Promise.resolve()
  const el = chatBoxEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => [props.messages.length, props.loading], () => scrollBottom())
onMounted(() => scrollBottom())

defineExpose({ scrollBottom, el: chatBoxEl })
</script>

<style scoped>
.xk-chat-block {
  --panel-2: #eceff3;
  --line: #cdd3dc;
  --text: var(--app-text);
  --muted: var(--app-text-secondary);
  --user: #d9ecff;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}
.xk-chat {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 22px 8px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.xk-msg {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  align-items: flex-start;
}
.xk-msg.user { flex-direction: row-reverse; }
.xk-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}
.xk-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  display: block;
}
.xk-avatar.assistant {
  background: #fdf6ec;
  padding: 0;
  border: 1px solid #f5dab1;
}
.xk-avatar.user { background: var(--app-primary); color: #ffffff; }
.xk-bubble-wrap { max-width: min(720px, 85%); }
.xk-msg.user .xk-bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.xk-bubble {
  background: #e8ebef;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.xk-msg.user .xk-bubble {
  background: var(--user);
  border-color: var(--el-color-primary-light-7);
}
.xk-bubble.muted { color: var(--muted); font-size: 13px; }
.xk-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.55;
}
</style>
