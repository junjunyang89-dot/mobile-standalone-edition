/**
 * 只调整缩进的 JSON 格式化：逐字符走一遍，不经过 JSON.parse 再 stringify。
 * 走 parse 的话超过 2^53 的长整型 id 会被改掉末几位，发出去的就不是原来那条消息了。
 * JSON.parse 只用来判断语法对不对。
 */
export function prettyJsonText(src: string, indent = 2): { ok: true; text: string } | { ok: false; error: string } {
  const s = (src || '').trim()
  if (!s) return { ok: false, error: '内容为空' }
  try {
    JSON.parse(s)
  } catch (e: any) {
    return { ok: false, error: `不是合法 JSON：${e?.message || e}` }
  }
  const pad = (n: number) => ' '.repeat(n * indent)
  let out = ''
  let depth = 0
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      out += c
      if (c === '\\') {
        out += s[++i] ?? ''
      } else if (c === '"') {
        inStr = false
      }
      continue
    }
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue
    if (c === '"') {
      inStr = true
      out += c
    } else if (c === '{' || c === '[') {
      const close = c === '{' ? '}' : ']'
      let j = i + 1
      while (j < s.length && /\s/.test(s[j])) j++
      if (s[j] === close) {
        out += c + close
        i = j
      } else {
        depth++
        out += `${c}\n${pad(depth)}`
      }
    } else if (c === '}' || c === ']') {
      depth--
      out += `\n${pad(depth)}${c}`
    } else if (c === ',') {
      out += `,\n${pad(depth)}`
    } else if (c === ':') {
      out += ': '
    } else {
      out += c
    }
  }
  return { ok: true, text: out }
}
