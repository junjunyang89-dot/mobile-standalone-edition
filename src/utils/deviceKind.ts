/** 后端字段是 isEmulator；Jackson 若走 getter 名也可能是 emulator */
export function isEmulatorDevice(d: {
  id?: string
  isEmulator?: boolean
  emulator?: boolean
} | null | undefined) {
  if (d?.isEmulator === true || d?.emulator === true) return true
  // 加列之前扫进来的本地 AVD，库里 is_emulator 常是空的；序列号本身没有歧义
  return String(d?.id || '').startsWith('emulator-')
}
