# Conjure

A pure front-end application built with **React + TypeScript + Vite**, deployed
automatically to **GitHub Pages** via GitHub Actions.

🔗 Live site: `https://mark19891107.github.io/Conjure/`

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server at http://localhost:5173
```

## Scripts

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with hot module replacement |
| `npm run build`     | Type-check (`tsc -b`) and bundle to `dist/`          |
| `npm run preview`   | Serve the production build locally                   |
| `npm run lint`      | Run ESLint                                            |
| `npm run typecheck` | Type-check without emitting                           |

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes `dist/` to GitHub Pages.

**One-time setup:** In the repo, go to **Settings → Pages → Build and
deployment** and set the **Source** to **GitHub Actions**.

> The site is served from a sub-path (`/Conjure/`), so `vite.config.ts` sets
> `base` to `/Conjure/` for production builds. If you rename the repository,
> update `repoName` in `vite.config.ts` to match.
