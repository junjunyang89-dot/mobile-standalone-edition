<template>
  <div class="settings">
    <el-card>
      <template #header>
        <span>应用设置</span>
      </template>
      <el-form :model="settings" label-width="150px">
        <el-form-item label="数据目录">
          <el-input v-model="settings.dataDir" disabled />
        </el-form-item>
        <el-form-item label="报告目录">
          <el-input v-model="settings.reportsDir" disabled />
        </el-form-item>
        <el-form-item label="Java路径">
          <el-input v-model="settings.javaPath" />
        </el-form-item>
        <el-form-item label="Maven路径">
          <el-input v-model="settings.mavenPath" />
        </el-form-item>
        <el-form-item label="设备扫描间隔（秒）">
          <el-input-number v-model="settings.scanInterval" :min="1" :max="60" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const settings = ref({
  dataDir: '',
  reportsDir: '',
  javaPath: '',
  mavenPath: '',
  scanInterval: 3
})

onMounted(() => {
  loadSettings()
})

const loadSettings = () => {
  // 从数据库加载设置
  // 这里简化处理
  settings.value.dataDir = '用户数据目录/data'
  settings.value.reportsDir = '用户数据目录/reports'
}

const saveSettings = () => {
  // 保存设置到数据库
  ElMessage.success('设置已保存')
}
</script>

<style scoped>
.settings {
  width: 100%;
}
</style>
