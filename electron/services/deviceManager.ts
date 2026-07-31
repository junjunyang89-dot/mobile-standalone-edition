import { EventEmitter } from 'events'
import * as usb from 'usb'

export interface Device {
  id: string
  name: string
  platform: 'android' | 'ios' | 'harmonyos'
  version?: string
  status: 'connected' | 'disconnected'
  lastSeen: number
}

export class DeviceManager extends EventEmitter {
  private devices: Map<string, Device> = new Map()
  private scanInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startScanning()
  }

  private startScanning() {
    // 扫描USB设备
    this.scanDevices()
    this.scanInterval = setInterval(() => {
      this.scanDevices()
    }, 3000) // 每3秒扫描一次
  }

  private scanDevices() {
    try {
      const usbDevices = usb.getDeviceList()
      const currentDeviceIds = new Set<string>()

      // 检测Android/HarmonyOS设备（通过USB）
      usbDevices.forEach((device) => {
        const vendorId = device.deviceDescriptor.idVendor
        const productId = device.deviceDescriptor.idProduct
        
        // 这里需要根据实际的设备特征来识别
        // 实际项目中需要使用adb或fastboot来检测
        if (this.isAndroidDevice(vendorId, productId)) {
          const deviceId = `${vendorId}-${productId}`
          currentDeviceIds.add(deviceId)

          if (!this.devices.has(deviceId)) {
            const newDevice: Device = {
              id: deviceId,
              name: `Android Device ${deviceId}`,
              platform: 'android',
              status: 'connected',
              lastSeen: Date.now()
            }
            this.devices.set(deviceId, newDevice)
            this.emit('device-connected', newDevice)
          } else {
            const device = this.devices.get(deviceId)!
            device.lastSeen = Date.now()
            if (device.status === 'disconnected') {
              device.status = 'connected'
              this.emit('device-connected', device)
            }
          }
        }
      })

      // 检测已断开的设备
      this.devices.forEach((device, deviceId) => {
        if (!currentDeviceIds.has(deviceId) && device.status === 'connected') {
          device.status = 'disconnected'
          this.emit('device-disconnected', deviceId)
        }
      })
    } catch (error) {
      console.error('Device scan error:', error)
    }
  }

  private isAndroidDevice(vendorId: number, productId: number): boolean {
    // 这里应该实现实际的Android设备检测逻辑
    // 实际项目中需要使用adb devices命令
    // 暂时返回false，避免误检测
    return false
  }

  async listDevices(): Promise<Device[]> {
    return Array.from(this.devices.values())
  }

  async connectDevice(deviceId: string): Promise<Device | null> {
    const device = this.devices.get(deviceId)
    if (device) {
      device.status = 'connected'
      return device
    }
    return null
  }

  async disconnectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (device) {
      device.status = 'disconnected'
      return true
    }
    return false
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }
  }
}
