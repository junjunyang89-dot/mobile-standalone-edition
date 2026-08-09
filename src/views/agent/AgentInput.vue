<template>
  <div class="xk-input-block">
    <div class="xk-chips">
      <button
        v-for="c in chips"
        :key="c.id"
        type="button"
        class="xk-chip"
        :class="{ primary: c.id === 'cases' }"
        @click="$emit('chip', c.id)"
      >
        {{ c.label }}
      </button>
    </div>

    <div
      class="xk-drop"
      :class="{ active: dragOver, hasFiles: pendingFiles.length > 0 }"
      @dragenter.prevent="$emit('update:dragOver', true)"
      @dragover.prevent="$emit('update:dragOver', true)"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="$emit('drop', $event)"
      @paste="$emit('paste', $event)"
    >
      <input
        ref="fileInputRef"
        type="file"
        class="xk-file-input"
        multiple
        accept=".txt,.md,.markdown,.docx,.pdf,.xlsx,.xls,.json,.csv,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.bmp,image/*"
        @change="$emit('file-pick', $event)"
      />
      <div v-if="pendingFiles.length === 0" class="xk-drop-hint" @click="fileInputRef?.click()">
        <span>📎 上传文件 / 粘贴图片</span>
        <span class="muted">拖拽或 Ctrl/Cmd+V · 文档 + png/jpg/gif/webp</span>
      </div>
      <div v-else class="xk-file-list">
        <div v-for="(f, i) in pendingFiles" :key="f.file.name + i" class="xk-file-row">
          <img v-if="f.previewUrl" :src="f.previewUrl" class="xk-file-thumb" alt="" />
          <div class="xk-file-meta">
            <span class="xk-file-name">{{ f.file.name }}</span>
            <span class="xk-file-size">{{ formatSize(f.file.size) }}{{ f.isImage ? ' · 图片' : '' }}</span>
          </div>
          <button type="button" class="xk-file-rm" title="移除" @click="$emit('remove-file', i)">✕</button>
        </div>
        <div class="xk-file-actions">
          <button type="button" class="xk-chip" @click="fileInputRef?.click()">继续添加</button>
          <button
            type="button"
            class="xk-chip primary"
            :disabled="uploading || loading || !configured"
            @click="$emit('chip', 'cases')"
          >
            生成测试用例
          </button>
          <button
            type="button"
            class="xk-chip accent"
            :disabled="uploading || !configured"
            @click="$emit('upload')"
          >
            {{ uploading ? '入库中…' : '上传并入库' }}
          </button>
        </div>
      </div>
    </div>

    <div class="xk-composer">
      <textarea
        :value="modelValue"
        class="xk-input"
        rows="2"
        placeholder="输入消息，或 Ctrl/Cmd+V 粘贴截图…"
        :disabled="loading || uploading || !configured"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="onKeydown"
        @paste="$emit('paste', $event)"
      />
      <button
        type="button"
        class="xk-send"
        :disabled="loading || uploading || !configured || (!modelValue.trim() && pendingFiles.length === 0)"
        @click="$emit('send')"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatSize, type PendingFile } from './types'

defineProps<{
  modelValue: string
  pendingFiles: PendingFile[]
  dragOver: boolean
  uploading: boolean
  loading: boolean
  configured: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  'update:dragOver': [v: boolean]
  chip: [id: string]
  drop: [e: DragEvent]
  paste: [e: ClipboardEvent]
  'file-pick': [e: Event]
  'remove-file': [i: number]
  upload: []
  send: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const chips = [
  { id: 'cases', label: '生成测试用例' },
  { id: 'save', label: '存入流程' },
  { id: 'monitor', label: '监控页面' },
  { id: 'query', label: '查询知识' },
  { id: 'report', label: '生成报告' },
  { id: 'run', label: '运行工作流' }
]

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement
  if (!el.contains(e.relatedTarget as Node)) emit('update:dragOver', false)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send')
  }
}
</script>

<style scoped>
.xk-input-block {
  --panel: #eceff3;
  --panel-2: #e2e6eb;
  --line: #cdd3dc;
  --text: var(--app-text);
  --muted: var(--app-text-secondary);
  --accent: var(--app-primary);
  --accent-2: #337ecc;
  --danger: var(--app-danger);
  flex-shrink: 0;
  background: #e8ebef;
  border-top: 1px solid var(--line);
}
.xk-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 22px;
  flex-shrink: 0;
}
.xk-drop {
  margin: 0 22px 8px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: var(--panel-2);
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  flex-shrink: 0;
}
.xk-drop.active {
  border-color: var(--accent);
  background: rgba(24, 144, 255, 0.08);
}
.xk-drop.hasFiles {
  border-style: solid;
}
.xk-file-input {
  display: none;
}
.xk-drop-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.xk-drop-hint .muted {
  color: var(--muted);
  font-size: 12px;
}
.xk-file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.xk-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #e8ebef;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
}
.xk-file-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--line);
}
.xk-file-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.xk-file-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.xk-file-size {
  font-size: 11px;
  color: var(--muted);
}
.xk-file-rm {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
}
.xk-file-rm:hover {
  color: var(--danger);
}
.xk-file-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.xk-chip {
  border: 1px solid var(--line);
  background: #eceff3;
  color: var(--muted);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.xk-chip:hover,
.xk-chip.accent {
  color: var(--accent);
  border-color: var(--accent);
}
.xk-chip.primary {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}
.xk-chip.primary:hover {
  background: var(--accent-2);
  border-color: var(--accent-2);
  color: #fff;
}
.xk-composer {
  display: flex;
  gap: 10px;
  padding: 10px 22px 16px;
  align-items: flex-end;
  flex-shrink: 0;
}
.xk-input {
  flex: 1;
  resize: none;
  background: var(--app-surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--text);
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 56px;
}
.xk-input:focus { border-color: var(--accent); }
.xk-input:disabled { opacity: 0.5; }
.xk-send {
  height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #ffffff;
  font-weight: 650;
  cursor: pointer;
}
.xk-send:disabled { opacity: 0.4; cursor: not-allowed; }
.xk-send:not(:disabled):hover { background: var(--accent-2); }
</style>
