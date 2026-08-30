<template>
  <div class="version-archive">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">版本需求归档</span>
            <p class="sub">
              从 Wiki 汇总页按版本快照 JIRA 单（键值 + 摘要），Wiki 面板消失后仍可回查；
              上线日已过后可预览并批量关闭未关单。
            </p>
          </div>
          <el-button type="primary" @click="openSync">从 Wiki 同步</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" size="small" border stripe @row-click="openDetail">
        <el-table-column prop="appVersion" label="APP 版本" width="100" />
        <el-table-column prop="releaseLabel" label="版本定位" min-width="160" />
        <el-table-column prop="productLine" label="产品线" width="110" />
        <el-table-column label="上线日" width="120">
          <template #default="{ row }">
            {{ row.releaseDate || '—' }}
            <el-tag v-if="row.released" size="small" type="success" class="ml4">已过</el-tag>
            <el-tag v-else-if="row.releaseDate" size="small" type="info" class="ml4">未到</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="单量" width="120">
          <template #default="{ row }">
            {{ row.issueCount }}（未关 {{ row.openCount }}）
          </template>
        </el-table-column>
        <el-table-column label="最近同步" width="160">
          <template #default="{ row }">{{ fmtTime(row.lastSyncedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openDetail(row)">详情</el-button>
            <el-button link type="success" size="small" @click.stop="resync(row)">再同步</el-button>
            <el-button v-perm:delete link type="danger" size="small" @click.stop="remove(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="syncVisible" title="从 Wiki 同步版本" size="460px" destroy-on-close>
      <el-form label-width="100px" size="small">
        <el-form-item label="APP 版本" required>
          <el-input v-model="syncForm.appVersion" placeholder="如 4.1.4" />
        </el-form-item>
        <el-form-item label="版本定位" required>
          <el-input v-model="syncForm.releaseLabel" placeholder="与 Wiki 标题一致，如 8.6 国内客户端" />
        </el-form-item>
        <el-form-item label="产品线">
          <el-input v-model="syncForm.productLine" placeholder="可空，自动从定位文案推断" />
        </el-form-item>
        <el-form-item label="上线日">
          <el-date-picker
            v-model="syncForm.releaseDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可空，从 8.6 解析为当年月日"
            style="width: 100%"
          />
        </el-form-item>
        <div class="tip">
          使用与「发版文档」相同的 Wiki/JIRA 账号，汇总页
          pageId 见后端 release-doc.issue-list-page-id。
        </div>
      </el-form>
      <template #footer>
        <el-button @click="syncVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="doSync">同步</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="detailVisible" :title="detailTitle" size="960px" destroy-on-close>
      <template v-if="detail">
        <div class="detail-meta">
          <span>APP {{ detail.appVersion }}</span>
          <span>· {{ detail.releaseLabel }}</span>
          <span v-if="detail.productLine">· {{ detail.productLine }}</span>
          <span v-if="detail.releaseDate">· 上线 {{ detail.releaseDate }}</span>
          <el-tag v-if="detail.released" size="small" type="success">已过上线日</el-tag>
          <el-tag v-else size="small" type="warning">未到上线日</el-tag>
        </div>
        <div class="detail-actions">
          <span class="sel-hint">已选 {{ selectedKeys.length }} 单</span>
          <el-button size="small" @click="selectAllIssues">全选</el-button>
          <el-button size="small" @click="selectClosedIssues">全选已关闭</el-button>
          <el-button size="small" @click="clearSelection">清空</el-button>
          <el-input
            v-model="reopenQa"
            size="small"
            placeholder="QA 用户名"
            style="width: 120px"
          />
          <el-button
            type="warning"
            size="small"
            :loading="reopening"
            :disabled="!selectedKeys.length"
            @click="reopenSelected"
          >
            重开已选 → Testing
          </el-button>
          <el-button
            size="small"
            :loading="previewing"
            :disabled="!selectedClosableKeys.length"
            @click="previewClose"
          >
            预览将关闭的单
          </el-button>
          <el-button
            type="danger"
            size="small"
            :loading="closing"
            :disabled="!detail.released || !selectedClosableKeys.length"
            @click="confirmClose"
          >
            确认关闭已选
          </el-button>
          <el-button size="small" @click="resync(detail)">再同步状态</el-button>
        </div>
        <el-alert
          v-if="closeLogs.length"
          type="info"
          :closable="true"
          style="margin-bottom: 12px"
          @close="closeLogs = []"
        >
          <pre class="close-logs">{{ closeLogs.join('\n') }}</pre>
        </el-alert>
        <el-table
          ref="issueTableRef"
          :data="detail.issues || []"
          size="small"
          border
          stripe
          max-height="calc(100vh - 220px)"
          row-key="issueKey"
          @selection-change="onIssueSelectionChange"
        >
          <el-table-column type="selection" width="42" />
          <el-table-column label="键值" width="120">
            <template #default="{ row }">
              <a v-if="row.issueUrl" :href="row.issueUrl" target="_blank" rel="noopener" @click.stop>
                {{ row.issueKey }}
              </a>
              <span v-else>{{ row.issueKey }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
          <el-table-column prop="statusName" label="状态" width="100" />
          <el-table-column prop="assignee" label="经办人" width="100" show-overflow-tooltip />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="!isTestingRow(row)"
                link
                type="warning"
                size="small"
                @click.stop="reopenOne(row)"
              >
                重开
              </el-button>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TableInstance } from 'element-plus'
import { apiClient } from '../api'

const loading = ref(false)
const syncing = ref(false)
const previewing = ref(false)
const closing = ref(false)
const reopening = ref(false)
const rows = ref<any[]>([])
const syncVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<any>(null)
const closeLogs = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const issueTableRef = ref<TableInstance>()
const reopenQa = ref('')

const selectedClosableKeys = computed(() => {
  const issues = detail.value?.issues || []
  const set = new Set(selectedKeys.value)
  return issues.filter((r: any) => set.has(r.issueKey) && r.closable).map((r: any) => r.issueKey)
})

const syncForm = reactive({
  appVersion: '',
  releaseLabel: '',
  productLine: '',
  releaseDate: '' as string
})

const detailTitle = computed(() =>
  detail.value ? `${detail.value.appVersion} · ${detail.value.releaseLabel}` : '版本详情'
)

function fmtTime(v?: string) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

function isTestingRow(row: any) {
  const s = String(row?.statusName || '').toLowerCase()
  return s === 'testing' || String(row?.statusName || '').includes('测试中')
}

function onIssueSelectionChange(selection: any[]) {
  selectedKeys.value = selection.map((r) => r.issueKey).filter(Boolean)
}

function selectAllIssues() {
  const table = issueTableRef.value
  const issues = detail.value?.issues || []
  if (!table) return
  table.clearSelection()
  for (const row of issues) table.toggleRowSelection(row, true)
}

function selectClosedIssues() {
  const table = issueTableRef.value
  const issues = detail.value?.issues || []
  if (!table) return
  table.clearSelection()
  for (const row of issues) {
    const s = String(row.statusName || '')
    if (s.includes('关闭') || s.toLowerCase() === 'closed' || s.toLowerCase() === 'done') {
      table.toggleRowSelection(row, true)
    }
  }
}

function selectAllClosable() {
  const table = issueTableRef.value
  const issues = detail.value?.issues || []
  if (!table) return
  table.clearSelection()
  for (const row of issues) {
    if (row.closable) table.toggleRowSelection(row, true)
  }
}

function clearSelection() {
  issueTableRef.value?.clearSelection()
  selectedKeys.value = []
}

async function applyDefaultSelection() {
  await nextTick()
  selectClosedIssues()
}

async function load() {
  loading.value = true
  try {
    rows.value = await apiClient.listVersionArchives()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openSync() {
  syncForm.appVersion = ''
  syncForm.releaseLabel = ''
  syncForm.productLine = ''
  syncForm.releaseDate = ''
  syncVisible.value = true
}

async function doSync() {
  if (!syncForm.appVersion.trim() || !syncForm.releaseLabel.trim()) {
    ElMessage.warning('请填写 APP 版本与版本定位')
    return
  }
  syncing.value = true
  try {
    const body: any = {
      appVersion: syncForm.appVersion.trim(),
      releaseLabel: syncForm.releaseLabel.trim()
    }
    if (syncForm.productLine.trim()) body.productLine = syncForm.productLine.trim()
    if (syncForm.releaseDate) body.releaseDate = syncForm.releaseDate
    const d = await apiClient.syncVersionArchive(body)
    ElMessage.success(`已同步 ${d.issueCount || 0} 个单`)
    syncVisible.value = false
    await load()
    detail.value = d
    detailVisible.value = true
    closeLogs.value = []
    await applyDefaultSelection()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

async function openDetail(row: any) {
  if (!row?.id) return
  try {
    detail.value = await apiClient.getVersionArchive(row.id)
    closeLogs.value = []
    detailVisible.value = true
    await applyDefaultSelection()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载详情失败')
  }
}

async function resync(row: any) {
  if (!row?.appVersion || !row?.releaseLabel) return
  syncing.value = true
  try {
    const d = await apiClient.syncVersionArchive({
      appVersion: row.appVersion,
      releaseLabel: row.releaseLabel,
      productLine: row.productLine || undefined,
      releaseDate: row.releaseDate || undefined
    })
    ElMessage.success(`已再同步 ${d.issueCount || 0} 个单`)
    await load()
    if (detailVisible.value && detail.value?.id === d.id) {
      detail.value = d
      await applyDefaultSelection()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '再同步失败')
  } finally {
    syncing.value = false
  }
}

async function previewClose() {
  if (!detail.value?.id) return
  if (!selectedClosableKeys.value.length) {
    ElMessage.warning('请勾选仍可关闭的单（已关闭的不会关）')
    return
  }
  previewing.value = true
  try {
    const res = await apiClient.closeVersionArchive(detail.value.id, {
      dryRun: true,
      issueKeys: [...selectedClosableKeys.value]
    })
    closeLogs.value = res.logs || [`将关闭 ${(res.preview || []).length} 单`]
    ElMessage.info(`预览：将关闭 ${(res.preview || []).length} 单`)
  } catch (e: any) {
    ElMessage.error(e?.message || '预览失败')
  } finally {
    previewing.value = false
  }
}

async function confirmClose() {
  if (!detail.value?.id) return
  if (!detail.value.released) {
    ElMessage.warning('上线日未到，不能批量关闭')
    return
  }
  if (!selectedClosableKeys.value.length) {
    ElMessage.warning('请勾选仍可关闭的单')
    return
  }
  const keys = [...selectedClosableKeys.value]
  try {
    await ElMessageBox.confirm(
      `确认关闭已勾选的 ${keys.length} 个未关单？将调用 JIRA 流转，不可撤销。`,
      '关闭已选',
      { type: 'warning' }
    )
  } catch {
    return
  }
  closing.value = true
  try {
    const res = await apiClient.closeVersionArchive(detail.value.id, {
      dryRun: false,
      confirm: true,
      issueKeys: keys
    })
    closeLogs.value = res.logs || []
    ElMessage.success(`关闭完成：成功 ${res.closed || 0}，失败 ${res.failed || 0}`)
    detail.value = await apiClient.getVersionArchive(detail.value.id)
    await applyDefaultSelection()
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '关闭失败')
  } finally {
    closing.value = false
  }
}

async function reopenOne(row: any) {
  if (!row?.issueKey) return
  if (!reopenQa.value.trim()) {
    ElMessage.warning('请填写 QA 用户名')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将 ${row.issueKey} 重开到 Testing，并分配给 ${reopenQa.value.trim()}？`,
      '重开到 Testing',
      { type: 'warning' }
    )
  } catch {
    return
  }
  reopening.value = true
  try {
    const res = await apiClient.reopenAssignVersionIssue(row.issueKey, {
      username: reopenQa.value.trim(),
      comment: `平台重开到 Testing，分配 QA ${reopenQa.value.trim()}`
    })
    closeLogs.value = [res.message || 'ok']
    ElMessage.success(res.message || '已重开')
    if (detail.value?.id) {
      detail.value = await apiClient.getVersionArchive(detail.value.id)
      await applyDefaultSelection()
    }
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '重开失败')
  } finally {
    reopening.value = false
  }
}

async function reopenSelected() {
  if (!selectedKeys.value.length) {
    ElMessage.warning('请先勾选要重开的单')
    return
  }
  if (!reopenQa.value.trim()) {
    ElMessage.warning('请填写 QA 用户名')
    return
  }
  const keys = [...selectedKeys.value]
  try {
    await ElMessageBox.confirm(
      `将已勾选 ${keys.length} 单重开到 Testing，并分配给 ${reopenQa.value.trim()}？`,
      '批量重开',
      { type: 'warning' }
    )
  } catch {
    return
  }
  reopening.value = true
  try {
    const res = await apiClient.reopenAssignVersionIssuesBatch({
      issueKeys: keys,
      username: reopenQa.value.trim(),
      comment: `平台批量重开到 Testing，分配 QA ${reopenQa.value.trim()}`
    })
    closeLogs.value = res.logs || []
    ElMessage.success('批量重开完成，详见日志')
    if (detail.value?.id) {
      detail.value = await apiClient.getVersionArchive(detail.value.id)
      await applyDefaultSelection()
    }
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '批量重开失败')
  } finally {
    reopening.value = false
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`删除归档「${row.releaseLabel}」？`, '删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteVersionArchive(row.id)
    ElMessage.success('已删除')
    if (detail.value?.id === row.id) detailVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}
.tip {
  margin: 0 0 8px 100px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.ml4 {
  margin-left: 4px;
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--app-text-secondary, #606266);
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}
.sel-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}
.close-logs {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  max-height: 160px;
  overflow: auto;
}
.muted {
  color: #c0c4cc;
}
</style>
