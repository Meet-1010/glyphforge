/** Named glyph ramps, ordered sparse -> dense. */
export type GlyphRampName =
  | "terminal"
  | "classic"
  | "blocks"
  | "shades"
  | "dots"
  | "binary"
  | "katakana"
  | "runic"

/** Either a built-in ramp, your own characters (sparse -> dense), or `null` for the procedural fallback. */
export type CharacterSet = GlyphRampName | string[] | null

/** Procedural glyph style, used when `characterSet` is `null`. */
export type AsciiStyle = "standard" | "dense" | "minimal" | "blocks"

/** Built-in CRT colour ramps applied after the glyph is chosen. */
export type ColorPalette = "none" | "green" | "amber" | "cyan" | "blue"

export interface AsciiPostFX {
  /** Horizontal CRT scanlines. 0 disables. @default 0 */
  scanlineIntensity?: number
  /** Number of scanlines across the viewport. @default 200 */
  scanlineCount?: number
  /** Quantise the effect's clock to N fps for a choppy, low-fi feel. 0 = smooth. @default 0 */
  targetFPS?: number
  /** Per-row/column cell jitter. 0 disables. @default 0 */
  jitterIntensity?: number
  /** How fast the jitter reshuffles. @default 1 */
  jitterSpeed?: number
  /** Additive glow that follows the pointer. @default false */
  mouseGlowEnabled?: boolean
  /** Glow falloff radius in pixels. @default 200 */
  mouseGlowRadius?: number
  /** Glow strength. @default 1.5 */
  mouseGlowIntensity?: number
  /** Darken the edges. 0 disables. @default 0 */
  vignetteIntensity?: number
  /** Larger = softer vignette. @default 0.8 */
  vignetteRadius?: number
  /** Post-glyph colour ramp. @default "none" */
  colorPalette?: ColorPalette
  /** Barrel distortion, like a CRT tube. 0 disables. @default 0 */
  curvature?: number
  /** RGB split, in UV units. 0 disables. @default 0 */
  aberrationStrength?: number
  /** Animated film grain. 0 disables. @default 0 */
  noiseIntensity?: number
  /** Grain frequency. @default 1 */
  noiseScale?: number
  /** Grain animation speed. @default 1 */
  noiseSpeed?: number
  /** Sine warp of the whole frame. 0 disables. @default 0 */
  waveAmplitude?: number
  /** Warp frequency. @default 10 */
  waveFrequency?: number
  /** Warp speed. @default 1 */
  waveSpeed?: number
  /** Chance per row of a horizontal tear. 0 disables. @default 0 */
  glitchIntensity?: number
  /** Tears per second. @default 0 */
  glitchFrequency?: number
  /** Added to the scene before glyph selection. @default 0 */
  brightnessAdjust?: number
  /** Multiplied around mid-grey before glyph selection. @default 1 */
  contrastAdjust?: number
  /**
   * Ordered dithering, 0..1. Recovers smooth gradients that the glyph ramp's
   * handful of tiers would otherwise band. Worth turning up for photographs.
   * @default 0
   */
  dither?: number
}

export interface AsciiOptions {
  /** Character cell size in device pixels. Smaller = finer, more expensive. @default 9 */
  cellSize?: number
  /** Flip brightness -> density. Usually `true` for lit models on dark backgrounds. @default true */
  invert?: boolean
  /** Colour the glyphs (from the scene, or from `tint`). `false` renders luminance only. @default true */
  color?: boolean
  /** Procedural glyph style, used only when `characterSet` is `null`. @default "standard" */
  glyphStyle?: AsciiStyle
  /** Glyph ramp. @default "terminal" */
  characterSet?: CharacterSet
  /** Font used to rasterise the glyph atlas. @default "62px monospace" */
  glyphFont?: string
  /** Exaggerate the brightness range so shadows read dense and highlights sparse. @default true */
  volumeShading?: boolean
  /** Force one colour for every glyph. Overrides scene colour when `color` is true. */
  tint?: string
  /** Composite over the host page instead of an opaque background. @default false */
  transparent?: boolean
  /** Background colour in opaque mode. @default "#000000" */
  backgroundColor?: string
  /** Raw luminance below which a cell counts as background (opaque mode only). @default 0.06 */
  bgThreshold?: number
  postfx?: AsciiPostFX
}

// -- Model sources -----------------------------------------------------------

export type ShapeKind =
  | "torusKnot"
  | "blob"
  | "crystal"
  | "helix"
  | "sphere"
  | "torus"
  | "box"
  | "capsule"
  | "gear"

/** Load an existing `.glb` / `.gltf`. */
export interface UrlModelSource {
  type: "url"
  src: string
}

/** Extrude live browser text into 3D. Any font the page can render works, including emoji. */
export interface TextModelSource {
  type: "text"
  value: string
  /** Any CSS font shorthand, e.g. `"700 200px Georgia"`. @default "700 200px system-ui, sans-serif" */
  font?: string
  /** Extrusion depth in world units. @default 0.35 */
  depth?: number
  /** Bevel size. 0 disables bevelling. @default 0.02 */
  bevel?: number
  /** Contour sampling resolution. Higher = smoother edges, heavier mesh. @default 512 */
  resolution?: number
  /** Contour simplification tolerance in pixels. Higher = chunkier. @default 1.2 */
  smoothing?: number
}

/** Extrude SVG paths into 3D. Give either a URL or raw markup. */
export interface SvgModelSource {
  type: "svg"
  src?: string
  markup?: string
  /** @default 0.35 */
  depth?: number
  /** @default 0.02 */
  bevel?: number
}

/** Turn a raster image into geometry. */
export interface ImageModelSource {
  type: "image"
  src: string
  /**
   * `flat` maps the picture onto a plane — the most faithful "photo as ASCII".
   * `relief` also displaces the surface by luminance, adding depth.
   * `extrude` traces the alpha/luminance silhouette and extrudes it (flat logos, icons).
   * @default "relief"
   */
  mode?: "flat" | "relief" | "extrude"
  /** @default 0.4 */
  depth?: number
  /** Grid/trace resolution. @default 160 for relief, 512 for extrude */
  resolution?: number
  /** Luminance (or alpha) cutoff for `extrude`. @default 0.5 */
  threshold?: number
  /** Mirror the relief to make a solid, double-sided object. @default false */
  double?: boolean
  /**
   * Map the image onto the surface so the ASCII pass reads its real tones.
   * With this off, the picture only displaces vertices and the subject is
   * usually unrecognisable. Ignored by `extrude`.
   * @default true
   */
  tones?: boolean
  /**
   * Stretch the image's histogram to fill the full range before it is used.
   * Most photos occupy a slice of 0..1, which the glyph ramp then flattens
   * into a couple of tiers.
   * @default true
   */
  autoContrast?: boolean
  /**
   * How strongly the image's own tones dominate over scene lighting, 0..1.
   * @default 0.85
   */
  toneStrength?: number
}

/** Parametric primitive — no assets at all. */
export interface ShapeModelSource {
  type: "shape"
  shape: ShapeKind
  /** Surface detail. @default 128 */
  detail?: number
  /** Shape-specific distortion amount (blob lumpiness, crystal facet depth, …). @default 0.35 */
  distortion?: number
  /** Deterministic seed for the noise-driven shapes. @default 1 */
  seed?: number
}

export type ModelSource =
  | UrlModelSource
  | TextModelSource
  | SvgModelSource
  | ImageModelSource
  | ShapeModelSource

// -- Motion ------------------------------------------------------------------

export interface MotionOptions {
  /** Idle spin speed in radians/second. 0 freezes the model. @default 0.4 */
  autoRotate?: number
  /** Spin multiplier while the pointer is over the canvas. @default 2 */
  hoverBoost?: number
  /** Let the pointer drag-rotate the model. @default true */
  draggable?: boolean
  /** Camera dolly factor on hover. 1 disables. @default 1.1 */
  hoverZoom?: number
  /** Resting tilt, in radians: `[x, z]`. @default [0.3, -0.08] */
  tilt?: [number, number]
  /**
   * Play animation clips embedded in a `.glb`. `true` plays the first clip, a
   * string picks one by name, `false` leaves the model in its bind pose.
   * @default true
   */
  animation?: boolean | string
  /** Animation playback speed multiplier. @default 1 */
  animationSpeed?: number
  /**
   * Honour `prefers-reduced-motion`. When the user has asked for reduced motion,
   * auto-rotation, embedded animation and time-based post-fx stop; dragging
   * still works.
   * @default true
   */
  respectReducedMotion?: boolean
}
