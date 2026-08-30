<template>
  <el-dialog
    :model-value="modelValue"
    width="640px"
    class="bug-submit-dialog"
    :align-center="false"
    top="6vh"
    :show-close="false"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
    @closed="onClosed"
  >
    <div class="bsd-wrap">
      <div class="bsd-header">
        <div class="bsd-title">
          <span class="bsd-title-icon" aria-hidden="true">!</span>
          <span>{{ mode === 'edit' ? '编辑 Bug' : '提 Bug' }}</span>
        </div>
        <button type="button" class="bsd-close" aria-label="关闭" @click="close">×</button>
      </div>

      <div class="bsd-body">
      <!-- 基本信息 -->
      <div class="bsd-section">
        <div class="bsd-divider"><span>基本信息</span></div>

        <div class="bsd-grid bsd-grid-2">
          <label class="bsd-field">
            <span class="bsd-label">问题类型 <em>*</em></span>
            <el-select v-model="form.issueType" class="bsd-select bsd-type-select" popper-class="bsd-select-popper" teleported>
              <el-option v-for="t in issueTypeOptions" :key="t.value" :label="t.label" :value="t.value">
                <span class="type-opt"><span class="type-dot" />{{ t.label }}</span>
              </el-option>
            </el-select>
          </label>

          <label class="bsd-field">
            <span class="bsd-label">优先级 <em>*</em></span>
            <el-select
              v-model="form.priority"
              class="bsd-select bsd-prio-select"
              :class="'is-prio-' + form.priority"
              popper-class="bsd-select-popper"
              teleported
            >
              <el-option
                v-for="p in BUG_PRIORITIES"
                :key="p.value"
                :label="`${p.prefix} ${p.label}`"
                :value="p.value"
              >
                <span :class="['prio-opt', 'prio-' + p.value]">{{ p.prefix }} {{ p.label }}</span>
              </el-option>
            </el-select>
          </label>
        </div>

        <label class="bsd-field bsd-field-summary">
          <span class="bsd-label">概要 <em>*</em><small>一句话描述问题</small></span>
          <el-input
            v-model="form.summary"
            maxlength="200"
            placeholder="例：获取用户信息接口后台没返回外部 merchantId"
          />
        </label>

        <div class="bsd-grid bsd-grid-2">
          <label class="bsd-field">
            <span class="bsd-label">模块 <em>*</em></span>
            <el-select
              v-model="form.modules"
              multiple
              filterable
              allow-create
              default-first-option
              :collapse-tags="false"
              placeholder="输入模块名…"
              class="bsd-select bsd-module-select"
              popper-class="bsd-select-popper"
              teleported
            >
              <el-option v-for="m in moduleSuggestions" :key="m" :label="m" :value="m" />
            </el-select>
          </label>
          <label class="bsd-field">
            <span class="bsd-label">当前版本 <em>*</em></span>
            <el-select
              v-model="form.appVersion"
              filterable
              allow-create
              default-first-option
              placeholder="选择版本"
              class="bsd-select"
              popper-class="bsd-select-popper"
              teleported
            >
              <el-option v-for="v in versionOptions" :key="v" :label="v" :value="v" />
            </el-select>
          </label>
        </div>

        <label v-if="showRequirement" class="bsd-field bsd-field-req">
          <span class="bsd-label">需求单 <em>*</em></span>
          <el-input v-model="form.requirementNo" placeholder="如 APP-8999" :disabled="!!form.id" />
        </label>
      </div>

      <!-- 问题描述 -->
      <div class="bsd-section">
        <div class="bsd-divider"><span>问题描述</span></div>
        <label class="bsd-field">
          <span class="bsd-label">描述 <em>*</em></span>
          <div class="bsd-editor">
            <div class="bsd-toolbar">
              <button type="button" title="加粗" @click="wrapDesc('**', '**')"><b>B</b></button>
              <button type="button" title="斜体" @click="wrapDesc('*', '*')"><i>I</i></button>
              <button type="button" title="下划线" @click="wrapDesc('<u>', '</u>')"><u>U</u></button>
              <span class="bsd-toolbar-sep" />
              <button type="button" title="无序列表" @click="insertDesc('- ')">
                <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="2" cy="4" r="1.2" fill="currentColor"/><circle cx="2" cy="8" r="1.2" fill="currentColor"/><circle cx="2" cy="12" r="1.2" fill="currentColor"/><rect x="5" y="3" width="10" height="2" rx="1" fill="currentColor"/><rect x="5" y="7" width="10" height="2" rx="1" fill="currentColor"/><rect x="5" y="11" width="10" height="2" rx="1" fill="currentColor"/></svg>
              </button>
              <button type="button" title="有序列表" @click="insertDesc('1. ')">
                <svg viewBox="0 0 16 16" width="14" height="14"><text x="1" y="5" font-size="5" fill="currentColor">1.</text><text x="1" y="9" font-size="5" fill="currentColor">2.</text><text x="1" y="13" font-size="5" fill="currentColor">3.</text><rect x="6" y="3" width="9" height="2" rx="1" fill="currentColor"/><rect x="6" y="7" width="9" height="2" rx="1" fill="currentColor"/><rect x="6" y="11" width="9" height="2" rx="1" fill="currentColor"/></svg>
              </button>
              <button type="button" class="bsd-chip-btn" @click="insertActual">实际</button>
              <button type="button" class="bsd-chip-btn" @click="insertExpected">期望</button>
            </div>
            <textarea
              ref="descRef"
              v-model="form.description"
              class="bsd-textarea"
              rows="4"
            />
          </div>
        </label>
      </div>

      <!-- 人员与附件 -->
      <div class="bsd-section">
        <div class="bsd-divider"><span>人员与附件</span></div>
        <div class="bsd-grid bsd-grid-2">
          <label class="bsd-field">
            <span class="bsd-label">报告人 <em>*</em></span>
            <el-select
              v-model="form.reporter"
              filterable
              allow-create
              default-first-option
              placeholder="输入用户名搜索"
              class="bsd-select"
              popper-class="bsd-select-popper"
              teleported
            >
              <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
            </el-select>
            <small class="bsd-hint">系统会提供匹配的用户列表供您选择</small>
          </label>
          <label class="bsd-field">
            <span class="bsd-label">经办人</span>
            <el-select
              v-model="form.assignee"
              filterable
              allow-create
              clearable
              default-first-option
              placeholder="输入用户名搜索"
              class="bsd-select"
              popper-class="bsd-select-popper"
              teleported
            >
              <el-option v-for="u in userOptions" :key="'a-' + u" :label="u" :value="u" />
            </el-select>
            <button type="button" class="bsd-link-btn" @click="assignToMe">分配给我</button>
          </label>
        </div>

        <label class="bsd-field">
          <span class="bsd-label">附件</span>
          <input ref="fileInput" type="file" accept="image/*,.log,.txt" multiple hidden @change="onPickFiles" />
          <div
            class="bsd-upload"
            :class="{ dragover: dragOver, uploading }"
            @click="fileInput?.click()"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
          >
            <svg class="bsd-upload-svg" viewBox="0 0 48 48">
              <path d="M24 6v22M24 6l-8 8M24 6l8 8" stroke="#c0c4cc" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 32v4a4 4 0 004 4h24a4 4 0 004-4v-4" stroke="#c0c4cc" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            </svg>
            <p>拖拽文件到此处，或 <em>点击上传</em>（截图 / 日志）</p>
          </div>
          <ul v-if="form.images?.length" class="bsd-files">
            <li v-for="(u, i) in form.images" :key="u + i">
              <span class="file-icon">🖼</span>
              <span class="file-name">{{ fileName(u) }}</span>
              <span class="file-bar"><i /></span>
              <button type="button" class="file-remove" @click="removeImage(i)">×</button>
            </li>
          </ul>
        </label>
      </div>

      <div v-if="showLinked" class="bsd-section bsd-optional">
        <div class="bsd-divider"><span>关联信息（可选）</span></div>
        <label class="bsd-field">
          <span class="bsd-label">链接的问题</span>
          <div v-for="(li, idx) in form.linkedIssues" :key="idx" class="bsd-link-row">
            <el-select v-model="li.relation" class="bsd-link-type" popper-class="bsd-select-popper" teleported>
              <el-option v-for="r in linkRelationOptions" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
            <el-input v-model="li.ref" placeholder="输入问题编号或关键词搜索" />
            <button type="button" class="bsd-link-remove" @click="removeLink(idx)">×</button>
          </div>
          <button type="button" class="bsd-link-add" @click="addLink">+</button>
        </label>
      </div>
      <button v-else type="button" class="bsd-expand-linked" @click="showLinked = true">+ 添加关联信息（可选）</button>
      </div>

      <div class="bsd-footer">
        <span class="bsd-required-tip"><em>*</em> 为必填项</span>
        <div class="bsd-actions">
          <button type="button" class="bsd-btn bsd-btn-cancel" @click="close">取消</button>
          <button type="button" class="bsd-btn bsd-btn-submit" :disabled="submitting" @click="submit">
            {{ submitting ? '提交中…' : mode === 'edit' ? '保存' : '提交 Bug' }}
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { user } from '@/stores/auth'
import {
  BUG_PRIORITIES,
  normalizeBugPriority
} from '@/utils/bugPriority'
import {
  type BugSubmitValue,
  bugValueToApiPayload,
  defaultBugValue
} from '@/utils/bugSubmit'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode?: 'create' | 'edit'
    value?: BugSubmitValue
    showRequirement?: boolean
    userOptions?: string[]
    moduleSuggestions?: string[]
    versionOptions?: string[]
    submitting?: boolean
  }>(),
  {
    mode: 'create',
    showRequirement: false,
    userOptions: () => [],
    moduleSuggestions: () => ['访客管理', '好友PK', '登录注册', '支付模块'],
    versionOptions: () => ['V3.6', 'V3.5', 'V3.4', 'V3.3'],
    submitting: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [ReturnType<typeof bugValueToApiPayload>]
}>()

const issueTypeOptions = [
  { value: '故障', label: '故障' },
  { value: '缺陷', label: '缺陷' },
  { value: '改进', label: '改进' },
  { value: '任务', label: '任务' }
]

const linkRelationOptions = [
  { value: 'blocks', label: 'blocks' },
  { value: 'is blocked by', label: 'is blocked by' },
  { value: 'relates to', label: 'relates to' },
  { value: 'duplicates', label: 'duplicates' }
]

const form = reactive<BugSubmitValue>(defaultBugValue())
const fileInput = ref<HTMLInputElement>()
const descRef = ref<HTMLTextAreaElement>()
const dragOver = ref(false)
const uploading = ref(false)
const showLinked = ref(false)

function onOpen() {
  Object.assign(form, defaultBugValue(props.value))
  form.priority = normalizeBugPriority(form.priority)
  showLinked.value = !!(form.linkedIssues?.length && form.linkedIssues.some((li) => li.ref?.trim()))
  if (!form.reporter && user.value) {
    form.reporter = user.value.displayName || user.value.username
  }
  if (!form.linkedIssues?.length) {
    form.linkedIssues = [{ relation: 'blocks', ref: '' }]
  }
}

onMounted(() => {
  if (props.modelValue) onOpen()
})

function onClosed() {
  dragOver.value = false
  uploading.value = false
  showLinked.value = false
}

function close() {
  emit('update:modelValue', false)
}

function assignToMe() {
  if (user.value) form.assignee = user.value.displayName || user.value.username
}

function wrapDesc(before: string, after: string) {
  const el = descRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const text = form.description || ''
  const sel = text.slice(start, end)
  form.description = text.slice(0, start) + before + sel + after + text.slice(end)
}

function insertDesc(prefix: string) {
  const el = descRef.value
  if (!el) return
  const start = el.selectionStart
  const text = form.description || ''
  form.description = text.slice(0, start) + prefix + text.slice(start)
}

function insertActual() {
  insertBlock('【实际结果】', '描述实际发生了什么...')
}

function insertExpected() {
  insertBlock('【期望结果】', '描述期望的正确行为...')
}

function insertBlock(title: string, hint: string) {
  const block = `${title}\n${hint}`
  const text = form.description || ''
  form.description = text.trim() ? `${text.trim()}\n\n${block}` : block
}

async function uploadFiles(files: File[]) {
  if (!files.length) return
  uploading.value = true
  try {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length) {
      const r = await apiClient.uploadBugImages(images)
      form.images = [...(form.images || []), ...r.urls]
    }
    const others = files.filter((f) => !f.type.startsWith('image/'))
    if (others.length) {
      ElMessage.info('日志类附件请粘贴到描述中；当前仅支持截图上传')
    }
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onPickFiles(e: Event) {
  uploadFiles(Array.from((e.target as HTMLInputElement).files || []))
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  uploadFiles(Array.from(e.dataTransfer?.files || []))
}

function removeImage(i: number) {
  form.images?.splice(i, 1)
}

function fileName(url: string) {
  const seg = url.split('/').pop() || url
  return seg.length > 32 ? seg.slice(0, 14) + '…' + seg.slice(-12) : seg
}

function addLink() {
  form.linkedIssues = [...(form.linkedIssues || []), { relation: 'blocks', ref: '' }]
}

function removeLink(i: number) {
  const list = [...(form.linkedIssues || [])]
  list.splice(i, 1)
  form.linkedIssues = list.length ? list : [{ relation: 'blocks', ref: '' }]
}

function submit() {
  if (props.showRequirement && !String(form.requirementNo || '').trim()) {
    ElMessage.warning('请填写需求单')
    return
  }
  if (!String(form.summary || '').trim()) {
    ElMessage.warning('请填写概要')
    return
  }
  if (!form.modules?.length && !String(form.module || '').trim()) {
    ElMessage.warning('请填写模块')
    return
  }
  if (!String(form.appVersion || '').trim()) {
    ElMessage.warning('请选择当前版本')
    return
  }
  if (!String(form.description || '').trim()) {
    ElMessage.warning('请填写问题描述')
    return
  }
  if (!String(form.reporter || '').trim()) {
    ElMessage.warning('请填写报告人')
    return
  }
  emit('submit', bugValueToApiPayload(form))
}
</script>

<style scoped>
.bug-submit-dialog :deep(.el-dialog) {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.12);
  margin-bottom: 0;
}

.bug-submit-dialog :deep(.el-dialog__header) {
  display: none;
}

.bug-submit-dialog :deep(.el-dialog__body) {
  padding: 0;
  max-height: none;
  overflow: visible;
}

.bug-submit-dialog :deep(.el-dialog__footer) {
  display: none;
}

.bsd-wrap {
  display: flex;
  flex-direction: column;
  max-height: 88vh;
}

/* header — 紧凑单行 */
.bsd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}

.bsd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.bsd-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.bsd-close {
  border: none;
  background: none;
  font-size: 18px;
  line-height: 1;
  color: #8f959e;
  cursor: pointer;
  padding: 0 2px;
}

.bsd-close:hover {
  color: #646a73;
}

.bsd-body {
  padding: 0 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* section divider */
.bsd-section:first-child .bsd-divider {
  margin-top: 10px;
}

.bsd-divider {
  display: flex;
  align-items: center;
  margin: 12px 0 10px;
  color: #8f959e;
  font-size: 12px;
  user-select: none;
}

.bsd-divider::before,
.bsd-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #dee0e3;
}

.bsd-divider span {
  padding: 0 14px;
  white-space: nowrap;
}

.bsd-divider-click {
  cursor: pointer;
  list-style: none;
}

.bsd-expand-linked {
  display: block;
  width: 100%;
  margin: 4px 0 8px;
  padding: 6px 0;
  border: none;
  background: none;
  color: #3370ff;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.bsd-expand-linked:hover {
  text-decoration: underline;
}

.bsd-optional summary::-webkit-details-marker {
  display: none;
}

/* fields */
.bsd-grid {
  display: grid;
  gap: 10px;
  margin-bottom: 0;
}

.bsd-grid-2 {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 640px) {
  .bsd-grid-2 {
    grid-template-columns: 1fr;
  }
}

.bsd-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.bsd-field-summary .bsd-label small {
  font-weight: 400;
  color: #8f959e;
  margin-left: 6px;
  font-size: 12px;
}

.bsd-field-req {
  margin-top: -4px;
}

.bsd-label {
  font-size: 13px;
  color: #1f2329;
  font-weight: 600;
  line-height: 1.3;
}

.bsd-label em {
  color: #ff4d4f;
  font-style: normal;
  margin-left: 2px;
}

.bsd-sublabel {
  display: none;
}

.bsd-hint {
  font-size: 11px;
  color: #8f959e;
  line-height: 1.3;
  margin-top: -2px;
}

/* selects / inputs — 对齐设计稿圆角与高度 */
.bsd-select {
  width: 100%;
}

.bsd-select :deep(.el-select__wrapper),
.bsd-field :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #dee0e3 inset;
  background: #fff;
  padding: 2px 10px;
  font-size: 13px;
}

.bsd-select :deep(.el-select__wrapper:hover),
.bsd-field :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c9cdd4 inset;
}

.bsd-select :deep(.el-select__wrapper.is-focused),
.bsd-field :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3370ff inset !important;
}

.bsd-type-select :deep(.el-select__wrapper) {
  background: #fff1f0;
  box-shadow: 0 0 0 1px #ffccc7 inset;
}

.bsd-type-select :deep(.el-select__selected-item) {
  color: #1f2329;
  font-weight: 500;
}

.bsd-prio-select.is-prio-CRITICAL :deep(.el-select__wrapper) {
  background: #fffbe6;
  box-shadow: 0 0 0 1px #ffe58f inset;
}

.bsd-prio-select.is-prio-HIGH :deep(.el-select__wrapper) {
  background: #fff7e6;
}

.bsd-module-select :deep(.el-select__selection) {
  flex-wrap: wrap;
  gap: 4px;
}

.bsd-module-select :deep(.el-tag) {
  background: #e8f3ff;
  border-color: #b8daff;
  color: #245bdb;
  border-radius: 4px;
}

.type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4d4f;
  flex-shrink: 0;
}

.type-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.prio-selected,
.prio-opt {
  font-weight: 600;
  font-size: 13px;
}

.prio-CRITICAL { color: #d48806; }
.prio-HIGH { color: #d48806; }
.prio-MEDIUM { color: #646a73; }
.prio-LOW { color: #8f959e; }

/* editor */
.bsd-editor {
  border: 1px solid #dee0e3;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.bsd-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: #f5f6f7;
  border-bottom: 1px solid #dee0e3;
}

.bsd-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  min-width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: #646a73;
  font-size: 12px;
  padding: 0 3px;
}

.bsd-toolbar button:hover {
  background: #e8eaed;
}

.bsd-toolbar-sep {
  width: 1px;
  height: 16px;
  background: #dee0e3;
  margin: 0 6px;
}

.bsd-chip-btn {
  margin-left: 2px;
  padding: 0 10px !important;
  height: 26px !important;
  font-size: 12px !important;
  background: #fff !important;
  border: 1px solid #dee0e3 !important;
  border-radius: 4px !important;
  color: #646a73 !important;
}

.bsd-chip-btn:hover {
  border-color: #3370ff !important;
  color: #3370ff !important;
}

.bsd-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  min-height: 88px;
  max-height: 160px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2329;
  font-family: inherit;
  box-sizing: border-box;
}

.bsd-link-btn {
  align-self: flex-start;
  border: none;
  background: none;
  color: #3370ff;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.bsd-link-btn:hover {
  text-decoration: underline;
}

/* upload */
.bsd-upload {
  border: 1px dashed #c9cdd4;
  border-radius: 6px;
  padding: 14px 12px;
  text-align: center;
  cursor: pointer;
  background: #fafbfc;
  transition: border-color 0.15s, background 0.15s;
}

.bsd-upload.dragover,
.bsd-upload:hover {
  border-color: #3370ff;
  background: #f0f5ff;
}

.bsd-upload.uploading {
  opacity: 0.65;
  pointer-events: none;
}

.bsd-upload-svg {
  display: block;
  margin: 0 auto 6px;
  width: 32px;
  height: 32px;
}

.bsd-upload p {
  margin: 0;
  font-size: 12px;
  color: #646a73;
}

.bsd-upload em {
  color: #3370ff;
  font-style: normal;
}

.bsd-files {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}

.bsd-files li {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2329;
}

.file-bar {
  width: 72px;
  height: 4px;
  background: #e8eaed;
  border-radius: 2px;
  overflow: hidden;
}

.file-bar i {
  display: block;
  height: 100%;
  width: 100%;
  background: #52c41a;
}

.file-remove {
  border: none;
  background: none;
  color: #8f959e;
  font-size: 16px;
  cursor: pointer;
}

.bsd-link-row {
  display: grid;
  grid-template-columns: 118px 1fr 32px;
  gap: 8px;
  margin-bottom: 8px;
}

.bsd-link-remove,
.bsd-link-add {
  width: 32px;
  height: 32px;
  border: 1px solid #dee0e3;
  border-radius: 6px;
  background: #fff;
  color: #3370ff;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.bsd-link-add {
  margin-top: 2px;
}

/* footer — 固定在弹窗底部 */
.bsd-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 20px 14px;
  border-top: 1px solid #eef0f3;
  flex-shrink: 0;
  background: #fff;
}

.bsd-required-tip {
  font-size: 12px;
  color: #8f959e;
}

.bsd-required-tip em {
  color: #ff4d4f;
  font-style: normal;
}

.bsd-actions {
  display: flex;
  gap: 12px;
}

.bsd-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.bsd-btn-cancel {
  background: #fff;
  border-color: #dee0e3;
  color: #1f2329;
}

.bsd-btn-cancel:hover {
  background: #f5f6f7;
}

.bsd-btn-submit {
  background: #ff4d4f;
  color: #fff;
  font-weight: 600;
  min-width: 108px;
}

.bsd-btn-submit:hover:not(:disabled) {
  background: #ff7875;
}

.bsd-btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
