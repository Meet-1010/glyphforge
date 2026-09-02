import type { AsciiOptions } from "./types"

/** Ready-made looks. Every field is still overridable via props. */
export const PRESETS = {
  /** The default: violet terminal glyphs, punchy contrast. */
  terminal: {
    characterSet: "terminal",
    cellSize: 9,
    invert: true,
    color: true,
    volumeShading: true,
    tint: "#917AFF",
    postfx: { contrastAdjust: 1.8, brightnessAdjust: 0 },
  },
  /** Green phosphor, scanlines, curvature — a CRT in a server room. */
  matrix: {
    characterSet: "katakana",
    cellSize: 10,
    invert: true,
    color: true,
    volumeShading: true,
    tint: "#3BFF7A",
    postfx: {
      contrastAdjust: 1.9,
      scanlineIntensity: 0.28,
      scanlineCount: 240,
      curvature: 0.06,
      vignetteIntensity: 0.5,
      noiseIntensity: 0.05,
      noiseScale: 220,
      noiseSpeed: 6,
    },
  },
  /** Cyan on near-black, wireframe-adjacent, very legible. */
  blueprint: {
    characterSet: "dots",
    cellSize: 8,
    invert: true,
    color: true,
    volumeShading: false,
    tint: "#5AC8FA",
    backgroundColor: "#05080F",
    postfx: { contrastAdjust: 1.5, vignetteIntensity: 0.35 },
  },
  /** Solid block shading — reads almost like a low-res render. */
  brutalist: {
    characterSet: "blocks",
    cellSize: 12,
    invert: true,
    color: true,
    volumeShading: true,
    tint: "#FFFFFF",
    postfx: { contrastAdjust: 2.1 },
  },
  /** Broken signal: chromatic aberration, tearing, jitter. */
  glitch: {
    characterSet: "terminal",
    cellSize: 9,
    invert: true,
    color: true,
    volumeShading: true,
    tint: "#FF4D6D",
    postfx: {
      contrastAdjust: 1.9,
      aberrationStrength: 0.0035,
      glitchIntensity: 0.06,
      glitchFrequency: 9,
      jitterIntensity: 0.35,
      jitterSpeed: 14,
      scanlineIntensity: 0.18,
      targetFPS: 30,
    },
  },
  /** Keeps the model's own scene colour instead of a flat tint. */
  chromatic: {
    characterSet: "shades",
    cellSize: 9,
    invert: true,
    color: true,
    volumeShading: true,
    postfx: { contrastAdjust: 1.6, vignetteIntensity: 0.3 },
  },
  /** Black glyphs on white — for light pages. */
  paper: {
    characterSet: "classic",
    cellSize: 8,
    invert: true,
    color: true,
    volumeShading: true,
    tint: "#111111",
    backgroundColor: "#F5F3EE",
    postfx: { contrastAdjust: 1.6 },
  },
} as const satisfies Record<string, AsciiOptions>

export type PresetName = keyof typeof PRESETS

export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[]

/** Shallow-merge a preset with user overrides. `postfx` merges one level deep. */
export function resolvePreset(
  preset: PresetName | undefined,
  overrides: AsciiOptions = {},
): AsciiOptions {
  const base = (preset ? PRESETS[preset] : PRESETS.terminal) as AsciiOptions
  return {
    ...base,
    ...overrides,
    postfx: { ...(base.postfx ?? {}), ...(overrides.postfx ?? {}) },
  }
}
