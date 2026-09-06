<template>
  <el-form label-position="top" class="step-form">
    <el-form-item label="备注">
      <el-input
        v-model="step.description"
        maxlength="120"
        show-word-limit
        placeholder="可选，给自己看的，如：点底部登录入口"
      />
    </el-form-item>
    <el-form-item v-if="needsElement" :label="elementFieldLabel">
      <ElementKeySelect
        v-model="step.elementKey"
        :elements="elementOptions"
        :pages="pageOptions"
        placeholder="先选页面，再选该页下的元素"
      />
      <div class="element-pick-actions">
        <el-button link type="primary" @click="emit('inspect', step)">记不住？真机点选</el-button>
        <el-button link @click="emit('refresh-elements')">刷新列表</el-button>
      </div>
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'IF_ELEMENT_EXISTS'" label="探测超时">
      <el-input-number v-model="step.params.timeoutSec" :min="1" :max="60" />
      <span class="exec-hint" style="margin-left: 8px">秒</span>
    </el-form-item>
    <!-- 参数表单由后端 param_schema 驱动，与主编辑器共用同一个渲染组件 -->
    <!-- 启动类步骤是 customUi，通用渲染会跳过；分支内同样要能配 -->
    <LaunchStepFields
      v-if="isLaunchLikeStep(step.keywordCode)"
      :step="step"
      :app-options="appOptions"
      :platform="platform"
    />

    <KeywordParamFields
      v-else-if="!isCustomUi?.(step.keywordCode)"
      :schema="schema"
      :params="step.params"
      :keyword-code="step.keywordCode"
      :element-options="elementOptions"
      :page-options="pageOptions"
    />

    <DismissPopupsEditor
      v-if="step.keywordCode === 'DISMISS_POPUPS'"
      :step="step"
      :element-options="elementOptions"
      :page-options="pageOptions"
      @refresh-elements="emit('refresh-elements')"
    />

    <WaitAnyBranchEditor
      v-if="step.keywordCode === 'WAIT_ANY' && canNest"
      :step="step"
      :path-prefix="pathPrefix || '1'"
      :element-options="elementOptions"
      :page-options="pageOptions"
      :keyword-options="keywordOptions"
      :create-step="createStep!"
      :keyword-name="keywordName!"
      :needs-element="needsElementFn!"
      :keyword-schema="keywordSchema"
      :is-custom-ui="isCustomUi"
      :app-options="appOptions"
      :platform="platform"
      :nest-level="nestLevel"
      @inspect="emit('inspect', $event)"
      @refresh-elements="emit('refresh-elements')"
    />

    <IfBranchEditor
      v-if="step.keywordCode === 'IF_ELEMENT_EXISTS' && canNest"
      :step="step"
      :path-prefix="pathPrefix || '1'"
      :element-options="elementOptions"
      :page-options="pageOptions"
      :keyword-options="keywordOptions"
      :create-step="createStep!"
      :keyword-name="keywordName!"
      :needs-element="needsElementFn!"
      :keyword-schema="keywordSchema"
      :is-custom-ui="isCustomUi"
      :app-options="appOptions"
      :platform="platform"
      :nest-level="nestLevel"
      @inspect="emit('inspect', $event)"
      @refresh-elements="emit('refresh-elements')"
    />
    <p v-else-if="step.keywordCode === 'IF_ELEMENT_EXISTS' && !canNest" class="nest-limit">
      嵌套过深：请把后续逻辑拆成独立流程，用「调用组件」引用。
    </p>
  </el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IfBranchEditor from './IfBranchEditor.vue'
import WaitAnyBranchEditor from './WaitAnyBranchEditor.vue'
import DismissPopupsEditor from './DismissPopupsEditor.vue'
import KeywordParamFields from '../components/KeywordParamFields.vue'
import ElementKeySelect from '../components/ElementKeySelect.vue'
import LaunchStepFields from './LaunchStepFields.vue'

type FlowStep = {
  keywordCode: string
  elementKey?: string
  description?: string
  expectation?: string
  params: Record<string, any>
}

const props = withDefaults(defineProps<{
  step: FlowStep
  elementOptions: any[]
  pageOptions?: any[]
  needsElement: boolean
  /** 当前步骤大纲号，如 "1.2"；嵌套 IF 子步骤会变成 1.2.1 */
  pathPrefix?: string
  /** 嵌套 IF 编辑需要；顶层普通分支步骤也可不传（非 IF） */
  keywordOptions?: Array<{ code: string; nameZh: string }>
  createStep?: (code: string) => FlowStep
  keywordName?: (code: string) => string
  needsElementFn?: (code: string) => boolean
  nestLevel?: number
  /** 取关键字参数定义（后端 param_schema） */
  keywordSchema?: (code: string) => Array<Record<string, any>>
  /** 该关键字是否由专用编辑器渲染 */
  isCustomUi?: (code: string) => boolean
  /** 应用字典，供启动类步骤选择 */
  appOptions?: any[]
  /** 流程平台，决定启动步骤是否显示 appActivity */
  platform?: string
}>(), {
  pathPrefix: '',
  keywordOptions: () => [],
  nestLevel: 0,
  appOptions: () => [],
  pageOptions: () => []
})

function isLaunchLikeStep(code: string) {
  const c = String(code || '').toUpperCase()
  return c.startsWith('LAUNCH_APP') || c.startsWith('COLD_START') || c.startsWith('HOT_START')
}

const emit = defineEmits<{
  inspect: [step: FlowStep]
  'refresh-elements': []
}>()

const canNest = computed(() =>
  !!props.createStep && !!props.keywordName && !!props.needsElementFn && (props.nestLevel || 0) < 5
)

const schema = computed(() => props.keywordSchema?.(props.step.keywordCode) || [])

const elementFieldLabel = computed(() => {
  if (props.step.keywordCode === 'IF_ELEMENT_EXISTS') return '判断元素'
  if (isScrollUntilStep(props.step.keywordCode)) return '目标元素'
  return '选择元素'
})

function isScrollUntilStep(code: string) {
  return code === 'SCROLL_UNTIL' || code === 'SCROLL_UNTIL_IOS'
}

</script>

<style scoped>
.step-form {
  margin-top: 4px;
}
.step-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
.step-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  line-height: 1.3;
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}
.element-pick-actions {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.nest-limit {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--app-warning);
}
</style>
