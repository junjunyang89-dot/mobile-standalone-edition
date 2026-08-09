/**
 * 页面编码的生成与归一。
 *
 * 抽出来是因为「元素管理」和「真机点选采集」都要新建页面，各写一份必然漂——
 * 两边生成的编码规则一旦不一致，同一个页面会在库里出现两条。
 */

/** 常见页面的固定编码：人手工建过一次之后，下次点选采集应当落到同一个 pageId 上 */
const KNOWN_PAGES: Record<string, string> = {
  温馨提示: 'PRIVACY_WARM_TIP',
  输入手机号: 'LOGIN_PHONE',
  验证码: 'LOGIN_SMS',
  发现: 'CS_DISCOVER',
  社区: 'CS_COMMUNITY',
  我的: 'MINE',
  赛程: 'MATCH_SCHEDULE',
  侧边栏: 'SIDEBAR'
}

/** 按中文名猜一个页面编码；猜不出就给个带时间戳的占位，让人自己改 */
export function suggestPageId(nameZh: string): string {
  const zh = String(nameZh || '')
  for (const [k, v] of Object.entries(KNOWN_PAGES)) {
    if (zh.includes(k)) return v
  }
  const ascii = zh
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
  if (ascii && /^[A-Z][A-Z0-9_]{0,60}$/.test(ascii)) return ascii
  return 'PAGE_' + Date.now().toString(36).toUpperCase()
}

/** 人手打的编码统一成 A_B_C 形态，避免 login-phone / login phone / LOGIN_PHONE 各存一条 */
export function normalizePageId(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/** 下拉里显示成「中文名（PAGE_ID）」，只有编码时就显示编码 */
export function pageOptionLabel(p: { pageId?: string; nameZh?: string }): string {
  const id = String(p?.pageId || '')
  const zh = String(p?.nameZh || '').trim()
  return zh ? `${zh}（${id}）` : id
}
