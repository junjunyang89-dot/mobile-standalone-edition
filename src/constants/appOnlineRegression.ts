/** APP 回归（线上 + 测试环境）：目标应用 / 预设 flowId / 账号池 */

export type RegressionAppId =
  | 'DOMESTIC_ESPORTS'
  | 'DOMESTIC_ESPORTS_HARMONY'
  | 'OVERSEAS_POGPOG'

export interface RegressionAppOption {
  id: RegressionAppId
  name: string
  subtitle: string
  /** 图标角标文案 */
  iconLabel: string
  /** 图标色系 */
  iconTone: 'domestic' | 'harmony' | 'overseas'
  /** 底部标签 */
  tags: Array<{ label: string; tone: 'region' | 'android' | 'ios' | 'harmony' | 'overseas' }>
  needsOverseasProxy: boolean
}

/** 流程编排中的可选用例（由 GET /ui-flows?forRegression=true 动态拉取） */
export interface RegressionFlowOption {
  id: string
  name: string
  description?: string
  catalog?: string
  appId?: string
  platform?: string
  sortOrder?: number
  /** 名称/描述含登录类关键字时前端提示配置账号 */
  needsAccount?: boolean
}

export const REGRESSION_APPS: RegressionAppOption[] = [
  {
    id: 'DOMESTIC_ESPORTS',
    name: '国内电竞',
    subtitle: 'iOS / Android 双端国内包',
    iconLabel: '电竞',
    iconTone: 'domestic',
    tags: [
      { label: '国内', tone: 'region' },
      { label: 'Android', tone: 'android' },
      { label: 'iOS', tone: 'ios' }
    ],
    needsOverseasProxy: false
  },
  {
    id: 'DOMESTIC_ESPORTS_HARMONY',
    name: '国内电竞 · 鸿蒙',
    subtitle: '纯血鸿蒙独立包',
    iconLabel: '鸿蒙',
    iconTone: 'harmony',
    tags: [
      { label: '国内', tone: 'region' },
      { label: 'HarmonyOS', tone: 'harmony' }
    ],
    needsOverseasProxy: false
  },
  {
    id: 'OVERSEAS_POGPOG',
    name: '海外 PogPog',
    subtitle: 'iOS / Android 双端海外包',
    iconLabel: 'Pog',
    iconTone: 'overseas',
    tags: [
      { label: '海外', tone: 'overseas' },
      { label: 'Android', tone: 'android' },
      { label: 'iOS', tone: 'ios' }
    ],
    needsOverseasProxy: true
  }
]

export function isHarmonyRegressionApp(id: RegressionAppId | string | undefined): boolean {
  return id === 'DOMESTIC_ESPORTS_HARMONY'
}

/** 种子流程 id（与后端 seed_online_regression_flows.sql 对齐；仅作预设引用） */
export const SEED_FLOW_IDS = {
  loginLogoutAndroid: 'flow-login-logout-android',
  installVerifyAndroid: 'flow-install-verify-android',
  browseMatchAndroid: 'flow-browse-match-android',
  browseActivityAndroid: 'flow-browse-activity-android',
  browseNewsAndroid: 'flow-browse-news-android'
} as const

export function flowNeedsAccount(flow: Pick<RegressionFlowOption, 'id' | 'name' | 'description'>): boolean {
  const blob = `${flow.id || ''} ${flow.name || ''} ${flow.description || ''}`.toLowerCase()
  return /登录|login|logout|退出|账号|account/.test(blob)
}

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
