import Papa from 'papaparse'
import type { DataSource } from '../types'
import { callMcpTool } from './mcp'

/** Parse "Key: Value" lines into a headers object. */
export function parseHeaderLines(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (key) out[key] = value
    }
  }
  return out
}

function parseJsonOrThrow(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

async function loadHttp(source: DataSource): Promise<unknown> {
  const { method, url, headers, body } = source.http
  if (!url) throw new Error('HTTP URL is not set.')
  const res = await fetch(url, {
    method,
    headers: parseHeaderLines(headers),
    ...(method === 'POST' && body ? { body } : {}),
  })
  if (!res.ok) throw new Error(`Request failed (${res.status}).`)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Load data from whichever source the user configured, normalized to JSON. */
export async function loadData(source: DataSource): Promise<unknown> {
  switch (source.kind) {
    case 'paste':
      if (!source.paste.trim()) throw new Error('No JSON pasted yet.')
      return parseJsonOrThrow(source.paste, 'Pasted text')
    case 'file': {
      const uploadedText = source.file.text
      if (!uploadedText) throw new Error('No file uploaded yet.')
      const trimmed = uploadedText.trimStart()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return parseJsonOrThrow(uploadedText, 'Uploaded file')
      }
      // Treat anything else as CSV.
      return Papa.parse(uploadedText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      }).data
    }
    case 'http':
      return loadHttp(source)
    case 'mcp':
      return callMcpTool(source.mcp)
    default:
      throw new Error('Unknown data source.')
  }
}
