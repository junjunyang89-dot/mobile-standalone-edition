<template>
  <el-dialog
    :model-value="modelValue"
    width="760px"
    class="aigen-dialog"
    :show-close="false"
    append-to-body
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="onOpen"
    @closed="stopPolling"
  >
    <template #header="{ close }">
      <div class="dlg-head">
        <div class="dlg-title">AI 生成用例 · {{ project.toUpperCase() }}</div>
        <button type="button" class="dlg-close" aria-label="关闭" @click="close">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div v-loading="loading" class="body">
      <template v-if="!job">
        <div class="form-grid">
          <label class="f-label">范围</label>
          <div class="seg">
            <button
              type="button"
              class="seg-item"
              :class="{ active: onlyUncovered }"
              @click="onlyUncovered = true"
            >未覆盖 {{ uncoveredCount }}</button>
            <button
              type="button"
              class="seg-item"
              :class="{ active: !onlyUncovered }"
              @click="onlyUncovered = false"
            >全部 {{ totalCount }}</button>
          </div>
          <template v-if="levelCounts">
            <label class="f-label">级别</label>
            <div class="lv-row">
              <button
                v-for="o in LEVELS"
                :key="o.value"
                type="button"
                class="chip"
                :class="{ active: levels.includes(o.value) }"
                @click="toggleLevel(o.value)"
              >{{ o.label }} <span class="chip-n">{{ levelNum(o.value) }}</span></button>
              <span class="lv-hint">不选＝不按级别筛</span>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div class="facts">
          <div class="fact">
            <span class="fact-num">{{ job.done }}<small>/{{ job.total }}</small></span>
            <span class="fact-label">{{ job.running ? '生成中' : job.message || '完成' }}</span>
          </div>
          <div class="fact">
            <span class="fact-num is-ok">{{ job.enabledCases }}</span>
            <span class="fact-label">条已启用</span>
          </div>
          <div class="fact">
            <span class="fact-num is-warn">{{ count('PENDING') }}</span>
            <span class="fact-label">个接口待补</span>
          </div>
          <div class="fact">
            <span class="fact-num is-bad">{{ count('FAILED') }}</span>
            <span class="fact-label">个失败</span>
          </div>
        </div>
        <div v-if="job.sourceRef" class="src-ref">源码：{{ job.sourceRef }}</div>
        <el-progress
          :percentage="job.total ? Math.round((job.done / job.total) * 100) : 0"
          :show-text="false"
          :stroke-width="4"
          class="bar"
        />
        <div class="filters">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            class="chip"
            :class="{ active: filter === f.value }"
            @click="filter = f.value"
          >{{ f.label }} <span class="chip-n">{{ f.value ? count(f.value) : job.items.length }}</span></button>
        </div>
        <div class="items">
          <div v-for="it in shownItems" :key="it.endpointId" class="item">
            <span class="method" :class="`is-${(it.method || 'get').toLowerCase()}`">{{ it.method }}</span>
            <div class="item-main">
              <div class="item-line">
                <span class="item-name">{{ it.summary || it.path }}</span>
                <span class="state" :class="`is-${it.status.toLowerCase()}`">{{ STATUS[it.status] || it.status }}</span>
                <span v-if="it.cases" class="item-count">{{ it.enabled }}/{{ it.cases }} 条启用</span>
              </div>
              <div v-if="it.note" class="item-note">{{ it.note }}</div>
            </div>
          </div>
          <div v-if="!shownItems.length" class="empty">没有</div>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="foot">
        <template v-if="!job">
          <span class="foot-space" />
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button
            v-perm:write
            type="primary"
            :loading="starting"
            :disabled="!scopeCount"
            @click="start"
          >开始生成 {{ scopeCount }} 个</el-button>
        </template>
        <template v-else>
          <el-button v-if="job.running" :loading="cancelling || job.cancelled" @click="cancel">
            {{ job.cancelled ? '停止中' : '停止' }}
          </el-button>
          <el-button v-else link type="primary" @click="job = null">再生成一批</el-button>
          <span class="foot-space" />
          <el-button type="primary" @click="emit('update:modelValue', false)">
            {{ job.running ? '后台继续' : '关闭' }}
          </el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { apiClient, type AiCaseJob, type ApiEndpointLevel } from '../api'

const props = defineProps<{
  modelValue: boolean
  project: string
  sourceDir?: string
  uncoveredCount: number
  totalCount: number
  /** 各级别的接口数；给了才显示级别筛选 */
  levelCounts?: Record<ApiEndpointLevel, { total: number; uncovered: number }>
}>()

const LEVELS: { value: ApiEndpointLevel; label: string }[] = [
  { value: 'CORE', label: '核心' },
  { value: 'IMPORTANT', label: '重要' },
  { value: 'NORMAL', label: '一般' },
  { value: 'UNUSED', label: '无人调用' }
]
// 无人调用的接口生成用例没意义；只有后台在调的先不管
const levels = ref<ApiEndpointLevel[]>(['CORE', 'IMPORTANT'])

function toggleLevel(v: ApiEndpointLevel) {
  levels.value = levels.value.includes(v) ? levels.value.filter((x) => x !== v) : [...levels.value, v]
}

function levelNum(v: ApiEndpointLevel) {
  const c = props.levelCounts?.[v]
  return c ? (onlyUncovered.value ? c.uncovered : c.total) : 0
}

const scopeCount = computed(() => {
  if (props.levelCounts && levels.value.length) return levels.value.reduce((s, v) => s + levelNum(v), 0)
  return onlyUncovered.value ? props.uncoveredCount : props.totalCount
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'changed'): void
}>()

const STATUS: Record<string, string> = {
  WAITING: '排队',
  RUNNING: '生成中',
  ENABLED: '已启用',
  PENDING: '待补',
  SKIPPED: '跳过',
  FAILED: '失败'
}
const FILTERS = [
  { value: '', label: '全部' },
  { value: 'ENABLED', label: '已启用' },
  { value: 'PENDING', label: '待补' },
  { value: 'FAILED', label: '失败' }
]

const loading = ref(false)
const starting = ref(false)
const cancelling = ref(false)
const onlyUncovered = ref(true)
const job = ref<AiCaseJob | null>(null)
const filter = ref('')
let timer: number | undefined
let lastDone = -1

const ORDER: Record<string, number> = { RUNNING: 0, FAILED: 1, PENDING: 2, ENABLED: 3, SKIPPED: 4, WAITING: 5 }
const shownItems = computed(() => {
  const items = job.value?.items || []
  const list = filter.value ? items.filter((i) => i.status === filter.value) : items
  return [...list].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
})

function count(status: string) {
  return (job.value?.items || []).filter((i) => i.status === status).length
}

async function onOpen() {
  filter.value = ''
  loading.value = true
  try {
    const j = await apiClient.latestAiCaseJob(props.project)
    job.value = j?.id && j.running ? (j as AiCaseJob) : null
    if (job.value) poll()
  } catch {
    job.value = null
  } finally {
    loading.value = false
  }
}

async function start() {
  starting.value = true
  try {
    job.value = await apiClient.startAiCases({
      project: props.project,
      onlyUncovered: onlyUncovered.value,
      dir: props.sourceDir || undefined,
      levels: props.levelCounts && levels.value.length ? levels.value : undefined
    })
    lastDone = 0
    poll()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    starting.value = false
  }
}

function poll() {
  stopPolling()
  timer = window.setInterval(async () => {
    if (!job.value) return stopPolling()
    try {
      const j = await apiClient.getAiCaseJob(job.value.id)
      job.value = j
      if (j.done !== lastDone && (j.done % 10 === 0 || !j.running)) emit('changed')
      lastDone = j.done
      if (!j.running) stopPolling()
    } catch {
      stopPolling()
    }
  }, 2000)
}

function stopPolling() {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

async function cancel() {
  if (!job.value) return
  cancelling.value = true
  try {
    await apiClient.cancelAiCaseJob(job.value.id)
    job.value.cancelled = true
  } catch (e: any) {
    ElMessage.error(e?.message || '停止失败')
  } finally {
    cancelling.value = false
  }
}

onBeforeUnmount(stopPolling)
</script>

<style scoped>
.dlg-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dlg-title {
  flex: 1;
  font-size: 17px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.dlg-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}
.dlg-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 14px;
}
.f-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: right;
}
.seg {
  display: inline-flex;
  justify-self: start;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.seg-item {
  height: 26px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.seg-item.active {
  background: #fff;
  color: var(--el-text-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.lv-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.lv-hint {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.src-ref {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.facts {
  display: flex;
  gap: 10px;
}
.fact {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.fact-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.fact-num small {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}
.fact-num.is-ok {
  color: var(--el-color-success-dark-2);
}
.fact-num.is-warn {
  color: var(--el-color-warning-dark-2);
}
.fact-num.is-bad {
  color: var(--el-color-danger-dark-2);
}
.fact-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.bar {
  margin: 12px 0 14px;
}
.filters {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.chip {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 13px;
  background: #fff;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.chip.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.chip-n {
  margin-left: 2px;
  color: var(--el-text-color-secondary);
}
.items {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.item:last-child {
  border-bottom: none;
}
.item-main {
  flex: 1;
  min-width: 0;
}
.item-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.item-count {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.item-note {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.state {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.state.is-enabled {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.state.is-pending {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.state.is-failed {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger-dark-2);
}
.state.is-running {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.method {
  flex-shrink: 0;
  display: inline-block;
  min-width: 40px;
  padding: 0 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  color: var(--app-text-regular);
  background: var(--el-fill-color-light);
}
.method.is-get {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.method.is-post {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.foot-space {
  flex: 1;
}
</style>

<style>
.aigen-dialog.el-dialog {
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
}
.aigen-dialog .el-dialog__header {
  padding: 20px 20px 16px 24px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.aigen-dialog .el-dialog__body {
  padding: 18px 24px 14px;
}
.aigen-dialog .el-dialog__footer {
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
</style>
