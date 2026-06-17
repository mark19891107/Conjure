// Typed localStorage helpers. All Conjure state lives here — there is no backend.

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
  llm: 'conjure:llm',
  dataSource: 'conjure:dataSource',
  tools: 'conjure:tools',
} as const
