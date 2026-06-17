// Copy the self-contained UMD builds of bundled sandbox libraries into
// src/vendor/ so they can be imported with Vite's `?raw` and inlined into the
// no-network sandbox. Runs on postinstall and prebuild.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const files = [
  ['node_modules/chart.js/dist/chart.umd.js', 'src/vendor/chart.umd.js'],
  ['node_modules/papaparse/papaparse.min.js', 'src/vendor/papaparse.min.js'],
]

for (const [from, to] of files) {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.log(`vendored ${to}`)
}
