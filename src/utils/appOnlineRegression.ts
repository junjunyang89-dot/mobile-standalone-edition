import type { RegressionAppId, RegressionFlowOption } from '@/constants/appOnlineRegression'
import { isHarmonyRegressionApp } from '@/constants/appOnlineRegression'
import { isAndroidFamilyPlatform, isIosFamilyPlatform } from '@/utils/platform'

export interface RegressionDeviceRef {
  id: string
  name: string
  platform: string
  status?: string
}

export interface MatrixJob {
  /** 唯一键：appId + deviceId */
  key: string
  appId: RegressionAppId
  appName: string
  deviceId: string
  deviceName: string
  devicePlatform: string
  /** 端别：用于报告左右对比 */
  endpoint: 'android' | 'ios' | 'harmony' | 'other'
}

export interface OrderedStep {
  id: string
  label: string
  weight: number
  catalog?: string
}

/**
 * 勾选流程 → 按勾选顺序（flowIds 数组顺序）生成执行列表。
 * 不去重后重排 sort_order；后勾选的排在后面。
 */
export function buildOrderedSteps(
  flowIds: string[],
  flows: RegressionFlowOption[]
): OrderedStep[] {
  const byId = new Map(flows.map((f) => [f.id, f]))
  const unique = Array.from(new Set(flowIds.filter(Boolean)))
  const steps: OrderedStep[] = []
  for (const id of unique) {
    const f = byId.get(id)
    if (!f) continue
    steps.push({
      id: f.id,
      label: f.name || f.id,
      weight: f.sortOrder ?? 100,
      catalog: f.catalog
    })
  }
  return steps
}

export function deviceEndpoint(platform: string): MatrixJob['endpoint'] {
  if (isAndroidFamilyPlatform(platform)) return 'android'
  if (isIosFamilyPlatform(platform)) return 'ios'
  const u = String(platform || '').toUpperCase()
  if (u.startsWith('HARMONY')) return 'harmony'
  return 'other'
}

/** 该 APP 卡能配哪些端的设备 */
export function endpointAllowedForApp(
  appId: RegressionAppId,
  endpoint: MatrixJob['endpoint']
): boolean {
  if (isHarmonyRegressionApp(appId)) return endpoint === 'harmony'
  return endpoint === 'android' || endpoint === 'ios'
}

/** 回归用例按端分组：ANDROID 族 / iOS 族 / 未指定(双端都跑) */
export type FlowPlatformBucket = 'android' | 'ios' | 'harmony' | 'shared'

export function flowPlatformBucket(platform?: string): FlowPlatformBucket {
  const u = (platform || '').trim().toUpperCase()
  if (!u || u === 'ALL' || u === 'BOTH' || u === 'SHARED') return 'shared'
  // 鸿蒙独立成一档。原来归进 android 桶，但后端 platformMatches 里
  // ANDROID 只匹配 ANDROID / POG_ANDROID——鸿蒙流程配 Android 设备会被<b>静默跳过</b>。
  // 于是界面上勾了、执行时没跑、报告里也不提，最难查的就是这种「勾了等于没勾」
  if (u === 'HARMONYOS' || u === 'HARMONY') return 'harmony'
  if (isAndroidFamilyPlatform(u)) return 'android'
  if (isIosFamilyPlatform(u)) return 'ios'
  return 'shared'
}

export function partitionRegressionFlows(flows: RegressionFlowOption[]): {
  android: RegressionFlowOption[]
  ios: RegressionFlowOption[]
  harmony: RegressionFlowOption[]
  shared: RegressionFlowOption[]
} {
  const android: RegressionFlowOption[] = []
  const ios: RegressionFlowOption[] = []
  const harmony: RegressionFlowOption[] = []
  const shared: RegressionFlowOption[] = []
  for (const f of flows) {
    const b = flowPlatformBucket(f.platform)
    if (b === 'android') android.push(f)
    else if (b === 'ios') ios.push(f)
    else if (b === 'harmony') harmony.push(f)
    else shared.push(f)
  }
  return { android, ios, harmony, shared }
}

/**
 * 提交给后端的 flowIds：Android + 共用 + iOS + 鸿蒙，各端勾选顺序保持独立。
 * 后端按设备平台过滤后，各端相对顺序不变。
 */
export function mergePlatformOrderedFlowIds(
  androidIds: string[],
  sharedIds: string[],
  iosIds: string[],
  harmonyIds: string[] = []
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...androidIds, ...sharedIds, ...iosIds, ...harmonyIds]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const APP_LABEL: Record<RegressionAppId, string> = {
  DOMESTIC_ESPORTS: '国内电竞',
  DOMESTIC_ESPORTS_HARMONY: '国内电竞·鸿蒙',
  OVERSEAS_POGPOG: '海外 PogPog'
}

export function regressionAppLabel(appId: RegressionAppId | string): string {
  return APP_LABEL[appId as RegressionAppId] || String(appId || '')
}

/**
 * APP × 设备矩阵。
 * 国内/海外只配 Android/iOS；鸿蒙卡只配鸿蒙机。
 */
export function buildAppDeviceMatrix(
  appIds: RegressionAppId[],
  devices: RegressionDeviceRef[],
  excludeKeys: string[] = []
): MatrixJob[] {
  const exclude = new Set(excludeKeys)
  const jobs: MatrixJob[] = []

  for (const appId of appIds) {
    for (const d of devices) {
      const endpoint = deviceEndpoint(d.platform)
      if (!endpointAllowedForApp(appId, endpoint)) continue
      const key = `${appId}__${d.id}`
      if (exclude.has(key)) continue
      jobs.push({
        key,
        appId,
        appName: APP_LABEL[appId],
        deviceId: d.id,
        deviceName: d.name || d.id,
        devicePlatform: d.platform,
        endpoint
      })
    }
  }

  return jobs
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}m ${rest}s`
}

/**
 * 通过率口径：只统计 success / failed；skipped / pending 不进分母。
 * 优先使用后端 passRate（有值时）。
 */
export function resolvePassRate(
  steps: Array<{ status: string }>,
  backendPassRate?: number | null
): number {
  if (backendPassRate != null && Number.isFinite(Number(backendPassRate))) {
    return Math.round(Number(backendPassRate))
  }
  const done = steps.filter((s) => {
    const st = (s.status || '').toLowerCase()
    return st === 'success' || st === 'failed'
  })
  if (!done.length) return 0
  const ok = done.filter((s) => (s.status || '').toLowerCase() === 'success').length
  return Math.round((ok / done.length) * 100)
}

export function stepResultLabel(status: string): string {
  const st = (status || '').toLowerCase()
  if (st === 'success') return '通过'
  if (st === 'failed') return '失败'
  if (st === 'skipped') return '跳过'
  if (st === 'running') return '执行中'
  if (st === 'pending') return '待执行'
  return status || '-'
}

export function stepResultTagType(status: string): 'success' | 'danger' | 'info' | 'warning' {
  const st = (status || '').toLowerCase()
  if (st === 'success') return 'success'
  if (st === 'failed') return 'danger'
  if (st === 'skipped') return 'info'
  if (st === 'running') return 'warning'
  return 'info'
}

/**
 * 这条流程会出现在哪几轮回归里。
 *
 * 场景不是流程上的第五个字段，是由「用途 + 环境 + 绑定环境 + 功能阶段」算出来的。
 * 但建流程的人没法在脑子里跑这段逻辑——四个开关组合出四种结果，还没有任何反馈，
 * 于是只能靠试：建完去回归页看勾不勾得到，勾不到再回来改。
 *
 * 这个函数就是把那段推导直接显示出来。它<b>镜像后端 isBatchEligible 的规则</b>，
 * 只作提示用；真正决定跑不跑的仍然是后端，两边万一不一致以后端为准。
 */
export function scenesForFlow(input: {
  catalog?: string
  environment?: string
  envBound?: boolean
  releaseStage?: string
}): string[] {
  const catalog = (input.catalog || 'SHARED').toUpperCase()
  // 只有进回归入口的才谈场景；装包准备 / 仅自动化 / 仅性能都不进回归的勾选列表
  if (catalog !== 'ONLINE' && catalog !== 'SHARED') {
    return []
  }
  const bound = input.envBound !== false
  const env = (input.environment || 'PROD').toUpperCase()
  const online = (input.releaseStage || 'ONLINE').toUpperCase() !== 'TESTING'

  const out: string[] = []
  // ① 测试环境后端 + 新 debug 包
  if (!bound || env === 'TEST') out.push('① 提测回归')
  // ② 生产后端 + 新 debug 包
  if (!bound || env === 'PROD') out.push('② 新包 · 生产环境验证')
  // ③④ 生产后端 + 线上正式包：只有「已上线」的功能，那个包里才有
  if ((!bound || env === 'PROD') && online) {
    out.push('③ 老包 · 向后兼容')
    out.push('④ 日常线上回归')
  }
  return out
}
