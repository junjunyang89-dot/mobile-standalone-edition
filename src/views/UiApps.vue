<template>
  <div class="ui-apps">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">应用字典</span>
            <p class="card-sub">业务应用单独维护；元素/流程里下拉选择。与设备上的安装列表不是同一张表</p>
          </div>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>
            新增应用
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column prop="id" label="应用编码" min-width="160" />
        <el-table-column prop="nameZh" label="显示名称" min-width="160" />
        <el-table-column prop="androidPackage" label="Android 包名" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.androidPackage || '—' }}</template>
        </el-table-column>
        <el-table-column prop="iosBundleId" label="iOS Bundle ID" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.iosBundleId || '—' }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="140" show-overflow-tooltip />
        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled !== false"
              @change="(v: boolean) => toggleEnabled(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm:delete type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无应用（请先执行 migration_ui_apps.sql 并重启后端）" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑应用' : '新增应用'" width="580px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
        <el-form-item label="应用编码" prop="id">
          <el-input
            v-model="form.id"
            :disabled="!!editingId"
            placeholder="如 DOMESTIC_ESPORTS（大写+下划线）" />
        </el-form-item>
        <el-form-item label="显示名称" prop="nameZh">
          <el-input v-model="form.nameZh" placeholder="如 完美世界电竞（国内）" />
        </el-form-item>
        <el-form-item label="Android 包名">
          <el-input
            v-model="form.androidPackage"
            :placeholder="
              form.id === 'DOMESTIC_ESPORTS_HARMONY'
                ? '鸿蒙 bundle 名（该应用暂用此字段）'
                : '如 com.pwrd.steam.esports'
            "
          />
        </el-form-item>
        <el-form-item label="iOS Bundle ID">
          <el-input v-model="form.iosBundleId" placeholder="如 com.wmzq.esportapp" />
        </el-form-item>
        <el-form-item label="Android 蒲公英 Key">
          <el-input v-model="form.pgyerAppKeyAndroid" placeholder="Android 包在蒲公英的 appKey" />
        </el-form-item>
        <el-form-item label="iOS 蒲公英 Key">
          <el-input v-model="form.pgyerAppKeyIos" placeholder="iOS 包在蒲公英的 appKey（可与 Android 不同）" />
          <div class="pgyer-hint">
            两套 Key 按平台分开配。流程「安装应用」不用再填 buildKey / 下载 URL——
            执行时按应用 + 设备平台自动取对应 Key 装最新版
          </div>
        </el-form-item>
        <el-form-item label="渠道页 URL">
          <el-input
            v-model="form.channelUrls"
            type="textarea"
            :rows="4"
            placeholder='JSON，如 {"XIAOMI":"https://...","HUAWEI":"https://...","OPPO":"...","VIVO":"..."}'
          />
          <div style="margin-top: 6px; font-size: 12px; color: #909399">
            CHANNEL_PAGE 安装时优先打开对应厂商地址；你汇总各渠道页后粘贴即可。
          </div>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { apiClient } from '@/api'

const loading = ref(false)
const list = ref<any[]>([])

async function loadList() {
  loading.value = true
  try {
    list.value = await apiClient.getUiApps()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请执行 migration_ui_apps.sql 后重启后端）')
    list.value = []
  } finally {
    loading.value = false
  }
}

async function toggleEnabled(row: any, enabled: boolean) {
  try {
    await apiClient.updateUiApp(row.id, { enabled })
    row.enabled = enabled
    ElMessage.success(enabled ? '已启用' : '已禁用')
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

const dialogVisible = ref(false)
const editingId = ref('')
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  nameZh: '',
  androidPackage: '',
  iosBundleId: '',
  pgyerAppKeyAndroid: '',
  pgyerAppKeyIos: '',
  channelUrls: '',
  description: '',
  sortOrder: 100,
  enabled: true
})
const rules: FormRules = {
  id: [{ required: true, message: '必填', trigger: 'blur' }],
  nameZh: [{ required: true, message: '必填', trigger: 'blur' }]
}

function openAdd() {
  editingId.value = ''
  Object.assign(form, {
    id: '',
    nameZh: '',
    androidPackage: '',
    iosBundleId: '',
    pgyerAppKeyAndroid: '',
    pgyerAppKeyIos: '',
    channelUrls: '',
    description: '',
    sortOrder: 100,
    enabled: true
  })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    id: row.id,
    nameZh: row.nameZh || '',
    androidPackage: row.androidPackage || '',
    iosBundleId: row.iosBundleId || '',
    pgyerAppKeyAndroid: row.pgyerAppKeyAndroid || '',
    pgyerAppKeyIos: row.pgyerAppKeyIos || '',
    channelUrls: row.channelUrls || '',
    description: row.description || '',
    sortOrder: row.sortOrder ?? 100,
    enabled: row.enabled !== false
  })
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate().catch(() => Promise.reject())
  saving.value = true
  try {
    if (editingId.value) {
      const { id: _id, ...rest } = form
      await apiClient.updateUiApp(editingId.value, rest)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiApp({ ...form })
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
  await ElMessageBox.confirm(
    `确定删除应用「${row.nameZh}」（${row.id}）？已关联元素不会自动删除。`,
    '删除',
    { type: 'warning' }
  )
  try {
    await apiClient.deleteUiApp(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(loadList)
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
  color: var(--el-text-color-placeholder);
  font-weight: normal;
}

.pgyer-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-top: 4px;
}
</style>
