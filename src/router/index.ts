import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { canVisit, isLoaded, isLoggedIn, loadCurrentUser } from '../stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/Home.vue'),
        meta: { title: '工作台' }
      },
      {
        // APP 门户暂隐藏：直链也跳回首页，恢复时改回 AppPortal.vue
        path: 'app-portal',
        name: 'AppPortal',
        redirect: '/home'
      },
      {
        path: 'devices',
        name: 'Devices',
        component: () => import('../views/Devices.vue'),
        meta: { title: '设备管理' }
      },
      {
        path: 'devices/detail/:id',
        name: 'DeviceDetail',
        component: () => import('../views/DeviceDetailPage.vue'),
        meta: { title: '设备详情' }
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('../views/Tasks.vue'),
        meta: { title: 'APP测试任务' }
      },
      {
        path: 'reports/esports/performance',
        name: 'EsportsPerformanceReports',
        component: () => import('../views/AppPerformanceReports.vue'),
        meta: { title: '完美世界电竞 · 性能报告' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('../views/Reports.vue'),
        meta: { title: 'APP UI测试报告' }
      },
      {
        path: 'performance',
        name: 'Performance',
        component: () => import('../views/Performance.vue'),
        meta: { title: '性能监控' }
      },
      {
        path: 'performance-baseline',
        name: 'PerformanceBaseline',
        component: () => import('../views/PerformanceBaseline.vue'),
        meta: { title: '安卓性能测试' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '设置' }
      },
      {
        // 「自动化用例」已下线，重定向到流程编排：它渲染的本来就是同一批 ui_flows。
        // 保留这条重定向是为了老书签和外部链接不至于 404——直接删路由的话，
        // 用的人只会看到白屏，然后来问你「页面怎么没了」
        path: 'app-automation',
        redirect: { name: 'UiFlows' },
        meta: { title: '自动化用例' }
      },
      {
        path: 'app-online-regression',
        name: 'AppOnlineRegression',
        component: () => import('../views/AppOnlineRegression.vue'),
        meta: { title: 'APP回归' }
      },
      {
        path: 'version-archives',
        name: 'VersionArchives',
        component: () => import('../views/VersionArchive.vue'),
        meta: { title: '版本需求归档' }
      },
      {
        path: 'release-doc',
        name: 'ReleaseDoc',
        component: () => import('../views/ReleaseDoc.vue'),
        meta: { title: '发版文档与邮件管理' }
      },
      {
        path: 'release-go-live',
        name: 'ReleaseGoLive',
        component: () => import('../views/ReleaseGoLive.vue'),
        meta: { title: '上线看板' }
      },
      {
        path: 'change-review',
        name: 'ChangeReview',
        component: () => import('../views/ChangeReview.vue'),
        meta: { title: '本周改动 / 漏测看板' }
      },
      {
        path: 'tracking-check',
        name: 'TrackingCheck',
        component: () => import('../views/TrackingCheck.vue'),
        meta: { title: '埋点校验' }
      },
      {
        path: 'codewords-agent',
        name: 'CodeWordsAgent',
        component: () => import('../views/CodeWordsAgent.vue'),
        meta: { title: 'AI助手' }
      },
      {
        path: 'env-setup',
        name: 'EnvSetup',
        component: () => import('../views/EnvSetup.vue'),
        meta: { title: '环境搭建' }
      },
      {
        path: 'bug-management',
        name: 'BugManagement',
        component: () => import('../views/BugManagement.vue'),
        meta: { title: 'Bug 管理' }
      },
      {
        path: 'issue-tracking',
        name: 'IssueTracking',
        component: () => import('../views/IssueTracking.vue'),
        meta: { title: '线上问题跟踪' }
      },
      {
        path: 'test-cases/:category',
        name: 'TestCases',
        component: () => import('../views/AiTestCases.vue'),
        meta: { title: '测试用例' }
      },
      {
        path: 'ai-test-cases',
        redirect: '/test-cases/wmpvp-android'
      },
      {
        path: 'ui-apps',
        name: 'UiApps',
        component: () => import('../views/UiApps.vue'),
        meta: { title: '应用字典' }
      },
      {
        path: 'app-packs',
        name: 'AppPacks',
        component: () => import('../views/AppPack.vue'),
        meta: { title: 'APP 打包' }
      },
      {
        path: 'ui-elements',
        name: 'UiElements',
        component: () => import('../views/UiElements.vue'),
        meta: { title: '元素库' }
      },
      {
        path: 'ui-inspector-import',
        name: 'UiInspectorXmlImport',
        component: () => import('../views/UiInspectorXmlImport.vue'),
        meta: { title: 'Inspector XML 导入' }
      },
      {
        path: 'api-projects',
        name: 'ApiProjects',
        component: () => import('../views/ApiProjects.vue'),
        meta: { title: '项目管理' }
      },
      {
        path: 'api-urls',
        redirect: '/api-projects'
      },
      {
        path: 'ui-keywords',
        name: 'UiKeywords',
        component: () => import('../views/UiKeywords.vue'),
        meta: { title: '关键字库' }
      },
      {
        path: 'ui-flows',
        name: 'UiFlows',
        component: () => import('../views/UiFlows.vue'),
        meta: { title: '流程编排' }
      },
      {
        path: 'ui-record',
        name: 'UiFlowRecord',
        component: () => import('../views/UiFlowRecord.vue'),
        meta: { title: '从模拟器录制' }
      },
      {
        path: 'api-testing',
        redirect: '/home'
      },
      {
        path: 'api-test',
        redirect: { name: 'ApiCollections' }
      },
      {
        path: 'special-report',
        name: 'SpecialTestReport',
        component: () => import('../views/SpecialTestReport.vue'),
        meta: { title: '版本质量卡' }
      },
      {
        path: 'api-collections',
        name: 'ApiCollections',
        component: () => import('../views/ApiCollections.vue'),
        meta: { title: '用例集合' }
      },
      {
        path: 'api-schedules',
        name: 'ApiSchedules',
        component: () => import('../views/ApiSchedules.vue'),
        meta: { title: '定时任务' }
      },
      {
        path: 'api-reports',
        name: 'ApiReports',
        component: () => import('../views/ApiReports.vue'),
        meta: { title: '执行报告' }
      },
      {
        path: 'api-environments',
        name: 'ApiEnvironments',
        component: () => import('../views/ApiEnvironments.vue'),
        meta: { title: '环境变量' }
      },
      {
        path: 'api-changes',
        name: 'ApiChanges',
        component: () => import('../views/ApiChanges.vue'),
        meta: { title: '接口对比分析' }
      },
      {
        path: 'knowledge-handbook',
        name: 'KnowledgeHandbook',
        component: () => import('../views/KnowledgeHandbook.vue'),
        meta: { title: '知识手册' }
      },
      {
        // 旧「页面对象」已下线，书签/残留 hash 跳到元素管理
        path: 'page-objects',
        redirect: '/ui-elements'
      },
      {
        path: 'tasks/:id/overview',
        name: 'TaskOverview',
        component: () => import('../views/TaskOverviewPage.vue'),
        meta: { title: '任务详情概览' }
      },
      {
        // 旧自动化测试页已下线；任务概览迁至 /tasks/:id/overview
        path: 'automation-test',
        redirect: '/tasks'
      },
      {
        path: 'automation-test/task/:id/overview',
        redirect: (to) => ({ name: 'TaskOverview', params: { id: to.params.id } })
      },
      {
        path: 'specialized-testing',
        redirect: '/ui-flows'
      },
      {
        path: 'api-endpoints',
        name: 'ApiEndpoints',
        component: () => import('../views/ApiEndpoints.vue'),
        meta: { title: '接口管理' }
      },
      {
        path: 'project-tree',
        redirect: '/api-projects'
      },
      {
        path: 'requirements',
        name: 'Requirements',
        component: () => import('../views/Requirements.vue'),
        meta: { title: '需求登记' }
      },
      {
        path: 'coverage-gap',
        name: 'CoverageGap',
        component: () => import('../views/CoverageGap.vue'),
        meta: { title: '接口覆盖差集' }
      },
      {
        path: 'packet-capture',
        name: 'PacketCapture',
        component: () => import('../views/PacketCapture.vue'),
        meta: { title: '抓包' }
      },
      {
        path: 'status-monitor',
        name: 'StatusMonitor',
        component: () => import('../views/StatusMonitor.vue'),
        meta: { title: '状态监控' }
      },
      {
        path: 'incident-playbooks',
        name: 'IncidentPlaybooks',
        component: () => import('../views/IncidentPlaybooks.vue'),
        meta: { title: '事故沉淀' }
      },
      {
        path: 'platform-users',
        name: 'PlatformUsers',
        component: () => import('../views/PlatformUsers.vue'),
        meta: { title: '账号与权限' }
      }
    ]
  },
  {
    // 登录页在布局之外：还没登录的时候不该看到侧边栏菜单
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', public: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

/**
 * 路由守卫。
 *
 * 它只负责「别让人走到看不了的页面」，不是安全边界——
 * 真正的边界在后端 AuthFilter。客户端是 Electron 打包分发的，
 * 前端这一层随便就能绕过去，这里做的是体验，不是防护。
 */
router.beforeEach(async (to) => {
  if (to.meta?.public) {
    return true
  }
  if (!isLoaded()) {
    await loadCurrentUser()
  }
  if (!isLoggedIn.value) {
    // 带上 redirect，登录完直接回到他本来要去的页面
    return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  const visitPath =
    to.path === '/ui-record' || to.path.startsWith('/ui-record/') ? '/ui-flows' : to.path
  if (!canVisit(visitPath)) {
    ElMessage.warning('当前账号没有这个页面的权限')
    return { path: '/home' }
  }
  return true
})

export default router
