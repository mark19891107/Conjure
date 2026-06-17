import type { LLMConfig } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Call an OpenAI-compatible Chat Completions endpoint directly from the browser.
 * Works with OpenAI, OpenRouter, Ollama, LM Studio, vLLM, and similar gateways
 * as long as the endpoint allows browser CORS.
 */
export async function chatComplete(
  config: LLMConfig,
  messages: ChatMessage[],
): Promise<string> {
  if (!config.baseUrl) throw new Error('LLM base URL is not set.')
  if (!config.model) throw new Error('LLM model is not set.')

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM response contained no content.')
  return content
}
