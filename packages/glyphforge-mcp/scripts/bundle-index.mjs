/**
 * Copy the Objaverse category index into dist/ so the published package can
 * search it without a network round trip.
 *
 * Source of truth stays `apps/studio/public/objaverse-index.json` — this is a
 * build artefact, not a second copy in the repo.
 */

import { copyFile, mkdir, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, "..", "..", "..", "apps", "studio", "public", "objaverse-index.json")
const targetDir = join(here, "..", "dist", "data")
const target = join(targetDir, "objaverse-index.json")

try {
  await stat(source)
} catch {
  console.error(
    `[bundle-index] ${source} not found — the published package will fall back to fetching the index over HTTP.`,
  )
  process.exit(0)
}

await mkdir(targetDir, { recursive: true })
await copyFile(source, target)
const { size } = await stat(target)
console.log(`[bundle-index] bundled objaverse-index.json (${(size / 1024 / 1024).toFixed(1)} MB)`)
