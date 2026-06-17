import type { ChatMessage } from './llm'
import type { DataContext } from './schema'

// The contract the model must follow. The sandbox (see sandbox.ts) provides
// `window.__CONJURE_DATA__`, the `Chart` global (Chart.js) and the `Papa`
// global (PapaParse), and enforces a strict no-network CSP.
const SYSTEM_PROMPT = `You generate a small, self-contained front-end tool that runs inside a locked-down sandboxed iframe.

STRICT RULES:
- Output ONLY the HTML fragment that goes inside <body>. Do NOT output <html>, <head>, or <body> tags, and do NOT wrap the answer in markdown code fences.
- The data is already available as the global variable window.__CONJURE_DATA__ (already parsed from JSON). NEVER fetch it.
- You may use these preloaded globals ONLY: Chart (Chart.js v4) and Papa (PapaParse). No other libraries.
- NO network access is allowed: no fetch, XMLHttpRequest, WebSocket, import(), or external <script>/<link>/<img> URLs. The CSP will block them. Inline everything.
- Put your logic in a single inline <script>. Render results into the document body.
- Handle the case where the data shape differs slightly from the sample. Keep it robust and concise.
- Use clean, readable inline styles. Charts need a <canvas> with an explicit height.`

export function buildMessages(
  request: string,
  ctx: DataContext,
  previousHtml?: string,
): ChatMessage[] {
  const rows = ctx.rowCount === null ? 'n/a' : String(ctx.rowCount)
  const dataBlock = `Data schema:\n${ctx.schema}\n\nRow count: ${rows}\n\nSample (truncated):\n${ctx.sample}`

  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  if (previousHtml) {
    messages.push({
      role: 'assistant',
      content: previousHtml,
    })
    messages.push({
      role: 'user',
      content: `${dataBlock}\n\nModify the previous tool as follows: ${request}\n\nReturn the full updated fragment.`,
    })
  } else {
    messages.push({
      role: 'user',
      content: `${dataBlock}\n\nBuild this tool: ${request}`,
    })
  }

  return messages
}

/** Strip accidental markdown code fences if the model adds them anyway. */
export function stripFences(text: string): string {
  const fence = /^\s*```(?:html)?\s*\n([\s\S]*?)\n```\s*$/
  const m = text.match(fence)
  return (m ? m[1] : text).trim()
}
