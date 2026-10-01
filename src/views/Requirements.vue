<template>
  <div class="reqs">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">需求登记</span>
            <p class="sub">
              单号来自 JIRA，这里手工登记，挂上项目、版本、覆盖模块。
              测到的规则记在「知识点」里：写的时候可挂需求，找的时候按模块。
            </p>
          </div>
          <el-button v-if="tab === 'reqs'" type="primary" @click="openNew">登记需求</el-button>
        </div>
      </template>

      <el-tabs v-model="tab">
        <el-tab-pane label="需求" name="reqs">
          <div class="bar">
            <el-input v-model="keyword" placeholder="搜单号 / 标题" style="width: 200px" clearable @change="load" />
            <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="load">
              <el-option label="待测 PLANNING" value="PLANNING" />
              <el-option label="测试中 TESTING" value="TESTING" />
              <el-option label="已完成 DONE" value="DONE" />
              <el-option label="已取消 CANCELLED" value="CANCELLED" />
            </el-select>
          </div>

          <el-table :data="rows" size="small" border style="margin-top: 10px">
            <el-table-column prop="requirementNo" label="单号" width="130" />
            <el-table-column prop="title" label="标题" />
            <el-table-column prop="projectName" label="项目" width="150" />
            <el-table-column prop="versionLabel" label="版本" width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="模块" min-width="160">
              <template #default="{ row }">
                <el-tag v-for="m in row.modules || []" :key="m.id" size="small" style="margin: 2px">{{ m.name }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button v-perm:write link type="primary" @click="noteFromReq(row)">记一条</el-button>
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button v-perm:delete link type="danger" @click="remove(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="知识点" name="notes">
          <KnowledgeNotesPanel ref="notesPanel" :modules="flatModules" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="formOpen" :title="isEdit ? '编辑需求' : '登记需求'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="单号" required>
          <el-input v-model="form.requirementNo" :disabled="isEdit" placeholder="如 APP-8999" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="项目">
          <el-select v-model="form.projectCode" filterable clearable placeholder="选项目" style="width: 100%">
            <el-option v-for="p in projects" :key="p.code" :label="p.name || p.code" :value="p.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="待测" value="PLANNING" />
            <el-option label="测试中" value="TESTING" />
            <el-option label="已完成" value="DONE" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="覆盖模块">
          <el-select v-model="form.moduleIds" multiple filterable clearable placeholder="可多选" style="width: 100%">
            <el-option v-for="m in flatModules" :key="m.id" :label="m.fullName" :value="m.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'
import KnowledgeNotesPanel from './KnowledgeNotesPanel.vue'

const tab = ref('reqs')
const notesPanel = ref<{ openCreate: (p?: { requirementNo?: string; moduleId?: string }) => void } | null>(null)
const rows = ref<any[]>([])
const projects = ref<any[]>([])
const flatModules = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const formOpen = ref(false)
const isEdit = ref(false)
const form = reactive<any>({ requirementNo: '', title: '', projectCode: '', status: 'PLANNING', moduleIds: [] })

async function load() {
  try {
    rows.value = await apiClient.getRequirements({ keyword: keyword.value || undefined, status: statusFilter.value || undefined })
  } catch (e: any) { ElMessage.error(e?.message || '加载失败') }
}
async function loadRefs() {
  try {
    const tree = await apiClient.getApiProjectTree()
    projects.value = (tree.categories || []).flatMap((c: any) => c.projects || [])
    const modTree = await apiClient.getProjectModuleTree('APP')
    const flat: any[] = []
    ;(modTree || []).forEach((d: any) => {
      if (d.children?.length) {
        d.children.forEach((m: any) => {
          if (m.children?.length) {
            m.children.forEach((leaf: any) =>
              flat.push({ id: leaf.id, fullName: `${d.name} / ${m.name} / ${leaf.name}` }))
          } else {
            flat.push({ id: m.id, fullName: `${d.name} / ${m.name}` })
          }
        })
      } else {
        flat.push({ id: d.id, fullName: d.name })
      }
    })
    flatModules.value = flat
  } catch { /* 参照数据拿不到不阻塞主流程 */ }
}
function openNew() {
  isEdit.value = false
  Object.assign(form, { requirementNo: '', title: '', projectCode: '', status: 'PLANNING', moduleIds: [] })
  formOpen.value = true
}
function openEdit(row: any) {
  isEdit.value = true
  Object.assign(form, {
    requirementNo: row.requirementNo, title: row.title || '', projectCode: row.projectCode || '',
    status: row.status || 'PLANNING', moduleIds: (row.modules || []).map((m: any) => m.id)
  })
  formOpen.value = true
}
function noteFromReq(row: any) {
  const mods = row.modules || []
  tab.value = 'notes'
  nextTick(() => {
    notesPanel.value?.openCreate({
      requirementNo: row.requirementNo,
      moduleId: mods.length === 1 ? mods[0].id : undefined
    })
  })
}
async function save() {
  if (!form.requirementNo.trim()) { ElMessage.warning('单号必填'); return }
  try {
    await apiClient.saveRequirement({
      requirementNo: form.requirementNo.trim(), title: form.title.trim() || null,
      projectCode: form.projectCode || null, status: form.status
    }, form.moduleIds)
    ElMessage.success('已保存'); formOpen.value = false; load()
  } catch (e: any) { ElMessage.error(e?.message || '保存失败') }
}
async function remove(row: any) {
  try { await apiClient.deleteRequirement(row.requirementNo); load() }
  catch (e: any) { ElMessage.error(e?.message || '删除失败') }
}
function statusType(s: string) { return { PLANNING: 'info', TESTING: 'warning', DONE: 'success', CANCELLED: '' }[s] || 'info' }
function statusLabel(s: string) { return { PLANNING: '待测', TESTING: '测试中', DONE: '已完成', CANCELLED: '已取消' }[s] || s }
onMounted(() => { load(); loadRefs() })
</script>

<style scoped>
.title { font-size: 16px; font-weight: 600; }
.sub { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; max-width: 760px; }
.bar { display: flex; gap: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
</style>
