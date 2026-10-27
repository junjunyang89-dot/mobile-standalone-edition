<template>
  <div class="tm">
    <el-card shadow="hover">
      <template #header>
        <div class="tm-head">
          <span class="tm-title">合并到 testing</span>
          <span class="grow" />
          <el-button size="small" :icon="Tickets" @click="openLogs">合并记录</el-button>
          <el-button size="small" @click="goMasterSettings">GitLab 令牌设置</el-button>
        </div>
      </template>

      <div v-if="settings && !settings.tokenSet" class="no-token">
        还没填 GitLab 个人令牌，现在只能拉分支和核对、不能合并。令牌与「合并到 master」共用。
        <el-link type="primary" @click="goMasterSettings">去填</el-link>
      </div>

      <div class="tip-bar">
        目标均为各仓的 <code>testing</code>。从 JIRA 拉出分支后请核对，再<strong>逐条确认</strong>合并，避免合错。
      </div>

      <el-input
        v-model="text"
        type="textarea"
        :rows="3"
        class="mono"
        :placeholder="'粘贴 JIRA 单号或 browse 链接，多个也行，例如\nAPP-9103\nhttp://jira.../browse/APP-9104'"
      />
      <div class="actions">
        <el-button type="primary" :loading="resolving" :disabled="!text.trim()" @click="resolve">
          拉分支
        </el-button>
        <el-button
          :loading="checking"
          :disabled="!rows.length"
          @click="checkAll"
        >
          核对全部
        </el-button>
        <span class="muted">
          沿用上线目录 <code>{{ settings?.reposDir || '…' }}</code>；合进 testing，与合 master 共用令牌
        </span>
      </div>

      <div v-if="failed.length" class="failed">
        有 {{ failed.length }} 个单拉失败：{{ failed.join('；') }}
      </div>

      <div v-if="rows.length" class="summary">
        <span>共 {{ rows.length }} 个</span>
        <span v-if="counts.OK" class="s-ok">{{ counts.OK }} 个可以合</span>
        <span v-if="counts.WARN" class="s-warn">{{ counts.WARN }} 个要确认</span>
        <span v-if="counts.BLOCK" class="s-block">{{ counts.BLOCK }} 个不能合</span>
        <span v-if="counts.ALREADY" class="s-done">{{ counts.ALREADY }} 个已在 testing</span>
        <span v-if="counts.MERGED" class="s-done">{{ counts.MERGED }} 个刚合完</span>
        <span v-if="counts.PENDING" class="muted">{{ counts.PENDING }} 个待核对</span>
      </div>

      <div class="cards">
        <div v-for="(r, i) in rows" :key="i" class="card" :class="'st-' + state(r)">
          <div class="c-head">
            <span class="tag" :class="'t-' + state(r)">{{ stateText(r) }}</span>
            <b class="mono">{{ r.projectName || r.rawProject || '没认出项目' }}</b>
            <span v-if="r.kind" class="kind">{{ KIND[r.kind] || r.kind }}</span>
            <span class="mono branch">{{ r.branch || '—' }}</span>
            <span class="muted">→ testing</span>
            <span v-if="r.issueKey" class="issue">
              <el-link v-if="r.issueUrl" :href="r.issueUrl" target="_blank" type="primary">{{ r.issueKey }}</el-link>
              <span v-else>{{ r.issueKey }}</span>
              <span v-if="r.issueSummary" class="muted"> {{ r.issueSummary }}</span>
            </span>
            <span class="grow" />
            <span v-if="r.ahead != null" class="muted">
              {{ r.ahead }} 个提交<template v-if="r.behind">，落后 testing {{ r.behind }} 个</template>
            </span>
            <el-button
              v-if="r.branch && r.projectCode"
              size="small"
              text
              :loading="r._rechecking"
              @click="recheck(i)"
            >
              重新核对
            </el-button>
            <el-link v-if="r.mrUrl" :href="r.mrUrl" target="_blank" type="primary">合并请求</el-link>
            <el-button
              v-if="state(r) === 'OK' || state(r) === 'WARN'"
              size="small"
              type="primary"
              :disabled="!settings?.tokenSet"
              :title="settings?.tokenSet ? '' : '先填 GitLab 令牌'"
              @click="openMerge(i)"
            >
              合并
            </el-button>
          </div>

          <div v-if="!r.projectCode" class="pick">
            <span>选项目：</span>
            <el-select v-model="r._pick" size="small" filterable placeholder="选项目" style="width: 260px">
              <el-option v-for="p in projects" :key="p.code" :value="p.code" :label="p.name || p.code" />
            </el-select>
            <el-input
              v-model="r.branch"
              size="small"
              class="mono"
              placeholder="分支"
              style="width: 220px"
            />
            <el-button size="small" :disabled="!r._pick || !r.branch" :loading="r._rechecking" @click="recheck(i, r._pick)">
              核对
            </el-button>
          </div>

          <ul v-if="r.blockers?.length" class="list block">
            <li v-for="(b, j) in r.blockers" :key="j">{{ b }}</li>
          </ul>
          <ul v-if="pendingFor(r).length && state(r) !== 'ALREADY' && state(r) !== 'MERGED'" class="list block">
            <li>这批里后端还没合进 testing：{{ pendingFor(r).join('、') }}。建议先合后端再合前端 / 客户端。</li>
          </ul>
          <ul v-if="r.warnings?.length && state(r) !== 'MERGED'" class="list warn">
            <li v-for="w in r.warnings" :key="w.code">{{ w.text }}</li>
          </ul>
          <div v-if="r.summary" class="note">{{ r.summary }}</div>
          <div v-if="r._result" class="note" :class="r._result.ok ? 'ok' : 'bad'">{{ r._result.message }}</div>

          <div v-if="r.commits?.length || r.files?.total" class="c-foot">
            <span v-if="r.authors?.length" class="muted">提交人：{{ r.authors.join('、') }}</span>
            <span v-if="r.files" class="muted">
              文件 {{ r.files.total }} 个（新增 {{ r.files.added }} · 修改 {{ r.files.modified }} · 删除 {{ r.files.deleted }}）
            </span>
            <span class="grow" />
            <el-button size="small" text @click="r._open = r._open === 'commits' ? '' : 'commits'">提交</el-button>
            <el-button size="small" text @click="r._open = r._open === 'files' ? '' : 'files'">文件</el-button>
          </div>
          <div v-if="r._open === 'commits'" class="detail">
            <div v-for="c in r.commits" :key="c.sha" class="d-line">
              <span class="mono muted">{{ c.sha }}</span>
              <span class="d-author">{{ c.author }}</span>
              <span>{{ c.subject }}</span>
            </div>
          </div>
          <div v-if="r._open === 'files'" class="detail">
            <div v-for="f in r.files?.list || []" :key="f" class="d-line mono">{{ f }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="mergeVisible" width="620px" append-to-body title="合并到 testing">
      <template v-if="mergeRow">
        <div class="m-what">
          把 <b class="mono">{{ mergeRow.branch }}</b> 合进
          <b class="mono">{{ mergeRow.projectName }}</b> 的 <b class="mono">testing</b>
          <div class="muted mono">核对时的提交 {{ (mergeRow.sha || '').slice(0, 10) }}，分支之后再有新提交会被 GitLab 拒绝</div>
        </div>
        <div v-if="mergeRow.warnings?.length" class="m-acks">
          <div class="m-acks-title">逐条确认后才能合：</div>
          <el-checkbox v-for="w in mergeRow.warnings" :key="w.code" v-model="acks[w.code]" class="m-ack">
            {{ w.text }}
          </el-checkbox>
        </div>
      </template>
      <template #footer>
        <el-button @click="mergeVisible = false">取消</el-button>
        <el-button type="primary" :loading="merging" :disabled="!allAcked" @click="doMerge">确认合并</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="logsVisible" size="760px" title="合进 testing 的记录" append-to-body>
      <el-table :data="logs" size="small" stripe>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ String(row.createdAt || '').replace('T', ' ').slice(0, 16) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="90" />
        <el-table-column prop="projectCode" label="项目" min-width="140" />
        <el-table-column prop="branch" label="分支" min-width="160" show-overflow-tooltip />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <span :class="row.status === 'FAILED' ? 's-block' : 's-ok'">{{ LOG_STATUS[row.status] || row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link v-if="row.mrUrl" :href="row.mrUrl" target="_blank" type="primary">合并请求</el-link>
            {{ row.message }}
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Tickets } from '@element-plus/icons-vue'
import { apiClient } from '../api'

const KIND: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端', CLIENT: '客户端' }
const LOG_STATUS: Record<string, string> = { MERGED: '已合并', MERGED_UNVERIFIED: '已合并', FAILED: '失败' }

const router = useRouter()
const text = ref('')
const rows = ref<any[]>([])
const failed = ref<string[]>([])
const resolving = ref(false)
const checking = ref(false)
const settings = ref<any>(null)
const projects = ref<any[]>([])

function state(r: any) {
  if (r._merged) return 'MERGED'
  if (!r.status) return 'PENDING'
  return r.status
}

function stateText(r: any) {
  const s = state(r)
  if (s === 'WARN') return `要确认 ${r.warnings?.length || 0} 条`
  if (s === 'PENDING') return '待核对'
  return { OK: '可以合', BLOCK: '不能合', ALREADY: '已在 testing', MERGED: '刚合完' }[s] || s
}

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const r of rows.value) c[state(r)] = (c[state(r)] || 0) + 1
  return c
})

function pendingFor(r: any): string[] {
  if (!r.kind || r.kind === 'BACKEND') return []
  return rows.value
    .filter((x) => x.kind === 'BACKEND' && state(x) !== 'ALREADY' && state(x) !== 'MERGED')
    .map((x) => x.projectName || x.projectCode)
    .filter((v, i, a) => a.indexOf(v) === i)
}

async function loadSettings() {
  try {
    settings.value = await apiClient.getTestingMergeSettings()
  } catch (e: any) {
    ElMessage.error(e?.message || '读取设置失败')
  }
}

async function loadProjects() {
  if (projects.value.length) return
  try {
    projects.value = ((await apiClient.getApiProjects({ enabledOnly: true })) as any[]) || []
  } catch {
    projects.value = []
  }
}

function goMasterSettings() {
  router.push('/release-merge')
  ElMessage.info('令牌在「合并到 master」右上角设置里填，两边共用')
}

async function resolve() {
  resolving.value = true
  try {
    const r = await apiClient.resolveTestingMerge({ text: text.value })
    rows.value = r.rows || []
    failed.value = r.failed || []
    if (rows.value.some((x) => !x.projectCode)) await loadProjects()
    ElMessage.success(
      `解析到 ${rows.value.length} 条` + (failed.value.length ? `，${failed.value.length} 个单失败` : '')
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '拉分支失败')
  } finally {
    resolving.value = false
  }
}

async function checkAll() {
  checking.value = true
  try {
    const payload = rows.value.map((r) => ({
      projectCode: r.projectCode,
      branch: r.branch,
      raw: r.raw,
      issueKey: r.issueKey,
      issueSummary: r.issueSummary,
      issueUrl: r.issueUrl,
      rawProject: r.rawProject,
      note: r.note,
      matchHow: r.matchHow
    }))
    const r = await apiClient.checkTestingMerge({ rows: payload })
    const checked = r.rows || []
    rows.value = checked.map((fresh: any, i: number) => ({
      ...fresh,
      issueKey: fresh.issueKey || rows.value[i]?.issueKey,
      issueSummary: fresh.issueSummary || rows.value[i]?.issueSummary,
      issueUrl: fresh.issueUrl || rows.value[i]?.issueUrl,
      rawProject: fresh.rawProject || rows.value[i]?.rawProject
    }))
    if (rows.value.some((x) => !x.projectCode)) await loadProjects()
  } catch (e: any) {
    ElMessage.error(e?.message || '核对失败')
  } finally {
    checking.value = false
  }
}

async function recheck(i: number, pickCode?: string) {
  const old = rows.value[i]
  old._rechecking = true
  try {
    const r = await apiClient.checkTestingMerge({
      rows: [
        {
          projectCode: pickCode || old.projectCode,
          branch: old.branch,
          raw: old.raw,
          issueKey: old.issueKey,
          issueSummary: old.issueSummary,
          issueUrl: old.issueUrl,
          rawProject: old.rawProject,
          note: old.note
        }
      ]
    })
    const fresh = (r.rows || [])[0]
    if (fresh) {
      rows.value.splice(i, 1, {
        ...fresh,
        issueKey: old.issueKey,
        issueSummary: old.issueSummary,
        issueUrl: old.issueUrl,
        rawProject: old.rawProject
      })
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '核对失败')
  } finally {
    old._rechecking = false
  }
}

const mergeVisible = ref(false)
const mergeIndex = ref(-1)
const merging = ref(false)
const acks = reactive<Record<string, boolean>>({})
const mergeRow = computed(() => rows.value[mergeIndex.value])
const allAcked = computed(() => (mergeRow.value?.warnings || []).every((w: any) => acks[w.code]))

function openMerge(i: number) {
  mergeIndex.value = i
  Object.keys(acks).forEach((k) => delete acks[k])
  mergeVisible.value = true
}

async function doMerge() {
  const r = mergeRow.value
  if (!r) return
  merging.value = true
  try {
    const res = await apiClient.mergeTestingBranch({
      projectCode: r.projectCode,
      branch: r.branch,
      sha: r.sha,
      acked: (r.warnings || []).map((w: any) => w.code)
    })
    r._result = res
    if (res.mrUrl) r.mrUrl = res.mrUrl
    if (res.ok) {
      r._merged = true
      ElMessage.success('已合进 testing')
      mergeVisible.value = false
    } else {
      ElMessage.error(res.message || '没合成功')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '合并失败')
  } finally {
    merging.value = false
  }
}

const logsVisible = ref(false)
const logs = ref<any[]>([])

async function openLogs() {
  logsVisible.value = true
  try {
    logs.value = await apiClient.getTestingMergeLogs(100)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取记录失败')
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.tm {
  max-width: 1280px;
}
.tm-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tm-title {
  font-size: 16px;
  font-weight: 600;
}
.grow {
  flex: 1;
}
.mono,
.mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.no-token {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.tip-bar {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  background: var(--el-fill-color-lighter);
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 16px;
  flex-wrap: wrap;
}
.failed {
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--el-color-danger);
}
.summary {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}
.s-ok {
  color: var(--el-color-success);
}
.s-warn {
  color: var(--el-color-warning-dark-2);
}
.s-block {
  color: var(--el-color-danger);
}
.s-done {
  color: var(--el-text-color-secondary);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 3px;
  border-radius: 8px;
  padding: 10px 12px;
}
.card.st-OK {
  border-left-color: var(--el-color-success);
}
.card.st-WARN {
  border-left-color: var(--el-color-warning);
}
.card.st-BLOCK {
  border-left-color: var(--el-color-danger);
}
.card.st-PENDING {
  border-left-color: var(--el-color-info);
}
.card.st-ALREADY,
.card.st-MERGED {
  border-left-color: var(--el-border-color);
  background: var(--el-fill-color-lighter);
}
.c-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tag {
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
}
.t-OK {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}
.t-WARN {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.t-BLOCK {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.t-PENDING {
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
}
.t-ALREADY,
.t-MERGED {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.kind {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.branch {
  color: var(--el-color-primary);
}
.issue {
  font-size: 12px;
}
.pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
.list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}
.list.block {
  color: var(--el-color-danger);
}
.list.warn {
  color: var(--el-color-warning-dark-2);
}
.note {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.note.ok {
  color: var(--el-color-success);
}
.note.bad {
  color: var(--el-color-danger);
}
.c-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.detail {
  margin-top: 6px;
  padding: 8px 10px;
  max-height: 260px;
  overflow: auto;
  border-radius: 6px;
  font-size: 12px;
  background: var(--el-fill-color-lighter);
}
.d-line {
  display: flex;
  gap: 10px;
  line-height: 1.8;
}
.d-author {
  flex: none;
  width: 80px;
  color: var(--el-text-color-secondary);
}
.m-what {
  font-size: 14px;
  line-height: 1.8;
}
.m-acks {
  margin-top: 14px;
}
.m-acks-title {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.m-ack {
  display: flex;
  align-items: flex-start;
  height: auto;
  margin: 0 0 8px;
  white-space: normal;
}
.m-ack :deep(.el-checkbox__label) {
  line-height: 1.6;
  color: var(--el-color-warning-dark-2);
}
.m-ack :deep(.el-checkbox__input) {
  margin-top: 3px;
}
:deep(.el-dialog__footer) {
  display: flex;
  align-items: center;
}
</style>
