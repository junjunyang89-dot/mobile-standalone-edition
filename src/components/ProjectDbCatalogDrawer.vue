<template>
  <el-drawer v-model="open" title="数据库" size="780px" destroy-on-close @opened="load">
    <el-tabs v-model="env">
      <el-tab-pane v-for="tab in TABS" :key="tab.id" :label="tab.label" :name="tab.id">
        <div class="toolbar">
          <span class="count">共 {{ listOf(tab.id).length }} 个库</span>
          <el-button v-perm:write size="small" type="primary" @click="openAdd(tab.id)">+ 新建</el-button>
        </div>
        <el-table :data="pageOf(tab.id)" empty-text="这个环境还没有库" size="small">
          <el-table-column prop="name" label="名称" min-width="110" show-overflow-tooltip />
          <el-table-column label="地址" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.dbHost }}{{ row.dbPort ? ':' + row.dbPort : '' }} / {{ row.dbName }}
            </template>
          </el-table-column>
          <el-table-column label="账号" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.dbUser || '—' }}</template>
          </el-table-column>
          <el-table-column label="归属" min-width="160">
            <template #default="{ row }">
              <span v-if="!row.projects?.length" class="tag">通用</span>
              <span v-for="p in row.projects" :key="p" class="tag">{{ p }}</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="180" align="right" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" :loading="checking === row.id" @click="check(row)">试连接</el-button>
              <el-button v-perm:write link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-perm:delete link type="danger" size="small" @click="remove(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-foot">
          <el-pagination
            :current-page="page[tab.id]"
            :page-size="pageSize"
            :total="listOf(tab.id).length"
            :page-sizes="[10, 20, 50]"
            layout="sizes, prev, pager, next"
            size="small"
            background
            @current-change="(p: number) => (page[tab.id] = p)"
            @size-change="onSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="formOpen"
      :title="form.id ? '编辑库' : '新建库'"
      width="560px"
      append-to-body
      destroy-on-close
      class="db-form-dialog"
      @closed="resetProbe"
    >
      <el-form label-width="88px" class="db-form">
        <el-form-item label="环境" required>
          <el-radio-group v-model="form.environment" :disabled="!!form.id">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 data_center、admin" />
          <div class="tip">同一环境内唯一；项目绑了多个库时，断言按这个名字选</div>
        </el-form-item>
        <el-form-item label="地址" required>
          <div class="addr-row">
            <el-input v-model="form.dbHost" placeholder="主机" />
            <el-input v-model.number="form.dbPort" placeholder="3306" class="port" />
          </div>
        </el-form-item>
        <el-form-item label="库名" required>
          <el-input v-model="form.dbName" />
        </el-form-item>
        <el-form-item label="只读账号">
          <el-input v-model="form.dbUser" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.dbPassword" type="password" show-password />
          <div v-if="form.id && !probe" class="tip">显示的是掩码，不改直接保存，原密码不会被覆盖</div>
          <div v-if="probe" class="probe-banner" :class="probe.ok ? 'ok' : 'bad'">
            <span class="probe-mark">{{ probe.ok ? '✓' : '!' }}</span>
            <span>{{ probe.message }}</span>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="db-foot">
          <el-button
            :type="probe?.ok ? 'success' : 'primary'"
            plain
            :loading="probing"
            @click="probeForm"
          >
            {{ probe?.ok ? '✓ 已测通 · 重测' : '⚡ 测试连接' }}
          </el-button>
          <div class="db-foot-right">
            <el-button @click="formOpen = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient, type DbConnection } from '../api'

const TABS = [
  { id: 'TEST', label: '测试' },
  { id: 'PROD', label: '线上' }
]

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; changed: [] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const env = ref('TEST')
const all = ref<DbConnection[]>([])
const checking = ref('')
const formOpen = ref(false)
const saving = ref(false)
const probing = ref(false)
const probe = ref<{ ok: boolean; message: string } | null>(null)
const pageSize = ref(10)
const page = reactive<Record<string, number>>({ TEST: 1, PROD: 1 })
const form = reactive({
  id: '',
  environment: 'TEST',
  name: '',
  dbHost: '',
  dbPort: undefined as number | undefined,
  dbName: '',
  dbUser: '',
  dbPassword: '',
  remark: ''
})

function listOf(e: string) {
  return all.value.filter((c) => c.environment === e)
}

function clampPages() {
  for (const e of ['TEST', 'PROD']) {
    const max = Math.max(1, Math.ceil(listOf(e).length / pageSize.value) || 1)
    if (page[e] > max) page[e] = max
  }
}

function pageOf(e: string) {
  const rows = listOf(e)
  const start = (Math.max(1, page[e] || 1) - 1) * pageSize.value
  return rows.slice(start, start + pageSize.value)
}

function onSizeChange(size: number) {
  pageSize.value = size
  page.TEST = 1
  page.PROD = 1
}

async function load() {
  try {
    all.value = await apiClient.listDbConnections()
    clampPages()
  } catch (e: any) {
    all.value = []
    ElMessage.error(e?.message || '加载数据库失败')
  }
}

function resetProbe() {
  probe.value = null
  probing.value = false
}

function resetForm(environment: string) {
  form.id = ''
  form.environment = environment
  form.name = ''
  form.dbHost = ''
  form.dbPort = undefined
  form.dbName = ''
  form.dbUser = ''
  form.dbPassword = ''
  form.remark = ''
  resetProbe()
}

function openAdd(environment: string) {
  resetForm(environment)
  formOpen.value = true
}

function openEdit(c: DbConnection) {
  form.id = c.id
  form.environment = c.environment
  form.name = c.name
  form.dbHost = c.dbHost
  form.dbPort = c.dbPort || undefined
  form.dbName = c.dbName
  form.dbUser = c.dbUser || ''
  form.dbPassword = c.dbPassword || ''
  form.remark = c.remark || ''
  resetProbe()
  formOpen.value = true
}

async function probeForm() {
  if (!form.dbHost.trim() || !form.dbName.trim()) {
    ElMessage.warning('地址和库名必填')
    return
  }
  probing.value = true
  try {
    probe.value = await apiClient.probeDbConnection(form.environment, {
      id: form.id || undefined,
      dbHost: form.dbHost.trim(),
      dbPort: form.dbPort || 3306,
      dbName: form.dbName.trim(),
      dbUser: form.dbUser.trim() || null,
      dbPassword: form.dbPassword
    })
  } catch (e: any) {
    probe.value = { ok: false, message: e?.message || '探测失败' }
  } finally {
    probing.value = false
  }
}

async function save() {
  if (!form.name.trim() || !form.dbHost.trim() || !form.dbName.trim()) {
    ElMessage.warning('名称、地址、库名必填')
    return
  }
  saving.value = true
  try {
    await apiClient.saveDbConnection(form.environment, {
      id: form.id || undefined,
      name: form.name.trim(),
      dbHost: form.dbHost.trim(),
      dbPort: form.dbPort || null,
      dbName: form.dbName.trim(),
      dbUser: form.dbUser.trim() || null,
      dbPassword: form.dbPassword,
      remark: form.remark.trim() || null
    })
    ElMessage.success('已保存')
    formOpen.value = false
    await load()
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function check(c: DbConnection) {
  checking.value = c.id
  try {
    const r = await apiClient.checkDbConnection(c.environment, c.id)
    if (r.ok) ElMessage.success(r.message || '连上了')
    else ElMessage.error(r.message || '连不上')
  } catch (e: any) {
    ElMessage.error(e?.message || '探测失败')
  } finally {
    checking.value = ''
  }
}

async function remove(c: DbConnection) {
  try {
    await ElMessageBox.confirm(`删除库「${c.name}」？已关联的项目会失去这条连接。`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteDbConnection(c.environment, c.id)
    ElMessage.success('已删除')
    await load()
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

watch(open, (v) => {
  if (v) load()
})

watch(
  () => [form.environment, form.dbHost, form.dbPort, form.dbName, form.dbUser, form.dbPassword],
  () => {
    if (probe.value) probe.value = null
  }
)
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.table-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.tag {
  display: inline-block;
  margin: 0 4px 4px 0;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 11px;
  color: var(--el-text-color-regular);
}
.addr-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.port {
  width: 110px;
  flex-shrink: 0;
}
.tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.probe-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.55;
}
.probe-banner.ok {
  background: #e9f8ee;
  color: #1a7f46;
}
.probe-banner.bad {
  background: #fdecec;
  color: #c45656;
}
.probe-mark {
  flex: none;
  font-weight: 700;
}
.db-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.db-foot-right {
  display: flex;
  gap: 8px;
}
</style>
