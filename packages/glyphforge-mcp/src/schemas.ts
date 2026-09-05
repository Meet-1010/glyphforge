/**
 * Zod schemas shared by the tools that accept a look as input.
 *
 * Mirrors the library's own `ModelSource` union and `AsciiOptions`, so a
 * malformed config is rejected here with a readable message rather than
 * reaching React and rendering nothing.
 */

import { z } from "zod"

export const SHAPE_KINDS = [
  "torusKnot",
  "blob",
  "crystal",
  "helix",
  "sphere",
  "torus",
  "box",
  "capsule",
  "gear",
] as const

export const GLYPH_RAMPS = [
  "terminal",
  "classic",
  "blocks",
  "shades",
  "dots",
  "binary",
  "katakana",
  "runic",
] as const

export const PRESET_NAMES = [
  "terminal",
  "matrix",
  "blueprint",
  "brutalist",
  "glitch",
  "chromatic",
  "paper",
] as const

const HEX_COLOR = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour like #917AFF")

export const ModelSourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("text"),
      value: z.string().min(1).max(64).describe('The word to extrude, e.g. "SHIP IT"'),
      font: z.string().optional().describe('CSS font shorthand, e.g. "700 200px Georgia"'),
      depth: z.number().min(0).max(5).optional().describe("Extrusion depth in world units (default 0.35)"),
      bevel: z.number().min(0).max(1).optional().describe("Bevel size; 0 disables (default 0.02)"),
      resolution: z.number().int().min(64).max(2048).optional().describe("Contour sampling (default 512)"),
      smoothing: z.number().min(0).max(10).optional().describe("Simplification tolerance in px (default 1.2)"),
    })
    .strict(),
  z
    .object({
      type: z.literal("shape"),
      shape: z.enum(SHAPE_KINDS).describe("Which parametric primitive"),
      detail: z.number().int().min(8).max(512).optional().describe("Surface detail (default 128)"),
      distortion: z.number().min(0).max(3).optional().describe("Shape-specific distortion (default 0.35)"),
      seed: z.number().optional().describe("Deterministic seed for noise-driven shapes (default 1)"),
    })
    .strict(),
  z
    .object({
      type: z.literal("image"),
      src: z.string().min(1).describe("Image URL or path served by the host app"),
      mode: z.enum(["flat", "relief", "extrude"]).optional().describe("How the picture becomes geometry (default 'relief')"),
      depth: z.number().min(0).max(5).optional(),
      resolution: z.number().int().min(32).max(2048).optional(),
      threshold: z.number().min(0).max(1).optional().describe("Silhouette cutoff for 'extrude' (default 0.5)"),
      double: z.boolean().optional().describe("Mirror the relief into a solid object"),
      tones: z.boolean().optional().describe("Map the image onto the surface (default true — off makes most photos unrecognisable)"),
      autoContrast: z.boolean().optional(),
      toneStrength: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("svg"),
      src: z.string().optional().describe("URL of the SVG"),
      markup: z.string().optional().describe("Raw SVG markup, as an alternative to src"),
      depth: z.number().min(0).max(5).optional(),
      bevel: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("url"),
      src: z.string().min(1).describe("URL of a .glb or .gltf file"),
    })
    .strict(),
]).superRefine((value, ctx) => {
  // Cross-field checks have to sit on the union: a discriminated union member
  // must stay a plain object, and `.refine()` would wrap it in an effect.
  if (value.type === "svg" && !value.src && !value.markup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An svg model needs either `src` (a URL) or `markup` (raw SVG)",
    })
  }
})

export const PostFXSchema = z
  .object({
    contrastAdjust: z.number().min(0).max(5).optional(),
    brightnessAdjust: z.number().min(-1).max(1).optional(),
    dither: z.number().min(0).max(1).optional(),
    scanlineIntensity: z.number().min(0).max(1).optional(),
    scanlineCount: z.number().min(1).max(2000).optional(),
    vignetteIntensity: z.number().min(0).max(1).optional(),
    vignetteRadius: z.number().min(0).max(2).optional(),
    curvature: z.number().min(0).max(1).optional(),
    aberrationStrength: z.number().min(0).max(0.1).optional(),
    noiseIntensity: z.number().min(0).max(1).optional(),
    noiseScale: z.number().min(0).max(1000).optional(),
    noiseSpeed: z.number().min(0).max(60).optional(),
    jitterIntensity: z.number().min(0).max(2).optional(),
    jitterSpeed: z.number().min(0).max(60).optional(),
    glitchIntensity: z.number().min(0).max(1).optional(),
    glitchFrequency: z.number().min(0).max(60).optional(),
    waveAmplitude: z.number().min(0).max(1).optional(),
    waveFrequency: z.number().min(0).max(100).optional(),
    waveSpeed: z.number().min(0).max(60).optional(),
    targetFPS: z.number().min(0).max(120).optional(),
    mouseGlowEnabled: z.boolean().optional(),
    mouseGlowRadius: z.number().min(0).max(2000).optional(),
    mouseGlowIntensity: z.number().min(0).max(10).optional(),
    colorPalette: z.enum(["none", "green", "amber", "cyan", "blue"]).optional(),
  })
  .strict()

export const MotionSchema = z
  .object({
    autoRotate: z.number().min(0).max(10).optional().describe("Idle spin in rad/s; 0 freezes (default 0.4)"),
    hoverBoost: z.number().min(0).max(10).optional(),
    draggable: z.boolean().optional(),
    hoverZoom: z.number().min(0.5).max(3).optional(),
    animation: z.union([z.boolean(), z.string()]).optional().describe("Play .glb clips: true, false, or a clip name"),
    animationSpeed: z.number().min(0).max(10).optional(),
    respectReducedMotion: z.boolean().optional(),
  })
  .strict()

export { HEX_COLOR }
