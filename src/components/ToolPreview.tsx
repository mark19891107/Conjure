import { useEffect, useState } from 'react'
import type { ToolVersion } from '../types'
import type { NamedData } from '../lib/schema'
import { SandboxFrame } from './SandboxFrame'
import { highlightHtml } from '../lib/highlight'

interface Props {
  versions: ToolVersion[]
  currentVersionId: string | null
  data: NamedData[]
  onSelectVersion: (versionId: string) => void
  streamingCode?: string | null
}

export function ToolPreview({ versions, currentVersionId, data, onSelectVersion, streamingCode }: Props) {
  const [mode, setMode] = useState<'result' | 'code'>('result')
  const current = versions.find((v) => v.id === currentVersionId) ?? null

  // Auto-switch to code tab when the LLM starts emitting the code block
  const isStreaming = streamingCode != null
  useEffect(() => {
    if (isStreaming) setMode('code')
  }, [isStreaming])

  if (!current && !isStreaming) {
    return (
      <div className="empty">
        Describe a tool and generate it — the result will run here.
      </div>
    )
  }

  const displayCode = streamingCode !== null && streamingCode !== undefined
    ? streamingCode
    : current?.html ?? ''

  return (
    <div className="preview">
      <div className="preview-bar">
        <div className="tabs">
          <button
            className={mode === 'result' ? 'tab active' : 'tab'}
            onClick={() => setMode('result')}
            disabled={!current}
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
        {current ? (
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
        ) : (
          <span className="hint streaming-hint">generating v1…</span>
        )}
      </div>

      {mode === 'result' && current ? (
        <SandboxFrame fragment={current.html} sources={data} />
      ) : (
        <pre
          className="code-view"
          dangerouslySetInnerHTML={{ __html: highlightHtml(displayCode) }}
        />
      )}
    </div>
  )
}
