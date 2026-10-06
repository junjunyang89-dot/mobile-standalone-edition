<template>
  <el-dialog
    :model-value="modelValue"
    width="960px"
    top="4vh"
    :show-close="false"
    append-to-body
    class="run-report-dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="rr-head">
        <div class="rr-head-main">
          <h2 class="rr-title">报告详情</h2>
          <p class="rr-sub">{{ subtitle }}</p>
        </div>
        <button type="button" class="rr-close" aria-label="关闭" @click="emit('update:modelValue', false)">×</button>
      </div>
    </template>

    <div v-loading="loading" class="rr-body">
      <template v-if="run">
        <div class="rr-stats">
          <div v-for="s in stats" :key="s.key" class="rr-stat" :class="s.cls">
            <span class="rr-stat-icon">{{ s.icon }}</span>
            <div class="rr-stat-text">
              <div class="rr-stat-num">{{ s.value }}</div>
              <div class="rr-stat-label">{{ s.label }}</div>
              <div class="rr-stat-sub">{{ s.sub }}</div>
            </div>
          </div>
        </div>

        <div v-if="kindBreakdown.length" class="rr-kinds">
          <span class="rr-kinds-k">按用例类型</span>
          <span v-for="k in kindBreakdown" :key="k.key" class="rr-kind">
            <span class="kind-tag" :class="k.cls">{{ k.text }}</span>
            <span class="is-pass">通过 {{ k.passed }}</span>
            <span :class="k.failed ? 'is-fail' : 'is-zero'">失败 {{ k.failed }}</span>
            <span v-if="k.blocked" class="is-blocked">没跑成 {{ k.blocked }}</span>
          </span>
        </div>

        <div class="rr-meta">
          <span class="rr-env" :class="isProd ? 'is-prod' : 'is-test'">{{ isProd ? 'PROD' : 'TEST' }}</span>
          <span class="rr-meta-k">开始</span>
          <span class="rr-meta-v mono">{{ fmt(run.createdAt) }}</span>
          <span class="rr-dot">·</span>
          <span class="rr-meta-k">触发</span>
          <span class="rr-meta-v">{{ run.triggerType === 'SCHEDULE' ? '定时任务' : '手动' }}</span>
          <span class="rr-dot">·</span>
          <span class="rr-meta-k">执行人</span>
          <span class="rr-meta-v">{{ run.createdBy || (run.triggerType === 'SCHEDULE' ? '系统' : '—') }}</span>
          <span class="rr-spacer" />
          <button v-if="rerunIds.length" type="button" class="rr-link" :disabled="rerunning" @click="rerunFailed">
            ↻ {{ rerunning ? '重跑中…' : `重跑失败的 ${rerunIds.length} 条` }}
          </button>
          <button type="button" class="rr-link" @click="exportReport">↓ 导出报告</button>
        </div>

        <section v-for="c in cases" :key="c.id" class="rr-case" :class="statusCls(c)">
          <header class="rr-case-head" @click="toggleCase(c)">
            <span class="rr-badge">{{ statusText(c) }}</span>
            <span
              v-if="c.intent"
              class="rr-intent"
              :class="c.intent"
              :title="c.intent === 'NEGATIVE' ? '故意传不对的参数，看接口怎么处理；报错可能正是期望的结果' : '正常用法'"
            >{{ c.intent === 'NEGATIVE' ? '异常输入' : '正常' }}</span>
            <span class="rr-case-name" :title="c.name">{{ c.name || fallbackTitle(c) }}</span>
            <span class="rr-spacer" />
            <span v-if="c.httpStatus" class="rr-http mono" :class="httpOk(c) ? 'is-ok' : 'is-bad'">
              HTTP {{ c.httpStatus }}
            </span>
            <span class="rr-ms mono">{{ c.durationMs ?? 0 }}ms</span>
            <span class="rr-caret" :class="{ open: isOpen(c) }">▾</span>
          </header>

          <div v-if="isOpen(c)" class="rr-case-body">
            <div v-if="c.expectNote" class="rr-expect" :class="{ suspect: c.expectNote.includes('疑似问题') }">
              {{ c.expectNote }}
            </div>
            <div v-if="c.url" class="rr-url">
              <span class="rr-method mono">{{ (c.method || 'GET').toUpperCase() }}</span>
              <span class="rr-url-text mono" :title="c.url">
                {{ splitUrl(c.url).base }}<span v-if="splitUrl(c.url).query" class="rr-url-q">{{ splitUrl(c.url).query }}</span>
              </span>
              <button type="button" class="rr-mini" @click="copyText(c.url)">⧉ 复制</button>
            </div>

            <div v-if="tabsOf(c).length" class="rr-tabs">
              <button
                v-for="t in tabsOf(c)"
                :key="t.key"
                type="button"
                class="rr-tab"
                :class="{ active: activeTab(c) === t.key, 'is-fail': t.key === 'check' && c.status !== 'PASSED' }"
                @click="tabState[c.id] = t.key"
              >
                {{ t.label }}<span class="rr-tab-count">{{ t.count }}</span>
              </button>
              <span class="rr-spacer" />
              <button type="button" class="rr-link" @click="fullState[c.id] = !fullState[c.id]">
                {{ fullState[c.id] ? '收起' : '全部展开' }}
              </button>
            </div>

            <div v-if="tabsOf(c).length" class="rr-viewer">
              <div v-if="activeTab(c) === 'check'" class="rr-check" :class="{ 'is-full': fullState[c.id] }">
                <ol v-if="c.status !== 'PASSED'" class="rr-steps">
                  <li v-for="(st, i) in reasonsOf(c)" :key="i" class="rr-step" :class="'is-' + st.kind">
                    <div class="rr-step-row">
                      <span class="rr-step-no">{{ i + 1 }}</span>
                      <span class="rr-step-title">{{ st.title }}</span>
                      <span v-if="st.tag" class="rr-step-tag">{{ st.tag }}</span>
                    </div>
                    <div class="rr-step-text">
                      <template v-if="st.kind === 'assert'">
                        期望 <code class="rr-code-inline">{{ st.expect }}</code>
                        <template v-if="st.actual">
                          <span class="rr-dot">·</span>实际 <b class="rr-actual mono">{{ st.actual }}</b>
                        </template>
                      </template>
                      <template v-else>
                        {{ st.lead }}<code v-if="st.code" class="rr-code-inline">{{ st.code }}</code>{{ st.tail }}
                      </template>
                    </div>
                    <div v-if="st.kind === 'pre' && i < reasonsOf(c).length - 1" class="rr-step-link">↓ 由此导致</div>
                  </li>
                </ol>
                <div v-if="c.status !== 'PASSED' && passedAsserts(c).length" class="rr-check-sub">
                  其余 {{ passedAsserts(c).length }} 条断言通过
                </div>
                <div v-if="c.status === 'PASSED' || passedAsserts(c).length" class="rr-asserts">
                  <div v-for="(a, i) in passedAsserts(c)" :key="i" class="rr-assert">
                    <span class="rr-assert-ok">✓</span>
                    <code class="rr-code-inline">{{ a.expect }}</code>
                    <span v-if="a.actual" class="rr-assert-actual">实际 <b class="mono">{{ a.actual }}</b></span>
                  </div>
                </div>
              </div>
              <template v-else-if="activeTab(c) === 'resp' || activeTab(c) === 'reqBody'">
                <div class="rr-viewer-head">
                  <span>{{ activeTab(c) === 'resp' ? contentTypeLabel(c) : '请求体' }}</span>
                  <input
                    v-model="searchState[c.id]"
                    class="rr-search"
                    type="search"
                    placeholder="搜字段 / 内容"
                    @keydown.enter.prevent="jumpMatch(c, 1)"
                  />
                  <span v-if="(searchState[c.id] || '').trim()" class="rr-search-meta">
                    {{
                      bodyMatchCount(c)
                        ? `${(matchIndex[c.id] || 0) + 1}/${bodyMatchCount(c)}`
                        : '无匹配'
                    }}
                  </span>
                  <button
                    v-if="bodyMatchCount(c) > 1"
                    type="button"
                    class="rr-mini"
                    title="上一个"
                    @click="jumpMatch(c, -1)"
                  >
                    ↑
                  </button>
                  <button
                    v-if="bodyMatchCount(c) > 1"
                    type="button"
                    class="rr-mini"
                    title="下一个"
                    @click="jumpMatch(c, 1)"
                  >
                    ↓
                  </button>
                  <span class="rr-spacer" />
                  <button type="button" class="rr-mini" @click="copyText(activeTab(c) === 'resp' ? c.bodyPreview : c.reqBody)">
                    ⧉ 复制
                  </button>
                  <button v-if="activeTab(c) === 'resp'" type="button" class="rr-mini" @click="downloadBody(c)">↓ 下载</button>
                </div>
                <div
                  class="rr-code"
                  :class="{ 'is-full': fullState[c.id] }"
                  :ref="(el) => setCodeRef(c.id, el)"
                >
                  <div
                    v-for="(ln, i) in displayLines(c)"
                    :key="i"
                    class="rr-line"
                    :class="{ 'is-hit': ln.hasHit }"
                  >
                    <span class="rr-ln">{{ i + 1 }}</span>
                    <span class="rr-lc" v-html="ln.html" />
                  </div>
                </div>
              </template>
              <div v-else class="rr-kv" :class="{ 'is-full': fullState[c.id] }">
                <div
                  v-for="row in headerRows(activeTab(c) === 'respHeaders' ? c.respHeaders : c.reqHeaders)"
                  :key="row.key"
                  class="rr-kv-row"
                >
                  <span class="rr-kv-k mono">{{ row.key }}</span>
                  <span class="rr-kv-v mono">{{ activeTab(c) === 'reqHeaders' ? maskHeader(row.key, row.value) : row.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
      <div v-else-if="!loading" class="rr-empty">报告不存在或已被删除</div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'
import { guardProdRun } from '../utils/writeEffect'
import { CASE_KIND_META, loadCaseKindIndex, type ApiCaseKind } from '../utils/caseKind'

const props = defineProps<{ modelValue: boolean; runId: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  /** 重跑产生了新报告，父页面据此刷新列表 */
  (e: 'changed', runId?: string): void
}>()

const currentId = ref('')
const loading = ref(false)
const run = ref<any>(null)
const cases = ref<any[]>([])
const kindIndex = ref<Awaited<ReturnType<typeof loadCaseKindIndex>>>(null)
const rerunning = ref(false)
const openState = reactive<Record<string, boolean>>({})
const tabState = reactive<Record<string, string>>({})
const fullState = reactive<Record<string, boolean>>({})
/** 每条用例各自的搜索词；响应体可能很长，分开记才不会串 */
const searchState = reactive<Record<string, string>>({})
const matchIndex = reactive<Record<string, number>>({})
const codeRefs = new Map<string, HTMLElement>()
let lineCache = new Map<string, string[]>()

watch(
  () => [props.modelValue, props.runId] as const,
  ([open, id]) => {
    if (open && id && id !== currentId.value) {
      currentId.value = id
      load()
    }
  },
  { immediate: true }
)

async function load() {
  loading.value = true
  run.value = null
  cases.value = []
  lineCache = new Map()
  codeRefs.clear()
  for (const k of Object.keys(openState)) delete openState[k]
  for (const k of Object.keys(tabState)) delete tabState[k]
  for (const k of Object.keys(fullState)) delete fullState[k]
  for (const k of Object.keys(searchState)) delete searchState[k]
  for (const k of Object.keys(matchIndex)) delete matchIndex[k]
  loadCaseKindIndex().then((m) => (kindIndex.value = m))
  try {
    const d = await apiClient.getApiTestRunDetail(currentId.value)
    run.value = d?.run || null
    cases.value = d?.cases || []
    const bad = cases.value.filter((c) => c.status !== 'PASSED')
    for (const c of bad.length ? bad : cases.value.slice(0, 1)) openState[c.id] = true
  } catch (e: any) {
    ElMessage.error(e?.message || '加载报告失败')
  } finally {
    loading.value = false
  }
}

const isProd = computed(() => String(run.value?.environment || '').toUpperCase() === 'PROD')

const subtitle = computed(() => {
  const r = run.value
  if (!r) return ''
  if (r.collectionName) {
    return `用例集合 · ${r.collectionName}` + (r.seqNo ? ` | 第 ${r.seqNo} 次执行` : '')
  }
  return `单次执行 · ${r.total ?? cases.value.length} 条用例`
})

function skippedOf(r: any): number {
  if (r?.skipped != null) return Number(r.skipped)
  const m = String(r?.message || '').match(/跳过\s*(\d+)\s*条/)
  return m ? Number(m[1]) : 0
}

const stats = computed(() => {
  const r = run.value || {}
  const total = Number(r.total || 0)
  const passed = Number(r.passed || 0)
  const failed = Number(r.failed || 0)
  const blocked = Number(r.blocked || 0)
  const ran = total - blocked
  const skipped = skippedOf(r)
  return [
    {
      key: 'pass', icon: '✓', label: '通过', value: passed,
      sub: !ran ? '—' : passed === ran ? '跑到的全部通过' : `跑到 ${ran} 条`,
      cls: passed ? 'is-pass' : 'is-pass is-zero'
    },
    {
      key: 'fail', icon: '✕', label: '失败', value: failed,
      sub: failed ? '断言没过，需排查' : '—', cls: failed ? 'is-fail' : 'is-fail is-zero'
    },
    ...(blocked
      ? [{
          key: 'blocked', icon: '!', label: '没跑成', value: blocked,
          sub: '连不上 / 超时 / 登录失败，不算失败', cls: 'is-blocked'
        }]
      : []),
    {
      key: 'skip', icon: '—', label: '跳过', value: skipped,
      sub: skipped ? '只在测试跑的用例' : '—', cls: 'is-skip'
    },
    { key: 'dur', icon: '⏱', label: '总耗时', value: dur(r.durationMs), sub: `${total} 条用例`, cls: 'is-dur' }
  ]
})

const KIND_ORDER: Array<ApiCaseKind | 'GONE'> = ['BRANCH', 'REGRESSION', 'UNCLASSIFIED', 'GONE']

function caseKindOfResult(c: any): ApiCaseKind | 'GONE' | null {
  if (!kindIndex.value) return null
  return kindIndex.value.get(String(c.caseId || ''))?.caseKind || 'GONE'
}

/** 分支用例挂了＝这次改动有问题，回归挂了＝回归了。分开摆原始数，不合成一个通过率 */
const kindBreakdown = computed(() => {
  if (!kindIndex.value || !cases.value.length) return []
  const acc = new Map<string, { passed: number; failed: number; blocked: number }>()
  for (const c of cases.value) {
    const k = caseKindOfResult(c)!
    const b = acc.get(k) || { passed: 0, failed: 0, blocked: 0 }
    if (c.status === 'PASSED') b.passed++
    else if (c.status === 'BLOCKED') b.blocked++
    else b.failed++
    acc.set(k, b)
  }
  return KIND_ORDER.filter((k) => acc.has(k)).map((k) => ({
    key: k,
    text: k === 'GONE' ? '用例已删除' : CASE_KIND_META[k].text,
    cls: k === 'GONE' ? 'is-unclassified' : CASE_KIND_META[k].cls,
    ...acc.get(k)!
  }))
})

function statusText(c: any) {
  if (c.status === 'PASSED') return '通过'
  if (c.status === 'BLOCKED') return '没跑成'
  return '失败'
}

function statusCls(c: any) {
  if (c.status === 'PASSED') return 'is-pass'
  if (c.status === 'BLOCKED') return 'is-blocked'
  return 'is-fail'
}

function httpOk(c: any) {
  const s = Number(c.httpStatus || 0)
  return s >= 200 && s < 400
}

function fallbackTitle(c: any) {
  const url = String(c.path || c.url || '')
  return `${String(c.method || 'GET').toUpperCase()} ${url.split('?')[0]}`
}

function isOpen(c: any) {
  return !!openState[c.id]
}

function toggleCase(c: any) {
  openState[c.id] = !openState[c.id]
}

function splitUrl(url: string) {
  const i = url.indexOf('?')
  return i >= 0 ? { base: url.slice(0, i), query: url.slice(i) } : { base: url, query: '' }
}

// ---------- 失败原因 ----------

type Step = {
  kind: 'pre' | 'assert' | 'error'
  title: string
  tag?: string
  lead?: string
  code?: string
  tail?: string
  expect?: string
  actual?: string
}

const AUTH_PREFIX = '自动登录失败（'

function assertLines(raw: any): string[] {
  if (!raw) return []
  return (Array.isArray(raw) ? raw : String(raw).split('\n')).map((s: string) => s.trim()).filter(Boolean)
}

function assertTag(expr: string) {
  if (/^(status|默认断言)/.test(expr)) return 'status'
  if (expr.startsWith('bodyIncludes')) return 'body'
  if (expr.startsWith('header')) return 'header'
  if (expr.startsWith('耗时')) return '耗时'
  if (expr.startsWith('jsonPath')) return 'jsonPath'
  if (expr.startsWith('dbDelta')) return 'dbDelta'
  if (expr.startsWith('db') || expr.startsWith('库查询') || expr.startsWith('选库')) return 'db'
  return ''
}

function prettyExpr(s: string) {
  return s.replace(/\s*(==|!=)\s*/g, ' $1 ').replace(/\s+/g, ' ').trim()
}

function parseAssert(body: string) {
  const m = body.match(/^(.*?)[\s，,]实际=(.*)$/)
  return m ? { expect: prettyExpr(m[1]), actual: m[2].trim() } : { expect: prettyExpr(body), actual: '' }
}

function reasonsOf(c: any): Step[] {
  const steps: Step[] = []
  let err = String(c.error || '').trim()
  if (err.startsWith(AUTH_PREFIX)) {
    const end = err.indexOf('）；')
    const inner = end > 0 ? err.slice(AUTH_PREFIX.length, end) : err.slice(AUTH_PREFIX.length).replace(/）$/, '')
    err = end > 0 ? err.slice(end + 2).trim() : ''
    const sep = inner.search(/[：:]/)
    steps.push({
      kind: 'pre',
      title: '前置步骤失败',
      tag: '自动登录',
      lead: sep > 0 ? inner.slice(0, sep) + '：' : inner,
      code: sep > 0 ? inner.slice(sep + 1).trim() : '',
      tail: '。请求没带上有效 token，后面的接口自然查不到数据。'
    })
  }
  const fails = assertLines(c.assertionResults).filter((l) => l.startsWith('FAIL'))
  for (const line of fails) {
    const body = line.replace(/^FAIL\s+/, '')
    const { expect, actual } = parseAssert(body)
    steps.push({ kind: 'assert', title: '断言未通过', tag: assertTag(body), expect, actual })
  }
  if (c.status === 'BLOCKED' && err) {
    steps.push({
      kind: 'error',
      title: '没跑成',
      tag: '网络 / 环境',
      lead: '请求没发出去或没收到响应，断言一条都没跑：',
      code: err
    })
  } else if (!fails.length && err) {
    steps.push({ kind: 'error', title: '执行出错', lead: '', code: err })
  }
  if (!steps.length) steps.push({ kind: 'error', title: '断言未通过', lead: '没有记录到具体原因' })
  return steps
}

function passedAsserts(c: any) {
  return assertLines(c.assertionResults)
    .filter((l) => l.startsWith('OK'))
    .map((l) => parseAssert(l.replace(/^OK\s+/, '')))
}

// ---------- 请求 / 响应 ----------

function headerRows(raw: any): Array<{ key: string; value: string }> {
  let o = raw
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw)
    } catch {
      o = null
    }
  }
  if (!o || typeof o !== 'object') return []
  return Object.entries(o).map(([key, value]) => ({ key, value: String(value ?? '') }))
}

const SENSITIVE = ['token', 'authorization', 'cookie', 'x-api-key', 'x-auth-token']

function maskHeader(key: string, value: string) {
  if (!SENSITIVE.some((h) => key.toLowerCase().includes(h))) return value
  const v = String(value || '').trim()
  if (!v) return v
  return v.length <= 12 ? '***（已遮掩）' : `${v.slice(0, 8)}…${v.slice(-4)}（已遮掩）`
}

function byteSize(s?: string) {
  const n = s ? new TextEncoder().encode(s).length : 0
  if (n < 1024) return n + ' B'
  return (n / 1024).toFixed(1) + ' KB'
}

/** 第一个页签放断言 / 失败原因：断言可能几十条，摊在页签上面会把弹窗撑得很长 */
function tabsOf(c: any) {
  const tabs: Array<{ key: string; label: string; count: string | number }> = []
  if (c.status !== 'PASSED') {
    tabs.push({ key: 'check', label: '失败原因', count: reasonsOf(c).length })
  } else {
    const n = passedAsserts(c).length
    if (n) tabs.push({ key: 'check', label: '断言', count: n })
  }
  if (c.bodyPreview) tabs.push({ key: 'resp', label: '响应体', count: byteSize(c.bodyPreview) })
  const rh = headerRows(c.respHeaders).length
  if (rh) tabs.push({ key: 'respHeaders', label: '响应头', count: rh })
  const qh = headerRows(c.reqHeaders).length
  if (qh) tabs.push({ key: 'reqHeaders', label: '请求头', count: qh })
  if (c.reqBody) tabs.push({ key: 'reqBody', label: '请求体', count: byteSize(c.reqBody) })
  return tabs
}

function activeTab(c: any) {
  const tabs = tabsOf(c)
  const cur = tabState[c.id]
  return tabs.some((t) => t.key === cur) ? cur : tabs[0]?.key
}

function contentTypeLabel(c: any) {
  const row = headerRows(c.respHeaders).find((r) => r.key.toLowerCase() === 'content-type')
  if (!row) return '响应体'
  const [type, ...params] = row.value.split(';').map((s) => s.trim())
  const charset = params.find((p) => /^charset=/i.test(p))
  return charset ? `${type} · ${charset.split('=')[1].toUpperCase()}` : type
}

function pretty(raw?: string) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlight(line: string) {
  return escapeHtml(line).replace(
    /(&quot;(?:\\.|[^&\\]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
    (m, str, colon) => {
      if (colon) return `<span class="jk">${str}</span>${colon}`
      if (str) return `<span class="js">${str}</span>`
      if (m === 'true' || m === 'false' || m === 'null') return `<span class="jb">${m}</span>`
      return `<span class="jn">${m}</span>`
    }
  )
}

/** 按 用例+页签 缓存：响应体可能很长，每次重渲染都重新格式化会卡 */
function codeLines(key: string, raw?: string) {
  const hit = lineCache.get(key)
  if (hit) return hit
  const lines = pretty(raw).split('\n').map(highlight)
  lineCache.set(key, lines)
  return lines
}

function bodyRawOf(c: any) {
  return activeTab(c) === 'resp' ? c.bodyPreview : c.reqBody
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function bodyMatchCount(c: any) {
  const q = (searchState[c.id] || '').trim()
  if (!q) return 0
  return pretty(bodyRawOf(c)).match(new RegExp(escapeRegExp(q), 'gi'))?.length ?? 0
}

/** 在已高亮的 HTML 上行内再标搜索命中；query 先 escape，才能对上 &quot; 这类实体 */
function decorateSearch(html: string, query: string) {
  if (!query) return html
  const q = escapeHtml(query)
  return html.replace(new RegExp(escapeRegExp(q), 'gi'), (m) => `<mark class="rr-hl">${m}</mark>`)
}

function displayLines(c: any) {
  const tab = activeTab(c)
  const raw = bodyRawOf(c)
  const q = (searchState[c.id] || '').trim()
  return codeLines(`${c.id}:${tab}`, raw).map((html) => {
    const decorated = decorateSearch(html, q)
    return { html: decorated, hasHit: q ? decorated.includes('<mark class="rr-hl">') : false }
  })
}

function setCodeRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) codeRefs.set(id, el)
  else codeRefs.delete(id)
}

async function jumpMatch(c: any, step: number) {
  await nextTick()
  const root = codeRefs.get(c.id)
  if (!root) return
  const marks = root.querySelectorAll('mark.rr-hl')
  if (!marks.length) return
  const n = marks.length
  const cur = matchIndex[c.id] || 0
  const next = step === 0 ? 0 : (cur + step + n) % n
  matchIndex[c.id] = next
  marks.forEach((m, i) => m.classList.toggle('rr-hl-active', i === next))
  marks[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

watch(
  () => ({ ...searchState }),
  async () => {
    await nextTick()
    for (const c of cases.value) {
      if (!(searchState[c.id] || '').trim()) continue
      matchIndex[c.id] = 0
      await jumpMatch(c, 0)
    }
  }
)

async function copyText(s?: string) {
  try {
    await navigator.clipboard.writeText(s || '')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)
}

function downloadBody(c: any) {
  const isJson = contentTypeLabel(c).includes('json')
  saveFile(`${safeName(c.name || 'response')}.${isJson ? 'json' : 'txt'}`, pretty(c.bodyPreview), 'text/plain;charset=utf-8')
}

// ---------- 重跑 / 导出 ----------

const rerunIds = computed(() => [
  ...new Set(cases.value.filter((c) => c.status !== 'PASSED' && c.caseId).map((c) => c.caseId as string))
])

async function rerunFailed() {
  let ids = rerunIds.value
  if (!ids.length) return
  let env: 'PROD' | 'TEST' = isProd.value ? 'PROD' : 'TEST'
  if (isProd.value) {
    const refs = ids.map((id) => {
      const c = cases.value.find((x) => x.caseId === id) || {}
      return { id, name: c.name, method: c.method, path: c.path, durationMs: c.durationMs }
    })
    const g = await guardProdRun(refs)
    if (g.mode === 'cancel') return
    ids = g.ids
    env = g.env
  }
  rerunning.value = true
  try {
    const res = await apiClient.runApiTest({ caseIds: ids, environment: env, confirmProd: env === 'PROD' })
    ElMessage[res.ok ? 'success' : 'warning'](res.message || '已重跑')
    emit('changed', res.runId)
    if (res.runId) {
      currentId.value = res.runId
      await load()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '重跑失败')
  } finally {
    rerunning.value = false
  }
}

function exportReport() {
  const r = run.value
  if (!r) return
  const out: string[] = []
  out.push(`# 接口测试报告`, '')
  out.push(`- ${subtitle.value}`)
  out.push(`- 环境：${isProd.value ? 'PROD（线上）' : 'TEST（测试）'}`)
  out.push(`- 开始：${fmt(r.createdAt)}　触发：${r.triggerType === 'SCHEDULE' ? '定时任务' : '手动'}　执行人：${r.createdBy || '—'}`)
  out.push(`- 结果：${stats.value.map((s) => `${s.label} ${s.value}`).join('，')}`, '')
  for (const c of cases.value) {
    out.push(`## [${statusText(c)}] ${c.name || fallbackTitle(c)}`, '')
    out.push(`\`${(c.method || 'GET').toUpperCase()} ${c.url || ''}\``, '')
    out.push(`HTTP ${c.httpStatus ?? '—'} · ${c.durationMs ?? 0}ms`, '')
    if (c.status !== 'PASSED') {
      reasonsOf(c).forEach((st, i) => {
        const text = st.kind === 'assert'
          ? `期望 \`${st.expect}\`${st.actual ? ` · 实际 ${st.actual}` : ''}`
          : `${st.lead || ''}${st.code ? `\`${st.code}\`` : ''}${st.tail || ''}`
        out.push(`${i + 1}. **${st.title}**${st.tag ? `（${st.tag}）` : ''}：${text}`)
      })
      out.push('')
    }
    if (c.bodyPreview) out.push('响应体：', '', '```json', pretty(c.bodyPreview), '```', '')
  }
  const name = `接口报告_${safeName(r.collectionName || '单次执行')}_${fmt(r.createdAt).replace(/[-: ]/g, '')}.md`
  saveFile(name, out.join('\n'), 'text/markdown;charset=utf-8')
}

function fmt(s?: string) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : ''
}

function dur(ms?: number) {
  const n = Number(ms || 0)
  if (n < 1000) return Math.round(n) + 'ms'
  if (n < 60000) return (n / 1000).toFixed(1) + 's'
  return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's'
}
</script>

<style scoped>
.rr-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.rr-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.rr-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rr-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.rr-close:hover {
  background: var(--el-fill-color-dark);
  color: var(--app-text-regular);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.rr-spacer {
  flex: 1;
}
.rr-dot {
  color: var(--el-text-color-disabled);
  margin: 0 6px;
}
.rr-body {
  min-height: 160px;
}
.rr-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}

/* 概要卡片 */
.rr-stats {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  overflow: hidden;
}
.rr-stat {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
}
.rr-stat + .rr-stat {
  border-left: 1px solid var(--el-border-color);
}
.rr-stat-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.rr-stat-num {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--app-text-regular);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.rr-stat-label {
  font-size: 12px;
  color: var(--app-text-regular);
  margin-top: 2px;
}
.rr-stat-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.rr-stat.is-pass .rr-stat-icon { background: var(--el-color-success-light-8); color: var(--el-color-success); }
.rr-stat.is-pass .rr-stat-num { color: var(--el-color-success); }
.rr-stat.is-fail .rr-stat-icon { background: var(--el-color-danger-light-8); color: var(--el-color-danger); }
.rr-stat.is-fail .rr-stat-num { color: var(--el-color-danger); }
.rr-stat.is-zero .rr-stat-num { color: var(--el-text-color-secondary); }
.rr-stat.is-blocked .rr-stat-icon { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); font-weight: 700; }
.rr-stat.is-blocked .rr-stat-num { color: var(--el-color-warning-dark-2); }
.rr-stat.is-skip .rr-stat-num,
.rr-stat.is-dur .rr-stat-num { color: var(--el-text-color-secondary); }

/* 元信息行 */
.rr-kinds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 18px;
  padding: 10px 2px 0;
  font-size: 12px;
}
.rr-kinds-k { color: var(--el-text-color-secondary); }
.rr-kind { display: inline-flex; align-items: center; gap: 8px; }
.rr-kind .is-pass { color: var(--el-color-success); }
.rr-kind .is-fail { color: var(--el-color-danger); font-weight: 600; }
.rr-kind .is-blocked { color: var(--el-color-warning-dark-2); }
.rr-kind .is-zero { color: var(--el-text-color-placeholder); }
.kind-tag { padding: 0 6px; border-radius: 4px; font-size: 11px; line-height: 16px; border: 1px solid transparent; }
.kind-tag.is-branch { color: #0958d9; background: #e6f4ff; border-color: #91caff; }
.kind-tag.is-regression { color: #531dab; background: #f9f0ff; border-color: #d3adf7; }
.kind-tag.is-unclassified { color: #8c8c8c; background: #fafafa; border: 1px dashed #bfbfbf; }
.rr-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 2px;
  font-size: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 14px;
}
.rr-meta .rr-dot {
  margin: 0 4px;
}
.rr-env {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 6px;
}
.rr-env.is-prod { background: var(--el-color-danger-light-8); color: var(--el-color-danger-dark-2); }
.rr-env.is-test { background: var(--el-color-primary-light-8); color: var(--el-color-primary-dark-2); }
.rr-meta-k { color: var(--el-text-color-secondary); }
.rr-meta-v { color: var(--el-text-color-primary); font-weight: 500; }
.rr-link {
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.rr-link:hover:not(:disabled) { color: var(--el-color-primary-dark-2); text-decoration: underline; }
.rr-link:disabled { color: var(--el-text-color-secondary); cursor: default; }

/* 用例卡片 */
.rr-case {
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 12px;
}
.rr-case.is-fail { border-color: var(--el-color-danger-light-7); }
.rr-case.is-blocked { border-color: var(--el-color-warning-light-7); }
.rr-case-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
}
.rr-case.is-pass .rr-case-head { background: var(--el-color-success-light-9); }
.rr-case.is-fail .rr-case-head { background: var(--el-color-danger-light-9); }
.rr-case.is-blocked .rr-case-head { background: var(--el-color-warning-light-9); }
.rr-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  flex-shrink: 0;
}
.rr-case.is-pass .rr-badge { background: var(--el-color-success); }
.rr-case.is-fail .rr-badge { background: var(--el-color-danger); }
.rr-case.is-blocked .rr-badge { background: var(--el-color-warning-dark-2); }
.rr-intent {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
}
.rr-intent.NORMAL {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}
.rr-expect {
  margin-bottom: 10px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 4px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
}
.rr-expect.suspect {
  color: var(--el-color-danger-dark-2);
  background: var(--el-color-danger-light-9);
}
.rr-case-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rr-http { font-size: 12px; font-weight: 600; }
.rr-http.is-ok { color: var(--el-color-success); }
.rr-http.is-bad { color: var(--el-color-danger); }
.rr-ms { font-size: 12px; color: var(--el-text-color-secondary); }
.rr-caret {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  transition: transform 0.15s;
  transform: rotate(-90deg);
}
.rr-caret.open { transform: none; }
.rr-case-body {
  padding: 12px 14px 14px;
}

.rr-url {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.rr-method {
  font-size: 11px;
  font-weight: 700;
  color: var(--el-color-success);
  flex-shrink: 0;
}
.rr-url-text {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}
.rr-url-q { color: var(--el-text-color-secondary); }
.rr-mini {
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--app-text-regular);
  cursor: pointer;
}
.rr-mini:hover { border-color: var(--el-color-primary-light-5); color: var(--el-color-primary); }
.rr-mini + .rr-mini { margin-left: 6px; }

/* 失败原因 */
.rr-steps {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rr-step + .rr-step { margin-top: 8px; }
.rr-step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rr-step-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.rr-step-title { font-size: 13px; font-weight: 600; }
.rr-step-tag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
}
.rr-step.is-pre .rr-step-no { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); }
.rr-step.is-pre .rr-step-title { color: var(--el-color-warning-dark-2); }
.rr-step.is-pre .rr-step-tag { background: var(--el-color-warning-light-8); color: var(--el-color-warning-dark-2); }
.rr-step.is-assert .rr-step-no,
.rr-step.is-error .rr-step-no { background: var(--el-color-danger-light-8); color: var(--el-color-danger); }
.rr-step.is-assert .rr-step-title,
.rr-step.is-error .rr-step-title { color: var(--el-color-danger); }
.rr-step.is-assert .rr-step-tag,
.rr-step.is-error .rr-step-tag { background: var(--el-color-danger-light-8); color: var(--el-color-danger); }
.rr-step-text {
  margin: 4px 0 0 28px;
  font-size: 12.5px;
  color: var(--app-text-regular);
  line-height: 1.7;
  word-break: break-all;
}
.rr-step-link {
  margin: 4px 0 0 9px;
  padding: 2px 0 2px 17px;
  border-left: 2px solid var(--el-border-color);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.rr-code-inline {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 0 5px;
  margin: 0 2px;
  color: var(--el-text-color-primary);
}
.rr-actual { color: var(--el-color-danger); }

.rr-asserts { display: flex; flex-direction: column; gap: 4px; }
.rr-assert { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.rr-assert-ok { color: var(--el-color-success); font-weight: 700; }
.rr-assert-actual { color: var(--el-text-color-secondary); }
.rr-assert-actual b { color: var(--el-color-success); font-weight: 500; }

/* 请求 / 响应 */
.rr-tabs {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-top: 14px;
  border-bottom: 1px solid var(--el-border-color);
}
.rr-tab {
  border: none;
  background: none;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.rr-tab.active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 500;
}
.rr-tab-count {
  margin-left: 6px;
  font-size: 10.5px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.rr-tab.active .rr-tab-count { background: var(--el-color-primary-light-8); color: var(--el-color-primary); }
.rr-tab.is-fail { color: var(--el-color-danger); }
.rr-tab.is-fail .rr-tab-count { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.rr-tab.is-fail.active { border-bottom-color: var(--el-color-danger); }
.rr-tabs .rr-link { margin-bottom: 6px; }

.rr-viewer {
  border: 1px solid var(--el-border-color);
  border-top: none;
  border-radius: 0 0 8px 8px;
}
.rr-viewer-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.rr-search {
  flex: 1;
  min-width: 120px;
  max-width: 280px;
  height: 26px;
  margin: 0 4px 0 12px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 12px;
  outline: none;
}
.rr-search:focus {
  border-color: var(--el-color-primary);
}
.rr-search-meta {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.rr-line.is-hit {
  background: var(--el-color-warning-light-9);
}
.rr-lc :deep(mark.rr-hl) {
  background: #fde68a;
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}
.rr-lc :deep(mark.rr-hl-active) {
  background: #f59e0b;
  color: #111;
}
.rr-code {
  max-height: 320px;
  overflow: auto;
  padding: 8px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.75;
}
.rr-check {
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
}
.rr-check-sub {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rr-code.is-full,
.rr-kv.is-full,
.rr-check.is-full { max-height: none; }
.rr-line { display: flex; }
.rr-ln {
  width: 44px;
  flex-shrink: 0;
  padding-right: 12px;
  text-align: right;
  color: var(--el-text-color-disabled);
  user-select: none;
}
.rr-lc {
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--app-text-regular);
  padding-right: 12px;
}
.rr-lc :deep(.jk) { color: var(--el-color-primary-dark-2); }
.rr-lc :deep(.js) { color: var(--el-color-success-dark-2); }
.rr-lc :deep(.jn) { color: var(--el-color-warning-dark-2); }
.rr-lc :deep(.jb) { color: #7c3aed; }
.rr-kv {
  max-height: 320px;
  overflow: auto;
  padding: 6px 0;
}
.rr-kv-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  padding: 4px 12px;
  font-size: 12px;
}
.rr-kv-row:hover { background: var(--el-fill-color-lighter); }
.rr-kv-k { color: var(--el-text-color-secondary); word-break: break-all; }
.rr-kv-v { color: var(--el-text-color-primary); word-break: break-all; }
</style>

<style>
.run-report-dialog {
  border-radius: 12px;
  padding: 0;
}
.run-report-dialog .el-dialog__header {
  padding: 18px 20px 12px;
  margin: 0;
}
.run-report-dialog .el-dialog__body {
  padding: 0 20px 20px;
  max-height: 84vh;
  overflow: auto;
}
</style>
