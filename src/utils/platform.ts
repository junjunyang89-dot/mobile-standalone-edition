/**
 * 与后端枚举一致的路径 / 请求参数取值（大写）。
 *
 * 平台只表达操作系统。海外应用（PogPog）由 appId 区分，不再有 POG_ANDROID / POG_IOS——
 * 那种写法把产品线混进平台，导致同一个元素要按平台各存一份，元素库直接翻倍。
 */
export const SUPPORTED_DEVICE_PLATFORMS = ['ANDROID', 'IOS', 'HARMONYOS'] as const

/** 历史遗留取值：仅用于展示存量数据，不再作为可选项 */
const LEGACY_PLATFORM_ALIASES: Record<string, SupportedDevicePlatform> = {
  POG_ANDROID: 'ANDROID',
  POGPOG: 'ANDROID',
  POG_IOS: 'IOS'
}

/** 归一到操作系统维度，存量数据里的 POG_* 也能正确识别 */
export function normalizePlatform(p?: string): string {
  const u = (p || '').toUpperCase()
  return LEGACY_PLATFORM_ALIASES[u] || u
}

export type SupportedDevicePlatform = (typeof SUPPORTED_DEVICE_PLATFORMS)[number]

export function isSupportedDevicePlatform(p: string): p is SupportedDevicePlatform {
  return (SUPPORTED_DEVICE_PLATFORMS as readonly string[]).includes(normalizePlatform(p))
}

/** 列表 / 详情展示用文案；存量的 POG_* 归一后展示，不再单列 */
export function platformUiLabel(p: string): string {
  const map: Record<string, string> = {
    ANDROID: 'Android',
    IOS: 'iOS',
    HARMONYOS: 'HarmonyOS'
  }
  return map[normalizePlatform(p)] || p || '—'
}

/** Element Plus el-tag type */
export function platformElTagType(p: string): 'success' | 'info' | 'warning' | 'danger' {
  const u = normalizePlatform(p)
  if (u === 'ANDROID') return 'success'
  if (u === 'IOS') return 'info'
  if (u === 'HARMONYOS') return 'warning'
  return 'info'
}

/** 用于样式 hook：pog_android / pog_ios / android / ios … */
export function platformRowClass(p: string): string {
  const u = normalizePlatform(p)
  return u ? u.toLowerCase().replace(/-/g, '_') : ''
}

/** 安装包选择：el-upload accept */
export function uploadAcceptForPlatform(platform: string): string {
  const u = normalizePlatform(platform)
  if (u === 'ANDROID') return '.apk'
  if (u === 'IOS') return '.ipa,.app'
  return '.apk,.ipa,.app'
}

export function uploadFileHintForPlatform(platform: string): string {
  const u = normalizePlatform(platform)
  if (u === 'ANDROID') return '仅支持上传 .apk 文件。'
  if (u === 'IOS') return '支持上传 .ipa、.app 文件。'
  if (u === 'HARMONYOS') return '支持 .apk / .ipa / .app（与现有鸿蒙流程一致）。'
  return '请先选择平台。'
}

/** 「仅 Android 设备」类判断（不含鸿蒙） */
export function isAndroidFamilyPlatform(platform: string): boolean {
  return normalizePlatform(platform) === 'ANDROID'
}

export function isIosFamilyPlatform(platform: string): boolean {
  return normalizePlatform(platform) === 'IOS'
}

/**
 * 任务所选 platform 与设备行 platform 是否匹配。
 * 平台去掉产品线维度后就是直接比较，不用再维护「同族平台」的对照表。
 */
export function deviceRowMatchesTaskPlatform(devicePlatform: string | undefined, selectedPlatform: string): boolean {
  const sel = normalizePlatform(selectedPlatform)
  return !!sel && sel === normalizePlatform(devicePlatform)
}
