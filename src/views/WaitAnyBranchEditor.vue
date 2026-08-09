<template>
  <div class="wait-any-branches">
    <el-alert
      type="success"
      :closable="false"
      show-icon
      class="wa-intro"
      title="谁先出现走谁——不用为没出现的那条路径干等超时"
    >
      <template #default>
        用于「首次启动弹温馨提示、二次启动直接进首页」这类多入口场景。
        比「等某个元素 3 秒，没等到就当作另一种情况」可靠：设备慢的时候弹窗晚几秒出来也不会误判分支。
      </template>
    </el-alert>

    <el-form label-width="110px" class="step-form wa-head-form">
      <el-form-item label="整体超时">
        <el-input-number v-model="step.params.timeoutSec" :min="1" :max="300" />
        <span class="branch-tip inline">秒。命中任意候选即刻继续，不会等满</span>
      </el-form-item>
      <el-form-item label="轮询间隔">
        <el-input-number v-model="step.params.pollIntervalMs" :min="100" :max="5000" :step="100" />
        <span class="branch-tip inline">毫秒</span>
      </el-form-item>
    </el-form>

    <div
      v-for="(cand, ci) in candidates"
      :key="cand._key || 'c-' + ci"
      class="branch-box candidate"
    >
      <div class="branch-title">
        <span class="cand-rank">候选 {{ ci + 1 }}</span>
        <span class="cand-name">{{ cand.label || cand.elementKey || '未命名' }}</span>
        <span class="step-spacer" />
        <el-button link size="small" :disabled="ci === 0" @click="moveCandidate(ci, -1)">上移</el-button>
        <el-button
          link
          size="small"
          :disabled="ci === candidates.length - 1"
          @click="moveCandidate(ci, 1)"
        >下移</el-button>
        <el-button type="danger" link size="small" @click="removeCandidate(ci)">删除候选</el-button>
      </div>
      <p class="branch-tip">
        同一轮里多个候选都在屏上时，<b>排在前面的胜出</b>；用上移/下移调整优先级。
      </p>

      <el-form label-width="110px" class="step-form">
        <el-form-item label="判定元素" required>
          <el-select
            v-model="cand.elementKey"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="按中文名搜索选择元素"
            style="width: 100%"
          >
            <el-option
              v-for="el in elementOptions"
              :key="el.nameEn"
              :label="elementOptionLabel(el)"
              :value="el.nameEn" />
          </el-select>
          <div class="element-pick-actions">
            <el-button link type="primary" @click="emit('refresh-elements')">刷新列表</el-button>
          </div>
        </el-form-item>
        <el-form-item label="分支名">
          <el-input v-model="cand.label" maxlength="40" placeholder="如：首次启动·温馨提示 / 二次启动·首页" />
          <div class="branch-tip">只用于执行日志和流程图展示，方便看出这次走的是哪条路</div>
        </el-form-item>
      </el-form>

      <div class="branch-toolbar">
        <el-select v-model="candAddCode" filterable style="width: 220px">
          <el-option
            v-for="k in keywordOptions"
            :key="k.code"
            :label="`${k.nameZh} (${k.code})`"
            :value="k.code" />
        </el-select>
        <el-button size="small" type="primary" @click="addStep(ci)">添加命中后步骤</el-button>
      </div>

      <div v-if="!(cand.steps || []).length" class="branch-empty">命中后暂无步骤</div>
      <div
        v-for="(bs, bi) in cand.steps || []"
        :key="bs._key || `c${ci}-s${bi}`"
        class="branch-step"
      >
        <div class="branch-step-head">
          <span class="branch-idx">{{ childNo(ci, bi) }}</span>
          <el-tag size="small" type="primary">{{ keywordName(bs.keywordCode) }}</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ bs.keywordCode }}</el-tag>
          <span v-if="bs.description" class="step-desc-inline" :title="bs.description">{{ bs.description }}</span>
          <span class="step-spacer" />
          <el-button link size="small" :disabled="bi === 0" @click="moveStep(ci, bi, -1)">上移</el-button>
          <el-button
            link
            size="small"
            :disabled="bi === (cand.steps || []).length - 1"
            @click="moveStep(ci, bi, 1)"
          >下移</el-button>
          <el-button type="danger" link size="small" @click="removeStep(ci, bi)">删除</el-button>
        </div>
        <BranchStepFields
          :step="bs"
          :path-prefix="childNo(ci, bi)"
          :element-options="elementOptions"
          :needs-element="needsElement(bs.keywordCode)"
          :keyword-options="keywordOptions"
          :create-step="createStep"
          :keyword-name="keywordName"
          :needs-element-fn="needsElement"
          :keyword-schema="keywordSchema"
          :is-custom-ui="isCustomUi"
          :app-options="appOptions"
          :platform="platform"
          :nest-level="nestLevel + 1"
          @inspect="emit('inspect', $event)"
          @refresh-elements="emit('refresh-elements')"
        />
      </div>
    </div>

    <div class="add-candidate">
      <el-button type="primary" plain @click="addCandidate">+ 增加一个候选分支</el-button>
      <span class="branch-tip inline">每多一种可能的入口，就加一个候选</span>
    </div>

    <div class="branch-box none">
      <div class="branch-title">都没出现时</div>
      <p class="branch-tip">
        超时后所有候选都没出现才走这里。要在这里结束整条流程，就放一个
        「成功结束 / 失败结束 / 跳过结束」步骤。
      </p>

      <div class="branch-toolbar">
        <el-select v-model="noneAddCode" filterable style="width: 220px">
          <el-option
            v-for="k in keywordOptions"
            :key="k.code"
            :label="`${k.nameZh} (${k.code})`"
            :value="k.code" />
        </el-select>
        <el-button size="small" type="primary" @click="addNoneStep">添加兜底步骤</el-button>
      </div>

      <div v-if="!(step.params.noneSteps || []).length" class="branch-empty">暂无兜底步骤</div>
      <div
        v-for="(bs, bi) in step.params.noneSteps || []"
        :key="bs._key || 'n-' + bi"
        class="branch-step"
      >
        <div class="branch-step-head">
          <span class="branch-idx branch-idx-else">{{ pathPrefix }}.n{{ bi + 1 }}</span>
          <el-tag size="small" type="primary">{{ keywordName(bs.keywordCode) }}</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ bs.keywordCode }}</el-tag>
          <span class="step-spacer" />
          <el-button type="danger" link size="small" @click="removeNoneStep(bi)">删除</el-button>
        </div>
        <BranchStepFields
          :step="bs"
          :path-prefix="`${pathPrefix}.n${bi + 1}`"
          :element-options="elementOptions"
          :needs-element="needsElement(bs.keywordCode)"
          :keyword-options="keywordOptions"
          :create-step="createStep"
          :keyword-name="keywordName"
          :needs-element-fn="needsElement"
          :keyword-schema="keywordSchema"
          :is-custom-ui="isCustomUi"
          :app-options="appOptions"
          :platform="platform"
          :nest-level="nestLevel + 1"
          @inspect="emit('inspect', $event)"
          @refresh-elements="emit('refresh-elements')"
        />
      </div>

      <!-- 内联「返回提示」已由 FINISH_* 步骤取代；仅在存量流程里还有值时展示 -->
      <div v-if="legacyNoneMessage" class="legacy-return">
        <div class="legacy-return-title">⚠ 旧写法：内联返回提示</div>
        <div class="legacy-return-body">
          「{{ legacyNoneMessage }}」<span class="legacy-outcome">{{ legacyOutcomeLabel }}</span>
        </div>
        <div class="legacy-return-tip">
          判定藏在参数里、没配时只能按失败处理。建议改成在上方放一个
          「成功结束 / 失败结束 / 跳过结束」兜底步骤。
        </div>
        <el-button size="small" type="primary" plain @click="migrateNoneMessage">转成结束步骤</el-button>
        <el-button size="small" link @click="clearNoneMessage">仅清除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BranchStepFields from './BranchStepFields.vue'

type FlowStep = {
  _key?: string
  keywordCode: string
  elementKey?: string
  description?: string
  expectation?: string
  params: Record<string, any>
}

type Candidate = {
  _key?: string
  elementKey?: string
  label?: string
  steps?: FlowStep[]
}

const props = withDefaults(defineProps<{
  step: FlowStep
  pathPrefix?: string
  elementOptions: any[]
  keywordOptions: Array<{ code: string; nameZh: string }>
  createStep: (code: string) => FlowStep
  keywordName: (code: string) => string
  needsElement: (code: string) => boolean
  keywordSchema?: (code: string) => Array<Record<string, any>>
  isCustomUi?: (code: string) => boolean
  nestLevel?: number
}>(), {
  pathPrefix: '1',
  nestLevel: 0
})

const emit = defineEmits<{
  inspect: [step: FlowStep]
  'refresh-elements': []
}>()

const defaultCode = props.keywordOptions.find((k) => k.code === 'CLICK')?.code
  || props.keywordOptions[0]?.code
  || 'CLICK'
const candAddCode = ref(defaultCode)
const noneAddCode = ref(defaultCode)

/** 存量流程里内联的「都没出现时返回提示」 */
const legacyNoneMessage = computed(() => String(props.step.params?.noneMessage || '').trim())

const legacyOutcomeLabel = computed(() => {
  const raw = String(props.step.params?.endStatus || '').trim().toUpperCase()
  if (raw === 'PASS') return '判通过'
  if (raw === 'SKIP') return '判跳过'
  return '判失败（默认值）'
})

function migrateNoneMessage() {
  const raw = String(props.step.params?.endStatus || '').trim().toUpperCase()
  const code = raw === 'PASS' ? 'FINISH_SUCCESS' : raw === 'SKIP' ? 'FINISH_SKIPPED' : 'FINISH_FAILED'
  const step = props.createStep(code)
  step.params.message = legacyNoneMessage.value
  if (!Array.isArray(props.step.params.noneSteps)) props.step.params.noneSteps = []
  props.step.params.noneSteps.push(step)
  clearNoneMessage()
  ElMessage.success('已转成结束步骤，请确认判定是否符合预期')
}

function clearNoneMessage() {
  delete props.step.params.noneMessage
  delete props.step.params.endStatus
}

const candidates = computed<Candidate[]>(() => {
  if (!Array.isArray(props.step.params.candidates)) {
    props.step.params.candidates = []
  }
  return props.step.params.candidates
})

/** 候选内子步骤编号：父.c序号.步骤号，与执行日志的大纲编号对应 */
function childNo(ci: number, bi: number) {
  const p = String(props.pathPrefix || '1').trim() || '1'
  return `${p}.c${ci + 1}.${bi + 1}`
}

function newKey() {
  return `wa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function elementOptionLabel(el: any) {
  const zh = String(el?.nameZh || '').trim()
  const en = String(el?.nameEn || '').trim()
  if (zh && en) return `${zh}（${en}）`
  return zh || en || '—'
}

function addCandidate() {
  candidates.value.push({ _key: newKey(), elementKey: '', label: '', steps: [] })
}

function removeCandidate(ci: number) {
  candidates.value.splice(ci, 1)
}

function moveCandidate(ci: number, delta: number) {
  const to = ci + delta
  if (to < 0 || to >= candidates.value.length) return
  const next = candidates.value.slice()
  const [item] = next.splice(ci, 1)
  next.splice(to, 0, item)
  props.step.params.candidates = next
}

function addStep(ci: number) {
  if (!candAddCode.value) {
    ElMessage.warning('请选择要添加的关键字')
    return
  }
  const cand = candidates.value[ci]
  if (!Array.isArray(cand.steps)) cand.steps = []
  cand.steps.push(props.createStep(candAddCode.value))
}

function removeStep(ci: number, bi: number) {
  candidates.value[ci].steps?.splice(bi, 1)
}

function moveStep(ci: number, bi: number, delta: number) {
  const arr = candidates.value[ci].steps
  if (!arr) return
  const to = bi + delta
  if (to < 0 || to >= arr.length) return
  const next = arr.slice()
  const [item] = next.splice(bi, 1)
  next.splice(to, 0, item)
  candidates.value[ci].steps = next
}

function addNoneStep() {
  if (!noneAddCode.value) {
    ElMessage.warning('请选择要添加的关键字')
    return
  }
  if (!Array.isArray(props.step.params.noneSteps)) props.step.params.noneSteps = []
  props.step.params.noneSteps.push(props.createStep(noneAddCode.value))
}

function removeNoneStep(bi: number) {
  props.step.params.noneSteps?.splice(bi, 1)
}
</script>

<style scoped>
.wait-any-branches {
  margin-top: 8px;
}
.wa-intro {
  margin-bottom: 12px;
}
.wa-head-form {
  margin-bottom: 8px;
}
.legacy-return {
  border: 1px dashed var(--app-warning);
  background: rgba(230, 162, 60, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-top: 8px;
}
.legacy-return-title {
  font-size: 12px;
  font-weight: 700;
  color: #b88230;
  margin-bottom: 4px;
}
.legacy-return-body {
  font-size: 13px;
  margin-bottom: 4px;
}
.legacy-outcome {
  margin-left: 6px;
  font-size: 12px;
  color: #b88230;
}
.legacy-return-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  line-height: 1.6;
  margin-bottom: 8px;
}
.branch-box {
  border: 1px solid var(--el-border-color-lighter, var(--app-border));
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.branch-box.candidate {
  border-left: 4px solid #22c55e;
  background: rgba(34, 197, 94, 0.04);
}
.branch-box.none {
  border-left: 4px solid #f59e0b;
  background: rgba(245, 158, 11, 0.04);
}
.branch-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  margin-bottom: 6px;
}
.cand-rank {
  font-size: 12px;
  color: #16a34a;
  background: rgba(34, 197, 94, 0.12);
  border-radius: 4px;
  padding: 2px 8px;
}
.cand-name {
  font-size: 13px;
}
.branch-tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  line-height: 1.6;
}
.branch-tip.inline {
  display: inline;
  margin-left: 8px;
}
.branch-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.branch-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder, #a8abb2);
  padding: 8px 0;
}
.branch-step {
  border-top: 1px dashed var(--el-border-color-lighter, var(--app-border));
  padding-top: 8px;
  margin-top: 8px;
}
.branch-step-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.branch-idx {
  font-size: 11px;
  font-weight: 800;
  color: #16a34a;
}
.branch-idx-else {
  color: #d97706;
}
.step-desc-inline {
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}
.step-spacer {
  flex: 1;
}
.element-pick-actions {
  margin-top: 4px;
}
.add-candidate {
  margin-bottom: 12px;
}
</style>
