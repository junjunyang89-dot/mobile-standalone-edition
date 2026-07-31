/** 与后端枚举一致的路径 / 请求参数取值（大写） */
export const SUPPORTED_DEVICE_PLATFORMS = [
  'ANDROID',
  'IOS',
  'HARMONYOS',
  'POG_ANDROID',
  'POG_IOS'
] as const

export type SupportedDevicePlatform = (typeof SUPPORTED_DEVICE_PLATFORMS)[number]

export function isSupportedDevicePlatform(p: string): p is SupportedDevicePlatform {
  return (SUPPORTED_DEVICE_PLATFORMS as readonly string[]).includes((p || '').toUpperCase())
}

/** 列表 / 详情展示用文案 */
export function platformUiLabel(p: string): string {
  const u = (p || '').toUpperCase()
  const map: Record<string, string> = {
    ANDROID: 'Android',
    IOS: 'iOS',
    HARMONYOS: 'HarmonyOS',
    POG_ANDROID: 'Pog-Android',
    POG_IOS: 'Pog-iOS',
    POGPOG: 'Pog（兼容）'
  }
  return map[u] || p || '—'
}

/** Element Plus el-tag type */
export function platformElTagType(p: string): 'success' | 'info' | 'warning' | 'danger' {
  const u = (p || '').toUpperCase()
  if (u === 'ANDROID' || u === 'POG_ANDROID') return 'success'
  if (u === 'IOS' || u === 'POG_IOS') return 'info'
  if (u === 'HARMONYOS') return 'warning'
  return 'info'
}

/** 用于样式 hook：pog_android / pog_ios / android / ios … */
export function platformRowClass(p: string): string {
  const u = (p || '').toUpperCase()
  if (!u) return ''
  return u.toLowerCase().replace(/-/g, '_')
}

/** 安装包选择：el-upload accept */
export function uploadAcceptForPlatform(platform: string): string {
  const u = (platform || '').toUpperCase()
  if (u === 'ANDROID' || u === 'POG_ANDROID') return '.apk'
  if (u === 'IOS' || u === 'POG_IOS') return '.ipa,.app'
  return '.apk,.ipa,.app'
}

export function uploadFileHintForPlatform(platform: string): string {
  const u = (platform || '').toUpperCase()
  if (u === 'POG_ANDROID' || u === 'ANDROID') return '仅支持上传 .apk 文件。'
  if (u === 'POG_IOS' || u === 'IOS') return '支持上传 .ipa、.app 文件。'
  if (u === 'HARMONYOS') return '支持 .apk / .ipa / .app（与现有鸿蒙流程一致）。'
  return '请先选择平台。'
}

/** 性能基础质量等「仅 Android 设备」类提示：含 Pog-Android */
export function isAndroidFamilyPlatform(platform: string): boolean {
  const u = (platform || '').toUpperCase()
  return u === 'ANDROID' || u === 'POG_ANDROID'
}

export function isIosFamilyPlatform(platform: string): boolean {
  const u = (platform || '').toUpperCase()
  return u === 'IOS' || u === 'POG_IOS'
}

/**
 * 任务所选 platform 与设备行 platform 是否匹配（后端对 ANDROID/POG_ANDROID、IOS/POG_IOS 已合并池时，
 * 列表里可能混有 ANDROID 与 POG_ANDROID 等，需一并展示）。
 */
export function deviceRowMatchesTaskPlatform(devicePlatform: string | undefined, selectedPlatform: string): boolean {
  const sel = (selectedPlatform || '').toUpperCase()
  const d = (devicePlatform || '').toUpperCase()
  if (!sel) return false
  if (d === sel) return true
  if (isAndroidFamilyPlatform(sel) && isAndroidFamilyPlatform(d)) return true
  if (isIosFamilyPlatform(sel) && isIosFamilyPlatform(d)) return true
  return false
}
