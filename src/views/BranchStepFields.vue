<template>
  <el-form label-width="90px" class="step-form">
    <el-form-item v-if="needsElement" label="元素英文名">
      <el-select
        v-model="step.elementKey"
        filterable
        allow-create
        default-first-option
        clearable
        placeholder="从元素库选或手输 nameEn"
        style="width: 100%"
      >
        <el-option
          v-for="el in elementOptions"
          :key="el.nameEn"
          :label="`${el.nameZh} (${el.nameEn})`"
          :value="el.nameEn" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'INPUT'" label="输入内容">
      <el-input v-model="step.params.text" placeholder="如手机号或验证码" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'WAIT'" label="延迟毫秒">
      <el-input-number v-model="step.params.durationMs" :min="0" :step="500" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'WAIT_ELEMENT'" label="等待类型">
      <el-select v-model="step.params.waitType" style="width: 100%">
        <el-option label="Presence" value="Presence" />
        <el-option label="Visible" value="Visible" />
        <el-option label="Clickable" value="Clickable" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'WAIT_ELEMENT'" label="超时秒">
      <el-input-number v-model="step.params.timeoutSec" :min="1" :max="120" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'SWIPE'" label="方向">
      <el-select v-model="step.params.direction" style="width: 100%">
        <el-option label="up" value="up" />
        <el-option label="down" value="down" />
        <el-option label="left" value="left" />
        <el-option label="right" value="right" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'ASSERT_TEXT'" label="期望文案">
      <el-input v-model="step.params.expected" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'LAUNCH_APP'" label="包名/Bundle">
      <el-input v-model="step.params.packageName" placeholder="可选" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'LAUNCH_APP'" label="Activity">
      <el-input v-model="step.params.activity" placeholder="可选" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'SCREENSHOT'" label="备注">
      <el-input v-model="step.params.label" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'CALL_COMPONENT'" label="组件流程ID">
      <el-input v-model="step.params.flowId" />
    </el-form-item>
    <el-form-item v-if="step.keywordCode === 'RETURN_MESSAGE'" label="提示文案">
      <el-input
        v-model="step.params.message"
        type="textarea"
        :rows="2"
        maxlength="500"
        show-word-limit
        placeholder="手动输入要返回的提示" />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
defineProps<{
  step: {
    keywordCode: string
    elementKey?: string
    params: Record<string, any>
  }
  elementOptions: any[]
  needsElement: boolean
}>()
</script>

<style scoped>
.step-form {
  margin-top: 4px;
}
</style>
