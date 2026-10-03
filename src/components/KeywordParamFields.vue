<template>
  <template v-for="def in renderableDefs" :key="def.name">
    <el-form-item
      :required="def.required"
      :label-width="def.type === 'boolean' ? '0px' : undefined"
      :class="{ 'param-bool-item': def.type === 'boolean' }"
    >
      <template v-if="def.type !== 'boolean'" #label>
        <span class="param-label">
          {{ displayLabel(def) }}
          <el-popover v-if="fieldHelp(def)" placement="top" :width="320" trigger="hover">
            <template #reference>
              <el-icon class="param-help-icon"><QuestionFilled /></el-icon>
            </template>
            <div class="param-help-pop">{{ fieldHelp(def) }}</div>
          </el-popover>
        </span>
      </template>
      <div v-if="def.type === 'string' && isInputText(def)" class="input-with-env">
        <el-input
          v-model="params[def.name]"
          :placeholder="def.help || '可填固定文案，或从右侧选环境变量'"
        />
        <el-select
          :model-value="envSelectValue(params[def.name])"
          filterable
          clearable
          placeholder="环境变量"
          class="env-var-select"
          @change="(v: string) => applyEnvVar(def.name, v)"
        >
          <el-option-group v-if="testVars.length" label="测试环境 TEST">
            <el-option
              v-for="v in testVars"
              :key="'TEST-' + v.name"
              :label="envOptionLabel(v)"
              :value="'TEST::' + v.name"
            />
          </el-option-group>
          <el-option-group v-if="prodVars.length" label="线上环境 PROD">
            <el-option
              v-for="v in prodVars"
              :key="'PROD-' + v.name"
              :label="envOptionLabel(v)"
              :value="'PROD::' + v.name"
            />
          </el-option-group>
          <el-option
            v-if="!testVars.length && !prodVars.length"
            disabled
            label="还没有环境变量，去「环境变量」页新增"
            value=""
          />
        </el-select>
      </div>

      <el-select
        v-else-if="def.type === 'string' && isComponentFlowId(def)"
        v-model="params[def.name]"
        filterable
        clearable
        placeholder="选择组件流程"
        style="width: 100%"
      >
        <el-option
          v-for="f in componentFlows || []"
          :key="f.id"
          :label="f.name || f.id"
          :value="f.id"
        />
      </el-select>

      <el-input
        v-else-if="def.type === 'string'"
        v-model="params[def.name]"
        :placeholder="def.help || ''"
      />

      <LocatorVarFields
        v-if="isComponentFlowId(def)"
        :names="componentLocatorVars"
        :params="params"
      />

      <div v-if="isH5UrlParam(def)" class="element-pick-actions">
        <el-button link type="primary" @click="emit('pick-h5-url', def.name)">
          记不住？真机读当前 URL
        </el-button>
      </div>

      <el-input
        v-else-if="def.type === 'textarea'"
        v-model="params[def.name]"
        type="textarea"
        :rows="2"
        maxlength="500"
        show-word-limit
        :placeholder="def.help || ''"
      />

      <div v-else-if="def.type === 'number'" class="param-number-block">
        <div class="param-number-row">
          <el-input-number
            v-model="params[def.name]"
            :min="0"
            :max="numberMax(def)"
            :step="numberStep(def)"
            :precision="numberPrecision(def)"
          />
          <span v-if="numberUnit(def)" class="param-unit">{{ numberUnit(def) }}</span>
        </div>
        <el-button
          v-if="def.name === 'offsetXPercent'"
          link
          type="primary"
          class="offset-pick-link"
          @click="emit('pick-tap-offset')"
        >真机点选算出位置</el-button>
      </div>

      <template v-else-if="def.type === 'boolean'">
        <div class="param-bool-block">
          <span class="param-bool-title">
            {{ def.label || def.name }}
            <el-popover v-if="def.help" placement="top" :width="320" trigger="hover">
              <template #reference>
                <el-icon class="param-help-icon"><QuestionFilled /></el-icon>
              </template>
              <div class="param-help-pop">{{ def.help }}</div>
            </el-popover>
          </span>
          <el-switch v-model="params[def.name]" />
        </div>
      </template>

      <el-select v-else-if="def.type === 'enum'" v-model="params[def.name]" style="width: 100%">
        <el-option
          v-for="opt in def.options || []"
          :key="opt"
          :label="optionLabel(def.name, opt)"
          :value="opt"
        />
      </el-select>

      <!--
        次级元素（「落点元素」「滑到它出现为止」等）：主元素由外层步骤表单渲染，这里只管额外的。
        定位里有 ${变量} 才在选择器下面出输入框；没有变量就不占位置。
      -->
      <template v-else-if="def.type === 'element'">
        <ElementKeySelect
          v-model="params[def.name]"
          :elements="elementOptions || []"
          :pages="pageOptions || []"
          :params="params"
          placeholder="先选页面，再选元素"
        />
      </template>

      <!-- 一批元素（如「要判定的元素」）：已选清单常驻在上方，加删都是一步 -->
      <template v-else-if="def.type === 'elements'">
        <ElementKeyMultiSelect
          v-model="params[def.name]"
          :elements="elementOptions || []"
          :pages="pageOptions || []"
        />
        <LocatorVarFields
          :names="varsOfElementParam(params[def.name])"
          :params="params"
        />
      </template>

      <el-input v-else v-model="params[def.name]" />

      <el-button v-if="isInputText(def)" link type="primary" class="env-page-link" @click="goEnvPage">
        去环境变量
      </el-button>
    </el-form-item>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LocatorVarFields from './LocatorVarFields.vue'
import { elementLocatorVars } from '@/utils/locatorVars'
import { useRouter } from 'vue-router'
import { QuestionFilled } from '@element-plus/icons-vue'
import ElementKeySelect from './ElementKeySelect.vue'
import ElementKeyMultiSelect from './ElementKeyMultiSelect.vue'
import { apiClient } from '../api'

/**
 * 按后端 ui_keywords.param_schema 渲染步骤参数表单。
 *
 * 后端 KeywordHandler 是参数的唯一来源，这里不硬编码任何关键字——新增关键字前端零改动。
 * 元素（element）与嵌套步骤（steps）由外层专门处理，这里跳过。
 */

export interface ParamDefDto {
  name: string
  label: string
  type: 'string' | 'textarea' | 'number' | 'boolean' | 'enum' | 'element' | 'elements' | 'steps'
  required?: boolean
  default?: string | number | boolean
  options?: string[]
  help?: string
  /** 显示条件：同步骤里 param 取到 values 之一时才渲染 */
  showWhen?: { param: string; values: string[] }
}

type EnvVar = {
  name: string
  value?: string
  secret?: boolean
  enabled?: boolean
  description?: string
}

const props = defineProps<{
  /** 关键字的 paramSchema（已解析成数组） */
  schema: ParamDefDto[]
  /** 步骤的 params 对象，直接双向绑定 */
  params: Record<string, any>
  /** 供次级元素参数下拉用；主元素由外层渲染。带上定位串，才能判断要不要出文案变量框 */
  elementOptions?: Array<{
    nameEn: string
    nameZh?: string
    pageId?: string | null
    locatorValue?: string
    locatorFallbacks?: string
  }>
  /** 页面字典：级联「页面 → 元素」展示中文页名 */
  pageOptions?: Array<{ pageId?: string; nameZh?: string }>
  /** 当前步骤关键字。INPUT / EditText输入 的「输入内容」要能选环境变量 */
  keywordCode?: string
  /** 流程登记的环境：同名变量只点亮这一边，避免测试/生产同时高亮 */
  environment?: string
  /** 「调用组件」下拉：只列已存为组件的流程 */
  componentFlows?: Array<{ id: string; name?: string }>
}>()

const emit = defineEmits<{
  'pick-h5-url': [paramName: string]
  'pick-tap-offset': []
}>()

const router = useRouter()
const testVars = ref<EnvVar[]>([])
const prodVars = ref<EnvVar[]>([])

function usesEnvTextKeyword(code?: string) {
  const c = String(code || '').toUpperCase()
  return c === 'INPUT' || c === 'INPUT_EDITTEXT' || c === 'EDITTEXT'
}

function isInputText(def: ParamDefDto) {
  return usesEnvTextKeyword(props.keywordCode) && def.name === 'text'
}

/** H5 打开/断言：地址来自真机当前页，不要手抄 */
function isComponentFlowId(def: ParamDefDto) {
  return String(props.keywordCode || '').toUpperCase() === 'CALL_COMPONENT' && def.name === 'flowId'
}

const componentLocatorVars = ref<string[]>([])

watch(
  () => [props.keywordCode, props.params?.flowId],
  async ([code, flowId]) => {
    if (String(code || '').toUpperCase() !== 'CALL_COMPONENT') {
      componentLocatorVars.value = []
      return
    }
    const id = String(flowId || '').trim()
    if (!id) {
      componentLocatorVars.value = []
      return
    }
    try {
      componentLocatorVars.value = (await apiClient.getFlowLocatorVariables(id)) || []
    } catch {
      componentLocatorVars.value = []
    }
  },
  { immediate: true }
)

/** 次级元素定位里的 ${变量}。没选元素、或定位是固定文案时返回空，输入框不渲染 */
function varsOfElementParam(raw: unknown): string[] {
  const keys = Array.isArray(raw) ? raw : String(raw ?? '').split(/[\n\r,;，、；]+/)
  const names: string[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    const k = String(key || '').trim()
    if (!k) continue
    const el = (props.elementOptions || []).find((e) => e.nameEn === k)
    for (const name of elementLocatorVars(el)) {
      if (!seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }
  return names
}

function isH5UrlParam(def: ParamDefDto) {
  const code = String(props.keywordCode || '').toUpperCase()
  if (!code.includes('H5')) return false
  return def.name === 'url' || def.name === 'expected' || def.name === 'pageUrl'
}

function isHorizontalSwipe() {
  const d = String(props.params?.direction || '').toLowerCase()
  return d === 'left' || d === 'right'
}

function fieldHelp(def: ParamDefDto) {
  if (isInputText(def)) {
    return '选环境变量会写入 ${变量名}，执行时按当前环境（测试 / 线上）取值——同一条流程两边都能跑。也可直接填固定文案。'
  }
  if (def.name === 'distance') {
    return isHorizontalSwipe()
      ? '左右滑按屏宽算每次滑多远。short≈屏宽 12%；normal≈半个屏宽；long≈大幅横滑。仍偏大时用「幅度百分比」覆盖。'
      : '上下滑按屏高算每次滑多远。short≈屏高 12%；normal≈半个屏高；long≈大幅翻页。仍偏大时用「幅度百分比」覆盖。'
  }
  if (def.name === 'distancePercent') {
    return isHorizontalSwipe()
      ? '按屏宽百分比自定义单次横滑距离，填了就覆盖上面的档位。建议 3～15；0 或不填则用档位。'
      : '按屏高百分比自定义单次行程，填了就覆盖上面的档位。建议 3～15；0 或不填则用档位。'
  }
  return def.help || ''
}

function envVarNameOf(raw: unknown) {
  const s = String(raw || '').trim()
  const m = s.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/) || s.match(/^\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}$/)
  return m ? m[1] : ''
}

const pickedEnvKey = ref('')

function flowEnv() {
  return props.environment === 'TEST' ? 'TEST' : 'PROD'
}

function envSelectValue(raw: unknown) {
  const name = envVarNameOf(raw)
  if (!name) return ''
  const picked = pickedEnvKey.value
  if (picked === `TEST::${name}` || picked === `PROD::${name}`) return picked
  const env = flowEnv()
  const side = env === 'TEST' ? testVars.value : prodVars.value
  if (side.some((v) => v.name === name)) return `${env}::${name}`
  if (prodVars.value.some((v) => v.name === name)) return `PROD::${name}`
  if (testVars.value.some((v) => v.name === name)) return `TEST::${name}`
  return ''
}

function applyEnvVar(paramName: string, key: string) {
  if (!key) {
    pickedEnvKey.value = ''
    props.params[paramName] = ''
    return
  }
  const name = key.includes('::') ? key.slice(key.indexOf('::') + 2) : key
  pickedEnvKey.value = key.includes('::') ? key : `${flowEnv()}::${name}`
  props.params[paramName] = `\${${name}}`
}

function envOptionLabel(v: EnvVar) {
  const preview = v.secret ? '••••••••••' : v.value || '（空）'
  const desc = v.description ? ` · ${v.description}` : ''
  return `${v.name}  ${preview}${desc}`
}

function goEnvPage() {
  void router.push('/api-environments')
}

async function loadEnvVars() {
  const take = (list: any[]) =>
    (Array.isArray(list) ? list : []).filter((v) => v?.name && v.enabled !== false)
  try {
    const [test, prod] = await Promise.all([
      apiClient.getApiTestVariables('TEST'),
      apiClient.getApiTestVariables('PROD')
    ])
    testVars.value = take(test)
    prodVars.value = take(prod)
  } catch {
    testVars.value = []
    prodVars.value = []
  }
}

watch(
  () => props.keywordCode,
  (code) => {
    if (usesEnvTextKeyword(code)) {
      void loadEnvVars()
    }
  },
  { immediate: true }
)

/**
 * 主元素（elementKey）绑在步骤自身、由外层表单渲染；嵌套步骤有专用编辑器。
 * 其余按 schema 渲染，再按 showWhen 过滤——目的是「用不上的开关就别占位置」。
 */
const renderableDefs = computed(() =>
  (props.schema || [])
    .filter((d) => d.type !== 'steps' && d.name !== 'elementKey')
    .filter(isVisible)
)

/** showWhen 里的值来自 JSON，一律按字符串比；未声明条件的一直显示 */
function isVisible(def: ParamDefDto) {
  const cond = def.showWhen
  if (!cond?.param) return true
  const current = props.params?.[cond.param]
  if (current === undefined || current === null) return false
  return (cond.values || []).some((v) => String(v) === String(current))
}

/** 毫秒类参数步进大一些，免得点半天 */
function numberStep(def: ParamDefDto) {
  if (def.name === 'distancePercent') return 0.5
  return /ms$/i.test(def.name) || /毫秒/.test(def.label || '') ? 100 : 1
}

function numberPrecision(def: ParamDefDto) {
  return def.name === 'distancePercent' ? 1 : undefined
}

/** 标签去掉单位词，单位放到输入框后；顺带把「失败重试次数」收成「失败重试」避免 label 列挤换行 */
function displayLabel(def: ParamDefDto) {
  const label = def.label || def.name
  if (def.type !== 'number') return label
  return label
    .replace(/次数$/u, '')
    .replace(/(毫秒|秒|百分比)$/u, '')
    .trim() || label
}

function numberUnit(def: ParamDefDto): string {
  if (def.name === 'retryTimes' || /times$/i.test(def.name) || /次数$/.test(def.label || '') || def.label === '失败重试') {
    return '次'
  }
  if (/Percent$/i.test(def.name) || /百分比/.test(def.label || '')) {
    return '%'
  }
  if (/ms$/i.test(def.name) || /毫秒/.test(def.label || '')) {
    return '毫秒'
  }
  if (/sec$/i.test(def.name) || /秒/.test(def.label || '')) {
    return '秒'
  }
  if (/rounds$/i.test(def.name) || /轮数$/.test(def.label || '')) {
    return '轮'
  }
  if (/Percent$/i.test(def.name) || /百分比/.test(def.label || '') || /点击位置/.test(def.label || '')) {
    return '%'
  }
  return ''
}

function numberMax(def: ParamDefDto) {
  return /Percent$/i.test(def.name) ? 100 : undefined
}

/** 少数枚举给中文说明，其余直接显示原值 */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  direction: {
    up: 'up（上滑，内容往下翻）',
    down: 'down（下滑）',
    left: 'left（左滑）',
    right: 'right（右滑）'
  },
  distance: {
    short: 'short（小幅，约屏高一成多）',
    normal: 'normal（约半个屏高）',
    long: 'long（大幅翻页）'
  },
  clickMethod: {
    AUTO: '自动（勾选单次；登录等按钮 iOS 可补点）',
    ELEMENT: '仅元素 click（适合抽屉/开关/勾选，只点一次）',
    COORDINATE: '仅坐标 W3C（可配合横向/纵向点击位置）',
    ADB: '仅 ADB input tap（小米等机型）',
    ELEMENT_THEN_COORD: '元素 click + 坐标补点（易连点两次，开关/勾选勿用）'
  },
  expectState: {
    checked: '已勾选',
    unchecked: '未勾选',
    enabled: '可用',
    disabled: '禁用',
    selected: '已选中',
    unselected: '未选中'
  }
}

function optionLabel(name: string, option: string) {
  if (name === 'distance' && isHorizontalSwipe()) {
    const horizontal: Record<string, string> = {
      short: 'short（小幅，约屏宽一成多）',
      normal: 'normal（约半个屏宽）',
      long: 'long（大幅横滑）'
    }
    return horizontal[option] || option
  }
  return OPTION_LABELS[name]?.[option] || option
}

/**
 * 让 params 跟当前可见的字段对齐：
 * 可见的补上默认值（避免空值提交后走后端兜底）；被条件隐藏的直接清掉——
 * 否则会留下「界面上看不见、执行时还生效」的暗坑，那比多几个开关更难查。
 */
function syncParams() {
  if (!props.schema || !props.params) return
  for (const def of props.schema) {
    if (def.type === 'steps' || def.name === 'elementKey') continue
    if (!isVisible(def)) {
      if (props.params[def.name] !== undefined) delete props.params[def.name]
      continue
    }
    if (def.default === undefined || def.default === null) continue
    if (props.params[def.name] === undefined || props.params[def.name] === null) {
      props.params[def.name] = def.default
    }
  }
}

// renderableDefs 依赖条件字段的当前值，所以切「点击方式」时这里会跟着跑
watch(
  [() => props.schema, () => props.params, renderableDefs],
  syncParams,
  { immediate: true, deep: false }
)
</script>

<style scoped>
.param-number-block {
  width: 100%;
}
.param-number-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.param-unit {
  flex: none;
  font-size: 13px;
  color: var(--app-text-secondary);
  line-height: 32px;
  padding-right: 4px;
}
.param-bool-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
}
.param-bool-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  width: 100%;
  min-height: 32px;
}
.param-bool-title {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.4;
}
.input-with-env {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.input-with-env .el-input {
  flex: 1;
  min-width: 0;
}
.env-var-select {
  width: 240px;
  flex: none;
}
.env-page-link,
.offset-pick-link {
  margin-top: 4px;
  padding: 0;
  height: auto;
}
.element-pick-actions {
  margin-top: 4px;
}
.param-label,
.param-bool-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.param-help-icon {
  color: var(--el-text-color-disabled);
  cursor: pointer;
  font-size: 14px;
}
.param-help-icon:hover {
  color: var(--el-color-primary);
}
.param-help-pop {
  font-size: 12px;
  line-height: 1.65;
  color: var(--app-text-regular);
}
</style>
