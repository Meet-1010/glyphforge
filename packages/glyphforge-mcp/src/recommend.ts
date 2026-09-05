/**
 * Turning a description of somebody's site into a specific Glyphforge setup.
 *
 * The rules here are the opinionated part of this server. They encode what the
 * Studio's own site does and what the library's defaults were chosen for, so an
 * agent gets a considered answer rather than the first preset in the list.
 */

import { configFromPreset, generateCode, type GlyphConfig } from "glyphforge/codegen"

type ModelSource = GlyphConfig["model"]
type PresetName = GlyphConfig["preset"]

export const TONES = [
  "technical",
  "security",
  "data",
  "corporate",
  "editorial",
  "minimal",
  "brutalist",
  "playful",
  "luxury",
] as const
export type Tone = (typeof TONES)[number]

export const PLACEMENTS = [
  "full-hero",
  "split-hero",
  "section-band",
  "page-background",
  "card",
] as const
export type Placement = (typeof PLACEMENTS)[number]

export const PERFORMANCE = ["high", "balanced", "low"] as const
export type Performance = (typeof PERFORMANCE)[number]

export interface RecommendInput {
  site_description: string
  subject?: string
  tone?: Tone
  background?: string
  placement?: Placement
  brand_color?: string
  performance?: Performance
  model_url?: string
}

export interface Recommendation {
  tone: Tone
  toneInferred: boolean
  preset: PresetName
  placement: Placement
  component: "hero" | "canvas"
  model: ModelSource
  config: GlyphConfig
  code: string
  install: string
  rationale: string[]
  guidance: string[]
  warnings: string[]
  nextSteps: string[]
  containerHint: string
}

// -- Tone inference ----------------------------------------------------------

/** Ordered: the first tone with a keyword hit wins, so specific beats generic. */
const TONE_KEYWORDS: Array<[Tone, string[]]> = [
  ["security", ["security", "encryption", "privacy", "hacker", "pentest", "vulnerab*", "zero trust", "cyber", "crypto*", "wallet", "blockchain", "auth"]],
  ["data", ["data", "analytics", "observability", "metric", "telemetry", "warehouse", "etl", "graph", "monitor", "hardware", "robot", "iot", "sensor", "engineering"]],
  ["brutalist", ["agency", "brutalist", "studio", "creative shop", "design studio", "editorial design", "type foundry"]],
  ["playful", ["game", "gaming", "music", "festival", "event", "launch party", "community", "meme", "toy", "kids", "fun", "band", "album", "podcast"]],
  ["luxury", ["luxury", "premium", "fashion", "jewel*", "watch", "boutique", "atelier", "couture", "hotel", "resort"]],
  ["editorial", ["blog", "magazine", "essay", "writing", "journal", "publication", "newsletter", "portfolio", "photograph*", "author", "book"]],
  ["minimal", ["minimal", "calm", "wellness", "meditation", "health", "mindful*", "simple", "clean", "therapy", "yoga"]],
  ["technical", ["developer", "api", "sdk", "cli", "infrastructure", "devtool", "database", "compiler", "open source", "library", "framework", "terminal", "npm", "package", "code", "deploy", "server", "kubernetes", "docker", "ai", "llm", "agent"]],
  ["corporate", ["enterprise", "b2b", "saas", "platform", "consulting", "finance", "insurance", "legal", "hr", "crm", "erp", "logistics", "supply"]],
]

/**
 * Whole-word matching, with `*` marking a deliberate stem.
 *
 * Substring matching reads "database" as the `data` tone, which is how a CLI
 * for migrations ends up recommended a data-visualisation look.
 */
function mentions(haystack: string, keyword: string): boolean {
  const stem = keyword.endsWith("*")
  const word = (stem ? keyword.slice(0, -1) : keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = stem ? `\\b${word}[a-z]*` : `\\b${word}(?:s|es)?\\b`
  return new RegExp(pattern, "i").test(haystack)
}

export function inferTone(description: string): { tone: Tone; inferred: boolean } {
  const haystack = description.toLowerCase()
  for (const [tone, keywords] of TONE_KEYWORDS) {
    if (keywords.some((keyword) => mentions(haystack, keyword))) return { tone, inferred: true }
  }
  return { tone: "technical", inferred: true }
}

// -- Ground ------------------------------------------------------------------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function normaliseHex(value: string): string | null {
  const match = value.trim().match(HEX)
  if (!match) return null
  const hex = match[1]
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex
  return `#${full.toUpperCase()}`
}

/** Perceived luminance, so "is this a light page" is answered rather than assumed. */
function luminance(hex: string): number {
  const value = hex.slice(1)
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

interface Ground {
  isLight: boolean
  color: string | null
  stated: boolean
}

function readGround(background: string | undefined): Ground {
  if (!background) return { isLight: false, color: null, stated: false }
  const trimmed = background.trim().toLowerCase()
  if (trimmed === "light" || trimmed === "white") return { isLight: true, color: null, stated: true }
  if (trimmed === "dark" || trimmed === "black") return { isLight: false, color: null, stated: true }
  const hex = normaliseHex(background)
  if (hex) return { isLight: luminance(hex) > 0.5, color: hex, stated: true }
  return { isLight: false, color: null, stated: false }
}

// -- Preset ------------------------------------------------------------------

const TONE_PRESET: Record<Tone, PresetName> = {
  technical: "terminal",
  security: "matrix",
  data: "blueprint",
  corporate: "blueprint",
  editorial: "chromatic",
  minimal: "chromatic",
  brutalist: "brutalist",
  playful: "glitch",
  luxury: "chromatic",
}

const PRESET_REASON: Record<PresetName, string> = {
  terminal: "clean violet glyphs with no effects — it reads as craft rather than costume, which is what a technical audience trusts",
  matrix: "green phosphor katakana with scanlines and curvature — the CRT-in-a-server-room register that security and infra work is already fluent in",
  blueprint: "cyan dots on near-black, flat-shaded — the most legible preset in the set, which matters when the audience is there to evaluate rather than admire",
  brutalist: "solid white block glyphs at cell size 12 — it reads as a low-res render, which is the register bold editorial and agency work lives in",
  glitch: "chromatic aberration, tearing and jitter at a 30fps lock — loud on purpose, which is right when the event is the point",
  chromatic: "the model's own scene colour survives instead of a flat tint, so the palette stays yours rather than the library's",
  paper: "black glyphs on warm white — the one preset built for a light page",
}

// -- Model -------------------------------------------------------------------

const TONE_SHAPE: Record<Tone, { shape: string; why: string }> = {
  technical: { shape: "torusKnot", why: "continuously interesting without being literal about anything" },
  security: { shape: "crystal", why: "faceted and sharp, which reads as hardened" },
  data: { shape: "crystal", why: "faceted geometry reads as structured rather than organic" },
  corporate: { shape: "helix", why: "structured motion, which reads as process without being a stock illustration" },
  editorial: { shape: "blob", why: "organic and soft, so it sits under type instead of competing with it" },
  minimal: { shape: "sphere", why: "the quietest object in the set" },
  brutalist: { shape: "box", why: "deliberately plain — the glyphs do the work, not the silhouette" },
  playful: { shape: "blob", why: "loose and organic, which carries motion well" },
  luxury: { shape: "torus", why: "simple geometry that reads as considered rather than busy" },
}

/** Words that suggest the hero wants a real object, not an abstract shape. */
const THING_WORDS = [
  "shoe", "car", "bike", "bicycle", "chair", "furniture", "camera", "watch", "bottle",
  "headphone", "guitar", "drone", "phone", "laptop", "helmet", "sneaker", "coffee",
  "animal", "bird", "dog", "cat", "horse", "fox", "dragon", "character", "robot",
  "human", "person", "figure", "statue", "plant", "tree", "flower", "food", "building",
]

function pickModel(input: RecommendInput, tone: Tone): { model: ModelSource; why: string; suggestSearch: string | null } {
  if (input.model_url) {
    return {
      model: { type: "url", src: input.model_url },
      why: "you already have a model, so it loads directly — embedded animation clips play on their own",
      suggestSearch: null,
    }
  }

  const subject = input.subject?.trim()
  if (subject) {
    const words = subject.split(/\s+/)
    const isShortPhrase = words.length <= 2 && subject.length <= 14
    if (isShortPhrase && !THING_WORDS.some((w) => subject.toLowerCase().includes(w))) {
      return {
        model: { type: "text", value: subject.toUpperCase(), depth: 0.35, bevel: 0.02 },
        why: `"${subject.toUpperCase()}" extruded into real geometry — a word says something the way an abstract shape can't, and any font the page can render works with no font files to ship`,
        suggestSearch: null,
      }
    }
    return {
      model: fallbackShape(tone),
      why: `"${subject}" reads as an object rather than a word, so a forged shape holds the slot while you find a real model`,
      suggestSearch: subject,
    }
  }

  const haystack = input.site_description.toLowerCase()
  const thing = THING_WORDS.find((word) => mentions(haystack, word))
  if (thing) {
    return {
      model: fallbackShape(tone),
      why: `the description mentions "${thing}", which wants a real model — this shape holds the slot until you have one`,
      suggestSearch: thing,
    }
  }

  const shape = TONE_SHAPE[tone]
  return {
    model: fallbackShape(tone),
    why: `${shape.shape} — ${shape.why}. No asset, no network, and it forges synchronously`,
    suggestSearch: null,
  }
}

function fallbackShape(tone: Tone): ModelSource {
  const { shape } = TONE_SHAPE[tone]
  return { type: "shape", shape: shape as never, detail: 128, distortion: 0.35, seed: 1 }
}

// -- Placement ---------------------------------------------------------------

interface PlacementPlan {
  component: "hero" | "canvas"
  container: string
  guidance: string[]
  cellSizeDelta: number
  autoRotate?: number
  transparent?: boolean
}

const PLACEMENT_PLANS: Record<Placement, PlacementPlan> = {
  "full-hero": {
    component: "hero",
    container: "`<GlyphHero layout=\"overlay\" height=\"100vh\">` — the section is the page's first screen, headline sitting on the canvas.",
    cellSizeDelta: 0,
    guidance: [
      "Offset the headline rather than centring it over a centred model — a centred headline over a centred model is the shape every generated landing page takes, and the type ends up fighting the busiest part of the frame. The Glyphforge site pushes the canvas right and drops the headline bottom-left.",
      "Leave the wheel alone: do not set `controls.zoom` in a hero. Capturing the scroll stops the page moving and visitors read that as broken.",
      "Put the real headline in `children` as DOM. Text baked into the model is invisible to screen readers, search engines and translation.",
    ],
  },
  "split-hero": {
    component: "hero",
    container: "`<GlyphHero layout=\"split\" canvasSide=\"right\">` — copy on one side, canvas on the other. Reflows to stacked on narrow screens on its own.",
    cellSizeDelta: 0,
    guidance: [
      "The safest hero placement when the page has to convert: the copy gets clean ground, the canvas gets its own half, and neither fights the other.",
      "`canvasSide=\"left\"` if the eye should land on the image first — worth testing both, the copy usually wins on a page with a real offer.",
      "The split default height is `min(90vh, 720px)` rather than a full viewport, which keeps the next section visible enough to scroll to.",
    ],
  },
  "section-band": {
    component: "canvas",
    container: "`<GlyphCanvas style={{ height: 420 }} />` inside a section that already has its own heading and copy.",
    cellSizeDelta: 1,
    guidance: [
      "The lowest-risk placement there is: the page keeps the hero it already converts with, and the ASCII surface becomes a moment partway down rather than a gate in front of everything.",
      "Give the band an explicit height — the canvas fills its container, so a parent with no height renders nothing at all.",
      "A band this size reads better with a slightly larger cell than a full hero would use.",
    ],
  },
  "page-background": {
    component: "canvas",
    container: "`<GlyphCanvas transparent />` in a `position: fixed; inset: 0; z-index: -1; pointer-events: none` wrapper, with the page content above it.",
    cellSizeDelta: 2,
    autoRotate: 0.15,
    transparent: true,
    guidance: [
      "Turn the contrast down hard. Anything legible enough to enjoy on its own is too loud to read body copy over.",
      "Slow the rotation to about 0.15 rad/s — motion behind text is far more distracting than motion beside it.",
      "`pointer-events: none` on the wrapper, or the background steals every click on the page.",
      "Check contrast on the text sitting over it. This is the placement most likely to fail WCAG AA by accident.",
    ],
  },
  card: {
    component: "canvas",
    container: "`<GlyphCanvas style={{ height: 240 }} />` inside the card, with the card's own padding around it.",
    cellSizeDelta: 3,
    guidance: [
      "Small canvases need bigger cells — at 240px tall a cell size of 9 is a wall of noise, 12 reads as an image.",
      "If several cards each carry a canvas, they each carry a WebGL context. Render one and use stills for the rest, or lazy-mount on scroll.",
      "`pauseOffscreen` is on by default, which is doing a lot of work in a grid.",
    ],
  },
}

// -- Assembly ----------------------------------------------------------------

export function recommend(input: RecommendInput): Recommendation {
  const stated = input.tone
  const { tone } = stated ? { tone: stated } : inferTone(input.site_description)
  const ground = readGround(input.background)
  const placement = input.placement ?? "split-hero"
  const plan = PLACEMENT_PLANS[placement]
  const performance = input.performance ?? "balanced"

  const rationale: string[] = []
  const warnings: string[] = []
  const nextSteps: string[] = []

  // Preset — a light ground overrides tone, because it has to.
  let preset = TONE_PRESET[tone]
  if (ground.isLight) {
    if (preset !== "paper") {
      warnings.push(
        `The tone alone would suggest \`${preset}\`, but that preset paints a dark ground and would render as a black box on a light page. Switched to \`paper\`.`,
      )
    }
    preset = "paper"
  }
  rationale.push(`**Preset \`${preset}\`** — ${PRESET_REASON[preset]}.`)

  // Model.
  const picked = pickModel(input, tone)
  rationale.push(`**Model** — ${picked.why}.`)
  if (picked.suggestSearch) {
    nextSteps.push(
      `Call \`glyphforge_search_models\` with \`query: "${picked.suggestSearch}"\` to find a real model, then swap in \`model={{ type: "url", src: "…" }}\`. Add \`animated_only: true\` — a moving rig reads far better in ASCII than a static prop, because the glyph field reorganises every frame.`,
    )
  }

  // Cell size: placement sets the floor, performance moves it.
  const perfDelta = performance === "low" ? 3 : performance === "high" ? -1 : 0
  const baseCell = preset === "brutalist" ? 12 : preset === "blueprint" || preset === "paper" ? 8 : 9
  const cellSize = Math.max(6, Math.min(20, baseCell + plan.cellSizeDelta + perfDelta))
  if (plan.cellSizeDelta > 0 || perfDelta !== 0) {
    rationale.push(
      `**Cell size ${cellSize}** — the pass runs per character cell, so cost scales with viewport area over cell size squared. ${
        plan.cellSizeDelta > 0 ? `A ${placement.replace("-", " ")} wants a larger cell to stay readable at that size. ` : ""
      }${
        performance === "low"
          ? "Raised further for the mobile-heavy budget you gave — this is the cheapest lever by a wide margin."
          : performance === "high"
            ? "Tightened one step for the high budget."
            : ""
      }`.trim(),
    )
  }

  const config: GlyphConfig = {
    ...configFromPreset(preset, picked.model),
    cellSize,
    transparent: plan.transparent ?? false,
  }

  // Tint: the brand colour, when the preset is one that carries a tint at all.
  const brand = input.brand_color ? normaliseHex(input.brand_color) : null
  if (input.brand_color && !brand) {
    warnings.push(`\`brand_color\` "${input.brand_color}" is not a hex colour, so it was ignored. Pass something like \`#5AC8FA\`.`)
  }
  if (brand && preset !== "chromatic") {
    config.tint = brand
    config.useTint = true
    rationale.push(
      `**Tint \`${brand}\`** — your brand colour, applied flat to every glyph so the section belongs to the site rather than to the library.`,
    )
  } else if (brand) {
    // `chromatic` carries no tint on purpose, so the brand colour goes on the
    // material and reaches the glyphs through the scene instead.
    config.material = { ...config.material, color: brand }
    rationale.push(
      `**Material colour \`${brand}\`** — \`chromatic\` deliberately carries no tint so the model's own colour survives, so the brand colour goes on the material instead.`,
    )
  }

  if (ground.color) {
    config.backgroundColor = ground.color
    rationale.push(`**Background \`${ground.color}\`** — matched to the page so the section doesn't announce its own edges.`)
  }

  if (plan.autoRotate !== undefined) {
    config.motion = { ...config.motion, autoRotate: plan.autoRotate }
  }
  if (performance === "low") {
    config.postfx = { ...config.postfx, targetFPS: 30 }
    if (config.model.type === "shape") config.model = { ...config.model, detail: 64 }
    rationale.push(
      "**A 30fps effect clock and shape detail at 64** — both halve work for the mobile-heavy budget, and after the ASCII pass neither is visible.",
    )
  }
  if (plan.transparent) {
    config.postfx = { ...config.postfx, contrastAdjust: 1.3, vignetteIntensity: 0.4 }
  }

  const code = generateCode(config, { component: plan.component })

  const guidance = [...plan.guidance]
  if (ground.isLight) {
    guidance.push(
      "On a light page, check the glyph colour against the ground for anything that has to be read. `paper` is built for this, but a brand tint dropped on top of it can still fail contrast.",
    )
  }
  guidance.push(
    "One ASCII surface per page. Two competing glyph fields halve the impact of both and double the frame cost.",
  )

  if (config.model.type === "text") {
    nextSteps.push(
      "If the word is set in a webfont, make sure it has loaded before the forge runs — an unloaded webfont silently falls back and the geometry comes out in the wrong face. Heavier weights also survive ASCII resolution far better than thin ones.",
    )
  }
  nextSteps.push(
    "Call `glyphforge_inspect_project` with the project path to check the peer dependencies, confirm the router style, and get the exact file to paste this into.",
  )

  return {
    tone,
    toneInferred: !stated,
    preset,
    placement,
    component: plan.component,
    model: config.model,
    config,
    code,
    install:
      "npm i glyphforge three @react-three/fiber @react-three/postprocessing postprocessing",
    rationale,
    guidance,
    warnings,
    nextSteps,
    containerHint: plan.container,
  }
}
