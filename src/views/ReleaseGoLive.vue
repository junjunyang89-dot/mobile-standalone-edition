<template>
  <div class="go-live">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">上线看板</span>
            <p class="card-sub">
              按项目归类上线分支；合并完成后点「待合并」→「已合并」，发版完成后点「待上线」→「已上线」。
            </p>
          </div>
        </div>
      </template>

      <el-form :inline="true" class="toolbar" @submit.prevent>
        <el-form-item label="发版 Wiki">
          <el-input
            v-model="wikiUrl"
            clearable
            style="width: 520px"
            placeholder="粘贴发版文档 Wiki URL，如 …pageId=119730957"
            @keyup.enter="loadBoard"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadBoard">刷新看板</el-button>
          <el-button :disabled="!wikiPageId" @click="resetAll">全部清零</el-button>
        </el-form-item>
      </el-form>

      <div v-if="board" class="progress-block">
        <div class="progress-meta">
          <span>
            已合并 {{ board.mergedCount ?? 0 }} / {{ board.branchCount ?? 0 }} · 已上线
            {{ board.releasedCount }} / {{ board.branchCount ?? 0 }}
          </span>
          <span class="muted">
            项目 {{ board.projectCount }} · 需求 {{ board.issueCount }} · pageId {{ board.wikiPageId }}
          </span>
        </div>
        <el-progress
          :percentage="progressPct"
          :status="progressPct >= 100 ? 'success' : undefined"
          :stroke-width="14"
        />
      </div>

      <el-alert
        v-if="board && board.hasOrderHints"
        type="warning"
        :closable="false"
        show-icon
        class="order-alert"
        title="发版顺序提醒（请按备注顺序操作）"
      >
        <ul class="order-list">
          <li v-for="(h, i) in board.orderHints" :key="i">{{ h }}</li>
        </ul>
      </el-alert>
      <el-alert
        v-else-if="board"
        type="info"
        :closable="false"
        show-icon
        class="order-alert"
        title="无强制顺序"
        description="本页备注中未发现「发版顺序 / 顺序发版」字样。"
      />

      <el-table
        v-if="board"
        :data="branchRows"
        border
        stripe
        size="small"
        row-key="_key"
        :span-method="projectSpanMethod"
        :row-class-name="rowClass"
        style="width: 100%; margin-top: 12px"
        empty-text="未解析到项目分支，请确认 Wiki 表格「上线分支」列格式"
      >
        <el-table-column label="项目" min-width="140" fixed>
          <template #default="{ row }">
            <div class="project-cell">
              <span>{{ row.project }}</span>
              <el-tag
                size="small"
                :type="row.layer === 'frontend' ? 'warning' : 'info'"
                effect="plain"
              >
                {{ row.layer === 'frontend' ? '前端' : '后端' }}
              </el-tag>
              <span class="muted">{{ row.projectBranchCount }} 分支</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分支" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="branch-name">{{ row.branch }}</span>
          </template>
        </el-table-column>
        <el-table-column label="关联需求" min-width="280">
          <template #default="{ row }">
            <template v-if="row.matchedIssues.length">
              <div v-for="(iss, i) in row.matchedIssues" :key="i" class="issue-block">
                <a
                  v-if="iss.issueUrl"
                  class="issue-key"
                  :href="iss.issueUrl"
                  target="_blank"
                  rel="noopener"
                  >{{ iss.issueKey || '需求' }}</a
                >
                <span v-else class="issue-key">{{ iss.issueKey || '需求' }}</span>
                <div v-if="iss.summary" class="issue-summary">{{ iss.summary }}</div>
                <div v-if="iss.qaAssignee" class="muted">测试：{{ iss.qaAssignee }}</div>
              </div>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="合并" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              class="status-tag"
              :type="row.item.mergedMaster ? 'success' : 'warning'"
              :effect="row.item.mergedMaster ? 'dark' : 'plain'"
              :class="{ saving: savingKey === saveKey(row.project, row.branch, 'm') }"
              @click="toggleMerged(row.projectRow, row.item)"
            >
              {{ row.item.mergedMaster ? '已合并' : '待合并' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="master 核对" min-width="200">
          <template #default="{ row }">
            <div v-if="row.item.masterCheck?.status" class="check-cell">
              <el-tag size="small" :type="masterCheckTagType(row.item.masterCheck.status)" effect="light">
                {{ masterCheckLabel(row.item.masterCheck.status) }}
              </el-tag>
              <div class="check-msg">{{ row.item.masterCheck.message }}</div>
              <el-button
                v-if="row.item.mergedMaster"
                size="small"
                text
                type="primary"
                :loading="savingKey === saveKey(row.project, row.branch, 'v')"
                @click="reverifyMaster(row.projectRow, row.item)"
              >
                重新核对
              </el-button>
            </div>
            <span v-else class="muted">点「待合并」后自动核对</span>
          </template>
        </el-table-column>
        <el-table-column label="Jenkins" min-width="220">
          <template #default="{ row }">
            <div v-if="row.jenkins?.configured" class="jenkins-cell">
              <el-tag size="small" :type="jenkinsTagType(row.jenkins)" effect="light">
                {{ row.jenkins.summary || row.jenkins.error || 'Jenkins' }}
              </el-tag>
              <div v-if="row.jenkins.lastSuccessNumber != null" class="jenkins-num">
                成功包 <b>#{{ row.jenkins.lastSuccessNumber }}</b>
                <span v-if="row.jenkins.lastSuccessTime" class="muted">
                  · {{ row.jenkins.lastSuccessTime }}
                </span>
              </div>
              <div v-else-if="row.jenkins.error" class="muted">{{ row.jenkins.error }}</div>
              <div v-else class="muted">平台账号已自动拉取，无需登录 Jenkins</div>
            </div>
            <span v-else class="muted">未配置 job</span>
          </template>
        </el-table-column>
        <el-table-column label="上线" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              class="status-tag"
              :type="row.item.released ? 'success' : 'info'"
              :effect="row.item.released ? 'dark' : 'plain'"
              :class="{ saving: savingKey === saveKey(row.project, row.branch, 'r') }"
              @click="toggleReleased(row.projectRow, row.item)"
            >
              {{ row.item.released ? '已上线' : '待上线' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const WIKI_KEY = 'release-go-live-wiki-url'

interface IssueBrief {
  issueKey?: string
  summary?: string
  issueUrl?: string
}

interface BranchItem {
  branch: string
  mergedMaster: boolean
  released: boolean
}

interface ProjectRow {
  project: string
  layer?: 'frontend' | 'backend' | string
  branches: string[]
  branchItems: BranchItem[]
  issues: IssueBrief[]
  mergedMaster: boolean
  released: boolean
  branchCount?: number
  mergedCount?: number
  releasedBranchCount?: number
}

interface Board {
  wikiPageId: string
  wikiPageUrl?: string
  issueCount: number
  projectCount: number
  branchCount?: number
  mergedCount?: number
  releasedCount: number
  orderHints: string[]
  hasOrderHints: boolean
  projects: ProjectRow[]
}

const wikiUrl = ref('')
const board = ref<Board | null>(null)
const loading = ref(false)
const savingKey = ref('')

const wikiPageId = computed(() => board.value?.wikiPageId || '')

const progressPct = computed(() => {
  const b = board.value
  const total = b?.branchCount || 0
  if (!b || !total) return 0
  return Math.round((b.releasedCount / total) * 100)
})

function saveKey(project: string, branch: string, kind: 'm' | 'r' | 'v') {
  return `${project}|${branch}|${kind}`
}

function masterCheckLabel(status: string) {
  return (
    {
      IN_MASTER: '已在 master',
      NOT_IN_MASTER: '未进 master',
      ERROR: '核对失败'
    } as Record<string, string>
  )[status] || status
}

function masterCheckTagType(status: string) {
  if (status === 'IN_MASTER') return 'success'
  if (status === 'NOT_IN_MASTER') return 'danger'
  return 'warning'
}

function isPlaceholderBranch(b: string) {
  return !b || b.includes('见需求备注') || b === '-' || b === '无'
}

function recomputeCounts() {
  if (!board.value) return
  let branchTotal = 0
  let merged = 0
  let released = 0
  for (const p of board.value.projects) {
    ensureBranchItems(p)
    let pm = 0
    let pr = 0
    let pc = 0
    for (const bi of p.branchItems) {
      if (isPlaceholderBranch(bi.branch)) continue
      pc++
      branchTotal++
      if (bi.mergedMaster) {
        merged++
        pm++
      }
      if (bi.released) {
        released++
        pr++
      }
    }
    p.branchCount = pc
    p.mergedCount = pm
    p.releasedBranchCount = pr
    p.mergedMaster = pc > 0 && pm === pc
    p.released = pc > 0 && pr === pc
  }
  board.value.branchCount = branchTotal
  board.value.mergedCount = merged
  board.value.releasedCount = released
}

function ensureBranchItems(row: ProjectRow) {
  if (row.branchItems?.length) return
  row.branchItems = (row.branches || []).map((b) => ({
    branch: b,
    mergedMaster: !!row.mergedMaster,
    released: !!row.released
  }))
}

const branchRows = computed(() => {
  const out: any[] = []
  if (!board.value) return out
  for (const p of board.value.projects) {
    ensureBranchItems(p)
    const real = (p.branchItems || []).filter((bi) => !isPlaceholderBranch(bi.branch))
    real.forEach((bi, idx) => {
      out.push({
        _key: `${p.project}::${bi.branch}`,
        project: p.project,
        layer: p.layer,
        projectBranchCount: real.length,
        projectRow: p,
        jenkins: (p as any).jenkins || null,
        item: bi,
        branch: bi.branch,
        span: idx === 0 ? real.length : 0,
        matchedIssues: matchIssuesForBranch(bi, p.issues || [])
      })
    })
  }
  return out
})

function jenkinsTagType(j: any) {
  if (!j) return 'info'
  if (j.building) return 'warning'
  if (j.lastResult === 'SUCCESS' || (j.ok && j.lastSuccessNumber != null && !j.building)) return 'success'
  if (j.lastResult === 'FAILURE' || j.lastResult === 'UNSTABLE' || j.lastResult === 'ABORTED') return 'danger'
  if (j.error) return 'warning'
  return 'info'
}

/** 后端 Wiki 行绑定优先；否则用分支名里的 APP-xxx 对项目需求兜底 */
function matchIssuesForBranch(bi: BranchItem & { issues?: IssueBrief[] }, projectIssues: IssueBrief[]) {
  if (Array.isArray(bi.issues) && bi.issues.length) return bi.issues
  const branch = String(bi.branch || '')
  const keys = new Set([...(branch.match(/APP-\d+/gi) || [])].map((k) => k.toUpperCase()))
  if (!keys.size || !projectIssues?.length) return []
  return projectIssues.filter((iss) => keys.has(String(iss.issueKey || '').toUpperCase()))
}

/** 项目列、Jenkins 列按项目合并单元格 */
function projectSpanMethod({ column, row }: { column: any; row: any }) {
  const label = column?.label || ''
  if (label !== '项目' && label !== 'Jenkins') return { rowspan: 1, colspan: 1 }
  if (row.span > 0) return { rowspan: row.span, colspan: 1 }
  return { rowspan: 0, colspan: 0 }
}

function rowClass({ row }: { row: any }) {
  const classes: string[] = []
  if (!row.item?.released) classes.push('row-pending')
  if (!row.item?.mergedMaster) classes.push('row-unmerged')
  return classes.join(' ')
}

async function loadBoard() {
  const url = wikiUrl.value.trim()
  if (!url) {
    ElMessage.warning('请先粘贴发版 Wiki URL')
    return
  }
  loading.value = true
  try {
    const data = await apiClient.getReleaseGoLiveBoard(url)
    board.value = data as Board
    for (const p of board.value.projects) ensureBranchItems(p)
    recomputeCounts()
    localStorage.setItem(WIKI_KEY, url)
    ElMessage.success(
      `已加载 ${data.projectCount} 个项目 · ${data.branchCount ?? 0} 条分支`
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function toggleMerged(row: ProjectRow, item: BranchItem & { masterCheck?: any }) {
  if (!wikiPageId.value || isPlaceholderBranch(item.branch)) return
  const next = !item.mergedMaster
  const prev = item.mergedMaster
  const prevCheck = item.masterCheck
  item.mergedMaster = next
  if (!next) item.masterCheck = null
  recomputeCounts()
  savingKey.value = saveKey(row.project, item.branch, 'm')
  try {
    const res = await apiClient.saveReleaseGoLiveState({
      wikiPageId: wikiPageId.value,
      project: row.project,
      branch: item.branch,
      mergedMaster: next
    })
    if (res?.masterCheck) {
      item.masterCheck = res.masterCheck
      if (next && res.masterCheck.status === 'IN_MASTER') {
        ElMessage.success(res.masterCheck.message || '已确认在 master')
      } else if (next && res.masterCheck.status === 'NOT_IN_MASTER') {
        ElMessage.warning(res.masterCheck.message || '还没进 master')
      } else if (next && res.masterCheck.status === 'ERROR') {
        ElMessage.error(res.masterCheck.message || '核对失败')
      }
    }
  } catch (e: any) {
    item.mergedMaster = prev
    item.masterCheck = prevCheck
    recomputeCounts()
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

async function reverifyMaster(row: ProjectRow, item: BranchItem & { masterCheck?: any }) {
  if (!wikiPageId.value || isPlaceholderBranch(item.branch)) return
  savingKey.value = saveKey(row.project, item.branch, 'v')
  try {
    const res = await apiClient.verifyReleaseGoLiveMaster({
      wikiPageId: wikiPageId.value,
      project: row.project,
      branch: item.branch
    })
    item.masterCheck = res?.masterCheck || null
    if (res?.masterCheck?.status === 'IN_MASTER') {
      ElMessage.success(res.masterCheck.message || '已在 master')
    } else if (res?.masterCheck?.status === 'NOT_IN_MASTER') {
      ElMessage.warning(res.masterCheck.message || '未进 master')
    } else {
      ElMessage.error(res?.masterCheck?.message || '核对失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '核对失败')
  } finally {
    savingKey.value = ''
  }
}

async function toggleReleased(row: ProjectRow, item: BranchItem) {
  if (!wikiPageId.value || isPlaceholderBranch(item.branch)) return
  const next = !item.released
  const prev = item.released
  item.released = next
  recomputeCounts()
  savingKey.value = saveKey(row.project, item.branch, 'r')
  try {
    await apiClient.saveReleaseGoLiveState({
      wikiPageId: wikiPageId.value,
      project: row.project,
      branch: item.branch,
      released: next
    })
  } catch (e: any) {
    item.released = prev
    recomputeCounts()
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

async function resetAll() {
  if (!wikiPageId.value) return
  try {
    await ElMessageBox.confirm('清空本 Wiki 页下所有「已合并 / 已上线」状态？', '全部清零', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await apiClient.resetReleaseGoLiveState(wikiPageId.value)
    if (board.value) {
      for (const p of board.value.projects) {
        ensureBranchItems(p)
        for (const bi of p.branchItems) {
          bi.mergedMaster = false
          bi.released = false
        }
      }
      recomputeCounts()
    }
    ElMessage.success('已清零')
  } catch (e: any) {
    ElMessage.error(e?.message || '清零失败')
  }
}

onMounted(() => {
  const saved = localStorage.getItem(WIKI_KEY)
  if (saved) wikiUrl.value = saved
})
</script>

<style scoped>
.go-live {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}
.go-live :deep(.el-card) {
  width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.toolbar {
  margin-bottom: 4px;
}
.progress-block {
  margin: 8px 0 16px;
}
.progress-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.order-alert {
  margin-bottom: 8px;
}
.order-list {
  margin: 6px 0 0;
  padding-left: 18px;
  line-height: 1.6;
}
.project-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.jenkins-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.jenkins-num {
  font-size: 13px;
}
.jenkins-num b {
  font-size: 15px;
  color: var(--el-color-success-dark-2);
}
.issue-block {
  margin: 2px 0 6px;
  line-height: 1.4;
  word-break: break-all;
}
.issue-key {
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: none;
}
.issue-key:hover {
  text-decoration: underline;
}
.issue-summary {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.branch-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
.status-tag {
  cursor: pointer;
  user-select: none;
}
.check-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.check-msg {
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}
.status-tag.saving {
  opacity: 0.55;
  pointer-events: none;
}
:deep(.row-pending) {
  background: #fff8f0 !important;
}
:deep(.row-unmerged) {
  background: #fff5f5 !important;
}
:deep(.row-pending td),
:deep(.row-unmerged td) {
  background: transparent !important;
}
</style>
