import {
  FEATURE_TO_STEPS,
  STEP_LABEL,
  STEP_ORDER_WEIGHT,
  type RegressionAppId,
  type RegressionFeatureId,
  type RegressionStepId
} from '@/constants/appOnlineRegression'
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
  id: RegressionStepId
  label: string
  weight: number
  /** 来源功能勾选项 */
  fromFeature: RegressionFeatureId
}

/**
 * 勾选功能 → 依赖智能排序后的原子步骤列表。
 * 规则：登录 → 退出 → 再登录 → 消费/浏览 → 卸载 → 安装 → 启动（安装套件固定末尾）
 */
export function buildOrderedSteps(featureIds: RegressionFeatureId[]): OrderedStep[] {
  const unique = Array.from(new Set(featureIds))
  const steps: OrderedStep[] = []
  const seen = new Set<RegressionStepId>()

  for (const fid of unique) {
    const expanded = FEATURE_TO_STEPS[fid] || []
    for (const sid of expanded) {
      if (seen.has(sid)) continue
      seen.add(sid)
      steps.push({
        id: sid,
        label: STEP_LABEL[sid],
        weight: STEP_ORDER_WEIGHT[sid],
        fromFeature: fid
      })
    }
  }

  return steps.sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id))
}

export function deviceEndpoint(platform: string): MatrixJob['endpoint'] {
  if (isAndroidFamilyPlatform(platform)) return 'android'
  if (isIosFamilyPlatform(platform)) return 'ios'
  return 'other'
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
