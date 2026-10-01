<template>
  <el-dialog
    :model-value="modelValue"
    width="920px"
    class="urls-dialog"
    :show-close="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <template #header="{ close }">
      <div class="dlg-head">
        <div class="dlg-head-main">
          <div class="dlg-title">地址 · {{ titleName }}</div>
        </div>
        <el-button v-perm:write type="primary" class="add-btn" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增地址
        </el-button>
        <button type="button" class="dlg-close" aria-label="关闭" @click="close">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="toolbar">
      <div class="seg">
        <button
          v-for="o in envOptions"
          :key="o.value"
          type="button"
          class="seg-item"
          :class="{ active: filterEnv === o.value }"
          @click="filterEnv = o.value"
        >
          <i v-if="o.value" class="seg-dot" :class="`is-${o.value.toLowerCase()}`" />
          {{ o.label }}
          <span class="seg-count">{{ o.count }}</span>
        </button>
      </div>
      <el-button size="small" class="probe-btn" :loading="probing" :disabled="!rows.length" @click="probeAll">
        <el-icon v-if="!probing"><Refresh /></el-icon>
        测试连通性
      </el-button>
    </div>

    <div v-if="loading || visibleRows.length" v-loading="loading" class="table-card">
      <el-table :data="visibleRows" class="urls-table">
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-icon" :class="`is-${envKey(row.environment)}`">🌐</span>
              <div class="name-text">
                <div class="name-main" :title="row.name">{{ row.name }}</div>
                <div class="name-host">{{ hostOf(row.baseUrl) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="环境" width="96">
          <template #default="{ row }">
            <span class="env-pill" :class="`is-${envKey(row.environment)}`">
              <i class="env-dot" />{{ envLabel(row.environment) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="BASE URL" min-width="240">
          <template #default="{ row }">
            <div class="url-cell">
              <span class="url-text" :title="row.baseUrl">{{ row.baseUrl }}</span>
              <button type="button" class="copy-btn" title="复制" @click="copy(row.baseUrl)">
                <el-icon><CopyDocument /></el-icon>
              </button>
            </div>
            <div v-if="probeResults[row.id]" class="probe-line" :class="`is-${probeResults[row.id].level}`">
              {{ probeResults[row.id].text }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="160">
          <template #default="{ row }">
            <span class="desc" :title="row.description || ''">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="100">
          <template #default="{ row }">
            <div class="enable-cell">
              <el-switch
                :model-value="row.enabled !== false"
                size="small"
                :loading="toggling === row.id"
                @change="(v: string | number | boolean) => toggleEnabled(row, !!v)"
              />
              <span :class="{ off: row.enabled === false }">{{ row.enabled === false ? '停用' : '启用' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="right">
          <template #default="{ row }">
            <el-button v-perm:write link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm:delete link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-foot">
        共 <b>{{ rows.length }}</b> 条地址
        <span class="foot-sep" />
        测试 {{ counts.TEST }} · 线上 {{ counts.PROD }} · 通用 {{ counts.ANY }}
      </div>
    </div>

    <div v-if="emptyHint" class="empty-card">
      <div class="empty-icon">📭</div>
      <div class="empty-title">{{ emptyHint }}</div>
    </div>

    <el-dialog
      v-model="editing"
      :title="form.id ? '编辑地址' : '新增地址'"
      width="540px"
      class="url-edit-dialog"
      append-to-body
      destroy-on-close
    >
      <div class="form-row">
        <label class="form-label is-required">名称</label>
        <el-input v-model="form.name" placeholder="如：app-video · 内网 178" />
      </div>
      <div class="form-row">
        <label class="form-label is-required">环境</label>
        <div class="seg">
          <button
            v-for="o in envOptions.slice(1)"
            :key="o.value"
            type="button"
            class="seg-item"
            :class="{ active: form.environment === o.value }"
            @click="form.environment = o.value"
          >
            <i class="seg-dot" :class="`is-${o.value.toLowerCase()}`" />
            {{ o.label }}
          </button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label is-required">Base URL</label>
        <el-input
          v-model="form.baseUrl"
          class="mono-input"
          placeholder="https://gateway-qa.example.com 或 http://10.0.0.31:8080"
        />
      </div>
      <div class="form-row is-top">
        <label class="form-label">说明</label>
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="如：健康检查 /basic/healthCheck，只读账号" />
      </div>
      <div class="form-row">
        <label class="form-label">启用</label>
        <el-switch v-model="form.enabled" />
        <span class="sort-label">排序</span>
        <el-input-number v-model="form.sortOrder" :min="0" :step="10" size="small" controls-position="right" />
      </div>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, CopyDocument, Plus, Refresh } from '@element-plus/icons-vue'
import { apiClient } from '../api'

type Env = 'TEST' | 'PROD' | 'ANY'
type ProbeView = { level: 'ok' | 'warn' | 'bad'; text: string }

const props = defineProps<{
  modelValue: boolean
  project: { code: string; name?: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'changed'): void
}>()

const ENV_LABELS: Record<Env, string> = { TEST: '测试', PROD: '线上', ANY: '通用' }
const loading = ref(false)
const saving = ref(false)
const editing = ref(false)
const probing = ref(false)
const toggling = ref('')
const rows = ref<any[]>([])
const filterEnv = ref<'' | Env>('')
const probeResults = ref<Record<string, ProbeView>>({})

const form = reactive({
  id: '',
  name: '',
  environment: 'TEST' as Env,
  baseUrl: '',
  description: '',
  enabled: true,
  sortOrder: 100
})

const titleName = computed(() => (props.project?.name || props.project?.code || '').toUpperCase())

function envOf(env?: string): Env {
  return env === 'PROD' || env === 'ANY' ? env : 'TEST'
}

function envKey(env?: string) {
  return envOf(env).toLowerCase()
}

function envLabel(env?: string) {
  return ENV_LABELS[envOf(env)]
}

const counts = computed(() => {
  const c: Record<Env, number> = { TEST: 0, PROD: 0, ANY: 0 }
  for (const r of rows.value) c[envOf(r.environment)]++
  return c
})

const envOptions = computed<{ value: '' | Env; label: string; count: number }[]>(() => [
  { value: '', label: '全部', count: rows.value.length },
  { value: 'TEST', label: '测试', count: counts.value.TEST },
  { value: 'PROD', label: '线上', count: counts.value.PROD },
  { value: 'ANY', label: '通用', count: counts.value.ANY }
])

const visibleRows = computed(() =>
  filterEnv.value ? rows.value.filter((r) => envOf(r.environment) === filterEnv.value) : rows.value
)

const emptyHint = computed(() => {
  if (loading.value || visibleRows.value.length) return null
  return filterEnv.value ? `「${ENV_LABELS[filterEnv.value]}」下还没有地址` : '还没有地址'
})

function hostOf(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return url.replace(/^\w+:\/\//, '').split('/')[0]
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选中')
  }
}

async function load() {
  if (!props.project?.code) return
  loading.value = true
  try {
    rows.value = await apiClient.getApiUrls({ project: props.project.code })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onOpen() {
  editing.value = false
  filterEnv.value = ''
  rows.value = []
  probeResults.value = {}
  void load()
}

function openCreate() {
  form.id = ''
  form.name = ''
  form.environment = filterEnv.value || 'TEST'
  form.baseUrl = ''
  form.description = ''
  form.enabled = true
  form.sortOrder = 100
  editing.value = true
}

function openEdit(row: any) {
  form.id = row.id
  form.name = row.name
  form.environment = envOf(row.environment)
  form.baseUrl = row.baseUrl
  form.description = row.description || ''
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  editing.value = true
}

function bodyOf(src: { name: string; environment?: string; baseUrl: string; description?: string; enabled?: boolean; sortOrder?: number }) {
  return {
    project: props.project?.code,
    name: src.name.trim(),
    environment: envOf(src.environment),
    baseUrl: src.baseUrl.trim(),
    description: src.description || '',
    enabled: src.enabled !== false,
    sortOrder: src.sortOrder ?? 100
  }
}

async function save() {
  if (!props.project?.code) return
  if (!form.name.trim() || !form.baseUrl.trim()) {
    ElMessage.warning('名称、Base URL 必填')
    return
  }
  saving.value = true
  try {
    const body = bodyOf(form)
    if (form.id) await apiClient.updateApiUrl(form.id, body)
    else await apiClient.createApiUrl(body)
    ElMessage.success('已保存')
    editing.value = false
    await load()
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: any, enabled: boolean) {
  toggling.value = row.id
  try {
    await apiClient.updateApiUrl(row.id, bodyOf({ ...row, enabled }))
    row.enabled = enabled
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '切换失败')
  } finally {
    toggling.value = ''
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`删除「${row.name}」？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiUrl(row.id)
    ElMessage.success('已删除')
    await load()
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

/** 只看网络通不通：有 HTTP 响应（哪怕 404）就算能连上 */
async function probeAll() {
  const targets = visibleRows.value.filter((r) => r.enabled !== false)
  const next: Record<string, ProbeView> = {}
  for (const r of visibleRows.value) {
    if (r.enabled === false) next[r.id] = { level: 'warn', text: '已停用，未测试' }
  }
  if (!targets.length) {
    probeResults.value = { ...probeResults.value, ...next }
    return
  }
  probing.value = true
  try {
    const { results } = await apiClient.probeStatusMonitor(
      targets.map((r) => ({ id: r.id, urlId: r.id, healthPath: '/' }))
    )
    for (const res of results ?? []) {
      const ms = res.latencyMs != null ? ` · ${res.latencyMs}ms` : ''
      if (res.httpStatus != null) {
        next[res.id] = {
          level: res.latencyMs != null && res.latencyMs >= 2000 ? 'warn' : 'ok',
          text: `可连通 · HTTP ${res.httpStatus}${ms}`
        }
      } else {
        next[res.id] = {
          level: 'bad',
          text: res.status === 'timeout' ? `连接超时${ms}` : `连不上 · ${res.error || '未知错误'}`
        }
      }
    }
    probeResults.value = { ...probeResults.value, ...next }
  } catch (e: any) {
    ElMessage.error(e?.message || '测试失败')
  } finally {
    probing.value = false
  }
}
</script>

<style scoped>
.dlg-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dlg-head-main {
  flex: 1;
  min-width: 0;
}
.dlg-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.2px;
}
.add-btn {
  font-weight: 600;
}
.dlg-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}
.dlg-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.seg-item:hover {
  color: var(--el-text-color-primary);
}
.seg-item.active {
  background: #fff;
  color: var(--el-text-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.seg-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.seg-dot.is-test {
  background: var(--el-color-success);
}
.seg-dot.is-prod {
  background: var(--el-color-danger);
}
.seg-dot.is-any {
  background: #8a94a6;
}
.seg-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--el-fill-color);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  text-align: center;
}
.seg-item.active .seg-count {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.probe-btn {
  height: 30px;
  padding: 0 12px;
}

.table-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.urls-table {
  --el-table-header-bg-color: #f7f8fa;
  --el-table-border-color: var(--el-border-color-lighter);
}
.urls-table :deep(th.el-table__cell) {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}
.urls-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
.urls-table :deep(td.el-table__cell) {
  padding: 12px 0;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.name-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  font-size: 14px;
  background: var(--el-color-primary-light-9);
}
.name-icon.is-prod {
  background: var(--el-color-danger-light-9);
}
.name-icon.is-any {
  background: var(--el-fill-color-light);
}
.name-text {
  min-width: 0;
}
.name-main {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-host {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
}
.env-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.env-pill.is-test {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}
.env-pill.is-prod {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.env-pill.is-any {
  color: var(--app-text-regular);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.url-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.url-text {
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copy-btn {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  font-size: 13px;
}
.copy-btn:hover {
  color: var(--el-color-primary);
}
.probe-line {
  margin-top: 3px;
  font-size: 11.5px;
}
.probe-line.is-ok {
  color: var(--el-color-success-dark-2);
}
.probe-line.is-warn {
  color: var(--el-color-warning-dark-2);
}
.probe-line.is-bad {
  color: var(--el-color-danger);
}

.desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.enable-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
}
.enable-cell .off {
  color: var(--el-text-color-secondary);
}

.table-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}
.table-foot b {
  color: var(--el-text-color-primary);
}
.foot-sep {
  width: 1px;
  height: 12px;
  margin: 0 8px;
  background: var(--el-border-color);
}

.empty-card {
  margin-top: 14px;
  padding: 36px 16px 32px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  text-align: center;
}
.empty-icon {
  font-size: 26px;
  line-height: 1;
}
.empty-title {
  margin-top: 12px;
  font-size: 13.5px;
  color: var(--el-text-color-regular);
}
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.form-row.is-top {
  align-items: flex-start;
}
.form-row.is-top .form-label {
  padding-top: 6px;
}
.form-label {
  flex-shrink: 0;
  width: 72px;
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.form-label.is-required::before {
  content: '*';
  margin-right: 3px;
  color: var(--el-color-danger);
}
.mono-input :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.sort-label {
  margin-left: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>

<style>
.urls-dialog.el-dialog {
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
}
.urls-dialog .el-dialog__header {
  padding: 20px 20px 16px 24px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.urls-dialog .el-dialog__body {
  padding: 18px 24px 24px;
}
.url-edit-dialog.el-dialog {
  border-radius: 12px;
}
</style>
