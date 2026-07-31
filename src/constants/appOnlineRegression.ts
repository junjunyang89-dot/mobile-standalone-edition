/** APP 线上回归：目标应用 / 功能项 / 预设 / 依赖排序常量 */

export type RegressionAppId = 'DOMESTIC_ESPORTS' | 'OVERSEAS_POGPOG'

export type RegressionFeatureId =
  | 'install'
  | 'login'
  | 'comment'
  | 'match'
  | 'activity'
  | 'square'
  | 'news'

/** 展开后的原子步骤（安装/卸载、登录/退出拆分） */
export type RegressionStepId =
  | 'install_pkg'
  | 'launch'
  | 'login'
  | 'comment'
  | 'match'
  | 'activity'
  | 'square'
  | 'news'
  | 'logout'
  | 'relogin'
  | 'uninstall_pkg'

export interface RegressionAppOption {
  id: RegressionAppId
  name: string
  subtitle: string
  /** 国内电竞走 ANDROID/IOS；海外 PogPog 走 POG 族平台标签，设备池仍为 Android/iOS */
  platformHint: string
  needsOverseasProxy: boolean
}

export interface RegressionFeatureOption {
  id: RegressionFeatureId
  name: string
  description: string
  needsAccount: boolean
}

export const REGRESSION_APPS: RegressionAppOption[] = [
  {
    id: 'DOMESTIC_ESPORTS',
    name: '国内电竞',
    subtitle: 'iOS / Android（国内包）',
    platformHint: '国内 · ANDROID & iOS',
    needsOverseasProxy: false
  },
  {
    id: 'OVERSEAS_POGPOG',
    name: '海外 PogPog',
    subtitle: 'iOS / Android（海外包）',
    platformHint: '海外 · POG-Android & POG-iOS',
    needsOverseasProxy: true
  }
]

export const REGRESSION_FEATURES: RegressionFeatureOption[] = [
  {
    id: 'login',
    name: '账号登录与退出',
    description: '✅ 登录→退出→再登录（双机两个账号随机分配；iOS 含弹窗与人工点选认证等待）',
    needsAccount: true
  },
  {
    id: 'comment',
    name: '互动发评论',
    description: '⚠️ 页上可选，当前后端跳过（脚本另有，编排未挂）',
    needsAccount: true
  },
  { id: 'match', name: '赛事浏览（CS / DOTA2 当天）', description: '✅ 已接入', needsAccount: false },
  { id: 'activity', name: '活动登录与查看', description: '✅ 已接入', needsAccount: true },
  { id: 'square', name: '广场信息流浏览', description: '⚠️ 当前跳过', needsAccount: false },
  { id: 'news', name: '发现-资讯页浏览', description: '✅ 已接入', needsAccount: false },
  {
    id: 'install',
    name: '安装/卸载/启动',
    description: '✅ 编排末尾验证：卸→商店装→CLI 启动（避免前置弹窗干扰登录/浏览）',
    needsAccount: false
  }
]

/** 依赖排序权重（越小越先执行）— 安装/卸载/启动固定排在末尾 */
export const STEP_ORDER_WEIGHT: Record<RegressionStepId, number> = {
  login: 30,
  logout: 32,
  relogin: 34,
  comment: 40,
  match: 41,
  activity: 42,
  square: 43,
  news: 44,
  uninstall_pkg: 90,
  install_pkg: 91,
  launch: 92
}

export const STEP_LABEL: Record<RegressionStepId, string> = {
  install_pkg: '包体安装',
  launch: '应用启动',
  login: '账号登录',
  comment: '互动发评论',
  match: '赛事浏览（CS / DOTA2 当天）',
  activity: '活动登录与查看',
  square: '广场信息流浏览',
  news: '发现-资讯页浏览',
  logout: '账号退出',
  relogin: '账号再登录',
  uninstall_pkg: '卸载包体'
}

/** 功能勾选 → 原子步骤（安装=卸→装→启动；登录=登→退→再登） */
export const FEATURE_TO_STEPS: Record<RegressionFeatureId, RegressionStepId[]> = {
  install: ['uninstall_pkg', 'install_pkg', 'launch'],
  login: ['login', 'logout', 'relogin'],
  comment: ['comment'],
  match: ['match'],
  activity: ['activity'],
  square: ['square'],
  news: ['news']
}

export interface RegressionPreset {
  id: string
  name: string
  featureIds: RegressionFeatureId[]
}

export const REGRESSION_PRESETS: RegressionPreset[] = [
  {
    id: 'smoke',
    name: '一键冒烟（登录 + 赛事 + 末尾安装启动）',
    featureIds: ['login', 'match', 'install']
  },
  {
    id: 'smoke_plus',
    name: '冒烟+活动/资讯',
    featureIds: ['login', 'match', 'activity', 'news', 'install']
  },
  {
    id: 'full',
    name: '全量回归',
    featureIds: REGRESSION_FEATURES.map((f) => f.id)
  }
]

/** 默认测试账号池（手机号+验证码；优先使用后端 GET /online-regression/accounts） */
export interface RegressionAccount {
  id?: string
  label?: string
  phoneNumber: string
  verificationCode: string
  app: RegressionAppId
}

export const DEFAULT_ACCOUNT_POOL: RegressionAccount[] = [
  { id: 'or-acc-domestic-01', label: '线上回归账号1', phoneNumber: '18851663603', verificationCode: '487721', app: 'DOMESTIC_ESPORTS' },
  { id: 'or-acc-domestic-02', label: '线上回归账号2', phoneNumber: '12312340001', verificationCode: '660032', app: 'DOMESTIC_ESPORTS' },
  { id: 'or-acc-pog-01', label: 'PogPog线上账号1', phoneNumber: '18851663603', verificationCode: '487721', app: 'OVERSEAS_POGPOG' },
  { id: 'or-acc-pog-02', label: 'PogPog线上账号2', phoneNumber: '12312340001', verificationCode: '660032', app: 'OVERSEAS_POGPOG' }
]

export const HISTORY_STORAGE_KEY = 'app-online-regression-history-v1'
export const MAX_HISTORY = 20
