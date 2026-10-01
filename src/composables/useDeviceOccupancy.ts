import { onBeforeUnmount, ref } from 'vue'
import { apiClient } from '@/api'

export type DeviceOccupancy = {
  kind: string
  kindLabel: string
  label?: string
  refId?: string
  since?: string
  describe?: string
  mine?: boolean
}

/**
 * 设备池占用快照。共用设备时「这台空了没有」随时在变，
 * 列表和执行弹窗都该看同一份，不要各调各的 /lock。
 */
export function useDeviceOccupancy(intervalMs = 10000) {
  const occupancy = ref<Record<string, DeviceOccupancy>>({})
  const maxHoldMinutes = ref(120)
  let timer: number | undefined

  function of(deviceId?: string | null): DeviceOccupancy | null {
    if (!deviceId) return null
    return occupancy.value[deviceId] || null
  }

  function isMine(deviceId?: string | null) {
    return of(deviceId)?.mine === true
  }

  function isOccupied(deviceId?: string | null) {
    return !!of(deviceId)
  }

  function remainText(deviceId?: string | null) {
    const o = of(deviceId)
    if (!o?.since || String(o.kind || '').toUpperCase() !== 'MANUAL') return ''
    const left = maxHoldMinutes.value * 60 * 1000 - (Date.now() - Number(o.since))
    if (Number.isNaN(left)) return ''
    if (left <= 0) return '即将收回'
    return `剩 ${Math.max(1, Math.ceil(left / 60000))} 分钟`
  }

  async function load() {
    try {
      const res = await apiClient.getDeviceOccupancy()
      occupancy.value = res?.occupancy || {}
      if (res?.maxHoldMinutes) maxHoldMinutes.value = res.maxHoldMinutes
    } catch {
      /* 查不到就当没人占，别挡住整页 */
    }
  }

  function start() {
    void load()
    if (timer) window.clearInterval(timer)
    timer = window.setInterval(load, intervalMs)
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer)
      timer = undefined
    }
  }

  onBeforeUnmount(stop)

  return {
    occupancy,
    maxHoldMinutes,
    of,
    isMine,
    isOccupied,
    remainText,
    load,
    start,
    stop
  }
}
