// Shared domain types for Conjure.

/** OpenAI-compatible Chat Completions configuration. */
export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export type DataSourceKind = 'paste' | 'file' | 'http' | 'mcp'

export interface HttpDataConfig {
  method: 'GET' | 'POST'
  url: string
  /** Raw "Key: Value" lines. */
  headers: string
  body: string
}

export interface McpDataConfig {
  /** Streamable HTTP endpoint of the MCP server. */
  url: string
  headers: string
  toolName: string
  /** JSON object of arguments passed to the tool. */
  argsJson: string
}

export interface DataSource {
  kind: DataSourceKind
  paste: string
  http: HttpDataConfig
  mcp: McpDataConfig
}

/** A tool the user generated and saved. */
export interface Tool {
  id: string
  name: string
  prompt: string
  html: string
  createdAt: number
}

export const defaultLLMConfig: LLMConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
}

export const defaultDataSource: DataSource = {
  kind: 'paste',
  paste: '',
  http: { method: 'GET', url: '', headers: '', body: '' },
  mcp: { url: '', headers: '', toolName: '', argsJson: '{}' },
}
