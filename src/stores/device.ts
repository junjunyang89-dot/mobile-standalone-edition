import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'

export interface Device {
  id: string
  name: string
  platform: string
  version?: string
  status: string
  lastSeen?: string | number
  config?: string
}

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const loading = ref(false)

  const PLATFORMS = ['ANDROID', 'IOS', 'HARMONYOS', 'POG_ANDROID', 'POG_IOS'] as const

  /**
   * 获取设备列表：GET {baseUrl}/devices 或 GET {baseUrl}/devices/platform/{platform}
   * 后端直接返回 JSON 数组，表格数据源与「共 X 台设备」均用该数组
   */
  const fetchDevices = async (platform?: (typeof PLATFORMS)[number] | '' | string) => {
    const p = platform && PLATFORMS.includes(platform as any) ? (platform as (typeof PLATFORMS)[number]) : undefined
    loading.value = true
    try {
      const raw = p ? await apiClient.getDevicesByPlatform(p) : await apiClient.getDevices()
      devices.value = Array.isArray(raw) ? raw : []
    } catch (error) {
      console.error('Fetch devices error:', error)
      devices.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  /** 先调用后端扫描设备，再拉取列表；Electron 下也走后端扫描以便拿到最新设备 */
  const scanAndFetchDevices = async (platform?: (typeof PLATFORMS)[number] | '' | string) => {
    try {
      await apiClient.scanDevices()
    } catch (e) {
      console.warn('Scan devices failed:', e)
    }
    await fetchDevices(platform)
  }

  const connectDevice = async (deviceId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.device.connect(deviceId)
      } else {
        await apiClient.connectDevice(deviceId)
      }
      await fetchDevices()
    } catch (error) {
      console.error('Connect device error:', error)
      throw error
    }
  }

  const disconnectDevice = async (deviceId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.device.disconnect(deviceId)
      } else {
        await apiClient.disconnectDevice(deviceId)
      }
      await fetchDevices()
    } catch (error) {
      console.error('Disconnect device error:', error)
      throw error
    }
  }

  return {
    devices,
    loading,
    fetchDevices,
    scanAndFetchDevices,
    connectDevice,
    disconnectDevice
  }
})
