<template>
  <div class="dp-editor">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="dp-intro"
      title="把可能出现的弹窗列在这里，出现哪个关哪个——没有弹窗属于正常，不会判失败"
    >
      <template #default>
        用来替代「为每个可选弹窗嵌一层 IF」。4 个弹窗任意组合用嵌套 IF 要写 16 条路径，
        列在这里只需要 4 项。建议把这一步放进一个组件流程，各业务流程开头调用一次，
        以后新增弹窗只改那一个组件。
      </template>
    </el-alert>

    <el-form label-width="140px" class="step-form">
      <el-form-item label="清到出现此元素">
        <el-select
          v-model="step.params.untilElementKey"
          filterable
          allow-create
          default-first-option
          clearable
          placeholder="强烈建议填，如首页标志元素"
          style="width: 100%"
        >
          <el-option
            v-for="el in elementOptions"
            :key="el.nameEn"
            :label="elementOptionLabel(el)"
            :value="el.nameEn" />
        </el-select>
        <div class="dp-tip">
          <b>不填会有坑</b>：应用刚启动时弹窗往往还没渲染出来，扫一遍必然扑空，
          于是判定「没有弹窗」继续往下走，紧接着弹窗才弹出来把后面的步骤全挡掉。<br />
          填上锚点（比如首页的某个标志元素）就会一直清到应用真的到了那个状态为止。
          二次启动时锚点一开始就在屏上，会立刻返回，不增加耗时。
        </div>
      </el-form-item>
      <el-form-item v-if="hasAnchor" label="等待锚点超时">
        <el-input-number v-model="step.params.untilTimeoutSec" :min="1" :max="300" />
        <span class="dp-tip inline">秒。超时仍未到达该元素则判失败</span>
      </el-form-item>
      <el-form-item v-if="hasAnchor" label="轮询间隔">
        <el-input-number v-model="step.params.pollIntervalMs" :min="100" :max="5000" :step="100" />
        <span class="dp-tip inline">毫秒</span>
      </el-form-item>
      <el-form-item v-if="!hasAnchor" label="最多循环轮数">
        <el-input-number v-model="step.params.maxRounds" :min="1" :max="10" />
        <span class="dp-tip inline">
          弹窗会串（关掉一个才弹下一个）；某一轮没关掉任何东西就提前结束，不会空转
        </span>
      </el-form-item>
      <el-form-item v-if="!hasAnchor" label="轮数用尽仍有弹窗">
        <el-switch v-model="step.params.failIfStillPresent" />
        <span class="dp-tip inline">
          打开则判失败；默认只记告警并继续，避免清理弹窗这种辅助动作拖垮主流程
        </span>
      </el-form-item>
    </el-form>

    <div class="dp-list-head">
      <span class="dp-list-title">弹窗列表（{{ popups.length }}）</span>
      <el-button type="primary" plain size="small" @click="addPopup">+ 增加一个弹窗</el-button>
    </div>

    <div v-if="!popups.length" class="dp-empty">
      还没有配置弹窗。请把「同意」「我知道了」「关闭 ✕」这类**关掉弹窗的按钮**加进来。
    </div>

    <div v-for="(p, pi) in popups" :key="p._key || 'p-' + pi" class="dp-item">
      <div class="dp-item-head">
        <span class="dp-idx">{{ pi + 1 }}</span>
        <span class="dp-name">{{ p.label || p.elementKey || '未命名弹窗' }}</span>
        <span class="dp-spacer" />
        <el-button link size="small" :disabled="pi === 0" @click="movePopup(pi, -1)">上移</el-button>
        <el-button
          link
          size="small"
          :disabled="pi === popups.length - 1"
          @click="movePopup(pi, 1)"
        >下移</el-button>
        <el-button type="danger" link size="small" @click="removePopup(pi)">删除</el-button>
      </div>

      <el-form label-width="140px" class="step-form">
        <el-form-item label="关闭它的元素" required>
          <el-select
            v-model="p.elementKey"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="选「同意」「我知道了」「关闭」等按钮元素"
            style="width: 100%"
          >
            <el-option
              v-for="el in elementOptions"
              :key="el.nameEn"
              :label="elementOptionLabel(el)"
              :value="el.nameEn" />
          </el-select>
          <div class="dp-tip">
            填的是<b>点了能关掉弹窗的那个元素</b>，不是弹窗容器——执行时探测到它就直接点它
          </div>
        </el-form-item>
        <el-form-item label="弹窗名">
          <el-input v-model="p.label" maxlength="40" placeholder="如：温馨提示 / 升级提示 / 青少年模式" />
          <div class="dp-tip">只用于执行日志，方便回头看这次关了哪些弹窗</div>
        </el-form-item>
      </el-form>
    </div>

    <div class="element-pick-actions">
      <el-button link @click="emit('refresh-elements')">刷新元素列表</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type FlowStep = {
  keywordCode: string
  params: Record<string, any>
}

type PopupItem = {
  _key?: string
  elementKey?: string
  label?: string
}

const props = defineProps<{
  step: FlowStep
  elementOptions: any[]
}>()

const emit = defineEmits<{
  'refresh-elements': []
}>()

const hasAnchor = computed(() => !!String(props.step.params.untilElementKey || '').trim())

const popups = computed<PopupItem[]>(() => {
  if (!Array.isArray(props.step.params.popups)) {
    props.step.params.popups = []
  }
  return props.step.params.popups
})

function newKey() {
  return `dp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function elementOptionLabel(el: any) {
  const zh = String(el?.nameZh || '').trim()
  const en = String(el?.nameEn || '').trim()
  if (zh && en) return `${zh}（${en}）`
  return zh || en || '—'
}

function addPopup() {
  popups.value.push({ _key: newKey(), elementKey: '', label: '' })
}

function removePopup(pi: number) {
  popups.value.splice(pi, 1)
}

function movePopup(pi: number, delta: number) {
  const to = pi + delta
  if (to < 0 || to >= popups.value.length) return
  const next = popups.value.slice()
  const [item] = next.splice(pi, 1)
  next.splice(to, 0, item)
  props.step.params.popups = next
}
</script>

<style scoped>
.dp-editor {
  margin-top: 8px;
}
.dp-intro {
  margin-bottom: 12px;
}
.dp-list-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.dp-list-title {
  font-weight: 700;
}
.dp-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  padding: 12px;
  border: 1px dashed var(--el-border-color, var(--app-border));
  border-radius: 8px;
  margin-bottom: 12px;
}
.dp-item {
  border: 1px solid var(--el-border-color-lighter, var(--app-border));
  border-left: 4px solid #f59e0b;
  background: rgba(245, 158, 11, 0.04);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.dp-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dp-idx {
  font-size: 12px;
  font-weight: 800;
  color: #d97706;
  background: rgba(245, 158, 11, 0.14);
  border-radius: 4px;
  padding: 2px 8px;
}
.dp-name {
  font-weight: 700;
  font-size: 13px;
}
.dp-spacer {
  flex: 1;
}
.dp-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  line-height: 1.6;
}
.dp-tip.inline {
  display: inline;
  margin-left: 8px;
}
.element-pick-actions {
  margin-top: 4px;
}
</style>
