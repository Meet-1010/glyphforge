import { DEFAULT_STATE, type StudioState } from "./config"
import featured from "../data/community.json"

export interface Creation {
  id: string
  title: string
  author?: string
  authorUrl?: string
  /** ISO date. */
  createdAt: string
  config: StudioState
}

interface StoredCreation {
  id: string
  title: string
  author?: string
  authorUrl?: string
  createdAt: string
  config: Partial<StudioState>
}

/**
 * Merging over the defaults means an entry written against an older shape still
 * opens after new settings are added, instead of rendering a broken scene.
 */
function hydrate(entry: StoredCreation): Creation {
  return {
    ...entry,
    config: {
      ...DEFAULT_STATE,
      ...entry.config,
      postfx: { ...DEFAULT_STATE.postfx, ...(entry.config.postfx ?? {}) },
      motion: { ...DEFAULT_STATE.motion, ...(entry.config.motion ?? {}) },
      material: { ...DEFAULT_STATE.material, ...(entry.config.material ?? {}) },
    },
  }
}

/** Curated entries that ship with the site. */
export function featuredCreations(): Creation[] {
  return (featured as StoredCreation[]).map(hydrate)
}

const STORAGE_KEY = "glyphforge:creations"

/**
 * Saved creations live in this browser only.
 *
 * There is no Glyphforge server, so nothing here syncs between devices or
 * reaches anyone else — clearing site data clears these.
 */
export function savedCreations(): Creation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(hydrate)
  } catch {
    // Private mode, blocked storage, or corrupted JSON — an empty gallery is
    // the right answer either way.
    return []
  }
}

export function saveCreation(title: string, config: StudioState): Creation | null {
  if (typeof window === "undefined") return null

  const creation: StoredCreation = {
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || "Untitled",
    createdAt: new Date().toISOString(),
    config,
  }

  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    const next = Array.isArray(existing) ? [creation, ...existing] : [creation]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 60)))
    return hydrate(creation)
  } catch {
    return null
  }
}

export function removeCreation(id: string): void {
  if (typeof window === "undefined") return
  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(existing)) return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(existing.filter((entry: StoredCreation) => entry.id !== id)),
    )
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

/**
 * A creation whose model came from a file picker cannot be shared or reopened
 * later: the blob URL dies with the tab.
 */
export function isPortable(creation: Creation): boolean {
  const src = (creation.config.model as { src?: string }).src
  return !(typeof src === "string" && src.startsWith("blob:"))
}
