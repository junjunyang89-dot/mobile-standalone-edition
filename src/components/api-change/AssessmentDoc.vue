<template>
  <div class="adoc">
    <nav class="toc">
      <div class="toc-links">
        <span v-for="s in toc" :key="s.id" class="toc-a" :class="{ warn: s.warn }" @click="go(s.id)">
          {{ s.label }}<em v-if="s.count">{{ s.count }}</em>
        </span>
      </div>
      <div class="toc-actions"><slot name="actions" /></div>
    </nav>

    <!-- 全栈影响概览 -->
    <section v-if="a.overview?.length" class="ov">
      <div class="ov-grid">
        <div v-for="s in a.overview" :key="s.key" class="ov-cell" :class="'lv-' + s.level" :title="s.detail">
          <div class="ov-label">{{ s.label }}</div>
          <div class="ov-count">{{ s.count }}</div>
          <div class="ov-detail">{{ s.detail }}</div>
        </div>
      </div>
      <div v-if="a.releaseOrder?.length" class="ov-order">
        <b>发版 / 执行顺序</b>
        <ol><li v-for="s in a.releaseOrder" :key="s">{{ s }}</li></ol>
      </div>
    </section>

    <!-- 基础信息 -->
    <section :id="sid('base')" class="sec">
      <h3>基础信息</h3>
      <div class="kv">
        <div><label>项目名称</label><span>{{ a.projectName || '无后端项目' }}</span></div>
        <div><label>版本 / MR</label><span>{{ a.version }}</span></div>
        <div>
          <label>需求 / Bug 单号</label>
          <span>
            <a v-if="ticket?.url" :href="ticket.url" target="_blank" rel="noopener">{{ a.issueKey }}</a>
            <template v-else>{{ a.issueKey }}</template>
            {{ a.summary }}
          </span>
        </div>
        <div><label>模块</label><span>{{ a.modules || '—' }}</span></div>
        <div>
          <label>开发人员</label>
          <el-input :model-value="m.developer ?? a.developer" size="small" class="kv-input"
                    @update:model-value="(v: string) => set('developer', v)" />
        </div>
        <div>
          <label>分析人</label>
          <el-input :model-value="m.analyst ?? a.analyst" size="small" class="kv-input"
                    @update:model-value="(v: string) => set('analyst', v)" />
        </div>
        <div><label>分析日期</label><span>{{ a.date }}</span></div>
      </div>
      <div class="row">
        <label class="row-label">变更类型</label>
        <span v-for="c in a.changeTypes" :key="c.label" class="ck" :class="{ on: on('ct', c) }"
              :title="c.basis" @click="toggle('ct', c)">
          <i>{{ on('ct', c) ? '☑' : '☐' }}</i>{{ c.label }}
        </span>
      </div>
    </section>

    <!-- 对账 -->
    <section v-if="a.ticketChecks" :id="sid('check')" class="sec">
      <h3>需求单 ↔ 代码 对账
        <em v-if="mismatch" class="mis">{{ mismatch }} 处对不上</em>
      </h3>
      <table v-if="a.ticketChecks.length" class="ctable">
        <thead><tr><th>项</th><th>结果</th><th>单子里</th><th>代码里</th><th>怎么办</th></tr></thead>
        <tbody>
          <tr v-for="(c, i) in a.ticketChecks" :key="i">
            <td class="ct-topic">{{ c.topic }}</td>
            <td class="ct-status"><span :class="'cs-' + c.status">{{ CHECK_STATUS_LABEL[c.status] || c.status }}</span></td>
            <td class="pre">{{ c.ticket || '—' }}</td>
            <td class="pre">{{ c.code || '—' }}</td>
            <td>{{ c.hint }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">单子里没写表 / 配置 / 定时任务，代码里也没看到这几类改动</div>
    </section>

    <!-- 线上版本兼容 -->
    <section v-if="a.compat" :id="sid('compat')" class="sec">
      <h3>线上版本兼容检查
        <em v-if="compatRisk" class="mis">{{ compatRisk }} 处线上会出错</em>
      </h3>
      <div class="hint-line">后端有不兼容改动。拿各前端 / 客户端仓库的 master 当线上版本，看它调没调这些接口、读没读被改的字段。</div>
      <table v-if="a.compat.hits?.length" class="ctable">
        <thead><tr><th>调用方</th><th>接口</th><th>改了什么</th><th>代码里</th><th>怎么测</th></tr></thead>
        <tbody>
          <tr v-for="(h, i) in a.compat.hits" :key="i">
            <td class="ct-who">
              <span :class="h.level === 'RISK' ? 'cs-CODE_ONLY' : 'cs-CHECK'">{{ h.level === 'RISK' ? '会出错' : '看一眼' }}</span><br />
              {{ h.caller }}<br />
              <small>{{ h.callerKind === 'CLIENT' ? '客户端 · 线上老版本' : h.inTicket ? 'H5 · 在单里' : 'H5 · 不在单里' }}</small>
            </td>
            <td class="mono-ish">{{ h.endpoint }}</td>
            <td>{{ h.problem }}</td>
            <td class="mono-ish pre">{{ compatWhere(h) }}</td>
            <td>{{ h.advice }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">查过的仓库都没调到这些不兼容的接口</div>
      <div class="limits">
        <div v-if="a.compat.checked?.length">· 查过：{{ a.compat.checked.join('、') }}</div>
        <div v-for="u in a.compat.unchecked" :key="u" class="warn">· 没检查：{{ u }}（受不受影响不知道）</div>
        <div v-if="a.compat.truncated">· 还有 {{ a.compat.truncated }} 处没列出来</div>
      </div>
    </section>

    <!-- 一 -->
    <section :id="sid('s1')" class="sec">
      <h3>一、代码改动范围</h3>
      <h4>1. 改动文件清单 <em>{{ a.files?.length || 0 }} 个</em></h4>
      <table v-if="a.files?.length" class="ftable">
        <tbody>
          <tr v-for="f in shownFiles" :key="f.project + f.path">
            <td class="ft-status"><span :class="'st-' + f.status">{{ fileStatusLabel(f.status) }}</span></td>
            <td class="ft-proj">{{ f.project }}</td>
            <td class="ft-path mono">{{ f.path }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">无</div>
      <el-button v-if="a.files?.length > FILE_FOLD" link type="primary" size="small" @click="filesOpen = !filesOpen">
        {{ filesOpen ? '收起' : `展开全部 ${a.files.length} 个` }}
      </el-button>
      <template v-if="a.classes?.length">
        <h4>2. 改动类 / 方法</h4>
        <div class="tags"><span v-for="c in a.classes" :key="c" class="tg mono">{{ c }}</span></div>
      </template>
      <h4>3. 影响页面 / 接口 / 数据表</h4>
      <div v-if="impactGroups.shown.length" class="grid2">
        <div v-for="g in impactGroups.shown" :key="g.title">
          <b>{{ g.title }}</b>
          <ul><li v-for="s in g.items" :key="s" :class="{ 'mono-ish': g.mono }">{{ s }}</li></ul>
        </div>
      </div>
      <div v-if="impactGroups.empty.length" class="none-line">无：{{ impactGroups.empty.join('、') }}</div>
      <Note :value="m.scopeNote" @update="(v: string) => set('scopeNote', v)" />
    </section>

    <!-- 二 -->
    <section :id="sid('s2')" class="sec">
      <h3>二、变更内容详情</h3>
      <h4>1. 业务逻辑变更</h4>
      <div class="grid2">
        <div>
          <b>旧逻辑</b>
          <el-input :model-value="m.oldLogic" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }"
                    placeholder="对照需求文档填：原来怎么处理" @update:model-value="(v: string) => set('oldLogic', v)" />
        </div>
        <div>
          <b>新逻辑</b>
          <el-input :model-value="m.newLogic" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }"
                    placeholder="现在怎么处理" @update:model-value="(v: string) => set('newLogic', v)" />
        </div>
      </div>
      <div class="sub">代码里识别到的改动<em v-if="logicGroups.length" class="cnt">{{ logicGroups.length }} 个方法 / 配置</em></div>
      <div v-for="g in logicGroups" :key="g.key" class="lg">
        <div class="lg-head">
          <span class="mono">{{ g.title }}</span>
          <span v-for="e in g.endpoints" :key="e" class="tg mono">{{ e }}</span>
          <span class="api-proj">{{ g.project }}</span>
        </div>
        <div v-for="(d, i) in g.items" :key="i" class="lg-item">
          <div><span class="lk" :class="'lk-' + d.kind">{{ LOGIC_KIND_LABEL[d.kind] || d.kind }}</span>{{ d.title }}</div>
          <pre v-if="d.before || d.after" class="diff"><template v-for="(l, j) in lines(d.before)" :key="'b' + j"><span class="del">- {{ l }}</span>
</template><template v-for="(l, j) in lines(d.after)" :key="'a' + j"><span class="add">+ {{ l }}</span>
</template></pre>
          <div v-if="d.hint" class="lg-hint">测：{{ d.hint }}</div>
        </div>
      </div>
      <div v-if="logicGroups.length && a.logicChanges?.length" class="sub">其他</div>
      <ul v-if="a.logicChanges?.length"><li v-for="s in a.logicChanges" :key="s">{{ s }}</li></ul>
      <div v-if="!logicGroups.length && !a.logicChanges?.length" class="none-line">无</div>

      <h4>2. 接口变更 <em>{{ a.apiChanges?.length || 0 }} 个</em></h4>
      <div v-for="d in a.apiChanges" :key="d.project + d.method + d.path" class="api">
        <div class="api-head">
          <span class="api-m mono">{{ d.method }}</span>
          <span class="mono">{{ d.path }}</span>
          <span class="api-sum">{{ d.summary }}</span>
          <span class="api-tag" :class="'r-' + (d.risk || d.changeType)">{{ apiChangeLabel(d) }}</span>
          <span class="api-proj">{{ d.project }}</span>
        </div>
        <div class="api-body">
          <div><label>入参</label><span>{{ d.inputs?.length ? d.inputs.join('；') : '无变化' }}</span></div>
          <div><label>出参</label><span>{{ d.outputs?.length ? d.outputs.join('；') : '无变化' }}</span></div>
          <div v-if="d.impls?.length"><label>改动实现</label><span class="mono-ish">{{ d.impls.join('、') }}</span></div>
          <div><label>已有用例</label><span>{{ d.testCases || 0 }} 条</span></div>
        </div>
      </div>
      <div v-if="!a.apiChanges?.length" class="none-line">无</div>
      <Note :value="m.statusCode" label="+ 状态码变化" placeholder="代码里没识别到状态码变化，有的话手填"
            @update="(v: string) => set('statusCode', v)" />

      <template v-if="a.dbChanges?.length || a.sql">
        <h4>3. 数据库变更</h4>
        <ul v-if="a.dbChanges?.length"><li v-for="s in a.dbChanges" :key="s" class="mono-ish">{{ s }}</li></ul>
        <pre v-if="a.sql" class="sql">{{ a.sql }}</pre>
      </template>
      <template v-if="a.otherChanges?.length">
        <h4>4. 其他变更（缓存 / MQ / 第三方 / 配置 / 开关）</h4>
        <ul><li v-for="s in a.otherChanges" :key="s">{{ s }}</li></ul>
      </template>
      <div v-if="detailEmpty.length" class="none-line">无：{{ detailEmpty.join('、') }}</div>
      <Note :value="m.detailNote" @update="(v: string) => set('detailNote', v)" />
    </section>

    <!-- 三 -->
    <section :id="sid('s3')" class="sec">
      <h3>三、依赖与关联模块</h3>
      <div class="row">
        <label class="row-label">涉及公共方法 / 组件</label>
        <YesNo :on="on('pub', a.publicChange)" :basis="a.publicChange?.basis" @toggle="toggle('pub', a.publicChange)" />
      </div>
      <ul v-if="a.publicItems?.length"><li v-for="s in a.publicItems" :key="s">{{ s }}</li></ul>
      <div class="row">
        <label class="row-label">需要数据迁移 / 刷数</label>
        <YesNo :on="on('mig', a.needMigration)" :basis="a.needMigration?.basis" @toggle="toggle('mig', a.needMigration)" />
      </div>
      <ul v-if="a.migrationNotes?.length"><li v-for="s in a.migrationNotes" :key="s">{{ s }}</li></ul>
      <template v-if="a.relatedModules?.length">
        <div class="sub">关联业务模块</div>
        <div class="tags"><span v-for="s in a.relatedModules" :key="s" class="tg">{{ s }}</span></div>
      </template>
      <template v-if="a.compatNotes?.length">
        <div class="sub">数据兼容性</div>
        <ul><li v-for="s in a.compatNotes" :key="s">{{ s }}</li></ul>
      </template>
      <div v-if="depEmpty.length" class="none-line">无：{{ depEmpty.join('、') }}</div>
      <Note :value="m.depNote" @update="(v: string) => set('depNote', v)" />
    </section>

    <!-- 四 -->
    <section :id="sid('s4')" class="sec">
      <h3>四、风险点分析</h3>
      <div v-if="shownRisks.length" class="grid2">
        <div v-for="g in shownRisks" :key="g.title">
          <b>{{ g.title }}</b>
          <ul><li v-for="s in g.items" :key="s">{{ s }}</li></ul>
        </div>
      </div>
      <div v-if="emptyTitles(riskGroups).length" class="none-line">没扫到：{{ emptyTitles(riskGroups).join('、') }}</div>
      <Note :value="m.riskNote" @update="(v: string) => set('riskNote', v)" />
    </section>

    <!-- 五 -->
    <section :id="sid('s5')" class="sec">
      <h3>五、测试建议</h3>
      <h4>1. 核心测试场景
        <el-radio-group v-if="a.endGroups?.length" v-model="caseView" size="small" class="view-switch">
          <el-radio-button value="scene">按场景</el-radio-button>
          <el-radio-button value="end">按端</el-radio-button>
        </el-radio-group>
      </h4>
      <div v-if="caseView === 'end' && a.endGroups?.length" class="ends">
        <div v-for="g in a.endGroups" :key="g.key" class="end" :class="{ dim: !g.items?.length }">
          <b>{{ g.label }} <em v-if="g.items?.length">{{ g.items.length }}</em></b>
          <ul v-if="g.items?.length">
            <li v-for="(it, i) in g.items" :key="i">
              {{ it.what }}
              <div v-if="it.why" class="why">为什么：{{ it.why }}</div>
            </li>
          </ul>
          <div v-else class="empty">{{ g.note || '无' }}</div>
        </div>
      </div>
      <template v-else>
        <div v-for="g in nonEmpty(caseGroups)" :key="g.title" class="blk">
          <b>{{ g.title }} <em>{{ g.items.length }}</em></b>
          <ul><li v-for="s in g.items" :key="s">{{ s }}</li></ul>
        </div>
        <div v-if="emptyTitles(caseGroups).length" class="none-line">无：{{ emptyTitles(caseGroups).join('、') }}</div>
      </template>
      <h4>2. 回归测试范围</h4>
      <div v-for="g in nonEmpty(regressGroups)" :key="g.title" class="blk">
        <b :class="g.cls">{{ g.title }} <em>{{ g.items.length }}</em></b>
        <ul><li v-for="s in g.items" :key="s">{{ s }}</li></ul>
      </div>
      <div v-if="emptyTitles(regressGroups).length" class="none-line">无：{{ emptyTitles(regressGroups).join('、') }}</div>
      <h4>3. 测试手段</h4>
      <div class="row">
        <span v-for="c in a.methods" :key="c.label" class="ck" :class="{ on: on('m', c) }" :title="c.basis"
              @click="toggle('m', c)">
          <i>{{ on('m', c) ? '☑' : '☐' }}</i>{{ c.label }}
        </span>
      </div>
      <template v-if="a.testData?.length">
        <h4>4. 测试数据准备</h4>
        <ul><li v-for="s in a.testData" :key="s">{{ s }}</li></ul>
      </template>
      <h4>5. 自动化资产同步</h4>
      <div class="row">
        <label class="row-label">更新自动化脚本</label>
        <YesNo :on="on('auto', a.automation)" :basis="a.automation?.basis" @toggle="toggle('auto', a.automation)" />
      </div>
      <ul v-if="a.automationRefs?.length"><li v-for="s in a.automationRefs" :key="s">{{ s }}</li></ul>
      <div class="row">
        <label class="row-label">新增 / 更新 Diff 基线</label>
        <YesNo :on="on('base', a.baseline)" :basis="a.baseline?.basis" @toggle="toggle('base', a.baseline)" />
      </div>
      <ul v-if="a.baselineRefs?.length"><li v-for="s in a.baselineRefs" :key="s">{{ s }}</li></ul>
      <Note :value="m.testNote" @update="(v: string) => set('testNote', v)" />
    </section>

    <!-- 六 -->
    <section :id="sid('s6')" class="sec">
      <h3>六、待确认事项</h3>
      <ul v-if="a.questions?.length"><li v-for="s in a.questions" :key="s">{{ s }}</li></ul>
      <div v-else class="none-line">无</div>
      <Note :value="m.questions" label="+ 加待确认问题" placeholder="需要和产品 / 开发确认的问题，一行一条"
            @update="(v: string) => set('questions', v)" />
      <details v-if="a.limits?.length" class="limits">
        <summary>分析范围说明（{{ a.limits.length }}）</summary>
        <div v-for="s in a.limits" :key="s">· {{ s }}</div>
      </details>
    </section>

    <!-- 七 -->
    <section :id="sid('s7')" class="sec">
      <h3>七、结论评估</h3>
      <div class="row">
        <label class="row-label">风险等级</label>
        <span v-for="k in ['HIGH', 'MEDIUM', 'LOW']" :key="k" class="ck risk" :class="[{ on: risk === k }, 'rk-' + k]"
              @click="set('riskLevel', k === a.riskLevel ? '' : k)">
          <i>{{ risk === k ? '☑' : '☐' }}</i>{{ RISK_LABEL[k] }}
        </span>
        <span v-if="m.riskLevel && m.riskLevel !== a.riskLevel" class="override">（人工改过，自动判断是 {{ RISK_LABEL[a.riskLevel] || '无' }}）</span>
      </div>
      <div v-if="a.riskReasons?.length" class="reasons">依据：{{ a.riskReasons.join('；') }}</div>
      <el-input :model-value="m.conclusion ?? a.conclusion" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }"
                placeholder="评估结论" @update:model-value="(v: string) => set('conclusion', v)" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import { ElInput } from 'element-plus'
import {
  CHECK_STATUS_LABEL,
  LOGIC_KIND_LABEL,
  RISK_LABEL,
  apiChangeLabel,
  ckKey,
  effectiveRisk,
  fileStatusLabel,
  groupLogic,
  isChecked,
  type Check,
  type Manual
} from '../../utils/assessmentMarkdown'

const props = defineProps<{ a: any; ticket?: any; modelValue: Manual }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Manual): void }>()

const FILE_FOLD = 8
const filesOpen = ref(false)
const m = computed(() => props.modelValue || {})
const risk = computed(() => effectiveRisk(props.a, m.value))
const shownFiles = computed(() => {
  const all = props.a?.files || []
  return filesOpen.value ? all : all.slice(0, FILE_FOLD)
})

const caseView = ref<'scene' | 'end'>('scene')
const compatRisk = computed(() => (props.a?.compat?.hits || []).filter((h: any) => h.level === 'RISK').length)

function compatWhere(h: any) {
  const lines = [`调用：${(h.callRefs || []).join('、')}`]
  if (h.fieldFound === 'FOUND') lines.push(`读 ${h.field}：${(h.fieldRefs || []).join('、')}`)
  else if (h.fieldFound === 'NOT_FOUND') lines.push(`搜不到 ${h.field}`)
  else if (h.fieldFound === 'TOO_COMMON') lines.push(`${h.field} 太常见，定位不到`)
  return lines.join('\n')
}

const logicGroups = computed(() => groupLogic(props.a?.logicDetails))
const mismatch = computed(
  () => (props.a?.ticketChecks || []).filter((c: any) => c.status === 'CODE_ONLY' || c.status === 'TICKET_ONLY').length
)

function lines(s: string | null | undefined) {
  return s ? s.split('\n') : []
}

const riskGroups = computed(() => [
  { title: '逻辑风险', items: props.a.logicRisks },
  { title: '兼容性与数据风险', items: props.a.compatRisks },
  { title: '隐性影响', items: props.a.hiddenRisks },
  { title: '其他风险', items: props.a.otherRisks }
])
const caseGroups = computed(() => [
  { title: '正常场景', items: props.a.normalCases },
  { title: '边界场景', items: props.a.boundaryCases },
  { title: '异常场景', items: props.a.errorCases }
])
const regressGroups = computed(() => [
  { title: '必测回归', items: props.a.mustRegress, cls: 'must' },
  { title: '关联回归', items: props.a.relatedRegress, cls: 'rel' },
  { title: '无需回归', items: props.a.noRegress, cls: 'no' }
])

type Group = { title: string; items?: string[]; [k: string]: any }
function nonEmpty<T extends Group>(gs: T[]) {
  return gs.filter((g) => g.items?.length)
}
function emptyTitles(gs: Group[]) {
  return gs.filter((g) => !g.items?.length).map((g) => g.title)
}
const shownRisks = computed(() => nonEmpty(riskGroups.value))

const impactGroups = computed(() => {
  const gs = [
    { title: '前端页面', items: props.a.frontends },
    { title: '客户端', items: props.a.clients },
    { title: '后端接口', items: props.a.endpoints, mono: true },
    { title: '数据库表', items: props.a.tables, mono: true }
  ]
  return { shown: nonEmpty(gs), empty: emptyTitles(gs) }
})
const detailEmpty = computed(() => {
  const out: string[] = []
  if (!props.a.dbChanges?.length && !props.a.sql) out.push('数据库变更')
  if (!props.a.otherChanges?.length) out.push('其他变更')
  return out
})
const depEmpty = computed(() => {
  const out: string[] = []
  if (!props.a.relatedModules?.length) out.push('关联业务模块')
  if (!props.a.compatNotes?.length) out.push('数据兼容问题')
  return out
})

// 页面上可能同时有别的报告实例，锚点 id 要带前缀
const uid = Math.random().toString(36).slice(2, 8)
function sid(k: string) {
  return `adoc-${uid}-${k}`
}
function go(k: string) {
  document.getElementById(sid(k))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const toc = computed(() => {
  const a = props.a || {}
  const riskCount = riskGroups.value.reduce((n, g) => n + (g.items?.length || 0), 0)
  const q = a.questions?.length || 0
  const items: Array<{ id: string; label: string; count?: number; warn?: boolean } | null> = [
    { id: 'base', label: '基础信息' },
    a.ticketChecks ? { id: 'check', label: '对账', count: mismatch.value, warn: mismatch.value > 0 } : null,
    a.compat ? { id: 'compat', label: '线上兼容', count: compatRisk.value, warn: compatRisk.value > 0 } : null,
    { id: 's1', label: '改动范围', count: a.files?.length },
    { id: 's2', label: '变更详情', count: a.apiChanges?.length },
    { id: 's3', label: '依赖' },
    { id: 's4', label: '风险', count: riskCount },
    { id: 's5', label: '测试建议' },
    { id: 's6', label: '待确认', count: q, warn: q > 0 },
    { id: 's7', label: '结论' }
  ]
  return items.filter((x): x is NonNullable<typeof x> => !!x)
})

/** 「补充」默认只是一个链接，点了或已有内容才展开输入框 */
const Note = defineComponent({
  props: { value: String, placeholder: { type: String, default: '补充说明' }, label: { type: String, default: '+ 补充' } },
  emits: ['update'],
  setup(p, { emit: e }) {
    const open = ref(false)
    return () =>
      p.value || open.value
        ? h(ElInput, {
            modelValue: p.value,
            type: 'textarea',
            autosize: { minRows: 1, maxRows: 6 },
            placeholder: p.placeholder,
            class: 'note',
            'onUpdate:modelValue': (v: string) => e('update', v),
            onBlur: () => {
              if (!p.value) open.value = false
            }
          })
        : h('span', { class: 'note-add', onClick: () => (open.value = true) }, p.label)
  }
})

function set(k: string, v: string) {
  const next = { ...m.value }
  if (v == null || v === '') delete next[k]
  else next[k] = v
  emit('update:modelValue', next)
}

function on(group: string, c: Check | null | undefined) {
  return isChecked(m.value, group, c)
}

function toggle(group: string, c: Check | null | undefined) {
  if (!c) return
  const want = !on(group, c)
  // 和自动判断一致就不留人工记录，免得以后自动结果变了还被旧的人工值压着
  set(ckKey(group, c.label), want === !!c.checked ? '' : want ? '1' : '0')
}

const YesNo = defineComponent({
  props: { on: Boolean, basis: String },
  emits: ['toggle'],
  setup(p, { emit: e }) {
    return () =>
      h('span', { class: 'yn' }, [
        h('span', { class: ['ck', { on: p.on }], onClick: () => !p.on && e('toggle') }, [h('i', p.on ? '☑' : '☐'), '是']),
        h('span', { class: ['ck', { on: !p.on }], onClick: () => p.on && e('toggle') }, [h('i', !p.on ? '☑' : '☐'), '否']),
        p.basis ? h('span', { class: 'basis' }, p.basis) : null
      ])
  }
})
</script>

<style scoped>
.adoc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}
.toc {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  margin-bottom: 4px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.toc-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.toc-a {
  cursor: pointer;
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.toc-a:hover {
  color: var(--el-color-primary);
}
.toc-a em {
  font-style: normal;
  margin-left: 3px;
  color: var(--el-text-color-secondary);
}
.toc-a.warn em {
  color: var(--el-color-danger);
  font-weight: 600;
}
.toc-actions {
  flex: none;
  display: flex;
  gap: 6px;
}
.sec {
  padding: 12px 0 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  scroll-margin-top: 48px;
}
.none-line {
  margin: 4px 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.note-add {
  display: inline-block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.note-add:hover {
  color: var(--el-color-primary);
}
:deep(.note) {
  margin-top: 6px;
}
.blk {
  margin: 4px 0;
}
.blk b {
  font-weight: 500;
}
.blk b em {
  font-style: normal;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.sec h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.sec h4 {
  margin: 12px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
.sec h4 em {
  font-style: normal;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}
.sec ul {
  margin: 2px 0 6px;
  padding-left: 18px;
}
.sec li {
  word-break: break-all;
}
.empty {
  color: var(--el-text-color-placeholder);
}
.kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 20px;
}
.kv > div {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.kv label,
.api-body label {
  flex: none;
  width: 92px;
  color: var(--el-text-color-secondary);
}
.kv-input {
  max-width: 220px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin: 6px 0;
}
.row-label {
  flex: none;
  min-width: 92px;
  color: var(--el-text-color-secondary);
}
.ck {
  cursor: pointer;
  user-select: none;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.ck i {
  font-style: normal;
  margin-right: 3px;
}
.ck.on {
  color: var(--el-color-primary);
  font-weight: 500;
}
.ck.risk.on.rk-HIGH {
  color: var(--el-color-danger);
}
.ck.risk.on.rk-MEDIUM {
  color: var(--el-color-warning);
}
.ck.risk.on.rk-LOW {
  color: var(--el-color-success);
}
:deep(.yn) {
  display: inline-flex;
  gap: 14px;
  align-items: center;
}
:deep(.yn .basis) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.override,
.reasons {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.reasons {
  margin: 0 0 6px;
}
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 20px;
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 16px;
}
.grid2 b,
.grid3 b,
.sub {
  display: block;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-top: 4px;
}
b.must {
  color: var(--el-color-danger);
}
b.rel {
  color: var(--el-color-warning);
}
b.no {
  color: var(--el-text-color-secondary);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}
.tg {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}
.mono,
.ft-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mono-ish {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.ftable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ftable td {
  padding: 2px 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  vertical-align: top;
}
.ft-status {
  width: 40px;
}
.ft-proj {
  width: 130px;
  color: var(--el-text-color-secondary);
}
.ft-path {
  word-break: break-all;
}
.st-ADDED {
  color: var(--el-color-success);
}
.st-DELETED {
  color: var(--el-color-danger);
}
.st-MODIFIED {
  color: var(--el-color-warning);
}
.api {
  margin: 6px 0;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.api-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.api-m {
  font-weight: 600;
  color: var(--el-color-primary);
}
.api-sum {
  color: var(--el-text-color-regular);
}
.api-proj {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.api-tag {
  font-size: 12px;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
.api-tag.r-BREAKING,
.api-tag.r-REMOVED {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.api-tag.r-NEW,
.api-tag.r-ADDED {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.api-tag.r-IMPL {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.api-body > div {
  display: flex;
  gap: 8px;
}
.api-body span {
  word-break: break-all;
}
.sql {
  margin: 4px 0;
  padding: 8px 10px;
  max-height: 260px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
.ov {
  margin-bottom: 4px;
}
.ov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.ov-cell {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 3px;
  border-radius: 6px;
  min-width: 0;
}
.ov-cell.lv-RISK {
  border-left-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.ov-cell.lv-WARN {
  border-left-color: var(--el-color-warning);
}
.ov-cell.lv-NONE {
  color: var(--el-text-color-secondary);
}
.ov-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ov-count {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}
.lv-RISK .ov-count {
  color: var(--el-color-danger);
}
.ov-detail {
  font-size: 12px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
.ov-order {
  margin-top: 8px;
  font-size: 12px;
}
.ov-order ol {
  margin: 2px 0 0;
  padding-left: 20px;
}
.hint-line {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.ct-who {
  width: 140px;
}
.ct-who small {
  color: var(--el-text-color-secondary);
}
.warn {
  color: var(--el-color-warning);
}
.view-switch {
  margin-left: 10px;
  vertical-align: middle;
}
.ends {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}
.end {
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.end.dim {
  background: var(--el-fill-color-lighter);
}
.end b em {
  font-style: normal;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}
.why {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mis {
  font-style: normal;
  font-size: 12px;
  font-weight: 500;
  margin-left: 8px;
  color: var(--el-color-danger);
}
.cnt {
  font-style: normal;
  font-weight: 400;
  margin-left: 6px;
  color: var(--el-text-color-secondary);
}
.ctable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ctable th,
.ctable td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  text-align: left;
  vertical-align: top;
  word-break: break-all;
}
.ctable th {
  font-weight: 500;
  color: var(--el-text-color-secondary);
}
.ct-topic {
  width: 56px;
  white-space: nowrap;
}
.ct-status {
  width: 120px;
}
.pre {
  white-space: pre-wrap;
}
.cs-MATCH {
  color: var(--el-color-success);
}
.cs-CODE_ONLY {
  color: var(--el-color-danger);
  font-weight: 500;
}
.cs-TICKET_ONLY {
  color: var(--el-color-warning);
  font-weight: 500;
}
.cs-CHECK {
  color: var(--el-text-color-secondary);
}
.lg {
  margin: 6px 0;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.lg-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-weight: 500;
}
.lg-item {
  margin-top: 6px;
}
.lk {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 12px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}
.lk-CONDITION,
.lk-FORMULA,
.lk-LITERAL,
.lk-CONFIG {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.lk-TRANSACTION,
.lk-METHOD_REMOVED,
.lk-SCHEDULE,
.lk-MQ,
.lk-REMOTE,
.lk-CACHE {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.lk-METHOD_ADDED,
.lk-WRITE {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.diff {
  margin: 4px 0;
  padding: 6px 10px;
  max-height: 220px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
}
.diff .del {
  color: var(--el-color-danger);
}
.diff .add {
  color: var(--el-color-success);
}
.lg-hint {
  color: var(--el-text-color-regular);
  font-size: 12px;
}
.limits {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.limits summary {
  cursor: pointer;
}
</style>
