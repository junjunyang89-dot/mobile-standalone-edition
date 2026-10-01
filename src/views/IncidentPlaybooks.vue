<template>
  <div class="incidents">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">事故沉淀</span>
            <p class="card-sub">
              每次炸完记一条。依赖包这类可以 SSH 到构建机看 Maven 缓存时间——目录名还在不代表包是新的。
            </p>
          </div>
          <el-button v-perm:write type="primary" @click="openCreate">记一条</el-button>
        </div>
      </template>

      <el-card shadow="never" class="maven-card">
        <div class="maven-head">
          <div>
            <div class="maven-title">检查构建机 Maven 缓存</div>
            <p class="maven-sub">{{ mavenHint }}</p>
          </div>
        </div>
        <div class="bar">
          <el-input v-model="maven.groupId" placeholder="groupId" style="width: 160px" />
          <el-input v-model="maven.artifactId" placeholder="artifactId" style="width: 150px" />
          <el-input v-model="maven.version" placeholder="version" style="width: 180px" />
          <el-button type="primary" :loading="mavenLoading" @click="inspectMaven">检查</el-button>
          <el-button
            v-perm:write
            type="danger"
            plain
            :disabled="!mavenResult?.dir"
            :loading="mavenCleaning"
            @click="cleanMaven"
          >
            清这一版缓存
          </el-button>
        </div>
        <el-alert
          v-if="mavenResult"
          class="maven-alert"
          :type="mavenResult.stale ? 'warning' : mavenResult.ok ? 'success' : 'error'"
          :closable="false"
          show-icon
          :title="mavenResult.message"
        >
          <div v-if="mavenResult.staleHint">{{ mavenResult.staleHint }}</div>
          <div v-if="mavenResult.dir" class="maven-path">{{ mavenResult.dir }}</div>
        </el-alert>
        <el-table v-if="mavenResult?.jars?.length" :data="mavenResult.jars" size="small" border style="margin-top: 8px">
          <el-table-column prop="name" label="jar" min-width="240" />
          <el-table-column prop="mtime" label="缓存时间" width="180" />
        </el-table>
      </el-card>

      <div class="summary">
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="sum-chip"
          :class="{ active: category === c.id }"
          @click="toggleCategory(c.id)"
        >
          {{ c.label }}
          <span class="sum-n">{{ categoryCounts[c.id] || 0 }}</span>
        </button>
      </div>

      <div class="bar">
        <el-select v-model="toolStatus" style="width: 150px" @change="load">
          <el-option label="全部沉淀状态" value="ALL" />
          <el-option label="仅记录" value="NONE" />
          <el-option label="已有脚本" value="SCRIPT" />
          <el-option label="已做成工具" value="TOOL" />
        </el-select>
        <el-input
          v-model="keyword"
          placeholder="搜标题 / 报错句 / 包名"
          style="width: 280px"
          clearable
          @change="load"
          @keyup.enter="load"
        />
        <el-button @click="load">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" size="small" border stripe style="margin-top: 12px">
        <el-table-column prop="title" label="事故" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ row.categoryLabel }}</template>
        </el-table-column>
        <el-table-column prop="artifact" label="相关包" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.artifact || '—' }}</template>
        </el-table-column>
        <el-table-column label="报错指纹" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.fingerprints || []).join('；') || '—' }}</template>
        </el-table-column>
        <el-table-column label="沉淀" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="toolTag(row.toolStatus)">{{ row.toolStatusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">看 / 改</el-button>
            <el-button v-perm:delete link type="danger" size="small" @click="remove(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="open" :title="form.id ? '事故详情' : '记一条事故'" width="720px" destroy-on-close>
      <el-form label-width="96px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="255" placeholder="一句话，例如：appuser-api Git 和编进包的不是同一份" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.category" style="width: 100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.label" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="相关包">
          <el-input v-model="form.artifact" placeholder="如 appuser-api，没有就空着" />
        </el-form-item>
        <el-form-item label="报错指纹">
          <el-input
            v-model="form.fingerprints"
            type="textarea"
            :rows="3"
            placeholder="下次靠这些句子认出来，一行一条。如：does not override"
          />
        </el-form-item>
        <el-form-item label="现象">
          <el-input v-model="form.symptom" type="textarea" :rows="4" placeholder="这次怎么表现出来的" />
        </el-form-item>
        <el-form-item label="根因">
          <el-input v-model="form.rootCause" type="textarea" :rows="3" placeholder="真正的原因，不是表面报错" />
        </el-form-item>
        <el-form-item label="这次怎么解">
          <el-input v-model="form.resolution" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="下次怎么查">
          <el-input v-model="form.playbook" type="textarea" :rows="5" placeholder="标准排查步骤，可复用" />
        </el-form-item>
        <el-form-item label="沉淀状态">
          <el-radio-group v-model="form.toolStatus">
            <el-radio-button label="NONE">仅记录</el-radio-button>
            <el-radio-button label="SCRIPT">已有脚本</el-radio-button>
            <el-radio-button label="TOOL">已做成工具</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="工具说明">
          <el-input
            v-model="form.toolNote"
            type="textarea"
            :rows="3"
            placeholder="脚本在哪跑、为什么还不能上平台、做成工具还缺什么"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">关闭</el-button>
        <el-button v-perm:write type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const categories = [
  { id: 'DEPENDENCY', label: '依赖包' },
  { id: 'CACHE', label: '构建缓存' },
  { id: 'BUILD', label: '构建脚本' },
  { id: 'SIGNING', label: '签名证书' },
  { id: 'CONFIG', label: '配置' },
  { id: 'ENV', label: '环境/机器' },
  { id: 'OTHER', label: '其他' }
]

const loading = ref(false)
const saving = ref(false)
const open = ref(false)
const rows = ref<any[]>([])
const categoryCounts = ref<Record<string, number>>({})
const category = ref('ALL')
const toolStatus = ref('ALL')
const keyword = ref('')
const mavenHint = ref('正在读取构建机配置…')
const mavenLoading = ref(false)
const mavenCleaning = ref(false)
const mavenResult = ref<any>(null)
const maven = reactive({
  groupId: 'com.steamcn',
  artifactId: 'appuser-api',
  version: '1.0.74-SNAPSHOT'
})
const form = reactive({
  id: '',
  title: '',
  category: 'DEPENDENCY',
  artifact: '',
  fingerprints: '',
  symptom: '',
  rootCause: '',
  resolution: '',
  playbook: '',
  toolStatus: 'NONE',
  toolNote: ''
})

function toolTag(s: string) {
  return ({ SCRIPT: 'warning', TOOL: 'success', NONE: 'info' } as Record<string, 'warning' | 'success' | 'info'>)[s] || 'info'
}

function toggleCategory(id: string) {
  category.value = category.value === id ? 'ALL' : id
  load()
}

function fpsToText(v: unknown) {
  if (Array.isArray(v)) return v.join('\n')
  return v ? String(v) : ''
}

async function load() {
  loading.value = true
  try {
    const res = await apiClient.listIncidentPlaybooks({
      category: category.value,
      toolStatus: toolStatus.value,
      q: keyword.value || undefined
    })
    rows.value = res.incidents || []
    categoryCounts.value = res.categoryCounts || {}
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
    category: 'DEPENDENCY',
    artifact: '',
    fingerprints: '',
    symptom: '',
    rootCause: '',
    resolution: '',
    playbook: '',
    toolStatus: 'NONE',
    toolNote: ''
  })
}

function openCreate() {
  resetForm()
  open.value = true
}

function openEdit(row: any) {
  Object.assign(form, {
    id: row.id,
    title: row.title || '',
    category: row.category || 'OTHER',
    artifact: row.artifact || '',
    fingerprints: fpsToText(row.fingerprints),
    symptom: row.symptom || '',
    rootCause: row.rootCause || '',
    resolution: row.resolution || '',
    playbook: row.playbook || '',
    toolStatus: row.toolStatus || 'NONE',
    toolNote: row.toolNote || ''
  })
  open.value = true
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('标题必填')
    return
  }
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      category: form.category,
      artifact: form.artifact.trim() || null,
      fingerprints: form.fingerprints,
      symptom: form.symptom,
      rootCause: form.rootCause,
      resolution: form.resolution,
      playbook: form.playbook,
      toolStatus: form.toolStatus,
      toolNote: form.toolNote
    }
    if (form.id) await apiClient.updateIncidentPlaybook(form.id, body)
    else await apiClient.createIncidentPlaybook(body)
    ElMessage.success('已保存')
    open.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」？`, '删除', { type: 'warning' })
    await apiClient.deleteIncidentPlaybook(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => {
  load()
  loadMavenOptions()
})

async function loadMavenOptions() {
  try {
    const o = await apiClient.getMavenCacheOptions()
    mavenHint.value = o.hint || ''
    if (o.defaultGroupId) maven.groupId = o.defaultGroupId
    if (o.defaultArtifactId) maven.artifactId = o.defaultArtifactId
    if (o.defaultVersion) maven.version = o.defaultVersion
  } catch (e: any) {
    mavenHint.value = e?.message || '读构建机配置失败'
  }
}

async function inspectMaven() {
  mavenLoading.value = true
  try {
    mavenResult.value = await apiClient.inspectMavenCache({ ...maven })
  } catch (e: any) {
    mavenResult.value = { ok: false, message: e?.message || '检查失败', jars: [] }
  } finally {
    mavenLoading.value = false
  }
}

async function cleanMaven() {
  try {
    await ElMessageBox.confirm(
      `只删构建机上 ${maven.artifactId} ${maven.version} 这一版缓存，不会动别的包。确定？`,
      '清 Maven 缓存',
      { type: 'warning', confirmButtonText: '删除这一版' }
    )
  } catch {
    return
  }
  mavenCleaning.value = true
  try {
    mavenResult.value = await apiClient.cleanMavenCache({ ...maven })
    ElMessage.success(mavenResult.value?.message || '已清')
  } catch (e: any) {
    ElMessage.error(e?.message || '清理失败')
  } finally {
    mavenCleaning.value = false
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); max-width: 720px; font-weight: normal; }
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sum-chip {
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 16px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--app-text-regular);
}
.sum-chip.active { border-color: var(--el-color-primary); color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.sum-n { margin-left: 4px; color: var(--el-text-color-secondary); }
.bar { display: flex; gap: 10px; flex-wrap: wrap; }
.maven-card { margin-bottom: 16px; }
.maven-title { font-weight: 600; font-size: 14px; }
.maven-sub { margin: 4px 0 10px; font-size: 12px; color: var(--el-text-color-secondary); }
.maven-alert { margin-top: 10px; }
.maven-path { margin-top: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; word-break: break-all; }
</style>
