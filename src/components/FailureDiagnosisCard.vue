<template>
  <div v-if="diagnosis || loading" class="overview-block fd-block">
    <div class="overview-block-title fd-title">
      失败归因
      <el-tag v-if="diagnosis" :type="tagType" size="small" effect="dark">{{ categoryLabel }}</el-tag>
      <span v-if="diagnosis?.confidence != null" class="fd-confidence">
        把握 {{ diagnosis.confidence }}%
      </span>
      <el-tag v-if="isHuman" size="small" type="info" effect="plain">人工判定</el-tag>
      <el-tag v-else-if="reused" size="small" type="info" effect="plain">复用近期结论</el-tag>
      <!-- 同一个问题挂了 30 次和挂了 1 次，值不值得先修完全不同 -->
      <el-tag v-if="occurrence > 1" size="small" type="warning" effect="plain">
        同类问题已发生 {{ occurrence }} 次
      </el-tag>
      <el-tag v-if="diagnosis?.reviewedAt" size="small" type="success" effect="plain">已复核</el-tag>
    </div>

    <div v-loading="loading" class="fd-body">
      <template v-if="diagnosis">
        <div class="fd-row">
          <span class="fd-k">建议动作</span>
          <span class="fd-v fd-action">{{ categoryAction }}</span>
        </div>
        <div v-if="diagnosis.failedStep" class="fd-row">
          <span class="fd-k">失败步骤</span>
          <span class="fd-v">
            {{ diagnosis.failedStep }}
            <code v-if="diagnosis.elementKey" class="fd-code">{{ diagnosis.elementKey }}</code>
          </span>
        </div>
        <div v-if="diagnosis.reason" class="fd-row">
          <span class="fd-k">依据</span>
          <span class="fd-v">{{ diagnosis.reason }}</span>
        </div>
        <div v-if="diagnosis.suggestion" class="fd-row">
          <span class="fd-k">怎么改</span>
          <span class="fd-v">{{ diagnosis.suggestion }}</span>
        </div>

        <!-- 候选定位：只有元素定位失效才有意义 -->
        <div v-if="diagnosis.suggestedLocatorValue" class="fd-locator">
          <div class="fd-locator-title">候选定位</div>
          <div class="fd-row">
            <span class="fd-k">建议改为</span>
            <code class="fd-code fd-code-new">
              {{ diagnosis.suggestedLocatorType ? diagnosis.suggestedLocatorType + ' = ' : '' }}{{ diagnosis.suggestedLocatorValue }}
            </code>
          </div>
          <div class="fd-locator-actions">
            <el-button
              v-if="!diagnosis.appliedAt"
              type="primary"
              size="small"
              :loading="applying"
              @click="onApply"
            >
              采纳并写回元素
            </el-button>
            <el-tag v-else type="success" size="small">已于 {{ shortTime(diagnosis.appliedAt) }} 采纳</el-tag>
            <span class="fd-hint">
              采纳后原定位会降级为备用定位，仍会被尝试，判错了也能退回来
            </span>
          </div>
        </div>

        <!-- 人工复核：认可 or 改判。没有这一步，「改判率」分不清判对了和没人看 -->
        <div class="fd-review">
          <el-button
            v-if="!diagnosis.reviewedAt && !isHuman"
            size="small"
            :loading="reviewing"
            @click="onReview"
          >
            结论正确
          </el-button>
          <el-button size="small" text type="primary" @click="correcting = !correcting">
            {{ correcting ? '取消改判' : '判得不对，我来改' }}
          </el-button>
          <el-button size="small" text @click="showHistory = !showHistory">
            {{ showHistory ? '收起记录' : '历史记录' }}
          </el-button>
        </div>

        <div v-if="correcting" class="fd-correct">
          <el-select v-model="humanCategory" placeholder="选择正确的分类" size="small" style="width: 220px">
            <el-option
              v-for="c in categories"
              :key="c.value"
              :label="`${c.label} → ${c.action}`"
              :value="c.value"
            />
          </el-select>
          <el-input
            v-model="humanReason"
            size="small"
            type="textarea"
            :rows="2"
            placeholder="为什么这么判？写清楚，这是后面调优归因的依据"
            style="margin-top: 8px"
          />
          <div style="margin-top: 8px">
            <el-button type="primary" size="small" :loading="saving" @click="onCorrect">
              保存人工判定
            </el-button>
          </div>
        </div>

        <div v-if="showHistory" class="fd-history">
          <div v-for="h in history" :key="h.id" class="fd-history-row">
            <el-tag size="small" :type="h.source === 'HUMAN' ? 'info' : tagTypeOf(h.category)" effect="plain">
              {{ h.source === 'HUMAN' ? '人工' : 'AI' }}
            </el-tag>
            <span class="fd-history-cat">{{ labelOf(h.category) }}</span>
            <span class="fd-history-time">{{ shortTime(h.createdAt) }}</span>
            <span class="fd-history-reason">{{ h.reason }}</span>
          </div>
          <div v-if="!history.length" class="fd-hint">暂无记录</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

/**
 * 任务失败归因：结论展示 + 候选定位采纳 + 人工复核/改判。
 *
 * 三块缺一不可——只展示结论的话，人还是要自己去改元素、去判断对不对，
 * 等于把「排查失败」换成了「阅读报告」，省不下多少事。
 */

type Diagnosis = {
  id: string
  category: string
  confidence: number | null
  reason: string | null
  suggestion: string | null
  failedStep: string | null
  elementKey: string | null
  suggestedLocatorType: string | null
  suggestedLocatorValue: string | null
  appliedAt: string | null
  reviewedAt: string | null
  source: string
  model: string | null
  createdAt: string
  occurrenceCount?: number | null
}

const props = defineProps<{
  taskId: string
  /** 概览接口已经带回来了，避免多打一次请求 */
  initial?: Diagnosis | null
}>()

const diagnosis = ref<Diagnosis | null>(props.initial ?? null)
const history = ref<Diagnosis[]>([])
const categories = ref<Array<{ value: string; label: string; action: string }>>([])
const loading = ref(false)
const applying = ref(false)
const reviewing = ref(false)
const saving = ref(false)
const correcting = ref(false)
const showHistory = ref(false)
const humanCategory = ref('')
const humanReason = ref('')

const isHuman = computed(() => diagnosis.value?.source === 'HUMAN')
/** 复用的结论 model 带「(复用)」后缀：统计真实模型调用次数时不能把这些算进去 */
const reused = computed(() => (diagnosis.value?.model || '').includes('复用'))
const occurrence = computed(() => diagnosis.value?.occurrenceCount ?? 0)

const CATEGORY_STYLE: Record<string, string> = {
  ELEMENT_BROKEN: 'warning',
  FLOW_OUTDATED: 'warning',
  FUNCTION_BROKEN: 'danger',
  ENVIRONMENT: 'info',
  FLAKY: 'info',
  UNKNOWN: 'info'
}

function tagTypeOf(c?: string | null) {
  return CATEGORY_STYLE[c || ''] || 'info'
}
function labelOf(c?: string | null) {
  return categories.value.find((x) => x.value === c)?.label || c || '—'
}

const tagType = computed(() => tagTypeOf(diagnosis.value?.category))
const categoryLabel = computed(() => labelOf(diagnosis.value?.category))
const categoryAction = computed(
  () => categories.value.find((x) => x.value === diagnosis.value?.category)?.action || '人工排查'
)

function shortTime(t?: string | null) {
  if (!t) return ''
  return String(t).replace('T', ' ').slice(0, 16)
}

async function loadAll() {
  if (!props.taskId) return
  loading.value = true
  try {
    const [d, h, c] = await Promise.all([
      apiClient.getFailureDiagnosis(props.taskId),
      apiClient.getFailureDiagnosisHistory(props.taskId).catch(() => []),
      categories.value.length
        ? Promise.resolve(categories.value)
        : apiClient.getFailureDiagnosisCategories().catch(() => [])
    ])
    diagnosis.value = (d as Diagnosis) || null
    history.value = (h as Diagnosis[]) || []
    categories.value = (c as any[]) || []
  } catch (e: any) {
    // 归因是附加信息，取不到不该在概览页上弹一堆错
    console.warn('[归因] 加载失败', e?.message)
  } finally {
    loading.value = false
  }
}

async function onApply() {
  if (!diagnosis.value) return
  applying.value = true
  try {
    await apiClient.applyDiagnosisLocator(diagnosis.value.id)
    ElMessage.success('已写回元素行，原定位已降级为备用')
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '采纳失败')
  } finally {
    applying.value = false
  }
}

async function onReview() {
  if (!diagnosis.value) return
  reviewing.value = true
  try {
    await apiClient.reviewDiagnosis(diagnosis.value.id)
    ElMessage.success('已标记为复核通过')
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    reviewing.value = false
  }
}

async function onCorrect() {
  if (!humanCategory.value) {
    ElMessage.warning('请先选择分类')
    return
  }
  saving.value = true
  try {
    // 人工判定另存一条，不覆盖 AI 那条——两者的分歧正是调优归因最有价值的样本
    await apiClient.saveFailureDiagnosis(props.taskId, {
      category: humanCategory.value,
      reason: humanReason.value || null,
      source: 'HUMAN',
      confidence: 100
    })
    ElMessage.success('已保存人工判定')
    correcting.value = false
    humanCategory.value = ''
    humanReason.value = ''
    await loadAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
watch(() => props.taskId, loadAll)
</script>

<style scoped>
.fd-block {
  border-left: 3px solid var(--el-color-warning);
}
.fd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fd-confidence {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.fd-body {
  min-height: 40px;
}
.fd-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.7;
}
.fd-k {
  flex: 0 0 72px;
  color: var(--el-text-color-secondary);
}
.fd-v {
  flex: 1;
  color: var(--el-text-color-primary);
  word-break: break-word;
}
.fd-action {
  font-weight: 600;
}
.fd-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 3px;
  word-break: break-all;
}
.fd-code-new {
  color: var(--el-color-success);
}
.fd-locator {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}
.fd-locator-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.fd-locator-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.fd-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.fd-review {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.fd-correct {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}
.fd-history {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 8px;
}
.fd-history-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  padding: 4px 0;
}
.fd-history-cat {
  font-weight: 600;
  flex: 0 0 auto;
}
.fd-history-time {
  color: var(--el-text-color-secondary);
  flex: 0 0 auto;
}
.fd-history-reason {
  color: var(--el-text-color-regular);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
