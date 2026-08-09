<template>
  <div class="api-collections">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">用例集合</span>
            <p class="card-sub">
              集合是<b>一次可执行的单元</b>。集合内按排序号顺序跑、共享一份运行时变量 ——
              登录用例抽出来的 token，后面的用例才引用得到。
            </p>
          </div>
          <div class="header-actions">
            <el-select v-model="project" style="width: 200px" @change="load">
              <el-option v-for="p in projects" :key="p" :label="p" :value="p" />
            </el-select>
            <el-button :loading="grouping" @click="autoGroup">自动归组</el-button>
            <el-button type="primary" @click="openCreate">新建集合</el-button>
          </div>
        </div>
      </template>

      <el-alert v-if="ungroupedHint" type="warning" :closable="false" class="hint">
        {{ ungroupedHint }}
      </el-alert>

      <el-empty
        v-if="!loading && !rows.length"
        description="还没有集合。点「自动归组」按 Controller 分一次，几百条用例马上就有结构了"
      />

      <div v-loading="loading" class="grid">
        <div v-for="c in rows" :key="c.id" class="col-card">
          <div class="col-head">
            <el-icon class="folder"><Folder /></el-icon>
            <el-tag v-if="c.enabled === false" size="small" type="info">已停用</el-tag>
          </div>
          <div class="col-name">{{ c.name }}</div>
          <div class="col-desc">{{ c.description || '—' }}</div>
          <div class="col-stats">
            <span class="stat">
              <el-icon><Document /></el-icon>
              {{ c.caseCount ?? 0 }} 条用例
            </span>
            <span v-if="c.passRate != null" class="stat" :class="rateClass(c.passRate)">
              <el-icon><CircleCheck /></el-icon>
              {{ c.passRate }}%
            </span>
            <span v-else class="stat muted">未跑过</span>
          </div>
          <div class="col-foot">
            <span class="last-run">{{ c.lastRunAt ? '上次：' + fmt(c.lastRunAt) : '还没有执行记录' }}</span>
            <div class="foot-actions">
              <el-button link type="primary" size="small" @click="openCases(c)">看用例</el-button>
              <el-button link type="primary" size="small" @click="run(c)">执行</el-button>
              <el-button link type="primary" size="small" @click="openEdit(c)">编辑</el-button>
              <el-button link type="danger" size="small" @click="remove(c)">删</el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑集合' : '新建集合'" width="480px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 登录、活动、Deadlock" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :step="10" />
          <span class="tip inline">集合之间的展示顺序；集合内用例的执行顺序看用例自己的排序号</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="runDialog" title="执行集合" width="460px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="集合">
          <b>{{ runTarget?.name }}</b>（{{ runTarget?.caseCount ?? 0 }} 条）
        </el-form-item>
        <el-form-item label="环境">
          <el-radio-group v-model="runEnv">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="runEnv === 'PROD'">
          <el-checkbox v-model="confirmProd">我确认要在线上环境执行</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="running"
          :disabled="runEnv === 'PROD' && !confirmProd"
          @click="doRun"
        >
          开始执行
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, Document, CircleCheck } from '@element-plus/icons-vue'
import { apiClient } from '../api'

/**
 * 用例集合。对应参考页的 Collections。
 *
 * 通过率取「最近一次执行」而不是历史平均：平均值会把上周修好的问题一直摊在里面，
 * 看板越平滑越没人信。
 */

const router = useRouter()
const projects = ref<string[]>([])
const project = ref('')
const rows = ref<any[]>([])
const loading = ref(false)
const grouping = ref(false)
const saving = ref(false)
const running = ref(false)
const dialog = ref(false)
const runDialog = ref(false)
const editing = ref(false)
const runTarget = ref<any>(null)
const runEnv = ref('TEST')
const confirmProd = ref(false)

const form = ref<any>({ id: '', name: '', description: '', sortOrder: 100, enabled: true })

const ungroupedHint = computed(() => {
  if (!rows.value.length) return ''
  const inCollections = rows.value.reduce((n, c) => n + (c.caseCount || 0), 0)
  return inCollections === 0 ? '集合都还是空的。点「自动归组」把用例按 Controller 分进去。' : ''
})

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function rateClass(rate: number) {
  if (rate >= 95) return 'good'
  if (rate >= 80) return 'warn'
  return 'bad'
}

async function loadProjects() {
  try {
    projects.value = await apiClient.getApiTestProjects()
    if (!project.value && projects.value.length) project.value = projects.value[0]
  } catch (e: any) {
    ElMessage.error(e?.message || '加载项目失败')
  }
}

async function load() {
  if (!project.value) return
  loading.value = true
  try {
    rows.value = await apiClient.getApiTestCollections(project.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function autoGroup() {
  grouping.value = true
  try {
    const r = await apiClient.autoGroupApiTestCases(project.value)
    ElMessage.success(`新建 ${r.created} 个集合，归组 ${r.assigned} 条用例`)
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '归组失败')
  } finally {
    grouping.value = false
  }
}

function openCreate() {
  editing.value = false
  form.value = { id: '', name: '', description: '', sortOrder: 100, enabled: true }
  dialog.value = true
}

function openEdit(c: any) {
  editing.value = true
  form.value = {
    id: c.id,
    name: c.name,
    description: c.description || '',
    sortOrder: c.sortOrder ?? 100,
    enabled: c.enabled !== false
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name.trim()) {
    ElMessage.warning('名称不能为空')
    return
  }
  saving.value = true
  try {
    const body = {
      project: project.value,
      name: form.value.name.trim(),
      description: form.value.description,
      sortOrder: form.value.sortOrder,
      enabled: form.value.enabled
    }
    if (editing.value) await apiClient.updateApiTestCollection(form.value.id, body)
    else await apiClient.createApiTestCollection(body)
    dialog.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(c: any) {
  try {
    await ElMessageBox.confirm(
      `删除集合「${c.name}」？里面的 ${c.caseCount ?? 0} 条用例会保留，只是移出集合。`,
      '确认删除',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestCollection(c.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

function openCases(c: any) {
  router.push({ path: '/api-test', query: { project: project.value, collectionId: c.id } })
}

function run(c: any) {
  runTarget.value = c
  runEnv.value = 'TEST'
  confirmProd.value = false
  runDialog.value = true
}

async function doRun() {
  running.value = true
  try {
    const r = await apiClient.runApiTest({
      collectionId: runTarget.value.id,
      environment: runEnv.value,
      confirmProd: confirmProd.value
    })
    runDialog.value = false
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await load()
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  await loadProjects()
  await load()
})
</script>

<style scoped>
.api-collections {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.header-actions {
  display: flex;
  gap: 10px;
  flex: none;
}
.hint {
  margin-bottom: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  min-height: 80px;
}
.col-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.15s;
}
.col-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
}
.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.folder {
  font-size: 22px;
  color: var(--el-color-primary);
}
.col-name {
  font-size: 15px;
  font-weight: 600;
}
.col-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-height: 18px;
}
.col-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
}
.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-regular);
}
.stat.good {
  color: var(--el-color-success);
}
.stat.warn {
  color: var(--el-color-warning);
}
.stat.bad {
  color: var(--el-color-danger);
}
.stat.muted {
  color: var(--el-text-color-placeholder);
}
.col-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 8px;
  margin-top: 4px;
  gap: 8px;
}
.last-run {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.foot-actions {
  display: flex;
  flex: none;
}
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.tip.inline {
  margin-left: 10px;
}
</style>
