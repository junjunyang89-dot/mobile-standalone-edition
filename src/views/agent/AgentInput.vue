<template>
  <div class="ask-input-block">
    <div class="ask-quick">
      <span class="ask-quick-label">常问:</span>
      <button
        v-for="q in QUICK_PROMPTS"
        :key="q"
        type="button"
        class="ask-chip"
        :disabled="loading || !configured"
        @click="$emit('quick', q)"
      >
        {{ q }}
      </button>
    </div>

    <div class="ask-composer">
      <textarea
        :value="modelValue"
        class="ask-input"
        rows="3"
        placeholder="问代码在哪、某字段怎么判断、环境怎么搭… Shift+Enter 换行，Enter 发送"
        :disabled="loading || !configured"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
      />
      <div class="ask-composer-foot">
        <span class="ask-hint">Enter 发送 · Shift+Enter 换行</span>
        <button
          type="button"
          class="ask-send"
          :disabled="loading || !configured || !modelValue.trim()"
          @click="$emit('send')"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.4 20.6 21 12 3.4 3.4l.1 6.6L14 12 3.5 14z"
            />
          </svg>
          <span>{{ loading ? '发送中' : '发送' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { QUICK_PROMPTS } from './composables/useCursorAsk'

const props = defineProps<{
  modelValue: string
  loading: boolean
  configured: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  send: []
  quick: [q: string]
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (!props.loading && props.configured && props.modelValue.trim()) {
      emit('send')
    }
  }
}
</script>

<style scoped>
.ask-input-block {
  padding-top: 8px;
}

.ask-quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ask-quick-label {
  flex: none;
  font-size: 12px;
  color: var(--el-text-color-disabled);
  font-weight: 500;
}

.ask-chip {
  border: 1px solid var(--el-border-color);
  background: #fff;
  color: var(--app-text-regular);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1.3;
}

.ask-chip:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
}

.ask-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ask-composer {
  background: #fff;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  padding: 12px 14px 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.ask-input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.55;
  font-family: inherit;
  background: transparent;
  min-height: 72px;
  color: var(--el-text-color-primary);
}

.ask-input::placeholder {
  color: var(--el-text-color-disabled);
}

.ask-composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 6px;
}

.ask-hint {
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.ask-send {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ask-send:not(:disabled) {
  background: var(--el-color-primary);
  color: #fff;
}

.ask-send:not(:disabled):hover {
  background: var(--el-color-primary-dark-2);
}

.ask-send:disabled {
  cursor: not-allowed;
}
</style>
