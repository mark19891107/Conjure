import { useState } from 'react'
import type { ChatEntry, ToolVersion } from '../types'

interface Props {
  chat: ChatEntry[]
  versions: ToolVersion[]
  currentVersionId: string | null
  onSelectVersion: (versionId: string) => void
}

/** A collapsible code snippet shown inside an assistant turn. */
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
      {open && <pre className="code-block">{version.html}</pre>}
    </div>
  )
}

export function ConversationPanel({
  chat,
  versions,
  currentVersionId,
  onSelectVersion,
}: Props) {
  if (chat.length === 0) {
    return (
      <p className="empty-conversation">
        No history yet. Describe the tool you want below to start.
      </p>
    )
  }

  return (
    <div className="conversation">
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
    </div>
  )
}
