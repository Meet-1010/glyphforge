/**
 * Node wiring for the shared catalogue.
 *
 * Everything in `glyphforge/catalog` runs on plain `fetch` and needs no help —
 * except the Objaverse category index, which is a 1.7 MB file the browser build
 * serves from `public/`. On Node it comes off disk when it can, and off the
 * repo over HTTP when it can't.
 */

import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { configureCatalog, type ObjaverseIndex } from "glyphforge/catalog"
import { OBJAVERSE_INDEX_FALLBACK_URL } from "./constants.js"
import { fetchJson } from "./format.js"

const here = dirname(fileURLToPath(import.meta.url))

/** Checked in order; the first that loads wins. */
function candidatePaths(): string[] {
  const configured = process.env.GLYPHFORGE_OBJAVERSE_INDEX
  return [
    ...(configured && !configured.startsWith("http") ? [resolve(configured)] : []),
    // Bundled by `npm run build` for the published package.
    join(here, "data", "objaverse-index.json"),
    // Running from source inside the monorepo.
    join(here, "..", "..", "..", "apps", "studio", "public", "objaverse-index.json"),
  ]
}

let warned = false

async function loadObjaverseIndex(): Promise<ObjaverseIndex> {
  for (const path of candidatePaths()) {
    try {
      return JSON.parse(await readFile(path, "utf8")) as ObjaverseIndex
    } catch {
      // Try the next candidate.
    }
  }

  const url = process.env.GLYPHFORGE_OBJAVERSE_INDEX?.startsWith("http")
    ? process.env.GLYPHFORGE_OBJAVERSE_INDEX
    : OBJAVERSE_INDEX_FALLBACK_URL

  if (!warned) {
    warned = true
    // stderr, never stdout: stdout is the JSON-RPC channel.
    console.error(`[glyphforge-mcp] Objaverse index not found locally, fetching ${url}`)
  }
  return fetchJson<ObjaverseIndex>(url, 30_000)
}

let configured = false

/** Idempotent — safe to call from any tool before it searches. */
export function ensureCatalogConfigured(): void {
  if (configured) return
  configureCatalog({ loadObjaverseIndex })
  configured = true
}
