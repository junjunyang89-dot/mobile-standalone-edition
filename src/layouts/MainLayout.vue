<template>
  <div class="app-shell">
    <div class="window-titlebar">
      <span class="window-titlebar-text">APP自动化管理平台 — {{ windowPageTitle }}</span>
    </div>
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
          <el-menu-item index="/codewords-agent">AI助手</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="test-cases">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>测试用例</span>
          </template>
          <el-menu-item index="/bug-management">Bug 管理</el-menu-item>
          <el-menu-item index="/issue-tracking">线上问题跟踪</el-menu-item>
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
          <el-menu-item v-if="canVisit('/devices')" index="/devices">设备管理</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-apps')" index="/ui-apps">应用管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="api-test">
          <template #title>
            <el-icon><Link /></el-icon>
            <span>接口测试</span>
          </template>
          <el-menu-item index="/api-testing">概览</el-menu-item>
          <el-menu-item index="/api-collections">用例集合</el-menu-item>
          <!--
            原来叫「接口清单」「接口列表」，中文里几乎同义，谁也分不出哪个是哪个。
            一个是「有哪些接口」（事实）；用例在「用例集合」里按接口管理，不再单独开「接口用例」页
          -->
          <el-menu-item index="/api-endpoints">接口清单</el-menu-item>
          <el-menu-item v-if="canVisit('/api-environments')" index="/api-environments">环境变量</el-menu-item>
          <el-menu-item index="/api-reports">执行报告</el-menu-item>
          <el-menu-item index="/api-changes">接口对比分析</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="canVisit('/api-schedules')" index="schedules">
          <template #title>
            <el-icon><Clock /></el-icon>
            <span>定时任务</span>
          </template>
          <el-menu-item index="/api-schedules">定时执行</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="showWebTestMenu" index="web-test-menu">
          <template #title>
            <el-icon><Monitor /></el-icon>
            <span>Web 端测试</span>
          </template>
          <el-menu-item index="/web-test">Web 测试</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-h5-pages')" index="/ui-h5-pages">H5 页面</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="showAppAutoMenu" index="app-auto">
          <template #title>
            <el-icon><VideoPlay /></el-icon>
            <span>APP 自动化</span>
          </template>
          <el-menu-item v-if="canVisit('/app-automation')" index="/app-automation">自动化用例</el-menu-item>
          <el-menu-item index="/tasks">APP测试任务</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-flows')" index="/ui-flows">流程编排</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-elements')" index="/ui-elements">元素管理</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-inspector-import')" index="/ui-inspector-import">Inspector XML 导入</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-keywords')" index="/ui-keywords">关键字库</el-menu-item>
          <el-menu-item v-if="canVisit('/app-online-regression')" index="/app-online-regression">APP回归</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="tools">
          <template #title>
            <el-icon><Connection /></el-icon>
            <span>测试工具</span>
          </template>
          <el-menu-item index="/packet-capture">抓包</el-menu-item>
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
          <el-menu-item index="/version-archives">版本需求归档</el-menu-item>
          <el-menu-item index="/release-doc">发版文档</el-menu-item>
          <el-menu-item index="/change-review">周改动漏测</el-menu-item>
          <el-menu-item v-if="canManageUsers" index="/platform-users">账号与权限</el-menu-item>
          <el-menu-item index="/settings">设置</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header v-if="!isApiReportsPage && !isTestCasesPage && !isBugManagementPage && !isIssueTrackingPage && !isAppAutomationPage" class="header">
        <div class="header-content">
          <h3>{{ currentTitle }}</h3>
        </div>
        <div class="header-right">
          <div id="page-header-actions" class="header-actions"></div>
          <div v-if="user" class="header-user">
            <el-tag size="small" :type="roleTagType">{{ user.roleLabel }}</el-tag>
            <el-dropdown trigger="click" @command="onUserCommand">
              <span class="header-user-name">
                {{ user.displayName || user.username }}
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="!user.bootstrapping" command="password">
                    修改密码
                  </el-dropdown-item>
                  <el-dropdown-item v-if="!user.bootstrapping" command="logout" divided>
                    退出登录
                  </el-dropdown-item>
                  <el-dropdown-item v-else disabled>还未启用账号权限</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>
      <el-main
        class="main-content"
        :class="{ 'is-agent': isAgentPage, 'is-test-cases': isTestCasesPage, 'is-bug-management': isBugManagementPage, 'is-issue-tracking': isIssueTrackingPage, 'is-app-automation': isAppAutomationPage, 'is-api-collections': isApiCollectionsPage, 'is-api-reports': isApiReportsPage }"
      >
        <router-view :key="route.fullPath" />
      </el-main>
    </el-container>

    <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
      <el-form label-width="90px">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="再输一次">
          <el-input v-model="pwdForm.confirm" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  HomeFilled,
  DocumentCopy,
  Document,
  DataAnalysis,
  Setting,
  VideoPlay,
  Connection,
  Link,
  Clock,
  Monitor,
  Notebook,
  ArrowDown
} from '@element-plus/icons-vue'
import { apiClient } from '../api'
import { canManageUsers, canVisit, logout, user } from '../stores/auth'
import { findTestCaseSuite, TEST_CASE_SUITES } from '../constants/testCaseSuites'
import { HANDBOOK_GROUPS, handbookCategoryLabel, handbookGroupIdForCategory, normalizeHandbookCategory } from '../constants/handbookCategories'

const route = useRoute()
const router = useRouter()

const roleTagType = computed(() => {
  const r = user.value?.role
  if (user.value?.bootstrapping) return 'info'
  if (r === 'ADMIN') return 'danger'
  if (r === 'TESTER') return 'warning'
  return 'info'
})

const showAppAutoMenu = computed(
  () =>
    canVisit('/app-automation') ||
    canVisit('/tasks') ||
    canVisit('/ui-flows') ||
    canVisit('/ui-elements') ||
    canVisit('/ui-inspector-import') ||
    canVisit('/ui-keywords') ||
    canVisit('/app-online-regression')
)

const showWebTestMenu = computed(
  () => canVisit('/web-test') || canVisit('/ui-h5-pages')
)

const pwdVisible = ref(false)
const pwdSaving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirm: '' })

function onUserCommand(cmd: string) {
  if (cmd === 'logout') {
    logout()
    router.replace('/login')
    return
  }
  if (cmd === 'password') {
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirm = ''
    pwdVisible.value = true
  }
}

async function submitPassword() {
  if (pwdForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirm) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  pwdSaving.value = true
  try {
    await apiClient.changeOwnPassword(pwdForm.oldPassword, pwdForm.newPassword)
    pwdVisible.value = false
    // 改完密码不强制重新登录：令牌是签名的、不存服务端，旧令牌本来就还有效，
    // 假装把人踢下线只是多一步操作，并不真的收回了什么
    ElMessage.success('密码已修改')
  } catch (e: any) {
    ElMessage.error(e?.message || '修改失败')
  } finally {
    pwdSaving.value = false
  }
}

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
    p.includes('codewords-agent')
  ) {
    return ['main']
  }
  if (p.startsWith('/test-cases') || p.startsWith('/ai-test-cases') || p.startsWith('/bug-management') || p.startsWith('/issue-tracking')) {
    return ['test-cases']
  }
  if (
    p.startsWith('/api-projects') ||
    p.startsWith('/api-urls') ||
    p.startsWith('/devices') ||
    p.startsWith('/ui-apps')
  ) {
    return ['assets']
  }
  if (p.startsWith('/web-test') || p.startsWith('/ui-h5-pages')) {
    return ['web-test-menu']
  }
  if (
    p.startsWith('/app-automation') ||
    p.startsWith('/tasks') ||
    p.startsWith('/ui-flows') ||
    p.startsWith('/ui-keywords') ||
    p.startsWith('/ui-elements') ||
    p.startsWith('/ui-inspector-import') ||
    p.startsWith('/app-online-regression')
  ) {
    return ['app-auto']
  }
  if (p.startsWith('/api-schedules')) {
    return ['schedules']
  }
  // 接口测试下页面以 /api- 开头（概览、集合、清单、环境变量、报告、对比分析）。
  // api-projects / api-urls 在资产管理下，已在上面单独处理
  if (p.startsWith('/api-')) {
    return ['api-test']
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
    p.startsWith('/version-archives') ||
    p.startsWith('/release-doc') ||
    p.startsWith('/change-review')
  ) {
    return ['other']
  }
  return ['main', 'assets']
})

const titleMap: Record<string, string> = {
  '/home': '工作台',
  '/tasks': 'APP测试任务',
  '/codewords-agent': 'AI助手',
  '/ui-elements': '元素管理',
  '/ui-keywords': '关键字库',
  '/ui-inspector-import': 'Inspector XML 导入',
  '/ui-h5-pages': 'H5 页面',
  '/api-projects': '项目管理',
  '/api-urls': 'URL 管理',
  '/devices': '设备管理',
  '/ui-apps': '应用管理',
  '/reports': 'APP UI测试报告',
  '/reports/esports/performance': '完美世界电竞 · 性能报告',
  '/performance': '性能监控',
  '/performance-baseline': '安卓性能测试',
  '/special-report': '版本质量卡',
  '/release-doc': '发版文档与邮件管理',
  '/version-archives': '版本需求归档',
  '/change-review': '本周改动 / 漏测看板',
  '/bug-management': 'Bug 管理',
  '/issue-tracking': '线上问题跟踪',
  '/app-automation': '自动化用例',
  '/web-test': 'Web 端测试',
  '/api-testing': '概览',
  '/api-collections': '用例集合',
  '/api-schedules': '定时任务',
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

const windowPageTitle = computed(() => {
  if (route.path.startsWith('/app-automation')) return 'APP 自动化用例'
  return currentTitle.value
})

watch(
  windowPageTitle,
  (t) => {
    document.title = `APP自动化管理平台 — ${t}`
  },
  { immediate: true }
)
const isAgentPage = computed(() => route.path.includes('codewords-agent'))
const isTestCasesPage = computed(
  () => route.path.startsWith('/test-cases') || route.path.startsWith('/ai-test-cases')
)
const isBugManagementPage = computed(() => route.path.startsWith('/bug-management'))
const isIssueTrackingPage = computed(() => route.path.startsWith('/issue-tracking'))
const isAppAutomationPage = computed(() => route.path.startsWith('/app-automation'))
const isApiCollectionsPage = computed(() => route.path.startsWith('/api-collections'))
const isApiReportsPage = computed(() => route.path.startsWith('/api-reports'))
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.window-titlebar {
  position: relative;
  height: 38px;
  flex-shrink: 0;
  background: #151c2f;
  -webkit-app-region: drag;
  app-region: drag;
}

.window-titlebar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.04em;
  pointer-events: none;
  user-select: none;
}

.main-layout {
  flex: 1;
  min-height: 0;
  height: auto;
  background-color: var(--app-main-bg);
}

.sidebar {
  background-color: var(--app-sidebar-bg);
  height: 100%;
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
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
  拖拽区会吞掉点击事件，下拉菜单必须单独设回 no-drag——
  否则在打包后的 Electron 里这个菜单是点不动的，而浏览器里调试完全正常
*/
.header-user {
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-user-name {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--app-text);
  outline: none;
}

.header-content h3 {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.main-content.is-test-cases,
.main-content.is-bug-management,
.main-content.is-issue-tracking,
.main-content.is-app-automation,
.main-content.is-api-collections,
.main-content.is-api-reports {
  padding: 0;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-content.is-api-reports {
  height: 100%;
}

.main-content.is-api-reports :deep(.reports-page) {
  flex: 1;
  min-height: 0;
  height: 100%;
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

.main-content.is-test-cases,
.main-content.is-bug-management,
.main-content.is-issue-tracking,
.main-content.is-app-automation {
  height: 100%;
}

.main-content.is-test-cases :deep(.ai-cases) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.main-content.is-bug-management {
  padding: 0;
  overflow: hidden;
}

.main-content.is-bug-management :deep(.bug-mgmt) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.main-content.is-issue-tracking {
  padding: 0;
  overflow: hidden;
}

.main-content.is-issue-tracking :deep(.issue-track) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.main-content.is-app-automation {
  padding: 0;
  overflow: hidden;
}

.main-content.is-app-automation :deep(.app-auto-cases) {
  flex: 1;
  min-height: 0;
  height: 100%;
}
</style>
