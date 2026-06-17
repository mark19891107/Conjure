# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Conjure is a pure client-side single-page application built with **React 18 +
TypeScript + Vite**. It has no backend — it is bundled to static assets and
served from **GitHub Pages** at `https://mark19891107.github.io/Conjure/`.

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
