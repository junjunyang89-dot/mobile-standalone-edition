<template>
  <div class="ei">
    <div class="ei-bar">
      <el-select
        v-if="projects"
        v-model="proj"
        filterable
        size="small"
        placeholder="这个接口属于哪个项目"
        class="ei-proj"
      >
        <el-option v-for="p in projects" :key="p.code" :label="p.name || p.code" :value="p.code" />
      </el-select>
      <el-button size="small" type="primary" :loading="loading" :disabled="!proj || !path" @click="run">
        {{ result ? '重新体检' : '体检' }}
      </el-button>
      <span class="ei-hint">读本地仓库源码：字段什么意思、代码会返回哪些码、要不要登录、有没有可疑写法</span>
    </div>

    <el-alert v-if="err" type="error" :closable="false" show-icon :title="err" class="ei-gap" />
    <el-alert
      v-else-if="result && !result.located"
      type="warning"
      :closable="false"
      show-icon
      :title="result.reason || '没定位到源码'"
      class="ei-gap"
    >
      <ul v-if="result.candidates?.length" class="ei-cands">
        <li v-for="c in result.candidates" :key="c" class="ei-mono">{{ c }}</li>
      </ul>
    </el-alert>
    <div v-else-if="!result && !loading" class="ei-empty">
      {{ proj ? '点「体检」读源码' : '先选这个接口属于哪个项目，再体检' }}
    </div>

    <template v-if="r">
      <div class="ei-where">
        <span class="ei-mono">{{ baseName(r.file) }}:{{ r.line }}</span>
        <span class="ei-mono">{{ r.handler }}()</span>
        <span v-if="r.returnType">返回 <span class="ei-mono">{{ r.returnType }}</span></span>
        <span v-for="s in r.services" :key="s">调用 <span class="ei-mono">{{ s }}</span></span>
        <span v-if="result?.lastChanged">最后改动 {{ result.lastChanged }}</span>
      </div>

      <el-radio-group v-model="view" size="small" class="ei-gap">
        <el-radio-button label="risk">
          风险
          <b v-if="r.risks.length" :class="['ei-count', topLevel]">{{ r.risks.length }}</b>
        </el-radio-button>
        <el-radio-button label="params">
          参数 <b class="ei-count">{{ params.length }}</b>
          <b v-if="suspectCount" class="ei-count HIGH">{{ suspectCount }} 处可疑</b>
        </el-radio-button>
        <el-radio-button label="codes">返回码</el-radio-button>
        <el-radio-button label="fields">
          字段 <b class="ei-count">{{ r.fields.length }}</b>
          <b v-if="diffCount" class="ei-count HIGH">{{ diffCount }} 处出入</b>
        </el-radio-button>
      </el-radio-group>

      <div v-if="view === 'risk'" class="ei-panel">
        <div v-if="!r.risks.length" class="ei-empty">
          没看出明显问题（只看了接口方法和它直接调的 service 方法）
        </div>
        <div v-for="(x, i) in r.risks" :key="i" class="ei-risk" :class="x.level">
          <div class="ei-risk-head">
            <span class="ei-level" :class="x.level">{{ LEVEL[x.level] }}</span>
            <b>{{ x.title }}</b>
            <span v-if="x.where" class="ei-mono ei-dim">{{ x.where }}</span>
          </div>
          <div class="ei-risk-detail">{{ x.detail }}</div>
        </div>
      </div>

      <div v-else-if="view === 'params'" class="ei-panel">
        <div class="ei-field-bar">
          <span class="ei-dim ei-nomargin">
            每个参数不传、传错类型、越界时代码怎么处理。红色是可疑的：参数不对还返回成功，或者没判空报系统异常
          </span>
          <span class="ei-grow" />
          <el-tooltip
            :disabled="!genDisabledReason"
            :content="genDisabledReason"
            placement="top"
          >
            <span>
              <el-button
                size="small"
                type="primary"
                :loading="generating"
                :disabled="!!genDisabledReason"
                @click="generate"
              >
                按源码生成用例<template v-if="planned.length">（{{ planned.length }}）</template>
              </el-button>
            </span>
          </el-tooltip>
        </div>
        <div v-if="!params.length" class="ei-empty">没认出客户端传的参数（路径参数、请求头、框架注入的参数不算）</div>
        <el-table v-else :data="params" size="small" border max-height="40vh">
          <el-table-column label="参数" min-width="170">
            <template #default="{ row }">
              <div>
                <span class="ei-mono">{{ row.name }}</span>
                <span class="ei-st">{{ row.in === 'body' ? '请求体' : 'query' }}</span>
                <span v-if="row.required" class="ei-st MISSING">必填</span>
              </div>
              <div class="ei-sub">
                <span class="ei-mono" :title="row.javaType">{{ row.javaType }}</span>
                <span v-if="row.comment"> · {{ row.comment }}</span>
              </div>
              <div v-for="w in row.warns" :key="w" class="ei-sub ei-warn">{{ w }}</div>
            </template>
          </el-table-column>
          <el-table-column label="不传" min-width="190">
            <template #default="{ row }">
              <ParamChip v-if="row.missing" :o="row.missing" />
              <span v-else class="ei-dim ei-nomargin">看不出</span>
            </template>
          </el-table-column>
          <el-table-column label="传错类型" min-width="150">
            <template #default="{ row }">
              <ParamChip v-if="row.badType" :o="row.badType" />
              <span v-else class="ei-dim ei-nomargin">—</span>
            </template>
          </el-table-column>
          <el-table-column label="越界 / 取值" min-width="200">
            <template #default="{ row }">
              <div v-for="b in row.bounds" :key="b.value" class="ei-bound">
                <span class="ei-mono">={{ b.value }}</span>
                <span class="ei-dim">{{ b.rule }}</span>
                <ParamChip :o="b.outcome" />
              </div>
              <div v-if="row.values.length" class="ei-bound">
                <span class="ei-dim ei-nomargin">只认 <span class="ei-mono">{{ row.values.join(' / ') }}</span>，别的值</span>
                <ParamChip v-if="row.unsupported" :o="row.unsupported" />
                <span v-else class="ei-dim">看不出</span>
              </div>
              <span v-if="!row.bounds.length && !row.values.length" class="ei-dim ei-nomargin">—</span>
            </template>
          </el-table-column>
        </el-table>
        <template v-if="planned.length">
          <div class="ei-sec">会生成这些用例（抓包那次请求当底子，每条只改一个参数）</div>
          <div v-for="c in planned" :key="c.name" class="ei-plan">
            <span class="ei-intent" :class="c.intent">{{ c.intent === 'NORMAL' ? '正常' : '异常输入' }}</span>
            <span :class="{ 'ei-bad': c.suspect }">{{ c.name }}</span>
            <div class="ei-sub">{{ c.expect }}</div>
          </div>
          <div class="ei-sub ei-gap">
            断言按代码现状写：GET 会先在测试环境试跑一次，和源码推断一致的启用；不一致的停用并写明实际返回。
            标「疑似问题」的是现状本身可疑，找开发确认是不是故意的
          </div>
        </template>
        <div v-else-if="previewReason" class="ei-sub ei-gap">{{ previewReason }}</div>
      </div>

      <div v-else-if="view === 'codes'" class="ei-panel">
        <div class="ei-kv">
          <span class="ei-k">登录</span>
          <span>
            <span :class="loginCls">{{ loginText }}</span>
            <span v-if="r.login.where" class="ei-mono ei-dim">{{ r.login.where }}</span>
          </span>
        </div>
        <div class="ei-kv">
          <span class="ei-k">成功</span>
          <span v-if="r.success">
            <span class="ei-mono">{{ r.success.name }} = {{ r.success.code }}</span>
            <span class="ei-dim">{{ r.success.message }}</span>
            <span class="ei-mono ei-dim">{{ r.success.where }}</span>
            <div v-if="otherSuccess.length" class="ei-sub">
              同一个枚举里还有：
              <span v-for="c in otherSuccess" :key="c.name" class="ei-mono">{{ c.name }} = {{ c.code }}　</span>
              ——断言按这个接口实际用的写
            </div>
          </span>
          <span v-else class="ei-dim">源码里没认出成功码</span>
        </div>
        <div v-if="r.httpAlways200 != null" class="ei-kv">
          <span class="ei-k">HTTP 状态</span>
          <span>
            {{ r.httpAlways200
              ? '全局异常处理不改 HTTP 状态：报错也是 HTTP 200，成败只看业务码'
              : '全局异常处理里有设置 HTTP 状态的地方，部分错误不是 200' }}
          </span>
        </div>
        <div class="ei-sec">接口里会返回的错误</div>
        <el-table v-if="r.errors.length" :data="r.errors" size="small" border>
          <el-table-column label="码" width="220">
            <template #default="{ row }">
              <span class="ei-mono">{{ row.name }}<template v-if="row.code"> = {{ row.code }}</template></span>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="文案" min-width="200" />
          <el-table-column label="位置" width="210">
            <template #default="{ row }"><span class="ei-mono ei-dim">{{ row.where }}</span></template>
          </el-table-column>
        </el-table>
        <div v-else class="ei-empty">接口方法和它调的 service 里没直接抛业务错误码</div>
        <template v-if="r.globalErrors.length">
          <div class="ei-sec">全局异常兜底（任何接口都可能返回）</div>
          <el-table :data="r.globalErrors" size="small" border>
            <el-table-column label="码" width="220">
              <template #default="{ row }">
                <span class="ei-mono">{{ row.name }}<template v-if="row.code"> = {{ row.code }}</template></span>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="文案" min-width="200" />
            <el-table-column label="位置" width="210">
              <template #default="{ row }"><span class="ei-mono ei-dim">{{ row.where }}</span></template>
            </el-table-column>
          </el-table>
        </template>
      </div>

      <div v-else class="ei-panel">
        <div class="ei-field-bar">
          <el-radio-group v-model="fieldFilter" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="diff">和抓包有出入</el-radio-button>
            <el-radio-button label="nodoc">没注释</el-radio-button>
          </el-radio-group>
          <span class="ei-dim">含义来自字段上的注释 / @ApiModelProperty；注释也可能写错，和字段名对不上时以代码逻辑为准</span>
        </div>
        <el-table :data="fieldRows" size="small" border max-height="46vh">
          <el-table-column label="路径" min-width="230">
            <template #default="{ row }"><span class="ei-mono">{{ row.path }}</span></template>
          </el-table-column>
          <el-table-column label="含义" min-width="170">
            <template #default="{ row }">
              <span v-if="row.comment">{{ row.comment }}</span>
              <span v-else class="ei-dim">{{ row.status === 'EXTRA' ? '—' : '代码里没写注释' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="代码类型" width="150">
            <template #default="{ row }">
              <span v-if="row.javaType" class="ei-mono" :title="row.javaType">{{ row.javaType }}</span>
              <span v-else class="ei-dim">—</span>
            </template>
          </el-table-column>
          <el-table-column label="本次抓包" min-width="170">
            <template #default="{ row }">
              <span v-if="row.status" class="ei-st" :class="row.status">{{ STATUS[row.status] || row.status }}</span>
              <span v-if="row.sample" class="ei-mono">{{ row.sample }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch, type PropType } from 'vue'
import { ElMessage, ElTooltip } from 'element-plus'
import {
  apiClient,
  type EndpointInsightResult,
  type InsightField,
  type InsightParam,
  type ParamOutcome,
  type SourceCasePlanned
} from '../api'

function outcomeText(o: ParamOutcome) {
  const code = [o.codeName, o.code].filter(Boolean).join(' ')
  switch (o.kind) {
    case 'REJECT':
      return code ? `报 ${code}` : '报错'
    case 'CRASH':
      return `没判空 → ${code || '异常'}`
    case 'HTTP':
      return `HTTP ${o.code}`
    case 'SILENT':
      return o.returns === 'emptyList' ? '成功，列表为空' : o.returns === 'null' ? '成功，数据为空' : '成功，空对象'
    case 'DEFAULT':
      return '用默认值'
    case 'OPTIONAL':
      return '可选，不传跳过'
    default:
      return '照常返回'
  }
}

/** 一个结论：颜色看性质，悬停看代码在哪一行做了什么 */
const ParamChip = defineComponent({
  props: { o: { type: Object as PropType<ParamOutcome>, required: true } },
  setup(p) {
    return () =>
      h(
        ElTooltip,
        { placement: 'top', showAfter: 200 },
        {
          content: () =>
            h('div', { style: 'max-width: 420px; line-height: 1.6' }, [
              h('div', p.o.detail),
              p.o.message ? h('div', `文案：${p.o.message}`) : null,
              p.o.where ? h('div', { style: 'opacity: .8' }, p.o.where) : null
            ]),
          default: () =>
            h(
              'span',
              { class: ['ei-chip', p.o.kind, { suspect: p.o.suspect }] },
              (p.o.suspect ? '⚠ ' : '') + outcomeText(p.o)
            )
        }
      )
  }
})

const props = defineProps<{
  project?: string
  method: string
  path: string
  /** 抓包响应原文，用来对字段 */
  respSample?: string
  /** 接口清单里的 id：带上才看得到「有没有客户端在调」；只在项目没改过时带 */
  endpointId?: string
  /** 给了就显示项目选择框 */
  projects?: { code: string; name?: string }[]
  /** 打开就自动体检一次 */
  auto?: boolean
}>()
const emit = defineEmits<{
  (e: 'project', code: string): void
  /** 按源码生成了用例，外面刷新用例数 */
  (e: 'generated'): void
}>()

const LEVEL: Record<string, string> = { HIGH: '高', MID: '中', LOW: '低' }
const STATUS: Record<string, string> = {
  OK: '一致',
  NULL: '是 null',
  MISSING: '没返回',
  TYPE: '类型不符',
  EXTRA: '代码里没有',
  SKIP: '上级为空'
}
const DIFF = new Set(['TYPE', 'MISSING', 'EXTRA'])
const MAX_SAMPLE = 300_000

const proj = ref(props.project || '')
const loading = ref(false)
const err = ref('')
const result = ref<EndpointInsightResult | null>(null)
const view = ref<'risk' | 'params' | 'codes' | 'fields'>('risk')
const fieldFilter = ref<'all' | 'diff' | 'nodoc'>('all')
const planned = ref<SourceCasePlanned[]>([])
const previewReason = ref('')
const generating = ref(false)

const r = computed(() => (result.value?.located ? result.value.report : null))
const params = computed<InsightParam[]>(() => r.value?.params || [])
const suspectCount = computed(
  () =>
    params.value.filter(
      (p) =>
        p.missing?.suspect ||
        p.badType?.suspect ||
        p.unsupported?.suspect ||
        p.bounds.some((b) => b.outcome.suspect)
    ).length
)
/** 只有接口清单里的这条（项目没被改过）才能落用例 */
const linkedId = computed(() => (props.endpointId && proj.value === props.project ? props.endpointId : ''))
const genDisabledReason = computed(() => {
  if (!linkedId.value) return '先把接口收进接口清单（项目对得上）再生成'
  if (!planned.value.length) return previewReason.value || '没有可生成的用例'
  return ''
})

watch(
  () => props.project,
  (v) => {
    if (v && !proj.value) proj.value = v
  }
)

const topLevel = computed(() => r.value?.risks[0]?.level || 'LOW')
const diffCount = computed(() => r.value?.fields.filter((f) => f.status && DIFF.has(f.status)).length || 0)
const otherSuccess = computed(() =>
  (r.value?.successCodes || []).filter((c) => c.name !== r.value?.success?.name)
)

const fieldRows = computed<InsightField[]>(() => {
  const all = r.value?.fields || []
  if (fieldFilter.value === 'diff') return all.filter((f) => f.status && DIFF.has(f.status))
  if (fieldFilter.value === 'nodoc') return all.filter((f) => !f.comment && f.status !== 'EXTRA')
  return all
})

const loginText = computed(() => {
  const l = r.value?.login
  if (!l) return ''
  const fail = l.failCode
    ? `，不带 token 返回 ${l.failCode.name} = ${l.failCode.code}${l.failCode.message ? `（${l.failCode.message}）` : ''}`
    : ''
  if (l.commented) return `登录注解 ${l.annotation} 被注释掉了：不校验登录${fail ? `（原本${fail.slice(1)}）` : ''}`
  if (l.required === true) return `要登录（${l.annotation}${l.lenient ? '，宽松模式：token 无效也放行' : ''}）${fail}`
  if (l.required === false) return '不要登录（没挂登录注解）'
  return '看不出来（这个仓库不靠注解鉴权）'
})
const loginCls = computed(() => {
  const l = r.value?.login
  return l?.commented ? 'ei-bad' : l?.lenient ? 'ei-warn' : ''
})

function baseName(p: string) {
  return p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1)
}

async function run() {
  if (!proj.value || !props.path) return
  loading.value = true
  err.value = ''
  try {
    const sample = props.respSample && props.respSample.length <= MAX_SAMPLE ? props.respSample : undefined
    result.value = await apiClient.endpointInsight({
      endpointId: props.endpointId && proj.value === props.project ? props.endpointId : undefined,
      project: proj.value,
      method: props.method,
      path: props.path,
      respSample: sample
    })
    if (r.value) {
      view.value = r.value.risks.length ? 'risk' : 'fields'
      emit('project', proj.value)
      loadPlanned()
    }
  } catch (e: any) {
    err.value = e?.message || '体检失败'
    result.value = null
  } finally {
    loading.value = false
  }
}

async function loadPlanned() {
  planned.value = []
  previewReason.value = ''
  if (!linkedId.value || !params.value.length) return
  try {
    const p = await apiClient.previewSourceCases(linkedId.value)
    planned.value = p.cases || []
    if (!planned.value.length) {
      previewReason.value = p.hasCapture === false
        ? '这个接口还没有抓包请求，没有底子可改；先抓一次包再生成'
        : p.reason || '参数在代码里怎么处理看不出来，没法写期望'
    }
  } catch (e: any) {
    previewReason.value = e?.message || '预览失败'
  }
}

async function generate() {
  if (!linkedId.value) return
  generating.value = true
  try {
    const [o] = await apiClient.generateSourceCases([linkedId.value])
    if (!o || o.reason) {
      ElMessage.warning(o?.reason || '没生成')
      return
    }
    const parts = [`新增 ${o.created} 条`]
    if (o.enabled) parts.push(`试跑一致已启用 ${o.enabled} 条`)
    if (o.fixed) parts.push(`纠正已有 ${o.fixed} 条`)
    if (o.existed) parts.push(`${o.existed} 条之前生成过`)
    ElMessage({
      type: o.notes.some((n) => n.startsWith('疑似问题')) ? 'warning' : 'success',
      message: parts.join('，') + (o.notes.length ? `。${o.notes.join('；')}` : ''),
      duration: 6000
    })
    emit('generated')
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  if (props.auto && proj.value) run()
})
</script>

<style scoped>
.ei { font-size: 13px; }
.ei-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ei-proj { width: 220px; }
.ei-hint, .ei-dim { color: var(--el-text-color-secondary); font-size: 12px; }
.ei-dim { margin-left: 6px; }
.ei-gap { margin-top: 10px; }
.ei-empty { color: var(--el-text-color-secondary); padding: 14px 0; font-size: 12px; }
.ei-mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; word-break: break-all; }
.ei-cands { margin: 4px 0 0; padding-left: 18px; }
.ei-where {
  display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; padding: 8px 10px;
  background: var(--el-fill-color-light); border-radius: 4px; color: var(--el-text-color-regular); font-size: 12px;
}
.ei-count { margin-left: 4px; font-weight: 600; color: var(--el-text-color-secondary); }
.ei-count.HIGH { color: var(--el-color-danger); }
.ei-count.MID { color: var(--el-color-warning-dark-2); }
.el-radio-button.is-active .ei-count { color: #fff; }
.ei-panel { margin-top: 10px; max-height: 52vh; overflow: auto; }
.ei-risk { padding: 8px 10px; border-left: 3px solid var(--el-border-color); margin-bottom: 8px; background: var(--el-fill-color-lighter); border-radius: 0 4px 4px 0; }
.ei-risk.HIGH { border-left-color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.ei-risk.MID { border-left-color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.ei-risk-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ei-risk-detail { margin-top: 4px; line-height: 1.6; color: var(--el-text-color-regular); }
.ei-level { font-size: 11px; padding: 0 6px; border-radius: 3px; line-height: 18px; color: #fff; background: var(--el-color-info); }
.ei-level.HIGH { background: var(--el-color-danger); }
.ei-level.MID { background: var(--el-color-warning); }
.ei-kv { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--el-border-color-lighter); line-height: 1.6; }
.ei-k { flex: 0 0 72px; color: var(--el-text-color-secondary); }
.ei-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.ei-sec { margin: 14px 0 6px; font-weight: 600; }
.ei-bad { color: var(--el-color-danger); font-weight: 600; }
.ei-warn { color: var(--el-color-warning-dark-2); }
.ei-field-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.ei-st { display: inline-block; font-size: 11px; padding: 0 5px; margin-right: 6px; border-radius: 3px; line-height: 18px; border: 1px solid var(--el-border-color); color: var(--el-text-color-secondary); }
.ei-st.OK { color: var(--el-color-success-dark-2); border-color: var(--el-color-success-light-5); }
.ei-st.TYPE, .ei-st.EXTRA { color: var(--el-color-danger); border-color: var(--el-color-danger-light-5); }
.ei-st.MISSING { color: var(--el-color-warning-dark-2); border-color: var(--el-color-warning-light-5); }
.ei-nomargin { margin-left: 0; }
.ei-grow { flex: 1; }
.ei-bound { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; line-height: 22px; }
.ei-bound .ei-dim { margin-left: 0; }
.ei-plan { padding: 5px 0; border-bottom: 1px dashed var(--el-border-color-lighter); line-height: 1.6; }
.ei-intent {
  display: inline-block; font-size: 11px; padding: 0 5px; margin-right: 6px; border-radius: 3px; line-height: 18px;
  color: var(--el-color-warning-dark-2); background: var(--el-color-warning-light-9);
}
.ei-intent.NORMAL { color: var(--el-color-success-dark-2); background: var(--el-color-success-light-9); }
:deep(.ei-chip) {
  display: inline-block; font-size: 12px; padding: 0 6px; border-radius: 3px; line-height: 20px; cursor: default;
  border: 1px solid var(--el-border-color); color: var(--el-text-color-regular); background: var(--el-fill-color-lighter);
}
:deep(.ei-chip.REJECT), :deep(.ei-chip.HTTP) {
  color: var(--el-color-success-dark-2); border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9);
}
:deep(.ei-chip.suspect) {
  color: var(--el-color-danger); border-color: var(--el-color-danger-light-5); background: var(--el-color-danger-light-9);
}
</style>
