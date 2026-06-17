import type { ChatMessage } from './llm'
import type { SourceContext } from './schema'

// The contract the model must follow. The sandbox (see sandbox.ts) provides the
// data as globals, the `Chart` global (Chart.js) and the `Papa` global
// (PapaParse), and enforces a strict no-network CSP.
const SYSTEM_PROMPT = `You generate a small, self-contained front-end tool that runs inside a locked-down sandboxed iframe.

RESPOND IN TWO PARTS, IN THIS ORDER:
1. A short plain-text explanation (2-5 sentences) of what the tool does and any assumptions you made. No markdown headings.
2. The tool code in EXACTLY ONE \`\`\`html fenced block. Put nothing after it and use no other fenced blocks.

THE CODE MUST FOLLOW THESE RULES:
- It is only the HTML that goes inside <body> (no <html>, <head>, or <body> tags).
- Data is already available as globals — NEVER fetch it:
  - window.__CONJURE_DATA__ is the primary (first) data source, already parsed.
  - window.__CONJURE_SOURCES__ is an object keyed by source name, e.g. window.__CONJURE_SOURCES__["Sales"].
- You may use ONLY these preloaded globals: Chart (Chart.js v4) and Papa (PapaParse). No other libraries.
- NO network access: no fetch, XMLHttpRequest, WebSocket, import(), or external <script>/<link>/<img> URLs. The CSP will block them. Inline everything.
- Put logic in a single inline <script> and render results into the document body.
- Be robust to small differences between the sample and the real data. Use clean inline styles. Charts need a <canvas> with an explicit height.`

function dataBlock(contexts: SourceContext[]): string {
  if (contexts.length === 0) return 'No data sources are attached.'
  return contexts
    .map((c, i) => {
      const primary = i === 0 ? ' (primary — window.__CONJURE_DATA__)' : ''
      const rows = c.rowCount === null ? 'n/a' : String(c.rowCount)
      return `### Source "${c.name}"${primary}\nAccess: window.__CONJURE_SOURCES__[${JSON.stringify(
        c.name,
      )}]\nSchema: ${c.schema}\nRow count: ${rows}\nSample (truncated):\n${c.sample}`
    })
    .join('\n\n')
}

/**
 * Build the chat messages. When `baseHtml` is provided the model refines that
 * code (the latest or the currently-viewed version, chosen by the caller).
 */
export function buildMessages(
  request: string,
  contexts: SourceContext[],
  baseHtml?: string,
): ChatMessage[] {
  const data = dataBlock(contexts)
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  if (baseHtml) {
    messages.push({
      role: 'assistant',
      content: `\`\`\`html\n${baseHtml}\n\`\`\``,
    })
    messages.push({
      role: 'user',
      content: `${data}\n\nModify the tool above as follows: ${request}\n\nReturn the explanation and the full updated fragment.`,
    })
  } else {
    messages.push({
      role: 'user',
      content: `${data}\n\nBuild this tool: ${request}`,
    })
  }

  return messages
}

export interface ParsedReply {
  explanation: string
  code: string
}

/**
 * Split the model reply into a prose explanation and the tool code. The code is
 * taken from a fenced block; everything outside the block is the explanation.
 * Falls back to treating the whole reply as code if no fence is present.
 */
export function parseLlmReply(text: string): ParsedReply {
  const fence = /```(?:html|HTML)?\s*\n([\s\S]*?)```/m
  const m = text.match(fence)
  if (!m) {
    return { explanation: '', code: text.trim() }
  }
  const code = m[1].trim()
  const explanation = (text.slice(0, m.index) + text.slice((m.index ?? 0) + m[0].length))
    .replace(/```[\s\S]*?```/g, '')
    .trim()
  return { explanation, code }
}
