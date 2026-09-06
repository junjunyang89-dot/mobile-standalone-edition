<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="760px"
    top="6vh"
    append-to-body
    destroy-on-close
    :z-index="6100"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div class="frw">
      <!-- 结论一行说完：跑成什么样、跑了多久、下一步去哪 -->
      <div class="frw-head" :class="'is-' + tone">
        <el-tag :type="tagType" size="large" effect="dark">{{ statusLabel }}</el-tag>
        <span class="frw-head-text">{{ headline }}</span>
        <span class="frw-spacer" />
        <span v-if="elapsedText" class="frw-elapsed">{{ elapsedText }}</span>
        <el-button v-if="taskId" size="small" @click="openFullReport">打开完整报告</el-button>
      </div>

      <!-- 失败：直接把「卡在哪一步、为什么、当时屏幕长什么样」摆出来。
           这三样凑齐了才叫「知道问题在哪」，少一样都得再点几下去找 -->
      <div v-if="failedStep" class="frw-fail">
        <div class="frw-fail-main">
          <div class="frw-fail-title">
            卡在第 {{ failedIndex + 1 }} 步 · {{ failedStep.step || '未命名步骤' }}
          </div>
          <div class="frw-fail-msg">{{ failedStep.message || '没有更多信息' }}</div>
          <div v-if="failedStep.selector" class="frw-fail-selector">
            定位：<code>{{ failedStep.selector }}</code>
          </div>
        </div>
        <div v-if="failedShot" class="frw-fail-shot">
          <img :src="failedShot" alt="失败时的屏幕" @error="failedShotBroken = true" />
          <div class="frw-shot-cap">失败当时的屏幕</div>
        </div>
        <div v-else class="frw-fail-noshot">这一步没留下截图</div>
      </div>

      <div v-else-if="running" class="frw-running">
        <el-progress :percentage="100" :indeterminate="true" :duration="3" :show-text="false" />
        <span>{{ runningLabel }}</span>
      </div>

      <!-- 步骤流水：跑的时候是进度，跑完是回放 -->
      <div class="frw-steps">
        <div class="frw-steps-head">
          <span>执行步骤（{{ steps.length }}）</span>
          <el-checkbox v-model="onlyProblem" size="small">只看出问题的</el-checkbox>
        </div>
        <el-empty v-if="!shownSteps.length" :image-size="52"
                  :description="running ? '还没有步骤记录' : '这次执行没有步骤记录'" />
        <div v-else class="frw-step-list">
          <div
            v-for="(s, i) in shownSteps"
            :key="i"
            class="frw-step"
            :class="{ 'is-fail': isBad(s) }"
          >
            <span class="frw-step-dot" />
            <div class="frw-step-body">
              <div class="frw-step-title">{{ s.step || '—' }}</div>
              <div v-if="s.message" class="frw-step-msg">{{ s.message }}</div>
            </div>
            <el-button
              v-if="s.screenshotUrl"
              link
              type="primary"
              size="small"
              @click="preview(s)"
            >
              截图
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="previewVisible"
      width="440px"
      append-to-body
      :z-index="6200"
      title="步骤截图"
      @closed="revokePreview"
    >
      <img v-if="previewSrc" :src="previewSrc" class="frw-preview-img" alt="步骤截图" />
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '../api'

/**
 * 试跑结果就地回显。
 *
 * 起因很朴素：在编辑器里点「试跑」，界面只弹一句「已开始执行」就没了下文。
 * 任务是建了、也跑了，但它走的是 DEBUG 轨——被刻意排除在「最近结果」和通过率之外，
 * 于是列表上也看不见。人跑完只能对着一个什么都没变的界面发呆。
 *
 * 「不算进质量数据」和「我看不见它」是两回事，前一个是对的，后一个是顺手砍掉的。
 * 这个弹窗把后一个补回来，而且不让人去别的页面找：跑成什么样、卡在哪一步、
 * 那一刻屏幕长什么样，三样一起给。
 */

const props = defineProps<{
  visible: boolean
  taskId: string
  flowName?: string
  /** 这次是不是试跑（DEBUG 轨）；只影响标题措辞，正式执行同样需要就地看到结果 */
  debugRun?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
}>()

const router = useRouter()

type Step = {
  step?: string
  status?: string
  level?: string
  message?: string
  selector?: string | null
  screenshotUrl?: string | null
}

const task = ref<any>(null)
const steps = ref<Step[]>([])
const onlyProblem = ref(false)
const startedAt = ref(0)
const now = ref(0)
const failedShotBroken = ref(false)
const previewVisible = ref(false)
const previewSrc = ref('')

/** setTimeout 链而不是 setInterval：后端慢的时候 interval 会把请求堆起来，越堆越慢 */
let timer: number | undefined
let stopped = false

const TERMINAL = ['COMPLETED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUCCESS']
const POLL_MS = 2000
/** 兜底：跑太久就停止轮询，别让一个忘了关的弹窗一直打后端 */
const MAX_WATCH_MS = 30 * 60 * 1000

const status = computed(() => String(task.value?.status || '').toUpperCase())
const running = computed(() => !status.value || !TERMINAL.includes(status.value))

const statusLabel = computed(() => {
  const s = status.value
  if (s === 'COMPLETED' || s === 'SUCCESS') return '通过'
  if (s === 'FAILED') return '失败'
  if (s === 'STOPPED') return '已停止'
  if (s === 'SKIPPED') return '本次不适用'
  if (s === 'RUNNING') return '执行中'
  if (s === 'PENDING') return '排队中'
  return '查询中'
})

const tone = computed(() => {
  const s = status.value
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'ok'
  if (s === 'FAILED') return 'bad'
  return 'busy'
})

const tagType = computed<'success' | 'danger' | 'warning' | 'info'>(() => {
  if (tone.value === 'ok') return 'success'
  if (tone.value === 'bad') return 'danger'
  return 'warning'
})

const dialogTitle = computed(() => {
  const kind = props.debugRun ? '试跑结果' : '执行结果'
  return props.flowName ? `${kind} · ${props.flowName}` : kind
})

const lastStepTitle = computed(() => {
  const last = steps.value[steps.value.length - 1]
  return String(last?.step || '').trim()
})

const runningLabel = computed(() => {
  if (!steps.value.length) {
    return '正在准备执行…（步骤出来后会自己往下刷）'
  }
  const name = lastStepTitle.value
  return name
    ? `正在执行：${name}（已记录 ${steps.value.length} 条）`
    : `正在执行，已记录 ${steps.value.length} 条`
})

const headline = computed(() => {
  if (running.value) return lastStepTitle.value ? `正在跑：${lastStepTitle.value}` : '还在跑，步骤出来后会自动刷新'
  const s = status.value
  if (s === 'COMPLETED' || s === 'SUCCESS') return '这一遍全部步骤都过了'
  if (s === 'FAILED') return failedStep.value ? '看下面卡在哪一步' : '执行失败，但没记录到具体步骤'
  if (s === 'SKIPPED') return '流程自己判定这次不适用，提前结束了'
  if (s === 'STOPPED') return '被停掉了'
  return ''
})

function isBad(s: Step) {
  return String(s?.status || '').toLowerCase() === 'fail'
    || String(s?.level || '').toLowerCase() === 'error'
}

const failedIndex = computed(() => steps.value.findIndex(isBad))
const failedStep = computed(() => (failedIndex.value >= 0 ? steps.value[failedIndex.value] : null))

const failedShot = ref('')

watch(
  () => failedStep.value?.screenshotUrl,
  async (url) => {
    if (failedShot.value.startsWith('blob:')) {
      URL.revokeObjectURL(failedShot.value)
    }
    failedShot.value = ''
    if (failedShotBroken.value || !url) return
    try {
      failedShot.value = await apiClient.fetchTaskStepScreenshotObjectUrl(url)
    } catch {
      failedShot.value = shotSrc(url)
    }
  }
)

const shownSteps = computed(() =>
  onlyProblem.value ? steps.value.filter(isBad) : steps.value
)

const elapsedText = computed(() => {
  if (!startedAt.value) return ''
  const ms = Math.max(0, (now.value || Date.now()) - startedAt.value)
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `已用 ${sec} 秒`
  return `已用 ${Math.floor(sec / 60)} 分 ${sec % 60} 秒`
})

/** 步骤截图是后端相对路径，拼上 baseUrl 即可直接给 img（与任务详情页一致） */
function shotSrc(url?: string | null) {
  const path = String(url || '').trim()
  if (!path) return ''
  if (path.startsWith('http')) return path
  const base = apiClient.getBaseUrl()
  return base + (path.startsWith('/') ? path : '/' + path)
}

function revokePreview() {
  if (previewSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewSrc.value)
  }
  previewSrc.value = ''
}

async function preview(s: Step) {
  const raw = String(s.screenshotUrl || '').trim()
  if (!raw) return
  try {
    revokePreview()
    previewSrc.value = await apiClient.fetchTaskStepScreenshotObjectUrl(raw)
    previewVisible.value = !!previewSrc.value
  } catch (e: any) {
    previewSrc.value = shotSrc(raw)
    previewVisible.value = !!previewSrc.value
  }
}

function openFullReport() {
  emit('update:visible', false)
  void router.push({ name: 'TaskOverview', params: { id: props.taskId } })
}

async function tick() {
  if (stopped || !props.taskId) return
  now.value = Date.now()
  try {
    task.value = await apiClient.getTask(props.taskId)
  } catch {
    /* 单次查失败不该把弹窗打回原形——下一轮再试 */
  }
  try {
    const log = await apiClient.getFunctionalTestTaskExecutionLog(props.taskId)
    if (Array.isArray(log)) steps.value = log as Step[]
  } catch {
    /* 同上：执行刚开始时这个接口可能还没有数据 */
  }
  if (stopped) return
  if (!running.value) return
  if (startedAt.value && Date.now() - startedAt.value > MAX_WATCH_MS) return
  timer = window.setTimeout(tick, POLL_MS)
}

function start() {
  stop()
  stopped = false
  task.value = null
  steps.value = []
  failedShotBroken.value = false
  if (failedShot.value.startsWith('blob:')) {
    URL.revokeObjectURL(failedShot.value)
  }
  failedShot.value = ''
  onlyProblem.value = false
  startedAt.value = Date.now()
  now.value = Date.now()
  void tick()
}

function stop() {
  stopped = true
  if (timer) {
    window.clearTimeout(timer)
    timer = undefined
  }
  revokePreview()
  if (failedShot.value.startsWith('blob:')) {
    URL.revokeObjectURL(failedShot.value)
    failedShot.value = ''
  }
}

watch(
  () => [props.visible, props.taskId] as const,
  ([vis, id]) => {
    if (vis && id) start()
    else stop()
  },
  { immediate: true }
)

onBeforeUnmount(stop)
</script>

<style scoped>
.frw {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.frw-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}
.frw-head.is-ok {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}
.frw-head.is-bad {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
}
.frw-head.is-busy {
  background: var(--el-fill-color-light);
}
.frw-head-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.frw-spacer {
  flex: 1;
}
.frw-elapsed {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.frw-fail {
  display: flex;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 8px;
}
.frw-fail-main {
  flex: 1;
  min-width: 0;
}
.frw-fail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-danger);
  margin-bottom: 6px;
}
.frw-fail-msg {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}
.frw-fail-selector {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.frw-fail-shot {
  flex: none;
  width: 180px;
  text-align: center;
}
.frw-fail-shot img {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  display: block;
}
.frw-shot-cap {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.frw-fail-noshot {
  flex: none;
  width: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}
.frw-running {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.frw-running :deep(.el-progress) {
  width: 160px;
  flex: none;
}
.frw-steps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.frw-step-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.frw-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.frw-step:last-child {
  border-bottom: none;
}
.frw-step-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--el-color-success);
}
.frw-step.is-fail .frw-step-dot {
  background: var(--el-color-danger);
}
.frw-step.is-fail .frw-step-title {
  color: var(--el-color-danger);
  font-weight: 600;
}
.frw-step-body {
  flex: 1;
  min-width: 0;
}
.frw-step-title {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.frw-step-msg {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  word-break: break-word;
}
.frw-preview-img {
  width: 100%;
  display: block;
  border-radius: 6px;
}
</style>
