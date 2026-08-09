import type { RegressionAppId, RegressionFlowOption } from '@/constants/appOnlineRegression'
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
  endpoint: 'android' | 'ios' | 'other'
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
  return 'other'
}

/** 回归用例按端分组：ANDROID 族 / iOS 族 / 未指定(双端都跑) */
export type FlowPlatformBucket = 'android' | 'ios' | 'shared'

export function flowPlatformBucket(platform?: string): FlowPlatformBucket {
  const u = (platform || '').trim().toUpperCase()
  if (!u || u === 'ALL' || u === 'BOTH' || u === 'SHARED') return 'shared'
  if (isAndroidFamilyPlatform(u) || u === 'HARMONYOS') return 'android'
  if (isIosFamilyPlatform(u)) return 'ios'
  return 'shared'
}

export function partitionRegressionFlows(flows: RegressionFlowOption[]): {
  android: RegressionFlowOption[]
  ios: RegressionFlowOption[]
  shared: RegressionFlowOption[]
} {
  const android: RegressionFlowOption[] = []
  const ios: RegressionFlowOption[] = []
  const shared: RegressionFlowOption[] = []
  for (const f of flows) {
    const b = flowPlatformBucket(f.platform)
    if (b === 'android') android.push(f)
    else if (b === 'ios') ios.push(f)
    else shared.push(f)
  }
  return { android, ios, shared }
}

/**
 * 提交给后端的 flowIds：Android 勾选顺序 + 双端共用 + iOS 勾选顺序。
 * 后端按设备平台过滤后，各端相对顺序保持独立。
 */
export function mergePlatformOrderedFlowIds(
  androidIds: string[],
  sharedIds: string[],
  iosIds: string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of [...androidIds, ...sharedIds, ...iosIds]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const APP_LABEL: Record<RegressionAppId, string> = {
  DOMESTIC_ESPORTS: '国内电竞',
  OVERSEAS_POGPOG: '海外 PogPog'
}

/**
 * APP × 设备矩阵。
 * 默认笛卡尔积（仅 Android/iOS 族设备）；可通过 excludeKeys 去掉不需要的配对。
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
      if (endpoint === 'other') continue
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
