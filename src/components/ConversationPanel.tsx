import { useEffect, useRef, useState } from 'react'
import type { ChatEntry, ToolVersion } from '../types'
import { parseStreamingText } from '../lib/prompt'
import { highlightHtml } from '../lib/highlight'

interface Props {
  chat: ChatEntry[]
  versions: ToolVersion[]
  currentVersionId: string | null
  onSelectVersion: (versionId: string) => void
  streamingText?: string | null
  explorePhase?: 'exploring' | 'explored' | null
  autoFixAttempt?: number | null
  suggestions?: string[]
  onSuggestion?: (text: string) => void
}

function CodeCard({
  version,
  isCurrent,
  onSelect,
}: {
  version: ToolVersion
  isCurrent: boolean
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={isCurrent ? 'code-card current' : 'code-card'}>
      <div className="code-card-head">
        <span className="version-badge">v{version.label}</span>
        <button className="link" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide code' : 'Show code'}
        </button>
        <button className="link" onClick={onSelect} disabled={isCurrent}>
          {isCurrent ? 'Viewing' : 'View this version'}
        </button>
      </div>
      {open && (
        <pre
          className="code-block"
          dangerouslySetInnerHTML={{ __html: highlightHtml(version.html) }}
        />
      )}
    </div>
  )
}

export function ConversationPanel({
  chat,
  versions,
  currentVersionId,
  onSelectVersion,
  streamingText,
  explorePhase,
  autoFixAttempt,
  suggestions = [],
  onSuggestion,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length, streamingText, explorePhase, autoFixAttempt])

  if (chat.length === 0 && streamingText == null && !explorePhase && !autoFixAttempt) {
    return (
      <p className="empty-conversation">
        No history yet. Describe the tool you want below to start.
      </p>
    )
  }

  return (
    <div className="conversation" ref={scrollRef}>
      {chat.map((entry) => {
        if (entry.role === 'user') {
          return (
            <div className="msg user" key={entry.id}>
              {entry.basedOnLabel != null && (
                <span className="msg-meta">based on v{entry.basedOnLabel}</span>
              )}
              <div className="bubble">{entry.text}</div>
            </div>
          )
        }

        const version = versions.find((v) => v.id === entry.versionId)
        return (
          <div className="msg assistant" key={entry.id}>
            {entry.error ? (
              <div className="bubble error">{entry.error}</div>
            ) : (
              <>
                {entry.explanation && <div className="bubble">{entry.explanation}</div>}
                {version && (
                  <CodeCard
                    version={version}
                    isCurrent={version.id === currentVersionId}
                    onSelect={() => onSelectVersion(version.id)}
                  />
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Suggestion chips shown after the last assistant message */}
      {suggestions.length > 0 && !streamingText && !explorePhase && autoFixAttempt == null && (
        <div className="suggestion-row">
          <span className="suggestion-label">Try next:</span>
          <div className="suggestion-chips">
            {suggestions.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => onSuggestion?.(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exploration status — appears while the agent is analysing data */}
      {explorePhase && (
        <div className="msg assistant">
          <div className={`bubble explore-bubble${explorePhase === 'exploring' ? ' pulsing' : ''}`}>
            {explorePhase === 'exploring' ? '🔍 Analysing data…' : '✓ Data analysis complete'}
          </div>
        </div>
      )}

      {/* Auto-fix status — shown while auto-fixing a runtime error */}
      {autoFixAttempt != null && (
        <div className="msg assistant">
          <div className="code-card">
            <div className="code-card-head">
              <span className="version-badge streaming-badge autofix-badge">
                🔧 Auto-fixing ({autoFixAttempt}/3)…
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Streaming LLM response */}
      {streamingText != null &&
        (() => {
          const { explanation, codeStarted } = parseStreamingText(streamingText)
          return (
            <div className="msg assistant streaming">
              {explanation && <div className="bubble">{explanation}</div>}
              {codeStarted && (
                <div className="code-card">
                  <div className="code-card-head">
                    <span className="version-badge streaming-badge">generating…</span>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
    </div>
  )
}
