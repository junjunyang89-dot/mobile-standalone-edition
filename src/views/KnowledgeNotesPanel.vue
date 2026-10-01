<template>
  <div class="kn">
    <div class="bar">
      <el-select
        v-model="moduleId"
        filterable
        clearable
        placeholder="全部模块"
        style="width: 260px"
        @change="load"
      >
        <el-option v-for="m in modules" :key="m.id" :label="m.fullName" :value="m.id" />
      </el-select>
      <el-select v-model="status" style="width: 120px" @change="load">
        <el-option label="仍有效" value="ACTIVE" />
        <el-option label="已过时" value="STALE" />
        <el-option label="全部" value="ALL" />
      </el-select>
      <el-input
        v-model="keyword"
        placeholder="搜标题 / 内容 / 单号"
        style="width: 220px"
        clearable
        @change="load"
        @keyup.enter="load"
      />
      <el-button @click="load">查询</el-button>
      <el-button v-perm:write type="primary" @click="openCreate()">记一条</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" size="small" border stripe style="margin-top: 10px">
      <el-table-column label="图" width="72" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.images?.[0]"
            :src="imgSrc(row.images[0])"
            :preview-src-list="(row.images || []).map(imgSrc)"
            preview-teleported
            fit="cover"
            class="thumb"
          />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="moduleLabel" label="模块" min-width="160" show-overflow-tooltip />
      <el-table-column label="需求" width="120">
        <template #default="{ row }">{{ row.requirementNo || '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'STALE' ? 'info' : 'success'">
            {{ row.statusLabel || (row.status === 'STALE' ? '已过时' : '仍有效') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新" width="160">
        <template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button
            v-if="row.status !== 'STALE'"
            v-perm:write
            link
            size="small"
            @click="markStale(row)"
          >
            标过时
          </el-button>
          <el-button v-perm:delete link type="danger" size="small" @click="remove(row)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && rows.length === 0" description="还没有知识点。测到规则就记一条，下次按模块能搜到" />

    <el-dialog
      v-model="open"
      :title="form.id ? '编辑知识点' : '记一条'"
      width="640px"
      destroy-on-close
      @paste="onPaste"
    >
      <el-form label-width="88px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="255" placeholder="一句话，例如：礼物墙空态其实是登录过期" />
        </el-form-item>
        <el-form-item label="模块" required>
          <el-select v-model="form.moduleId" filterable placeholder="从模块树选" style="width: 100%">
            <el-option v-for="m in modules" :key="m.id" :label="m.fullName" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求单">
          <el-input v-model="form.requirementNo" placeholder="选填，如 APP-9069" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="form.body"
            type="textarea"
            :rows="5"
            placeholder="这条规则怎么触发、容易踩哪。可直接粘贴截图"
          />
        </el-form-item>
        <el-form-item label="截图">
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            hidden
            @change="onPickFiles"
          />
          <div
            class="upload-zone"
            :class="{ dragover, uploading }"
            @click="fileInput?.click()"
            @dragover.prevent="dragover = true"
            @dragleave.prevent="dragover = false"
            @drop.prevent="onDrop"
          >
            {{ uploading ? '上传中…' : '拖拽、点击或 Ctrl+V 粘贴（最多 8 张）' }}
          </div>
          <div v-if="form.images.length" class="shot-grid">
            <div v-for="(u, i) in form.images" :key="u + i" class="shot-item">
              <el-image
                :src="imgSrc(u)"
                :preview-src-list="form.images.map(imgSrc)"
                :initial-index="i"
                fit="cover"
                preview-teleported
              />
              <button type="button" class="shot-del" @click="removeImage(i)">×</button>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="form.id" label="状态">
          <el-radio-group v-model="form.status">
            <el-radio-button label="ACTIVE">仍有效</el-radio-button>
            <el-radio-button label="STALE">已过时</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button v-perm:write type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

defineProps<{
  modules: Array<{ id: string; fullName: string }>
}>()

const loading = ref(false)
const rows = ref<any[]>([])
const moduleId = ref('')
const status = ref('ACTIVE')
const keyword = ref('')
const open = ref(false)
const saving = ref(false)
const uploading = ref(false)
const dragover = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  id: '',
  title: '',
  body: '',
  moduleId: '',
  requirementNo: '',
  images: [] as string[],
  status: 'ACTIVE'
})

function imgSrc(path?: string) {
  return apiClient.resolveAssetUrl(path)
}

function fmtTime(v: unknown) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

async function load() {
  loading.value = true
  try {
    const res = await apiClient.listKnowledgeNotes({
      moduleId: moduleId.value || undefined,
      status: status.value,
      q: keyword.value || undefined
    })
    rows.value = res.notes || []
  } catch (e: any) {
    rows.value = []
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    id: '',
    title: '',
    body: '',
    moduleId: '',
    requirementNo: '',
    images: [],
    status: 'ACTIVE'
  })
}

function openCreate(prefill?: { requirementNo?: string; moduleId?: string }) {
  resetForm()
  if (prefill?.requirementNo) form.requirementNo = prefill.requirementNo
  if (prefill?.moduleId) form.moduleId = prefill.moduleId
  open.value = true
}

function openEdit(row: any) {
  Object.assign(form, {
    id: row.id,
    title: row.title || '',
    body: row.body || '',
    moduleId: row.moduleId || '',
    requirementNo: row.requirementNo || '',
    images: [...(row.images || [])],
    status: row.status === 'STALE' ? 'STALE' : 'ACTIVE'
  })
  open.value = true
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('标题必填')
    return
  }
  if (!form.moduleId) {
    ElMessage.warning('模块必填，下次才能按功能找回来')
    return
  }
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      body: form.body,
      moduleId: form.moduleId,
      requirementNo: form.requirementNo.trim() || null,
      images: form.images,
      status: form.status
    }
    if (form.id) {
      await apiClient.updateKnowledgeNote(form.id, body)
    } else {
      await apiClient.createKnowledgeNote(body)
    }
    ElMessage.success('已保存')
    open.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function markStale(row: any) {
  try {
    await apiClient.updateKnowledgeNote(row.id, { status: 'STALE' })
    ElMessage.success('已标过时，列表默认不再出现')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」？`, '删除', { type: 'warning' })
    await apiClient.deleteKnowledgeNote(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

async function uploadFiles(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name))
  if (!images.length) {
    ElMessage.warning('仅支持 png/jpg/gif/webp')
    return
  }
  if (form.images.length + images.length > 8) {
    ElMessage.warning('最多 8 张截图')
    return
  }
  uploading.value = true
  try {
    const r = await apiClient.uploadKnowledgeNoteImages(images)
    form.images = [...form.images, ...(r.urls || [])]
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
  dragover.value = false
  uploadFiles(Array.from(e.dataTransfer?.files || []))
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items?.length) return
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const blob = item.getAsFile()
    if (!blob || !blob.type.startsWith('image/')) continue
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    files.push(new File([blob], `paste-${Date.now()}.${ext}`, { type: blob.type }))
  }
  if (!files.length) return
  e.preventDefault()
  uploadFiles(files)
}

function removeImage(i: number) {
  form.images.splice(i, 1)
}

defineExpose({ openCreate, load })

onMounted(load)
</script>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
}
.muted {
  color: var(--el-text-color-disabled);
}
.upload-zone {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  padding: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
}
.upload-zone.dragover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.upload-zone.uploading {
  pointer-events: none;
  opacity: 0.7;
}
.shot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.shot-item {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
}
.shot-item :deep(.el-image) {
  width: 100%;
  height: 100%;
}
.shot-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  line-height: 18px;
  font-size: 14px;
}
</style>
