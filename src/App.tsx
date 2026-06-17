import { useState } from 'react'
import './App.css'
import { LlmConfigPanel } from './components/LlmConfigPanel'
import { DataSourcePanel } from './components/DataSourcePanel'
import { SandboxFrame } from './components/SandboxFrame'
import { usePersisted } from './hooks'
import { STORAGE_KEYS } from './lib/storage'
import { loadData } from './lib/dataSources'
import { deriveContext } from './lib/schema'
import { chatComplete } from './lib/llm'
import { buildMessages, stripFences } from './lib/prompt'
import {
  defaultDataSource,
  defaultLLMConfig,
  type LLMConfig,
  type DataSource,
  type Tool,
} from './types'

export default function App() {
  const [llm, setLlm] = usePersisted<LLMConfig>(STORAGE_KEYS.llm, defaultLLMConfig)
  const [source, setSource] = usePersisted<DataSource>(
    STORAGE_KEYS.dataSource,
    defaultDataSource,
  )
  const [tools, setTools] = usePersisted<Tool[]>(STORAGE_KEYS.tools, [])

  const [fileText, setFileText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [data, setData] = useState<unknown>(null)
  const [request, setRequest] = useState('')
  const [fragment, setFragment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = (text: string) => {
    setFileText(text)
    setFileName('uploaded file')
  }

  const handleLoadData = async () => {
    setStatus(null)
    try {
      const loaded = await loadData(source, fileText)
      setData(loaded)
      const ctx = deriveContext(loaded)
      setStatus(`Loaded data — ${ctx.rowCount ?? 'object'} ${ctx.rowCount ? 'rows' : ''}`)
    } catch (e) {
      setData(null)
      setStatus(`Data error: ${(e as Error).message}`)
    }
  }

  const handleGenerate = async (refine: boolean) => {
    if (data === null) {
      setStatus('Load data first.')
      return
    }
    if (!request.trim()) {
      setStatus('Describe the tool you want.')
      return
    }
    setBusy(true)
    setStatus('Generating…')
    try {
      const ctx = deriveContext(data)
      const messages = buildMessages(request, ctx, refine ? fragment : undefined)
      const reply = await chatComplete(llm, messages)
      setFragment(stripFences(reply))
      setStatus('Done.')
    } catch (e) {
      setStatus(`LLM error: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const saveTool = () => {
    if (!fragment) return
    const name = request.slice(0, 60) || 'Untitled tool'
    setTools([
      { id: crypto.randomUUID(), name, prompt: request, html: fragment, createdAt: Date.now() },
      ...tools,
    ])
    setStatus('Saved to library.')
  }

  const openTool = (t: Tool) => {
    setRequest(t.prompt)
    setFragment(t.html)
    setStatus(`Opened "${t.name}".`)
  }

  const deleteTool = (id: string) => setTools(tools.filter((t) => t.id !== id))

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">Conjure</h1>
        <p className="tagline">Describe a tool. Run it on your data. All in your browser.</p>
        <LlmConfigPanel config={llm} onChange={setLlm} />
        <DataSourcePanel
          source={source}
          onChange={setSource}
          onFile={onFile}
          fileName={fileName}
        />
        <button className="primary" onClick={handleLoadData}>
          Load data
        </button>

        {tools.length > 0 && (
          <section className="panel">
            <h2>Saved tools</h2>
            <ul className="tool-list">
              {tools.map((t) => (
                <li key={t.id}>
                  <button className="link" onClick={() => openTool(t)}>
                    {t.name}
                  </button>
                  <button className="del" onClick={() => deleteTool(t.id)} title="Delete">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <main className="main">
        <div className="generator">
          <textarea
            className="request"
            rows={3}
            value={request}
            placeholder="e.g. Bar chart of revenue by region, sorted descending"
            onChange={(e) => setRequest(e.target.value)}
          />
          <div className="actions">
            <button className="primary" disabled={busy} onClick={() => handleGenerate(false)}>
              {busy ? 'Working…' : 'Generate'}
            </button>
            <button disabled={busy || !fragment} onClick={() => handleGenerate(true)}>
              Refine
            </button>
            <button disabled={!fragment} onClick={saveTool}>
              Save
            </button>
          </div>
          {status && <p className="status">{status}</p>}
        </div>

        {fragment ? (
          <SandboxFrame fragment={fragment} data={data} />
        ) : (
          <div className="empty">
            Configure your LLM and data, then describe a tool to generate it.
          </div>
        )}
      </main>
    </div>
  )
}
