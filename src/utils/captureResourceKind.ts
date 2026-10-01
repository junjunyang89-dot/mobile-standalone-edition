/** 与后端 CaptureResourceKind 同一套规则：路径后缀优先，其次 Content-Type。 */

export type CaptureKind = 'api' | 'js' | 'css' | 'image' | 'page' | 'other'

export const CAPTURE_KIND_TABS: Array<{ id: CaptureKind; label: string }> = [
  { id: 'api', label: '接口' },
  { id: 'js', label: 'JS' },
  { id: 'css', label: 'CSS' },
  { id: 'image', label: '图片' },
  { id: 'page', label: '页面' },
  { id: 'other', label: '其他' }
]

const JS_EXT = new Set(['js', 'mjs', 'cjs'])
const CSS_EXT = new Set(['css'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'])
const PAGE_EXT = new Set(['html', 'htm', 'xhtml'])
const OTHER_EXT = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'webm', 'mp3', 'm4a', 'm3u8', 'aac', 'map'])
const KINDS = new Set<CaptureKind>(CAPTURE_KIND_TABS.map((t) => t.id))

export function captureKind(row: {
  kind?: string
  path?: string
  respKind?: string
  respContentType?: string
}): CaptureKind {
  const given = String(row.kind || '')
  if (KINDS.has(given as CaptureKind)) return given as CaptureKind
  return classify(row.path, row.respKind || row.respContentType)
}

export function classify(path?: string, contentType?: string): CaptureKind {
  const ext = extension(path)
  if (ext) {
    if (JS_EXT.has(ext)) return 'js'
    if (CSS_EXT.has(ext)) return 'css'
    if (IMAGE_EXT.has(ext)) return 'image'
    if (PAGE_EXT.has(ext)) return 'page'
    if (OTHER_EXT.has(ext)) return 'other'
    if (ext === 'json') return 'api'
  }
  const ct = mime(contentType)
  if (ct.startsWith('image/')) return 'image'
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js'
  if (ct === 'text/css') return 'css'
  if (ct.includes('html')) return 'page'
  if (ct.startsWith('font/') || ct.startsWith('audio/') || ct.startsWith('video/')) return 'other'
  return 'api'
}

function extension(path?: string): string | null {
  if (!path) return null
  const file = path.split('?')[0].split('/').pop() || ''
  const dot = file.lastIndexOf('.')
  if (dot <= 0 || dot === file.length - 1) return null
  return file.slice(dot + 1).toLowerCase()
}

function mime(contentType?: string): string {
  if (!contentType) return ''
  return contentType.split(';')[0].trim().toLowerCase()
}
