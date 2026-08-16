<template>
  <el-config-provider :locale="locale">
    <router-view v-if="ready" />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { apiClient } from './api'

const locale = ref(zhCn)
const ready = ref(false)

onMounted(async () => {
  try {
    const api = window.electronAPI
    if (api?.isPackaged) {
      const packaged = await api.isPackaged()
      if (packaged) {
        const cfg = await api.getNodeConfig()
        if (cfg.controlPlaneUrl && !/127\.0\.0\.1|localhost|::1/i.test(cfg.controlPlaneUrl)) {
          apiClient.setBaseUrl(cfg.controlPlaneUrl)
        }
        if (cfg.workerUrl) apiClient.setWorkerBaseUrl(cfg.workerUrl)
      }
    }
  } finally {
    ready.value = true
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/*
 * macOS Electron hiddenInset：顶栏 header 使用了 -webkit-app-region: drag。
 * 抽屉/对话框若叠在顶部，× 落在拖拽区里会点不动。弹层必须显式 no-drag。
 */
.el-overlay,
.el-overlay-dialog,
.el-drawer,
.el-drawer__header,
.el-drawer__body,
.el-drawer__footer,
.el-drawer__close-btn,
.el-dialog,
.el-dialog__header,
.el-dialog__body,
.el-dialog__footer,
.el-dialog__headerbtn,
.el-message-box,
.el-message-box__header,
.el-message-box__btns,
.el-popup-parent--hidden {
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
}
</style>
