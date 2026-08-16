import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

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
        path: 'ui-h5-pages',
        name: 'UiH5Pages',
        component: () => import('../views/UiH5Pages.vue'),
        meta: { title: 'H5 页面' }
      },
      {
        path: 'api-projects',
        name: 'ApiProjects',
        component: () => import('../views/ApiProjects.vue'),
        meta: { title: '项目管理' }
      },
      {
        path: 'api-urls',
        name: 'ApiUrls',
        component: () => import('../views/ApiUrls.vue'),
        meta: { title: 'URL 管理' }
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
        path: 'web-test',
        name: 'WebTest',
        component: () => import('../views/WebTest.vue'),
        meta: { title: 'Web 端测试' }
      },
      {
        path: 'api-testing',
        name: 'ApiTesting',
        component: () => import('../views/ApiTestingDashboard.vue'),
        meta: { title: 'API Testing' }
      },
      {
        path: 'api-test',
        name: 'ApiTest',
        component: () => import('../views/ApiTest.vue'),
        meta: { title: '接口列表' }
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
        meta: { title: '定时执行' }
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
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
