// Shared domain types for Conjure.
//
// The app is organised around two top-level concepts:
// - Settings: a reusable library of LLM profiles and data-source profiles.
// - Projects: each selects one LLM + several data sources, and owns a
//   version-controlled tool plus the conversation history that produced it.

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

/** Uploaded file contents, persisted so a file source stays reusable. */
export interface FileDataConfig {
  name: string
  text: string
}

export interface DataSource {
  kind: DataSourceKind
  paste: string
  file: FileDataConfig
  http: HttpDataConfig
  mcp: McpDataConfig
}

// ---- Settings library --------------------------------------------------

/** A named, reusable LLM configuration. */
export interface LlmProfile extends LLMConfig {
  id: string
  name: string
}

/** A named, reusable data source. */
export interface DataSourceProfile {
  id: string
  name: string
  config: DataSource
}

export interface Settings {
  llms: LlmProfile[]
  dataSources: DataSourceProfile[]
}

// ---- Projects ----------------------------------------------------------

/** One immutable snapshot of the generated tool's source. */
export interface ToolVersion {
  id: string
  /** 1-based, human-facing version number. */
  label: number
  /** The HTML/JS fragment that runs in the sandbox. */
  html: string
  /** The model's prose explanation that accompanied this version. */
  explanation: string
  /** The version this one was derived from (null for the first). */
  basedOn: string | null
  createdAt: number
}

export type ChatRole = 'user' | 'assistant'

/**
 * One entry in a project's conversation history. The three content "focuses"
 * the UI renders: a user request, a model explanation, and a code snippet
 * (referenced by `versionId`).
 */
export interface ChatEntry {
  id: string
  role: ChatRole
  createdAt: number
  /** user: the modification request. */
  text?: string
  /** user: which version number this request was based on (null = from scratch). */
  basedOnLabel?: number | null
  /** assistant: the prose explanation. */
  explanation?: string
  /** assistant: the version this turn produced (null if it failed). */
  versionId?: string | null
  /** assistant: present when the turn errored. */
  error?: string
}

export interface Project {
  id: string
  name: string
  /** Selected LLM profile id (from Settings). */
  llmId: string | null
  /** Selected data-source profile ids (from Settings). */
  dataSourceIds: string[]
  versions: ToolVersion[]
  /** The version currently shown in the preview. */
  currentVersionId: string | null
  chat: ChatEntry[]
  createdAt: number
  updatedAt: number
}

// ---- Defaults & factories ---------------------------------------------

export const emptyDataSource: DataSource = {
  kind: 'paste',
  paste: '',
  file: { name: '', text: '' },
  http: { method: 'GET', url: '', headers: '', body: '' },
  mcp: { url: '', headers: '', toolName: '', argsJson: '{}' },
}

const newId = () => crypto.randomUUID()

export function createLlmProfile(name = 'New LLM'): LlmProfile {
  return {
    id: newId(),
    name,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
  }
}

export function createDataSourceProfile(name = 'New source'): DataSourceProfile {
  return { id: newId(), name, config: structuredClone(emptyDataSource) }
}

export function createProject(name = 'Untitled project'): Project {
  const now = Date.now()
  return {
    id: newId(),
    name,
    llmId: null,
    dataSourceIds: [],
    versions: [],
    currentVersionId: null,
    chat: [],
    createdAt: now,
    updatedAt: now,
  }
}
