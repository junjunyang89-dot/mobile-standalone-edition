/**
 * 步骤颜色规范 · 对齐关键字库分类（编辑流程步骤序号 / 顶边 / 分类标签）
 * 细则见产品色板：DEVICE / ACTION / WAIT / FLOW / ASSERT
 */

export type StepKeywordCategory = 'DEVICE' | 'ACTION' | 'WAIT' | 'FLOW' | 'ASSERT'

export interface StepColorTone {
  /** 序号圆、顶边、分类文字 */
  color: string
  /** 标题栏浅底 */
  softBg: string
  /** 卡片顶边 / 浅描边 */
  softBorder: string
  category: StepKeywordCategory
  categoryLabel: string
}

const TONES: Record<string, Omit<StepColorTone, 'category' | 'categoryLabel'>> = {
  DEVICE: { color: '#475569', softBg: '#f1f5f9', softBorder: '#cbd5e1' },
  ACTION: { color: '#2563eb', softBg: '#eff6ff', softBorder: '#bfdbfe' },
  WAIT: { color: '#d97706', softBg: '#fffbeb', softBorder: '#fde68a' },
  FLOW: { color: '#059669', softBg: '#ecfdf5', softBorder: '#a7f3d0' },
  FLOW_COND: { color: '#f97316', softBg: '#fff7ed', softBorder: '#fed7aa' },
  FLOW_COMPONENT: { color: '#7c3aed', softBg: '#f5f3ff', softBorder: '#ddd6fe' },
  FLOW_FAIL: { color: '#dc2626', softBg: '#fef2f2', softBorder: '#fecaca' },
  FLOW_SKIP: { color: '#94a3b8', softBg: '#f8fafc', softBorder: '#e2e8f0' },
  ASSERT: { color: '#e11d48', softBg: '#fff1f2', softBorder: '#fecdd3' }
}

/** 精确到 code 的色板（优先于 category 兜底） */
const CODE_TONE_KEY: Record<string, keyof typeof TONES> = {
  // DEVICE · 石板灰 #475569
  COLD_START: 'DEVICE',
  HOT_START: 'DEVICE',
  LAUNCH_APP: 'DEVICE',
  INSTALL_APP: 'DEVICE',
  INSTALL_FROM_STORE: 'DEVICE',
  UNINSTALL_APP: 'DEVICE',
  KILL_AND_RESTORE: 'DEVICE',
  BACK: 'DEVICE',
  GO_HOME: 'DEVICE',
  SCREENSHOT: 'DEVICE',
  SET_NETWORK: 'DEVICE',
  DONT_KEEP_ACTIVITIES: 'DEVICE',
  COLD_START_IOS: 'DEVICE',
  HOT_START_IOS: 'DEVICE',
  LAUNCH_APP_IOS: 'DEVICE',

  // ACTION · 蓝 #2563eb
  CLICK: 'ACTION',
  CLICK_WHEN_ENABLED: 'ACTION',
  INPUT: 'ACTION',
  INPUT_EDITTEXT: 'ACTION',
  EDITTEXT: 'ACTION',
  CLEAR: 'ACTION',
  SWIPE: 'ACTION',
  SCROLL_UNTIL: 'ACTION',
  SCROLL_UNTIL_IOS: 'ACTION',
  SCROLL_UNTIL_SHORT: 'ACTION',

  // WAIT · 琥珀 #d97706
  WAIT: 'WAIT',
  WAIT_ELEMENT: 'WAIT',

  // FLOW 细分
  IF_ELEMENT_EXISTS: 'FLOW_COND',
  WAIT_ANY: 'FLOW_COND',
  CLICK_EACH: 'ACTION',
  CLICK_EACH_SWIPE: 'ACTION',
  CLICK_EACH_OPEN_BACK: 'ACTION',
  CLICK_EACH_THEN: 'FLOW_COND',
  CLICK_EACH_THEN_COMPONENT: 'FLOW_COND',
  DISMISS_POPUPS: 'FLOW',
  CALL_COMPONENT: 'FLOW_COMPONENT',
  RETURN_MESSAGE: 'FLOW',
  FINISH_SUCCESS: 'FLOW',
  FINISH_FAILED: 'FLOW_FAIL',
  FINISH_SKIPPED: 'FLOW_SKIP',

  // ASSERT · 玫红 #e11d48
  ASSERT_TEXT: 'ASSERT',
  ASSERT_NO_ERROR: 'ASSERT',
  ASSERT_ELEMENT_STATE: 'ASSERT'
}

const CATEGORY_LABEL: Record<StepKeywordCategory, string> = {
  DEVICE: 'DEVICE',
  ACTION: 'ACTION',
  WAIT: 'WAIT',
  FLOW: 'FLOW',
  ASSERT: 'ASSERT'
}

function normalizeCode(code: string) {
  return String(code || '')
    .trim()
    .toUpperCase()
}

function categoryFromToneKey(key: keyof typeof TONES): StepKeywordCategory {
  if (key === 'ACTION') return 'ACTION'
  if (key === 'WAIT') return 'WAIT'
  if (key === 'ASSERT') return 'ASSERT'
  if (key.startsWith('FLOW')) return 'FLOW'
  return 'DEVICE'
}

function categoryFromLibrary(category?: string): StepKeywordCategory {
  const c = String(category || '').toUpperCase()
  if (c === 'ACTION' || c === 'WAIT' || c === 'ASSERT' || c === 'FLOW' || c === 'DEVICE') {
    return c
  }
  return 'ACTION'
}

/**
 * 按关键字 code（及可选库里的 category）解析步骤色。
 * FLOW 内条件/结束等用细分色；未知 code 回退到关键字库分类色。
 */
export function stepColorByCode(code: string, libraryCategory?: string): StepColorTone {
  const normalized = normalizeCode(code)
  const toneKey = CODE_TONE_KEY[normalized]
  if (toneKey) {
    const tone = TONES[toneKey]
    const category = categoryFromToneKey(toneKey)
    return {
      ...tone,
      category,
      categoryLabel: CATEGORY_LABEL[category]
    }
  }
  const category = categoryFromLibrary(libraryCategory)
  const tone = TONES[category] || TONES.ACTION
  return {
    ...tone,
    category,
    categoryLabel: CATEGORY_LABEL[category]
  }
}

/** 内联 style 绑定用 */
export function stepColorStyle(code: string, libraryCategory?: string) {
  const t = stepColorByCode(code, libraryCategory)
  return {
    '--step-color': t.color,
    '--step-soft-bg': t.softBg,
    '--step-soft-border': t.softBorder
  } as Record<string, string>
}
