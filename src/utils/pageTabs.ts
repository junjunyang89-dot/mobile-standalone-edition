import type { LocationQuery, RouteParams } from 'vue-router'
import { findTestCaseSuite } from '../constants/testCaseSuites'
import { handbookCategoryLabel, normalizeHandbookCategory } from '../constants/handbookCategories'

export const PAGE_TABS_STORAGE_KEY = 'msa-open-pages'
export const PAGE_TABS_MAX = 10

export type StoredPageTab = {
  key: string
  fullPath: string
}

type TitleSource = {
  path: string
  params: RouteParams | Record<string, unknown>
  query: LocationQuery | Record<string, unknown>
  meta?: { title?: unknown }
}

const titleMap: Record<string, string> = {
  '/home': '工作台',
  '/app-portal': 'APP 门户',
  '/tasks': 'APP测试任务',
  '/codewords-agent': 'AI助手',
  '/env-setup': '环境搭建',
  '/ui-elements': '元素管理',
  '/ui-record': '从模拟器录制',
  '/ui-flows': '流程编排',
  '/ui-keywords': '关键字库',
  '/ui-inspector-import': 'Inspector XML 导入',
  '/requirements': '需求登记',
  '/packet-capture': '抓包',
  '/status-monitor': '状态监控',
  '/redis-tool': 'Redis 查询',
  '/kafka-tool': 'Kafka 查询',
  '/incident-playbooks': '事故沉淀',
  '/api-projects': '项目管理',
  '/devices': '设备池',
  '/ui-apps': '应用管理',
  '/app-packs': 'APP 打包',
  '/reports': 'APP UI测试报告',
  '/reports/esports/performance': '完美世界电竞 · 性能报告',
  '/performance': '性能监控',
  '/performance-baseline': '安卓性能测试',
  '/special-report': '版本质量卡',
  '/release-doc': '发版文档与邮件管理',
  '/release-go-live': '上线看板',
  '/release-merge': '合并到 master',
  '/version-archives': '版本需求归档',
  '/change-review': '本周改动 / 漏测看板',
  '/bug-management': 'Bug 管理',
  '/issue-tracking': '线上问题跟踪',
  '/api-collections': '用例集合',
  '/api-schedules': '定时任务',
  '/api-reports': '执行报告',
  '/api-environments': '环境变量',
  '/api-endpoints': '接口管理',
  '/api-changes': '接口对比分析',
  '/api-changes-v2': '接口对比分析2',
  '/knowledge-handbook': '知识手册',
  '/platform-users': '账号与权限',
  '/settings': '设置',
  '/tracking-check': '埋点校验'
}

/** 同一页面多开时的序号参数：没有它是第 1 个，`_copy=2` 起是后开的副本。 */
export const TAB_COPY_QUERY = '_copy'

export function tabCopyNo(query: LocationQuery | Record<string, unknown> = {}): number {
  const n = Number(query[TAB_COPY_QUERY])
  return Number.isInteger(n) && n > 1 ? n : 1
}

/** 页签身份：同一路径共用一个页签，除非带了副本序号。知识手册按分类分开，因为菜单只靠 query 区分。 */
export function pageTabKey(path: string, query: LocationQuery | Record<string, unknown> = {}): string {
  const base = basePageTabKey(path, query)
  const n = tabCopyNo(query)
  return n > 1 ? `${base}~${n}` : base
}

export function basePageTabKey(path: string, query: LocationQuery | Record<string, unknown> = {}): string {
  const p = !path || path === '/' ? '/home' : path
  if (p.startsWith('/knowledge-handbook')) {
    const cat = normalizeHandbookCategory(String(query.category || ''))
    return `/knowledge-handbook?category=${cat}`
  }
  return p
}

export function pageTitle(loc: TitleSource, opts?: { long?: boolean }): string {
  const title = basePageTitle(loc, opts)
  const n = tabCopyNo(loc.query)
  return n > 1 ? `${title} ${n}` : title
}

function basePageTitle(loc: TitleSource, opts?: { long?: boolean }): string {
  const p = loc.path || ''
  if (p.startsWith('/test-cases/')) {
    const key = String((loc.params as Record<string, unknown>).category || '')
    const suite = findTestCaseSuite(key)
    if (opts?.long) return suite?.fullTitle || suite?.title || '测试用例'
    return suite?.title || '测试用例'
  }
  if (p.startsWith('/devices/detail/')) {
    const id = String((loc.params as Record<string, unknown>).id || '')
    return id ? `设备 ${id}` : '设备详情'
  }
  if (p.startsWith('/knowledge-handbook')) {
    return handbookCategoryLabel(String(loc.query.category || ''))
  }
  if (titleMap[p]) return titleMap[p]
  const metaTitle = loc.meta?.title
  if (typeof metaTitle === 'string' && metaTitle) return metaTitle
  return '移动自动化测试'
}

export function loadStoredPageTabs(): StoredPageTab[] {
  try {
    const raw = sessionStorage.getItem(PAGE_TABS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredPageTab[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t) => t && typeof t.key === 'string' && typeof t.fullPath === 'string')
  } catch {
    return []
  }
}

export function saveStoredPageTabs(tabs: StoredPageTab[]) {
  try {
    sessionStorage.setItem(PAGE_TABS_STORAGE_KEY, JSON.stringify(tabs.map(({ key, fullPath }) => ({ key, fullPath }))))
  } catch {
    // 隐私模式或配额满时忽略，页签仍在当前内存里
  }
}
