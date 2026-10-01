<template>
  <div v-if="chips.length" class="rtb">
    <span class="rtb-label">{{ activeCount ? `进行中 ${activeCount}` : '刚结束' }}</span>
    <div class="rtb-list">
      <button
        v-for="t in chips"
        :key="t.id"
        type="button"
        class="rtb-chip"
        :class="'is-' + t.tone"
        @click="open(t)"
      >
        <i class="rtb-dot" />
        <span class="rtb-name" :title="t.name">{{ t.name }}</span>
        <span class="rtb-state">{{ t.stateLabel }}</span>
      </button>
    </div>
  </div>
  <FlowRunWatch
    v-model:visible="watchVisible"
    :task-id="watchTaskId"
    :flow-name="watchName"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { apiClient } from '../api'
import FlowRunWatch from './FlowRunWatch.vue'

type Chip = {
  id: string
  name: string
  status: string
  stateLabel: string
  tone: 'run' | 'wait' | 'ok' | 'bad'
  deviceId?: string
}

const ACTIVE = new Set(['RUNNING', 'PENDING'])
const KEEP_MS = 20_000

const active = ref<Chip[]>([])
const finished = ref<Array<Chip & { until: number }>>([])
const watchVisible = ref(false)
const watchTaskId = ref('')
const watchName = ref('')

let timer = 0
let known = new Set<string>()

const chips = computed(() => {
  const now = Date.now()
  const tail = finished.value.filter((t) => t.until > now)
  const seen = new Set(active.value.map((t) => t.id))
  return [...active.value, ...tail.filter((t) => !seen.has(t.id))]
})

const activeCount = computed(() => active.value.length)

function taskIdOf(row: any) {
  return String(row?.id || row?.taskId || '').trim()
}

function taskNameOf(row: any) {
  const name = String(row?.name || row?.taskName || '').trim()
  return name || taskIdOf(row) || '未命名任务'
}

function createdMs(row: any) {
  const raw = row?.createdAt || row?.updatedAt
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

function isRecentPending(row: any) {
  const ms = createdMs(row)
  if (!ms) return true
  return Date.now() - ms < 2 * 60 * 60 * 1000
}

function toChip(row: any, finishedStatus?: string): Chip {
  const status = String(finishedStatus || row?.status || '').toUpperCase()
  const queued = status === 'PENDING' && !String(row?.deviceId || '').trim()
  let stateLabel = '执行中'
  let tone: Chip['tone'] = 'run'
  if (status === 'PENDING') {
    stateLabel = queued ? '排队' : '待执行'
    tone = 'wait'
  } else if (status === 'COMPLETED') {
    stateLabel = '已完成'
    tone = 'ok'
  } else if (status === 'FAILED') {
    stateLabel = '失败'
    tone = 'bad'
  } else if (status === 'STOPPED' || status === 'SKIPPED') {
    stateLabel = status === 'SKIPPED' ? '跳过' : '已停止'
    tone = 'bad'
  }
  return {
    id: taskIdOf(row),
    name: taskNameOf(row),
    status,
    stateLabel,
    tone,
    deviceId: row?.deviceId
  }
}

function rememberFinished(row: any) {
  const chip = toChip(row)
  if (!chip.id || ACTIVE.has(chip.status)) return
  finished.value = [
    { ...chip, until: Date.now() + KEEP_MS },
    ...finished.value.filter((t) => t.id !== chip.id)
  ].slice(0, 6)
}

async function poll() {
  try {
    const [running, pending] = await Promise.all([
      apiClient.getTasks({ status: 'RUNNING' }, { page: 1, size: 20 }),
      apiClient.getTasks({ status: 'PENDING' }, { page: 1, size: 20 })
    ])
    const rows = [...(running?.content || []), ...(pending?.content || [])].filter((row) => {
      const status = String(row?.status || '').toUpperCase()
      if (status === 'RUNNING') return true
      if (status === 'PENDING') return isRecentPending(row)
      return false
    })
    const ids = new Set(rows.map(taskIdOf).filter(Boolean))
    const gone = [...known].filter((id) => !ids.has(id))
    known = ids
    active.value = rows.map((row) => toChip(row)).filter((t) => t.id)
    await Promise.all(
      gone.map(async (id) => {
        try {
          rememberFinished(await apiClient.getTask(id))
        } catch {
          /* 列表里消失即可，不必打断页面 */
        }
      })
    )
    finished.value = finished.value.filter((t) => t.until > Date.now())
  } catch {
    /* 后端暂时连不上时保持上一次的条，不反复弹错 */
  }
}

function open(t: Chip) {
  watchTaskId.value = t.id
  watchName.value = t.name
  watchVisible.value = true
}

onMounted(() => {
  void poll()
  timer = window.setInterval(() => void poll(), 4000)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<style scoped>
.rtb {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 16px;
  background: var(--app-card-bg, #fff);
  border-top: 1px solid var(--app-border, var(--el-border-color));
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
.rtb-label {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-secondary, var(--el-text-color-secondary));
}
.rtb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.rtb-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 280px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border, var(--el-border-color));
  border-radius: 999px;
  background: var(--app-main-bg, var(--el-fill-color-lighter));
  color: var(--app-text, var(--el-text-color-primary));
  font-size: 12px;
  cursor: pointer;
}
.rtb-chip:hover {
  border-color: var(--el-color-primary);
}
.rtb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex: none;
}
.rtb-chip.is-wait .rtb-dot {
  background: var(--el-color-warning-dark-2);
}
.rtb-chip.is-ok .rtb-dot {
  background: var(--el-color-success-dark-2);
}
.rtb-chip.is-bad .rtb-dot {
  background: var(--el-color-danger-dark-2);
}
.rtb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rtb-state {
  flex: none;
  color: var(--app-text-secondary, var(--el-text-color-secondary));
}
</style>
