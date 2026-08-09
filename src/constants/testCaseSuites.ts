/** 测试用例库（侧栏分类）；title 尽量短，避免 240px 侧栏被截断 */
export interface TestCaseSuite {
  key: string
  /** 侧栏与页头展示名 */
  title: string
  /** 悬停完整说明（可选） */
  fullTitle?: string
  hint: string
}

export const TEST_CASE_SUITES: TestCaseSuite[] = [
  {
    key: 'performance',
    title: '性能',
    hint: '性能场景相关用例文档'
  },
  {
    key: 'domestic-api',
    title: '国内接口',
    hint: '国内接口 / 服务端用例文档'
  },
  {
    key: 'wmpvp-ios',
    title: '电竞（iOS）',
    fullTitle: '完美世界电竞 APP 功能（iOS）',
    hint: '电竞 App iOS 功能用例'
  },
  {
    key: 'wmpvp-android',
    title: '电竞（安卓）',
    fullTitle: '完美世界电竞 APP 功能（安卓）',
    hint: '电竞 App Android 功能用例'
  },
  {
    key: 'pogpog-ios',
    title: 'PogPog（iOS）',
    hint: 'PogPog iOS 用例'
  },
  {
    key: 'pogpog-android',
    title: 'PogPog（安卓）',
    hint: 'PogPog Android 用例'
  },
  {
    key: 'deadlock-web',
    title: 'DEADLOCK WEB',
    fullTitle: 'DEADLOCK WEB 站',
    hint: 'DEADLOCK Web 站用例'
  }
]

export function findTestCaseSuite(key?: string | null): TestCaseSuite | undefined {
  if (!key) return undefined
  return TEST_CASE_SUITES.find((s) => s.key === key)
}
