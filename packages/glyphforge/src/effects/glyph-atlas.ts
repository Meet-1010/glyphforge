import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, type Texture } from "three"
import type { CharacterSet, GlyphRampName } from "../types"

/**
 * Built-in glyph ramps, ordered sparse -> dense.
 *
 * The shader picks a tile by brightness, so ink coverage must increase
 * monotonically along each array or the gradient reads as noise.
 *
 * The `terminal` ramp is from webgl-ascii-hero (MIT, (c) 2025 egorshest).
 */
export const GLYPH_RAMPS: Record<GlyphRampName, string[]> = {
  terminal: [".", ":", "-", "=", "+", "*", "#", "%", "@", "0", "O", "N", "M", "W", "B", "X"],
  classic: [".", ",", ":", ";", "i", "l", "t", "f", "L", "C", "G", "0", "8", "@"],
  blocks: ["░", "▒", "▓", "█"],
  shades: ["·", "∴", "▫", "▪", "▨", "▩", "█"],
  dots: ["·", "∙", "•", "◦", "●", "⬤"],
  binary: ["·", "1", "0", "▪", "█"],
  // Half-width katakana — falls back to tofu if the host has no CJK font.
  katakana: ["ｦ", "ｱ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｹ", "ｺ", "ｻ", "ｼ", "ﾂ", "ﾃ", "ﾅ", "ﾆ", "ﾇ"],
  runic: ["ᛁ", "ᛌ", "ᛚ", "ᚨ", "ᚱ", "ᛒ", "ᛞ", "ᛟ", "ᛘ", "ᛖ"],
}

export function resolveCharacters(characterSet: CharacterSet): string[] | null {
  if (characterSet == null) return null
  if (Array.isArray(characterSet)) return characterSet.length > 0 ? characterSet : null
  return GLYPH_RAMPS[characterSet] ?? GLYPH_RAMPS.terminal
}

interface AtlasEntry {
  texture: CanvasTexture
  refs: number
}

/**
 * Atlases are pure functions of (characters, font, tile size), and rasterising
 * one costs a canvas + a texture upload. Multiple `<GlyphHero />` instances on
 * the same page share the default ramp, so they are cached and refcounted
 * rather than rebuilt and leaked per instance.
 */
const atlasCache = new Map<string, AtlasEntry>()

export interface GlyphAtlas {
  texture: Texture
  tiles: number
  /** Drop this instance's claim on the shared texture. */
  release: () => void
}

/**
 * Rasterise `characters` into a 1 x N strip texture, white on black.
 * Returns `null` during SSR or if a 2D context is unavailable.
 */
export function acquireGlyphAtlas(
  characterSet: CharacterSet,
  font = "62px monospace",
  tileSize = 64,
): GlyphAtlas | null {
  const characters = resolveCharacters(characterSet)
  if (!characters) return null
  if (typeof document === "undefined") return null

  const key = `${tileSize}|${font}|${characters.join("")}`
  const cached = atlasCache.get(key)
  if (cached) {
    cached.refs++
    return { texture: cached.texture, tiles: characters.length, release: () => releaseAtlas(key) }
  }

  const count = characters.length
  const canvas = document.createElement("canvas")
  canvas.width = tileSize * count
  canvas.height = tileSize
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#fff"
  ctx.font = font
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const cx = tileSize / 2
  const cy = tileSize / 2
  const fit = tileSize * 0.92

  for (let i = 0; i < count; i++) {
    const char = characters[i]
    ctx.save()
    ctx.translate(i * tileSize + cx, cy)
    // Block and CJK glyphs are wider than the Latin ones the font size was
    // picked for; squeeze anything that would bleed into the next tile.
    const w = ctx.measureText(char).width
    if (w > fit) ctx.scale(fit / w, 1)
    ctx.fillText(char, 0, 0)
    ctx.restore()
  }

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping

  atlasCache.set(key, { texture, refs: 1 })
  return { texture, tiles: count, release: () => releaseAtlas(key) }
}

function releaseAtlas(key: string) {
  const entry = atlasCache.get(key)
  if (!entry) return
  entry.refs--
  if (entry.refs <= 0) {
    entry.texture.dispose()
    atlasCache.delete(key)
  }
}
