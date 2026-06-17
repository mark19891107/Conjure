// Derive a compact schema + small sample from arbitrary JSON, so we can give the
// model useful context cheaply without sending the entire dataset.

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function describe(value: unknown, depth = 0): string {
  const t = typeOf(value)
  if (t === 'array') {
    const arr = value as unknown[]
    if (arr.length === 0) return 'array (empty)'
    return `array<${describe(arr[0], depth + 1)}> (length ${arr.length})`
  }
  if (t === 'object' && depth < 3) {
    const obj = value as Record<string, unknown>
    const fields = Object.keys(obj)
      .slice(0, 30)
      .map((k) => `${k}: ${describe(obj[k], depth + 1)}`)
    return `{ ${fields.join(', ')} }`
  }
  return t
}

/** A small representative slice of the data for the prompt. */
function sample(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 3)
  return value
}

export interface DataContext {
  schema: string
  sample: string
  rowCount: number | null
}

export function deriveContext(data: unknown): DataContext {
  return {
    schema: describe(data),
    sample: JSON.stringify(sample(data), null, 2).slice(0, 4000),
    rowCount: Array.isArray(data) ? data.length : null,
  }
}
