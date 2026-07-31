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
        meta: { title: '测试任务' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('../views/Reports.vue'),
        meta: { title: '测试报告' }
      },
      {
        path: 'performance',
        name: 'Performance',
        component: () => import('../views/Performance.vue'),
        meta: { title: '性能监控' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '设置' }
      },
      {
        path: 'specialized-testing',
        name: 'SpecializedTesting',
        component: () => import('../views/SpecializedTesting.vue'),
        meta: { title: '专项测试' }
      },
      {
        path: 'app-online-regression',
        name: 'AppOnlineRegression',
        component: () => import('../views/AppOnlineRegression.vue'),
        meta: { title: 'APP线上回归' }
      },
      {
        path: 'release-doc',
        name: 'ReleaseDoc',
        component: () => import('../views/ReleaseDoc.vue'),
        meta: { title: '发版文档与邮件管理' }
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
        path: 'ui-keywords',
        name: 'UiKeywords',
        component: () => import('../views/UiKeywords.vue'),
        meta: { title: '关键字库' }
      },
      {
        path: 'ui-flows',
        name: 'UiFlows',
        component: () => import('../views/UiFlows.vue'),
        meta: { title: '测试用例' }
      },
      {
        path: 'page-objects',
        name: 'PageObjects',
        component: () => import('../views/PageObjects.vue'),
        meta: { title: '页面对象(旧)' }
      },
      {
        path: 'automation-test',
        name: 'AutomationTest',
        component: () => import('../views/AutomationTest.vue'),
        meta: { title: '自动化测试' }
      },
      {
        path: 'automation-test/task/:id/overview',
        name: 'TaskOverview',
        component: () => import('../views/TaskOverviewPage.vue'),
        meta: { title: '任务详情概览' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
