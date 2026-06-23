// Builds the srcdoc for the sandboxed iframe that runs AI-generated code.
//
// Security model (see SPEC.md §4):
// - The iframe uses sandbox="allow-scripts allow-downloads" WITHOUT
//   allow-same-origin, so it has an opaque origin and cannot read the parent's
//   localStorage (API keys). allow-downloads only permits user-initiated file
//   downloads (e.g. export CSV) — it does not grant network or origin access.
// - A strict CSP forbids ALL network access (connect-src 'none', default-src
//   'none'), so generated code cannot exfiltrate the injected data.
// - Libraries are bundled and inlined (no CDN) so tools work fully offline.

import chartSource from '../vendor/chart.umd.js?raw'
import papaSource from '../vendor/papaparse.min.js?raw'
import type { NamedData } from './schema'

// Escape a JSON string so it is safe to embed inside an inline <script>.
function safeJson(data: unknown): string {
  return JSON.stringify(JSON.stringify(data ?? null))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'"

function dataGlobals(sources: NamedData[]): string {
  const map: Record<string, unknown> = {}
  for (const s of sources) map[s.name] = s.data
  const primary = sources[0]?.data ?? null
  return `window.__CONJURE_SOURCES__ = JSON.parse(${safeJson(map)});
  window.__CONJURE_DATA__ = JSON.parse(${safeJson(primary)});`
}

export function buildSrcDoc(generatedFragment: string, sources: NamedData[]): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
  html{height:100%;background:#fff;}
  body{margin:0;padding:0;min-height:100%;font-family:system-ui,sans-serif;color:#1a1a1a;background:#fff;box-sizing:border-box;}
  *,*::before,*::after{box-sizing:inherit;}
</style>
</head>
<body>
<script>
  window.onerror = function (message, _src, _line, _col, err) {
    parent.postMessage({ __conjure: true, type: 'error', message: String(err && err.stack ? err.stack : message) }, '*');
    return false;
  };
  ${dataGlobals(sources)}
</script>
<script>${chartSource}</script>
<script>${papaSource}</script>
${generatedFragment}
</body>
</html>`
}

// Builds a minimal sandbox document that runs a JS snippet and postMessages back
// the result. Used by the data-exploration agent step.
function buildExploreSrcDoc(snippetJs: string, sources: NamedData[]): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
</head>
<body>
<script>
  ${dataGlobals(sources)}
</script>
<script>${chartSource}</script>
<script>${papaSource}</script>
<script>
(function () {
  try {
    ${snippetJs}
  } catch (e) {
    parent.postMessage({ __conjure: true, type: 'explore-result', insights: { _error: String(e) } }, '*');
  }
})();
</script>
</body>
</html>`
}

/**
 * Run an LLM-generated JS snippet in a hidden sandbox and return whatever the
 * snippet passes to parent.postMessage as `insights`. Rejects on timeout.
 */
export function runExploreInSandbox(snippetJs: string, sources: NamedData[], timeoutMs = 12000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute(
      'style',
      'position:fixed;width:0;height:0;opacity:0;pointer-events:none;border:none;',
    )
    iframe.setAttribute('sandbox', 'allow-scripts')

    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Data exploration timed out'))
    }, timeoutMs)

    function onMessage(e: MessageEvent) {
      const d = e.data as Record<string, unknown>
      if (d?.__conjure === true && d.type === 'explore-result') {
        if (settled) return
        settled = true
        cleanup()
        resolve(d.insights ?? null)
      }
    }

    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (iframe.parentNode) iframe.remove()
    }

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
    // Set srcdoc after appending so the load fires correctly in all browsers.
    iframe.srcdoc = buildExploreSrcDoc(snippetJs, sources)
  })
}
