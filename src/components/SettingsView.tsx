import { useState } from 'react'
import {
  createDataSourceProfile,
  createLlmProfile,
  type DataSourceProfile,
  type LlmProfile,
  type Settings,
} from '../types'
import { LlmConfigPanel } from './LlmConfigPanel'
import { DataSourcePanel } from './DataSourcePanel'

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
}

export function SettingsView({ settings, onChange }: Props) {
  const [openLlm, setOpenLlm] = useState<string | null>(null)
  const [openSource, setOpenSource] = useState<string | null>(null)

  const updateLlm = (id: string, patch: Partial<LlmProfile>) =>
    onChange({
      ...settings,
      llms: settings.llms.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })

  const addLlm = () => {
    const p = createLlmProfile(`LLM ${settings.llms.length + 1}`)
    onChange({ ...settings, llms: [...settings.llms, p] })
    setOpenLlm(p.id)
  }

  const removeLlm = (id: string) =>
    onChange({ ...settings, llms: settings.llms.filter((p) => p.id !== id) })

  const updateSource = (id: string, patch: Partial<DataSourceProfile>) =>
    onChange({
      ...settings,
      dataSources: settings.dataSources.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })

  const addSource = () => {
    const p = createDataSourceProfile(`Source ${settings.dataSources.length + 1}`)
    onChange({ ...settings, dataSources: [...settings.dataSources, p] })
    setOpenSource(p.id)
  }

  const removeSource = (id: string) =>
    onChange({ ...settings, dataSources: settings.dataSources.filter((p) => p.id !== id) })

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <p className="tagline">
        Reusable building blocks. Configure your language models and data sources
        here, then pick them inside any project.
      </p>

      <section className="panel">
        <div className="panel-head">
          <h2>Language models</h2>
          <button className="primary" onClick={addLlm}>
            + Add LLM
          </button>
        </div>
        {settings.llms.length === 0 && <p className="hint">No LLMs yet.</p>}
        {settings.llms.map((p) => (
          <div className="card" key={p.id}>
            <div className="card-head">
              <input
                className="name-input"
                value={p.name}
                onChange={(e) => updateLlm(p.id, { name: e.target.value })}
              />
              <button className="link" onClick={() => setOpenLlm(openLlm === p.id ? null : p.id)}>
                {openLlm === p.id ? 'Collapse' : 'Edit'}
              </button>
              <button className="del" title="Delete" onClick={() => removeLlm(p.id)}>
                ×
              </button>
            </div>
            <p className="hint card-sub">
              {p.model || 'no model'} · {p.baseUrl || 'no base URL'}
            </p>
            {openLlm === p.id && (
              <LlmConfigPanel config={p} onChange={(c) => updateLlm(p.id, c)} />
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Data sources</h2>
          <button className="primary" onClick={addSource}>
            + Add source
          </button>
        </div>
        {settings.dataSources.length === 0 && <p className="hint">No data sources yet.</p>}
        {settings.dataSources.map((p) => (
          <div className="card" key={p.id}>
            <div className="card-head">
              <input
                className="name-input"
                value={p.name}
                onChange={(e) => updateSource(p.id, { name: e.target.value })}
              />
              <button
                className="link"
                onClick={() => setOpenSource(openSource === p.id ? null : p.id)}
              >
                {openSource === p.id ? 'Collapse' : 'Edit'}
              </button>
              <button className="del" title="Delete" onClick={() => removeSource(p.id)}>
                ×
              </button>
            </div>
            <p className="hint card-sub">{p.config.kind}</p>
            {openSource === p.id && (
              <DataSourcePanel
                source={p.config}
                onChange={(config) => updateSource(p.id, { config })}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
