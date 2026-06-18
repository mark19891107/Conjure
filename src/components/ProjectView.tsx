import { useEffect, useState } from 'react'
import type { ChatEntry, DataSourceProfile, Project, Settings, ToolVersion } from '../types'
import { loadData } from '../lib/dataSources'
import { deriveContexts, type NamedData } from '../lib/schema'
import { chatCompleteStream } from '../lib/llm'
import { buildMessages, parseLlmReply, parseStreamingText } from '../lib/prompt'
import { ConversationPanel } from './ConversationPanel'
import { ToolPreview } from './ToolPreview'

interface Props {
  project: Project
  settings: Settings
  onChange: (next: Project) => void
  onBack: () => void
  onGoSettings: () => void
}

const uid = () => crypto.randomUUID()

export function ProjectView({ project, settings, onChange, onBack, onGoSettings }: Props) {
  const [request, setRequest] = useState('')
  const [baseChoice, setBaseChoice] = useState<'current' | 'latest'>('current')
  const [data, setData] = useState<NamedData[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState<string | null>(null)

  const patch = (p: Partial<Project>) => onChange({ ...project, ...p, updatedAt: Date.now() })

  const selectedSources = (): DataSourceProfile[] =>
    project.dataSourceIds
      .map((id) => settings.dataSources.find((s) => s.id === id))
      .filter((s): s is DataSourceProfile => Boolean(s))

  async function loadAll(): Promise<NamedData[]> {
    const named = await Promise.all(
      selectedSources().map(async (p) => ({ name: p.name, data: await loadData(p.config) })),
    )
    setData(named)
    return named
  }

  // Load data once when the project opens, so a saved tool renders with data.
  useEffect(() => {
    if (project.dataSourceIds.length) loadAll().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const latest = (): ToolVersion | null =>
    project.versions.length ? project.versions[project.versions.length - 1] : null

  const baseVersion = (): ToolVersion | null => {
    if (!project.versions.length) return null
    if (baseChoice === 'latest') return latest()
    return project.versions.find((v) => v.id === project.currentVersionId) ?? latest()
  }

  async function run(refine: boolean) {
    const text = request.trim()
    if (!text) {
      setStatus('Describe the tool you want.')
      return
    }
    const llm = settings.llms.find((l) => l.id === project.llmId)
    if (!llm) {
      setStatus('Pick a language model for this project first.')
      return
    }
    const base = refine ? baseVersion() : null
    const now = Date.now()
    const userEntry: ChatEntry = {
      id: uid(),
      role: 'user',
      text,
      basedOnLabel: base?.label ?? null,
      createdAt: now,
    }

    // Show the user's message immediately, before the LLM responds.
    const chatAfterUser = [...project.chat, userEntry]
    patch({ chat: chatAfterUser })

    setBusy(true)
    setStatus('Loading data…')
    setStreamingText(null)

    try {
      const named = await loadAll()
      setStatus('Generating…')
      const messages = buildMessages(text, deriveContexts(named), base?.html)

      setStreamingText('')
      const reply = await chatCompleteStream(llm, messages, (accumulated) => {
        setStreamingText(accumulated)
      })
      setStreamingText(null)

      const { explanation, code } = parseLlmReply(reply)
      const version: ToolVersion = {
        id: uid(),
        label: project.versions.length + 1,
        html: code,
        explanation,
        basedOn: base?.id ?? null,
        createdAt: Date.now(),
      }
      const assistantEntry: ChatEntry = {
        id: uid(),
        role: 'assistant',
        explanation,
        versionId: version.id,
        createdAt: Date.now(),
      }
      patch({
        versions: [...project.versions, version],
        currentVersionId: version.id,
        chat: [...chatAfterUser, assistantEntry],
      })
      setRequest('')
      setStatus(null)
    } catch (e) {
      setStreamingText(null)
      const message = (e as Error).message
      const assistantEntry: ChatEntry = {
        id: uid(),
        role: 'assistant',
        error: message,
        createdAt: Date.now(),
      }
      patch({ chat: [...chatAfterUser, assistantEntry] })
      setStatus(`Error: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleSource = (id: string) => {
    const has = project.dataSourceIds.includes(id)
    patch({
      dataSourceIds: has
        ? project.dataSourceIds.filter((x) => x !== id)
        : [...project.dataSourceIds, id],
    })
  }

  // Derive streaming code to pass to ToolPreview for live code display
  const streamingParse = streamingText !== null ? parseStreamingText(streamingText) : null
  const streamingCode = streamingParse?.codeStarted ? streamingParse.partialCode : null

  const noConfig = settings.llms.length === 0 && settings.dataSources.length === 0
  const current = project.versions.find((v) => v.id === project.currentVersionId)
  const showRefineBase = project.versions.length > 0 && project.currentVersionId !== latest()?.id

  return (
    <div className="project">
      <header className="project-head">
        <button className="link" onClick={onBack}>
          ← Projects
        </button>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </header>

      <div className="project-config">
        <label className="config-field">
          Language model
          <select
            value={project.llmId ?? ''}
            onChange={(e) => patch({ llmId: e.target.value || null })}
          >
            <option value="">— select —</option>
            {settings.llms.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="config-field">
          Data sources
          <div className="checks">
            {settings.dataSources.length === 0 && <span className="hint">None configured.</span>}
            {settings.dataSources.map((s) => (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  checked={project.dataSourceIds.includes(s.id)}
                  onChange={() => toggleSource(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
        {noConfig && (
          <p className="hint">
            No models or sources yet.{' '}
            <button className="link" onClick={onGoSettings}>
              Open Settings
            </button>{' '}
            to add them.
          </p>
        )}
      </div>

      <div className="project-body">
        <section className="conversation-col">
          <ConversationPanel
            chat={project.chat}
            versions={project.versions}
            currentVersionId={project.currentVersionId}
            onSelectVersion={(id) => patch({ currentVersionId: id })}
            streamingText={streamingText}
          />
          <div className="composer">
            {showRefineBase && (
              <div className="base-choice">
                Refine based on:
                <label className="check">
                  <input
                    type="radio"
                    name="base"
                    checked={baseChoice === 'current'}
                    onChange={() => setBaseChoice('current')}
                  />
                  viewing (v{current?.label})
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="base"
                    checked={baseChoice === 'latest'}
                    onChange={() => setBaseChoice('latest')}
                  />
                  latest (v{latest()?.label})
                </label>
              </div>
            )}
            <textarea
              className="request"
              rows={3}
              value={request}
              placeholder="e.g. Bar chart of revenue by region, sorted descending"
              onChange={(e) => setRequest(e.target.value)}
            />
            <div className="actions">
              <button className="primary" disabled={busy} onClick={() => run(false)}>
                {busy ? 'Working…' : project.versions.length ? 'Generate new' : 'Generate'}
              </button>
              <button
                disabled={busy || project.versions.length === 0}
                onClick={() => run(true)}
              >
                Refine
              </button>
            </div>
            {status && <p className="status">{status}</p>}
          </div>
        </section>

        <section className="preview-col">
          <ToolPreview
            versions={project.versions}
            currentVersionId={project.currentVersionId}
            data={data}
            onSelectVersion={(id) => patch({ currentVersionId: id })}
            streamingCode={streamingCode}
          />
        </section>
      </div>
    </div>
  )
}
