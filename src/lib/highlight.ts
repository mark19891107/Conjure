// Lightweight syntax highlighter for HTML with embedded CSS and JS.
// Returns an HTML string with <span class="hl-*"> wrappers suitable for
// dangerouslySetInnerHTML on a <pre>. All user content is HTML-escaped.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// s must already be HTML-escaped (or a safe literal like '&lt;')
function sp(cls: string, s: string): string {
  return `<span class="hl-${cls}">${s}</span>`
}

// ---------------------------------------------------------------------------
// JavaScript tokenizer
// ---------------------------------------------------------------------------

const JS_KW = new Set([
  'break','case','catch','class','const','continue','debugger','default','delete',
  'do','else','export','extends','false','finally','for','function','if','import',
  'in','instanceof','let','new','null','of','return','static','super','switch',
  'this','throw','true','try','typeof','undefined','var','void','while','with',
  'yield','async','await','from',
])

function tokenizeJs(code: string): string {
  let i = 0, out = ''
  while (i < code.length) {
    const c = code[i]
    // Line comment
    if (c === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i)
      const end = nl < 0 ? code.length : nl
      out += sp('comment', esc(code.slice(i, end))); i = end
    }
    // Block comment
    else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end < 0 ? code.length : end + 2
      out += sp('comment', esc(code.slice(i, stop))); i = stop
    }
    // Template literal
    else if (c === '`') {
      let j = i + 1
      while (j < code.length && code[j] !== '`') { if (code[j] === '\\') j++; j++ }
      out += sp('string', esc(code.slice(i, j + 1))); i = j + 1
    }
    // Quoted string
    else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < code.length && code[j] !== c && code[j] !== '\n') { if (code[j] === '\\') j++; j++ }
      out += sp('string', esc(code.slice(i, j + 1))); i = j + 1
    }
    // Number
    else if (/[0-9]/.test(c) && (i === 0 || !/[a-zA-Z0-9_$]/.test(code[i - 1]))) {
      let j = i
      while (j < code.length && /[0-9a-fA-FxXeE._]/.test(code[j])) j++
      out += sp('number', esc(code.slice(i, j))); i = j
    }
    // Identifier or keyword
    else if (/[a-zA-Z_$]/.test(c)) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++
      const w = code.slice(i, j)
      out += JS_KW.has(w) ? sp('keyword', esc(w)) : esc(w); i = j
    }
    else { out += esc(c); i++ }
  }
  return out
}

// ---------------------------------------------------------------------------
// CSS tokenizer
// ---------------------------------------------------------------------------

function tokenizeCss(code: string): string {
  let i = 0, out = '', depth = 0
  while (i < code.length) {
    const c = code[i]
    // Block comment
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end < 0 ? code.length : end + 2
      out += sp('comment', esc(code.slice(i, stop))); i = stop
    }
    // String inside block
    else if ((c === '"' || c === "'") && depth > 0) {
      const q = c; let j = i + 1
      while (j < code.length && code[j] !== q) { if (code[j] === '\\') j++; j++ }
      out += sp('string', esc(code.slice(i, j + 1))); i = j + 1
    }
    else if (c === '{') { out += sp('punct', '{'); depth++; i++ }
    else if (c === '}') { out += sp('punct', '}'); depth = Math.max(0, depth - 1); i++ }
    else if (c === ';' && depth > 0) { out += sp('punct', ';'); i++ }
    // Inside rule block: property: value
    else if (depth > 0 && /[a-zA-Z_-]/.test(c)) {
      let j = i
      while (j < code.length && code[j] !== ':' && code[j] !== ';' && code[j] !== '}') j++
      if (j < code.length && code[j] === ':') {
        out += sp('css-prop', esc(code.slice(i, j))) + sp('punct', ':')
        i = j + 1
        let k = i
        while (k < code.length && code[k] !== ';' && code[k] !== '}') k++
        out += sp('css-val', esc(code.slice(i, k))); i = k
      } else { out += esc(c); i++ }
    }
    // Outside block: selector
    else if (depth === 0 && /\S/.test(c)) {
      let j = i
      while (j < code.length && code[j] !== '{' && code[j] !== '\n') j++
      const seg = code.slice(i, j)
      const trimmed = seg.trimEnd()
      out += trimmed ? sp('selector', esc(trimmed)) + esc(seg.slice(trimmed.length)) : esc(seg)
      i = j
    }
    else { out += esc(c); i++ }
  }
  return out
}

// ---------------------------------------------------------------------------
// HTML tag highlighter
// ---------------------------------------------------------------------------

function highlightTag(tag: string): string {
  if (tag.startsWith('<!')) return sp('comment', esc(tag))

  let i = 1, out = '' // i starts after '<'
  const isClose = i < tag.length && tag[i] === '/'
  if (isClose) i++

  out += `<span class="hl-punct">&lt;${isClose ? '/' : ''}</span>`

  // Tag name
  let j = i
  while (j < tag.length && /[a-zA-Z0-9:_-]/.test(tag[j])) j++
  out += sp('tag-name', esc(tag.slice(i, j))); i = j

  // Closing tag: skip to >
  if (isClose) {
    out += sp('punct', '&gt;')
    return out
  }

  // Attributes
  const selfClose = tag.endsWith('/>')
  const bodyEnd = selfClose ? tag.length - 2 : tag.length - 1

  while (i < bodyEnd) {
    if (/\s/.test(tag[i])) { out += tag[i]; i++; continue }

    // Attribute name
    let k = i
    while (k < bodyEnd && !/[\s=]/.test(tag[k])) k++
    if (k > i) { out += sp('attr-name', esc(tag.slice(i, k))); i = k }

    // Attribute value
    if (i < bodyEnd && tag[i] === '=') {
      out += sp('punct', '='); i++
      if (i < tag.length && (tag[i] === '"' || tag[i] === "'")) {
        const q = tag[i]; let m = i + 1
        while (m < tag.length && tag[m] !== q) m++
        out += sp('attr-value', esc(tag.slice(i, m + 1))); i = m + 1
      }
    }

    if (k === i) { i++; continue } // safety
  }

  out += selfClose ? sp('punct', '/&gt;') : sp('punct', '&gt;')
  return out
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function highlightHtml(code: string): string {
  let i = 0, out = ''
  while (i < code.length) {
    // HTML comment
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4)
      const stop = end < 0 ? code.length : end + 3
      out += sp('comment', esc(code.slice(i, stop))); i = stop; continue
    }
    // <script> block
    if (/^<script(\s|>)/i.test(code.slice(i))) {
      const tagEnd = code.indexOf('>', i)
      if (tagEnd < 0) { out += esc(code[i]); i++; continue }
      out += highlightTag(code.slice(i, tagEnd + 1)); i = tagEnd + 1
      const closeIdx = code.toLowerCase().indexOf('</script>', i)
      const stop = closeIdx < 0 ? code.length : closeIdx
      out += tokenizeJs(code.slice(i, stop)); i = stop; continue
    }
    // <style> block
    if (/^<style(\s|>)/i.test(code.slice(i))) {
      const tagEnd = code.indexOf('>', i)
      if (tagEnd < 0) { out += esc(code[i]); i++; continue }
      out += highlightTag(code.slice(i, tagEnd + 1)); i = tagEnd + 1
      const closeIdx = code.toLowerCase().indexOf('</style>', i)
      const stop = closeIdx < 0 ? code.length : closeIdx
      out += tokenizeCss(code.slice(i, stop)); i = stop; continue
    }
    // Any HTML tag
    if (code[i] === '<') {
      const tagEnd = code.indexOf('>', i)
      if (tagEnd < 0) { out += esc(code[i]); i++; continue }
      out += highlightTag(code.slice(i, tagEnd + 1)); i = tagEnd + 1; continue
    }
    out += esc(code[i]); i++
  }
  return out
}
