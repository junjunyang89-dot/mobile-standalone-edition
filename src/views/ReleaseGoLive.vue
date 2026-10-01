<template>
  <div class="go-live">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">上线看板</span>
            <p class="card-sub">
              从发版 Wiki 按项目汇总（前端仓置顶）。把你已合并的分支粘贴到下方，自动对比标出未合项；上线后勾「已上线」。
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
            placeholder="粘贴发版文档 Wiki URL，如 …pageId=119728410"
            @keyup.enter="loadBoard"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadBoard">刷新看板</el-button>
          <el-button :disabled="!wikiPageId" @click="resetAll">全部清零</el-button>
        </el-form-item>
      </el-form>

      <div v-if="board" class="merge-paste">
        <div class="merge-paste-head">
          <span class="merge-paste-title">我已合并的分支</span>
          <span class="muted">
            每行一条，如
            <code>app-swift: zxl/2026-09-15/APP-9103</code>
            ；多项目共用分支也支持
            <code>app-community、data-center：dyl/…</code>
          </span>
        </div>
        <el-input
          v-model="mergedPaste"
          type="textarea"
          :rows="10"
          placeholder="粘贴你已合并进 master 的项目：分支列表…"
        />
        <div v-if="mergedPaste.trim()" class="merge-summary">
          <el-tag v-if="missingPairs.length === 0" type="success" effect="light">
            看板内分支均已出现在粘贴列表（{{ matchedBranchCount }} / {{ totalBranchCount }}）
          </el-tag>
          <el-tag v-else type="danger" effect="light">
            未合并 {{ missingPairs.length }} 条（已匹配 {{ matchedBranchCount }} / {{ totalBranchCount }}）
          </el-tag>
        </div>
        <el-alert
          v-if="missingPairs.length > 0"
          type="warning"
          :closable="false"
          show-icon
          class="missing-alert"
          title="以下分支尚未出现在你的合并列表中"
        >
          <ul class="order-list">
            <li v-for="(m, i) in missingPairs" :key="i">
              <strong>{{ m.project }}</strong>：{{ m.branch }}
            </li>
          </ul>
        </el-alert>
      </div>

      <div v-if="board" class="progress-block">
        <div class="progress-meta">
          <span>上线进度 {{ board.releasedCount }} / {{ board.projectCount }}</span>
          <span class="muted">需求 {{ board.issueCount }} 条 · pageId {{ board.wikiPageId }}</span>
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
        :data="board.projects"
        border
        stripe
        row-key="project"
        :row-class-name="rowClass"
        style="width: 100%; margin-top: 12px"
        empty-text="未解析到项目分支，请确认 Wiki 表格「上线分支」列格式"
      >
        <el-table-column label="项目" min-width="160" fixed>
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
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分支" min-width="260">
          <template #default="{ row }">
            <div
              v-for="(b, i) in row.branches"
              :key="i"
              class="branch-line"
              :class="branchClass(row.project, b)"
            >
              <span>{{ b }}</span>
              <el-tag
                v-if="mergedPaste.trim() && !isPlaceholderBranch(b)"
                size="small"
                :type="isBranchMerged(row.project, b) ? 'success' : 'danger'"
                effect="light"
                class="branch-tag"
              >
                {{ isBranchMerged(row.project, b) ? '已合' : '未合' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="关联需求" min-width="220">
          <template #default="{ row }">
            <div v-for="(iss, i) in row.issues" :key="i" class="issue-line">
              <a v-if="iss.issueUrl" :href="iss.issueUrl" target="_blank" rel="noopener">{{
                iss.issueKey || iss.summary
              }}</a>
              <span v-else>{{ iss.issueKey || iss.summary }}</span>
              <span v-if="iss.summary" class="muted"> — {{ iss.summary }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合并对比" width="110" align="center">
          <template #default="{ row }">
            <template v-if="!mergedPaste.trim()">
              <span class="muted">粘贴后对比</span>
            </template>
            <el-tag v-else-if="projectMergeStatus(row) === 'all'" type="success" effect="light">
              已全合
            </el-tag>
            <el-tag v-else-if="projectMergeStatus(row) === 'none'" type="info" effect="plain">
              —
            </el-tag>
            <el-tag v-else type="danger" effect="light">
              缺 {{ projectMissingCount(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已上线" width="90" align="center">
          <template #default="{ row }">
            <el-checkbox
              :model-value="!!row.released"
              :disabled="savingKey === row.project"
              @change="(v: boolean | string | number) => onToggleReleased(row, !!v)"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const WIKI_KEY = 'release-go-live-wiki-url'
const MERGED_KEY_PREFIX = 'release-go-live-merged:'

interface IssueBrief {
  issueKey?: string
  summary?: string
  issueUrl?: string
}

interface ProjectRow {
  project: string
  layer?: 'frontend' | 'backend' | string
  branches: string[]
  issues: IssueBrief[]
  mergedMaster: boolean
  released: boolean
}

interface Board {
  wikiPageId: string
  wikiPageUrl?: string
  issueCount: number
  projectCount: number
  releasedCount: number
  orderHints: string[]
  hasOrderHints: boolean
  projects: ProjectRow[]
}

interface ProjectBranch {
  project: string
  branch: string
}

const wikiUrl = ref('')
const board = ref<Board | null>(null)
const loading = ref(false)
const savingKey = ref('')
const mergedPaste = ref('')

const wikiPageId = computed(() => board.value?.wikiPageId || '')

const progressPct = computed(() => {
  const b = board.value
  if (!b || !b.projectCount) return 0
  return Math.round((b.releasedCount / b.projectCount) * 100)
})

/** project|branch → true */
const mergedKeySet = computed(() => {
  const set = new Set<string>()
  for (const pb of parseMergedPaste(mergedPaste.value)) {
    set.add(pairKey(pb.project, pb.branch))
  }
  return set
})

const allBoardPairs = computed(() => {
  const out: ProjectBranch[] = []
  if (!board.value) return out
  for (const p of board.value.projects) {
    for (const b of p.branches || []) {
      if (isPlaceholderBranch(b)) continue
      out.push({ project: normalizeProject(p.project), branch: b })
    }
  }
  return out
})

const totalBranchCount = computed(() => allBoardPairs.value.length)

const matchedBranchCount = computed(() =>
  allBoardPairs.value.filter((pb) => mergedKeySet.value.has(pairKey(pb.project, pb.branch))).length
)

const missingPairs = computed(() =>
  allBoardPairs.value.filter((pb) => !mergedKeySet.value.has(pairKey(pb.project, pb.branch)))
)

function pairKey(project: string, branch: string) {
  return `${normalizeProject(project)}|${normalizeBranch(branch)}`
}

function isPlaceholderBranch(b: string) {
  return !b || b.startsWith('(')
}

function isBranchMerged(project: string, branch: string) {
  if (isPlaceholderBranch(branch)) return true
  return mergedKeySet.value.has(pairKey(project, branch))
}

function branchClass(project: string, branch: string) {
  if (!mergedPaste.value.trim() || isPlaceholderBranch(branch)) return ''
  return isBranchMerged(project, branch) ? 'is-merged' : 'is-missing'
}

function projectMissingCount(row: ProjectRow) {
  return (row.branches || []).filter((b) => !isPlaceholderBranch(b) && !isBranchMerged(row.project, b))
    .length
}

function projectMergeStatus(row: ProjectRow): 'all' | 'partial' | 'none' {
  const real = (row.branches || []).filter((b) => !isPlaceholderBranch(b))
  if (!real.length) return 'none'
  const miss = projectMissingCount(row)
  if (miss === 0) return 'all'
  if (miss === real.length) return 'partial'
  return 'partial'
}

function normalizeProject(raw: string): string {
  let p = (raw || '').trim().replace(/[:：]\s*$/, '').trim()
  if (!p) return ''
  const lower = p.toLowerCase()
  if (lower === 'esport-api' || lower === 'esportsapi') return 'esports-api'
  if (lower === 'eventcenter' || lower === 'event_center') return 'event-center'
  if (lower === 'appuser' || lower === 'app_user') return 'app-user'
  if (lower === 'commentservice' || lower === 'comment_service') return 'comment-service'
  if (lower === 'datacenter' || lower === 'data_center') return 'data-center'
  if (lower === 'appadmin' || lower === 'app_admin') return 'app-admin'
  return p
}

function normalizeBranch(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[，,]\s*(顺序发版|发版顺序|发版次序|注意).*$/u, '')
    .replace(/[；;].*$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 解析粘贴的「项目：分支」多行文本 */
function parseMergedPaste(text: string): ProjectBranch[] {
  const out: ProjectBranch[] = []
  if (!text || !text.trim()) return out
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line === '-' || line === '无') continue
    const m = line.match(/^(.+?)\s*[:：]\s*(.+)$/)
    if (!m) continue
    const left = m[1].trim()
    const branch = m[2].trim()
    if (!branch) continue
    const parts = left.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      const project = normalizeProject(part)
      if (!project) continue
      out.push({ project, branch })
    }
  }
  return out
}

function rowClass({ row }: { row: ProjectRow }) {
  const classes: string[] = []
  if (!row.released) classes.push('row-pending')
  if (mergedPaste.value.trim() && projectMergeStatus(row) === 'partial') {
    classes.push('row-unmerged')
  }
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
    localStorage.setItem(WIKI_KEY, url)
    const saved = localStorage.getItem(MERGED_KEY_PREFIX + data.wikiPageId)
    if (saved != null) mergedPaste.value = saved
    ElMessage.success(`已加载 ${data.projectCount} 个项目`)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onToggleReleased(row: ProjectRow, value: boolean) {
  if (!wikiPageId.value) return
  const prev = row.released
  row.released = value
  savingKey.value = row.project
  try {
    await apiClient.saveReleaseGoLiveState({
      wikiPageId: wikiPageId.value,
      project: row.project,
      released: value
    })
    if (board.value) {
      board.value.releasedCount = board.value.projects.filter((p) => p.released).length
    }
  } catch (e: any) {
    row.released = prev
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

async function resetAll() {
  if (!wikiPageId.value) return
  try {
    await ElMessageBox.confirm('清空本 Wiki 页下所有「已上线」勾选？', '全部清零', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await apiClient.resetReleaseGoLiveState(wikiPageId.value)
    if (board.value) {
      for (const p of board.value.projects) {
        p.mergedMaster = false
        p.released = false
      }
      board.value.releasedCount = 0
    }
    ElMessage.success('已清零')
  } catch (e: any) {
    ElMessage.error(e?.message || '清零失败')
  }
}

watch(mergedPaste, (v) => {
  if (!wikiPageId.value) return
  localStorage.setItem(MERGED_KEY_PREFIX + wikiPageId.value, v)
})

onMounted(() => {
  const saved = localStorage.getItem(WIKI_KEY)
  if (saved) wikiUrl.value = saved
})
</script>

<style scoped>
.go-live {
  max-width: 1280px;
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
.merge-paste {
  margin: 8px 0 16px;
}
.merge-paste-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 8px;
}
.merge-paste-title {
  font-weight: 600;
  font-size: 14px;
}
.merge-summary {
  margin-top: 8px;
}
.missing-alert {
  margin-top: 8px;
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
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.branch-line,
.issue-line {
  line-height: 1.6;
  word-break: break-all;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}
.branch-line.is-missing {
  color: var(--el-color-danger-dark-2);
}
.branch-line.is-merged {
  color: var(--el-color-success-dark-2);
}
.branch-tag {
  flex-shrink: 0;
}
code {
  font-size: 12px;
  background: var(--el-fill-color-lighter);
  padding: 1px 4px;
  border-radius: 3px;
}
:deep(.row-pending) {
  background: #fff8f0 !important;
}
:deep(.row-unmerged) {
  background: var(--el-color-danger-light-9) !important;
}
:deep(.row-pending td),
:deep(.row-unmerged td) {
  background: transparent !important;
}
</style>
