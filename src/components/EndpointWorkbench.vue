<template>
  <div class="ewb">
    <div v-if="ctx.must?.why || ctx.must?.title" class="ewb-must">
      <div class="ewb-why">
        <el-tag size="small" :type="prioTag(ctx.priority)" effect="dark">{{ ctx.priority }}</el-tag>
        <b v-if="ctx.must?.title">{{ ctx.must.title }}</b>
        <span v-if="ctx.must?.why" class="ewb-why-text">{{ ctx.must.why }}</span>
      </div>
      <TipList :items="tips.head" tone="plain" />
    </div>
    <el-alert v-if="lookupError" type="warning" :closable="false" show-icon :title="lookupError" class="ewb-gap" />

    <el-tabs v-model="tab">
      <el-tab-pane name="req">
        <template #label>请求参数 <span class="ewb-n">{{ reqRows.length }}</span></template>
        <TipList :items="tips.req" />
        <JsonDiffView v-if="fieldView === 'json'" :blocks="reqBlocks" :project="project" :endpoint="epRef" :marks="marks" empty-text="入参没变">
            <template #extra>
              <el-radio-group v-model="fieldView" size="small">
                <el-radio-button value="json">JSON</el-radio-button>
                <el-radio-button value="table">表格</el-radio-button>
              </el-radio-group>
            </template>
        </JsonDiffView>
        <FieldDiffTable v-else :rows="reqRows" :project="project" :endpoint="epRef" :marks="marks" empty-text="入参没变">
            <template #extra>
              <el-radio-group v-model="fieldView" size="small">
                <el-radio-button value="json">JSON</el-radio-button>
                <el-radio-button value="table">表格</el-radio-button>
              </el-radio-group>
            </template>
        </FieldDiffTable>
      </el-tab-pane>

      <el-tab-pane name="resp">
        <template #label>响应数据 <span class="ewb-n">{{ respRows.length }}</span></template>
        <TipList :items="tips.resp" />
        <JsonDiffView
          v-if="fieldView === 'json'"
          :blocks="respBlocks"
          :project="project"
          :endpoint="epRef"
          :marks="marks"
          can-assert
          empty-text="返回字段没变"
        >
            <template #extra>
              <el-radio-group v-model="fieldView" size="small">
                <el-radio-button value="json">JSON</el-radio-button>
                <el-radio-button value="table">表格</el-radio-button>
              </el-radio-group>
            </template>
        </JsonDiffView>
        <FieldDiffTable v-else :rows="respRows" :project="project" :endpoint="epRef" :marks="marks" can-assert empty-text="返回字段没变">
            <template #extra>
              <el-radio-group v-model="fieldView" size="small">
                <el-radio-button value="json">JSON</el-radio-button>
                <el-radio-button value="table">表格</el-radio-button>
              </el-radio-group>
            </template>
        </FieldDiffTable>
      </el-tab-pane>

      <el-tab-pane v-if="showConc" name="conc">
        <template #label>
          并发 <span class="ewb-n" :class="{ hot: hotRisk }">{{ ctx.risks.length }}</span>
        </template>
        <el-table v-if="ctx.risks.length" :data="ctx.risks" size="small" border>
          <el-table-column label="级别" width="70" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.level === 'RISK' ? 'danger' : 'info'" effect="plain">
                {{ row.level === 'RISK' ? '重点' : '了解' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="风险" min-width="240" />
          <el-table-column prop="howToTest" label="怎么打" min-width="240" />
          <el-table-column prop="basis" label="依据" min-width="180" show-overflow-tooltip />
        </el-table>
        <div v-else class="ewb-muted">没扫到并发风险（没录建表语句的表扫不出来，不等于没风险）</div>

        <div class="ewb-tool">
          <div class="ewb-tool-title">并发打一次 <span class="ewb-muted">只打测试环境，不记执行历史</span></div>
          <div v-if="!cases.length" class="ewb-muted">要借一条用例的请求（地址、参数、登录态），先到「用例」里生成一条。</div>
          <div v-else class="ewb-tool-form">
            <el-select v-model="burst.caseId" placeholder="用哪条用例的请求" style="width: 240px">
              <el-option v-for="c in cases" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <span class="ewb-label">同时发</span>
            <el-input-number v-model="burst.count" :min="2" :max="20" style="width: 110px" />
            <span class="ewb-label">个，每个换</span>
            <el-select
              v-model="burst.varyParam"
              clearable
              filterable
              allow-create
              placeholder="不换（全一样）"
              style="width: 170px"
              @change="fillValues"
            >
              <el-option v-for="n in paramNames" :key="n" :label="n" :value="n" />
            </el-select>
            <el-input v-if="burst.varyParam" v-model="burst.values" placeholder="逗号隔开的值" style="width: 200px" />
            <el-button type="danger" plain :loading="burstRunning" :disabled="!burst.caseId" @click="runBurst">并发打一次</el-button>
          </div>
          <template v-if="burstResult">
            <el-alert type="info" :closable="false" show-icon :title="burstResult.verdict" class="ewb-gap" />
            <el-table :data="burstResult.shots" size="small" border class="ewb-gap">
              <el-table-column prop="index" label="#" width="50" align="center" />
              <el-table-column v-if="burstResult.varyParam" label="值" min-width="100">
                <template #default="{ row }"><code class="ewb-code">{{ row.value }}</code></template>
              </el-table-column>
              <el-table-column label="结果" width="90" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="shotTag(row.status)">{{ shotLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="httpStatus" label="HTTP" width="70" align="center" />
              <el-table-column label="耗时" width="90">
                <template #default="{ row }">{{ row.durationMs ?? '—' }} ms</template>
              </el-table-column>
              <el-table-column label="返回 / 报错" min-width="280" show-overflow-tooltip>
                <template #default="{ row }"><span class="ewb-code">{{ row.error || row.body || '' }}</span></template>
              </el-table-column>
            </el-table>
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="showDeps" name="deps">
        <template #label>缓存与表 <span class="ewb-n">{{ depCount }}</span></template>
        <TipList :items="tips.deps" />

        <div v-if="redisRows.length" class="ewb-sec">
          <div class="ewb-sec-title">缓存 key</div>
          <el-table :data="redisRows" size="small" border>
            <el-table-column label="key" min-width="260">
              <template #default="{ row }"><code class="ewb-code">{{ row.value }}</code></template>
            </el-table-column>
            <el-table-column prop="constant" label="代码里的常量" min-width="180" show-overflow-tooltip />
            <el-table-column label="本次" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.valueChanged" size="small" type="danger" effect="plain">key 变了</el-tag>
                <el-tag v-else-if="row.related" size="small" type="warning" effect="plain">本次相关</el-tag>
                <span v-else class="ewb-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="" width="170" align="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="copy(row.value)">复制 key</el-button>
                <el-button link type="primary" size="small" @click="goRedis(row.value)">去 Redis 查</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="tableRows.length" class="ewb-sec">
          <div class="ewb-sec-title">读写的表</div>
          <el-alert v-if="schemaNote && ctx.tableChanges.length" type="info" :closable="false" show-icon :title="schemaNote" class="ewb-gap-b" />
          <el-table :data="tableRows" size="small" border>
            <el-table-column label="表" min-width="180">
              <template #default="{ row }">
                <code class="ewb-code">{{ row.table }}</code>
                <div v-if="row.change?.ddlSource" class="ewb-muted">{{ row.change.ddlSource }}</div>
              </template>
            </el-table-column>
            <el-table-column label="本次" width="110" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.change?.ddl" size="small" type="danger" effect="plain">改了结构</el-tag>
                <el-tag v-else-if="row.related" size="small" type="warning" effect="plain">本次相关</el-tag>
                <span v-else class="ewb-muted">本来就在用</span>
              </template>
            </el-table-column>
            <el-table-column label="结构变更 / 要注意" min-width="300">
              <template #default="{ row }">
                <div v-for="(d, i) in row.change?.ddlDetails || []" :key="'d' + i" class="ewb-ddl">
                  {{ d.action }} {{ d.column || '' }} {{ d.detail }}
                </div>
                <div v-for="(h, i) in row.change?.testHints || []" :key="'h' + i" class="ewb-hint">
                  <el-tooltip :content="`依据：${h.basis}`" placement="top" :disabled="!h.basis">
                    <span><el-tag size="small" :type="h.level === 'RISK' ? 'danger' : 'info'" effect="plain">{{ h.level === 'RISK' ? '重点' : '了解' }}</el-tag> {{ h.title }}</span>
                  </el-tooltip>
                </div>
                <div v-if="row.change?.remark" class="ewb-muted">补充：{{ row.change.remark }}</div>
                <span v-if="!row.change" class="ewb-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="" width="230" align="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="emit('open-table', row.table)">谁还在用</el-button>
                <el-button link type="primary" size="small" @click="copy(`SELECT * FROM ${row.table} ORDER BY 1 DESC LIMIT 20;`)">复制查询</el-button>
                <el-button v-if="row.change && !row.change.testHints?.length" link type="primary" size="small" @click="emit('open-schema', row.table)">补建表语句</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="implRows.length" class="ewb-sec">
          <div class="ewb-sec-title">改了的实现</div>
          <div class="ewb-impls">
            <div v-for="r in implRows" :key="r.name" class="ewb-impl">
              <el-tag size="small" effect="plain" :type="r.kind === 'SCHEDULE' || r.kind === 'SERVICE_SCHEDULED' ? 'warning' : 'info'">{{ r.label }}</el-tag>
              <el-tooltip :content="r.file" :disabled="!r.file" placement="top">
                <code class="ewb-code">{{ r.name }}</code>
              </el-tooltip>
              <span v-if="r.hint" class="ewb-muted">{{ r.hint }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="ctx.findings.length" name="risk">
        <template #label>安全/设计 <span class="ewb-n hot">{{ ctx.findings.length }}</span></template>
        <div v-for="(f, i) in ctx.findings" :key="i" class="ewb-finding" :class="{ risk: f.level === 'RISK' }">
          <el-tag size="small" :type="f.kind === 'SECURITY' ? 'danger' : 'warning'" effect="plain">
            {{ f.kind === 'SECURITY' ? '安全' : '设计' }}
          </el-tag>
          <div class="ewb-finding-body">
            <div class="ewb-finding-title">{{ f.title }}</div>
            <div v-if="f.basis" class="ewb-muted">依据：{{ f.basis }}</div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="cases">
        <template #label>
          用例 <span class="ewb-n" :class="{ hot: !cases.length && !lookupLoading }">{{ lookupLoading ? '…' : cases.length }}</span>
        </template>
        <ul v-if="commonNotes?.length" class="ewb-tips">
          <li>写用例时：{{ commonNotes.join('；') }}</li>
        </ul>
        <div class="ewb-case-bar">
          <span v-if="onlyStatusCount" class="ewb-warn">{{ onlyStatusCount }} 条只验了状态码，不能直接当回归</span>
          <span class="ewb-spacer" />
          <el-button size="small" type="primary" :loading="aiRunning" :disabled="!lookup?.endpoint" @click="genAiCases">
            {{ aiRunning ? aiProgress || 'AI 生成中…' : '✦ AI 生成用例' }}
          </el-button>
        </div>
        <div v-if="lookupLoading" class="ewb-muted">查用例中…</div>
        <el-empty v-else-if="!cases.length" description="还没有用例，点「✦ AI 生成用例」" :image-size="48" />
        <el-table v-else :data="cases" size="small" border>
          <el-table-column prop="name" label="用例" min-width="200" show-overflow-tooltip />
          <el-table-column label="环境" width="70" align="center">
            <template #default="{ row }">{{ envLabel(row.environment) }}</template>
          </el-table-column>
          <el-table-column label="断言" min-width="150">
            <template #default="{ row }">
              <span>{{ row.assertCount }} 条</span>
              <span v-if="row.assertTypes.length" class="ewb-muted">（{{ [...new Set(row.assertTypes)].join(' / ') }}）</span>
            </template>
          </el-table-column>
          <el-table-column label="判定" min-width="150">
            <template #default="{ row }">
              <el-tag v-if="row.onlyStatus" size="small" type="warning" effect="plain">只验了状态码</el-tag>
              <el-tag v-else size="small" type="success" effect="plain">有字段断言</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近一次" width="120">
            <template #default="{ row }">
              <template v-if="runs[row.id]">
                <el-tag size="small" :type="shotTag(runs[row.id].status)">{{ shotLabel(runs[row.id].status) }}</el-tag>
                <span class="ewb-muted"> {{ runs[row.id].httpStatus ?? '' }}</span>
              </template>
              <span v-else class="ewb-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="140" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" :loading="running === row.id" @click="runCase(row)">跑一次</el-button>
              <el-button
                link
                type="primary"
                size="small"
                @click="emit('edit-case', { id: row.id, endpointId: lookup?.endpoint?.id, project: lookup?.endpoint?.project })"
              >编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { keyTemplateToPattern } from '@/utils/redisKey'
import FieldDiffTable from '@/components/FieldDiffTable.vue'
import JsonDiffView from '@/components/JsonDiffView.vue'
import TipList from '@/components/TipList.vue'
import { requestBlocks, responseBlocks } from '@/utils/jsonDiffTree'
import { requestRows, responseRows } from '@/utils/fieldDiff'
import type { EndpointCtx } from '@/utils/endpointContext'
import type { EndpointRef, FieldMarks } from '@/composables/useFieldMarks'

const props = defineProps<{
  ctx: EndpointCtx
  project: string
  marks: FieldMarks | null
  schemaNote?: string
  /** 对每个接口都成立的做法，后端已从单条 notes 里拿掉 */
  commonNotes?: string[]
}>()

/** 旧报告的 notes 里还混着通用的两句，按 commonNotes 去掉 */
const mustNotes = computed<string[]>(() => {
  const norm = (s: string) => String(s || '').replace(/[，,\s]/g, '')
  const common = new Set((props.commonNotes || []).map(norm))
  return (props.ctx.must?.notes || []).filter((n: string) => !common.has(norm(n)))
})

type TipTab = 'head' | 'req' | 'resp' | 'deps' | 'conc' | 'impl' | 'cases'

/** notes 是后端按固定开头写的（MustTestGuide），按开头分到对应的 Tab */
const TIP_RULES: Array<[RegExp, TipTab]> = [
  [/^(新入参|入参 |请求体 |故意不传 |带上新参数)/, 'req'],
  [/^(返回|抽查老包)/, 'resp'],
  [/^(读写表 |缓存 key|走缓存)/, 'deps'],
  [/^并发：/, 'conc'],
  [/^改动的实现：/, 'impl'],
  [/^(已有 \d+ 条用例|还没有接口用例)/, 'cases']
]

const tips = computed(() => {
  const out: Record<'head' | 'req' | 'resp' | 'deps', string[]> = { head: [], req: [], resp: [], deps: [] }
  for (const n of mustNotes.value) {
    const tab = TIP_RULES.find(([re]) => re.test(n))?.[1] || 'head'
    // 这三类 Tab 里已经有同样的内容（风险表、改了的实现、用例列表），不再重复
    if (tab === 'cases') continue
    if (tab === 'conc' && props.ctx.risks.length) continue
    if (tab === 'impl' && implRows.value.length) continue
    if (tab === 'deps' && showDeps.value) out.deps.push(n)
    else if (tab === 'req' || tab === 'resp') out[tab].push(n)
    else out.head.push(n)
  }
  return out
})

const emit = defineEmits<{
  (e: 'open-table', table: string): void
  (e: 'open-schema', table: string): void
  (e: 'edit-case', v: { id: string; endpointId?: string; project?: string }): void
}>()

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const KIND_LABELS: Record<string, string> = {
  SCHEDULE: '定时任务',
  CACHE: '缓存',
  CONFIG: '配置',
  MAPPER: '数据访问',
  SERVICE: '业务实现',
  SERVICE_SCHEDULED: '实现+定时',
  OTHER: '其它'
}

const e = computed(() => props.ctx.e)
const method = computed(() => String(e.value?.httpMethod || 'GET').toUpperCase())
const epRef = computed<EndpointRef>(() => ({ method: method.value, path: e.value?.path || '' }))
const reqRows = computed(() => requestRows(e.value))
const respRows = computed(() => responseRows(e.value?.fields, e.value?.responseFields))
const reqBlocks = computed(() => requestBlocks(e.value))
const respBlocks = computed(() => responseBlocks(e.value))

const FIELD_VIEW_KEY = 'apiChange.fieldView'
const fieldView = ref<'json' | 'table'>(localStorage.getItem(FIELD_VIEW_KEY) === 'table' ? 'table' : 'json')
watch(fieldView, (v) => localStorage.setItem(FIELD_VIEW_KEY, v))
const paramNames = computed(() => [...new Set(reqRows.value.map((r) => r.name).filter(Boolean))])
const hotRisk = computed(() => props.ctx.risks.some((r: any) => r.level === 'RISK'))
const showConc = computed(() => props.ctx.risks.length > 0 || WRITE.has(method.value))

const redisRows = computed(() => e.value?.redisKeys || [])
const router = useRouter()
function goRedis(template: string) {
  router.push({ path: '/redis-tool', query: { pattern: keyTemplateToPattern(template) } })
}
const tableRows = computed(() => {
  const list: string[] = e.value?.tables || []
  const n = e.value?.relatedTableCount || 0
  const byName = new Map(props.ctx.tableChanges.map((t: any) => [t.table, t]))
  const rows = list.map((t, i) => ({ table: t, related: i < n, change: byName.get(t) || null }))
  for (const t of props.ctx.tableChanges) {
    if (!list.includes(t.table)) rows.unshift({ table: t.table, related: true, change: t })
  }
  return rows.sort((a, b) => Number(!!b.change?.ddl) - Number(!!a.change?.ddl))
})
const implRows = computed(() => {
  const out = new Map<string, { name: string; kind: string; label: string; file?: string; hint?: string }>()
  for (const o of props.ctx.others) {
    const name = String(o.fileName || o.file || '').split('/').pop()!.replace(/\.java$/, '')
    out.set(name, { name, kind: o.kind, label: KIND_LABELS[o.kind] || o.kind || '其它', file: o.file, hint: o.hint })
  }
  for (const c of e.value?.changedImpls || []) {
    if (!out.has(c)) out.set(c, { name: c, kind: 'SERVICE', label: '业务实现' })
  }
  return [...out.values()]
})
const depCount = computed(() => redisRows.value.length + tableRows.value.length + implRows.value.length)
const showDeps = computed(() => depCount.value > 0)

const tab = ref('req')

function prioTag(p: string) {
  return p === 'P0' ? 'danger' : p === 'P1' ? 'warning' : 'info'
}
function envLabel(v?: string) {
  const s = String(v || '').toUpperCase()
  return s === 'PROD' ? '生产' : s === 'TEST' ? '测试' : '通用'
}
function shotTag(s: string) {
  return s === 'PASSED' ? 'success' : s === 'BLOCKED' ? 'info' : 'danger'
}
function shotLabel(s: string) {
  return s === 'PASSED' ? '通过' : s === 'BLOCKED' ? '没跑成' : '失败'
}

// ---- 清单里的接口 + 用例 ----
const lookup = ref<Awaited<ReturnType<typeof apiClient.lookupChangedEndpoint>> | null>(null)
const lookupLoading = ref(false)
const lookupError = ref('')
const cases = computed(() => lookup.value?.cases || [])
const onlyStatusCount = computed(() => cases.value.filter((c) => c.onlyStatus).length)
const runs = reactive<Record<string, { status: string; httpStatus?: number }>>({})
const running = ref('')
let lookupSeq = 0

async function loadLookup() {
  const seq = ++lookupSeq
  lookup.value = null
  lookupError.value = ''
  if (!props.project || !e.value?.path) {
    lookupError.value = props.project ? '' : '这份报告没有关联项目，查不到接口清单里的用例'
    return
  }
  lookupLoading.value = true
  try {
    const r = await apiClient.lookupChangedEndpoint(props.project, method.value, e.value.path)
    if (seq !== lookupSeq) return
    lookup.value = r
    if (!r.found) lookupError.value = r.message || '接口清单里没找到这个接口'
    if (!burst.caseId && r.cases?.length) burst.caseId = r.cases[0].id
  } catch (err: any) {
    if (seq === lookupSeq) lookupError.value = err?.message || '查接口失败'
  } finally {
    if (seq === lookupSeq) lookupLoading.value = false
  }
}

async function runCase(row: { id: string }) {
  running.value = row.id
  try {
    const r = await apiClient.runApiTest({ caseIds: [row.id], environment: 'TEST' })
    const c = r.cases?.[0]
    if (c) runs[row.id] = { status: c.status, httpStatus: c.httpStatus }
    ElMessage({ type: c?.status === 'PASSED' ? 'success' : 'warning', message: c?.error || `${c?.status || r.message}` })
  } catch (err: any) {
    ElMessage.error(err?.message || '执行失败')
  } finally {
    running.value = ''
  }
}

// ---- AI 生成 ----
const aiRunning = ref(false)
const aiProgress = ref('')

async function genAiCases() {
  const id = lookup.value?.endpoint?.id
  const project = lookup.value?.endpoint?.project
  if (!id || !project) return
  aiRunning.value = true
  try {
    let job = await apiClient.startAiCases({ project, endpointIds: [id], onlyUncovered: false })
    while (job.running) {
      aiProgress.value = `生成中 ${job.done}/${job.total}`
      await new Promise((r) => setTimeout(r, 2000))
      job = await apiClient.getAiCaseJob(job.id)
    }
    const it = job.items?.[0]
    if (it?.status === 'FAILED') ElMessage.error(it.note || '生成失败')
    else if (it?.status === 'SKIPPED') ElMessage.info(it.note || '跳过')
    else ElMessage.success(`生成 ${it?.cases || 0} 条用例，${it?.enabled || 0} 条已启用（没有执行）`)
    await loadLookup()
  } catch (err: any) {
    ElMessage.error(err?.message || '生成失败')
  } finally {
    aiRunning.value = false
    aiProgress.value = ''
  }
}

// ---- 并发 ----
const burst = reactive({ caseId: '', count: 5, varyParam: '', values: '' })
const burstRunning = ref(false)
const burstResult = ref<Awaited<ReturnType<typeof apiClient.burstApiCase>> | null>(null)

function fillValues() {
  burst.values = burst.varyParam ? Array.from({ length: burst.count }, (_, i) => `qa_${i + 1}`).join(',') : ''
}

async function runBurst() {
  if (!burst.caseId) return
  burstRunning.value = true
  burstResult.value = null
  try {
    burstResult.value = await apiClient.burstApiCase(burst.caseId, {
      count: burst.count,
      varyParam: burst.varyParam || undefined,
      values: burst.varyParam ? burst.values.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : undefined
    })
  } catch (err: any) {
    ElMessage.error(err?.message || '并发执行失败')
  } finally {
    burstRunning.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，手动选中复制')
  }
}

watch(
  () => props.ctx.key,
  () => {
    if (reqRows.value.length) tab.value = 'req'
    else if (respRows.value.length) tab.value = 'resp'
    else if (props.ctx.risks.length) tab.value = 'conc'
    else if (props.ctx.findings.length) tab.value = 'risk'
    else if (showDeps.value) tab.value = 'deps'
    else tab.value = 'cases'
    burstResult.value = null
    Object.assign(burst, { caseId: '', varyParam: '', values: '' })
    for (const k of Object.keys(runs)) delete runs[k]
    loadLookup()
  },
  { immediate: true }
)
</script>

<style scoped>
.ewb-must {
  margin: 10px 0 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}

.ewb-why {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ewb-tips {
  margin: 0 0 10px;
  padding: 6px 12px 6px 26px;
  border-left: 3px solid #e3a008;
  border-radius: 0 6px 6px 0;
  background: #fffbeb;
  font-size: 12.5px;
  line-height: 1.75;
  color: #7c5a10;
}

.ewb-why b {
  color: var(--el-text-color-primary);
}

.ewb-why-text {
  color: var(--el-text-color-regular);
}

.ewb-spacer {
  flex: 1;
}

.ewb-n {
  margin-left: 3px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11.5px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.ewb-n.hot {
  background: #ffe2e0;
  color: #cf222e;
}

.ewb-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ewb-warn {
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
}

.ewb-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.ewb-gap {
  margin-top: 10px;
}

.ewb-gap-b {
  margin-bottom: 8px;
}

.ewb-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.ewb-tool {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.ewb-tool-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.ewb-tool-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ewb-sec + .ewb-sec {
  margin-top: 16px;
}

.ewb-sec-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ewb-ddl {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: #9a6700;
}

.ewb-hint {
  font-size: 12.5px;
  line-height: 1.7;
}

.ewb-impls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ewb-impl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ewb-finding {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.ewb-finding + .ewb-finding {
  margin-top: 8px;
}

.ewb-finding.risk {
  border-left: 3px solid #cf222e;
}

.ewb-finding-title {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.ewb-case-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
</style>
