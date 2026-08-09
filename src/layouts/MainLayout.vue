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
        background-color="#1d2740"
        text-color="#bfcbd9"
        active-text-color="#1890ff"
      >
        <el-sub-menu index="main">
          <template #title>
            <el-icon><HomeFilled /></el-icon>
            <span>主菜单</span>
          </template>
          <el-menu-item index="/home">工作台</el-menu-item>
          <el-menu-item index="/tasks">APP测试任务</el-menu-item>
          <el-menu-item index="/codewords-agent">AI助手</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="test-cases">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>测试用例</span>
          </template>
          <el-menu-item
            v-for="suite in TEST_CASE_SUITES"
            :key="suite.key"
            :index="`/test-cases/${suite.key}`"
            :title="suite.fullTitle || suite.title"
          >
            {{ suite.title }}
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="assets">
          <template #title>
            <el-icon><DocumentCopy /></el-icon>
            <span>资产管理</span>
          </template>
          <el-menu-item index="/api-projects">项目管理</el-menu-item>
          <el-menu-item index="/api-urls">URL 管理</el-menu-item>
          <el-sub-menu index="asset-app">
            <template #title>
              <span>完美世界电竞</span>
            </template>
            <el-menu-item index="/devices">设备管理</el-menu-item>
            <el-menu-item index="/ui-apps">应用字典</el-menu-item>
            <el-menu-item index="/ui-keywords">关键字库</el-menu-item>
            <el-menu-item index="/ui-elements">元素管理</el-menu-item>
            <el-menu-item index="/ui-inspector-import">Inspector XML 导入</el-menu-item>
            <el-menu-item index="/ui-h5-pages">H5 页面</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu index="func-test">
          <template #title>
            <el-icon><VideoPlay /></el-icon>
            <span>功能测试</span>
          </template>
          <el-sub-menu index="func-app">
            <template #title>
              <span>完美世界电竞</span>
            </template>
            <el-menu-item index="/ui-flows">流程编排</el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/web-test">Web 端测试</el-menu-item>
          <el-sub-menu index="func-api">
            <template #title>
              <span>接口测试</span>
            </template>
            <el-menu-item index="/api-testing">概览</el-menu-item>
            <el-menu-item index="/api-collections">用例集合</el-menu-item>
            <el-menu-item index="/api-test">接口列表</el-menu-item>
            <el-menu-item index="/api-environments">环境变量</el-menu-item>
            <el-menu-item index="/api-schedules">定时执行</el-menu-item>
            <el-menu-item index="/api-reports">执行报告</el-menu-item>
            <el-menu-item index="/api-changes">接口对比分析</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu index="regression">
          <template #title>
            <el-icon><Cellphone /></el-icon>
            <span>回归测试</span>
          </template>
          <el-menu-item index="/app-online-regression">APP回归</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="reports">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>测试报告</span>
          </template>
          <el-menu-item index="/reports">APP UI测试报告</el-menu-item>
          <el-sub-menu index="reports-esports">
            <template #title>
              <span>完美世界电竞</span>
            </template>
            <el-menu-item index="/reports/esports/performance">性能报告</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu index="perf-test">
          <template #title>
            <el-icon><DataAnalysis /></el-icon>
            <span>性能测试</span>
          </template>
          <el-sub-menu index="perf-app">
            <template #title>
              <span>完美世界电竞</span>
            </template>
            <el-menu-item index="/performance-baseline">安卓性能测试</el-menu-item>
            <el-menu-item index="/special-report">版本质量卡</el-menu-item>
            <el-menu-item index="/performance">性能监控</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu index="knowledge-handbook">
          <template #title>
            <el-icon><Notebook /></el-icon>
            <span>知识手册</span>
          </template>
          <el-sub-menu v-for="g in HANDBOOK_GROUPS" :key="g.id" :index="`kh-${g.id}`">
            <template #title>
              <span>{{ g.label }}</span>
            </template>
            <el-menu-item
              v-for="c in g.categories"
              :key="c.code"
              :index="`/knowledge-handbook?category=${c.code}`"
            >
              {{ c.label }}
            </el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu index="other">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>其他</span>
          </template>
          <el-menu-item index="/tracking-check">埋点校验</el-menu-item>
          <el-menu-item index="/release-doc">发版文档</el-menu-item>
          <el-menu-item index="/change-review">周改动漏测</el-menu-item>
          <el-menu-item index="/settings">设置</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h3>{{ currentTitle }}</h3>
        </div>
      </el-header>
      <el-main
        class="main-content"
        :class="{ 'is-agent': isAgentPage, 'is-test-cases': isTestCasesPage }"
      >
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
  DocumentCopy,
  Document,
  DataAnalysis,
  Setting,
  VideoPlay,
  Cellphone,
  Notebook
} from '@element-plus/icons-vue'
import { findTestCaseSuite, TEST_CASE_SUITES } from '../constants/testCaseSuites'
import { HANDBOOK_GROUPS, handbookCategoryLabel, handbookGroupIdForCategory, normalizeHandbookCategory } from '../constants/handbookCategories'

const route = useRoute()

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/knowledge-handbook')) {
    const cat = String(route.query.category || 'app')
    return `/knowledge-handbook?category=${normalizeHandbookCategory(cat)}`
  }
  if (p.startsWith('/devices')) return '/devices'
  if (p.startsWith('/performance-baseline')) return '/performance-baseline'
  if (p.startsWith('/performance')) return '/performance'
  if (p.startsWith('/reports/esports/performance')) return '/reports/esports/performance'
  if (p.startsWith('/reports')) return '/reports'
  if (p.startsWith('/ui-')) return p
  return p
})

const defaultOpeneds = computed(() => {
  const p = route.path
  if (
    p.startsWith('/home') ||
    p.startsWith('/tasks') ||
    p.includes('codewords-agent')
  ) {
    return ['main']
  }
  if (p.startsWith('/test-cases') || p.startsWith('/ai-test-cases')) {
    return ['test-cases']
  }
  if (p.startsWith('/api-projects') || p.startsWith('/api-urls')) {
    return ['assets']
  }
  if (
    p.startsWith('/devices') ||
    p.startsWith('/ui-apps') ||
    p.startsWith('/ui-keywords') ||
    p.startsWith('/ui-elements') ||
    p.startsWith('/ui-inspector-import') ||
    p.startsWith('/ui-h5-pages')
  ) {
    return ['assets', 'asset-app']
  }
  if (p.startsWith('/ui-flows')) {
    return ['func-test', 'func-app']
  }
  if (p.startsWith('/web-test')) {
    return ['func-test']
  }
  // 接口测试下所有页面都以 /api- 开头（列表、集合、环境变量、定时、报告、对比分析）。
  // 逐个列前缀的话，每加一个页面就会漏一次——现象是「点进去侧栏自己收起来了」，很难联想到是这里
  if (p.startsWith('/api-')) {
    return ['func-test', 'func-api']
  }
  if (p.startsWith('/app-online-regression')) {
    return ['regression']
  }
  if (p.startsWith('/reports/esports')) {
    return ['reports', 'reports-esports']
  }
  if (p.startsWith('/reports')) {
    return ['reports']
  }
  if (p.startsWith('/performance-baseline') || p.startsWith('/performance')) {
    return ['perf-test', 'perf-app']
  }
  if (p.startsWith('/knowledge-handbook')) {
    const cat = String(route.query.category || 'app')
    return ['knowledge-handbook', handbookGroupIdForCategory(cat)]
  }
  if (
    p.startsWith('/settings') ||
    p.startsWith('/tracking-check') ||
    p.startsWith('/release-doc') ||
    p.startsWith('/change-review')
  ) {
    return ['other']
  }
  return ['main', 'assets', 'asset-app']
})

const titleMap: Record<string, string> = {
  '/home': '工作台',
  '/tasks': 'APP测试任务',
  '/codewords-agent': 'AI助手',
  '/ui-elements': '元素管理',
  '/ui-inspector-import': 'Inspector XML 导入',
  '/ui-h5-pages': 'H5 页面',
  '/api-projects': '项目管理',
  '/api-urls': 'URL 管理',
  '/devices': '设备管理',
  '/reports': 'APP UI测试报告',
  '/reports/esports/performance': '完美世界电竞 · 性能报告',
  '/performance': '性能监控',
  '/performance-baseline': '安卓性能测试',
  '/special-report': '版本质量卡',
  '/release-doc': '发版文档与邮件管理',
  '/change-review': '本周改动 / 漏测看板',
  '/web-test': 'Web 端测试',
  '/api-testing': '概览',
  '/api-test': '接口列表',
  '/api-collections': '用例集合',
  '/api-schedules': '定时执行',
  '/api-reports': '执行报告',
  '/api-environments': '环境变量',
  '/api-changes': '接口对比分析',
  '/knowledge-handbook': '知识手册'
}

const currentTitle = computed(() => {
  const p = route.path
  if (p.startsWith('/test-cases/')) {
    const key = String(route.params.category || '')
    const suite = findTestCaseSuite(key)
    return suite?.fullTitle || suite?.title || '测试用例'
  }
  if (p.startsWith('/knowledge-handbook')) {
    return handbookCategoryLabel(String(route.query.category || ''))
  }
  if (titleMap[p]) return titleMap[p]
  return (route.meta?.title as string) || '移动自动化测试'
})
const isAgentPage = computed(() => route.path.includes('codewords-agent'))
const isTestCasesPage = computed(
  () => route.path.startsWith('/test-cases') || route.path.startsWith('/ai-test-cases')
)
</script>

<style scoped>
.main-layout {
  height: 100vh;
  background-color: var(--app-main-bg);
}

.sidebar {
  background-color: var(--app-sidebar-bg);
  height: 100vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background-color: var(--app-sidebar-header);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  -webkit-app-region: drag;
  app-region: drag;
}

.logo h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--app-surface);
}

.sidebar-menu {
  border-right: none;
  padding: 8px 0 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: var(--app-sidebar-bg) !important;
}

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  margin: 2px 10px;
  border-radius: 6px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* 父级分组之间拉开间距 */
.sidebar-menu > :deep(.el-sub-menu + .el-sub-menu) {
  margin-top: 12px;
}

/* 一级分组：清晰但不抢眼 */
.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title) {
  height: 44px !important;
  line-height: 44px !important;
  margin: 4px 10px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em;
  color: var(--app-sidebar-text-strong) !important;
}

.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title .el-icon) {
  font-size: 16px;
  color: var(--app-sidebar-icon);
}

/* 二级：缩进到父级文字右侧，形成明确从属关系 */
.sidebar-menu :deep(.el-sub-menu .el-sub-menu > .el-sub-menu__title) {
  height: 40px !important;
  line-height: 40px !important;
  padding-left: 48px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  color: var(--app-sidebar-text) !important;
}

.sidebar-menu :deep(.el-sub-menu .el-sub-menu > .el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  color: var(--app-sidebar-text-strong) !important;
}

/* 一级下的直接叶子（如测试用例分类）— 与二级标题齐平，过长省略并靠 title 悬停看全称 */
.sidebar-menu > :deep(.el-sub-menu > .el-menu > .el-menu-item) {
  height: 40px !important;
  line-height: 40px !important;
  padding-left: 48px !important;
  padding-right: 12px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  color: var(--app-sidebar-text-leaf) !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 三级叶子：再缩进一档 */
.sidebar-menu :deep(.el-sub-menu .el-sub-menu .el-menu-item) {
  height: 40px !important;
  line-height: 40px !important;
  padding-left: 64px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  color: var(--app-sidebar-text-leaf) !important;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-menu-item:focus) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  color: #eef2f6 !important;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: var(--app-sidebar-active-bg) !important;
  color: var(--app-primary) !important;
  font-weight: 500 !important;
  box-shadow: inset 3px 0 0 var(--app-primary);
}

/* 父级箭头：缩小、变淡，悬停才略明显 */
.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  right: 14px;
  margin-top: -5px;
  font-size: 11px;
  color: rgba(191, 203, 217, 0.35);
  transition: color 0.15s ease, opacity 0.15s ease;
}

.sidebar-menu > :deep(.el-sub-menu > .el-sub-menu__title:hover .el-sub-menu__icon-arrow) {
  color: rgba(232, 238, 244, 0.65);
}

.sidebar-menu > :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  color: rgba(24, 144, 255, 0.75);
}

/* 二级及以下：不显示箭头，靠缩进区分 */
.sidebar-menu :deep(.el-sub-menu .el-sub-menu > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  display: none;
}

.header {
  background-color: var(--app-card-bg);
  border-bottom: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  /* 仅左侧标题可拖窗口；右侧留空给抽屉/弹窗的关闭按钮，避免 macOS 拖拽区吞掉点击 */
  -webkit-app-region: drag;
  app-region: drag;
}

.header-content {
  -webkit-app-region: drag;
  app-region: drag;
  max-width: 50%;
}

.header-content h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}

.main-content {
  padding: 20px;
  overflow-y: auto;
  background-color: var(--app-main-bg);
}

.main-content.is-agent,
.main-content.is-test-cases {
  padding: 0;
  overflow: hidden;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

.main-content.is-agent {
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

.main-content.is-test-cases :deep(.ai-cases) {
  flex: 1;
  min-height: 0;
  height: 100%;
}
</style>
