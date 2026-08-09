<template>
  <div class="if-branches">
    <div class="branch-box then">
      <div class="branch-title">存在时执行（子步骤 {{ pathPrefix }}.1、{{ pathPrefix }}.2…）</div>
      <p class="branch-tip">找到判断元素后走这里（可继续加点击、等待，也可再套一层「元素存在判断」）</p>
      <div class="branch-toolbar">
        <el-select v-model="thenAddCode" filterable style="width: 220px">
          <el-option
            v-for="k in keywordOptions"
            :key="k.code"
            :label="`${k.nameZh} (${k.code})`"
            :value="k.code" />
        </el-select>
        <el-button size="small" type="success" @click="add('thenSteps')">添加</el-button>
      </div>
      <div v-if="!(step.params.thenSteps || []).length" class="branch-empty">暂无步骤</div>
      <div
        v-for="(bs, bi) in step.params.thenSteps || []"
        :key="bs._key || 't-' + bi"
        class="branch-step"
        :style="stepColorStyle(bs.keywordCode)"
      >
        <div class="branch-step-head">
          <span class="branch-idx">{{ childNo(bi) }}</span>
          <span class="branch-step-name">{{ nameOf(bs.keywordCode) }}</span>
          <span class="step-cat-tag">{{ stepColorByCode(bs.keywordCode).categoryLabel }}</span>
          <el-tag size="small" type="info" effect="plain">{{ bs.keywordCode }}</el-tag>
          <span v-if="bs.description" class="step-desc-inline" :title="bs.description">{{ bs.description }}</span>
          <span class="step-spacer" />
          <el-button link size="small" class="step-action-btn" :disabled="bi === 0" @click="move('thenSteps', bi, -1)">上移</el-button>
          <el-button
            link
            size="small"
            class="step-action-btn"
            :disabled="bi === (step.params.thenSteps || []).length - 1"
            @click="move('thenSteps', bi, 1)"
          >下移</el-button>
          <el-button link size="small" class="step-delete-btn" @click="remove('thenSteps', bi)">删除</el-button>
        </div>
        <BranchStepFields
          :step="bs"
          :path-prefix="childNo(bi)"
          :element-options="elementOptions"
          :page-options="pageOptions"
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

    <div class="branch-box else">
      <div class="branch-title">不存在时执行（子步骤 {{ pathPrefix }}.1、{{ pathPrefix }}.2…）</div>
      <p class="branch-tip">
        在下方添加步骤（登录、调用组件等）。要在这里结束整条流程，就放一个
        「成功结束 / 失败结束 / 跳过结束」步骤，判定写在关键字上，不会被漏配。
      </p>
      <!-- 内联「返回提示」已由 FINISH_* 步骤取代；仅在存量流程里还有值时展示，便于识别与迁移 -->
      <div v-if="legacyElseMessage" class="legacy-return">
        <div class="legacy-return-title">⚠ 旧写法：内联返回提示</div>
        <div class="legacy-return-body">
          「{{ legacyElseMessage }}」<span class="legacy-outcome">{{ legacyOutcomeLabel }}</span>
        </div>
        <div class="legacy-return-tip">
          判定藏在参数里、没配时只能按失败处理，容易把正常收尾记成失败。
          建议改成在下方放一个「成功结束 / 失败结束 / 跳过结束」步骤。
        </div>
        <el-button size="small" type="primary" plain @click="migrateElseMessage">
          转成结束步骤
        </el-button>
        <el-button size="small" link @click="clearElseMessage">仅清除</el-button>
      </div>
      <div class="branch-toolbar">
        <el-select v-model="elseAddCode" filterable style="width: 220px">
          <el-option
            v-for="k in keywordOptions"
            :key="k.code"
            :label="`${k.nameZh} (${k.code})`"
            :value="k.code" />
        </el-select>
        <el-button size="small" type="primary" @click="add('elseSteps')">添加步骤</el-button>
      </div>
      <div v-if="!(step.params.elseSteps || []).length" class="branch-empty">暂无额外步骤</div>
      <div
        v-for="(bs, bi) in step.params.elseSteps || []"
        :key="bs._key || 'e-' + bi"
        class="branch-step"
        :style="stepColorStyle(bs.keywordCode)"
      >
        <div class="branch-step-head">
          <span class="branch-idx">{{ childNo(bi) }}</span>
          <span class="branch-step-name">{{ nameOf(bs.keywordCode) }}</span>
          <span class="step-cat-tag">{{ stepColorByCode(bs.keywordCode).categoryLabel }}</span>
          <el-tag size="small" type="info" effect="plain">{{ bs.keywordCode }}</el-tag>
          <span v-if="bs.description" class="step-desc-inline" :title="bs.description">{{ bs.description }}</span>
          <span class="step-spacer" />
          <el-button link size="small" class="step-action-btn" :disabled="bi === 0" @click="move('elseSteps', bi, -1)">上移</el-button>
          <el-button
            link
            size="small"
            class="step-action-btn"
            :disabled="bi === (step.params.elseSteps || []).length - 1"
            @click="move('elseSteps', bi, 1)"
          >下移</el-button>
          <el-button link size="small" class="step-delete-btn" @click="remove('elseSteps', bi)">删除</el-button>
        </div>
        <BranchStepFields
          :step="bs"
          :path-prefix="childNo(bi)"
          :element-options="elementOptions"
          :page-options="pageOptions"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { stepColorByCode, stepColorStyle } from '@/utils/stepKeywordColor'
import BranchStepFields from './BranchStepFields.vue'

export type FlowStep = {
  keywordCode: string
  elementKey?: string
  /** 给人看的步骤说明（执行引擎忽略） */
  description?: string
  /** 给人看的预期结果，不等于断言（执行引擎忽略） */
  expectation?: string
  params: Record<string, any>
}

const props = withDefaults(defineProps<{
  step: FlowStep
  /** 父步骤编号，如 "1" 或 "2.1"；子步骤显示为 1.1 / 2.1.1 */
  pathPrefix?: string
  elementOptions: any[]
  pageOptions?: any[]
  keywordOptions: Array<{ code: string; nameZh: string }>
  createStep: (code: string) => FlowStep
  keywordName: (code: string) => string
  needsElement: (code: string) => boolean
  /** 取关键字参数定义（后端 param_schema） */
  keywordSchema?: (code: string) => Array<Record<string, any>>
  /** 该关键字是否由专用编辑器渲染 */
  isCustomUi?: (code: string) => boolean
  /** 应用字典与流程平台：分支内的启动类步骤需要 */
  appOptions?: any[]
  platform?: string
  nestLevel?: number
}>(), {
  pathPrefix: '1',
  nestLevel: 0,
  pageOptions: () => [],
  appOptions: () => []
})

const emit = defineEmits<{
  inspect: [step: FlowStep]
  'refresh-elements': []
}>()

/** 存量流程里内联的「不存在时返回提示」；新流程一律用 FINISH_* 步骤 */
const legacyElseMessage = computed(() => String(props.step.params?.elseMessage || '').trim())

const legacyOutcomeLabel = computed(() => {
  const raw = String(props.step.params?.endStatus || '').trim().toUpperCase()
  if (raw === 'PASS') return '判通过'
  if (raw === 'SKIP') return '判跳过'
  return '判失败（默认值）'
})

/** 原地转成一个明确的结束步骤，保留原文案 */
function migrateElseMessage() {
  const raw = String(props.step.params?.endStatus || '').trim().toUpperCase()
  const code = raw === 'PASS' ? 'FINISH_SUCCESS' : raw === 'SKIP' ? 'FINISH_SKIPPED' : 'FINISH_FAILED'
  const step = props.createStep(code)
  step.params.message = legacyElseMessage.value
  if (!Array.isArray(props.step.params.elseSteps)) props.step.params.elseSteps = []
  props.step.params.elseSteps.push(step)
  clearElseMessage()
  ElMessage.success(`已转成「${code === 'FINISH_SUCCESS' ? '成功结束' : code === 'FINISH_SKIPPED' ? '跳过结束' : '失败结束'}」步骤，请确认判定是否符合预期`)
}

function clearElseMessage() {
  delete props.step.params.elseMessage
  delete props.step.params.endStatus
}

const thenAddCode = ref(props.keywordOptions.find((k) => k.code === 'CLICK')?.code || props.keywordOptions[0]?.code || 'CLICK')
const elseAddCode = ref(props.keywordOptions.find((k) => k.code === 'CLICK')?.code || props.keywordOptions[0]?.code || 'CLICK')

function nameOf(code: string) {
  return props.keywordName(code)
}

/** 子步骤大纲号：父.序号（存在/不存在两支各自从 .1 起算，靠色块区分） */
function childNo(bi: number) {
  const p = String(props.pathPrefix || '1').trim() || '1'
  return `${p}.${bi + 1}`
}

function add(which: 'thenSteps' | 'elseSteps') {
  const code = which === 'thenSteps' ? thenAddCode.value : elseAddCode.value
  if (!code) {
    ElMessage.warning('请选择分支关键字')
    return
  }
  if (code === 'IF_ELEMENT_EXISTS' && (props.nestLevel || 0) >= 4) {
    ElMessage.warning('嵌套「元素存在判断」过深，请改用「调用组件」拆分子流程')
    return
  }
  if (!Array.isArray(props.step.params[which])) props.step.params[which] = []
  props.step.params[which].push(props.createStep(code))
}

function move(which: 'thenSteps' | 'elseSteps', idx: number, delta: number) {
  const arr = props.step.params[which] as FlowStep[]
  if (!arr) return
  const to = idx + delta
  if (to < 0 || to >= arr.length) return
  const next = arr.slice()
  const [item] = next.splice(idx, 1)
  next.splice(to, 0, item)
  props.step.params[which] = next
}

function remove(which: 'thenSteps' | 'elseSteps', idx: number) {
  props.step.params[which]?.splice(idx, 1)
}
</script>

<style scoped>
.if-branches {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.branch-box {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: #fafafa;
}
.branch-box.then {
  border-color: #b3e19d;
  background: #f0f9eb;
}
.branch-box.else {
  border-color: #f3d19e;
  background: #fdf6ec;
}
.branch-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: #303133;
}
.branch-box.then .branch-title {
  color: #67c23a;
}
.branch-box.then .branch-tip {
  color: #85ce61;
}
.branch-step-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.step-action-btn {
  color: #909399 !important;
}
.step-action-btn:hover:not(.is-disabled) {
  color: var(--el-color-primary) !important;
}
.step-delete-btn {
  color: #909399 !important;
  font-weight: 400 !important;
}
.step-delete-btn:hover {
  color: #f56c6c !important;
}
.branch-tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}
.legacy-return {
  border: 1px dashed var(--app-warning);
  background: rgba(230, 162, 60, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
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
.branch-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.branch-empty {
  font-size: 12px;
  color: #c0c4cc;
  padding: 6px 0;
}
.branch-step {
  border: 1px solid var(--step-soft-border, var(--app-border));
  border-radius: 8px;
  padding: 0;
  margin-bottom: 8px;
  background: #fff;
  overflow: hidden;
  border-top: 3px solid var(--step-color, #67c23a);
}
.branch-step-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0;
  padding: 8px 10px;
  background: var(--step-soft-bg, #f8fafc);
  border-bottom: 1px solid var(--step-soft-border, #ebeef5);
}
.branch-idx {
  display: inline-flex;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--step-color, #67c23a);
  color: #fff;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.branch-idx-else {
  background: var(--step-color, #e6a23c);
}
.step-cat-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--step-color, #606266);
  background: #fff;
  border: 1px solid var(--step-soft-border, #ebeef5);
}
.branch-step :deep(.step-form) {
  padding: 8px 10px 2px;
}
.step-spacer {
  flex: 1;
}
.step-desc-inline {
  font-size: 12px;
  color: var(--app-text-secondary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.else-msg-form {
  margin-bottom: 4px;
}
</style>
