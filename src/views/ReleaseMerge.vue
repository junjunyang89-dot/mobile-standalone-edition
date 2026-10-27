<template>
  <div class="rm">
    <el-card shadow="hover">
      <template #header>
        <div class="rm-head">
          <span class="rm-title">合并到 master</span>
          <span class="grow" />
          <el-button size="small" :icon="Tickets" @click="openLogs">合并记录</el-button>
          <el-button size="small" :icon="Setting" @click="openSettings">
            设置<span v-if="settings && !settings.tokenSet" class="dot" />
          </el-button>
        </div>
      </template>

      <div v-if="settings && !settings.tokenSet" class="no-token">
        还没填 GitLab 个人令牌，现在只能核对、不能合并。
        <el-link type="primary" @click="openSettings">去填</el-link>
      </div>

      <el-tabs v-model="mainTab" class="main-tabs">
        <el-tab-pane label="版本迭代" name="version">
      <div class="order">
        <span class="order-label">发版顺序</span>
        <span class="step"><b>1</b>执行 SQL</span>
        <span class="arrow">→</span>
        <span class="step"><b>2</b>发布配置</span>
        <span class="arrow">→</span>
        <span class="step"><b>3</b>发后端</span>
        <span class="arrow">→</span>
        <span class="step"><b>4</b>最后发前端</span>
        <span class="order-tip">顺序反了线上会挂</span>
      </div>

      <div class="wiki-row">
        <el-input
          v-model="wikiUrl"
          clearable
          class="wiki-input"
          placeholder="发版 Wiki 地址，如 https://wiki.shdev.net/pages/viewpage.action?pageId=119730957"
          @keyup.enter="loadFromWiki"
        />
        <el-button type="success" :loading="wikiLoading" :disabled="!wikiUrl.trim()" @click="loadFromWiki">
          从 Wiki 归纳
        </el-button>
      </div>

      <div v-if="board" class="board-progress">
        <span>
          已合并 {{ board.mergedCount ?? 0 }} / {{ board.branchCount ?? 0 }} · 已上线
          {{ board.releasedCount ?? 0 }} / {{ board.branchCount ?? 0 }}
        </span>
        <span class="muted">
          {{ board.projectCount }} 个项目 · {{ board.issueCount }} 条需求 · pageId {{ board.wikiPageId }}
        </span>
      </div>

      <el-table
        v-if="board"
        :data="branchRows"
        border
        stripe
        size="small"
        row-key="_key"
        class="board-table"
        :span-method="projectSpanMethod"
        empty-text="未解析到项目分支"
      >
        <el-table-column label="项目" min-width="140" fixed>
          <template #default="{ row }">
            <div class="project-cell">
              <b>{{ row.project }}</b>
              <el-tag size="small" :type="row.layer === 'frontend' ? 'warning' : 'info'" effect="plain">
                {{ row.layer === 'frontend' ? '前端' : '后端' }}
              </el-tag>
              <div class="muted">{{ row.projectBranchCount }} 分支</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分支" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono branch-name">{{ row.branch }}</span>
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
            <el-button
              size="small"
              :type="row.item.mergedMaster ? 'success' : 'warning'"
              :plain="!row.item.mergedMaster"
              :loading="savingKey === saveKey(row.project, row.branch, 'm')"
              @click="toggleMerged(row.projectRow, row.item)"
            >
              {{ row.item.mergedMaster ? '已合并' : '待合并' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="master 核对" min-width="200">
          <template #default="{ row }">
            <div v-if="row.item.masterCheck?.status" class="check-cell">
              <el-tag
                size="small"
                :type="masterCheckTagType(row.item.masterCheck.status)"
                effect="light"
              >
                {{ masterCheckLabel(row.item.masterCheck.status) }}
              </el-tag>
              <div class="check-msg" :class="'ck-' + row.item.masterCheck.status">
                {{ row.item.masterCheck.message }}
              </div>
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
            <el-button
              size="small"
              :type="row.item.released ? 'success' : 'info'"
              :plain="!row.item.released"
              :loading="savingKey === saveKey(row.project, row.branch, 'r')"
              @click="toggleReleased(row.projectRow, row.item)"
            >
              {{ row.item.released ? '已上线' : '待上线' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-divider content-position="left">代码核对 / 合并</el-divider>
      <el-input
        v-model="text"
        type="textarea"
        :rows="3"
        class="mono"
        :placeholder="'每行一个「项目：分支」，例如\napp-admin：agent/2026-09-24/rating_switch'"
      />
      <div class="actions">
        <el-button v-if="board" :disabled="!boardLines" @click="fillFromBoard">用上方表格填入</el-button>
        <el-button type="primary" :loading="checking" :disabled="!text.trim()" @click="check">核对</el-button>
        <span class="muted">
          核对只读代码，不会合并；在上线目录 <code>{{ settings?.reposDir || '…' }}</code> 里比对
        </span>
      </div>

      <div v-if="rows.length" class="summary">
        <span>共 {{ rows.length }} 个</span>
        <span v-if="counts.OK" class="s-ok">{{ counts.OK }} 个可以合</span>
        <span v-if="counts.WARN" class="s-warn">{{ counts.WARN }} 个要确认</span>
        <span v-if="counts.BLOCK" class="s-block">{{ counts.BLOCK }} 个不能合</span>
        <span v-if="counts.ALREADY" class="s-done">{{ counts.ALREADY }} 个已在 master</span>
        <span v-if="counts.MERGED" class="s-done">{{ counts.MERGED }} 个刚合完</span>
      </div>

      <div class="cards">
        <div v-for="(r, i) in rows" :key="i" class="card" :class="'st-' + state(r)">
          <div class="c-head">
            <span class="tag" :class="'t-' + state(r)">{{ stateText(r) }}</span>
            <b class="mono">{{ r.projectName || r.rawProject || '没认出项目' }}</b>
            <span v-if="r.kind" class="kind">{{ KIND[r.kind] || r.kind }}</span>
            <span class="mono branch">{{ r.branch || '—' }}</span>
            <span v-if="r.target" class="muted">→ {{ r.target }}</span>
            <span class="grow" />
            <span v-if="r.ahead != null" class="muted">{{ r.ahead }} 个提交<template v-if="r.behind">，落后 master {{ r.behind }} 个</template></span>
            <el-button v-if="r.branch && r.projectCode" size="small" text :loading="r._rechecking" @click="recheck(i)">重新核对</el-button>
            <el-link v-if="r.mrUrl" :href="r.mrUrl" target="_blank" type="primary">合并请求</el-link>
            <el-button
              v-if="state(r) === 'OK' || state(r) === 'WARN'"
              size="small"
              type="primary"
              :disabled="!settings?.tokenSet"
              :title="settings?.tokenSet ? '' : '先在设置里填 GitLab 令牌'"
              @click="openMerge(i)"
            >合并</el-button>
          </div>

          <div v-if="!r.projectCode && r.branch" class="pick">
            <span>选项目：</span>
            <el-select v-model="r._pick" size="small" filterable placeholder="选项目" style="width: 260px">
              <el-option v-for="p in projects" :key="p.code" :value="p.code" :label="p.name || p.code" />
            </el-select>
            <el-button size="small" :disabled="!r._pick" :loading="r._rechecking" @click="recheck(i, r._pick)">核对</el-button>
          </div>

          <ul v-if="r.blockers?.length" class="list block">
            <li v-for="(b, j) in r.blockers" :key="j">{{ b }}</li>
          </ul>
          <ul v-if="pendingFor(r).length && state(r) !== 'ALREADY' && state(r) !== 'MERGED'" class="list block">
            <li>这批里后端还没合完：{{ pendingFor(r).join('、') }}。前端最后合、最后发。</li>
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
        </el-tab-pane>

        <el-tab-pane label="每日发版" name="daily">
          <div class="daily-head">
            <div class="daily-date">
              发版日期
              <b>{{ dailyDateLabel }}</b>
              <el-tag size="small" type="warning" effect="plain">当日发版</el-tag>
            </div>
            <span class="muted">已合并超过 5 分钟仍未上线会弹窗提醒</span>
          </div>

          <el-input
            v-model="dailyText"
            type="textarea"
            :rows="5"
            class="mono"
            :placeholder="'每行一个「项目：分支」，例如\napp-admin：agent/2026-09-24/rating_switch\napp-swift：rjy/APP-9066/9-17/noviceStrategy'"
          />
          <div class="actions">
            <el-button v-if="board" :disabled="!boardLines" @click="fillDailyFromBoard">从版本迭代填入</el-button>
            <el-button type="primary" :loading="dailyLoading" :disabled="!dailyText.trim()" @click="loadDaily">
              生成校对表
            </el-button>
          </div>

          <el-table
            v-if="dailyRows.length"
            :data="dailyRows"
            border
            stripe
            size="small"
            class="board-table daily-table"
            empty-text="先粘贴项目：分支并生成校对表"
          >
            <el-table-column label="项目" min-width="120" prop="project" />
            <el-table-column label="分支" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="mono branch-name">{{ row.branch }}</span>
              </template>
            </el-table-column>
            <el-table-column label="合并" width="110" align="center">
              <template #default="{ row }">
                <el-button
                  size="small"
                  :type="row.mergedMaster ? 'success' : 'warning'"
                  :plain="!row.mergedMaster"
                  :loading="savingKey === saveKey(row.project, row.branch, 'dm')"
                  @click="toggleDailyMerged(row)"
                >
                  {{ row.mergedMaster ? '已合并' : '待合并' }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="Jenkins构建编号" min-width="180">
              <template #default="{ row }">
                <template v-if="row.jenkins?.lastSuccessNumber != null">
                  <el-tag size="small" :type="jenkinsTagType(row.jenkins)" effect="light">
                    {{ row.jenkins.summary || '打包成功' }}
                  </el-tag>
                  <div class="jenkins-num">
                    <b>#{{ row.jenkins.lastSuccessNumber }}</b>
                    <span v-if="row.jenkins.lastSuccessTime" class="muted">
                      · {{ row.jenkins.lastSuccessTime }}
                    </span>
                  </div>
                </template>
                <span v-else class="muted">{{ row.jenkins?.summary || row.jenkins?.error || '未配置 / 拉取中' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="上线" width="110" align="center">
              <template #default="{ row }">
                <el-button
                  size="small"
                  :type="row.released ? 'success' : 'info'"
                  :plain="!row.released"
                  :loading="savingKey === saveKey(row.project, row.branch, 'dr')"
                  @click="toggleDailyReleased(row)"
                >
                  {{ row.released ? '已上线' : '待上线' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="mergeVisible" width="620px" append-to-body title="合并到 master">
      <template v-if="mergeRow">
        <div class="m-what">
          把 <b class="mono">{{ mergeRow.branch }}</b> 合进
          <b class="mono">{{ mergeRow.projectName }}</b> 的 <b class="mono">{{ mergeRow.target }}</b>
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

    <el-dialog v-model="settingsVisible" width="600px" append-to-body title="合并设置">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="GitLab 令牌">
          <el-input
            v-model="form.token"
            type="password"
            show-password
            autocomplete="off"
            :placeholder="settings?.tokenSet ? '已填，留空不改' : 'GitLab 头像 → Preferences → Access Tokens，勾 api'"
          />
          <div class="hint">
            每个人填自己的，合并记录在 GitLab 上就是你的名字；平台不回显令牌。
            <el-link v-if="settings?.tokenSet" type="danger" @click="clearToken">清除令牌</el-link>
          </div>
        </el-form-item>
        <el-form-item label="GitLab 地址">
          <el-input v-model="form.gitlabBaseUrl" placeholder="留空 = 按项目的仓库地址自动算" />
        </el-form-item>
        <el-form-item label="上线目录">
          <el-input v-model="form.reposDir" class="mono" :placeholder="settings?.defaultReposDir" />
          <div class="hint">只放 master，不能和接口对比分析的代码目录重叠；没拉过的项目第一次核对时自动拉。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :loading="testing" :disabled="!settings?.tokenSet" @click="testToken">测试令牌</el-button>
        <span class="grow" />
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="logsVisible" size="760px" title="合并记录" append-to-body>
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
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { Setting, Tickets } from '@element-plus/icons-vue'
import { apiClient } from '../api'

const KIND: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端', CLIENT: '客户端' }
const LOG_STATUS: Record<string, string> = { MERGED: '已合并', MERGED_UNVERIFIED: '已合并', FAILED: '失败' }
const WIKI_KEY = 'release-go-live-wiki-url'
const DAILY_TEXT_KEY = 'release-daily-text:'
const REMIND_MS = 5 * 60 * 1000

const text = ref('')
const wikiUrl = ref(localStorage.getItem(WIKI_KEY) || '')
const wikiLoading = ref(false)
const board = ref<any>(null)
const savingKey = ref('')
const rows = ref<any[]>([])
const checking = ref(false)
const settings = ref<any>(null)
const projects = ref<any[]>([])

const dailyDate = ref(todayStr())
const dailyText = ref('')
const dailyRows = ref<any[]>([])
const dailyPageId = ref('')
const dailyLoading = ref(false)
const mainTab = ref<'version' | 'daily'>('version')
const remindedKeys = new Set<string>()
let remindTimer: number | undefined

const dailyDateLabel = computed(() => {
  const d = dailyDate.value
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`
})

function todayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isPlaceholderBranch(b: string) {
  return !b || b.includes('见需求备注') || b === '-' || b === '无'
}

function saveKey(project: string, branch: string, kind: 'm' | 'r' | 'v' | 'dm' | 'dr') {
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

function ensureBranchItems(p: any) {
  if (p.branchItems?.length) return
  p.branchItems = (p.branches || []).map((b: string) => ({
    branch: b,
    mergedMaster: !!p.mergedMaster,
    released: !!p.released
  }))
}

function recomputeBoardCounts() {
  if (!board.value) return
  let branchTotal = 0
  let merged = 0
  let released = 0
  for (const p of board.value.projects || []) {
    ensureBranchItems(p)
    for (const bi of p.branchItems) {
      if (isPlaceholderBranch(bi.branch)) continue
      branchTotal++
      if (bi.mergedMaster) merged++
      if (bi.released) released++
    }
  }
  board.value.branchCount = branchTotal
  board.value.mergedCount = merged
  board.value.releasedCount = released
}

/** 每个分支一行，项目列用 span 合并 */
const branchRows = computed(() => {
  const out: any[] = []
  if (!board.value) return out
  for (const p of board.value.projects || []) {
    ensureBranchItems(p)
    const real = (p.branchItems || []).filter((bi: any) => !isPlaceholderBranch(bi.branch))
    real.forEach((bi: any, idx: number) => {
      out.push({
        _key: `${p.project}::${bi.branch}`,
        project: p.project,
        layer: p.layer,
        projectBranchCount: real.length,
        projectRow: p,
        jenkins: p.jenkins || null,
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

const boardLines = computed(() =>
  branchRows.value.map((r) => `${r.project}: ${r.branch}`).join('\n')
)

/** 后端 Wiki 行绑定优先；否则用分支名里的 APP-xxx 对项目需求兜底 */
function matchIssuesForBranch(bi: any, projectIssues: any[]) {
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

/** 从发版 Wiki 拉表 → 按项目展示分支，每条可点待合并 / 待上线 */
async function loadFromWiki() {
  const url = wikiUrl.value.trim()
  if (!url) {
    ElMessage.warning('请先粘贴发版 Wiki 地址')
    return
  }
  wikiLoading.value = true
  try {
    const data = await apiClient.getReleaseGoLiveBoard(url)
    localStorage.setItem(WIKI_KEY, url)
    for (const p of data.projects || []) ensureBranchItems(p)
    board.value = data
    recomputeBoardCounts()
    if (!(data.branchCount > 0 || boardLines.value)) {
      ElMessage.warning('Wiki 里没解析到「项目：分支」，请确认上线分支列格式')
      return
    }
    ElMessage.success(
      `已归纳 ${data.projectCount} 个项目 · ${data.branchCount ?? 0} 条分支`
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '从 Wiki 归纳失败')
  } finally {
    wikiLoading.value = false
  }
}

function fillFromBoard() {
  if (!boardLines.value) return
  text.value = boardLines.value
}

function fillDailyFromBoard() {
  if (!boardLines.value) return
  dailyText.value = boardLines.value
}

async function loadDaily() {
  const body = dailyText.value.trim()
  if (!body) {
    ElMessage.warning('请先粘贴项目：分支')
    return
  }
  dailyDate.value = todayStr()
  dailyLoading.value = true
  try {
    const data = await apiClient.releaseGoLiveDaily({ date: dailyDate.value, text: body })
    dailyPageId.value = data.wikiPageId
    dailyRows.value = (data.rows || []).map((r: any) => ({ ...r, _reminded: false }))
    localStorage.setItem(DAILY_TEXT_KEY + dailyDate.value, body)
    remindedKeys.clear()
    ElMessage.success(`已生成 ${dailyDateLabel.value} 校对表 · ${data.rowCount} 条`)
    checkOverdueReminders()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成校对表失败')
  } finally {
    dailyLoading.value = false
  }
}

async function toggleDailyMerged(row: any) {
  if (!dailyPageId.value) return
  const next = !row.mergedMaster
  const prev = row.mergedMaster
  const prevAt = row.mergedAt
  row.mergedMaster = next
  if (!next) row.mergedAt = null
  savingKey.value = saveKey(row.project, row.branch, 'dm')
  try {
    const res = await apiClient.saveReleaseGoLiveState({
      wikiPageId: dailyPageId.value,
      project: row.project,
      branch: row.branch,
      mergedMaster: next
    })
    row.mergedAt = res?.mergedAt || (next ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null)
    if (res?.masterCheck) row.masterCheck = res.masterCheck
    if (next && res?.masterCheck?.status === 'NOT_IN_MASTER') {
      ElMessage.warning(res.masterCheck.message || '还没进 master')
    } else if (next && res?.masterCheck?.status === 'IN_MASTER') {
      ElMessage.success('已确认在 master')
    }
    checkOverdueReminders()
  } catch (e: any) {
    row.mergedMaster = prev
    row.mergedAt = prevAt
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

async function toggleDailyReleased(row: any) {
  if (!dailyPageId.value) return
  const next = !row.released
  const prev = row.released
  row.released = next
  savingKey.value = saveKey(row.project, row.branch, 'dr')
  try {
    await apiClient.saveReleaseGoLiveState({
      wikiPageId: dailyPageId.value,
      project: row.project,
      branch: row.branch,
      released: next
    })
    if (next) remindedKeys.delete(`${row.project}|${row.branch}`)
  } catch (e: any) {
    row.released = prev
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

function parseMergedAt(s: string) {
  if (!s) return null
  const t = Date.parse(String(s).replace(' ', 'T') + '+08:00')
  return Number.isNaN(t) ? Date.parse(String(s).replace(' ', 'T')) : t
}

function checkOverdueReminders() {
  if (dailyDate.value !== todayStr()) return
  const now = Date.now()
  for (const row of dailyRows.value) {
    if (!row.mergedMaster || row.released || !row.mergedAt) continue
    const t = parseMergedAt(row.mergedAt)
    if (!t || now - t < REMIND_MS) continue
    const key = `${row.project}|${row.branch}`
    if (remindedKeys.has(key)) continue
    remindedKeys.add(key)
    ElNotification({
      type: 'warning',
      title: `发版提醒 · ${dailyDateLabel.value}`,
      message: `${row.project} / ${row.branch} 已合并超过 5 分钟仍未上线，请尽快上线`,
      duration: 0,
      position: 'top-right'
    })
  }
}

async function toggleMerged(row: any, item: any) {
  if (!board.value?.wikiPageId || isPlaceholderBranch(item.branch)) return
  const next = !item.mergedMaster
  const prev = item.mergedMaster
  const prevCheck = item.masterCheck
  item.mergedMaster = next
  if (!next) item.masterCheck = null
  recomputeBoardCounts()
  savingKey.value = saveKey(row.project, item.branch, 'm')
  try {
    const res = await apiClient.saveReleaseGoLiveState({
      wikiPageId: board.value.wikiPageId,
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
    recomputeBoardCounts()
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

async function reverifyMaster(row: any, item: any) {
  if (!board.value?.wikiPageId || isPlaceholderBranch(item.branch)) return
  savingKey.value = saveKey(row.project, item.branch, 'v')
  try {
    const res = await apiClient.verifyReleaseGoLiveMaster({
      wikiPageId: board.value.wikiPageId,
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

async function toggleReleased(row: any, item: any) {
  if (!board.value?.wikiPageId || isPlaceholderBranch(item.branch)) return
  const next = !item.released
  const prev = item.released
  item.released = next
  recomputeBoardCounts()
  savingKey.value = saveKey(row.project, item.branch, 'r')
  try {
    await apiClient.saveReleaseGoLiveState({
      wikiPageId: board.value.wikiPageId,
      project: row.project,
      branch: item.branch,
      released: next
    })
  } catch (e: any) {
    item.released = prev
    recomputeBoardCounts()
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingKey.value = ''
  }
}

function state(r: any) {
  return r._merged ? 'MERGED' : r.status || 'BLOCK'
}

function stateText(r: any) {
  const s = state(r)
  if (s === 'WARN') return `要确认 ${r.warnings?.length || 0} 条`
  return { OK: '可以合', BLOCK: '不能合', ALREADY: '已在 master', MERGED: '刚合完' }[s] || s
}

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const r of rows.value) c[state(r)] = (c[state(r)] || 0) + 1
  return c
})

/** 这批里还没合进 master 的后端；只对前端 / 客户端行有意义 */
function pendingFor(r: any): string[] {
  if (!r.kind || r.kind === 'BACKEND') return []
  return rows.value
    .filter((x) => x.kind === 'BACKEND' && state(x) !== 'ALREADY' && state(x) !== 'MERGED')
    .map((x) => x.projectName || x.projectCode)
    .filter((v, i, a) => a.indexOf(v) === i)
}

async function loadSettings() {
  try {
    settings.value = await apiClient.getReleaseMergeSettings()
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

async function check() {
  checking.value = true
  try {
    const r = await apiClient.checkReleaseMerge({ text: text.value })
    rows.value = r.rows || []
    if (rows.value.some((x) => !x.projectCode)) loadProjects()
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
    const r = await apiClient.checkReleaseMerge({
      rows: [{ projectCode: pickCode || old.projectCode, branch: old.branch, raw: old.raw }]
    })
    const fresh = (r.rows || [])[0]
    if (fresh) rows.value.splice(i, 1, { ...fresh, rawProject: old.rawProject })
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
    const res = await apiClient.mergeReleaseBranch({
      projectCode: r.projectCode,
      branch: r.branch,
      sha: r.sha,
      acked: (r.warnings || []).map((w: any) => w.code)
    })
    r._result = res
    if (res.mrUrl) r.mrUrl = res.mrUrl
    if (res.ok) {
      r._merged = true
      ElMessage.success('已合并')
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

const settingsVisible = ref(false)
const saving = ref(false)
const testing = ref(false)
const form = reactive({ token: '', gitlabBaseUrl: '', reposDir: '' })

async function openSettings() {
  await loadSettings()
  form.token = ''
  form.gitlabBaseUrl = settings.value?.gitlabBaseUrl || ''
  form.reposDir = settings.value?.reposDir === settings.value?.defaultReposDir ? '' : settings.value?.reposDir || ''
  settingsVisible.value = true
}

async function saveSettings() {
  saving.value = true
  try {
    settings.value = await apiClient.saveReleaseMergeSettings({
      token: form.token || undefined,
      gitlabBaseUrl: form.gitlabBaseUrl,
      reposDir: form.reposDir
    })
    form.token = ''
    ElMessage.success('已保存')
    settingsVisible.value = false
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function testToken() {
  testing.value = true
  try {
    const r = await apiClient.testReleaseMergeToken()
    ElMessage.success(`令牌可用：${r.user}（${r.gitlab}）`)
  } catch (e: any) {
    ElMessage.error(e?.message || '令牌不可用')
  } finally {
    testing.value = false
  }
}

async function clearToken() {
  try {
    await ElMessageBox.confirm('清除后就不能在平台上合并了，确定？', '清除令牌', { type: 'warning' })
  } catch {
    return
  }
  settings.value = await apiClient.saveReleaseMergeSettings({ clearToken: true })
  ElMessage.success('已清除')
}

const logsVisible = ref(false)
const logs = ref<any[]>([])

async function openLogs() {
  logsVisible.value = true
  try {
    logs.value = await apiClient.getReleaseMergeLogs(100)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取记录失败')
  }
}

onMounted(() => {
  loadSettings()
  dailyDate.value = todayStr()
  const saved = localStorage.getItem(DAILY_TEXT_KEY + dailyDate.value)
  if (saved) dailyText.value = saved
  remindTimer = window.setInterval(checkOverdueReminders, 30000)
})

onUnmounted(() => {
  if (remindTimer) window.clearInterval(remindTimer)
})
</script>

<style scoped>
.rm {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}
.rm :deep(.el-card) {
  width: 100%;
}
.rm-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rm-title {
  font-size: 16px;
  font-weight: 600;
}
.main-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}
.main-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 600;
}
.daily-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.daily-date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}
.daily-date b {
  font-size: 18px;
  color: var(--el-color-warning-dark-2);
}
.daily-table {
  margin-top: 10px;
}
.wiki-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.wiki-input {
  flex: 1;
  min-width: 320px;
}
.board-progress {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.board-table {
  width: 100%;
  margin-bottom: 8px;
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
.jenkins-link {
  text-decoration: none;
}
.jenkins-num {
  font-size: 13px;
}
.jenkins-num b {
  font-size: 15px;
  color: var(--el-color-success-dark-2);
}
.branch-name {
  font-size: 12px;
  word-break: break-all;
}
.issue-block {
  margin: 2px 0 6px;
  line-height: 1.4;
  word-break: break-all;
}
.issue-block:last-child {
  margin-bottom: 2px;
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
.check-msg.ck-IN_MASTER {
  color: var(--el-color-success);
}
.check-msg.ck-NOT_IN_MASTER {
  color: var(--el-color-danger);
}
.check-msg.ck-ERROR {
  color: var(--el-color-warning-dark-2);
}
.grow {
  flex: 1;
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--el-color-danger);
  vertical-align: top;
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
.order {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.order-label {
  color: var(--el-text-color-secondary);
}
.step b {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 4px;
  border-radius: 50%;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: #fff;
  background: var(--el-color-primary);
}
.arrow {
  color: var(--el-text-color-placeholder);
}
.order-tip {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 16px;
}
.summary {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  font-size: 13px;
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
.pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
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
.hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
:deep(.el-dialog__footer) {
  display: flex;
  align-items: center;
}
</style>
