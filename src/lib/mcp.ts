// Minimal MCP (Model Context Protocol) client over the Streamable HTTP
// transport — just enough to call a tool and use its result as a data source.
// Subject to CORS: the MCP server must allow browser cross-origin requests.

import { parseHeaderLines } from './dataSources'
import type { McpDataConfig } from '../types'

interface JsonRpcResult {
  result?: unknown
  error?: { message?: string }
}

async function rpc(
  url: string,
  headers: Record<string, string>,
  method: string,
  params: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`MCP request failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  // Streamable HTTP may answer as JSON or as an SSE stream; handle both.
  const text = await res.text()
  const payload = text.includes('data:')
    ? text
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('')
    : text

  const json = JSON.parse(payload) as JsonRpcResult
  if (json.error) throw new Error(`MCP error: ${json.error.message ?? 'unknown'}`)
  return json.result
}

/** Call the configured MCP tool and return its result as data. */
export async function callMcpTool(config: McpDataConfig): Promise<unknown> {
  if (!config.url) throw new Error('MCP server URL is not set.')
  if (!config.toolName) throw new Error('MCP tool name is not set.')
  const headers = parseHeaderLines(config.headers)

  let args: unknown = {}
  try {
    args = config.argsJson.trim() ? JSON.parse(config.argsJson) : {}
  } catch {
    throw new Error('MCP tool arguments are not valid JSON.')
  }

  const result = (await rpc(config.url, headers, 'tools/call', {
    name: config.toolName,
    arguments: args,
  })) as { content?: { type: string; text?: string }[] }

  // Prefer parsing the first text content block as JSON; fall back to raw text.
  const textBlock = result?.content?.find((c) => c.type === 'text')?.text
  if (textBlock) {
    try {
      return JSON.parse(textBlock)
    } catch {
      return textBlock
    }
  }
  return result
}
