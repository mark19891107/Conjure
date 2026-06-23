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
- Local file downloads ARE allowed and never touch the network: build a Blob, call URL.createObjectURL(blob), set it as the href of an <a download="..."> element, and click it. Use this for "export CSV / download" features.
- Put logic in a single inline <script> and render results into the document body.
- The document body has NO padding, so add your own margins/padding to your container — do not let content sit flush against the edges.
- Be robust to small differences between the sample and the real data. Use clean inline styles. Charts need a <canvas> with an explicit height.`

// Prompt for the data-exploration agent step.
const EXPLORE_SYSTEM = `You are a data analysis assistant. Write a JavaScript snippet that explores the provided dataset and reports key insights.

The snippet runs in a sandboxed iframe with these globals pre-loaded:
- window.__CONJURE_DATA__ — the primary data source, already parsed as JSON
- window.__CONJURE_SOURCES__ — object keyed by source name

Your snippet MUST end by calling exactly:
  parent.postMessage({ __conjure: true, type: 'explore-result', insights: YOUR_OBJECT }, '*');

YOUR_OBJECT must be a plain, JSON-serializable object. Analyze and include:
- Total row/item count
- Column/key names and their inferred types (number, string, boolean, date, array, object)
- For numeric columns: min, max, mean, and whether nulls are present
- For string columns: number of unique values and the top 5 most common values
- Any notable patterns (e.g. date range, looks like currency, ID-like column)

Respond with ONLY a \`\`\`javascript code block. No other text.`

// Prompt for generating follow-up suggestion chips.
const SUGGEST_SYSTEM = `You suggest brief follow-up refinements for a generated data tool.
Return ONLY a valid JSON array of exactly 3 strings. Each string must be 4-8 words describing a useful next step.
No other text — just the JSON array.`

// Prompt for the auto-fix agent step.
const AUTO_FIX_SYSTEM = `You are fixing a runtime JavaScript error in a sandboxed HTML/JS data tool. Identify and fix the root cause.

RESPOND IN TWO PARTS:
1. One sentence explaining what you fixed.
2. The corrected code in EXACTLY ONE \`\`\`html fenced block.

Same rules as before: no <html>/<head>/<body> tags, no network access, data is in window.__CONJURE_DATA__ and window.__CONJURE_SOURCES__.`

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
 * When `insights` is provided (from the exploration agent), it's added as
 * extra context for fresh generation.
 */
export function buildMessages(
  request: string,
  contexts: SourceContext[],
  baseHtml?: string,
  insights?: unknown,
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
    const insightsPart =
      insights != null ? `\nData analysis results:\n${JSON.stringify(insights, null, 2)}\n` : ''
    messages.push({
      role: 'user',
      content: `${data}${insightsPart}\n\nBuild this tool: ${request}`,
    })
  }

  return messages
}

export function buildExploreMessages(contexts: SourceContext[]): ChatMessage[] {
  return [
    { role: 'system', content: EXPLORE_SYSTEM },
    { role: 'user', content: dataBlock(contexts) },
  ]
}

export function parseExploreJs(reply: string): string {
  const m = reply.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/)
  if (m) return m[1].trim()
  return reply.trim()
}

export function buildSuggestionMessages(contexts: SourceContext[], toolHtml: string): ChatMessage[] {
  return [
    { role: 'system', content: SUGGEST_SYSTEM },
    {
      role: 'user',
      content: `${dataBlock(contexts)}\n\nGenerated tool HTML (truncated):\n\`\`\`html\n${toolHtml.slice(0, 2000)}\n\`\`\`\n\nSuggest 3 follow-up refinements as a JSON array.`,
    },
  ]
}

export function parseSuggestions(reply: string): string[] {
  try {
    const m = reply.match(/\[[\s\S]*?\]/)
    if (m) {
      const arr = JSON.parse(m[0]) as unknown[]
      if (Array.isArray(arr)) {
        return arr.filter((s): s is string => typeof s === 'string').slice(0, 3)
      }
    }
  } catch {
    // ignore malformed reply
  }
  return []
}

export function buildAutoFixMessages(error: string, currentHtml: string): ChatMessage[] {
  return [
    { role: 'system', content: AUTO_FIX_SYSTEM },
    {
      role: 'user',
      content: `Runtime error:\n${error}\n\nCurrent tool code:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nFix the error.`,
    },
  ]
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

export interface StreamingParse {
  explanation: string
  /** The code content after the opening fence; null while fence not yet seen. */
  partialCode: string | null
  codeStarted: boolean
}

/**
 * Parse an in-progress (possibly incomplete) model reply to extract the
 * explanation and partial code as they stream in.
 */
export function parseStreamingText(text: string): StreamingParse {
  const m = text.match(/```(?:html|HTML)?\s*\n/)
  if (!m || m.index === undefined) {
    return { explanation: text, partialCode: null, codeStarted: false }
  }
  const codeBodyStart = m.index + m[0].length
  const explanation = text.slice(0, m.index).trim()
  const afterFence = text.slice(codeBodyStart)
  // The closing fence may not have arrived yet
  const closingIdx = afterFence.indexOf('\n```')
  const partialCode = closingIdx >= 0 ? afterFence.slice(0, closingIdx) : afterFence
  return { explanation, partialCode, codeStarted: true }
}
