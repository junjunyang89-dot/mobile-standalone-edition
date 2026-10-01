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

/**
 * 本机执行节点活着吗。1.5 秒拿不到答复就当没活。
 *
 * 超时必须短：这在应用启动路径上，多等一秒就是所有人每次开应用都多等一秒。
 * 而「没活」是个完全正常的状态（手机插在 Mac Studio 上时本机不需要 worker），
 * 不该为一个正常状态付启动时间。
 */
async function workerAlive(workerUrl: string): Promise<boolean> {
  try {
    const base = workerUrl.replace(/\/+$/, '')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1500)
    try {
      const res = await fetch(`${base}/health`, { signal: ctrl.signal })
      return res.ok
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

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
        // 只有本机 worker 确实活着才把设备/执行类请求指向它。
        //
        // 原先是无条件 setWorkerBaseUrl(cfg.workerUrl)，而 workerUrl 恒为
        // http://127.0.0.1:3001/api。于是在没有本机 worker 的机器上（Windows 用户没装
        // JDK 17 就是这种情况），/devices 全部请求和「执行流程」都打向一个不存在的本机端口，
        // 设备管理页和执行功能直接是死的 —— 而手机本来就插在 Mac Studio 上，
        // 压根不需要本机当执行节点。
        //
        // 探活用 1.5 秒超时的直连 fetch，不走 node:worker-status ——
        // 后者内部会「顺便把 worker 拉起来」并死等 45 秒，放在启动路径上会让人以为应用卡死。
        if (cfg.workerUrl && (await workerAlive(cfg.workerUrl))) {
          apiClient.setWorkerBaseUrl(cfg.workerUrl)
        } else if (cfg.controlPlaneUrl) {
          // 退回控制面：设备和执行都由那台后端负责，这也是设备池的实际形态
          apiClient.setWorkerBaseUrl(cfg.controlPlaneUrl)
        }
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
  font-family: var(--app-font-family);
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
