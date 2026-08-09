<template>
  <div class="api-urls">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">URL 管理</span>
            <p class="sub">
              按<strong>项目</strong>维护网关 / Base URL。接口测试用例只存 path，执行时下拉选择这里的 URL。
            </p>
          </div>
          <el-button type="primary" @click="openCreate">新建 URL</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-select
          v-model="filterProject"
          clearable
          filterable
          placeholder="项目"
          style="width: 200px"
          @change="load"
        >
          <el-option
            v-for="p in projects"
            :key="p.code"
            :label="`${p.name} (${p.code})`"
            :value="p.code"
          />
        </el-select>
        <el-select
          v-model="filterEnv"
          clearable
          placeholder="环境"
          style="width: 120px"
          @change="load"
        >
          <el-option label="测试 TEST" value="TEST" />
          <el-option label="线上 PROD" value="PROD" />
          <el-option label="通用 ANY" value="ANY" />
        </el-select>
        <el-button @click="load">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" size="small" border stripe>
        <el-table-column prop="project" label="项目" width="120" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="environment" label="环境" width="90" />
        <el-table-column prop="baseUrl" label="Base URL" min-width="240" show-overflow-tooltip />
        <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '是' : '否' }}
            </el-tag>
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

    <el-drawer v-model="drawer" :title="form.id ? '编辑 URL' : '新建 URL'" size="480px" destroy-on-close>
      <el-form label-width="100px" size="small">
        <el-form-item label="项目" required>
          <el-select v-model="form.project" filterable style="width: 100%" placeholder="从项目管理选择">
            <el-option
              v-for="p in projects"
              :key="p.code"
              :label="`${p.name} (${p.code})`"
              :value="p.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：data-center · 测试网关" />
        </el-form-item>
        <el-form-item label="环境" required>
          <el-radio-group v-model="form.environment">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
            <el-radio-button value="ANY">通用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Base URL" required>
          <el-input v-model="form.baseUrl" placeholder="https://gateway-qa.arca42.com" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawer = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const loading = ref(false)
const saving = ref(false)
const rows = ref<any[]>([])
const drawer = ref(false)
const filterProject = ref('data-center')
const filterEnv = ref('')
const projects = ref<Array<{ code: string; name: string }>>([])

const form = reactive({
  id: '',
  project: 'data-center',
  name: '',
  environment: 'TEST',
  baseUrl: '',
  description: '',
  enabled: true,
  sortOrder: 100
})

async function loadProjects() {
  try {
    projects.value = await apiClient.getApiProjects({ enabledOnly: true })
  } catch {
    projects.value = [{ code: 'data-center', name: 'data-center' }]
  }
}

async function load() {
  loading.value = true
  try {
    await loadProjects()
    rows.value = await apiClient.getApiUrls({
      project: filterProject.value || undefined,
      environment: filterEnv.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function reset() {
  form.id = ''
  form.project = filterProject.value || 'data-center'
  form.name = ''
  form.environment = 'TEST'
  form.baseUrl = ''
  form.description = ''
  form.enabled = true
  form.sortOrder = 100
}

function openCreate() {
  reset()
  drawer.value = true
}

function openEdit(row: any) {
  form.id = row.id
  form.project = row.project
  form.name = row.name
  form.environment = row.environment || 'TEST'
  form.baseUrl = row.baseUrl
  form.description = row.description || ''
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  drawer.value = true
}

async function save() {
  if (!form.project.trim() || !form.name.trim() || !form.baseUrl.trim()) {
    ElMessage.warning('项目、名称、Base URL 必填')
    return
  }
  saving.value = true
  try {
    const body = {
      project: form.project.trim(),
      name: form.name.trim(),
      environment: form.environment,
      baseUrl: form.baseUrl.trim(),
      description: form.description,
      enabled: form.enabled,
      sortOrder: form.sortOrder
    }
    if (form.id) await apiClient.updateApiUrl(form.id, body)
    else await apiClient.createApiUrl(body)
    ElMessage.success('已保存')
    drawer.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`删除「${row.name}」？`, '确认', { type: 'warning' })
  await apiClient.deleteApiUrl(row.id)
  ElMessage.success('已删除')
  await load()
}

onMounted(load)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
