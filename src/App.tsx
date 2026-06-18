import { useRef, useState } from 'react'
import './App.css'
import { SettingsView } from './components/SettingsView'
import { ProjectView } from './components/ProjectView'
import { usePersisted } from './hooks'
import { STORAGE_KEYS, buildInitialSettings } from './lib/storage'
import {
  buildProjectBundle,
  bundleFilename,
  downloadText,
  parseBundle,
  prepareImport,
  serializeBundle,
} from './lib/projectShare'
import { createProject, type Project, type Settings } from './types'

type View = 'projects' | 'settings'

export default function App() {
  const [settings, setSettings] = usePersisted<Settings>(
    STORAGE_KEYS.settings,
    buildInitialSettings(),
  )
  const [projects, setProjects] = usePersisted<Project[]>(STORAGE_KEYS.projects, [])
  const [view, setView] = useState<View>('projects')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active = projects.find((p) => p.id === activeId) ?? null

  const updateProject = (next: Project) =>
    setProjects(projects.map((p) => (p.id === next.id ? next : p)))

  const newProject = () => {
    const p = createProject(`Project ${projects.length + 1}`)
    setProjects([p, ...projects])
    setActiveId(p.id)
    setView('projects')
  }

  const deleteProject = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const exportProject = (p: Project) => {
    const bundle = buildProjectBundle(p, settings)
    downloadText(bundleFilename(p.name), serializeBundle(bundle))
  }

  const importProject = async (file: File) => {
    try {
      const text = await file.text()
      const bundle = parseBundle(text)
      const { project, llms, dataSources } = prepareImport(bundle)
      setSettings({
        llms: [...settings.llms, ...llms],
        dataSources: [...settings.dataSources, ...dataSources],
      })
      setProjects([project, ...projects])
      setActiveId(project.id)
      setView('projects')
      setImportNote(
        llms.length
          ? `Imported "${project.name}". Set the API key for its language model in Settings before refining.`
          : `Imported "${project.name}".`,
      )
    } catch (e) {
      setImportNote(`Import failed: ${(e as Error).message}`)
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void importProject(file)
    e.target.value = '' // allow re-importing the same file
  }

  return (
    <div className="app">
      <nav className="topbar">
        <span className="brand" onClick={() => setActiveId(null)}>
          Conjure
        </span>
        <div className="nav">
          <button
            className={view === 'projects' && !active ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setView('projects')
              setActiveId(null)
            }}
          >
            Projects
          </button>
          <button
            className={view === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      <main className="content">
        {view === 'settings' ? (
          <SettingsView settings={settings} onChange={setSettings} />
        ) : active ? (
          <ProjectView
            project={active}
            settings={settings}
            onChange={updateProject}
            onBack={() => setActiveId(null)}
            onGoSettings={() => setView('settings')}
          />
        ) : (
          <div className="page">
            <div className="page-head">
              <h1 className="page-title">Projects</h1>
              <div className="head-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={onPickFile}
                />
                <button onClick={() => fileInputRef.current?.click()}>Import</button>
                <button className="primary" onClick={newProject}>
                  + New project
                </button>
              </div>
            </div>
            <p className="tagline">
              Each project pairs one language model with one or more data sources,
              then generates a version-controlled tool from your conversation.
            </p>
            {importNote && (
              <p className="hint import-note">
                {importNote}{' '}
                <button className="link" onClick={() => setImportNote(null)}>
                  dismiss
                </button>
              </p>
            )}
            {projects.length === 0 ? (
              <p className="hint">No projects yet. Create one to get started.</p>
            ) : (
              <ul className="project-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button className="link project-open" onClick={() => setActiveId(p.id)}>
                      <strong>{p.name}</strong>
                      <span className="project-meta">
                        {p.versions.length} version{p.versions.length === 1 ? '' : 's'} ·
                        updated {new Date(p.updatedAt).toLocaleString()}
                      </span>
                    </button>
                    <button
                      className="link list-action"
                      title="Export to a shareable file"
                      onClick={() => exportProject(p)}
                    >
                      Export
                    </button>
                    <button className="del" title="Delete" onClick={() => deleteProject(p.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
