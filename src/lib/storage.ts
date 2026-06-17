// Typed localStorage helpers. All Conjure state lives here — there is no backend.

import {
  emptyDataSource,
  type DataSource,
  type LLMConfig,
  type LlmProfile,
  type DataSourceProfile,
  type Settings,
} from '../types'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or serialization failure — non-fatal.
  }
}

export const STORAGE_KEYS = {
  settings: 'conjure:settings',
  projects: 'conjure:projects',
  // Legacy single-config keys from the first version, used for migration only.
  legacyLlm: 'conjure:llm',
  legacyDataSource: 'conjure:dataSource',
} as const

/**
 * Initial Settings: the persisted value if present, otherwise migrated from the
 * old single-config keys so a returning user keeps their key and data source.
 */
export function buildInitialSettings(): Settings {
  const existing = load<Settings | null>(STORAGE_KEYS.settings, null)
  if (existing) return existing

  const llms: LlmProfile[] = []
  const dataSources: DataSourceProfile[] = []

  const legacyLlm = load<LLMConfig | null>(STORAGE_KEYS.legacyLlm, null)
  if (legacyLlm && (legacyLlm.apiKey || legacyLlm.baseUrl)) {
    llms.push({ id: crypto.randomUUID(), name: 'Imported LLM', ...legacyLlm })
  }

  const legacySource = load<DataSource | null>(STORAGE_KEYS.legacyDataSource, null)
  if (legacySource) {
    dataSources.push({
      id: crypto.randomUUID(),
      name: 'Imported source',
      config: { ...emptyDataSource, ...legacySource, file: emptyDataSource.file },
    })
  }

  return { llms, dataSources }
}
