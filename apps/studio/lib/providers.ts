/**
 * Asset search providers.
 *
 * Both sources serve `Access-Control-Allow-Origin: *` on their API *and* their
 * file CDN, so search and import both run entirely in the browser — no proxy,
 * no API key, and nothing about what you search for reaches a Glyphforge
 * server, because there isn't one.
 */

export type ProviderId = "polyhaven" | "khronos"

export interface AssetResult {
  id: string
  provider: ProviderId
  name: string
  author?: string
  /** Shown verbatim. Never guess a licence — link to the source instead. */
  license: string
  thumbnail?: string
  tags: string[]
  polycount?: number
  downloads?: number
  sourceUrl: string
  /** Some providers need a second request to resolve the loadable file. */
  resolveModelUrl: () => Promise<string>
}

export interface ProviderMeta {
  id: ProviderId
  label: string
  blurb: string
  homepage: string
  license: string
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "polyhaven",
    label: "Poly Haven",
    blurb: "Photoscanned and hand-modelled assets, every one CC0.",
    homepage: "https://polyhaven.com/models",
    license: "CC0 (public domain)",
  },
  {
    id: "khronos",
    label: "Khronos Samples",
    blurb: "The official glTF sample models. Licences vary per model.",
    homepage: "https://github.com/KhronosGroup/glTF-Sample-Assets",
    license: "Varies — check source",
  },
]

// -- Poly Haven --------------------------------------------------------------

interface PolyHavenAsset {
  name: string
  categories?: string[]
  tags?: string[]
  authors?: Record<string, string>
  polycount?: number
  download_count?: number
  thumbnail_url?: string
}

let polyHavenCache: Promise<AssetResult[]> | null = null

function loadPolyHaven(): Promise<AssetResult[]> {
  if (polyHavenCache) return polyHavenCache

  polyHavenCache = fetch("https://api.polyhaven.com/assets?t=models")
    .then((response) => {
      if (!response.ok) throw new Error(`Poly Haven returned ${response.status}`)
      return response.json() as Promise<Record<string, PolyHavenAsset>>
    })
    .then((data) =>
      Object.entries(data).map(([id, asset]) => ({
        id,
        provider: "polyhaven" as const,
        name: asset.name || id,
        author: Object.keys(asset.authors ?? {})[0],
        license: "CC0",
        thumbnail: asset.thumbnail_url,
        tags: [...(asset.categories ?? []), ...(asset.tags ?? [])],
        polycount: asset.polycount,
        downloads: asset.download_count,
        sourceUrl: `https://polyhaven.com/a/${id}`,
        resolveModelUrl: () => resolvePolyHavenUrl(id),
      })),
    )

  polyHavenCache.catch(() => {
    polyHavenCache = null
  })
  return polyHavenCache
}

/**
 * Poly Haven ships glTF with sibling `.bin` and texture files. Because the
 * whole directory is CORS-open, GLTFLoader resolves those relative paths on
 * its own — so the 1k variant loads unmodified. 1k keeps the import to a few
 * hundred KB; the ASCII pass cannot resolve 8k textures anyway.
 */
async function resolvePolyHavenUrl(id: string): Promise<string> {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`)
  if (!response.ok) throw new Error(`Could not resolve files for "${id}"`)
  const files = (await response.json()) as {
    gltf?: Record<string, { gltf?: { url?: string } }>
  }

  const resolutions = files.gltf ? Object.keys(files.gltf) : []
  if (resolutions.length === 0) throw new Error(`"${id}" has no glTF variant`)

  const preferred = ["1k", "2k", "4k", "8k"].find((r) => resolutions.includes(r)) ?? resolutions[0]
  const url = files.gltf?.[preferred]?.gltf?.url
  if (!url) throw new Error(`"${id}" has no downloadable glTF file`)
  return url
}

// -- Khronos glTF Sample Assets ---------------------------------------------

interface KhronosModel {
  name: string
  label?: string
  screenshot?: string
  tags?: string[]
  variants?: Record<string, string>
}

const KHRONOS_BASE =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models"

let khronosCache: Promise<AssetResult[]> | null = null

function loadKhronos(): Promise<AssetResult[]> {
  if (khronosCache) return khronosCache

  khronosCache = fetch(`${KHRONOS_BASE}/model-index.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`Khronos index returned ${response.status}`)
      return response.json() as Promise<KhronosModel[]>
    })
    .then((models) =>
      models
        // Only single-file .glb: the multi-file variants would drag in
        // sibling buffers that complicate a one-click import.
        .filter((model) => model.variants?.["glTF-Binary"])
        .map((model) => ({
          id: model.name,
          provider: "khronos" as const,
          name: model.label || model.name,
          license: "Varies — check source",
          thumbnail: model.screenshot
            ? `${KHRONOS_BASE}/${model.name}/${model.screenshot}`
            : undefined,
          tags: model.tags ?? [],
          sourceUrl: `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${model.name}`,
          resolveModelUrl: async () =>
            `${KHRONOS_BASE}/${model.name}/glTF-Binary/${model.variants!["glTF-Binary"]}`,
        })),
    )

  khronosCache.catch(() => {
    khronosCache = null
  })
  return khronosCache
}

// -- Search ------------------------------------------------------------------

const LOADERS: Record<ProviderId, () => Promise<AssetResult[]>> = {
  polyhaven: loadPolyHaven,
  khronos: loadKhronos,
}

export interface SearchOptions {
  query: string
  providers: ProviderId[]
  limit?: number
}

export interface SearchOutcome {
  results: AssetResult[]
  total: number
  /** Providers that failed, so the UI can say which rather than showing nothing. */
  failed: Array<{ provider: ProviderId; message: string }>
}

/**
 * Both catalogues are small enough to fetch once and filter locally, which
 * makes typing feel instant and avoids hammering either API per keystroke.
 */
export async function searchAssets({
  query,
  providers,
  limit = 60,
}: SearchOptions): Promise<SearchOutcome> {
  const failed: SearchOutcome["failed"] = []

  const batches = await Promise.all(
    providers.map(async (provider) => {
      try {
        return await LOADERS[provider]()
      } catch (error) {
        failed.push({
          provider,
          message: error instanceof Error ? error.message : "Request failed",
        })
        return [] as AssetResult[]
      }
    }),
  )

  const all = batches.flat()
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const matched =
    terms.length === 0
      ? all
      : all.filter((asset) => {
          const haystack = `${asset.name} ${asset.tags.join(" ")} ${asset.author ?? ""}`.toLowerCase()
          return terms.every((term) => haystack.includes(term))
        })

  // Rank exact name matches first, then by popularity where we know it.
  const ranked = [...matched].sort((a, b) => {
    if (terms.length > 0) {
      const aName = a.name.toLowerCase().includes(terms[0]) ? 1 : 0
      const bName = b.name.toLowerCase().includes(terms[0]) ? 1 : 0
      if (aName !== bName) return bName - aName
    }
    return (b.downloads ?? 0) - (a.downloads ?? 0)
  })

  return { results: ranked.slice(0, limit), total: ranked.length, failed }
}
