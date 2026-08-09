/** 知识手册：八大组 + 叶子分类（与后端 HandbookCategories 一致） */

export type HandbookCategoryCode =
  | 'business'
  | 'checklist'
  | 'app'
  | 'web'
  | 'miniprogram'
  | 'harmony'
  | 'mobile_os'
  | 'api'
  | 'db'
  | 'redis'
  | 'linux'
  | 'docker'
  | 'k8s'
  | 'jenkins'
  | 'tomcat'
  | 'nginx'
  | 'env_setup'
  | 'case_design'
  | 'perf'
  | 'flaky'
  | 'troubleshoot'
  | 'jvm_log'
  | 'packet'
  | 'security'
  | 'git'
  | 'defect_collab'
  | 'tools'
  | 'cheatsheet'
  | 'appium'
  | 'playwright'
  | 'auto_framework'

export interface HandbookCategory {
  code: HandbookCategoryCode
  label: string
}

export interface HandbookGroup {
  id: string
  label: string
  categories: HandbookCategory[]
}

/** 旧版 code → 新版 */
const LEGACY_ALIASES: Record<string, HandbookCategoryCode> = {
  shell: 'linux',
  automation: 'auto_framework',
  pitfall: 'troubleshoot'
}

export const HANDBOOK_GROUPS: HandbookGroup[] = [
  {
    id: 'business',
    label: '业务',
    categories: [
      { code: 'business', label: '业务经验' },
      { code: 'checklist', label: '测试规范 / 发布 checklist' }
    ]
  },
  {
    id: 'client',
    label: '端侧',
    categories: [
      { code: 'app', label: 'APP 经验' },
      { code: 'web', label: 'Web / H5 经验' },
      { code: 'miniprogram', label: '小程序经验' },
      { code: 'harmony', label: '鸿蒙经验' },
      { code: 'mobile_os', label: 'iOS / Android 系统经验' }
    ]
  },
  {
    id: 'data',
    label: '接口与数据',
    categories: [
      { code: 'api', label: '接口经验' },
      { code: 'db', label: '数据库经验（MySQL / SQL）' },
      { code: 'redis', label: 'Redis 经验' }
    ]
  },
  {
    id: 'ops',
    label: '环境与运维',
    categories: [
      { code: 'linux', label: 'Linux / Shell 经验' },
      { code: 'docker', label: 'Docker 经验' },
      { code: 'k8s', label: 'K8S 经验' },
      { code: 'jenkins', label: 'Jenkins / CI/CD 经验' },
      { code: 'tomcat', label: 'Tomcat / 部署经验' },
      { code: 'nginx', label: 'Nginx 经验' },
      { code: 'env_setup', label: '环境搭建经验' }
    ]
  },
  {
    id: 'quality',
    label: '质量与排障',
    categories: [
      { code: 'case_design', label: '用例设计经验' },
      { code: 'perf', label: '性能测试经验' },
      { code: 'flaky', label: '稳定性 / Flaky 经验' },
      { code: 'troubleshoot', label: '失败归因 / 排障经验' },
      { code: 'jvm_log', label: 'JVM / 日志排障经验' },
      { code: 'packet', label: '抓包经验' },
      { code: 'security', label: '账号权限 / 安全基础' }
    ]
  },
  {
    id: 'collab',
    label: '工程协作',
    categories: [
      { code: 'git', label: 'Git 经验' },
      { code: 'defect_collab', label: '提测 / 缺陷协作经验' }
    ]
  },
  {
    id: 'tools',
    label: '工具与速查',
    categories: [
      { code: 'tools', label: '常用工具汇总' },
      { code: 'cheatsheet', label: '常用命令 / 配置速查' }
    ]
  },
  {
    id: 'automation',
    label: '自动化',
    categories: [
      { code: 'appium', label: 'Appium 经验' },
      { code: 'playwright', label: 'Playwright 经验' },
      { code: 'auto_framework', label: '自动化框架经验' }
    ]
  }
]

/** 扁平叶子列表（下拉 / 校验） */
export const HANDBOOK_CATEGORIES: HandbookCategory[] = HANDBOOK_GROUPS.flatMap((g) => g.categories)

export const DEFAULT_HANDBOOK_CATEGORY: HandbookCategoryCode = 'app'

export function normalizeHandbookCategory(code?: string | null): HandbookCategoryCode {
  if (!code) return DEFAULT_HANDBOOK_CATEGORY
  const raw = code.trim().toLowerCase()
  const mapped = LEGACY_ALIASES[raw] || raw
  const hit = HANDBOOK_CATEGORIES.find((c) => c.code === mapped)
  return hit?.code || DEFAULT_HANDBOOK_CATEGORY
}

export function handbookCategoryLabel(code?: string | null): string {
  if (!code) return '知识手册'
  const n = normalizeHandbookCategory(code)
  const hit = HANDBOOK_CATEGORIES.find((c) => c.code === n)
  return hit?.label || code
}

export function handbookGroupIdForCategory(code?: string | null): string {
  const n = normalizeHandbookCategory(code)
  const g = HANDBOOK_GROUPS.find((group) => group.categories.some((c) => c.code === n))
  return g ? `kh-${g.id}` : 'knowledge-handbook'
}

/** 业务 / 测试规范：项目必填 */
export function handbookProjectRequired(code?: string | null): boolean {
  const n = normalizeHandbookCategory(code)
  return n === 'business' || n === 'checklist'
}
