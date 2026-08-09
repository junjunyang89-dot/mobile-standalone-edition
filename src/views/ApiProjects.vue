<template>
  <div class="api-projects">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">项目管理</span>
            <p class="sub">
              集中维护接口相关<strong>项目编码</strong>（如 data-center）。URL 管理、接口测试均从这里选择归属项目。
            </p>
          </div>
          <el-button type="primary" @click="openCreate">新建项目</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" size="small" border stripe>
        <el-table-column prop="code" label="编码" width="160" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="业务成功码" width="150">
          <template #default="{ row }">
            <code v-if="row.successCodePath">{{ row.successCodePath }} == {{ row.successCodeValue }}</code>
            <el-tooltip v-else content="没配的话，用例只断言 HTTP 200，业务失败也会判通过" placement="top">
              <el-tag size="small" type="warning" effect="plain">未配</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="70" />
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
      :title="form.code && !creating ? '编辑项目' : '新建项目'"
      size="460px"
      destroy-on-close
    >
      <el-form label-width="90px" size="small">
        <el-form-item label="编码" required>
          <el-input
            v-model="form.code"
            :disabled="!creating"
            placeholder="如 data-center（创建后不可改）"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="展示名称" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="业务成功码">
          <div class="biz-code-row">
            <el-input v-model="form.successCodePath" placeholder="$.code" style="width: 140px" />
            <span class="eq">==</span>
            <el-input v-model="form.successCodeValue" placeholder="0" style="width: 100px" />
          </div>
          <div class="tip">
            配上之后，执行时会给每条用例<strong>自动追加</strong>这条断言。
            这几个后端统一用 <code>ResponseResult{code,message,result}</code> 包一层，
            <strong>业务失败也是 HTTP 200</strong> —— 只断言 status=200 的用例，
            后端返回 <code>{code:5009001}</code> 照样判通过，等于没跑。
            data-center 系列填 <code>$.code</code> / <code>0</code>
          </div>
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
const drawer = ref(false)
const creating = ref(true)
const rows = ref<any[]>([])

const form = reactive({
  code: '',
  name: '',
  description: '',
  successCodePath: '',
  successCodeValue: '',
  enabled: true,
  sortOrder: 100
})

async function load() {
  loading.value = true
  try {
    rows.value = await apiClient.getApiProjects()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  creating.value = true
  form.code = ''
  form.name = ''
  form.description = ''
  form.successCodePath = ''
  form.successCodeValue = ''
  form.enabled = true
  form.sortOrder = 100
  drawer.value = true
}

function openEdit(row: any) {
  creating.value = false
  form.code = row.code
  form.name = row.name
  form.description = row.description || ''
  form.successCodePath = row.successCodePath || ''
  form.successCodeValue = row.successCodeValue || ''
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  drawer.value = true
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) {
    ElMessage.warning('编码和名称必填')
    return
  }
  saving.value = true
  try {
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description,
      successCodePath: form.successCodePath.trim(),
      successCodeValue: form.successCodeValue.trim(),
      enabled: form.enabled,
      sortOrder: form.sortOrder
    }
    if (creating.value) await apiClient.createApiProject(body)
    else await apiClient.updateApiProject(form.code, body)
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
  await ElMessageBox.confirm(
    `删除项目「${row.name}」？不会自动删除其下 URL/用例，但之后无法再选此编码。`,
    '确认',
    { type: 'warning' }
  )
  await apiClient.deleteApiProject(row.code)
  ElMessage.success('已删除')
  await load()
}

onMounted(load)
</script>

<style scoped>
.biz-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.eq {
  color: var(--el-text-color-secondary);
}
.tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.tip code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--el-fill-color);
}

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
</style>
