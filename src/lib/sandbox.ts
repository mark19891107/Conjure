// Builds the srcdoc for the sandboxed iframe that runs AI-generated code.
//
// Security model (see SPEC.md §4):
// - The iframe uses sandbox="allow-scripts" WITHOUT allow-same-origin, so it
//   has an opaque origin and cannot read the parent's localStorage (API keys).
// - A strict CSP forbids ALL network access (connect-src 'none', default-src
//   'none'), so generated code cannot exfiltrate the injected data.
// - Libraries are bundled and inlined (no CDN) so tools work fully offline.

import chartSource from '../vendor/chart.umd.js?raw'
import papaSource from '../vendor/papaparse.min.js?raw'

// Escape a JSON string so it is safe to embed inside an inline <script>.
function safeJson(data: unknown): string {
  return JSON.stringify(JSON.stringify(data ?? null))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'"

export function buildSrcDoc(generatedFragment: string, data: unknown): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
  html,body{margin:0;padding:16px;font-family:system-ui,sans-serif;color:#1a1a1a;background:#fff;box-sizing:border-box;}
  *,*::before,*::after{box-sizing:inherit;}
</style>
</head>
<body>
<script>
  window.onerror = function (message, _src, _line, _col, err) {
    parent.postMessage({ __conjure: true, type: 'error', message: String(err && err.stack ? err.stack : message) }, '*');
    return false;
  };
  window.__CONJURE_DATA__ = JSON.parse(${safeJson(data)});
</script>
<script>${chartSource}</script>
<script>${papaSource}</script>
${generatedFragment}
</body>
</html>`
}
