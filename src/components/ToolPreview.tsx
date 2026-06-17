import { useState } from 'react'
import type { ToolVersion } from '../types'
import type { NamedData } from '../lib/schema'
import { SandboxFrame } from './SandboxFrame'

interface Props {
  versions: ToolVersion[]
  currentVersionId: string | null
  data: NamedData[]
  onSelectVersion: (versionId: string) => void
}

export function ToolPreview({ versions, currentVersionId, data, onSelectVersion }: Props) {
  const [mode, setMode] = useState<'result' | 'code'>('result')
  const current = versions.find((v) => v.id === currentVersionId) ?? null

  if (!current) {
    return (
      <div className="empty">
        Describe a tool and generate it — the result will run here.
      </div>
    )
  }

  return (
    <div className="preview">
      <div className="preview-bar">
        <div className="tabs">
          <button
            className={mode === 'result' ? 'tab active' : 'tab'}
            onClick={() => setMode('result')}
          >
            Result
          </button>
          <button
            className={mode === 'code' ? 'tab active' : 'tab'}
            onClick={() => setMode('code')}
          >
            Code
          </button>
        </div>
        <select
          className="version-select"
          value={current.id}
          onChange={(e) => onSelectVersion(e.target.value)}
        >
          {versions
            .slice()
            .reverse()
            .map((v) => (
              <option key={v.id} value={v.id}>
                v{v.label}
                {v.id === versions[versions.length - 1].id ? ' (latest)' : ''}
              </option>
            ))}
        </select>
      </div>

      {mode === 'result' ? (
        <SandboxFrame fragment={current.html} sources={data} />
      ) : (
        <pre className="code-view">{current.html}</pre>
      )}
    </div>
  )
}
