<template>
  <div class="ui-keywords">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">关键字库</span>
            <p class="card-sub">启动应用、元素存在判断、点击、输入、延迟等动作；流程编排页从这里选用</p>
          </div>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>
            新增关键字
          </el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-form :inline="true">
          <el-form-item label="分类">
            <el-select v-model="filterCategory" clearable placeholder="全部分类" style="width: 140px" @change="loadList">
              <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅启用">
            <el-switch v-model="enabledOnly" @change="loadList" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">刷新</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table v-loading="loading" :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column prop="code" label="编码" width="140" />
        <el-table-column prop="nameZh" label="中文名" width="120" />
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="categoryTag(row.category)">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="需元素" width="80" align="center">
          <template #default="{ row }">{{ row.needsElement ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="内置" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.builtin" size="small" type="warning">是</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
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
            <el-button
              type="danger"
              link
              size="small"
              :disabled="!!row.builtin"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无关键字（启动后端会自动种子 CLICK/WAIT 等）" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑关键字' : '新增关键字'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="编码 code" prop="code">
          <el-input v-model="form.code" :disabled="!!editingId" placeholder="如 MY_WAIT，大写" />
        </el-form-item>
        <el-form-item label="中文名" prop="nameZh">
          <el-input v-model="form.nameZh" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" style="width: 100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="需要元素">
          <el-switch v-model="form.needsElement" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="参数 schema">
          <el-input
            v-model="form.paramSchema"
            type="textarea"
            :rows="4"
            placeholder='JSON 数组，如 [{"name":"durationMs","label":"毫秒","type":"number"}]' />
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

const categories = ['ACTION', 'WAIT', 'ASSERT', 'DEVICE', 'FLOW']
const filterCategory = ref('')
const enabledOnly = ref(false)
const loading = ref(false)
const list = ref<any[]>([])

function categoryTag(c: string) {
  if (c === 'WAIT') return 'warning'
  if (c === 'ASSERT') return 'danger'
  if (c === 'DEVICE') return 'info'
  if (c === 'FLOW') return 'success'
  return ''
}

async function loadList() {
  loading.value = true
  try {
    list.value = await apiClient.getUiKeywords({
      category: filterCategory.value || undefined,
      enabledOnly: enabledOnly.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行 schema_ui_assets.sql）')
    list.value = []
  } finally {
    loading.value = false
  }
}

async function toggleEnabled(row: any, enabled: boolean) {
  try {
    await apiClient.updateUiKeyword(row.id, { enabled })
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
  code: '',
  nameZh: '',
  category: 'ACTION',
  needsElement: false,
  description: '',
  paramSchema: '[]',
  sortOrder: 999,
  enabled: true
})
const rules: FormRules = {
  code: [{ required: true, message: '必填', trigger: 'blur' }],
  nameZh: [{ required: true, message: '必填', trigger: 'blur' }],
  category: [{ required: true, message: '必选', trigger: 'change' }]
}

function openAdd() {
  editingId.value = ''
  Object.assign(form, {
    code: '',
    nameZh: '',
    category: 'ACTION',
    needsElement: false,
    description: '',
    paramSchema: '[]',
    sortOrder: 999,
    enabled: true
  })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    code: row.code || '',
    nameZh: row.nameZh || '',
    category: row.category || 'ACTION',
    needsElement: !!row.needsElement,
    description: row.description || '',
    paramSchema: row.paramSchema || '[]',
    sortOrder: row.sortOrder ?? 999,
    enabled: row.enabled !== false
  })
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate().catch(() => Promise.reject())
  saving.value = true
  try {
    if (editingId.value) {
      const { code: _c, ...rest } = form
      await apiClient.updateUiKeyword(editingId.value, rest)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiKeyword({ ...form })
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
  await ElMessageBox.confirm(`确定删除关键字「${row.code}」？`, '删除', { type: 'warning' })
  try {
    await apiClient.deleteUiKeyword(row.id)
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
  color: #909399;
  font-weight: normal;
}
.filter-bar {
  margin-bottom: 12px;
}
</style>
