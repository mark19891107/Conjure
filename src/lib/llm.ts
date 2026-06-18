import type { LLMConfig } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function completionsUrl(config: LLMConfig): string {
  if (!config.baseUrl) throw new Error('LLM base URL is not set.')
  if (!config.model) throw new Error('LLM model is not set.')
  return `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
}

function authHeaders(config: LLMConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}
}

/**
 * Non-streaming call — kept for fallback and tests.
 */
export async function chatComplete(
  config: LLMConfig,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(completionsUrl(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.2 }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`)
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM response contained no content.')
  return content
}

/**
 * Streaming call via Server-Sent Events. Calls `onChunk` with the accumulated
 * text after each token arrives, then resolves with the full reply.
 */
export async function chatCompleteStream(
  config: LLMConfig,
  messages: ChatMessage[],
  onChunk: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(completionsUrl(config), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.2, stream: true }),
    signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`)
  }
  if (!res.body) throw new Error('LLM returned no response body.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    // Process all complete lines in the buffer
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trimEnd()
      buf = buf.slice(nl + 1)

      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[]
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          accumulated += delta
          onChunk(accumulated)
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (!accumulated) throw new Error('LLM response contained no content.')
  return accumulated
}
