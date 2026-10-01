<template>
  <el-dialog
    :model-value="modelValue"
    class="prod-exec-dlg"
    width="520px"
    append-to-body
    align-center
    :show-close="false"
    @close="onClose"
  >
    <template #header>
      <div class="prod-head">
        <span class="prod-title">生产环境提醒</span>
        <button type="button" class="prod-close" aria-label="关闭" @click="cancel">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="prod-banner">
      <span class="prod-banner-left">
        <el-icon><WarningFilled /></el-icon>
        生产环境 · 线上真实包
      </span>
      <span class="prod-banner-right">操作会影响真实用户数据</span>
    </div>

    <ul class="prod-warns">
      <li>将在线上正式包执行，产生的数据影响真实用户</li>
      <li>请确认流程中无写入、删除或下单；有的话请改去测试环境</li>
    </ul>

    <div class="prod-meta">
      <div class="prod-row">
        <span class="prod-k">流程</span>
        <span class="prod-v">{{ flowName || '—' }}</span>
      </div>
      <div class="prod-row">
        <span class="prod-k">设备</span>
        <span class="prod-v">{{ deviceName || '—' }}</span>
        <span class="prod-tag">PROD</span>
      </div>
    </div>

    <el-checkbox v-model="acked" class="prod-ack">
      我已确认此操作不会影响线上真实数据，仍要在生产环境执行
    </el-checkbox>

    <template #footer>
      <el-button class="prod-cancel" @click="cancel">取消</el-button>
      <el-button type="primary" class="prod-go" :disabled="!acked" @click="ok">
        <el-icon class="el-icon--left"><VideoPlay /></el-icon>
        仍要执行
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Close, VideoPlay, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  flowName?: string
  deviceName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
  cancel: []
}>()

const acked = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      acked.value = false
      settled = false
    }
  }
)

let settled = false

function finish(ok: boolean) {
  if (settled) return
  settled = true
  emit('update:modelValue', false)
  if (ok) emit('confirm')
  else emit('cancel')
}

function onClose() {
  finish(false)
}

function cancel() {
  finish(false)
}

function ok() {
  if (!acked.value) return
  finish(true)
}
</script>

<style scoped>
.prod-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.prod-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}
.prod-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.prod-close:hover {
  background: var(--el-fill-color-dark);
  color: var(--app-text-regular);
}
.prod-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
}
.prod-banner-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
}
.prod-banner-left .el-icon {
  font-size: 16px;
}
.prod-banner-right {
  font-size: 12px;
  color: #8c4a12;
}
.prod-warns {
  margin: 14px 0 0;
  padding-left: 18px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.7;
}
.prod-warns li::marker {
  color: var(--el-text-color-disabled);
}
.prod-meta {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.prod-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 26px;
}
.prod-k {
  width: 36px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  flex-shrink: 0;
}
.prod-v {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.prod-tag {
  margin-left: 6px;
  padding: 0 8px;
  height: 20px;
  line-height: 20px;
  border-radius: 999px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 11px;
  font-weight: 600;
}
.prod-ack {
  display: flex;
  align-items: flex-start;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  height: auto;
  white-space: normal;
}
.prod-ack :deep(.el-checkbox__input) {
  margin-top: 2px;
  flex-shrink: 0;
}
.prod-ack :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.5;
  color: var(--app-text-regular);
  font-size: 13px;
  padding-left: 8px;
}
.prod-cancel,
.prod-go {
  min-width: 76px;
  border-radius: 8px;
}
.prod-go {
  min-width: 96px;
}
</style>

<style>
.prod-exec-dlg.el-dialog {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
}
.prod-exec-dlg.el-dialog .el-dialog__header {
  margin: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--el-border-color);
}
.prod-exec-dlg.el-dialog .el-dialog__body {
  padding: 18px 20px 8px;
}
.prod-exec-dlg.el-dialog .el-dialog__footer {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--el-border-color);
}
</style>
