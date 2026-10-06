<template>
  <div class="xpv">
    <!-- 结论条：风险等级和几类关联的数量放最上面，不用滚到报告第七节 -->
    <div v-if="!compact" class="banner" :class="'bn-' + (a?.riskLevel || 'NONE')">
      <div class="bn-left">
        <span v-if="a?.riskLevel" class="bn-risk">{{ RISK_LABEL[a.riskLevel] }}风险</span>
        <span v-else class="bn-risk">还没出结论</span>
        <template v-if="projectCount > 1 || links.length">
          <span class="bn-proj">涉及 {{ projectCount }} 个项目</span>
          <span v-for="lv in LEVELS" :key="lv" class="bn-cnt" :class="'lv-' + lv" @click="levelFilter = lv">
            {{ LEVEL_TEXT[lv] }} {{ levelCount[lv] || 0 }}
          </span>
        </template>
      </div>
      <ul v-if="a?.riskReasons?.length" class="bn-reasons">
        <li v-for="r in a.riskReasons.slice(0, 4)" :key="r">{{ r }}</li>
      </ul>
      <div v-if="missing.length" class="bn-missing">
        缺代码：<span v-for="x in missing" :key="x.projectCode || x.rawProject" class="miss-item" :title="x.codeMissing">
          {{ tName(x) }}<em>{{ shortMissing(x.codeMissing) }}</em>
        </span>
        <span class="muted">和它们有关的结论只是推测（图上虚线）</span>
      </div>
    </div>

    <!-- 关系图 -->
    <section v-if="graph.nodes.length > 1" class="sec">
      <div class="sec-head">
        <h4>项目关系图</h4>
        <span class="muted">箭头 = 谁调谁；点节点或连线只看相关的关联</span>
      </div>
      <div class="graph-wrap">
        <svg :viewBox="`0 0 ${graph.width} ${graph.height}`" class="graph" :style="{ maxWidth: graph.width + 'px' }">
          <defs>
            <marker v-for="lv in LEVELS" :id="uid + lv" :key="lv" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" :fill="LEVEL_COLOR[lv]" />
            </marker>
          </defs>
          <text v-if="graph.callerX !== null" :x="graph.callerX" y="14" class="col-title">前端 / 客户端（调用方）</text>
          <text :x="graph.backX" y="14" class="col-title">后端（提供接口）</text>
          <g v-for="e in graph.edges" :key="e.key" class="edge" :class="{ dim: isDim(e), on: isEdgeFocus(e) }"
             @click="focusEdge(e)">
            <path :d="e.d" class="edge-hit" />
            <path :d="e.d" fill="none" :stroke="LEVEL_COLOR[e.level]" :stroke-width="e.level === 'RISK' ? 2.4 : 1.8"
                  :stroke-dasharray="e.inferred ? '6 4' : undefined" :marker-end="`url(#${uid + e.level})`" />
            <g :transform="`translate(${e.lx},${e.ly})`">
              <rect :x="-e.lw / 2" y="-10" :width="e.lw" height="20" rx="10" :fill="LEVEL_BG[e.level]" :stroke="LEVEL_COLOR[e.level]" />
              <text text-anchor="middle" y="4" class="edge-label" :fill="LEVEL_COLOR[e.level]">{{ e.label }}</text>
            </g>
          </g>
          <foreignObject v-for="n in graph.nodes" :key="n.id" :x="n.x" :y="n.y" :width="NODE_W" :height="NODE_H"
                         :class="{ dim: isNodeDim(n.id) }" @click="focusNode(n.id)">
            <div class="node" :class="[nodeClass(n), { on: focus?.node === n.id }]" :title="n.summary || ''">
              <div class="n-name">{{ n.name }}<span v-if="n.badge" class="n-badge" :class="'lv-' + n.badge.level">{{ n.badge.count }}</span></div>
              <div class="n-sub">{{ SIDE_TEXT[n.side] || n.side }} · {{ nodeState(n) }}</div>
              <div v-if="n.branch" class="n-branch">{{ n.branch }}</div>
            </div>
          </foreignObject>
        </svg>
      </div>
      <div class="legend">
        <span v-for="lv in LEVELS" :key="lv"><i class="lg-line" :style="{ background: LEVEL_COLOR[lv] }" />{{ LEVEL_TEXT[lv] }}：{{ LEVEL_HINT[lv] }}</span>
        <span><i class="lg-line dashed" />推测（有一边缺代码）</span>
        <span><i class="lg-box chg" />这次有改动</span>
        <span><i class="lg-box" />没改，但被牵连</span>
        <span><i class="lg-box miss" />缺代码</span>
      </div>
    </section>

    <!-- 关联清单 -->
    <section v-if="links.length" class="sec">
      <div class="sec-head">
        <h4>项目之间的关联 <em>{{ links.length }} 条</em></h4>
        <el-radio-group v-model="levelFilter" size="small">
          <el-radio-button label="ALL">全部</el-radio-button>
          <el-radio-button v-for="lv in LEVELS" :key="lv" :label="lv" :disabled="!levelCount[lv]">
            {{ LEVEL_TEXT[lv] }} {{ levelCount[lv] || 0 }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="focus" class="focus-bar">
        只看：{{ focusText }}
        <el-button link type="primary" size="small" @click="focus = null">看全部</el-button>
      </div>
      <div v-for="(g, i) in groupedLinks" :key="i" class="link" :class="'lk-' + g[0].level">
        <div class="lk-head">
          <span class="lk-level" :class="'lv-' + g[0].level">{{ LEVEL_TEXT[g[0].level] }}</span>
          <span class="lk-title">{{ g[0].title }}</span>
          <span v-if="g.length > 1" class="lk-count">{{ g.length }} 个接口</span>
          <span v-if="g[0].inferred" class="lk-inferred" title="有一边没拿到代码，这条是推出来的">推测</span>
        </div>
        <div class="lk-meta">
          <span class="lk-who">{{ g[0].fromName || '（没人调）' }} → {{ g[0].toName || '？' }}</span>
          <template v-if="g.length === 1">
            <span v-if="g[0].path" class="mono">{{ g[0].method ? g[0].method + ' ' : '' }}{{ g[0].path }}</span>
            <span v-if="g[0].summary" class="muted">{{ g[0].summary }}</span>
          </template>
          <span v-if="g[0].endpointChange" class="lk-tag">接口{{ CHANGE_TEXT[g[0].endpointChange] || g[0].endpointChange }}{{ g[0].endpointRisk === 'BREAKING' ? '（不兼容）' : '' }}</span>
          <span v-if="g[0].callChange" class="lk-tag">调用方{{ CALL_TEXT[g[0].callChange] || g[0].callChange }}</span>
        </div>
        <details v-if="g.length > 1" class="lk-refs">
          <summary>涉及接口和代码位置</summary>
          <div v-for="l in g" :key="l.method + l.path" class="lk-ep">
            <span class="mono">{{ l.method ? l.method + ' ' : '' }}{{ l.path }}</span>
            <span v-if="l.summary" class="muted">{{ l.summary }}</span>
            <span class="muted mono">{{ (l.refs || []).join('，') }}</span>
          </div>
        </details>
        <details v-else-if="g[0].refs?.length" class="lk-refs">
          <summary>代码位置 {{ g[0].refs.length }} 处</summary>
          <div v-for="r in g[0].refs" :key="r" class="mono ref">{{ r }}</div>
        </details>
      </div>
      <div v-if="!groupedLinks.length" class="muted">没有符合条件的关联</div>
    </section>
    <div v-else-if="ticket.analyzedAt && projectCount > 1" class="sec muted">
      这几个项目之间没找到调用关系（代码里没写死对方的接口路径，也没有共用表）。
    </div>

    <!-- 前端 / 客户端代码明细 -->
    <section v-if="frontProjects.length" class="sec">
      <div class="sec-head"><h4>前端 / 客户端代码改动</h4></div>
      <el-tabs v-model="tab" class="ptabs">
        <el-tab-pane v-for="(x, i) in frontProjects" :key="i" :name="String(i)">
          <template #label>
            <span class="tab-label">
              <i class="dot" :class="tabDot(x)" />{{ tName(x) }}<em>{{ KIND_TEXT[x.kind] || '' }}</em>
            </span>
          </template>
          <div class="pane">
            <div>{{ frontSummary(x.front) }}</div>
            <div v-if="x.front.pages?.length" class="tags">
              <span class="tl">页面 / 组件</span>
              <span v-for="p in x.front.pages" :key="p" class="tg mono">{{ p }}</span>
            </div>
            <div v-if="x.front.addedCalls?.length" class="calls">
              <div class="tl">新写的接口调用</div>
              <div v-for="c in x.front.addedCalls" :key="'a' + c.file + c.line + c.path" class="call">
                <span class="mono add">+ {{ c.raw }}</span><span class="muted mono">{{ c.file }}:{{ c.line }}</span>
                <span v-if="!c.apiLike" class="muted">（不确定是接口）</span>
              </div>
            </div>
            <div v-if="x.front.removedCalls?.length" class="calls">
              <div class="tl">删掉的接口调用</div>
              <div v-for="c in x.front.removedCalls" :key="'r' + c.file + c.line + c.path" class="call">
                <span class="mono del">- {{ c.raw }}</span><span class="muted mono">{{ c.file }}:{{ c.line }}</span>
              </div>
            </div>
            <details v-if="x.front.files?.length" class="files">
              <summary>改动文件 {{ x.front.changedFiles }} 个</summary>
              <div v-for="f in x.front.files" :key="f.path" class="file">
                <span :class="'st-' + f.status">{{ FILE_TEXT[f.status] || f.status }}</span>
                <span class="mono">{{ f.path }}</span>
              </div>
            </details>
            <div v-for="n in x.front.notes || []" :key="n" class="muted sm">{{ n }}</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RISK_LABEL } from '../../utils/assessmentMarkdown'

/** compact：嵌在测试指引里，风险结论和缺代码由外面展示，这里只出关系图、关联和前端明细 */
const props = defineProps<{ ticket: any; compact?: boolean }>()

const LEVELS = ['RISK', 'JOINT', 'CHECK', 'INFO'] as const
type Level = (typeof LEVELS)[number]
const LEVEL_TEXT: Record<string, string> = { RISK: '风险', JOINT: '联调点', CHECK: '待确认', INFO: '知道一下' }
const LEVEL_HINT: Record<string, string> = {
  RISK: '对方没跟着改',
  JOINT: '两边都改了，要一起测',
  CHECK: '对不上，要问开发',
  INFO: '有调用，回归时顺带'
}
const LEVEL_COLOR: Record<string, string> = { RISK: '#f56c6c', JOINT: '#e6a23c', CHECK: '#9b6dd6', INFO: '#a8abb2' }
const LEVEL_BG: Record<string, string> = { RISK: '#fef0f0', JOINT: '#fdf6ec', CHECK: '#f5effc', INFO: '#f4f4f5' }
const SIDE_TEXT: Record<string, string> = { FRONT: '前端', BACK: '后端', CLIENT: '客户端' }
const KIND_TEXT: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端', CLIENT: '客户端' }
const CHANGE_TEXT: Record<string, string> = { ADDED: '新增', MODIFIED: '修改', REMOVED: '下线' }
const CALL_TEXT: Record<string, string> = {
  NEW_CALL: '新写的调用',
  CHANGED_FILE: '所在文件改了',
  UNCHANGED: '没改',
  REMOVED_CALL: '删掉了调用'
}
const FILE_TEXT: Record<string, string> = { ADDED: '新增', MODIFIED: '修改', DELETED: '删除' }
const NODE_W = 210
const NODE_H = 62
const ROW = 84
const TOP = 26

const uid = 'xpv' + Math.random().toString(36).slice(2, 8)
const levelFilter = ref<'ALL' | Level>('ALL')
const focus = ref<{ node?: string; from?: string; to?: string } | null>(null)
const tab = ref('0')

const a = computed(() => props.ticket?.assessment)
const links = computed<any[]>(() => props.ticket?.links || [])
const projects = computed<any[]>(() => (props.ticket?.targets || []).filter((x: any) => x.projectCode))
const projectCount = computed(() => projects.value.length)
const missing = computed(() => projects.value.filter((x) => x.codeMissing))
const frontProjects = computed(() => projects.value.filter((x) => x.front))

watch(
  () => props.ticket?.key,
  () => {
    focus.value = null
    levelFilter.value = 'ALL'
    tab.value = '0'
  }
)

const levelCount = computed(() => {
  const m: Record<string, number> = {}
  for (const l of links.value) m[l.level] = (m[l.level] || 0) + 1
  return m
})

function worse(x: string, y: string) {
  return LEVELS.indexOf(x as Level) <= LEVELS.indexOf(y as Level) ? x : y
}

const graph = computed(() => {
  const all: any[] = props.ticket?.nodes || []
  const callers = all.filter((n) => n.side !== 'BACK')
  const backs = all.filter((n) => n.side === 'BACK')
  const callerX = callers.length ? 16 : null
  const backX = callers.length ? 16 + NODE_W + 160 : 16
  const rows = Math.max(callers.length, backs.length, 1)
  const height = TOP + rows * ROW
  const place = (list: any[], x: number) => {
    const offset = ((rows - list.length) * ROW) / 2
    return list.map((n, i) => ({ ...n, x, y: TOP + offset + i * ROW + (ROW - NODE_H) / 2 }))
  }
  const placed = [...place(callers, callerX ?? 0), ...place(backs, backX)]
  const byId = new Map(placed.map((n) => [n.id, n]))

  const badges = new Map<string, { level: string; count: number }>()
  const agg = new Map<string, any>()
  for (const l of links.value) {
    const from = l.fromNode && byId.get(l.fromNode)
    const to = l.toNode && byId.get(l.toNode)
    if (!from || !to || from === to) {
      const solo = from || to
      if (solo) {
        const b = badges.get(solo.id)
        badges.set(solo.id, b ? { level: worse(b.level, l.level), count: b.count + 1 } : { level: l.level, count: 1 })
      }
      continue
    }
    const key = from.id + '|' + to.id
    const e = agg.get(key)
    if (e) {
      e.count++
      e.byLevel[l.level] = (e.byLevel[l.level] || 0) + 1
      e.level = worse(e.level, l.level)
      e.inferred = e.inferred && l.inferred
    } else {
      agg.set(key, {
        key, from: from.id, to: to.id, f: from, t: to, count: 1, byLevel: { [l.level]: 1 }, level: l.level,
        inferred: !!l.inferred
      })
    }
  }

  let arcs = 0
  const edges = [...agg.values()].map((e) => {
    const sameCol = e.f.x === e.t.x
    const y1 = e.f.y + NODE_H / 2
    const y2 = e.t.y + NODE_H / 2
    let p: number[]
    if (sameCol) {
      const x = e.f.x + NODE_W
      const bulge = 60 + Math.abs(y2 - y1) * 0.25 + arcs++ * 12
      p = [x, y1, x + bulge, y1, x + bulge, y2, x + 4, y2]
    } else {
      const x1 = e.f.x < e.t.x ? e.f.x + NODE_W : e.f.x
      const x2 = e.f.x < e.t.x ? e.t.x - 4 : e.t.x + NODE_W + 4
      const dx = (x2 - x1) * 0.45
      p = [x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2]
    }
    const lx = (p[0] + 3 * p[2] + 3 * p[4] + p[6]) / 8
    const ly = (p[1] + 3 * p[3] + 3 * p[5] + p[7]) / 8
    const top = e.byLevel[e.level]
    const label = `${LEVEL_TEXT[e.level]}${e.count > 1 ? ' ' + top : ''}${e.count > top ? ' +' + (e.count - top) : ''}`
    const lw = textWidth(label) + 16
    return { ...e, d: `M${p[0]},${p[1]} C${p[2]},${p[3]} ${p[4]},${p[5]} ${p[6]},${p[7]}`, lx, ly, label, lw }
  })
  const maxArc = edges.reduce((m, e) => (e.f.x === e.t.x ? Math.max(m, e.lx - e.f.x - NODE_W + e.lw / 2 + 8) : m), 0)
  const width = backX + NODE_W + Math.max(maxArc, 24)
  return {
    nodes: placed.map((n) => ({ ...n, badge: badges.get(n.id) })),
    edges,
    callerX,
    backX,
    width,
    height
  }
})

/** 11px 字：中文约 11px，其它约 6.5px */
function textWidth(s: string) {
  let w = 0
  for (const ch of s) w += /[\u2E80-\uFFFF]/.test(ch) ? 11 : 6.5
  return Math.ceil(w)
}

function nodeClass(n: any) {
  if (n.status === 'ERROR') return 'err'
  if (n.status === 'NO_CODE' || n.status === 'NOT_FOUND') return 'miss'
  return n.changed ? 'chg' : ''
}

function nodeState(n: any) {
  if (n.status === 'ERROR') return '没分析成功'
  if (n.status === 'NO_CODE') return '缺代码'
  if (n.status === 'NOT_FOUND') return '没找到项目'
  return n.changed ? '有改动' : '没改'
}

function focusNode(id: string) {
  focus.value = focus.value?.node === id ? null : { node: id }
}

function focusEdge(e: any) {
  focus.value = focus.value?.from === e.from && focus.value?.to === e.to ? null : { from: e.from, to: e.to }
}

function linkInFocus(l: any) {
  const f = focus.value
  if (!f) return true
  if (f.node) return l.fromNode === f.node || l.toNode === f.node
  return l.fromNode === f.from && l.toNode === f.to
}

function isEdgeFocus(e: any) {
  return focus.value?.from === e.from && focus.value?.to === e.to
}

function isDim(e: any) {
  const f = focus.value
  if (!f) return false
  if (f.node) return e.from !== f.node && e.to !== f.node
  return !isEdgeFocus(e)
}

function isNodeDim(id: string) {
  const f = focus.value
  if (!f) return false
  if (f.node) {
    return f.node !== id && !graph.value.edges.some((e) => (e.from === f.node && e.to === id) || (e.to === f.node && e.from === id))
  }
  return f.from !== id && f.to !== id
}

const focusText = computed(() => {
  const f = focus.value
  if (!f) return ''
  const name = (id?: string) => graph.value.nodes.find((n) => n.id === id)?.name || id
  return f.node ? `和 ${name(f.node)} 有关的` : `${name(f.from)} → ${name(f.to)}`
})

/** 同一对项目、同一个结论的合成一条（如「只改了实现」的十几个接口），接口列在里面 */
const groupedLinks = computed(() => {
  const groups = new Map<string, any[]>()
  for (const l of links.value) {
    if ((levelFilter.value !== 'ALL' && l.level !== levelFilter.value) || !linkInFocus(l)) continue
    const key = [l.level, l.fromNode, l.toNode, l.title, l.inferred].join('|')
    const g = groups.get(key)
    if (g) g.push(l)
    else groups.set(key, [l])
  }
  return [...groups.values()]
})

function tName(x: any) {
  return x.projectName || x.projectCode || x.rawProject
}

function shortMissing(s: string) {
  if (!s) return ''
  return s.length > 24 ? s.slice(0, 24) + '…' : s
}

function tabDot(x: any) {
  if (x.error) return 'err'
  if (x.codeMissing) return 'miss'
  return x.reportId || x.front ? 'ok' : ''
}

function frontSummary(fc: any) {
  const parts = [`改了 ${fc.changedFiles} 个文件`]
  if (fc.pages?.length) parts.push(`页面 / 组件 ${fc.pages.length} 个`)
  if (fc.addedCalls?.length) parts.push(`新增接口调用 ${fc.addedCalls.length}`)
  if (fc.removedCalls?.length) parts.push(`删掉接口调用 ${fc.removedCalls.length}`)
  return parts.join(' · ')
}
</script>

<style scoped>
.xpv {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 10px 0;
}
.banner {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.bn-HIGH {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
}
.bn-MEDIUM {
  border-color: var(--el-color-warning-light-7);
  background: var(--el-color-warning-light-9);
}
.bn-LOW {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}
.bn-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.bn-risk {
  font-size: 16px;
  font-weight: 600;
}
.bn-HIGH .bn-risk {
  color: var(--el-color-danger);
}
.bn-MEDIUM .bn-risk {
  color: var(--el-color-warning);
}
.bn-LOW .bn-risk {
  color: var(--el-color-success);
}
.bn-proj {
  font-size: 13px;
}
.bn-cnt {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
}
.bn-reasons {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}
.bn-missing {
  margin-top: 6px;
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
}
.miss-item {
  padding: 0 6px;
  border: 1px dashed var(--el-border-color);
  border-radius: 3px;
  background: #fff;
}
.miss-item em {
  font-style: normal;
  margin-left: 4px;
  color: var(--el-text-color-secondary);
}
.lv-RISK {
  color: #f56c6c;
}
.lv-JOINT {
  color: #d48806;
}
.lv-CHECK {
  color: #8250c4;
}
.lv-INFO {
  color: #909399;
}
.sec {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px 14px;
}
.sec-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.sec-head h4 {
  margin: 0;
  font-size: 14px;
}
.sec-head h4 em {
  font-style: normal;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 4px;
}
.graph-wrap {
  overflow-x: auto;
}
.graph {
  display: block;
  width: 100%;
  height: auto;
  font-family: inherit;
}
.col-title {
  font-size: 12px;
  fill: var(--el-text-color-secondary);
}
.edge {
  cursor: pointer;
}
.edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
}
.edge-label {
  font-size: 11px;
  font-weight: 500;
}
.edge.dim,
foreignObject.dim {
  opacity: 0.25;
}
foreignObject {
  cursor: pointer;
}
.node {
  box-sizing: border-box;
  height: 100%;
  padding: 6px 10px;
  border: 1.5px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  line-height: 1.45;
  overflow: hidden;
}
.node.chg {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.node.miss {
  border-style: dashed;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}
.node.err {
  border-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.node.on {
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}
.n-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.n-badge {
  margin-left: 6px;
  font-size: 11px;
  padding: 0 5px;
  border-radius: 8px;
  border: 1px solid currentColor;
}
.n-sub {
  color: var(--el-text-color-secondary);
}
.n-branch {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.lg-line {
  display: inline-block;
  width: 18px;
  height: 2px;
  vertical-align: middle;
  margin-right: 4px;
}
.lg-line.dashed {
  background: repeating-linear-gradient(90deg, #909399 0 5px, transparent 5px 8px);
}
.lg-box {
  display: inline-block;
  width: 12px;
  height: 10px;
  vertical-align: middle;
  margin-right: 4px;
  border: 1.5px solid var(--el-border-color);
  border-radius: 2px;
}
.lg-box.chg {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.lg-box.miss {
  border-style: dashed;
}
.focus-bar {
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--el-color-primary);
}
.link {
  padding: 8px 10px;
  border-left: 3px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  border-radius: 0 6px 6px 0;
}
.link + .link {
  margin-top: 6px;
}
.lk-RISK {
  border-left-color: #f56c6c;
}
.lk-JOINT {
  border-left-color: #e6a23c;
}
.lk-CHECK {
  border-left-color: #9b6dd6;
}
.lk-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.lk-level {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.lk-title {
  font-weight: 500;
}
.lk-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.lk-ep {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  padding-left: 12px;
}
.lk-inferred {
  font-size: 11px;
  padding: 0 5px;
  border: 1px dashed var(--el-border-color-darker);
  border-radius: 3px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.lk-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-top: 3px;
  font-size: 12px;
}
.lk-who {
  color: var(--el-text-color-regular);
}
.lk-tag {
  color: var(--el-text-color-secondary);
}
.lk-refs {
  margin-top: 4px;
  font-size: 12px;
}
.lk-refs summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.ref {
  padding-left: 12px;
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.sm {
  margin-top: 4px;
}
.tab-label em {
  font-style: normal;
  font-size: 11px;
  margin-left: 4px;
  color: var(--el-text-color-secondary);
}
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
  background: var(--el-border-color);
  vertical-align: middle;
}
.dot.ok {
  background: var(--el-color-success);
}
.dot.err {
  background: var(--el-color-danger);
}
.dot.miss {
  background: transparent;
  border: 1px dashed var(--el-text-color-secondary);
}
.pane {
  font-size: 13px;
  line-height: 1.6;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  align-items: center;
}
.tl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}
.tg {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
.calls {
  margin-top: 6px;
}
.call {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  padding-left: 8px;
}
.add {
  color: var(--el-color-success);
}
.del {
  color: var(--el-color-danger);
}
.files {
  margin-top: 6px;
  font-size: 12px;
}
.files summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.file {
  display: flex;
  gap: 8px;
  padding-left: 8px;
}
.st-ADDED {
  color: var(--el-color-success);
}
.st-MODIFIED {
  color: var(--el-color-warning);
}
.st-DELETED {
  color: var(--el-color-danger);
}
</style>
