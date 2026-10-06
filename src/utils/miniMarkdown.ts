/**
 * AI 回复用的轻量 Markdown → HTML（不含代码块，代码块由调用方先切出去单独渲染）。
 * 先转义再拼标签，输出可直接 v-html。
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function mdInline(raw: string): string {
  return raw
    .split(/(`[^`\n]+`)/g)
    .map((seg) =>
      /^`[^`\n]+`$/.test(seg)
        ? `<code>${esc(seg.slice(1, -1))}</code>`
        : esc(seg).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    )
    .join('')
}

const RE_H = /^#{1,6}\s+(.+)$/
const RE_CN_H = /^[一二三四五六七八九十]{1,3}、\S.{0,40}$/
const RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const RE_LI = /^(\s*)([-*+•]|\d{1,3}[.)、])\s+(.*)$/
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s)
const cells = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

function blockStart(lines: string[], i: number) {
  const s = lines[i]
  return (
    !s.trim() ||
    RE_H.test(s) ||
    RE_CN_H.test(s.trim()) ||
    RE_HR.test(s) ||
    RE_LI.test(s) ||
    /^\s*>/.test(s) ||
    (isTableRow(s) && RE_TABLE_SEP.test(lines[i + 1] || ''))
  )
}

type Li = { indent: number; ordered: boolean; num: number; text: string }

function renderList(items: Li[]): string {
  const base = items[0].indent
  const ordered = items[0].ordered
  const start = ordered && items[0].num !== 1 ? ` start="${items[0].num}" style="counter-reset: md-n ${items[0].num - 1}"` : ''
  let html = ordered ? `<ol class="md-ol"${start}>` : '<ul class="md-ul">'
  let i = 0
  while (i < items.length) {
    const it = items[i]
    const kids: Li[] = []
    let j = i + 1
    while (j < items.length && items[j].indent > base) kids.push(items[j++])
    html += `<li>${mdInline(it.text)}${kids.length ? renderList(kids) : ''}</li>`
    i = j
  }
  return html + (ordered ? '</ol>' : '</ul>')
}

export function mdBlocks(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) {
      i++
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = line.match(RE_H))) {
      out.push(`<div class="md-h">${mdInline(m[1])}</div>`)
      i++
    } else if (RE_CN_H.test(t)) {
      out.push(`<div class="md-h">${mdInline(t)}</div>`)
      i++
    } else if (RE_HR.test(line)) {
      out.push('<hr class="md-hr">')
      i++
    } else if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push(`<div class="md-quote">${mdBlocks(buf.join('\n'))}</div>`)
    } else if (isTableRow(line) && RE_TABLE_SEP.test(lines[i + 1] || '')) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]))
      out.push(
        '<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
          head.map((c) => `<th>${mdInline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + head.map((_, k) => `<td>${mdInline(r[k] || '')}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>'
      )
    } else if (RE_LI.test(line)) {
      const items: Li[] = []
      while (i < lines.length) {
        const s = lines[i]
        const lm = s.match(RE_LI)
        if (lm) {
          const indent = lm[1].replace(/\t/g, '    ').length
          if (items.length && indent <= items[0].indent && /\d/.test(lm[2]) !== items[0].ordered) break
          items.push({
            indent,
            ordered: /\d/.test(lm[2]),
            num: parseInt(lm[2], 10) || 1,
            text: lm[3]
          })
          i++
        } else if (s.trim() && /^\s{2,}/.test(s) && items.length) {
          items[items.length - 1].text += ' ' + s.trim()
          i++
        } else break
      }
      out.push(renderList(items))
    } else {
      const buf: string[] = []
      while (i < lines.length && (buf.length === 0 || !blockStart(lines, i))) buf.push(lines[i++].trim())
      out.push(`<p class="md-p">${buf.map(mdInline).join('<br>')}</p>`)
    }
  }
  return out.join('')
}
