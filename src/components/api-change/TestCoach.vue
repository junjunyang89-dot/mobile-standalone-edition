<template>
  <el-drawer :model-value="modelValue" size="560px" append-to-body class="coach-drawer" :with-header="false"
             @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <div v-if="card" class="coach" @dragenter.prevent="onDragEnter" @dragleave="onDragLeave" @dragover.prevent @drop.prevent="onDrop">
      <div v-if="dragDepth > 0" class="c-drop">松开，把截图发给 AI</div>
      <div class="c-top">
        <span class="c-name"><i>✦</i>AI 测试教练</span>
        <span class="c-method">{{ card.method }}</span>
        <span class="mono c-path" :title="card.path">{{ card.path }}</span>
        <span class="grow" />
        <el-tooltip placement="bottom-end" :show-after="200">
          <template #content>
            <div class="ro-tip">Cursor 只读，不会改任何文件。读的代码：{{ codeLabel }}<template v-if="codeTitle">{{ '\n' + codeTitle }}</template></div>
          </template>
          <span class="c-ro">只读</span>
        </el-tooltip>
        <span class="c-link" :class="{ off: loading }" @click="!loading && restart()">重新开始</span>
        <span class="c-close" title="关闭" @click="emit('update:modelValue', false)">×</span>
      </div>
      <div v-if="statusHint" class="c-warn">{{ statusHint }}</div>

      <div ref="boxEl" class="c-msgs">
        <div v-if="!session.messages.length && !loading" class="c-empty">
          <div class="e-icon">✦</div>
          <div class="e-title">从哪开始？</div>
          <div class="e-sub">它会结合<b>这次的改动和代码</b>，一步步带你测：造什么数据、怎么发请求、看哪个字段、查哪张表 / 哪个缓存。</div>
          <div class="e-grid">
            <button v-for="q in quick" :key="q.label" type="button" class="e-q" :disabled="loading" @click="send(q.ask, q.label)">
              <span class="e-q-icon">{{ q.icon }}</span>{{ q.label }}
            </button>
          </div>
          <div class="e-tip">也可以直接说你在哪一步卡住了</div>
        </div>

        <div v-for="(m, i) in session.messages" :key="i" class="msg" :class="m.role">
          <div v-if="m.role === 'user'" class="bubble">
            <div v-if="m.images?.length" class="b-imgs">
              <el-image v-for="(u, k) in m.images" :key="k" :src="u" :preview-src-list="m.images" :initial-index="k"
                        fit="cover" class="b-img" preview-teleported />
            </div>
            {{ m.shown || m.text }}
          </div>
          <template v-else>
            <span class="avatar">✦</span>
            <div class="bubble ai">
              <template v-for="(p, j) in parts(m.text)" :key="j">
                <div v-if="p.type === 'code'" class="code">
                  <div class="code-bar">
                    <span class="lang" :class="langOf(p).cls">{{ langOf(p).label }}</span>
                    <el-button size="small" text @click="copy(p.text)">复制</el-button>
                  </div>
                  <pre>{{ p.text }}</pre>
                </div>
                <div v-else class="txt md" v-html="mdBlocks(p.text)" />
              </template>
            </div>
          </template>
        </div>
        <div v-if="loading" class="msg assistant">
          <span class="avatar">✦</span>
          <div class="bubble ai thinking">
            正在读代码、想测法<span class="dots"><i /><i /><i /></span>
            <div class="think-sub">第一次要读代码，可能要一两分钟</div>
          </div>
        </div>
      </div>

      <div class="c-foot" @paste="onPaste">
        <div v-if="session.messages.length" class="c-quick">
          <span v-for="q in quick" :key="q.label" class="q" :class="{ off: loading }" @click="!loading && send(q.ask, q.label)">
            {{ q.short }}
          </span>
        </div>
        <div v-if="pending.length" class="c-pend">
          <div v-for="(p, k) in pending" :key="k" class="pend">
            <img :src="p.url" alt="" />
            <span class="x" title="移除" @click="pending.splice(k, 1)">×</span>
          </div>
        </div>
        <div class="c-input">
          <el-input v-model="draft" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" :disabled="loading"
                    :placeholder="session.messages.length ? '把执行结果 / 报错贴进来' : '问点什么，或把返回 / 报错贴进来'"
                    @keydown.enter.exact="onEnter" />
          <el-button type="primary" class="send" :loading="loading" :disabled="!draft.trim() && !pending.length" @click="send(draft)">发送</el-button>
        </div>
        <div class="c-hint">
          <span class="c-pic" :class="{ off: loading }" @click="!loading && fileEl?.click()">
            <el-icon><Picture /></el-icon>截图：粘贴 / 拖进来 / 点这里选
          </span>
          <span class="grow" />
          <kbd>Enter</kbd> 发送 · <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行
        </div>
        <input ref="fileEl" type="file" accept="image/*" multiple hidden @change="onPick" />
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import { apiClient } from '../../api'
import { mdBlocks } from '../../utils/miniMarkdown'

type Msg = { role: 'user' | 'assistant'; text: string; shown?: string; images?: string[] }
type Session = { id: string; messages: Msg[]; primed: boolean }
type Img = { url: string; data: string; mimeType: string }
type CodeDir = { projectCode: string; project: string; kind?: string; branch?: string; dir?: string; missing?: string }

const props = defineProps<{
  modelValue: boolean
  batchId?: number
  ticket: any
  card: any | null
  target: any | null
  /** 打开时自动问的一句（点某一条「问 AI」时带进来） */
  initialAsk?: { text: string; shown: string } | null
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

/** 同一个接口的对话留着，关掉再打开还能接着聊；刷新页面才清 */
const sessions = reactive<Record<string, Session>>({})
const draft = ref('')
const loading = ref(false)
const statusHint = ref('')
const boxEl = ref<HTMLElement>()

const sessionKey = computed(() => (props.card ? `${props.ticket?.key}|${props.card.method} ${props.card.path}` : ''))
const EMPTY: Session = { id: '', messages: [], primed: false }
watch(
  sessionKey,
  (k) => {
    if (k && !sessions[k]) sessions[k] = { id: newSessionId(), messages: [], primed: false }
  },
  { immediate: true }
)
const session = computed<Session>(() => sessions[sessionKey.value] || EMPTY)

/** 这一单所有项目（后端 / H5 / 客户端）的待测代码，一起给 AI 读 */
const codeDirs = ref<CodeDir[]>([])
let dirsKey = ''
let dirsLoading: Promise<void> | null = null
function loadDirs() {
  const key = `${props.batchId}|${props.ticket?.key}|${props.ticket?.analyzedAt || ''}|${props.ticket?.targets?.length || 0}`
  if (!props.batchId || !props.ticket?.key || key === dirsKey) return dirsLoading || Promise.resolve()
  dirsKey = key
  dirsLoading = apiClient
    .getApiChangeBatchCodeDirs(props.batchId, props.ticket.key)
    .then((r) => {
      codeDirs.value = Array.isArray(r) ? r : []
    })
    .catch(() => {
      codeDirs.value = []
      dirsKey = ''
    })
  return dirsLoading
}
const mine = computed(() => {
  const x = props.target || {}
  return (
    codeDirs.value.find((d) => d.dir && d.projectCode === x.projectCode && (d.branch || '') === (x.branch || '')) ||
    codeDirs.value.find((d) => d.dir && d.projectCode === x.projectCode)
  )
})
const cwd = computed(() => mine.value?.dir || props.target?.headDir?.trim() || codeDirs.value.find((d) => d.dir)?.dir || '')
const otherDirs = computed(() => [...new Set(codeDirs.value.map((d) => d.dir).filter((d): d is string => !!d && d !== cwd.value))])
const KIND_TEXT: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端 / H5', CLIENT: '客户端' }
const codeLabel = computed(() => {
  const n = codeDirs.value.filter((d) => d.dir).length
  if (!n) return cwd.value || '默认工作区'
  const name = mine.value?.project || codeDirs.value.find((d) => d.dir)?.project || ''
  return n > 1 ? `${name} 等 ${n} 个项目` : name
})
const codeTitle = computed(() =>
  codeDirs.value
    .map((d) => `${KIND_TEXT[d.kind || ''] || ''} ${d.project}${d.branch ? '@' + d.branch : ''}：${d.dir || '拿不到代码（' + (d.missing || '') + '）'}`)
    .join('\n')
)

/** 截图：粘贴 / 拖进来 / 点按钮选，发之前压一下，太大的图模型也看不清 */
const MAX_IMAGES = 4
const MAX_SIDE = 2000
const MAX_BYTES = 2.5 * 1024 * 1024
const pending = ref<Img[]>([])
const fileEl = ref<HTMLInputElement>()
const dragDepth = ref(0)

function readUrl(f: Blob) {
  return new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fail(r.error)
    r.readAsDataURL(f)
  })
}
function loadImg(url: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => fail(new Error('图片读不出来'))
    img.src = url
  })
}
function pack(url: string): Img {
  return { url, mimeType: url.slice(5, url.indexOf(';')), data: url.slice(url.indexOf(',') + 1) }
}
async function toImg(f: File): Promise<Img> {
  const url = await readUrl(f)
  const img = await loadImg(url)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  if (scale === 1 && f.size <= MAX_BYTES) return pack(url)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(img, 0, 0, canvas.width, canvas.height)
  return pack(canvas.toDataURL('image/jpeg', 0.85))
}
async function addFiles(files: File[]) {
  const imgs = files.filter((f) => f.type.startsWith('image/'))
  if (!imgs.length) return
  for (const f of imgs) {
    if (pending.value.length >= MAX_IMAGES) {
      ElMessage.warning(`一次最多 ${MAX_IMAGES} 张图`)
      break
    }
    try {
      pending.value.push(await toImg(f))
    } catch (e: any) {
      ElMessage.error(e?.message || '图片读不出来')
    }
  }
}
function onPaste(e: ClipboardEvent) {
  const files = Array.from(e.clipboardData?.files || [])
  if (files.some((f) => f.type.startsWith('image/'))) {
    e.preventDefault()
    addFiles(files)
  }
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles(Array.from(input.files || []))
  input.value = ''
}
function onDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) dragDepth.value++
}
function onDragLeave() {
  if (dragDepth.value > 0) dragDepth.value--
}
function onDrop(e: DragEvent) {
  dragDepth.value = 0
  if (!loading.value) addFiles(Array.from(e.dataTransfer?.files || []))
}

const quick = computed(() => {
  const c = props.card || {}
  const out = [
    { icon: '▶', label: '一步步教我测这个接口', short: '一步步教我', ask: '我不太知道怎么测这个接口。请一步步带我测：先说要准备什么数据，再给第一步要发的请求，等我把结果贴回来再说下一步。' },
    { icon: '◈', label: '帮我造测试数据', short: '帮我造测试数据', ask: '帮我造这个接口要用的测试数据：需要哪些表里有什么数据、给出 SQL 或者造数步骤，以及正常 / 边界 / 异常各一组请求入参。' },
    { icon: '✓', label: '期望结果是什么', short: '期望结果是什么', ask: '根据代码，这个接口改完以后，正常情况下应该返回什么？哪些字段必须核对？数据库 / 缓存里应该变成什么样？' }
  ]
  if (c.focus?.length) {
    out.push({ icon: '⇄', label: '并发怎么测', short: '并发怎么测', ask: '重点里的并发问题我该怎么实际测？给我一个能直接跑的脚本（curl + xargs 或 Python 都行），以及跑完怎么核对库和缓存。' })
  }
  if (c.cacheKeys?.length) {
    out.push({ icon: '⌕', label: '怎么查缓存', short: '怎么查缓存', ask: '这个接口用到的缓存 key，实际在 Redis 里完整的 key 长什么样（前缀后面拼了什么）？调接口前后我分别该查哪个 key、看什么值？' })
  }
  out.push({ icon: '!', label: '可能哪里有 bug', short: '可能哪里有 bug', ask: '读一下这次改动的代码，你觉得最可能出 bug 的地方是哪里？每个给一个能复现的测试步骤。' })
  return out
})

function newSessionId() {
  return 'guide-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** 第一句带上分析结果当背景，后面的对话 Cursor 会话里自己记着 */
function context() {
  const c = props.card || {}
  const t = props.ticket || {}
  const x = props.target || {}
  const list = (title: string, xs?: string[]) => (xs?.length ? `${title}：\n${xs.map((s) => '- ' + s).join('\n')}\n` : '')
  const focus = (c.focus || [])
    .map((f: any) => `- ${f.label}：${f.title}。${f.risk || ''} 做法：${f.how || ''}`)
    .join('\n')
  const code = codeDirs.value.length
    ? '这一单涉及的代码（都能读，按目录区分项目）：\n' +
      codeDirs.value
        .map((d) => `- ${KIND_TEXT[d.kind || ''] || '项目'} ${d.project}${d.branch ? '（分支 ' + d.branch + '）' : ''}：${d.dir || '拿不到代码，' + (d.missing || '')}`)
        .join('\n') +
      '\n'
    : ''
  const isMethod = c.kind === 'METHOD'
  return [
    isMethod ? '你是资深测试工程师，正在带一个测试同学测一处后端方法的逻辑改动。要求：' : '你是资深测试工程师，正在带一个测试同学测一个后端接口。要求：',
    '1. 先在这个接口所在项目的代码里找到实现（Controller → Service → Mapper / 缓存），基于真实代码回答，别瞎猜；找不到就直说。'
      + (otherDirs.value.length ? '这一单还涉及其它后端 / H5 / 客户端：去对应目录找调用这个接口的地方，看改动两边对不对得上（字段、参数、返回码），测法里要带上。' : ''),
    '我发截图时（页面、报错、抓包、查库结果），先说图里看到了什么，再结合代码判断。',
    '2. 一步一步来：每步说清楚做什么、具体请求（curl，入参写全）、看返回的哪个字段、去哪张表 / 哪个缓存 key 核对、期望值是什么。',
    '3. 一次只给 1～2 步，等我把结果贴回来再给下一步；我贴的结果不对时帮我判断是 bug 还是操作问题。',
    '4. 只读代码，不要改任何文件。用中文、用测试听得懂的话。',
    '5. 排版：开头一两句先说结论；分段用「## 小标题」；步骤用 1. 2. 编号；期望值、返回码用「- 」列表；命令放 ```bash、SQL 放 ```sql 代码块，占位符用 {大括号}；最后用一行「> 」写清楚要我贴回什么。',
    '',
    `需求单：${t.key || ''} ${t.summary || ''}`,
    `项目：${c.project || x.projectName || ''}，分支：${x.branch || '—'}`,
    isMethod
      ? `方法：${c.path}（${c.summary || ''}），${c.endpoints?.length ? '经由接口 ' + c.endpoints.join('、') : '没连到接口，可能是定时任务 / 消息消费 / 公共方法'}`
      : `接口：${c.method} ${c.path}（${c.summary || ''}）`,
    code,
    `结论：${c.action || ''}`,
    list('改了什么', [...(c.changes || []), ...(c.logic || [])]),
    list('平台给的测法', c.tests),
    list('安全项', c.security),
    focus ? `重点：\n${focus}\n` : '',
    list('可能出问题', c.risks),
    list('相关表', c.tables),
    list('相关缓存 key（代码里的常量 / 前缀）', c.cacheKeys),
    '----',
    '我的问题：'
  ]
    .filter(Boolean)
    .join('\n')
}

async function send(text: string, shown?: string) {
  const typed = (text || '').trim()
  const imgs = pending.value
  if ((!typed && !imgs.length) || loading.value || !props.card) return
  const s = session.value
  if (!s.id) return
  const q = typed || '看下这张截图：图里是什么情况，结合代码判断是不是 bug，下一步该做什么。'
  s.messages.push({ role: 'user', text: q, shown: shown || typed || '（截图）', images: imgs.map((i) => i.url) })
  draft.value = ''
  pending.value = []
  loading.value = true
  scrollBottom()
  try {
    await loadDirs()
    const message = s.primed ? q : `${context()}\n${q}`
    const res = await apiClient.cursorAskChat({
      message,
      sessionId: s.id,
      cwd: cwd.value || undefined,
      dirs: otherDirs.value.length ? otherDirs.value : undefined,
      images: imgs.length ? imgs.map(({ data, mimeType }) => ({ data, mimeType })) : undefined,
      mode: 'ask'
    })
    s.primed = true
    s.messages.push({ role: 'assistant', text: res.answer || res.error || '（没有返回内容）' })
  } catch (e: any) {
    s.messages.push({ role: 'assistant', text: '调用失败：' + (e?.message || '未知错误') })
  } finally {
    loading.value = false
    scrollBottom()
  }
}

/** 中文输入法选词时按的回车不算发送 */
function onEnter(e: Event) {
  const k = e as KeyboardEvent
  if (k.isComposing || k.keyCode === 229) return
  k.preventDefault()
  send(draft.value)
}

async function restart() {
  const s = session.value
  try {
    await apiClient.cursorAskReset(s.id, 'ask')
  } catch {
    /* 清不掉也无所谓，换个会话 id 就是新会话 */
  }
  sessions[sessionKey.value] = { id: newSessionId(), messages: [], primed: false }
}

async function checkStatus() {
  statusHint.value = ''
  try {
    const st = await apiClient.cursorAskStatus()
    if (st.enabled === false || st.configured === false) statusHint.value = st.hint || 'Cursor AI 还没配置好，去「AI助手」看提示'
  } catch (e: any) {
    statusHint.value = e?.message || 'Cursor AI 状态检查失败'
  }
}

async function scrollBottom() {
  await nextTick()
  if (boxEl.value) boxEl.value.scrollTop = boxEl.value.scrollHeight
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function parts(src: string) {
  const out: Array<{ type: 'code' | 'text'; text: string; lang?: string }> = []
  const re = /```([\w-]*)\n([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) })
    out.push({ type: 'code', text: m[2].replace(/\n$/, ''), lang: m[1] })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) })
  return out
}

const LANGS: Record<string, { label: string; cls: string }> = {
  sql: { label: 'SQL · 查库', cls: 'sql' },
  bash: { label: '命令行', cls: 'sh' },
  sh: { label: '命令行', cls: 'sh' },
  shell: { label: '命令行', cls: 'sh' },
  zsh: { label: '命令行', cls: 'sh' },
  json: { label: 'JSON', cls: 'json' },
  python: { label: 'Python', cls: 'py' },
  py: { label: 'Python', cls: 'py' },
  java: { label: 'Java', cls: 'java' },
  http: { label: 'HTTP 请求', cls: 'sh' }
}
function langOf(p: { text: string; lang?: string }) {
  const k = (p.lang || '').toLowerCase()
  if (LANGS[k]) return LANGS[k]
  if (/^\s*(curl|redis-cli|mysql|for |while )/m.test(p.text)) return LANGS.bash
  if (/^\s*(SELECT|UPDATE|INSERT|DELETE)\b/im.test(p.text)) return LANGS.sql
  return { label: k || '代码', cls: '' }
}

watch(
  () => [props.modelValue, sessionKey.value],
  ([open]) => {
    if (!open) return
    checkStatus()
    loadDirs()
    scrollBottom()
    const ask = props.initialAsk
    if (ask) send(ask.text, ask.shown)
  }
)
</script>

<style scoped>
.coach {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 13px;
}
.c-drop {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--el-color-primary);
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.08);
  color: var(--el-color-primary);
  font-size: 15px;
  pointer-events: none;
}
.b-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.b-img {
  width: 96px;
  height: 72px;
  border-radius: 4px;
  cursor: zoom-in;
  background: var(--el-bg-color);
}
.c-pend {
  display: flex;
  gap: 8px;
  padding: 0 0 8px;
}
.pend {
  position: relative;
  width: 64px;
  height: 48px;
}
.pend img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}
.pend .x {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  line-height: 15px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  background: var(--el-text-color-secondary);
  cursor: pointer;
}
.grow {
  flex: 1;
}
.c-top {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 16px 0 20px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.c-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
.c-name i {
  font-style: normal;
  margin-right: 6px;
  color: var(--el-color-primary);
}
.c-method {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.c-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.c-ro {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-light);
  cursor: default;
  white-space: nowrap;
}
.ro-tip {
  max-width: 420px;
  white-space: pre-line;
  line-height: 1.6;
}
.c-link {
  margin-left: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  white-space: nowrap;
}
.c-link:hover {
  color: var(--el-color-primary);
}
.c-close {
  width: 26px;
  height: 26px;
  line-height: 24px;
  text-align: center;
  font-size: 20px;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.c-close:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
.off {
  opacity: 0.5;
  cursor: not-allowed !important;
}
.c-warn {
  margin: 10px 20px 0;
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  font-size: 12px;
}
.c-msgs {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.c-empty {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 12px;
}
.e-icon {
  width: 44px;
  height: 44px;
  line-height: 44px;
  border-radius: 10px;
  font-size: 18px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.e-title {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 600;
}
.e-sub {
  max-width: 380px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.e-sub b {
  color: var(--el-text-color-primary);
  font-weight: 600;
}
.e-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  max-width: 420px;
  margin-top: 18px;
}
.e-q {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  font-size: 13px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.e-q:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
.e-q:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.e-q-icon {
  width: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.e-tip {
  margin-top: 16px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.msg.user {
  justify-content: flex-end;
}
.avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  line-height: 24px;
  margin-top: 2px;
  text-align: center;
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.bubble {
  max-width: 80%;
  padding: 7px 12px;
  border-radius: 10px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  color: #fff;
  background: var(--el-color-primary);
}
.bubble.ai {
  flex: 1;
  min-width: 0;
  max-width: none;
  padding: 10px 14px;
  white-space: normal;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.thinking {
  color: var(--el-text-color-secondary) !important;
}
.think-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.dots {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  vertical-align: middle;
}
.dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--el-color-primary);
  animation: blink 1.2s infinite ease-in-out;
}
.dots i:nth-child(2) {
  animation-delay: 0.2s;
}
.dots i:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.2;
  }
  40% {
    opacity: 1;
  }
}
.txt :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
}
.md {
  line-height: 1.75;
  color: var(--el-text-color-primary);
}
.md :deep(.md-p) {
  margin: 6px 0;
}
.md :deep(.md-h) {
  margin: 14px 0 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
.md :deep(.md-h:first-child) {
  margin-top: 4px;
}
.md :deep(.md-ul),
.md :deep(.md-ol) {
  margin: 4px 0 8px;
  padding-left: 20px;
}
.md :deep(.md-ul .md-ul),
.md :deep(.md-ol .md-ul) {
  margin: 2px 0;
}
.md :deep(li) {
  margin: 3px 0;
}
.md :deep(li::marker) {
  color: var(--el-color-primary);
}
.md :deep(.md-ol) {
  list-style: none;
  padding-left: 0;
  counter-reset: md-n;
}
.md :deep(.md-ol > li) {
  position: relative;
  padding-left: 26px;
  counter-increment: md-n;
}
.md :deep(.md-ol > li::before) {
  content: counter(md-n);
  position: absolute;
  left: 0;
  top: 3px;
  width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 50%;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
}
.md :deep(b) {
  font-weight: 600;
}
.md :deep(.md-quote) {
  margin: 10px 0 2px;
  padding: 8px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.md :deep(.md-quote .md-p) {
  margin: 2px 0;
}
.md :deep(.md-hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
}
.md :deep(.md-table-wrap) {
  margin: 6px 0;
  overflow-x: auto;
}
.md :deep(.md-table) {
  border-collapse: collapse;
  font-size: 12px;
}
.md :deep(.md-table th),
.md :deep(.md-table td) {
  padding: 4px 8px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
  vertical-align: top;
}
.md :deep(.md-table th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}
.code {
  margin: 8px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
}
.code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  padding: 0 4px 0 10px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.lang {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.lang.sql {
  color: var(--el-color-success-dark-2);
}
.lang.sh {
  color: var(--el-color-primary);
}
.lang.json,
.lang.py,
.lang.java {
  color: var(--el-color-warning-dark-2);
}
.code pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 360px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  background: var(--el-bg-color);
  white-space: pre;
}
.c-foot {
  flex-shrink: 0;
  padding: 10px 20px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.c-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 10px;
}
.q {
  font-size: 12px;
  padding: 3px 12px;
  border-radius: 14px;
  border: 1px solid var(--el-border-color-light);
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  cursor: pointer;
}
.q:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.c-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.c-input :deep(.el-textarea__inner) {
  padding: 8px 12px;
  border-radius: 8px;
  resize: none;
}
.send {
  height: 36px;
  padding: 0 18px;
  border-radius: 8px;
}
.c-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.c-pic {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.c-pic:hover {
  color: var(--el-color-primary);
}
kbd {
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 15px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>

<style>
.coach-drawer .el-drawer__body {
  padding: 0;
}
</style>
