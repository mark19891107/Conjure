import type { LLMConfig } from '../types'

interface Props {
  config: LLMConfig
  onChange: (next: LLMConfig) => void
}

export function LlmConfigPanel({ config, onChange }: Props) {
  const set = (patch: Partial<LLMConfig>) => onChange({ ...config, ...patch })

  return (
    <section className="panel">
      <h2>LLM (OpenAI-compatible)</h2>
      <label>
        Base URL
        <input
          value={config.baseUrl}
          placeholder="https://api.openai.com/v1"
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
      </label>
      <label>
        API key
        <input
          type="password"
          value={config.apiKey}
          placeholder="sk-..."
          onChange={(e) => set({ apiKey: e.target.value })}
        />
      </label>
      <label>
        Model
        <input
          value={config.model}
          placeholder="gpt-4o-mini"
          onChange={(e) => set({ model: e.target.value })}
        />
      </label>
      <p className="hint">
        Stored only in your browser. Works with OpenAI, OpenRouter, Ollama, LM
        Studio, etc. (endpoint must allow browser CORS).
      </p>
    </section>
  )
}
