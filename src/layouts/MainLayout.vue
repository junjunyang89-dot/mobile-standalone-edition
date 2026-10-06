<template>
  <div class="app-shell">
    <!--
      自绘标题栏只在 macOS 上画。
      Electron 那边只给 darwin 设了 titleBarStyle: 'hiddenInset'，Windows 用的是系统默认标题栏——
      两个叠在一起就是 38px 的空白条 + 重复的标题，第一眼就能看出来没做完。
    -->
    <div v-if="isMac" class="window-titlebar">
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
          <!-- APP 门户暂隐藏，恢复时去掉 v-if="false" -->
          <el-menu-item v-if="false" index="/app-portal">APP 门户</el-menu-item>
          <el-menu-item index="/codewords-agent">AI助手</el-menu-item>
          <el-menu-item index="/env-setup">环境搭建</el-menu-item>
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
          <el-menu-item v-if="canVisit('/devices')" index="/devices">设备池</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-apps')" index="/ui-apps">应用管理</el-menu-item>
          <el-menu-item v-if="canVisit('/app-packs')" index="/app-packs">APP 打包</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="api-test">
          <template #title>
            <el-icon><Link /></el-icon>
            <span>接口测试</span>
          </template>
          <el-menu-item index="/api-collections">用例集合</el-menu-item>
          <!--
            原来叫「接口清单」「接口列表」，中文里几乎同义，谁也分不出哪个是哪个。
            一个是「有哪些接口」（事实）；用例在「用例集合」里按接口管理，不再单独开「接口用例」页
          -->
          <el-menu-item index="/api-endpoints">接口管理</el-menu-item>
          <el-menu-item v-if="canVisit('/api-environments')" index="/api-environments">环境变量</el-menu-item>
          <el-menu-item index="/api-reports">执行报告</el-menu-item>
          <el-menu-item index="/api-changes">接口对比分析</el-menu-item>
          <el-menu-item index="/api-changes-v2">接口对比分析2</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="canVisit('/api-schedules')" index="schedules">
          <template #title>
            <el-icon><Clock /></el-icon>
            <span>定时任务</span>
          </template>
          <el-menu-item index="/api-schedules">定时执行</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="showAppAutoMenu" index="app-auto">
          <template #title>
            <el-icon><VideoPlay /></el-icon>
            <span>APP 自动化</span>
          </template>
          <!-- 「自动化用例」已下线：它渲染的就是 ui_flows，和「流程编排」是同一张表的同一批行，
               执行入口也调同一个接口，而且是功能更弱的那份（不能选包、不能传执行参数）。
               筛选器流程编排页本来就有（还多了用途和名称），「最近结果」列已搬过去，
               批量执行归「APP回归」。 -->
          <el-menu-item index="/tasks">APP测试任务</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-flows')" index="/ui-flows">流程编排</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-elements')" index="/ui-elements">元素管理</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-inspector-import')" index="/ui-inspector-import">Inspector XML 导入</el-menu-item>
          <el-menu-item v-if="canVisit('/ui-keywords')" index="/ui-keywords">关键字库</el-menu-item>
          <el-menu-item v-if="canVisit('/app-online-regression')" index="/app-online-regression">APP回归</el-menu-item>
          <el-menu-item v-if="canVisit('/reports')" index="/reports">APP UI测试报告</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="tools">
          <template #title>
            <el-icon><Connection /></el-icon>
            <span>测试工具</span>
          </template>
          <el-menu-item index="/packet-capture">抓包</el-menu-item>
          <el-menu-item index="/status-monitor">状态监控</el-menu-item>
          <el-menu-item v-if="canVisit('/redis-tool')" index="/redis-tool">Redis 查询</el-menu-item>
          <el-menu-item v-if="canVisit('/kafka-tool')" index="/kafka-tool">Kafka 查询</el-menu-item>
          <el-menu-item v-if="canVisit('/incident-playbooks')" index="/incident-playbooks">事故沉淀</el-menu-item>
          <el-menu-item index="/tracking-check">埋点校验</el-menu-item>
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
            <el-menu-item index="/reports/esports/performance">性能报告</el-menu-item>
            <el-menu-item index="/special-report">版本质量卡</el-menu-item>
            <el-menu-item index="/performance">性能监控</el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-sub-menu v-if="showHandbookMenu" index="knowledge-handbook">
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

        <el-sub-menu index="app-release">
          <template #title>
            <el-icon><DocumentCopy /></el-icon>
            <span>APP发版</span>
          </template>
          <el-menu-item index="/release-doc">发版文档</el-menu-item>
          <el-menu-item index="/release-go-live">上线看板</el-menu-item>
          <el-menu-item index="/version-archives">版本需求归档</el-menu-item>
          <el-menu-item index="/change-review">周改动漏测</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="other">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>权限与设置</span>
          </template>
          <el-menu-item v-if="canManageUsers" index="/platform-users">账号与权限</el-menu-item>
          <el-menu-item index="/settings">设置</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container class="content-column" direction="vertical">
      <div class="tabs-bar">
        <PageTabs
          class="tabs-bar-tabs"
          :tabs="openPages"
          :active-key="activeTabKey"
          :last-closable="lastTabClosable"
          @select="onSelectTab"
          @duplicate="onDuplicateTab"
          @close="onCloseTab"
        />
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
      <el-header v-if="!isApiReportsPage && !isTestCasesPage && !isBugManagementPage && !isIssueTrackingPage && !isAppPacksPage && !isApiProjectsPage" class="header">
        <div class="header-content">
          <h3>{{ currentTitle }}</h3>
        </div>
        <div class="header-right">
          <div id="page-header-actions" class="header-actions"></div>
        </div>
      </el-header>
      <el-main
        class="main-content"
        :class="{ 'is-agent': isAgentPage, 'is-test-cases': isTestCasesPage, 'is-bug-management': isBugManagementPage, 'is-issue-tracking': isIssueTrackingPage, 'is-api-collections': isApiCollectionsPage, 'is-api-reports': isApiReportsPage, 'is-ui-record': isUiRecordPage }"
      >
        <template v-for="tab in openPages" :key="tab.key">
          <PagePane v-if="tab.mounted" :location="tab.location" :active="tab.key === activeTabKey" />
        </template>
      </el-main>
      <RunningTasksBar />
      <MinimizedDialogsTray />
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

/**
 * 是不是 macOS。用 userAgent 判断而不是新开一个 IPC——
 * 这只影响一条标题栏要不要画，不值得为它加一个主进程通道。
 * 浏览器里跑开发态时也走这条,结果和真机一致。
 */
const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent)
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowReactive, watch } from 'vue'
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
  Notebook,
  ArrowDown
} from '@element-plus/icons-vue'
import { apiClient } from '../api'
import RunningTasksBar from '../components/RunningTasksBar.vue'
import MinimizedDialogsTray from '../components/MinimizedDialogsTray.vue'
import { startDialogMinimize, stopDialogMinimize } from '../composables/useDialogMinimize'
import PagePane from '../components/PagePane.vue'
import PageTabs from '../components/PageTabs.vue'
import {
  PAGE_TABS_MAX,
  TAB_COPY_QUERY,
  basePageTabKey,
  loadStoredPageTabs,
  pageTabKey,
  pageTitle,
  saveStoredPageTabs,
  tabCopyNo
} from '../utils/pageTabs'
import { canManageUsers, canVisit, logout, user } from '../stores/auth'
import { TEST_CASE_SUITES } from '../constants/testCaseSuites'
import { HANDBOOK_GROUPS, handbookGroupIdForCategory, normalizeHandbookCategory } from '../constants/handbookCategories'

const route = useRoute()
const router = useRouter()

const roleTagType = computed(() => {
  const r = user.value?.role
  if (user.value?.bootstrapping) return 'info'
  if (r === 'ADMIN') return 'danger'
  if (r === 'TESTER') return 'warning'
  return 'info'
})

/** 知识手册暂时不在侧栏露出；路由还在，别处跳过去的链接照常能打开 */
const showHandbookMenu = false

const showAppAutoMenu = computed(
  () =>
    canVisit('/tasks') ||
    canVisit('/ui-flows') ||
    canVisit('/ui-elements') ||
    canVisit('/ui-inspector-import') ||
    canVisit('/ui-keywords') ||
    canVisit('/app-online-regression') ||
    canVisit('/reports')
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
    p.includes('codewords-agent') ||
    p.startsWith('/env-setup')
  ) {
    return ['main']
  }
  if (p.startsWith('/test-cases') || p.startsWith('/ai-test-cases') || p.startsWith('/bug-management') || p.startsWith('/issue-tracking')) {
    return ['test-cases']
  }
  if (
    p.startsWith('/api-projects') ||
    p.startsWith('/devices') ||
    p.startsWith('/ui-apps') ||
    p.startsWith('/app-packs')
  ) {
    return ['assets']
  }
  if (
    p.startsWith('/tasks') ||
    p.startsWith('/ui-flows') ||
    p.startsWith('/ui-record') ||
    p.startsWith('/ui-keywords') ||
    p.startsWith('/ui-elements') ||
    p.startsWith('/ui-inspector-import') ||
    p.startsWith('/app-online-regression') ||
    p === '/reports' ||
    (p.startsWith('/reports/') && !p.startsWith('/reports/esports'))
  ) {
    return ['app-auto']
  }
  if (p.startsWith('/api-schedules')) {
    return ['schedules']
  }
  // 接口测试下页面以 /api- 开头（概览、集合、清单、环境变量、报告、对比分析）。
  // api-projects 在资产管理下，已在上面单独处理
  if (p.startsWith('/api-')) {
    return ['api-test']
  }
  if (p.startsWith('/reports/esports') || p.startsWith('/performance-baseline') || p.startsWith('/performance')) {
    return ['perf-test', 'perf-app']
  }
  if (p.startsWith('/knowledge-handbook')) {
    const cat = String(route.query.category || 'app')
    return ['knowledge-handbook', handbookGroupIdForCategory(cat)]
  }
  if (
    p.startsWith('/packet-capture') ||
    p.startsWith('/incident-playbooks') ||
    p.startsWith('/status-monitor') ||
    p.startsWith('/redis-tool') ||
    p.startsWith('/kafka-tool') ||
    p.startsWith('/tracking-check')
  ) {
    return ['tools']
  }
  if (
    p.startsWith('/release-doc') ||
    p.startsWith('/release-go-live') ||
    p.startsWith('/version-archives') ||
    p.startsWith('/change-review')
  ) {
    return ['app-release']
  }
  if (p.startsWith('/settings') || p.startsWith('/platform-users')) {
    return ['other']
  }
  return ['main', 'assets']
})

type OpenPage = {
  key: string
  fullPath: string
  label: string
  mounted: boolean
  lastActive: number
  location: Record<string, any>
}

function createLocation(src: any) {
  return shallowReactive({
    fullPath: src.fullPath,
    path: src.path,
    hash: src.hash || '',
    name: src.name,
    params: { ...src.params },
    query: { ...src.query },
    meta: src.meta || {},
    matched: src.matched ? [...src.matched] : [],
    redirectedFrom: src.redirectedFrom,
    href: src.href || src.fullPath
  })
}

function assignLocation(target: Record<string, any>, src: any) {
  target.fullPath = src.fullPath
  target.path = src.path
  target.hash = src.hash || ''
  target.name = src.name
  target.params = { ...src.params }
  target.query = { ...src.query }
  target.meta = src.meta || {}
  target.matched = src.matched ? [...src.matched] : []
  target.redirectedFrom = src.redirectedFrom
  target.href = src.href || src.fullPath
}

function isLayoutChild(fullPath: string) {
  const resolved = router.resolve(fullPath)
  return resolved.matched.length >= 2 && resolved.matched.some((r) => r.components?.default)
}

const openPages = ref<OpenPage[]>([])

const activeTabKey = computed(() => pageTabKey(route.path, route.query))

function persistPages() {
  saveStoredPageTabs(openPages.value.map(({ key, fullPath }) => ({ key, fullPath })))
}

function evictPages() {
  while (openPages.value.length > PAGE_TABS_MAX) {
    const current = activeTabKey.value
    const victim = [...openPages.value]
      .filter((t) => t.key !== current)
      .sort((a, b) => a.lastActive - b.lastActive)[0]
    if (!victim) break
    const idx = openPages.value.findIndex((t) => t.key === victim.key)
    if (idx >= 0) openPages.value.splice(idx, 1)
  }
}

function restorePages() {
  const currentKey = pageTabKey(route.path, route.query)
  for (const item of loadStoredPageTabs()) {
    if (!isLayoutChild(item.fullPath)) continue
    const resolved = router.resolve(item.fullPath)
    if (resolved.matched.some((m) => m.redirect)) continue
    const key = pageTabKey(resolved.path, resolved.query)
    if (key !== item.key || openPages.value.some((t) => t.key === key)) continue
    const isCurrent = key === currentKey
    const src = isCurrent ? route : resolved
    openPages.value.push({
      key,
      fullPath: src.fullPath,
      label: pageTitle(src),
      mounted: isCurrent,
      lastActive: isCurrent ? Date.now() : 0,
      location: createLocation(src)
    })
  }
}

function syncActivePage() {
  const key = pageTabKey(route.path, route.query)
  let tab = openPages.value.find((t) => t.key === key)
  if (!tab) {
    tab = {
      key,
      fullPath: route.fullPath,
      label: pageTitle(route),
      mounted: true,
      lastActive: Date.now(),
      location: createLocation(route)
    }
    openPages.value.push(tab)
    evictPages()
  } else {
    tab.mounted = true
    tab.lastActive = Date.now()
    tab.fullPath = route.fullPath
    tab.label = pageTitle(route)
    assignLocation(tab.location, route)
  }
  persistPages()
}

restorePages()
watch(() => route.fullPath, syncActivePage, { immediate: true })

function onSelectTab(key: string) {
  const tab = openPages.value.find((t) => t.key === key)
  if (!tab || tab.fullPath === route.fullPath) return
  router.push(tab.fullPath)
}

onMounted(() => {
  startDialogMinimize({
    currentTab: () => {
      const tab = openPages.value.find((t) => t.key === activeTabKey.value)
      return { key: activeTabKey.value, label: tab?.label || pageTitle(route) }
    },
    openTab: async (key) => {
      const tab = openPages.value.find((t) => t.key === key)
      if (tab && tab.fullPath !== route.fullPath) await router.push(tab.fullPath)
      await nextTick()
    }
  })
})
onBeforeUnmount(stopDialogMinimize)

function onDuplicateTab(key: string) {
  const tab = openPages.value.find((t) => t.key === key)
  if (!tab) return
  const { path, query } = tab.location
  const base = basePageTabKey(path, query)
  const used = new Set(
    openPages.value
      .filter((t) => basePageTabKey(t.location.path, t.location.query) === base)
      .map((t) => tabCopyNo(t.location.query))
  )
  let n = 2
  while (used.has(n)) n++
  const nextQuery: Record<string, string> = { [TAB_COPY_QUERY]: String(n) }
  if (query.category) nextQuery.category = String(query.category)
  router.push({ path, query: nextQuery })
}

const HOME_PATH = '/home'

const lastTabClosable = computed(
  () => openPages.value.length === 1 && openPages.value[0].fullPath.split('?')[0] !== HOME_PATH
)

function onCloseTab(key: string) {
  const tabs = openPages.value
  const idx = tabs.findIndex((t) => t.key === key)
  if (idx < 0) return
  if (tabs.length <= 1) {
    if (!lastTabClosable.value) return
    tabs.splice(idx, 1)
    persistPages()
    router.push(HOME_PATH)
    return
  }
  const closingActive = key === activeTabKey.value
  const neighbor = tabs[idx + 1] || tabs[idx - 1]
  tabs.splice(idx, 1)
  persistPages()
  if (closingActive && neighbor) router.push(neighbor.fullPath)
}

const currentTitle = computed(() => pageTitle(route, { long: true }))

const windowPageTitle = computed(() => currentTitle.value)

watch(
  windowPageTitle,
  (t) => {
    document.title = `APP自动化管理平台 — ${t}`
  },
  { immediate: true }
)
const isAgentPage = computed(() => route.path.includes('codewords-agent'))
const isUiRecordPage = computed(() => route.path.startsWith('/ui-record'))
const isTestCasesPage = computed(
  () => route.path.startsWith('/test-cases') || route.path.startsWith('/ai-test-cases')
)
const isBugManagementPage = computed(() => route.path.startsWith('/bug-management'))
const isIssueTrackingPage = computed(() => route.path.startsWith('/issue-tracking'))
const isApiCollectionsPage = computed(() => route.path.startsWith('/api-collections'))
const isApiReportsPage = computed(() => route.path.startsWith('/api-reports'))
const isAppPacksPage = computed(() => route.path.startsWith('/app-packs'))
const isApiProjectsPage = computed(() => route.path.startsWith('/api-projects'))
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

.content-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background-color: var(--app-sidebar-bg);
  height: 100%;
  overflow: hidden;
}

.logo {
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-right: none;
  padding: 8px 0 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: var(--app-sidebar-bg) !important;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar-menu::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
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

.tabs-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 20px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--app-border);
}

.tabs-bar > .tabs-bar-tabs {
  flex: 1;
  min-width: 0;
  border-bottom: none;
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

/* 页签已经写了页面名，只剩标题时整栏不要；接口管理这类往右侧塞按钮的页面才显示 */
.header:not(:has(#page-header-actions > *)) {
  display: none;
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
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--app-main-bg);
}

.main-content.is-agent,
.main-content.is-test-cases,
.main-content.is-bug-management,
.main-content.is-issue-tracking,
.main-content.is-api-collections,
.main-content.is-api-reports,
.main-content.is-ui-record {
  height: 100%;
}

.main-content.is-agent :deep(.page-pane),
.main-content.is-test-cases :deep(.page-pane),
.main-content.is-bug-management :deep(.page-pane),
.main-content.is-issue-tracking :deep(.page-pane),
.main-content.is-api-collections :deep(.page-pane),
.main-content.is-api-reports :deep(.page-pane),
.main-content.is-ui-record :deep(.page-pane) {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main-content.is-ui-record :deep(.page-pane) {
  padding: 12px 16px;
}
.main-content.is-ui-record :deep(.ui-record) {
  flex: 1;
  min-height: 0;
  height: 100%;
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
  scrollbar-color: #cbd5e1 transparent;
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
  background: #cbd5e1;
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.main-content.is-agent::-webkit-scrollbar-thumb:hover,
.main-content.is-agent ::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.main-content.is-agent :deep(.ask-shell),
.main-content.is-agent :deep(.xk-shell) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.main-content.is-test-cases,
.main-content.is-bug-management,
.main-content.is-issue-tracking {
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

</style>
