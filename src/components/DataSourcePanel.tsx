import type { ChangeEvent } from 'react'
import type { DataSource, DataSourceKind } from '../types'

interface Props {
  source: DataSource
  onChange: (next: DataSource) => void
  onFile: (text: string) => void
  fileName: string | null
}

const KINDS: { value: DataSourceKind; label: string }[] = [
  { value: 'paste', label: 'Paste JSON' },
  { value: 'file', label: 'Upload file' },
  { value: 'http', label: 'HTTP request' },
  { value: 'mcp', label: 'MCP tool' },
]

export function DataSourcePanel({ source, onChange, onFile, fileName }: Props) {
  const set = (patch: Partial<DataSource>) => onChange({ ...source, ...patch })

  const readFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onFile(String(reader.result))
    reader.readAsText(file)
  }

  return (
    <section className="panel">
      <h2>Data source</h2>
      <div className="tabs">
        {KINDS.map((k) => (
          <button
            key={k.value}
            className={source.kind === k.value ? 'tab active' : 'tab'}
            onClick={() => set({ kind: k.value })}
          >
            {k.label}
          </button>
        ))}
      </div>

      {source.kind === 'paste' && (
        <label>
          JSON
          <textarea
            rows={8}
            value={source.paste}
            placeholder='[{"region":"East","revenue":120}]'
            onChange={(e) => set({ paste: e.target.value })}
          />
        </label>
      )}

      {source.kind === 'file' && (
        <div>
          <input type="file" accept=".json,.csv,.txt" onChange={readFile} />
          <p className="hint">{fileName ? `Loaded: ${fileName}` : 'JSON or CSV.'}</p>
        </div>
      )}

      {source.kind === 'http' && (
        <>
          <div className="row">
            <select
              value={source.http.method}
              onChange={(e) =>
                set({ http: { ...source.http, method: e.target.value as 'GET' | 'POST' } })
              }
            >
              <option>GET</option>
              <option>POST</option>
            </select>
            <input
              value={source.http.url}
              placeholder="https://api.example.com/data"
              onChange={(e) => set({ http: { ...source.http, url: e.target.value } })}
            />
          </div>
          <label>
            Headers (one per line, "Key: Value")
            <textarea
              rows={3}
              value={source.http.headers}
              placeholder="Authorization: Bearer ..."
              onChange={(e) => set({ http: { ...source.http, headers: e.target.value } })}
            />
          </label>
          {source.http.method === 'POST' && (
            <label>
              Body
              <textarea
                rows={3}
                value={source.http.body}
                onChange={(e) => set({ http: { ...source.http, body: e.target.value } })}
              />
            </label>
          )}
          <p className="hint">Subject to CORS — the server must allow browser requests.</p>
        </>
      )}

      {source.kind === 'mcp' && (
        <>
          <label>
            MCP server URL (Streamable HTTP)
            <input
              value={source.mcp.url}
              placeholder="https://mcp.example.com/mcp"
              onChange={(e) => set({ mcp: { ...source.mcp, url: e.target.value } })}
            />
          </label>
          <label>
            Headers (one per line)
            <textarea
              rows={2}
              value={source.mcp.headers}
              onChange={(e) => set({ mcp: { ...source.mcp, headers: e.target.value } })}
            />
          </label>
          <div className="row">
            <input
              value={source.mcp.toolName}
              placeholder="tool name"
              onChange={(e) => set({ mcp: { ...source.mcp, toolName: e.target.value } })}
            />
          </div>
          <label>
            Arguments (JSON)
            <textarea
              rows={3}
              value={source.mcp.argsJson}
              onChange={(e) => set({ mcp: { ...source.mcp, argsJson: e.target.value } })}
            />
          </label>
          <p className="hint">Subject to CORS — the MCP server must expose an HTTP transport.</p>
        </>
      )}
    </section>
  )
}
