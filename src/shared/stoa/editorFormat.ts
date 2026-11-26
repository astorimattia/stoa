// Clipboard HTML -> the plain-text editor format, so images, headings, lists,
// tables, links, bold and italic pasted from Substack, Google Docs or a web
// page survive. Images become one-line Markdown image lines (the same form
// the importer writes); links become [text](url); bold **x**; italic *x*;
// tables become "| a | b |" rows; dividers "---". Returns '' when the
// HTML holds nothing richer than text, so a plain text paste is untouched.
export const tableLine = (cells: string[]) => '| ' + cells.map((c) => String(c ?? '').replace(/[|\n\r]/g, '/').trim()).join(' | ') + ' |'
const isTableLine = (line: string) => /^\|.*\|$/.test(line) && line.length > 1
const tableCells = (line: string) => line.slice(1, -1).split('|').map((c) => c.trim())
const isDivider = (line: string) => /^(-{3,}|\*{3,}|_{3,})$/.test(line)

export function htmlToEditorText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc.body.querySelector('img, table, hr, h1, h2, h3, h4, li, blockquote, a[href], strong, b, em, i, span[style]')) return ''
  const out: string[] = []
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim()
  const imgLine = (img: Element, cap = '') => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
    if (!/^https:\/\//i.test(src)) return ''
    return '![' + clean(img.getAttribute('alt') || '').replace(/[\]]/g, ' ') + '](' + src.replace(/\s/g, '%20') + (cap ? ' "' + cap.replace(/"/g, "'") + '"' : '') + ')'
  }
  // Wraps text in a Markdown mark, keeping outer spaces outside the marks.
  const wrap = (t: string, l: string, r = l) => {
    const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    return m[2] ? m[1] + l + m[2] + r + m[3] : t
  }
  const inline = (node: Node, inLink = false): string => {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ')
    if (node.nodeType !== 1) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') return ' '
    if (tag === 'img' || tag === 'script' || tag === 'style') return ''
    const kids = () => [...el.childNodes].map((c) => inline(c, inLink || tag === 'a')).join('')
    const style = (el.getAttribute('style') || '').toLowerCase()
    const weight = style.match(/font-weight:\s*(\w+)/)?.[1] || ''
    const normalWeight = weight === 'normal' || weight === '400' || weight === 'lighter'
    const bold = ((tag === 'strong' || tag === 'b') && !normalWeight) || weight === 'bold' || weight === 'bolder' || Number(weight) >= 600
    const italic = tag === 'em' || (tag === 'i' && !/font-style:\s*normal/.test(style)) || /font-style:\s*italic/.test(style)
    let t = kids()
    if (italic) t = wrap(t, '*')
    if (bold) t = wrap(t, '**')
    const href = el.getAttribute('href') || ''
    if (tag === 'a' && !inLink && /^(https?:|mailto:)/i.test(href) && clean(t)) t = wrap(t, '[', '](' + href.replace(/\s/g, '%20').replace(/\)/g, '%29') + ')')
    return t
  }
  const text = (el: Element) => clean(inline(el)).replace(/\*\*\*\*/g, '')
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'img') { const l = imgLine(el); if (l) out.push(l); return }
    if (tag === 'figure') {
      const img = el.querySelector('img')
      const l = img ? imgLine(img, clean(el.querySelector('figcaption')?.textContent || '')) : ''
      if (l) out.push(l)
      return
    }
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'))
        .map((row) => Array.from(row.children).map((c) => clean(c.textContent || '')))
        .filter((cells) => cells.some(Boolean))
      const width = Math.max(0, ...rows.map((r) => r.length))
      if (width > 1) out.push(rows.map((r) => tableLine([...r, ...Array(width - r.length).fill('')])).join('\n'))
      else rows.forEach((r) => { if (r[0]) out.push(r[0]) })
      return
    }
    if (/^h[1-6]$/.test(tag)) { const t = text(el).replace(/^\*\*([^*]+)\*\*$/, '$1'); if (t) out.push('## ' + t); return }
    if (tag === 'li') {
      const t = text(el)
      if (!t) return
      const list = el.parentElement
      if (list && list.tagName.toLowerCase() === 'ol') out.push((Array.from(list.children).indexOf(el) + Number(list.getAttribute('start') || 1)) + '. ' + t)
      else out.push('- ' + t)
      return
    }
    if (tag === 'blockquote') {
      const parts = el.querySelector('p') ? Array.from(el.querySelectorAll('p')).map(text) : [text(el)]
      parts.filter(Boolean).forEach((t) => out.push('> ' + t))
      return
    }
    if (tag === 'hr') { if (out.length && out[out.length - 1] !== '---') out.push('---'); return }
    if (tag === 'ul' || tag === 'ol' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'body') { [...el.children].forEach(walk); if (!el.children.length) { const t = text(el); if (t) out.push(t) } return }
    if (el.querySelector('img, table, p, h1, h2, h3, h4, li, div')) { [...el.children].forEach(walk); return }
    const t = text(el); if (t) out.push(t)
  }
  // Loose text directly in the body (Google Docs wraps it in a <b> or <span>).
  ;[...doc.body.children].forEach(walk)
  return out.join('\n\n')
}


// ---------- text format <-> rich editor ----------
// The stored body stays the same line format the server already reads:
// one block per line; "## " heading, "- " bullet, "1. " numbered item,
// "> " quote, "![alt](src \"caption\")" image, "---" divider, and
// "| a | b |" table rows (one line per row, header first); inline [text](url),
// **bold** and *italic*. The visual editor converts to and from it, so
// published pages, drafts and Substack imports keep working unchanged.

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function inlineToHtml(t: string): string {
  return esc(t)
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^\s)]+)\)/g, (_m, txt, href) => `<a href="${href}">${txt}</a>`)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g, '<em>$1</em>')
}

export function textToHtml(body: string): string {
  const lines = String(body || '').split(/\n/).map((l) => l.trim())
  const out: string[] = []
  let list: '' | 'ul' | 'ol' = ''
  const close = () => { if (list) { out.push(`</${list}>`); list = '' } }
  let table: string[][] | null = null
  const flushTable = () => {
    if (!table) return
    const [head, ...rows] = table
    out.push('<table><tbody><tr>' + head.map((c) => `<th><p>${esc(c)}</p></th>`).join('') + '</tr>' +
      rows.map((r) => '<tr>' + head.map((_, k) => `<td><p>${esc(r[k] || '')}</p></td>`).join('') + '</tr>').join('') + '</tbody></table>')
    table = null
  }
  for (const line of lines) {
    if (!line) { flushTable(); continue }
    if (isTableLine(line)) { close(); (table ||= []).push(tableCells(line)); continue }
    flushTable()
    if (isDivider(line)) { close(); out.push('<hr>'); continue }
    const img = line.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/)
    const ol = line.match(/^(\d{1,3})\. (.*)$/)
    if (line.startsWith('- ')) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul' } out.push(`<li><p>${inlineToHtml(line.slice(2))}</p></li>`); continue }
    if (ol) { if (list !== 'ol') { close(); out.push(`<ol start="${ol[1]}">`); list = 'ol' } out.push(`<li><p>${inlineToHtml(ol[2])}</p></li>`); continue }
    close()
    if (img && /^https:\/\//i.test(img[2])) out.push(`<img src="${esc(img[2])}" alt="${esc(img[1])}"${img[3] ? ` title="${esc(img[3])}"` : ''}>`)
    else if (line.startsWith('## ')) out.push(`<h2>${inlineToHtml(line.slice(3))}</h2>`)
    else if (line.startsWith('> ')) out.push(`<blockquote><p>${inlineToHtml(line.slice(2))}</p></blockquote>`)
    else out.push(`<p>${inlineToHtml(line)}</p>`)
  }
  close()
  flushTable()
  return out.join('')
}

type PMNode = { type: string; text?: string; attrs?: Record<string, any>; marks?: { type: string; attrs?: Record<string, any> }[]; content?: PMNode[] }

const wrapMark = (t: string, l: string, r = l) => {
  const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  return m[2] ? m[1] + l + m[2] + r + m[3] : t
}

function inlineToText(nodes: PMNode[] = []): string {
  let out = ''
  let i = 0
  while (i < nodes.length) {
    const href = (n: PMNode) => n.marks?.find((m) => m.type === 'link')?.attrs?.href || ''
    const h = href(nodes[i])
    let j = i
    let chunk = ''
    while (j < nodes.length && href(nodes[j]) === h) {
      const n = nodes[j]
      if (n.type === 'hardBreak') chunk += ' '
      else if (n.type === 'text') {
        let t = (n.text || '').replace(/\n/g, ' ')
        const marks = (n.marks || []).map((m) => m.type)
        if (marks.includes('italic')) t = wrapMark(t, '*')
        if (marks.includes('bold')) t = wrapMark(t, '**')
        chunk += t
      }
      j++
    }
    out += h && /^(https?:|mailto:)/i.test(h) && chunk.trim() ? wrapMark(chunk, '[', '](' + h.replace(/\s/g, '%20').replace(/\)/g, '%29') + ')') : chunk
    i = j
  }
  return out.replace(/\*\*\*\*/g, '').replace(/\s+/g, ' ').trim()
}

// Table cells are stored as plain text.
const plain = (nodes: PMNode[] = []) => nodes.map((n) => n.type === 'text' ? n.text || '' : ' ').join('').replace(/\s+/g, ' ').trim()

export function docToText(doc: PMNode): string {
  const out: string[] = []
  const imgLine = (a: Record<string, any> = {}) => '![' + String(a.alt || '').replace(/[\]\n\r]/g, ' ') + '](' + a.src + (a.title ? ' "' + String(a.title).replace(/["\n\r]/g, "'") + '"' : '') + ')'
  const itemText = (li: PMNode) => (li.content || []).map((c) => inlineToText(c.content)).filter(Boolean).join(' ')
  for (const n of doc.content || []) {
    if (n.type === 'paragraph') { const t = inlineToText(n.content); if (t) out.push(t) }
    else if (n.type === 'heading') { const t = inlineToText(n.content); if (t) out.push('## ' + t) }
    else if (n.type === 'bulletList') (n.content || []).forEach((li) => { const t = itemText(li); if (t) out.push('- ' + t) })
    else if (n.type === 'orderedList') { let k = Number(n.attrs?.start || 1); (n.content || []).forEach((li) => { const t = itemText(li); if (t) out.push((k++) + '. ' + t) }) }
    else if (n.type === 'blockquote') (n.content || []).forEach((c) => { const t = inlineToText(c.content); if (t) out.push('> ' + t) })
    else if (n.type === 'image' && /^https:\/\//i.test(n.attrs?.src || '')) out.push(imgLine(n.attrs))
    else if (n.type === 'horizontalRule') { if (out.length && out[out.length - 1] !== '---') out.push('---') }
    else if (n.type === 'table') {
      const cellText = (c: PMNode) => (c.content || []).map((p) => plain(p.content)).filter(Boolean).join(' ')
      const rows = (n.content || []).map((r) => (r.content || []).map(cellText)).filter((r, k) => k === 0 || r.some(Boolean))
      const width = Math.max(0, ...rows.map((r) => r.length))
      if (rows.length && width) out.push(rows.map((r) => tableLine([...r, ...Array(width - r.length).fill('')])).join('\n'))
    }
  }
  while (out[0] === '---') out.shift()
  while (out[out.length - 1] === '---') out.pop()
  return out.join('\n\n')
}
