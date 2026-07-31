<template>
  <div class="ui-elements">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">元素库</span>
            <p class="card-sub">按「自动化 / 测试」分入口便于维护；定位一样时请选「两边共用」，只存一份，改一处两边都生效</p>
          </div>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>
            新增元素
          </el-button>
        </div>
      </template>

      <el-tabs v-model="filterScene" class="catalog-tabs" @tab-change="loadList">
        <el-tab-pane v-for="c in sceneTabs" :key="c.value" :label="c.label" :name="c.value" />
      </el-tabs>
      <p class="catalog-hint">{{ catalogHint }}</p>

      <div class="filter-bar">
        <el-form :inline="true">
          <el-form-item label="应用">
            <el-select v-model="filterAppId" clearable filterable placeholder="选择应用" style="width: 220px">
              <el-option
                v-for="a in appOptions"
                :key="a.id"
                :label="`${a.nameZh} (${a.id})`"
                :value="a.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filterPlatform" clearable placeholder="平台" style="width: 140px">
              <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="模块">
            <el-input v-model="filterModule" clearable placeholder="如 登录页" style="width: 140px" @keyup.enter="loadList" />
          </el-form-item>
          <el-form-item label="搜索">
            <el-input v-model="filterKeyword" clearable placeholder="中文/英文/描述" style="width: 160px" @keyup.enter="loadList" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table v-loading="loading" :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column label="预览" width="72" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.previewImage"
              :src="previewSrc(row.previewImage)"
              :preview-src-list="[previewSrc(row.previewImage)]"
              :preview-teleported="true"
              :z-index="4000"
              fit="cover"
              class="preview-thumb" />
            <span v-else class="preview-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="nameZh" label="中文名称" min-width="120" />
        <el-table-column prop="nameEn" label="英文名" min-width="130" show-overflow-tooltip />
        <el-table-column prop="moduleTag" label="模块" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.moduleTag || '—' }}</template>
        </el-table-column>
        <el-table-column label="定位方式" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.locatorType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="locatorValue" label="定位值" min-width="200" show-overflow-tooltip />
        <el-table-column prop="platform" label="平台" width="110" />
        <el-table-column label="应用" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ appLabel(row.appId) }}</template>
        </el-table-column>
        <el-table-column label="用途" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="catalogTagType(row.catalog)">{{ catalogLabel(row.catalog) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === false ? 'info' : 'success'" size="small">
              {{ row.enabled === false ? '否' : '是' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无元素，请先执行 schema_ui_assets.sql 后新增" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑元素' : '新增元素'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="用途" prop="catalog">
          <el-select v-model="form.catalog" style="width: 100%">
            <el-option
              v-for="c in scopeOptions"
              :key="c.value"
              :label="c.label"
              :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="应用" prop="appId">
          <el-select v-model="form.appId" :disabled="!!editingId" filterable placeholder="请选择应用" style="width: 100%">
            <el-option
              v-for="a in appOptions"
              :key="a.id"
              :label="`${a.nameZh} (${a.id})`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-select v-model="form.platform" :disabled="!!editingId" style="width: 100%">
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="中文名称" prop="nameZh">
          <el-input v-model="form.nameZh" placeholder="如 登录按钮" />
        </el-form-item>
        <el-form-item label="英文名称" prop="nameEn">
          <el-input v-model="form.nameEn" placeholder="流程引用 key，如 login_btn" />
        </el-form-item>
        <el-form-item label="模块标签">
          <el-input v-model="form.moduleTag" placeholder="如 登录页（仅分组）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="定位方式" prop="locatorType">
          <el-select v-model="form.locatorType" style="width: 100%">
            <el-option v-for="t in locatorTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="定位值" prop="locatorValue">
          <el-input v-model="form.locatorValue" type="textarea" :rows="3" placeholder="xpath / id / 文案等" />
        </el-form-item>
        <el-form-item label="预览图">
          <div class="preview-upload">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              :http-request="onUploadPreview"
            >
              <el-button :loading="uploadingPreview">上传图片</el-button>
            </el-upload>
            <el-button v-if="form.previewImage" link type="danger" @click="clearPreview">清除</el-button>
            <span class="preview-hint">选填，方便辨认元素</span>
          </div>
          <el-image
            v-if="form.previewImage"
            :src="previewSrc(form.previewImage)"
            :preview-src-list="[previewSrc(form.previewImage)]"
            :preview-teleported="true"
            :z-index="4000"
            fit="contain"
            class="preview-preview" />
        </el-form-item>
        <el-form-item label="默认超时(秒)">
          <el-input-number v-model="form.defaultTimeoutSec" :min="1" :max="120" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { apiClient } from '@/api'

const sceneTabs = [
  { value: 'AUTOMATION', label: '自动化' },
  { value: 'TEST', label: '测试' }
]
/** 保存时的用途：TEST 入库仍用 ONLINE，与线上回归场景对齐 */
const scopeOptions = [
  { value: 'SHARED', label: '两边共用（推荐，定位相同只改一处）' },
  { value: 'AUTOMATION', label: '仅自动化' },
  { value: 'ONLINE', label: '仅测试' }
]
const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' },
  { value: 'POG_ANDROID', label: 'Pog-Android' },
  { value: 'POG_IOS', label: 'Pog-iOS' }
]
const locatorTypes = ['id', 'xpath', 'text', 'accessibilityId', 'className', 'name', 'other']

const filterScene = ref('AUTOMATION')
const filterAppId = ref('')
const filterPlatform = ref('')
const filterModule = ref('')
const filterKeyword = ref('')
const loading = ref(false)
const list = ref<any[]>([])
const appOptions = ref<any[]>([])

function appLabel(id: string) {
  const hit = appOptions.value.find((a) => a.id === id)
  return hit ? `${hit.nameZh}` : id || '—'
}

function previewSrc(path: string) {
  return apiClient.uiElementPreviewUrl(path)
}

async function loadApps() {
  try {
    appOptions.value = await apiClient.getUiApps({ enabledOnly: true })
  } catch {
    appOptions.value = []
  }
}

const catalogHint = computed(() => {
  if (filterScene.value === 'TEST') {
    return '测试侧可见：仅测试 + 两边共用。登录等相同定位请用「两边共用」，不要复制两条。'
  }
  return '自动化侧可见：仅自动化 + 两边共用。定位与测试相同就选「两边共用」。'
})

function catalogLabel(c: string) {
  if (c === 'SHARED') return '两边共用'
  if (c === 'ONLINE') return '仅测试'
  if (c === 'AUTOMATION') return '仅自动化'
  return c || '两边共用'
}
function catalogTagType(c: string) {
  if (c === 'SHARED') return 'success'
  if (c === 'ONLINE') return 'warning'
  return 'info'
}

/** 自动化页：AUTOMATION+SHARED；测试页：ONLINE+SHARED */
function catalogsForScene(scene: string) {
  return scene === 'TEST' ? 'ONLINE,SHARED' : 'AUTOMATION,SHARED'
}

async function loadList() {
  loading.value = true
  try {
    list.value = await apiClient.getUiElements({
      catalogs: catalogsForScene(filterScene.value),
      appId: filterAppId.value.trim() || undefined,
      platform: filterPlatform.value || undefined,
      moduleTag: filterModule.value.trim() || undefined,
      keyword: filterKeyword.value.trim() || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行 schema_ui_assets.sql）')
    list.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filterAppId.value = ''
  filterPlatform.value = ''
  filterModule.value = ''
  filterKeyword.value = ''
  loadList()
}

const dialogVisible = ref(false)
const editingId = ref('')
const saving = ref(false)
const uploadingPreview = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  catalog: 'SHARED',
  appId: '',
  platform: 'ANDROID',
  nameZh: '',
  nameEn: '',
  moduleTag: '',
  description: '',
  locatorType: 'xpath',
  locatorValue: '',
  previewImage: '',
  defaultTimeoutSec: 10,
  enabled: true
})
const rules: FormRules = {
  catalog: [{ required: true, message: '必选', trigger: 'change' }],
  appId: [{ required: true, message: '请选择应用', trigger: 'change' }],
  platform: [{ required: true, message: '必选', trigger: 'change' }],
  nameZh: [{ required: true, message: '必填', trigger: 'blur' }],
  nameEn: [{ required: true, message: '必填', trigger: 'blur' }],
  locatorType: [{ required: true, message: '必选', trigger: 'change' }],
  locatorValue: [{ required: true, message: '必填', trigger: 'blur' }]
}

function defaultCatalogForScene() {
  // 当前在哪个入口新增，默认仍推荐两边共用
  return 'SHARED'
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, {
    catalog: defaultCatalogForScene(),
    appId: filterAppId.value || appOptions.value[0]?.id || '',
    platform: filterPlatform.value || 'ANDROID',
    nameZh: '',
    nameEn: '',
    moduleTag: '',
    description: '',
    locatorType: 'xpath',
    locatorValue: '',
    previewImage: '',
    defaultTimeoutSec: 10,
    enabled: true
  })
}

async function onUploadPreview(options: UploadRequestOptions) {
  const file = options.file as File
  uploadingPreview.value = true
  try {
    const res = await apiClient.uploadUiElementPreview(file)
    form.previewImage = res.previewImage
    ElMessage.success('图片已上传')
    options.onSuccess?.(res as any)
  } catch (e: any) {
    ElMessage.error(e?.message || '上传失败')
    options.onError?.(e)
  } finally {
    uploadingPreview.value = false
  }
}

function clearPreview() {
  form.previewImage = ''
}

function openAdd() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    catalog: row.catalog || 'SHARED',
    appId: row.appId || '',
    platform: row.platform || 'ANDROID',
    nameZh: row.nameZh || '',
    nameEn: row.nameEn || '',
    moduleTag: row.moduleTag || '',
    description: row.description || '',
    locatorType: row.locatorType || 'xpath',
    locatorValue: row.locatorValue || '',
    previewImage: row.previewImage || '',
    defaultTimeoutSec: row.defaultTimeoutSec ?? 10,
    enabled: row.enabled !== false
  })
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate().catch(() => Promise.reject())
  saving.value = true
  try {
    const body = { ...form }
    if (editingId.value) {
      await apiClient.updateUiElement(editingId.value, body)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiElement(body)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除元素「${row.nameZh} / ${row.nameEn}」？`, '删除', { type: 'warning' })
  try {
    await apiClient.deleteUiElement(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadApps()
  await loadList()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}
.catalog-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
}
.filter-bar {
  margin-bottom: 12px;
}
.preview-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.preview-empty {
  color: #c0c4cc;
}
.preview-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preview-hint {
  font-size: 12px;
  color: #909399;
}
.preview-preview {
  margin-top: 8px;
  width: 160px;
  height: 120px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.ui-elements :deep(.el-image-viewer__wrapper) {
  z-index: 4000 !important;
}

.ui-elements :deep(.el-image-viewer__mask) {
  backdrop-filter: blur(2px);
}
</style>
