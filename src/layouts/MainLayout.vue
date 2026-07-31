<template>
  <el-container class="main-layout">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <h2>移动自动化</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/home">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/devices">
          <el-icon><Monitor /></el-icon>
          <span>设备管理</span>
        </el-menu-item>
        <el-menu-item index="/specialized-testing">
          <el-icon><Grid /></el-icon>
          <span>专项测试</span>
        </el-menu-item>
        <el-menu-item index="/app-online-regression">
          <el-icon><Cellphone /></el-icon>
          <span>APP线上回归</span>
        </el-menu-item>
        <el-menu-item index="/release-doc">
          <el-icon><Document /></el-icon>
          <span>发版文档与邮件</span>
        </el-menu-item>
        <el-menu-item index="/tracking-check">
          <el-icon><DataAnalysis /></el-icon>
          <span>埋点校验</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <span>测试任务</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><Document /></el-icon>
          <span>测试报告</span>
        </el-menu-item>
        <el-menu-item index="/performance">
          <el-icon><DataAnalysis /></el-icon>
          <span>性能监控</span>
        </el-menu-item>
        <el-sub-menu index="ui-assets">
          <template #title>
            <el-icon><DocumentCopy /></el-icon>
            <span>资产编排</span>
          </template>
          <el-menu-item index="/ui-apps">应用字典</el-menu-item>
          <el-menu-item index="/ui-elements">元素库</el-menu-item>
          <el-menu-item index="/ui-keywords">关键字库</el-menu-item>
          <el-menu-item index="/ui-flows">流程编排</el-menu-item>
          <el-menu-item index="/page-objects">页面对象(旧)</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/automation-test">
          <el-icon><VideoPlay /></el-icon>
          <span>自动化测试</span>
        </el-menu-item>
        <el-menu-item index="/codewords-agent">
          <el-icon><ChatDotRound /></el-icon>
          <span>俊俊 AI 助手</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h3>{{ currentTitle }}</h3>
        </div>
      </el-header>
      <el-main class="main-content" :class="{ 'is-agent': isAgentPage }">
        <router-view :key="route.fullPath" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled,
  Monitor,
  List,
  Document,
  DocumentCopy,
  DataAnalysis,
  Setting,
  Grid,
  VideoPlay,
  Cellphone,
  ChatDotRound
} from '@element-plus/icons-vue'

const route = useRoute()

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/ui-') || p.startsWith('/page-objects')) return p
  return p
})
const currentTitle = computed(() => route.meta?.title || '移动自动化测试')
const isAgentPage = computed(() => route.path.includes('codewords-agent'))
</script>

<style scoped>
.main-layout {
  height: 100vh;
  background-color: #f0f2f5;
}

.sidebar {
  background-color: #304156;
  height: 100vh;
  overflow-y: auto;
}

/* 无系统标题栏时（如 macOS hiddenInset），通过可拖动区域移动窗口 */
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background-color: #2b3a4a;
  border-bottom: 1px solid #1f2d3d;
  -webkit-app-region: drag;
  app-region: drag;
}

.logo h2 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  -webkit-app-region: drag;
  app-region: drag;
}

.header-content h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #303133;
}

.main-content {
  padding: 20px;
  overflow-y: auto;
}

.main-content.is-agent {
  padding: 0;
  overflow: hidden;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: #3d4a5c transparent;
}

.main-content.is-agent::-webkit-scrollbar,
.main-content.is-agent ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.main-content.is-agent::-webkit-scrollbar-track,
.main-content.is-agent ::-webkit-scrollbar-track {
  background: transparent;
}
.main-content.is-agent::-webkit-scrollbar-thumb,
.main-content.is-agent ::-webkit-scrollbar-thumb {
  background: #3d4a5c;
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.main-content.is-agent::-webkit-scrollbar-thumb:hover,
.main-content.is-agent ::-webkit-scrollbar-thumb:hover {
  background: #5a6a7e;
}

.main-content.is-agent :deep(.xk-shell) {
  flex: 1;
  min-height: 0;
  height: 100%;
}
</style>
