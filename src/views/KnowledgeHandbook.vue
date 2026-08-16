<template>
  <div class="knowledge-handbook">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">{{ categoryLabel }}</span>
            <p class="sub">短记三句话：现象 → 原因 → 处理。可粘贴素材让 AI 汇总，确认后再保存。</p>
          </div>
          <el-button type="primary" @click="openCreate">新增短记</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-select
          v-model="category"
          placeholder="分类"
          style="width: 260px"
          filterable
          @change="onCategoryChange"
        >
          <el-option-group v-for="g in HANDBOOK_GROUPS" :key="g.id" :label="g.label">
            <el-option
              v-for="c in g.categories"
              :key="c.code"
              :label="c.label"
              :value="c.code"
            />
          </el-option-group>
        </el-select>
        <el-select
          v-model="filterProject"
          clearable
          filterable
          placeholder="全部项目"
          style="width: 200px"
          @change="load"
        >
          <el-option
            v-for="p in projectOptions"
            :key="p.code"
            :label="p.name || p.code"
            :value="p.code"
          />
        </el-select>
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索标题 / 现象 / 原因 / 处理 / 标签"
          style="max-width: 360px"
          @keyup.enter="load"
          @clear="load"
        >
          <template #append>
            <el-button :icon="Search" @click="load" />
          </template>
        </el-input>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" size="small" border stripe>
        <el-table-column label="图" width="72" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="imageSrc(row.imageUrl)"
              :preview-src-list="[imageSrc(row.imageUrl)]"
              :preview-teleported="true"
              fit="cover"
              class="thumb"
            />
            <span v-else class="thumb-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column label="项目" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ projectLabel(row.project) }}
          </template>
        </el-table-column>
        <el-table-column label="现象" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.symptom }}
          </template>
        </el-table-column>
        <el-table-column prop="tags" label="标签" width="120" show-overflow-tooltip />
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="remove(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer
      v-model="drawer"
      :title="editingId ? '编辑短记' : '新增短记'"
      size="560px"
      destroy-on-close
    >
      <div
        class="ai-draft"
        :class="{ 'is-dragover': draftDragOver }"
        @dragenter.prevent="onDraftDragEnter"
        @dragover.prevent="onDraftDragOver"
        @dragleave.prevent="onDraftDragLeave"
        @drop.prevent="onDraftDrop"
      >
        <div class="ai-draft-title">AI 汇总（选填）</div>
        <p class="ai-draft-hint">
          粘贴日志 / 聊天 / 排查过程，或拖入 / 粘贴 1～3 张截图，点汇总后回填下方字段，确认再保存。
        </p>
        <el-input
          v-model="draftText"
          type="textarea"
          :rows="4"
          placeholder="在此粘贴杂乱素材，也可把图片拖进来…"
          @paste="onDraftPaste"
        />
        <div v-if="draftDragOver" class="ai-draft-drop-mask">松开鼠标添加图片</div>
        <div class="ai-draft-actions">
          <el-upload
            multiple
            :show-file-list="false"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            :auto-upload="false"
            :on-change="onDraftFileChange"
          >
            <el-button size="small">添加截图</el-button>
          </el-upload>
          <el-button
            type="primary"
            size="small"
            :loading="summarizing"
            @click="runAiSummarize"
          >
            AI 汇总
          </el-button>
        </div>
        <div v-if="draftFiles.length" class="draft-files">
          <div v-for="(f, i) in draftFiles" :key="i" class="draft-file">
            <span class="draft-file-name">{{ f.name }}</span>
            <el-button link type="danger" size="small" @click="removeDraftFile(i)">移除</el-button>
          </div>
        </div>
      </div>

      <el-divider />

      <el-form label-width="72px" size="small">
        <el-form-item label="分类" required>
          <el-select v-model="form.category" filterable style="width: 100%">
            <el-option-group v-for="g in HANDBOOK_GROUPS" :key="g.id" :label="g.label">
              <el-option
                v-for="c in g.categories"
                :key="c.code"
                :label="c.label"
                :value="c.code"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="项目" :required="formProjectRequired">
          <div class="project-select-row">
            <el-select
              v-model="form.project"
              clearable
              filterable
              style="flex: 1; min-width: 0"
              :placeholder="formProjectRequired ? '业务类必选（来自项目管理）' : '可选，来自项目管理'"
            >
              <el-option
                v-for="p in projectOptions"
                :key="p.code"
                :label="`${p.name || p.code}（${p.code}）`"
                :value="p.code"
              />
              <template #empty>
                <div class="project-select-empty">
                  <p>暂无可用项目</p>
                  <el-button type="primary" link size="small" @click="openQuickProject">新增项目</el-button>
                </div>
              </template>
            </el-select>
            <el-button type="primary" link @click="openQuickProject">新增项目</el-button>
          </div>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="一句话概括，方便列表识别" maxlength="255" />
        </el-form-item>
        <el-form-item label="现象" required>
          <el-input
            v-model="form.symptom"
            type="textarea"
            :rows="3"
            placeholder="短记一两句：遇到了什么"
          />
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input
            v-model="form.cause"
            type="textarea"
            :rows="3"
            placeholder="短记一两句：为什么会这样"
          />
        </el-form-item>
        <el-form-item label="处理" required>
          <el-input
            v-model="form.fix"
            type="textarea"
            :rows="3"
            placeholder="短记一两句：怎么解决的"
          />
        </el-form-item>
        <el-form-item label="配图">
          <div class="image-upload">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              :http-request="onUploadImage"
            >
              <el-button :loading="uploading">上传图片</el-button>
            </el-upload>
            <el-button v-if="form.imageUrl" link type="danger" @click="clearImage">清除</el-button>
            <span class="image-hint">选填；AI 汇总若带图会自动填入</span>
          </div>
          <el-image
            v-if="form.imageUrl"
            :src="imageSrc(form.imageUrl)"
            :preview-src-list="[imageSrc(form.imageUrl)]"
            :preview-teleported="true"
            :z-index="4000"
            fit="contain"
            class="image-preview"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="可选，逗号分隔，如 hdc,权限" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawer = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-drawer>

    <el-dialog
      v-model="projectDialog"
      title="新增项目"
      width="420px"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form label-width="72px" size="small" @submit.prevent>
        <el-form-item label="编码" required>
          <el-input
            v-model="projectForm.code"
            placeholder="如 android-domestic-esports（创建后不可改）"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="projectForm.name" placeholder="展示名称，如 Android · 国内电竞" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="projectForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectDialog = false">取消</el-button>
        <el-button type="primary" :loading="projectSaving" @click="saveQuickProject">创建并选用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile, UploadRequestOptions } from 'element-plus'
import { apiClient } from '../api'
import {
  HANDBOOK_GROUPS,
  DEFAULT_HANDBOOK_CATEGORY,
  handbookCategoryLabel,
  handbookProjectRequired,
  normalizeHandbookCategory,
  type HandbookCategoryCode
} from '../constants/handbookCategories'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const summarizing = ref(false)
const drawer = ref(false)
const editingId = ref<number | null>(null)
const rows = ref<any[]>([])
const keyword = ref('')
const filterProject = ref('')
const projectOptions = ref<Array<{ code: string; name?: string }>>([])
const draftText = ref('')
const draftFiles = ref<File[]>([])
const projectDialog = ref(false)
const projectSaving = ref(false)
const projectForm = reactive({
  code: '',
  name: '',
  description: ''
})

const category = ref<HandbookCategoryCode>(DEFAULT_HANDBOOK_CATEGORY)

const categoryLabel = computed(() => handbookCategoryLabel(category.value))
const formProjectRequired = computed(() => handbookProjectRequired(form.category))

const form = reactive({
  category: DEFAULT_HANDBOOK_CATEGORY as HandbookCategoryCode,
  project: '' as string,
  title: '',
  symptom: '',
  cause: '',
  fix: '',
  tags: '',
  imageUrl: '' as string
})

function imageSrc(path: string) {
  return apiClient.handbookImageUrl(path)
}

function projectLabel(code?: string | null) {
  if (!code) return '—'
  const hit = projectOptions.value.find((p) => p.code === code)
  return hit?.name || code
}

function resetDraft() {
  draftText.value = ''
  draftFiles.value = []
}

function syncCategoryFromRoute() {
  category.value = normalizeHandbookCategory(String(route.query.category || ''))
}

function onCategoryChange(code: string) {
  router.replace({ path: '/knowledge-handbook', query: { category: code } })
}

function formatTime(v?: string) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

async function loadProjects() {
  try {
    projectOptions.value = await apiClient.getApiProjects({ enabledOnly: true })
  } catch {
    projectOptions.value = []
  }
}

function openQuickProject() {
  projectForm.code = ''
  projectForm.name = ''
  projectForm.description = ''
  projectDialog.value = true
}

async function saveQuickProject() {
  const code = projectForm.code.trim()
  const name = projectForm.name.trim()
  if (!code || !name) {
    ElMessage.warning('编码和名称必填')
    return
  }
  projectSaving.value = true
  try {
    await apiClient.createApiProject({
      code,
      name,
      description: projectForm.description.trim(),
      enabled: true,
      sortOrder: 100
    })
    ElMessage.success('项目已创建')
    projectDialog.value = false
    await loadProjects()
    form.project = code
  } catch (e: any) {
    ElMessage.error(e?.message || '创建项目失败')
  } finally {
    projectSaving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    rows.value = await apiClient.listHandbook({
      category: category.value,
      project: filterProject.value || undefined,
      q: keyword.value.trim() || undefined,
      limit: 200
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.category = category.value
  form.project = filterProject.value || ''
  form.title = ''
  form.symptom = ''
  form.cause = ''
  form.fix = ''
  form.tags = ''
  form.imageUrl = ''
  resetDraft()
  loadProjects()
  drawer.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  form.category = normalizeHandbookCategory(row.category)
  form.project = row.project || ''
  form.title = row.title || ''
  form.symptom = row.symptom || ''
  form.cause = row.cause || ''
  form.fix = row.fix || ''
  form.tags = row.tags || ''
  form.imageUrl = row.imageUrl || ''
  resetDraft()
  loadProjects()
  drawer.value = true
}

const DRAFT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
])

const draftDragOver = ref(false)
let draftDragDepth = 0

function isDraftImageFile(file: File) {
  if (DRAFT_IMAGE_TYPES.has(file.type)) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')
}

function addDraftFiles(files: File[]) {
  if (!files.length) return
  const next = [...draftFiles.value]
  let added = 0
  for (const file of files) {
    if (!isDraftImageFile(file)) continue
    if (next.length >= 3) {
      ElMessage.warning('最多 3 张截图')
      break
    }
    if (file.size > 5 * 1024 * 1024) {
      ElMessage.warning(`「${file.name || '图片'}」超过 5MB，已跳过`)
      continue
    }
    next.push(file)
    added += 1
  }
  if (added === 0 && files.some((f) => !isDraftImageFile(f))) {
    ElMessage.warning('请拖入图片文件（png / jpg / gif / webp）')
    return
  }
  draftFiles.value = next
  if (added > 0) {
    ElMessage.success(`已添加 ${added} 张截图`)
  }
}

function onDraftFileChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  addDraftFiles([raw])
}

function onDraftDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  draftDragDepth += 1
  draftDragOver.value = true
}

function onDraftDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types?.includes('Files')) return
  e.dataTransfer.dropEffect = 'copy'
  draftDragOver.value = true
}

function onDraftDragLeave() {
  draftDragDepth = Math.max(0, draftDragDepth - 1)
  if (draftDragDepth === 0) {
    draftDragOver.value = false
  }
}

function onDraftDrop(e: DragEvent) {
  draftDragDepth = 0
  draftDragOver.value = false
  const list = e.dataTransfer?.files
  if (!list?.length) return
  addDraftFiles(Array.from(list))
}

function onDraftPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items?.length) return
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const blob = item.getAsFile()
    if (!blob || !isDraftImageFile(blob)) continue
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    const name =
      blob.name && blob.name !== 'image.png' ? blob.name : `paste-${Date.now()}.${ext}`
    files.push(new File([blob], name, { type: blob.type || 'image/png' }))
  }
  if (!files.length) return
  e.preventDefault()
  addDraftFiles(files)
}

function removeDraftFile(index: number) {
  draftFiles.value = draftFiles.value.filter((_, i) => i !== index)
}

async function runAiSummarize() {
  if (!draftText.value.trim() && draftFiles.value.length === 0) {
    ElMessage.warning('请先粘贴文字或添加截图')
    return
  }
  summarizing.value = true
  try {
    const res = await apiClient.aiSummarizeHandbook({
      text: draftText.value,
      hintCategory: form.category,
      hintProject: form.project || undefined,
      files: draftFiles.value
    })
    form.category = normalizeHandbookCategory(res.category)
    if (res.project) form.project = res.project
    form.title = res.title || ''
    form.symptom = res.symptom || ''
    form.cause = res.cause || ''
    form.fix = res.fix || ''
    form.tags = res.tags || ''
    if (res.imageUrl) {
      form.imageUrl = res.imageUrl
    }
    ElMessage.success('已汇总到下方表单，请确认后保存')
  } catch (e: any) {
    ElMessage.error(e?.message || 'AI 汇总失败')
  } finally {
    summarizing.value = false
  }
}

async function onUploadImage(opt: UploadRequestOptions) {
  const file = opt.file as File
  uploading.value = true
  try {
    const res = await apiClient.uploadHandbookImage(file)
    form.imageUrl = res.imageUrl
    ElMessage.success('图片已上传')
    opt.onSuccess?.(res as any)
  } catch (e: any) {
    ElMessage.error(e?.message || '上传失败')
    opt.onError?.(e)
  } finally {
    uploading.value = false
  }
}

function clearImage() {
  form.imageUrl = ''
}

async function save() {
  if (!form.title.trim() || !form.symptom.trim() || !form.cause.trim() || !form.fix.trim()) {
    ElMessage.warning('标题、现象、原因、处理均为必填')
    return
  }
  if (handbookProjectRequired(form.category) && !form.project) {
    ElMessage.warning('业务 / 测试规范类短记请选择归属项目')
    return
  }
  saving.value = true
  try {
    const body = {
      category: form.category,
      project: form.project || null,
      title: form.title.trim(),
      symptom: form.symptom.trim(),
      cause: form.cause.trim(),
      fix: form.fix.trim(),
      tags: form.tags.trim() || undefined,
      imageUrl: form.imageUrl.trim() || null
    }
    if (editingId.value) {
      await apiClient.updateHandbook(editingId.value, body)
    } else {
      await apiClient.createHandbook(body)
    }
    ElMessage.success('已保存')
    drawer.value = false
    if (form.category !== category.value) {
      category.value = form.category
      await router.replace({ path: '/knowledge-handbook', query: { category: form.category } })
    }
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`删除短记「${row.title}」？`, '确认删除', { type: 'warning' })
  try {
    await apiClient.deleteHandbook(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

watch(
  () => route.query.category,
  () => {
    syncCategoryFromRoute()
    load()
  }
)

onMounted(async () => {
  syncCategoryFromRoute()
  await loadProjects()
  if (!route.query.category) {
    router.replace({ path: '/knowledge-handbook', query: { category: category.value } })
  }
  load()
})
</script>

<style scoped>
.knowledge-handbook {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  align-items: center;
}

.thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
}

.thumb-empty {
  color: #c0c4cc;
}

.ai-draft {
  position: relative;
  margin-bottom: 4px;
  padding: 12px;
  background: var(--app-surface);
  border-radius: 8px;
  border: 1px dashed transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ai-draft.is-dragover {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-surface));
}

.ai-draft-drop-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  color: var(--el-color-primary);
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
}

.ai-draft-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.ai-draft-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.ai-draft-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.draft-files {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.draft-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.draft-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360px;
}

.image-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.image-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.image-preview {
  margin-top: 10px;
  width: 100%;
  max-height: 220px;
  border-radius: 6px;
  background: var(--app-surface);
}

.project-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.project-select-empty {
  padding: 12px 8px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.project-select-empty p {
  margin: 0 0 4px;
}
</style>
