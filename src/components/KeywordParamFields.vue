<template>
  <template v-for="def in renderableDefs" :key="def.name">
    <el-form-item
      :label="def.type === 'boolean' ? '' : displayLabel(def)"
      :required="def.required"
      :label-width="def.type === 'boolean' ? '0px' : undefined"
      :class="{ 'param-bool-item': def.type === 'boolean' }"
    >
      <el-input
        v-if="def.type === 'string'"
        v-model="params[def.name]"
        :placeholder="def.help || ''"
      />

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
            :step="numberStep(def)"
          />
          <span v-if="numberUnit(def)" class="param-unit">{{ numberUnit(def) }}</span>
        </div>
        <div v-if="def.help" class="param-help">{{ def.help }}</div>
      </div>

      <template v-else-if="def.type === 'boolean'">
        <div class="param-bool-block">
          <span class="param-bool-title">{{ def.label || def.name }}</span>
          <el-switch v-model="params[def.name]" />
          <span v-if="def.help" class="param-help inline">{{ def.help }}</span>
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

      <!-- 次级元素（如「不符时点哪个元素」）：主元素由外层步骤表单渲染，这里只管额外的 -->
      <el-select
        v-else-if="def.type === 'element'"
        v-model="params[def.name]"
        filterable
        allow-create
        default-first-option
        clearable
        placeholder="按中文名搜索选择元素（留空则点自己）"
        style="width: 100%"
      >
        <el-option
          v-for="el in elementOptions || []"
          :key="el.nameEn"
          :label="el.nameZh ? `${el.nameZh}（${el.nameEn}）` : el.nameEn"
          :value="el.nameEn"
        />
      </el-select>

      <el-input v-else v-model="params[def.name]" />

      <div
        v-if="def.help && def.type !== 'number' && def.type !== 'boolean'"
        class="param-help"
      >{{ def.help }}</div>
    </el-form-item>
  </template>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

/**
 * 按后端 ui_keywords.param_schema 渲染步骤参数表单。
 *
 * 后端 KeywordHandler 是参数的唯一来源，这里不硬编码任何关键字——新增关键字前端零改动。
 * 元素（element）与嵌套步骤（steps）由外层专门处理，这里跳过。
 */

export interface ParamDefDto {
  name: string
  label: string
  type: 'string' | 'textarea' | 'number' | 'boolean' | 'enum' | 'element' | 'steps'
  required?: boolean
  default?: string | number | boolean
  options?: string[]
  help?: string
  /** 显示条件：同步骤里 param 取到 values 之一时才渲染 */
  showWhen?: { param: string; values: string[] }
}

const props = defineProps<{
  /** 关键字的 paramSchema（已解析成数组） */
  schema: ParamDefDto[]
  /** 步骤的 params 对象，直接双向绑定 */
  params: Record<string, any>
  /** 供次级元素参数（如「不符时点哪个元素」）下拉用；主元素由外层渲染 */
  elementOptions?: Array<{ nameEn: string; nameZh?: string }>
}>()

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
  return /ms$/i.test(def.name) || /毫秒/.test(def.label || '') ? 100 : 1
}

/** 标签去掉单位词，单位放到输入框后；顺带把「失败重试次数」收成「失败重试」避免 label 列挤换行 */
function displayLabel(def: ParamDefDto) {
  const label = def.label || def.name
  if (def.type !== 'number') return label
  return label
    .replace(/次数$/u, '')
    .replace(/(毫秒|秒)$/u, '')
    .trim() || label
}

function numberUnit(def: ParamDefDto): string {
  if (def.name === 'retryTimes' || /times$/i.test(def.name) || /次数$/.test(def.label || '') || def.label === '失败重试') {
    return '次'
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
  return ''
}

/** 少数枚举给中文说明，其余直接显示原值 */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  direction: {
    up: 'up（上滑，内容往下翻）',
    down: 'down（下滑）',
    left: 'left（左滑）',
    right: 'right（右滑）'
  },
  clickMethod: {
    AUTO: '自动（勾选单次；登录等按钮 iOS 可补点）',
    ELEMENT: '仅元素 click（适合抽屉/开关/勾选，只点一次）',
    COORDINATE: '仅中心坐标 W3C',
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
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.4;
  letter-spacing: 0.02em;
}
.param-help {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.55;
  max-width: 100%;
}
.param-help.inline {
  margin-top: 0;
  flex: 1;
  min-width: 160px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  line-height: 1.45;
}
</style>
