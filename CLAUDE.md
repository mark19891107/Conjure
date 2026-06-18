# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

- **Reply to the user in Chinese (中文).** This is the user's stated preference
  for this repository. Code, comments, identifiers, commit messages, and
  documentation stay in English; only the chat conversation is in Chinese.

## Project overview

Conjure is a pure client-side single-page application built with **React 18 +
TypeScript + Vite**. It has no backend — it is bundled to static assets and
served from **GitHub Pages** at `https://mark19891107.github.io/Conjure/`.

It is a **browser-only AI tool workshop** organised around two concepts:
**Settings** (a reusable library of LLM profiles and data-source profiles) and
**Projects** (each picks one LLM + several data sources, then generates a
version-controlled tool through a recorded conversation). The user describes a
tool in natural language and the LLM returns an explanation plus a
self-contained front-end fragment that runs sandboxed in the browser. See
**`SPEC.md`** for the full product spec and the locked design decisions — read
it before changing behavior.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server with HMR at http://localhost:5173
npm run build        # tsc -b (type-check) then vite build → dist/
npm run preview      # serve the production build locally
npm run lint         # ESLint over the repo
npm run typecheck    # tsc -b --noEmit
```

There is no test runner configured yet. If you add one (e.g. Vitest), wire it
into a `test` script and update this file.

## Architecture

- **Entry flow:** `index.html` loads `src/main.tsx`, which mounts `<App />`
  (`src/App.tsx`) into `#root` via React's `createRoot`, wrapped in
  `<StrictMode>`. Component styles live alongside components (`App.css`); global
  styles are in `src/index.css`.
- **State lives in `localStorage`** (no backend). `src/lib/storage.ts` +
  `usePersisted` in `src/hooks.ts` persist two keys: `conjure:settings`
  (`Settings`: `llms` + `dataSources` profiles) and `conjure:projects`
  (`Project[]`). `buildInitialSettings()` migrates the old single-config keys
  (`conjure:llm`, `conjure:dataSource`) into profiles on first load.
- **Domain types — `src/types.ts`:** `LlmProfile` / `DataSourceProfile` /
  `Settings`; and `Project`, which owns `versions` (a `ToolVersion[]` — the tool
  source under version control), `currentVersionId` (the version shown in the
  preview), and `chat` (a `ChatEntry[]` conversation log). Each generate/refine
  appends a user entry and an assistant entry; assistant entries link to the
  `ToolVersion` they produced.
- **Top-level UI — `src/App.tsx`:** a topbar switches between the **Projects**
  list and **Settings** (`SettingsView.tsx`, CRUD over profiles). Opening a
  project renders `ProjectView.tsx`.
- **Project flow — `src/components/ProjectView.tsx`:** load each selected data
  source (`src/lib/dataSources.ts`, MCP via `src/lib/mcp.ts`) into named data →
  derive per-source schema + sample (`deriveContexts` in `src/lib/schema.ts`) →
  build messages (`buildMessages` in `src/lib/prompt.ts`; refine passes the base
  version's HTML — the latest or the currently-viewed one) → call the
  OpenAI-compatible API (`src/lib/llm.ts` — `chatCompleteStream` parses SSE and
  streams tokens; `chatComplete` is the non-streaming fallback) → split the
  reply into explanation + code (`parseLlmReply`; `parseStreamingText` splits
  the in-progress stream) → store a new `ToolVersion`. While streaming, the
  partial reply shows live in `ConversationPanel.tsx` and the preview
  auto-switches to a syntax-highlighted Code view (`src/lib/highlight.ts`).
  `ToolPreview.tsx` toggles Result⇄Code and switches versions.
- **Project sharing — `src/lib/projectShare.ts`:** export a project to a
  self-contained JSON bundle (project + referenced data-source profiles + LLM
  profile **with the API key stripped**) and import it back, remapping ids to
  avoid collisions. Wired into the Projects list in `App.tsx`.
- **Sandbox (security-critical) — `src/lib/sandbox.ts` + `SandboxFrame.tsx`:**
  generated code runs in an `<iframe sandbox="allow-scripts allow-downloads">`
  (no `allow-same-origin`) with a strict CSP (`connect-src 'none'`), so it
  cannot read the parent's `localStorage` (API keys) or make any network
  request. `allow-downloads` only permits user-initiated file downloads (e.g.
  export CSV via a Blob object URL) — it grants no network or origin access. All
  selected sources are inlined as `window.__CONJURE_SOURCES__` (keyed by name)
  plus `window.__CONJURE_DATA__` (the primary/first source); bundled libs
  (Chart.js, PapaParse) are inlined too. **Do not weaken this isolation**
  (never add `allow-same-origin` or relax `connect-src`).
- **Bundled sandbox libs:** `scripts/copy-vendor.mjs` copies the UMD builds
  from `node_modules` into `src/vendor/` (gitignored) on `postinstall` /
  `predev` / `prebuild`; `sandbox.ts` imports them with Vite's `?raw`. To add a
  library, add it to that script and update the system prompt in `prompt.ts`.
- **Build:** Vite bundles everything to `dist/`. There is no SSR and no runtime
  server — the output is fully static.
- **TypeScript project references:** `tsconfig.json` is a thin root that
  references `tsconfig.app.json` (browser/`src` code) and `tsconfig.node.json`
  (build tooling like `vite.config.ts`). Strict mode plus `noUnusedLocals` /
  `noUnusedParameters` are on, so unused symbols fail the build.

## GitHub Pages base path — important

Because the app is served from the `/Conjure/` sub-path (a project page, not a
user page), `vite.config.ts` sets Vite's `base`:

- `base: '/Conjure/'` for production builds (`command === 'build'`)
- `base: '/'` for local dev so `localhost:5173` works

Consequences to keep in mind:

- **Never hardcode absolute asset paths** like `/img/logo.png` in source — they
  break on Pages. Import assets so Vite rewrites them, or use relative paths.
- If the **repository is renamed**, update `repoName` in `vite.config.ts` to
  match, or assets will 404 in production.
- Files in `public/` are copied verbatim and are also served under the base
  path; reference them with Vite's `import.meta.env.BASE_URL` when needed.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` (and via manual
`workflow_dispatch`). It installs deps, runs `npm run build`, uploads `dist/`
as a Pages artifact, and deploys with `actions/deploy-pages`.

- One-time repo setup: **Settings → Pages → Source → "GitHub Actions"**.
- `main` is the deploy branch. Active development for tasks in this environment
  happens on the branch noted in the task instructions; merge to `main` to ship.
- A failing `npm run build` (including type errors) fails the deploy — keep the
  build green.
