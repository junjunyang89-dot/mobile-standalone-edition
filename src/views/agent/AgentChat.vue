<template>
  <div class="ask-chat-block">
    <div ref="chatBoxEl" class="ask-chat">
      <div v-for="(m, i) in messages" :key="i" class="ask-msg" :class="m.role">
        <div v-if="m.role === 'assistant'" class="ask-avatar" aria-hidden="true">AI</div>
        <div class="ask-bubble" :class="m.role">
          <template v-for="(part, pi) in splitParts(m.content)" :key="pi">
            <pre v-if="part.type === 'code'" class="ask-code"><button
                type="button"
                class="ask-copy"
                @click="copy(part.text)"
              >复制</button><code>{{ part.text }}</code></pre>
            <div v-else class="ask-text" v-html="renderText(part.text)" />
          </template>
        </div>
      </div>
      <div v-if="loading" class="ask-msg assistant">
        <div class="ask-avatar" aria-hidden="true">AI</div>
        <div class="ask-bubble assistant muted">Cursor 正在读仓库…</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const props = defineProps<{
  messages: ChatMsg[]
  loading: boolean
}>()

const chatBoxEl = ref<HTMLElement | null>(null)

type Part = { type: 'text' | 'code'; text: string; lang?: string }

function splitParts(content: string): Part[] {
  const src = content || ''
  const re = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g
  const parts: Part[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m.index > last) {
      parts.push({ type: 'text', text: src.slice(last, m.index) })
    }
    parts.push({ type: 'code', text: m[2].replace(/\n$/, ''), lang: m[1] || '' })
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push({ type: 'text', text: src.slice(last) })
  return parts.length ? parts : [{ type: 'text', text: src }]
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderText(raw: string) {
  let s = escapeHtml(raw)
  s = s.replace(/`([^`\n]+)`/g, '<code class="ask-inline">$1</code>')
  s = s.replace(
    /(^|[\s（(])((?:src|scripts|docs|app_coding|swift-sphere)\/[A-Za-z0-9_./\-]+)/g,
    '$1<span class="ask-path">$2</span>'
  )
  return s.replace(/\n/g, '<br>')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function scrollBottom() {
  await Promise.resolve()
  const el = chatBoxEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => [props.messages.length, props.loading, props.messages[props.messages.length - 1]?.content],
  () => scrollBottom()
)
onMounted(() => scrollBottom())
</script>

<style scoped>
.ask-chat-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ask-chat {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ask-msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ask-msg.user {
  justify-content: flex-end;
}

.ask-msg.assistant {
  justify-content: flex-start;
}

.ask-avatar {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--el-color-primary-light-3), var(--el-color-primary));
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: grid;
  place-items: center;
  letter-spacing: -0.02em;
  margin-top: 2px;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.35);
}

.ask-bubble {
  max-width: min(100%, 880px);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.65;
}

.ask-bubble.assistant {
  background: var(--el-color-primary-light-9);
  color: var(--el-text-color-primary);
}

.ask-bubble.user {
  background: var(--el-color-primary-dark-2);
  color: #fff;
  border-bottom-right-radius: 6px;
}

.ask-bubble.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.ask-text {
  white-space: normal;
  word-break: break-word;
}

.ask-text :deep(.ask-inline) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
}

.ask-bubble.user .ask-text :deep(.ask-inline) {
  background: rgba(255, 255, 255, 0.18);
}

.ask-text :deep(.ask-path) {
  color: var(--el-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}

.ask-code {
  position: relative;
  margin: 10px 0 4px;
  padding: 12px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre;
}

.ask-code code {
  display: block;
  padding-top: 18px;
}

.ask-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.ask-copy:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
