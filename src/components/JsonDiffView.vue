<template>
  <div class="jdv">
    <div class="jdv-bar">
      <div class="jdv-left">
        <span v-if="stat.added" class="jdv-stat is-added">+{{ stat.added }}</span>
        <span v-if="stat.modified" class="jdv-stat is-modified">~{{ stat.modified }}</span>
        <span v-if="stat.removed" class="jdv-stat is-removed">−{{ stat.removed }}</span>
        <span v-if="!rows.length && blocks.length" class="jdv-muted">这次没变，下面是完整结构</span>
        <el-checkbox v-if="rows.length && hasUnchanged" v-model="onlyChanged" size="small" class="jdv-only">只看变更</el-checkbox>
        <template v-if="hasNested">
          <el-button link size="small" :disabled="onlyChanged" @click="collapsed.clear()">全部展开</el-button>
          <el-button link size="small" :disabled="onlyChanged" @click="foldUnchanged">收起没变的</el-button>
        </template>
      </div>
      <div class="jdv-right">
        <template v-if="marks && rows.length">
          <span class="jdv-muted">已确认 {{ confirmedCount }}/{{ rows.length }}</span>
          <el-button v-if="confirmedCount < rows.length" link type="primary" size="small" @click="confirm(rows, true)">
            全部标记已确认
          </el-button>
        </template>
        <el-button v-if="canAssert && rows.length" size="small" type="primary" plain @click="openAssert(rows)">
          变更字段转为断言
        </el-button>
        <slot name="extra" />
      </div>
    </div>

    <el-empty v-if="!blocks.length" :description="emptyText || '没有变化'" :image-size="48" />

    <section v-for="bl in blockLines" :key="bl.b.key" class="jdv-block">
      <header v-if="bl.b.title" class="jdv-block-head">
        <span class="jdv-loc" :class="`loc-${bl.b.loc.toLowerCase()}`">{{ bl.b.title }}</span>
        <span v-if="bl.b.sub" class="jdv-muted">{{ bl.b.sub }}</span>
      </header>
      <div class="jdv-code">
        <div v-for="l in bl.lines" :key="l.key" class="jdv-line" :class="lineClass(l)">
          <span class="jdv-gutter">{{ signOf(l) }}</span>
          <span class="jdv-src" :style="{ paddingLeft: 6 + l.depth * 18 + 'px' }" :title="titleOf(l)">
            <button
              v-if="l.kind === 'open' || l.kind === 'fold'"
              type="button"
              class="jdv-tog"
              :aria-expanded="l.kind === 'open'"
              @click="toggle(l.id!)"
            >{{ l.kind === 'open' ? '▾' : '▸' }}</button>
            <span v-else class="jdv-tog" />
            <template v-if="l.kind === 'brace' || l.kind === 'close'">
              <span class="p">{{ l.text }}</span><span v-if="l.comma" class="p">,</span>
            </template>
            <span v-else-if="l.kind === 'more'" class="jdv-more">{{ l.text }}</span>
            <template v-else>
              <span class="k" :class="{ struck: l.node!.row?.kind === 'REMOVED' }">"{{ l.node!.name }}"</span><span class="p">: </span>
              <span v-if="l.kind === 'open'" class="p">{{ l.node!.array ? '[ {' : '{' }}</span>
              <template v-else-if="l.kind === 'fold'">
                <span class="p">{{ l.node!.array ? '[ {' : '{' }}</span>
                <button type="button" class="jdv-dots" @click="toggle(l.id!)">…</button>
                <span class="p">{{ l.node!.array ? '} ]' : '}' }}</span><span v-if="l.comma" class="p">,</span>
              </template>
              <template v-else>
                <template v-if="l.node!.row?.changeType === 'TYPE_CHANGED'">
                  <del class="v-old">{{ l.node!.row.oldType }}</del><span class="p"> → </span>
                  <span class="v">{{ l.node!.row.newType }}</span>
                </template>
                <span v-else class="v">{{ valueOf(l.node!) }}</span><span v-if="l.comma" class="p">,</span>
              </template>
              <span v-if="l.node!.comment" class="c">  // {{ l.node!.comment }}</span>
            </template>
          </span>

          <span v-if="l.node && (l.kind === 'fold' || l.node.row)" class="jdv-meta">
            <span v-if="l.kind === 'fold'" class="jdv-muted">
              {{ fieldCount(l.node) }} 个字段<template v-if="l.node.changes">，<b class="jdv-hot">{{ l.node.changes }} 处变化</b></template>
            </span>
            <template v-if="l.node.row">
              <span v-if="l.node.children.length && l.node.row.changeType === 'TYPE_CHANGED'" class="jdv-type-chg">
                <del>{{ l.node.row.oldType }}</del> → <b>{{ l.node.row.newType }}</b>
              </span>
              <span v-if="reqText(l.node.row)" class="jdv-req" :class="reqTone(l.node.row)">{{ reqText(l.node.row) }}</span>
              <el-tooltip v-if="impactOf(l.node.row)" :disabled="!l.node.row.wireNote" :content="l.node.row.wireNote" placement="top">
                <span class="jdv-impact" :class="impactOf(l.node.row)!.tone">{{ impactOf(l.node.row)!.text }}</span>
              </el-tooltip>
              <template v-if="marks">
                <button v-if="marks.tagOf(endpoint!, l.node.row)" type="button" class="jdv-tag" @click="openTag([l.node.row])">
                  {{ marks.tagOf(endpoint!, l.node.row) }}
                </button>
                <button v-else type="button" class="jdv-tag empty jdv-hover" @click="openTag([l.node.row])">＋ 标签</button>
              </template>
              <button v-if="canAssert" type="button" class="jdv-act jdv-hover" @click="openAssert([l.node.row])">转为断言</button>
              <template v-if="marks">
                <button
                  v-if="marks.isConfirmed(endpoint!, l.node.row)"
                  type="button"
                  class="jdv-act done"
                  title="点一下撤销"
                  @click="confirm([l.node.row], false)"
                >✓ 已确认</button>
                <button v-else type="button" class="jdv-act jdv-hover" @click="confirm([l.node.row], true)">确认</button>
              </template>
            </template>
          </span>
        </div>
      </div>
    </section>

    <FieldTagDialog v-model="tagOpen" :rows="tagRows" :endpoint="endpoint" :marks="marks" />
    <FieldAssertDialog v-if="canAssert" v-model="assertOpen" :project="project" :endpoint="endpoint" :rows="assertRows" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import FieldAssertDialog from '@/components/FieldAssertDialog.vue'
import FieldTagDialog from '@/components/FieldTagDialog.vue'
import { KIND_META, WIRE_LABEL, diffStat, type DiffRow } from '@/utils/fieldDiff'
import type { JBlock, JNode } from '@/utils/jsonDiffTree'
import type { EndpointRef, FieldMarks } from '@/composables/useFieldMarks'

const props = defineProps<{
  blocks: JBlock[]
  project: string
  /** 孤立 DTO 传 { method: 'DTO', path: 类名 } */
  endpoint: EndpointRef | null
  marks?: FieldMarks | null
  /** 返回字段才能转断言，且得是真接口 */
  canAssert?: boolean
  emptyText?: string
}>()

interface Line {
  key: string
  depth: number
  kind: 'brace' | 'open' | 'close' | 'fold' | 'leaf' | 'more'
  node?: JNode
  id?: string
  text?: string
  comma: boolean
}

const marks = computed(() => (props.endpoint && props.marks ? props.marks : null))
const rows = computed(() => props.blocks.flatMap((b) => b.rows))
const stat = computed(() => diffStat(rows.value))
const confirmedCount = computed(() =>
  marks.value ? rows.value.filter((r) => marks.value!.isConfirmed(props.endpoint!, r)).length : 0
)

const onlyChanged = ref(false)
const collapsed = reactive(new Set<string>())
const hasNested = computed(() => props.blocks.some((b) => b.root.children.some((n) => n.children.length)))
const hasUnchanged = computed(() => props.blocks.some((b) => b.root.children.some((n) => !n.changes)))

function nodeId(b: JBlock, n: JNode) {
  return `${b.key}|${n.id}`
}

function foldUnchanged() {
  collapsed.clear()
  const walk = (b: JBlock, n: JNode) => {
    for (const c of n.children) {
      if (c.children.length && !c.changes) collapsed.add(nodeId(b, c))
      walk(b, c)
    }
  }
  for (const b of props.blocks) walk(b, b.root)
}

watch(
  () => props.blocks,
  () => {
    onlyChanged.value = false
    foldUnchanged()
  },
  { immediate: true }
)

function toggle(id: string) {
  if (collapsed.has(id)) collapsed.delete(id)
  else collapsed.add(id)
}

function walkLines(b: JBlock, list: JNode[], depth: number, out: Line[]) {
  const visible = onlyChanged.value ? list.filter((n) => n.changes > 0) : list
  visible.forEach((n, i) => {
    const id = nodeId(b, n)
    const comma = i < visible.length - 1
    if (!n.children.length) {
      out.push({ key: id, depth, kind: 'leaf', node: n, comma })
    } else if (onlyChanged.value || !collapsed.has(id)) {
      out.push({ key: id, depth, kind: 'open', node: n, id, comma: false })
      walkLines(b, n.children, depth + 1, out)
      out.push({ key: `${id}$`, depth, kind: 'close', node: n, text: n.array ? '} ]' : '}', comma })
    } else {
      out.push({ key: id, depth, kind: 'fold', node: n, id, comma })
    }
  })
  const hidden = list.length - visible.length
  if (hidden) out.push({ key: `${b.key}|${depth}|more|${list[0]?.id}`, depth, kind: 'more', text: `… 还有 ${hidden} 个字段没变`, comma: false })
}

const blockLines = computed(() =>
  props.blocks.map((b) => {
    const lines: Line[] = [{ key: `${b.key}^`, depth: 0, kind: 'brace', text: b.list ? '[ {' : '{', comma: false }]
    walkLines(b, b.root.children, 1, lines)
    lines.push({ key: `${b.key}$`, depth: 0, kind: 'brace', text: b.list ? '} ]' : '}', comma: false })
    return { b, lines }
  })
)

function fieldCount(n: JNode): number {
  return n.children.reduce((s, c) => s + 1 + fieldCount(c), 0)
}

function valueOf(n: JNode) {
  return n.type || n.row?.newType || n.row?.oldType || '?'
}

function lineClass(l: Line) {
  const r = l.node?.row
  if (!r || l.kind === 'close') return ''
  const done = marks.value?.isConfirmed(props.endpoint!, r)
  return `is-${KIND_META[r.kind].tone}${done ? ' is-done' : ''}`
}

function signOf(l: Line) {
  if (l.kind === 'close' || !l.node) return ''
  if (l.node.row) return KIND_META[l.node.row.kind].icon
  return l.kind === 'fold' && l.node.changes ? '•' : ''
}

function titleOf(l: Line) {
  if (!l.node || l.kind === 'close') return undefined
  const n = l.node
  return [n.id && !n.id.startsWith('~') ? n.id : n.name, valueOf(n), n.comment].filter(Boolean).join('  ')
}

function reqText(r: DiffRow) {
  if (r.side !== 'REQUEST' || r.required === undefined) return ''
  if (r.changeType === 'REQUIRED_CHANGED') return r.required ? '可选 → 必填' : '必填 → 可选'
  return r.required ? '必填' : '可选'
}

function reqTone(r: DiffRow) {
  if (r.changeType === 'REQUIRED_CHANGED') return 'changed'
  return r.required ? 'must' : ''
}

function impactOf(r: DiffRow): { text: string; tone: string } | null {
  if (r.breaking) return { text: '可能不兼容', tone: 'danger' }
  if (!r.wireEffect || r.wireEffect === 'SAME') return null
  return { text: WIRE_LABEL[r.wireEffect] || r.wireEffect, tone: r.wireEffect === 'NULLABILITY' ? 'warn' : '' }
}

async function confirm(list: DiffRow[], value: boolean) {
  if (!marks.value) return
  try {
    await marks.value.setConfirmed(props.endpoint!, list, value)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

const tagOpen = ref(false)
const tagRows = ref<DiffRow[]>([])
function openTag(list: DiffRow[]) {
  if (!marks.value) return
  tagRows.value = list
  tagOpen.value = true
}

const assertOpen = ref(false)
const assertRows = ref<DiffRow[]>([])
function openAssert(list: DiffRow[]) {
  assertRows.value = list
  assertOpen.value = true
}
</script>

<style scoped>
.jdv {
  --diff-add: #1a7f37;
  --diff-add-soft: #e6ffec;
  --diff-mod: #9a6700;
  --diff-mod-soft: #fff8c5;
  --diff-del: #cf222e;
  --diff-del-soft: #ffebe9;
}

.jdv-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.jdv-left,
.jdv-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jdv-stat {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  font-weight: 700;
}

.jdv-stat.is-added { color: var(--diff-add); }
.jdv-stat.is-modified { color: var(--diff-mod); }
.jdv-stat.is-removed { color: var(--diff-del); }

.jdv-only {
  margin-left: 6px;
}

.jdv-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.jdv-hot {
  font-weight: 600;
  color: var(--diff-mod);
}

.jdv-block {
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.jdv-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.jdv-loc {
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  background: var(--el-fill-color);
}

.jdv-loc.loc-query { background: #e8f1ff; color: #1f5fbf; }
.jdv-loc.loc-body { background: #f3e8ff; color: #7a3fbf; }
.jdv-loc.loc-path { background: #e6f7f5; color: #11766a; }
.jdv-loc.loc-header { background: #f2f2f2; color: #555; }
.jdv-loc.loc-response { background: #fff0e6; color: #b45309; }

.jdv-code {
  padding: 6px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 24px;
  background: #fff;
}

.jdv-line {
  display: flex;
  align-items: center;
  min-height: 24px;
  padding-right: 10px;
}

.jdv-line:hover {
  background: var(--el-fill-color-light);
}

.jdv-line.is-added { background: var(--diff-add-soft); }
.jdv-line.is-modified { background: var(--diff-mod-soft); }
.jdv-line.is-removed { background: var(--diff-del-soft); }
.jdv-line.is-done .jdv-src { opacity: 0.55; }

.jdv-gutter {
  flex: none;
  width: 22px;
  font-weight: 700;
  text-align: center;
  color: var(--diff-mod);
  user-select: none;
}

.jdv-line.is-added .jdv-gutter { color: var(--diff-add); }
.jdv-line.is-removed .jdv-gutter { color: var(--diff-del); }

.jdv-src {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}

.jdv-tog {
  display: inline-block;
  width: 16px;
  padding: 0;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

span.jdv-tog {
  cursor: default;
}

.jdv-dots {
  margin: 0 2px;
  padding: 0 4px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  font-size: 11px;
  line-height: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.k { color: #0550ae; }
.k.struck { text-decoration: line-through; color: var(--diff-del); }
.p { color: #57606a; }
.v { color: #116329; }
.v-old { color: var(--diff-del); }
.c { color: #8c959f; }

.jdv-more {
  font-style: italic;
  color: var(--el-text-color-placeholder);
}

.jdv-meta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  font-family: var(--el-font-family);
  font-size: 12px;
}

.jdv-type-chg {
  font-family: ui-monospace, Menlo, monospace;
}

.jdv-type-chg del { color: var(--diff-del); }
.jdv-type-chg b { color: var(--diff-add); }

.jdv-req { color: var(--el-text-color-secondary); }
.jdv-req.must { color: var(--diff-del); }
.jdv-req.changed { color: var(--diff-mod); font-weight: 600; }

.jdv-impact { color: var(--el-text-color-secondary); }
.jdv-impact.danger { color: var(--diff-del); font-weight: 600; }
.jdv-impact.warn { color: var(--diff-mod); }

.jdv-tag {
  max-width: 160px;
  padding: 0 8px;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  background: #eef2ff;
  font-size: 12px;
  line-height: 18px;
  color: #4338ca;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jdv-tag.empty {
  border-style: dashed;
  border-color: var(--el-border-color);
  background: #fff;
  color: var(--el-text-color-placeholder);
}

.jdv-act {
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.jdv-act.done {
  color: var(--diff-add);
}

.jdv-hover {
  opacity: 0;
  transition: opacity 0.12s;
}

.jdv-line:hover .jdv-hover,
.jdv-hover:focus-visible {
  opacity: 1;
}
</style>
