/**
 * 代码里的缓存 key 常量多半是前缀或模板（`user:info:`、`order:%s:detail`、`coupon:{userId}`），
 * 直接拿去精确查一定查不到。占位符换成 *，结尾不是 * 的补一个，变成能 SCAN 的模式。
 */
export function keyTemplateToPattern(template: string): string {
  const t = (template || '').trim()
  if (!t) return '*'
  const p = t
    .replace(/%[sd]/g, '*')
    .replace(/\{[^{}]*\}/g, '*')
    .replace(/\*{2,}/g, '*')
  return p.endsWith('*') ? p : `${p}*`
}

export function formatTtl(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms === -1) return '永不过期'
  if (ms === -2) return '已不存在'
  if (ms < 1000) return `${ms} 毫秒`
  let s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  if (d) return h ? `${d} 天 ${h} 小时` : `${d} 天`
  if (h) return m ? `${h} 小时 ${m} 分` : `${h} 小时`
  if (m) return s ? `${m} 分 ${s} 秒` : `${m} 分`
  return `${s} 秒`
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
