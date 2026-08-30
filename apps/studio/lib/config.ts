import { PRESETS, type PresetName } from "glyphforge"
import type { AsciiPostFX, ModelSource, MotionOptions } from "glyphforge"

export interface StudioState {
  model: ModelSource
  preset: PresetName
  cellSize: number
  tint: string
  useTint: boolean
  characterSet: string
  invert: boolean
  color: boolean
  volumeShading: boolean
  transparent: boolean
  backgroundColor: string
  glyphStyle: "standard" | "dense" | "minimal" | "blocks"
  postfx: AsciiPostFX
  motion: MotionOptions
  material: { color: string; roughness: number; metalness: number }
  cameraZ: number | "auto"
}

export const DEFAULT_STATE: StudioState = {
  model: { type: "text", value: "GLYPH", depth: 0.35, bevel: 0.02 },
  preset: "terminal",
  cellSize: 9,
  tint: "#917AFF",
  useTint: true,
  characterSet: "terminal",
  invert: true,
  color: true,
  volumeShading: true,
  transparent: false,
  backgroundColor: "#000000",
  glyphStyle: "standard",
  postfx: { contrastAdjust: 1.8, brightnessAdjust: 0 },
  motion: { autoRotate: 0.4, hoverBoost: 2, draggable: true, hoverZoom: 1.1 },
  material: { color: "#917AFF", roughness: 0.12, metalness: 0 },
  cameraZ: "auto",
}

/** A source backed by an object URL can't be shared or serialised. */
export function isEphemeral(model: ModelSource): boolean {
  const src = (model as { src?: string }).src
  return typeof src === "string" && src.startsWith("blob:")
}

// -- Code generation ---------------------------------------------------------

function literal(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent)
  const padInner = "  ".repeat(indent + 1)

  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null || value === undefined) return "undefined"

  if (Array.isArray(value)) {
    return `[${value.map((v) => literal(v, indent)).join(", ")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  )
  if (entries.length === 0) return "{}"

  const inline = `{ ${entries.map(([k, v]) => `${k}: ${literal(v, indent)}`).join(", ")} }`
  if (inline.length <= 68) return inline

  return `{\n${entries
    .map(([k, v]) => `${padInner}${k}: ${literal(v, indent + 1)},`)
    .join("\n")}\n${pad}}`
}

/** Keep only the postfx keys that differ from the chosen preset. */
function postfxDiff(state: StudioState): AsciiPostFX {
  const base = (PRESETS[state.preset].postfx ?? {}) as Record<string, unknown>
  const diff: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(state.postfx)) {
    if (value === undefined) continue
    if (base[key] !== value) diff[key] = value
  }
  return diff as AsciiPostFX
}

interface CodeOptions {
  /** Emit `<GlyphHero>` with content, or the bare `<GlyphCanvas />`. */
  component?: "hero" | "canvas"
  /** Package import vs. ejected local path. */
  importFrom?: string
}

/**
 * Produce a paste-ready component.
 *
 * Only props that actually differ from the preset are emitted, so the snippet
 * stays short instead of restating the whole preset back at the reader.
 */
export function generateCode(state: StudioState, options: CodeOptions = {}): string {
  const { component = "hero", importFrom = "glyphforge" } = options
  const preset = PRESETS[state.preset] as Record<string, unknown>
  const name = component === "hero" ? "GlyphHero" : "GlyphCanvas"

  const props: string[] = []
  const push = (key: string, value: unknown, presetKey = key) => {
    if (value === undefined) return
    if (preset[presetKey] === value) return
    props.push(`${key}={${literal(value, 3)}}`)
  }

  props.push(`model={${literal(state.model, 3)}}`)
  props.push(`preset="${state.preset}"`)

  push("cellSize", state.cellSize)
  if (state.useTint) push("tint", state.tint)
  else props.push(`tint={undefined}`)
  if (state.characterSet === "procedural") {
    props.push(`characterSet={null}`)
    push("glyphStyle", state.glyphStyle)
  } else {
    push("characterSet", state.characterSet)
  }
  push("invert", state.invert)
  push("color", state.color)
  push("volumeShading", state.volumeShading)
  if (state.transparent) {
    props.push(`transparent`)
  } else if (state.backgroundColor !== (preset.backgroundColor ?? "#000000")) {
    props.push(`backgroundColor="${state.backgroundColor}"`)
  }
  if (state.cameraZ !== "auto") props.push(`cameraZ={${state.cameraZ}}`)

  const fx = postfxDiff(state)
  if (Object.keys(fx).length > 0) props.push(`postfx={${literal(fx, 3)}}`)

  const motionDiff: Record<string, unknown> = {}
  const motionDefaults: Record<string, unknown> = {
    autoRotate: 0.4,
    hoverBoost: 2,
    draggable: true,
    hoverZoom: 1.1,
  }
  for (const [key, value] of Object.entries(state.motion)) {
    if (value !== undefined && motionDefaults[key] !== value) motionDiff[key] = value
  }
  if (Object.keys(motionDiff).length > 0) props.push(`motion={${literal(motionDiff, 3)}}`)

  const materialDiff: Record<string, unknown> = {}
  if (state.material.color !== "#917AFF") materialDiff.color = state.material.color
  if (state.material.roughness !== 0.12) materialDiff.roughness = state.material.roughness
  if (state.material.metalness !== 0) materialDiff.metalness = state.material.metalness
  if (Object.keys(materialDiff).length > 0) props.push(`material={${literal(materialDiff, 3)}}`)

  const propBlock = props.map((p) => `      ${p}`).join("\n")

  if (component === "canvas") {
    return `"use client"

import { GlyphCanvas } from "${importFrom}"

export function AsciiHero() {
  return (
    <GlyphCanvas
${propBlock}
    />
  )
}
`
  }

  return `"use client"

import { GlyphHero } from "${importFrom}"

export function AsciiHero() {
  return (
    <GlyphHero
${propBlock}
    >
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 4.5rem)", margin: 0 }}>
        Your headline goes here
      </h1>
      <p style={{ marginTop: 16, opacity: 0.6 }}>Drag to rotate. Hover to speed it up.</p>
    </GlyphHero>
  )
}
`
}

// -- Share links -------------------------------------------------------------

function toBase64Url(input: string): string {
  const base64 = typeof window === "undefined" ? Buffer.from(input).toString("base64") : btoa(input)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  return typeof window === "undefined"
    ? Buffer.from(base64, "base64").toString("utf8")
    : atob(base64)
}

export function encodeState(state: StudioState): string {
  return toBase64Url(JSON.stringify(state))
}

export function decodeState(encoded: string): StudioState | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded))
    if (!parsed || typeof parsed !== "object" || !parsed.model) return null
    // Merge over defaults so a link from an older build still opens.
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return null
  }
}

export function shareUrl(state: StudioState): string | null {
  if (isEphemeral(state.model)) return null
  if (typeof window === "undefined") return null
  return `${window.location.origin}${window.location.pathname}?c=${encodeState(state)}`
}
