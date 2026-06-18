// Export / import a project as a self-contained, shareable bundle.
//
// A bundle carries the project plus the data-source profiles it uses and the
// LLM profile it selected, so a recipient can open and run it without first
// recreating those Settings entries. The LLM API key is ALWAYS stripped — keys
// are never shared. On import, ids are remapped to avoid collisions with the
// recipient's existing Settings.

import type { DataSourceProfile, LlmProfile, Project, Settings } from '../types'

const BUNDLE_KIND = 'conjure:project-bundle'
const BUNDLE_VERSION = 1

export interface ProjectBundle {
  kind: typeof BUNDLE_KIND
  version: number
  project: Project
  /** The selected LLM profile, with apiKey blanked (null if none selected). */
  llm: LlmProfile | null
  /** The data-source profiles the project references. */
  dataSources: DataSourceProfile[]
}

/** Build a shareable bundle from a project and the current Settings. */
export function buildProjectBundle(project: Project, settings: Settings): ProjectBundle {
  const llmSrc = settings.llms.find((l) => l.id === project.llmId) ?? null
  const llm: LlmProfile | null = llmSrc ? { ...llmSrc, apiKey: '' } : null
  const dataSources = project.dataSourceIds
    .map((id) => settings.dataSources.find((s) => s.id === id))
    .filter((s): s is DataSourceProfile => Boolean(s))
  return { kind: BUNDLE_KIND, version: BUNDLE_VERSION, project, llm, dataSources }
}

export function serializeBundle(bundle: ProjectBundle): string {
  return JSON.stringify(bundle, null, 2)
}

/** Parse and validate a bundle from JSON text. Throws on malformed input. */
export function parseBundle(json: string): ProjectBundle {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const b = data as Partial<ProjectBundle>
  if (!b || b.kind !== BUNDLE_KIND || !b.project) {
    throw new Error('That file is not a Conjure project export.')
  }
  return {
    kind: BUNDLE_KIND,
    version: typeof b.version === 'number' ? b.version : BUNDLE_VERSION,
    project: b.project,
    llm: b.llm ?? null,
    dataSources: Array.isArray(b.dataSources) ? b.dataSources : [],
  }
}

export interface PreparedImport {
  project: Project
  /** LLM profiles to append to Settings (key blanked, recipient sets their own). */
  llms: LlmProfile[]
  /** Data-source profiles to append to Settings. */
  dataSources: DataSourceProfile[]
}

/**
 * Remap the bundle's ids so the imported project and its profiles do not
 * collide with the recipient's existing Settings, and re-point the project's
 * references at the new ids. The project's internal version / chat ids are
 * left intact (they are UUIDs, unique by construction).
 */
export function prepareImport(bundle: ProjectBundle): PreparedImport {
  const uid = () => crypto.randomUUID()
  const now = Date.now()

  const dsIdMap = new Map<string, string>()
  const dataSources = bundle.dataSources.map((ds) => {
    const newId = uid()
    dsIdMap.set(ds.id, newId)
    return { ...ds, id: newId }
  })

  let llmId: string | null = null
  const llms: LlmProfile[] = []
  if (bundle.llm) {
    const newId = uid()
    llmId = newId
    llms.push({ ...bundle.llm, id: newId, apiKey: '' })
  }

  const project: Project = {
    ...bundle.project,
    id: uid(),
    llmId,
    dataSourceIds: bundle.project.dataSourceIds
      .map((id) => dsIdMap.get(id))
      .filter((x): x is string => Boolean(x)),
    createdAt: now,
    updatedAt: now,
  }

  return { project, llms, dataSources }
}

/** Trigger a client-side download of text content. */
export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Slugify a project name into a safe download filename. */
export function bundleFilename(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base || 'project'}.conjure.json`
}
