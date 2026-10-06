<template>
  <div class="acv2">
    <!-- 批次条：当前批次 + 概况 + 批量操作，一行 -->
    <div class="bar">
      <el-select v-model="batchId" class="bar-select" filterable clearable placeholder="选择历史批次"
                 popper-class="acv2-batch-suggest" @change="onBatchPick" @visible-change="(v: boolean) => v && loadBatches()">
        <el-option v-for="b in batches" :key="b.id" :value="b.id" :label="`#${b.id} ${b.version}`">
          <div class="bs-item">
            <span class="bs-name">#{{ b.id }} {{ b.version }}</span>
            <span class="bs-sub">{{ b.ticketCount }} 单 · {{ shortTime(b.updatedAt || b.createdAt) }} · {{ SOURCE_TEXT[b.source] || b.source }}</span>
          </div>
        </el-option>
      </el-select>
      <template v-if="batch">
        <span class="stat">{{ batch.tickets.length }} 单</span>
        <span class="stat" :title="`后端 ${stats.backend} 个`">{{ stats.projects }} 项目</span>
        <span class="stat" :class="{ warn: stats.unmatched }">{{ stats.unmatched }} 没认出</span>
        <span class="stat">{{ stats.analyzed }}/{{ stats.needAnalyze }} 已分析</span>
        <span v-if="stats.high" class="stat bad">{{ stats.high }} 高风险</span>
        <span class="grow" />
        <el-checkbox v-model="force" size="small">已分析的也重跑</el-checkbox>
        <el-button v-if="!running" size="small" type="primary" :disabled="!stats.needAnalyze" @click="analyzeAll">全部分析</el-button>
        <el-button v-else size="small" type="warning" @click="stopFlag = true">停止</el-button>
        <el-button size="small" :loading="collecting" @click="createCollections">创建分支用例</el-button>
        <el-dropdown trigger="click" @command="onMore">
          <el-button size="small" class="more-btn">···</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="batch.source !== 'LOCAL'" command="confirm" :icon="Edit">核对项目 / 分支 / 基线</el-dropdown-item>
              <el-dropdown-item command="delete" :icon="Delete" class="danger-item">删除批次</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <span v-else class="muted bar-empty">还没打开批次：在下面导入一个，或从左边选历史批次</span>
      <div v-if="running || progress.total" class="progress">
        <el-progress :percentage="progress.total ? Math.round((progress.done / progress.total) * 100) : 0"
                     :stroke-width="8" :status="running ? undefined : 'success'" />
        <span class="progress-text">{{ running ? `正在分析 ${progress.current}（${progress.done}/${progress.total}）` : `分析完成 ${progress.done}/${progress.total}` }}</span>
      </div>
    </div>

    <div class="imp">
      <div class="imp-body">
        <div class="create-row">
          <button v-for="s in SOURCES" :key="s.key" type="button" class="src-btn" :class="{ on: source === s.key }" @click="source = s.key">
            {{ s.label }}
          </button>
          <span class="grow" />
          <el-button v-if="source === 'LOCAL'" type="primary" :loading="creating" :disabled="!localReady" @click="createLocal">开始分析</el-button>
          <el-button v-else type="primary" :loading="creating" :disabled="!createReady" @click="createBatch">{{ CREATE_TEXT[source] }}</el-button>
        </div>
        <div v-if="source === 'WIKI'" class="ver-wrap">
          <el-autocomplete
            v-model="version"
            style="width: 100%"
            placeholder="版本，如 10.9 国内H5（Wiki 上发版页的版本名）"
            clearable
            value-key="version"
            popper-class="acv2-batch-suggest"
            :fetch-suggestions="suggestBatches"
            @select="onBatchSuggest"
          >
            <template #default="{ item }">
              <div class="bs-item">
                <span class="bs-name">#{{ item.id }} {{ item.version }}</span>
                <span class="bs-sub">{{ item.ticketCount }} 单 · {{ shortTime(item.updatedAt || item.createdAt) }} · {{ SOURCE_TEXT[item.source] || item.source }}</span>
              </div>
            </template>
          </el-autocomplete>
        </div>
        <el-input v-if="source === 'JIRA'" v-model="issuesText" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }"
                  class="paste mono" />
        <div v-if="source === 'LOCAL'" class="local-box">
          <div class="local-meta">
            <el-input v-model="localKey" class="key-input" placeholder="单号（选填），如 APP-9078" clearable />
            <el-input v-model="localSummary" class="sum-input" placeholder="标题（选填）" clearable />
          </div>
        <table class="edit-table">
          <thead>
            <tr>
              <th style="width: 220px">项目（前端 / 后端 / 客户端都行）</th>
              <th>基线目录</th>
              <th style="width: 130px">基线分支</th>
              <th>待测目录</th>
              <th style="width: 170px">分支名（选填）</th>
              <th style="width: 64px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in localRows" :key="i">
              <td>
                <el-select v-model="r.projectCode" size="small" filterable placeholder="选项目" style="width: 100%"
                           @change="loadDirs(r.projectCode)" @visible-change="(v: boolean) => v && loadBackendGroups()">
                  <el-option-group v-for="g in backendGroups" :key="g.key" :label="g.label">
                    <el-option v-for="p in g.projects" :key="p.code" :value="p.code" :label="p.name || p.code">
                      <span>{{ p.name || p.code }}</span>
                      <span class="opt-sub">{{ KIND_TEXT[p.kind] || '后端' }}</span>
                    </el-option>
                  </el-option-group>
                </el-select>
              </td>
              <td>
                <el-select v-model="r.baseDir" size="small" filterable allow-create default-first-option class="mono"
                           style="width: 100%" placeholder="选已保存的目录，或直接粘路径">
                  <el-option v-for="d in dirsOf(r.projectCode)" :key="'b' + d.id" :value="d.dirPath"
                             :label="d.label + (d.isBaseline ? '（基线）' : '')">
                    <span>{{ d.label }}{{ d.isBaseline ? '（基线）' : '' }}</span>
                    <span class="opt-sub">{{ d.dirPath }}</span>
                  </el-option>
                </el-select>
              </td>
              <td><el-input v-model="r.baseBranch" size="small" class="mono" placeholder="master" /></td>
              <td>
                <el-select v-model="r.headDir" size="small" filterable allow-create default-first-option class="mono"
                           style="width: 100%" placeholder="本次提测那份代码">
                  <el-option v-for="d in dirsOf(r.projectCode)" :key="'h' + d.id" :value="d.dirPath" :label="d.label">
                    <span>{{ d.label }}</span>
                    <span class="opt-sub">{{ d.dirPath }}</span>
                  </el-option>
                </el-select>
              </td>
              <td><el-input v-model="r.branch" size="small" class="mono" placeholder="如 dyl/20260903/yd" /></td>
              <td class="row-ops">
                <el-button link type="primary" :icon="Plus" title="再加一个项目" @click="localRows.splice(i + 1, 0, blankLocalRow())" />
                <el-button link type="danger" :icon="Delete" :disabled="localRows.length === 1" @click="localRows.splice(i, 1)" />
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- 拉完单子先人工核对：每个项目一行，项目 / 分支 / 基线都能改 -->
    <div v-if="batch && confirmOpen" class="cfm">
      <div class="cfm-head">
        <b>核对项目和分支</b>
        <span class="muted">从单子里读出 {{ cfmCount }} 个项目，认错的直接改；基线不填 = 项目设置里的默认分支</span>
        <span v-if="cfmIssues" class="cfm-warn">{{ cfmIssues }} 处要看一下</span>
      </div>
      <table class="cfm-table">
        <thead>
          <tr>
            <th style="width: 118px">单号</th>
            <th style="width: 150px">单子上写的</th>
            <th style="width: 220px">项目</th>
            <th>待测分支</th>
            <th style="width: 190px">基线（和谁比）</th>
            <th style="width: 150px">说明</th>
            <th style="width: 32px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in cfmRows" :key="i" :class="{ first: cfmFirst(i), bad: !!cfmProblem(r) }">
            <td>
              <template v-if="cfmFirst(i)">
                <div class="cfm-key" :title="ticketSummary(r.key)">{{ r.key }}</div>
                <button type="button" class="cfm-add" @click="cfmAdd(r.key)">+ 加项目</button>
              </template>
            </td>
            <td class="cfm-raw">{{ r.fresh ? '手动加的' : r.rawProject || '—' }}</td>
            <td>
              <el-select v-model="r.projectCode" size="small" filterable clearable placeholder="选项目" style="width: 100%">
                <el-option v-for="p in allProjects" :key="p.code" :value="p.code" :label="p.name || p.code">
                  <span>{{ p.name || p.code }}</span>
                  <span class="opt-sub">{{ KIND_TEXT[p.kind] || '后端' }}</span>
                </el-option>
              </el-select>
            </td>
            <td><el-input v-model="r.branch" size="small" class="mono" placeholder="如 dyl/20260903/yd" /></td>
            <td><el-input v-model="r.baseBranch" size="small" class="mono" :placeholder="'默认 ' + defaultBase(r.projectCode)" clearable /></td>
            <td class="cfm-note" :class="cfmProblem(r) ? 'is-bad' : cfmNote(r).warn ? 'is-warn' : ''">
              {{ cfmProblem(r) || cfmNote(r).text }}
            </td>
            <td>
              <el-button v-if="!(r.fresh && !r.projectCode && cfmOnly(r.key))" link type="danger" :icon="Delete" @click="cfmRemove(i)" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="cfm-foot">
        <span class="grow" />
        <el-button size="small" @click="confirmOpen = false">先不改</el-button>
        <el-button size="small" :loading="cfmSaving" @click="saveConfirm(false)">只保存</el-button>
        <el-button size="small" type="primary" :loading="cfmSaving" :disabled="running" @click="saveConfirm(true)">确认，开始分析</el-button>
      </div>
    </div>

    <div v-if="batch" class="body">
      <div class="list">
        <div class="list-filter">
          <el-radio-group v-model="filter" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="multi">多项目</el-radio-button>
            <el-radio-button label="unmatched">没认出</el-radio-button>
            <el-radio-button label="todo">未分析</el-radio-button>
          </el-radio-group>
        </div>
        <div v-for="t in filteredTickets" :key="t.key" class="t-item" :class="{ active: t.key === selectedKey }"
             @click="select(t.key)">
          <div class="t-head">
            <a v-if="t.url" :href="t.url" target="_blank" rel="noopener" class="t-key" @click.stop>{{ t.key }}</a>
            <span v-else class="t-key">{{ t.key }}</span>
            <span v-if="t.status" class="t-status">{{ t.status }}</span>
            <span v-if="busyKey === t.key" class="t-busy">分析中…</span>
            <span v-else-if="t.assessment?.riskLevel" class="t-risk" :class="'rk-' + t.assessment.riskLevel">
              {{ RISK_LABEL[t.assessment.riskLevel] }}风险
            </span>
          </div>
          <div v-if="t.summary && t.summary !== '本地目录对比'" class="t-sum">{{ t.summary }}</div>
          <div class="t-chips">
            <span v-for="(x, i) in t.targets" :key="i" class="chip" :class="chipClass(x)" :title="chipTitle(x)">
              {{ x.projectName || x.projectCode || x.rawProject }}<em v-if="x.branch">{{ x.branch }}</em>
            </span>
            <span v-if="!t.targets.length" class="chip none">没认出项目分支</span>
          </div>
        </div>
        <el-empty v-if="!filteredTickets.length" description="没有符合条件的单" :image-size="60" />
      </div>

      <div class="detail">
        <el-empty v-if="!current" description="左边选一个单" />
        <template v-else>
          <TestGuide :batch="batch" :ticket="current" @update="applyBatch" @reload="reloadBatch">
            <template #actions>
              <el-button size="small" @click="openEdit">修正项目 / 分支</el-button>
              <el-button v-if="batch.source === 'WIKI' || batch.source === 'JIRA'" size="small" :loading="refreshing" @click="refreshTicket">重新拉 JIRA</el-button>
              <el-button size="small" type="primary" :loading="busyKey === current.key"
                         :disabled="running || !current.targets.some(canAnalyze)" @click="analyzeOne(current.key)">
                分析这一单
              </el-button>
            </template>
          </TestGuide>
        </template>
      </div>
    </div>

    <el-dialog v-model="editVisible" width="960px" append-to-body class="edit-dlg">
      <template #header>
        <div class="ed-title">
          <b>修正项目 / 分支</b>
          <span class="ed-key mono">{{ editKey }}</span>
        </div>
      </template>
      <div class="ed-rows">
        <div v-for="(r, i) in editRows" :key="i" class="ed-card">
          <div class="ed-head">
            <span class="ed-label">项目</span>
            <el-select v-model="r.projectCode" size="small" filterable clearable class="ed-project"
                       :class="{ auto: !r.projectCode && r.autoName, empty: !r.projectCode && !r.autoName }"
                       :style="{ width: projWidth(r) }" :fit-input-width="false"
                       :placeholder="r.autoName || '点这里选项目'">
              <el-option v-for="p in allProjects" :key="p.code" :value="p.code" :label="p.name || p.code">
                <span>{{ p.name || p.code }}</span>
                <span class="opt-sub">{{ KIND_TEXT[p.kind] || '后端' }}</span>
              </el-option>
            </el-select>
            <span v-if="r.projectCode || r.autoCode" class="ed-kind">{{ projKind(r.projectCode || r.autoCode) }}</span>
            <span v-if="r.rawProject && r.rawProject !== (r.projectCode || r.autoCode)" class="ed-raw" :title="'JIRA 备注里写的是 ' + r.rawProject">
              备注写的：{{ r.rawProject }}
            </span>
            <span class="grow" />
            <span class="ed-tag" :class="rowTag(r).cls">{{ rowTag(r).text }}</span>
            <el-button size="small" :icon="Delete" class="ed-del" @click="editRows.splice(i, 1)">删除这行</el-button>
          </div>
          <div class="ed-grid">
            <label>
              <span>基线目录</span>
              <el-input v-model="r.baseDir" class="mono" placeholder="留空 = 按分支从仓库取" />
            </label>
            <label>
              <span>基线分支</span>
              <el-input v-model="r.baseBranch" class="mono" :placeholder="defaultBase(r.projectCode || r.autoCode)" clearable />
            </label>
            <label>
              <span>待测目录</span>
              <el-input v-model="r.headDir" class="mono" placeholder="留空 = 按分支从仓库取" />
            </label>
            <label>
              <span>待测分支</span>
              <el-input v-model="r.branch" class="mono" placeholder="分支名" />
            </label>
          </div>
        </div>
      </div>
      <el-button :icon="Plus" class="ed-add" @click="editRows.push(blankRow())">加一行</el-button>
      <template #footer>
        <div class="ed-foot">
          <span class="muted">{{ editRows.length }} 行 · 没填两个目录时，待测分支必填</span>
          <span class="grow" />
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingTargets" @click="saveTargets">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import TestGuide from '../components/api-change/TestGuide.vue'
import { RISK_LABEL } from '../utils/assessmentMarkdown'

const HOW: Record<string, string> = { ALIAS: '别名', FUZZY: '按近似名认的', CLIENT: '客户端', MANUAL: '人工指定', BRANCH: '按分支找到' }
const KIND_TEXT: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端', CLIENT: '客户端' }
const SOURCE_TEXT: Record<string, string> = { JIRA: 'JIRA', WIKI: 'Wiki', MANUAL: '粘贴', LOCAL: '本地目录' }
const CREATE_TEXT: Record<string, string> = { JIRA: '拉单子', WIKI: '拉取这个版本的单子' }
const SOURCES: Array<{ key: 'JIRA' | 'WIKI' | 'LOCAL'; label: string }> = [
  { key: 'JIRA', label: 'JIRA 单' },
  { key: 'WIKI', label: '从 Wiki 拉单' },
  { key: 'LOCAL', label: '本地目录对比' }
]
const VERSION_KEY = 'acv2.version'
const BATCH_KEY = 'acv2.batchId'

const version = ref('')
const source = ref<'JIRA' | 'WIKI' | 'LOCAL'>('JIRA')
const issuesText = ref('')
const localKey = ref('')
const localSummary = ref('')
const localRows = ref<any[]>([blankLocalRow()])
const backendGroups = ref<any[]>([])
const dirsByProject = ref<Record<string, any[]>>({})
const creating = ref(false)
const batches = ref<any[]>([])
const batchId = ref<number | null>(null)
const batch = ref<any | null>(null)
const force = ref(false)
const filter = ref<'all' | 'multi' | 'unmatched' | 'todo'>('all')
const selectedKey = ref('')
const running = ref(false)
const stopFlag = ref(false)
const busyKey = ref('')
const progress = ref({ done: 0, total: 0, current: '' })
const collecting = ref(false)
const refreshing = ref(false)
const allProjects = ref<any[]>([])
const editVisible = ref(false)
const editKey = ref('')
const editRows = ref<any[]>([])
const savingTargets = ref(false)

const current = computed(() => batch.value?.tickets?.find((t: any) => t.key === selectedKey.value) || null)
/** 认出了项目就能分析：后端做接口对比，前端 / 客户端做代码对比，再一起算关联 */
function canAnalyze(x: any) {
  return !!x.projectCode
}

const stats = computed(() => {
  const ts: any[] = batch.value?.tickets || []
  const needs = ts.filter((t) => t.targets.some(canAnalyze))
  return {
    projects: ts.reduce((n, t) => n + t.targets.filter(canAnalyze).length, 0),
    backend: ts.reduce((n, t) => n + t.targets.filter((x: any) => x.analyzable).length, 0),
    unmatched: ts.reduce((n, t) => n + t.targets.filter((x: any) => !x.projectCode).length, 0),
    needAnalyze: needs.length,
    analyzed: needs.filter((t) => t.analyzedAt).length,
    high: ts.filter((t) => t.assessment?.riskLevel === 'HIGH').length
  }
})

const filteredTickets = computed(() => {
  const ts: any[] = batch.value?.tickets || []
  switch (filter.value) {
    case 'multi':
      return ts.filter((t) => t.targets.filter(canAnalyze).length > 1)
    case 'unmatched':
      return ts.filter((t) => !t.targets.length || t.targets.some((x: any) => !x.projectCode))
    case 'todo':
      return ts.filter((t) => t.targets.some(canAnalyze) && !t.analyzedAt)
    default:
      return ts
  }
})

function chipClass(x: any) {
  if (!x.projectCode) return 'miss'
  if (x.error) return 'be err'
  if (x.codeMissing) return 'nocode'
  if (x.reportId || x.front) return 'be ok'
  if (x.kind === 'FRONTEND') return 'fe'
  if (x.kind === 'CLIENT') return 'cl'
  if (!x.analyzable) return 'gw'
  return 'be'
}

function frontSummary(fc: any) {
  const parts = [`改了 ${fc.changedFiles} 个文件`]
  if (fc.pages?.length) parts.push(`页面 / 组件 ${fc.pages.length} 个`)
  if (fc.addedCalls?.length) parts.push(`新增接口调用 ${fc.addedCalls.length}`)
  if (fc.removedCalls?.length) parts.push(`删掉 ${fc.removedCalls.length}`)
  return parts.join(' · ')
}

function chipTitle(x: any) {
  const parts = [`备注写法：${x.rawProject}`, `分支：${x.branch || '—'}`]
  if (!x.projectCode) parts.push('项目管理里没找到')
  else parts.push(kindText(x) + (x.matchHow && x.matchHow !== 'EXACT' ? `（${HOW[x.matchHow] || x.matchHow}）` : ''))
  if (x.error) parts.push('分析失败：' + x.error)
  else if (x.reportSummary) parts.push(x.reportSummary)
  if (x.front) parts.push(frontSummary(x.front))
  if (x.codeMissing) parts.push('缺代码：' + x.codeMissing)
  return parts.join('\n')
}

function kindText(x: any) {
  if (!x.projectCode) return '没找到项目'
  if (x.kind === 'BACKEND' && !x.analyzable) return '后端（不扫接口）'
  return KIND_TEXT[x.kind] || x.kind || '后端'
}

function shortTime(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(5, 16)
}

async function loadBatches() {
  try {
    batches.value = await apiClient.listApiChangeBatches(50)
  } catch {
    /* 列表拿不到不挡主流程 */
  }
}

function setBatch(b: any) {
  batch.value = b
  if ((b?.id ?? null) !== batchId.value) confirmOpen.value = false
  batchId.value = b?.id ?? null
  if (b?.id) localStorage.setItem(BATCH_KEY, String(b.id))
  if (!b?.tickets?.some((t: any) => t.key === selectedKey.value)) {
    selectedKey.value = b?.tickets?.[0]?.key || ''
  }
}

function applyBatch(b: any) {
  setBatch(b)
}

/** 版本框兼做历史批次入口：输入的字匹配到的批次列出来，一个都不匹配就是要新建 */
async function suggestBatches(q: string, cb: (items: any[]) => void) {
  await loadBatches()
  const kw = (q || '').trim().toLowerCase()
  cb(kw ? batches.value.filter((b: any) => String(b.version || '').toLowerCase().includes(kw)) : batches.value)
}

function onBatchSuggest(item: any) {
  version.value = item.version
  onBatchPick(item.id)
}

async function onBatchPick(id: number | null) {
  if (!id) {
    batch.value = null
    localStorage.removeItem(BATCH_KEY)
    return
  }
  try {
    setBatch(await apiClient.getApiChangeBatch(id))
    progress.value = { done: 0, total: 0, current: '' }
  } catch (e: any) {
    ElMessage.error(e?.message || '打开批次失败')
  }
}

const createReady = computed(() => {
  if (source.value === 'JIRA') return !!issuesText.value.trim()
  return source.value === 'WIKI' && !!version.value.trim()
})

async function createBatch() {
  creating.value = true
  try {
    const wiki = source.value === 'WIKI'
    if (wiki) localStorage.setItem(VERSION_KEY, version.value.trim())
    const b = await apiClient.createApiChangeBatch({
      version: wiki ? version.value.trim() : undefined,
      issues: source.value === 'JIRA' ? issuesText.value : undefined
    })
    setBatch(b)
    progress.value = { done: 0, total: 0, current: '' }
    await loadBatches()
    await openConfirm()
    ElMessage.success(`拉到 ${b.tickets.length} 个单，核对一下项目和分支再分析`)
  } catch (e: any) {
    ElMessage.error(e?.message || '拉单失败')
  } finally {
    creating.value = false
  }
}

async function removeBatch() {
  if (!batch.value) return
  try {
    await ElMessageBox.confirm(`删除批次 #${batch.value.id}（${batch.value.version}）？已生成的对比报告和分支用例不会删。`, '删除批次', {
      type: 'warning'
    })
    await apiClient.deleteApiChangeBatch(batch.value.id)
    batch.value = null
    batchId.value = null
    localStorage.removeItem(BATCH_KEY)
    await loadBatches()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '删除失败')
  }
}

async function select(key: string) {
  if (key === selectedKey.value) return
  selectedKey.value = key
}

async function createCollections() {
  if (!batch.value) return
  collecting.value = true
  try {
    const res = await apiClient.createApiChangeBatchCollections(batch.value.id)
    applyBatch(res.batch)
    const msg = `新建 / 关联 ${res.created.length} 个分支用例集合` + (res.skipped.length ? `，跳过 ${res.skipped.length} 个` : '')
    if (res.skipped.length) {
      ElMessageBox.alert(
        [msg, '', ...res.created.map((s) => '✓ ' + s), ...res.skipped.map((s) => '· ' + s)].join('\n'),
        '创建分支用例',
        { customStyle: { whiteSpace: 'pre-wrap', maxWidth: '640px' } as any }
      )
    } else {
      ElMessage.success(msg + '，去「分支用例」里可以看到')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    collecting.value = false
  }
}

async function analyzeOne(key: string) {
  if (!batch.value) return
  busyKey.value = key
  try {
    const b = await apiClient.analyzeApiChangeBatchTicket(batch.value.id, key, { force: force.value })
    applyBatch(b)
    const t = b.tickets.find((x: any) => x.key === key)
    const failed = t?.targets.filter((x: any) => x.analyzable && x.error) || []
    const noCode = t?.targets.filter((x: any) => x.projectCode && x.codeMissing) || []
    if (failed.length) ElMessage.warning(`${key}：${failed.length} 个项目没分析成功，看表格里的原因`)
    else if (noCode.length) ElMessage.warning(`${key}：${noCode.map((x: any) => x.projectName || x.projectCode).join('、')} 没拿到代码，相关关联只是推测`)
  } catch (e: any) {
    ElMessage.error(`${key}：${e?.message || '分析失败'}`)
  } finally {
    busyKey.value = ''
  }
}

async function analyzeAll() {
  if (!batch.value) return
  const keys = batch.value.tickets
    .filter((t: any) => t.targets.some(canAnalyze) && (force.value || !t.analyzedAt))
    .map((t: any) => t.key)
  if (!keys.length) {
    ElMessage.info('都分析过了；要重跑请勾「已分析的也重跑」')
    return
  }
  running.value = true
  stopFlag.value = false
  progress.value = { done: 0, total: keys.length, current: '' }
  for (const key of keys) {
    if (stopFlag.value) break
    progress.value.current = key
    await analyzeOne(key)
    progress.value.done++
  }
  running.value = false
  progress.value.current = ''
  ElMessage.success(stopFlag.value ? `已停止，完成 ${progress.value.done} 个` : `分析完成 ${progress.value.done} 个单`)
}

async function refreshTicket() {
  if (!batch.value || !current.value) return
  refreshing.value = true
  try {
    applyBatch(await apiClient.refreshApiChangeBatchTicket(batch.value.id, current.value.key))
    ElMessage.success('已重新拉取并认分支')
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

function blankLocalRow() {
  return { projectCode: '', baseDir: '', baseBranch: 'master', headDir: '', branch: '' }
}

const localReady = computed(() => {
  const filled = localRows.value.filter((r) => r.projectCode || r.baseDir || r.headDir)
  return filled.length > 0 && filled.every((r) => r.projectCode && r.baseDir?.trim() && r.headDir?.trim())
})

watch(source, (s) => {
  if (s === 'LOCAL') loadBackendGroups()
  if (s === 'WIKI' && !version.value.trim()) version.value = localStorage.getItem(VERSION_KEY) || ''
})

/** AI 任务启动后批次里记了任务和集合，重新拿一次 */
async function reloadBatch() {
  if (!batch.value) return
  try {
    applyBatch(await apiClient.getApiChangeBatch(batch.value.id))
  } catch {
    /* 拿不到就等下次操作 */
  }
}

/** 每次点开下拉都重新拉：项目管理里刚加的项目要马上能选 */
async function loadBackendGroups() {
  try {
    const res = await apiClient.getApiChangeProjects(true)
    backendGroups.value = Array.isArray(res?.groups) ? res.groups : []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载项目失败')
  }
}

async function loadDirs(code: string) {
  if (!code || dirsByProject.value[code]) return
  try {
    dirsByProject.value = { ...dirsByProject.value, [code]: (await apiClient.getApiCodeDirs(code)) || [] }
  } catch {
    /* 没保存过目录就手动粘路径 */
  }
}

function dirsOf(code: string) {
  return (code && dirsByProject.value[code]) || []
}

async function createLocal() {
  creating.value = true
  try {
    const b = await apiClient.createApiChangeLocalBatch({
      issueKey: localKey.value.trim() || undefined,
      summary: localSummary.value.trim() || undefined,
      targets: localRows.value
        .filter((r) => r.projectCode)
        .map((r) => ({
          projectCode: r.projectCode,
          baseDir: r.baseDir.trim(),
          baseBranch: r.baseBranch?.trim() || undefined,
          headDir: r.headDir.trim(),
          branch: r.branch?.trim() || undefined
        }))
    })
    setBatch(b)
    await loadBatches()
    const key = b.tickets[0].key
    progress.value = { done: 0, total: 1, current: key }
    running.value = true
    await analyzeOne(key)
    running.value = false
    progress.value = { done: 1, total: 1, current: '' }
  } catch (e: any) {
    running.value = false
    ElMessage.error(e?.message || '对比失败')
  } finally {
    creating.value = false
  }
}

function blankRow() {
  return { rawProject: '', projectCode: '', branch: '', baseBranch: '', baseDir: '', headDir: '' }
}

async function loadAllProjects() {
  try {
    allProjects.value = (await apiClient.getApiProjects()) as any[]
  } catch (e: any) {
    ElMessage.error(e?.message || '加载项目失败')
  }
}

function rowTag(r: any) {
  if (r.projectCode) {
    return r.matchHow === 'BRANCH' && r.projectCode === r.origCode ? { text: '按分支找到', cls: 'branch' } : { text: '人工指定', cls: 'manual' }
  }
  if (r.autoCode) return { text: r.matchHow === 'FUZZY' ? '近似匹配' : '自动匹配', cls: r.matchHow === 'FUZZY' ? 'fuzzy' : 'auto' }
  return { text: '没认出', cls: 'miss' }
}

function projWidth(r: any) {
  const p = allProjects.value.find((x: any) => x.code === r.projectCode)
  const text = r.projectCode ? (p?.name || r.projectCode) : (r.autoName || '点这里选项目')
  return Math.min(360, Math.max(150, text.length * 8.4 + 58)) + 'px'
}

function projKind(code: string) {
  const p = allProjects.value.find((x: any) => x.code === code)
  return p ? KIND_TEXT[p.kind] || p.kind || '后端' : '后端'
}

function defaultBase(code: string) {
  return allProjects.value.find((p: any) => p.code === code)?.baseBranch || 'master'
}

async function openEdit() {
  if (!current.value) return
  await loadAllProjects()
  editKey.value = current.value.key
  editRows.value = current.value.targets.map((x: any) => ({
    rawProject: x.rawProject,
    // 自动认出来的不回填，免得一保存就变成「人工指定」；认出的名字放占位里显示
    projectCode: x.matchHow === 'MANUAL' || x.matchHow === 'BRANCH' ? x.projectCode : '',
    matchHow: x.matchHow,
    origCode: x.projectCode || '',
    autoCode: x.matchHow === 'MANUAL' || x.matchHow === 'BRANCH' ? '' : x.projectCode || '',
    autoName: x.matchHow === 'MANUAL' || x.matchHow === 'BRANCH' ? '' : x.projectName || x.projectCode || '',
    branch: x.branch,
    baseBranch: x.baseBranch || '',
    note: x.note,
    baseDir: x.baseDir || '',
    headDir: x.headDir || '',
    collectionId: x.collectionId
  }))
  if (!editRows.value.length) editRows.value.push(blankRow())
  editVisible.value = true
}

async function saveTargets() {
  if (!batch.value) return
  savingTargets.value = true
  try {
    applyBatch(await apiClient.saveApiChangeBatchTargets(batch.value.id, editKey.value, editRows.value))
    editVisible.value = false
    ElMessage.success('已保存，项目或基线有变的话重新分析一下')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingTargets.value = false
  }
}

// ---------------------------------------------------------------- 拉完单子的核对表

interface CfmRow {
  key: string
  rawProject: string
  projectCode: string
  branch: string
  baseBranch: string
  matchHow?: string
  origCode?: string
  note?: string
  baseDir?: string
  headDir?: string
  collectionId?: number
  fresh?: boolean
}
const confirmOpen = ref(false)
const cfmRows = ref<CfmRow[]>([])
const cfmSaving = ref(false)
let cfmInit: Record<string, string> = {}

function cfmBlank(key: string): CfmRow {
  return { key, rawProject: '', projectCode: '', branch: '', baseBranch: '', fresh: true }
}

async function openConfirm() {
  if (!batch.value) return
  await loadAllProjects()
  const rows: CfmRow[] = []
  for (const t of batch.value.tickets) {
    if (!t.targets.length) rows.push(cfmBlank(t.key))
    for (const x of t.targets) {
      rows.push({
        key: t.key,
        rawProject: x.rawProject || '',
        projectCode: x.projectCode || '',
        branch: x.branch || '',
        baseBranch: x.baseBranch || '',
        matchHow: x.matchHow,
        origCode: x.projectCode || '',
        note: x.note,
        baseDir: x.baseDir,
        headDir: x.headDir,
        collectionId: x.collectionId
      })
    }
  }
  cfmRows.value = rows
  cfmInit = Object.fromEntries(cfmKeys().map((k) => [k, JSON.stringify(cfmPayload(k))]))
  confirmOpen.value = true
}

function onMore(c: string) {
  if (c === 'delete') removeBatch()
  else if (c === 'confirm') openConfirm()
}

function cfmKeys() {
  return [...new Set(cfmRows.value.map((r) => r.key))]
}

function cfmFirst(i: number) {
  return i === 0 || cfmRows.value[i - 1].key !== cfmRows.value[i].key
}

function cfmOnly(key: string) {
  return cfmRows.value.filter((r) => r.key === key).length === 1
}

function cfmAdd(key: string) {
  let at = -1
  cfmRows.value.forEach((r, i) => r.key === key && (at = i))
  cfmRows.value.splice(at + 1, 0, cfmBlank(key))
}

/** 删到一个单只剩空行：留着空行让单子还在表里，保存时空行跳过 */
function cfmRemove(i: number) {
  const key = cfmRows.value[i].key
  if (cfmOnly(key)) cfmRows.value.splice(i, 1, cfmBlank(key))
  else cfmRows.value.splice(i, 1)
}

function ticketSummary(key: string) {
  return batch.value?.tickets?.find((t: any) => t.key === key)?.summary || ''
}

function cfmProblem(r: CfmRow) {
  if (r.fresh && !r.projectCode) return cfmOnly(r.key) ? '没读出项目，要测的话加上' : '选个项目'
  if (!r.projectCode) return '没认出，选一下项目'
  if (!r.branch.trim()) return '没写分支'
  return ''
}

function cfmNote(r: CfmRow): { text: string; warn?: boolean } {
  if (r.fresh) return { text: '手动加的' }
  if (r.projectCode !== r.origCode) return { text: '已改项目' }
  if (r.matchHow === 'FUZZY') return { text: '按近似名认的，核对下', warn: true }
  if (r.matchHow === 'BRANCH') return { text: '单子没写，按分支找到的', warn: true }
  if (r.matchHow === 'MANUAL') return { text: '人工指定' }
  return { text: kindText({ projectCode: r.projectCode, kind: allProjects.value.find((p: any) => p.code === r.projectCode)?.kind, analyzable: true }) }
}

const cfmCount = computed(() => cfmRows.value.filter((r) => r.projectCode || !r.fresh).length)
const cfmIssues = computed(() => cfmRows.value.filter((r) => cfmProblem(r) || cfmNote(r).warn).length)

function cfmPayload(key: string) {
  return cfmRows.value
    .filter((r) => r.key === key && (r.projectCode || r.rawProject.trim()))
    .map((r) => ({
      rawProject: r.rawProject.trim() || r.projectCode,
      projectCode: r.projectCode || undefined,
      branch: r.branch.trim(),
      baseBranch: r.baseBranch.trim() || undefined,
      note: r.note,
      baseDir: r.baseDir,
      headDir: r.headDir,
      collectionId: r.collectionId
    }))
}

async function saveConfirm(run: boolean) {
  if (!batch.value) return
  cfmSaving.value = true
  try {
    for (const key of cfmKeys()) {
      const body = cfmPayload(key)
      if (JSON.stringify(body) === cfmInit[key]) continue
      applyBatch(await apiClient.saveApiChangeBatchTargets(batch.value.id, key, body))
      cfmInit[key] = JSON.stringify(body)
    }
    confirmOpen.value = false
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
    return
  } finally {
    cfmSaving.value = false
  }
  if (run) await analyzeAll()
  else ElMessage.success('已保存')
}

onMounted(async () => {
  await loadBatches()
  const last = Number(localStorage.getItem(BATCH_KEY) || 0)
  if (last && batches.value.some((b) => b.id === last)) await onBatchPick(last)
})
</script>

<style scoped>
.acv2 {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.grow {
  flex: 1;
}
.bar,
.imp {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
}
.bar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.bar-select {
  width: 240px;
}
.bar-select :deep(.el-select__wrapper),
.bar-select :deep(.el-input__wrapper) {
  font-weight: 600;
}
.bar-empty {
  margin-left: 4px;
}
.more-btn {
  padding: 5px 9px;
  letter-spacing: 1px;
}
:deep(.danger-item) {
  color: var(--el-color-danger);
}
.bar .progress {
  flex-basis: 100%;
  margin-top: 4px;
}
.imp-body {
  padding: 2px 16px 0;
}
.create-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-top: 10px;
}
.src-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.15s;
}
.src-btn:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}
.src-btn.on {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 500;
}
.imp-body > .ver-wrap {
  margin-top: 10px;
  width: 100%;
}
.imp-body > :last-child {
  margin-bottom: 14px;
}
.local-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.local-box .hint code {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
.cfm {
  background: var(--el-bg-color);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  padding: 12px 16px 0;
}
.cfm-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}
.cfm-warn {
  font-size: 12px;
  color: var(--el-color-warning);
}
.cfm-table {
  width: 100%;
  margin-top: 10px;
  border-collapse: collapse;
  font-size: 13px;
}
.cfm-table th {
  text-align: left;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  padding: 6px;
  background: var(--el-fill-color-lighter);
}
.cfm-table td {
  padding: 5px 6px;
  vertical-align: middle;
}
.cfm-table tr.first td {
  border-top: 1px solid var(--el-border-color-lighter);
}
.cfm-table tr.bad td:not(:first-child) {
  background: var(--el-color-danger-light-9);
}
.cfm-key {
  font-weight: 600;
  white-space: nowrap;
}
.cfm-add {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}
.cfm-raw {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}
.cfm-note {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cfm-note.is-warn {
  color: var(--el-color-warning);
}
.cfm-note.is-bad {
  color: var(--el-color-danger);
}
.cfm-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px -16px 0;
  padding: 8px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  border-radius: 0 0 8px 8px;
}
.cfm-foot :deep(.el-button + .el-button) {
  margin-left: 0;
}
.ver-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.ver-wrap {
  flex: 0 1 360px;
  min-width: 220px;
}
.key-input {
  width: 140px;
}
.sum-input {
  width: 220px;
}
.local-box {
  margin-top: 6px;
}
.row-ops {
  white-space: nowrap;
}
.row-ops :deep(.el-button + .el-button) {
  margin-left: 8px;
}
.local-box .edit-table {
  margin-bottom: 0;
}
.hint {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.paste {
  margin-top: 8px;
}
.mono :deep(textarea),
.mono :deep(input),
.mono-sm {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mono-sm {
  font-size: 12px;
  word-break: break-all;
}
.ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ops-left,
.ops-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.ver-badge {
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.stat {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.stat.warn {
  color: var(--el-color-warning);
}
.stat.bad {
  color: var(--el-color-danger);
  font-weight: 500;
}
.progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.progress .el-progress {
  flex: 1;
}
.progress-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.body {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.list {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  position: sticky;
  top: 0;
}
.list-filter {
  padding: 2px 2px 8px;
}
.t-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}
.t-item + .t-item {
  margin-top: 4px;
}
.t-item:hover {
  background: var(--el-fill-color-light);
}
.t-item.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}
.t-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.t-key {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;
}
.t-status {
  color: var(--el-text-color-secondary);
}
.t-busy {
  margin-left: auto;
  color: var(--el-color-primary);
}
.t-risk {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 3px;
}
.rk-HIGH {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.rk-MEDIUM {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.rk-LOW {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.t-sum {
  margin: 2px 0 4px;
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.t-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 3px;
  line-height: 18px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip em {
  font-style: normal;
  margin-left: 4px;
  opacity: 0.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.chip.be {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.chip.be.ok {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.chip.be.err,
.chip.miss {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.chip.nocode {
  background: transparent;
  border: 1px dashed var(--el-border-color-darker);
  color: var(--el-text-color-secondary);
  line-height: 16px;
}
.warn-text {
  color: var(--el-color-warning-dark-2);
}
.chip.none {
  color: var(--el-text-color-placeholder);
}
.detail {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px 18px;
  min-height: 300px;
}
.ed-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 32px;
}
.ed-title b {
  font-size: 16px;
}
.ed-key {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.ed-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ed-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.ed-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.ed-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ed-project {
  flex: none;
}
.ed-project :deep(.el-select__wrapper) {
  min-height: 26px;
  padding: 0 8px 0 10px;
  border-radius: 13px;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  background: var(--el-bg-color);
  transition: box-shadow 0.15s;
}
.ed-project :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
}
.ed-project :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.ed-project :deep(.el-select__selected-item),
.ed-project.auto :deep(.el-select__placeholder) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.ed-project.empty :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger-light-5) inset;
  background: var(--el-color-danger-light-9);
}
.ed-project.empty :deep(.el-select__placeholder) {
  color: var(--el-color-danger);
}
.ed-kind {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}
.ed-raw {
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
}
.ed-tag {
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  border: 1px solid;
}
.ed-tag.auto {
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}
.ed-tag.manual,
.ed-tag.branch {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
.ed-tag.fuzzy {
  color: var(--el-color-warning-dark-2);
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}
.ed-tag.miss {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}
.ed-del {
  color: var(--el-text-color-secondary);
}
.ed-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  padding: 12px;
}
.ed-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ed-grid label > span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ed-add {
  margin-top: 12px;
}
.ed-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ed-foot .muted {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.opt-sub {
  float: right;
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.targets,
.edit-table {
  width: 100%;
  margin: 10px 0;
  border-collapse: collapse;
  font-size: 13px;
}
.targets th,
.edit-table th {
  text-align: left;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  padding: 4px 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.targets td,
.edit-table td {
  padding: 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  vertical-align: top;
}
.tg-name {
  font-weight: 500;
  white-space: nowrap;
}
.tg-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.how {
  margin-left: 6px;
  color: var(--el-color-warning);
}
.k-MISS {
  color: var(--el-color-danger);
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.err {
  color: var(--el-color-danger);
}
.ok {
  color: var(--el-color-success);
}
.nowrap {
  white-space: nowrap;
}
.notes {
  margin: 4px 0 10px;
  font-size: 12px;
}
.notes summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.notes pre {
  margin: 6px 0 0;
  padding: 8px 10px;
  max-height: 240px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
@media (max-width: 1100px) {
  .body {
    grid-template-columns: 1fr;
  }
  .list {
    position: static;
    max-height: 360px;
  }
}
</style>

<style>
.acv2-batch-suggest {
  min-width: 360px;
}
.acv2-batch-suggest .bs-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.acv2-batch-suggest .bs-sub {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
