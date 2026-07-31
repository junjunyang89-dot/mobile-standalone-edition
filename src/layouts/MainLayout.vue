<template>
  <el-container class="main-layout">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <h2>移动自动化</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        :default-openeds="defaultOpeneds"
        router
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <div class="nav-section-label">主菜单</div>
        <el-menu-item index="/home">
          <el-icon><HomeFilled /></el-icon><span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/codewords-agent">
          <el-icon><ChatDotRound /></el-icon><span>AI助手</span>
        </el-menu-item>

        <div class="nav-section-label">资产管理</div>
        <el-sub-menu index="asset-app">
          <template #title>
            <el-icon><Cellphone /></el-icon>
            <span>APP</span>
          </template>
          <el-menu-item index="/devices">
            <el-icon><Monitor /></el-icon>
            <span>设备管理</span>
          </el-menu-item>
          <el-menu-item index="/ui-apps">
            <el-icon><DocumentCopy /></el-icon>
            <span>应用字典</span>
          </el-menu-item>
          <el-menu-item index="/ui-keywords">
            <el-icon><Document /></el-icon>
            <span>关键字库</span>
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            <span>测试用例</span>
          </el-menu-item>
          <el-menu-item index="/ui-elements">
            <el-icon><Grid /></el-icon>
            <span>元素管理</span>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/page-objects">
          <el-icon><DocumentCopy /></el-icon><span>页面对象(旧)</span>
        </el-menu-item>

        <div class="nav-section-label">功能测试</div>
        <el-sub-menu index="func-app">
          <template #title>
            <el-icon><Cellphone /></el-icon>
            <span>APP</span>
          </template>
          <el-menu-item index="/ui-flows">
            <el-icon><List /></el-icon>
            <span>流程编排</span>
          </el-menu-item>
          <el-menu-item index="/specialized-testing">
            <el-icon><VideoPlay /></el-icon>
            <span>专项测试</span>
          </el-menu-item>
        </el-sub-menu>

        <div class="nav-section-label">回归测试</div>
        <el-menu-item index="/app-online-regression">
          <el-icon><Cellphone /></el-icon><span>APP线上回归</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><Document /></el-icon><span>测试报告</span>
        </el-menu-item>

        <div class="nav-section-label">性能测试</div>
        <el-sub-menu index="perf-app">
          <template #title>
            <el-icon><Cellphone /></el-icon>
            <span>APP</span>
          </template>
          <el-menu-item index="/performance">
            <el-icon><DataAnalysis /></el-icon>
            <span>性能监控</span>
          </el-menu-item>
        </el-sub-menu>

        <div class="nav-section-label">其他</div>
        <el-menu-item index="/tracking-check">
          <el-icon><DataAnalysis /></el-icon><span>埋点校验</span>
        </el-menu-item>
        <el-menu-item index="/release-doc">
          <el-icon><Document /></el-icon><span>发版文档</span>
        </el-menu-item>
        <el-menu-item index="/automation-test">
          <el-icon><VideoPlay /></el-icon><span>自动化测试</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon><span>设置</span>
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
  if (p.startsWith('/devices')) return '/devices'
  if (p.startsWith('/automation-test')) return '/automation-test'
  if (p.startsWith('/performance')) return '/performance'
  if (p.startsWith('/ui-') || p.startsWith('/page-objects')) return p
  return p
})

const defaultOpeneds = computed(() => {
  return ['perf-app', 'asset-app', 'func-app']
})

const titleMap: Record<string, string> = {
  '/home': '工作台',
  '/codewords-agent': 'AI助手',
  '/ui-elements': '元素管理',
  '/tasks': '测试用例',
  '/devices': '设备管理',
  '/performance': '性能监控'
}

const currentTitle = computed(() => {
  const p = route.path
  if (titleMap[p]) return titleMap[p]
  return (route.meta?.title as string) || '移动自动化测试'
})
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
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.sidebar::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

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
  padding-bottom: 16px;
}

/* 一级：分组下的菜单 / 子菜单标题（相对分组缩进） */
.sidebar-menu > :deep(.el-menu-item),
.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title) {
  font-size: 14px !important;
  height: 44px;
  line-height: 44px;
  margin: 2px 8px;
  border-radius: 6px;
  padding-left: 16px !important;
}

.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title) {
  font-weight: 500;
  color: #d0d7de !important;
}

.sidebar-menu > :deep(.el-sub-menu.is-active > .el-sub-menu__title),
.sidebar-menu > :deep(.el-sub-menu.is-opened > .el-sub-menu__title) {
  color: #409eff !important;
  background: rgba(64, 158, 255, 0.08) !important;
}

/* 二级：APP 下的子项 — 缩进区分层级 */
.sidebar-menu :deep(.el-sub-menu .el-menu) {
  background-color: transparent !important;
  padding: 0 0 4px;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  font-size: 13px !important;
  height: 40px !important;
  line-height: 40px !important;
  min-width: auto;
  margin: 1px 8px;
  border-radius: 6px;
  padding-left: 36px !important;
  color: #a8b3c0 !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #e8eef4 !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item.is-active) {
  background: rgba(64, 158, 255, 0.15) !important;
  color: #409eff !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item .el-icon) {
  font-size: 14px;
  margin-right: 6px;
}

.nav-section-label {
  color: #9aa8b8 !important;
  font-size: 12px !important;
  font-weight: 600 !important;
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
  background-color: #f0f2f5;
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
