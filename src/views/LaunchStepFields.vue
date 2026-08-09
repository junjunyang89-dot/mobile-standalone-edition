<template>
  <el-form-item label="启动应用" required>
    <el-select
      :model-value="selectedAppId"
      filterable
      clearable
      :placeholder="isIos ? '从应用字典选择（写入 BundleId）' : '从应用字典选择要启动的包'"
      style="width: 100%"
      @change="(id: string | null) => onAppChange(id || '')"
    >
      <el-option
        v-for="a in appOptions"
        :key="a.id"
        :label="appExecLabel(a)"
        :value="a.id" />
    </el-select>
  </el-form-item>

  <el-form-item :label="isIos ? 'BundleId' : 'appPackage'" required>
    <el-input
      v-model="step.params.packageName"
      :placeholder="isIos ? 'iOS BundleId，可留空用流程绑定应用' : 'appium:appPackage，可手改'"
    />
  </el-form-item>

  <!-- appActivity 只有 Android 用得上；iOS 走 BundleId + WDA forceAppLaunch，填了也不读 -->
  <el-form-item v-if="!isIos && !isHotStart" label="appActivity">
    <el-input
      v-model="step.params.activity"
      placeholder="appium:appActivity，如 .ui.activity.launcher.LauncherActivity"
    />
    <div class="launch-hint">
      建议填。留空时会退回 ADB monkey 拉起 launcher，能力受限且不一定进对页面
    </div>
  </el-form-item>

  <el-form-item v-if="isHotStart" label="后台停留">
    <el-input-number v-model="step.params.backgroundMs" :min="500" :max="30000" :step="500" />
    <span class="launch-hint inline">毫秒</span>
  </el-form-item>

  <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px" :title="hintText" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 启动 / 冷启动 / 热启动 步骤的表单。
 *
 * 关键字已按平台合并，是否显示 appActivity 要看**流程的平台**而不是关键字名——
 * 之前照搬 Android 表单，导致 iOS 冷启动也被要求填 appActivity。
 */

type FlowStep = {
  keywordCode: string
  params: Record<string, any>
}

const props = defineProps<{
  step: FlowStep
  appOptions: any[]
  /** 流程平台，如 ANDROID / IOS */
  platform?: string
}>()

const emit = defineEmits<{
  /** 选了应用字典条目：父级据此回填流程的应用/平台并刷新元素列表 */
  'app-selected': [appId: string, packageName: string, ios: boolean]
}>()

/** 平台优先看流程设置；存量流程用的是 *_IOS 旧关键字，也认 */
const isIos = computed(() => {
  const byPlatform = String(props.platform || '').toUpperCase().includes('IOS')
  const byLegacyCode = String(props.step.keywordCode || '').toUpperCase().endsWith('_IOS')
  return byPlatform || byLegacyCode
})

const isHotStart = computed(() =>
  String(props.step.keywordCode || '').toUpperCase().startsWith('HOT_START')
)

const hintText = computed(() => {
  if (isHotStart.value) {
    return '热启动：不杀进程；Home 进后台停留后再拉回前台并记录耗时。Android / iOS 通用。'
  }
  if (String(props.step.keywordCode || '').toUpperCase().startsWith('COLD_START')) {
    return isIos.value
      ? '冷启动 · iOS：terminateApp 后再启动，并记录耗时（不需要 appActivity）。'
      : '冷启动 · Android：先 force-stop 再启动，并记录耗时。'
  }
  return isIos.value
    ? '启动应用 · iOS：Appium + WDA forceAppLaunch（不需要 appActivity）。'
    : '启动应用 · Android：会先 force-stop（偏冷启）。'
})

function packageFromApp(appId: string, ios: boolean) {
  const a = props.appOptions.find((x) => x.id === appId)
  if (!a) return ''
  return (ios ? a.iosBundleId : a.androidPackage) || a.androidPackage || a.iosBundleId || ''
}

function matchAppIdByPackage(pkg: string) {
  const p = String(pkg || '').trim()
  if (!p) return ''
  return props.appOptions.find((a) => a.androidPackage === p || a.iosBundleId === p)?.id || ''
}

const selectedAppId = computed(
  () => props.step.params?.appId || matchAppIdByPackage(props.step.params?.packageName) || ''
)

function appExecLabel(a: any) {
  const pkg = a?.androidPackage || a?.iosBundleId || ''
  return pkg ? `${a.nameZh} · ${pkg}` : `${a.nameZh} (${a.id})`
}

function onAppChange(appId: string) {
  if (!appId) {
    props.step.params.appId = ''
    return
  }
  const ios = isIos.value
  const pkg = packageFromApp(appId, ios)
  props.step.params.appId = appId
  props.step.params.packageName = pkg
  // iOS 不用 Activity，选完应用顺手清掉，避免残留脏数据
  if (ios && props.step.params.activity != null) {
    delete props.step.params.activity
  }
  emit('app-selected', appId, pkg, ios)
}
</script>

<style scoped>
.launch-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary, var(--el-text-color-placeholder));
  line-height: 1.6;
}
.launch-hint.inline {
  display: inline;
  margin-top: 0;
  margin-left: 8px;
}
</style>
