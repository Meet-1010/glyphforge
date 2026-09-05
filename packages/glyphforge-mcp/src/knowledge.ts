/**
 * What an agent needs to know about Glyphforge, split into topics.
 *
 * Kept as one topic per request rather than a single dump: an agent that only
 * needs the image forge shouldn't spend context on the CLI.
 */

export interface Topic {
  title: string
  summary: string
  body: string
}

export const TOPICS = {
  overview: {
    title: "What Glyphforge is",
    summary: "The problem it solves, and the shape of the API.",
    body: `Glyphforge renders a 3D model as a live WebGL ASCII scene, as one React
component you install from npm.

**The problem it exists to solve.** Every other WebGL ASCII hero is a repo you
fork that says *"now replace user-model.glb with your own"*. Most people don't
have a .glb, and getting one means Blender, a marketplace, or a licence they
didn't read. Glyphforge removes that step twice over:

1. It is a **package, not a boilerplate** — one component, installed like anything else.
2. It **forges the model in the browser** — from text, an image, an SVG, or a
   parametric shape. Real geometry, exportable as a standard .glb.

**The whole integration:**

\`\`\`tsx
import { GlyphHero } from "glyphforge"

<GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix" />
\`\`\`

**Two components.** \`<GlyphHero>\` is a complete section — canvas plus your
headline, in overlay or split layout. \`<GlyphCanvas>\` is the bare WebGL
surface that fills its container, for when you already have a layout.

**No network at runtime.** No CDN fetch, no API key, no backend. The model is
either forged in the browser or a file you point at.

**Everything is client-side.** Both components carry \`"use client"\`. In a Next
App Router project they must be imported into a client component or a page that
is itself a client component.`,
  },

  install: {
    title: "Installing",
    summary: "npm install, peer dependencies, and the CLI scaffold.",
    body: `\`\`\`bash
npm i glyphforge three @react-three/fiber @react-three/postprocessing postprocessing
\`\`\`

**Peer dependencies** — Glyphforge does not bundle these, so the host app must
have them:

| Package | Range |
| --- | --- |
| \`react\` | >=18 |
| \`three\` | >=0.155 |
| \`@react-three/fiber\` | >=8 |
| \`@react-three/postprocessing\` | >=2 |
| \`postprocessing\` | >=6.30 |

With React 19, use \`@react-three/fiber@^9\` and \`@react-three/postprocessing@^3\`.
With React 18, use fiber 8 and postprocessing 2.

**Or scaffold it:**

\`\`\`bash
npx glyphforge init
\`\`\`

Installs the dependencies and writes a hero component into the project.

**Subpath entries.** \`glyphforge/forge\` exposes the geometry builders with no
React or renderer attached — useful for build-time model generation.`,
  },

  api: {
    title: "Component API",
    summary: "Every prop on GlyphHero and GlyphCanvas, with defaults.",
    body: `**\`<GlyphCanvas />\`** — the WebGL surface, fills its container.

| Prop | Default | What it does |
| --- | --- | --- |
| \`model\` | forged torus knot | A \`ModelSource\` — see the \`model-sources\` topic |
| \`preset\` | \`"terminal"\` | Starting look; every other prop overrides it |
| \`cellSize\` | \`9\` | Character cell in device px. Smaller = finer and more expensive |
| \`invert\` | \`true\` | Flip brightness→density. \`true\` for lit models on dark grounds |
| \`color\` | \`true\` | Colour glyphs from the scene or \`tint\`; \`false\` is luminance only |
| \`tint\` | preset | One flat colour for every glyph. Omit to keep scene colour |
| \`characterSet\` | \`"terminal"\` | A named ramp, your own \`string[]\`, or \`null\` for procedural |
| \`glyphStyle\` | \`"standard"\` | Procedural style when \`characterSet\` is \`null\` |
| \`glyphFont\` | \`"62px monospace"\` | Font used to rasterise the glyph atlas |
| \`volumeShading\` | \`true\` | Exaggerate the brightness range so shadows read dense |
| \`transparent\` | \`false\` | Composite over the page instead of an opaque ground |
| \`backgroundColor\` | \`"#000000"\` | Ground colour in opaque mode |
| \`bgThreshold\` | \`0.06\` | Luminance below which a cell counts as background |
| \`postfx\` | preset | Scanlines, curvature, vignette, glitch, grain, aberration, dither |
| \`motion\` | see \`motion\` topic | Rotation, hover, drag, embedded clips, reduced motion |
| \`controls\` | zoom/pan off | Viewport navigation — see the \`motion\` topic |
| \`material\` | — | \`{ color, roughness, metalness, keepMaterials, scale }\` |
| \`cameraZ\` | \`"auto"\` | Camera distance; auto frames the model in the viewport |
| \`maxDpr\` | \`1.5\` | Device pixel ratio ceiling. Lower for speed |
| \`pauseOffscreen\` | \`true\` | Stop rendering when scrolled out of view |
| \`fallback\` | — | Shown while the model is forged or loaded |
| \`errorFallback\` | quiet message | Shown if WebGL is unavailable or the model fails |
| \`onReady\` / \`onError\` | — | Lifecycle callbacks |
| \`className\` / \`style\` | — | Applied to the canvas element |

**\`<GlyphHero />\`** — everything above, plus a section wrapper:

| Prop | Default | What it does |
| --- | --- | --- |
| \`layout\` | \`"overlay"\` | \`"overlay"\` centres content on the canvas; \`"split"\` puts them side by side |
| \`canvasSide\` | \`"right"\` | Which side the canvas takes in \`split\` |
| \`height\` | \`100vh\` / \`min(90vh, 720px)\` | Section height (the second is the \`split\` default) |
| \`children\` | — | Your headline, copy and CTAs |
| \`className\` | — | Class on the outer \`<section>\` |
| \`canvasClassName\` / \`canvasStyle\` | — | Applied to the canvas rather than the section |

In overlay layout the gutter around your content stays click-through, so
drag-to-rotate works across most of the hero while buttons still take clicks.`,
  },

  presets: {
    title: "Presets",
    summary: "The seven built-in looks and when each one fits.",
    body: `A preset is a starting point. Every individual prop still overrides it, and
\`postfx\` merges one level deep rather than replacing wholesale.

| Preset | Look | Reach for it when |
| --- | --- | --- |
| \`terminal\` | Violet glyphs, punchy contrast, no effects | The default. Developer tools, SaaS, anything that should read as clean rather than styled |
| \`matrix\` | Green phosphor katakana, scanlines, curvature, grain | Security, infra, hacker-adjacent, anything wanting a CRT in a server room |
| \`blueprint\` | Cyan dots on near-black, flat shading, vignette | Technical and diagrammatic — data, engineering, hardware. The most legible of the set |
| \`brutalist\` | White block glyphs, cell size 12 | Bold editorial and agency sites. Reads almost like a low-res render |
| \`glitch\` | Red, chromatic aberration, tearing, jitter, 30fps lock | Music, gaming, events, launches. Loud on purpose |
| \`chromatic\` | Keeps the model's own scene colour, shade ramp | You want the model's material colour to survive, not a flat tint |
| \`paper\` | Black glyphs on warm white (\`#F5F3EE\`) | **Light pages.** The only preset built for a light background |

Every preset except \`chromatic\` sets a \`tint\`; \`chromatic\` deliberately does
not, so the scene's own colour comes through.

On a light page use \`paper\`, or set \`backgroundColor\` and a dark \`tint\`
yourself — a dark-ground preset dropped onto white renders as a black box.`,
  },

  ramps: {
    title: "Glyph ramps",
    summary: "The eight character ramps, plus custom and procedural.",
    body: `\`characterSet\` takes a named ramp, your own array, or \`null\`.

| Ramp | Character | Best for |
| --- | --- | --- |
| \`terminal\` | Classic ASCII punctuation | The default. Legible at most cell sizes |
| \`classic\` | The traditional \`@%#*+=-:.\` ramp | Familiar, slightly softer than terminal |
| \`blocks\` | Unicode block elements | Solid, poster-like. Reads as pixels more than text |
| \`shades\` | Shade characters (░▒▓) | Smooth gradients, the gentlest ramp |
| \`dots\` | Braille-style dots | Fine and technical. Pairs with \`blueprint\` |
| \`binary\` | \`0\` and \`1\` | Literal. Two tiers only, so use with \`dither\` |
| \`katakana\` | Half-width katakana | The Matrix look. Dense and busy |
| \`runic\` | Runic characters | Angular and unusual; good for games and fantasy |

**Custom:** pass an array ordered sparse → dense, e.g.
\`characterSet={[" ", ".", "o", "O", "@"]}\`.

**Procedural:** \`characterSet={null}\` plus \`glyphStyle\` of \`"standard"\`,
\`"dense"\`, \`"minimal"\` or \`"blocks"\` draws glyphs mathematically instead of
from a font atlas.

Ramps with few tiers (\`binary\`, \`minimal\`) band badly on smooth gradients —
raise \`postfx.dither\` to recover them.`,
  },

  "model-sources": {
    title: "Model sources",
    summary: "The five things `model` accepts.",
    body: `\`model\` takes one of five shapes. Four are forged in the browser; only \`url\`
loads a file.

\`\`\`tsx
// 1. Text — any font the page can render, including webfonts and emoji
model={{ type: "text", value: "SHIP IT", font: "700 200px Georgia", depth: 0.35 }}

// 2. Parametric shape — no assets at all
model={{ type: "shape", shape: "torusKnot", detail: 128, distortion: 0.35, seed: 1 }}

// 3. Image — a PNG/JPG as geometry
model={{ type: "image", src: "/logo.png", mode: "relief" }}

// 4. SVG — filled paths extruded, counters become real holes
model={{ type: "svg", markup: "<svg …>", depth: 0.3 }}

// 5. URL — an existing .glb / .gltf, animation included
model={{ type: "url", src: "https://example.com/model.glb" }}
\`\`\`

Omit \`model\` entirely and you get a forged torus knot — a real hero with zero
assets and zero decisions.

**Choosing:** a brandable word is almost always the strongest default, because
it says something. Shapes are the safest when the site has no single word worth
enlarging. Reach for \`url\` only when the subject is genuinely a *thing* — a
product, a character, an animal.`,
  },

  "text-forge": {
    title: "The text forge",
    summary: "How text becomes geometry, and which knobs matter.",
    body: `\`\`\`tsx
model={{
  type: "text",
  value: "GLYPHFORGE",
  font: "700 200px system-ui, sans-serif",  // any CSS font shorthand
  depth: 0.35,        // extrusion depth in world units
  bevel: 0.02,        // 0 disables bevelling
  resolution: 512,    // contour sampling; higher = smoother, heavier
  smoothing: 1.2,     // simplification tolerance in px; higher = chunkier
}}
\`\`\`

**How it works.** Browsers don't expose glyph outlines, so there is no direct
path from a webfont to a mesh. Glyphforge rasterises the string to a canvas,
traces it with marching squares, links the segments into closed loops,
simplifies them, and resolves nesting so counters — the holes in \`O\`, \`B\`,
\`%\` — become real holes rather than solid blobs. Then it extrudes.

The payoff: **any font the page can render works**, webfonts and emoji
included, with no font files to ship and no \`.typeface.json\` conversion step.

**Practical notes.**
- Short words read best. Beyond ~10 characters the glyphs get small; \`cameraZ: "auto"\` compensates but legibility still drops.
- A webfont must be loaded before the forge runs, or the browser silently falls back.
- Heavier weights hold up far better than thin ones — hairlines vanish at ASCII resolution.
- Raise \`smoothing\` for a deliberately chunky look; lower it for crisp curves.`,
  },

  "image-forge": {
    title: "The image forge",
    summary: "Three modes for turning a picture into geometry.",
    body: `\`\`\`tsx
model={{
  type: "image",
  src: "/logo.png",
  mode: "relief",       // "flat" | "relief" | "extrude"
  depth: 0.4,
  resolution: 160,      // 160 for relief, 512 for extrude
  threshold: 0.5,       // luminance/alpha cutoff, extrude only
  double: false,        // mirror the relief into a solid object
  tones: true,          // map the picture onto the surface
  autoContrast: true,   // stretch the histogram before use
  toneStrength: 0.85,   // how much the image dominates scene lighting
}}
\`\`\`

| Mode | What it does | Use for |
| --- | --- | --- |
| \`flat\` | Maps the picture onto a plane | The most faithful "photo as ASCII" |
| \`relief\` | Also displaces the surface by luminance | Photos that should have depth. The default |
| \`extrude\` | Traces the alpha/luminance silhouette and extrudes | Flat logos, icons, marks |

**\`tones\` is the prop that decides whether the picture is recognisable.** With
it off, the image only displaces vertices and the subject usually reads as
noise. Leave it on unless you want an abstract surface.

**\`autoContrast\` matters more than it sounds.** Most photos occupy a slice of
the 0..1 range, which the glyph ramp then flattens into two or three tiers.

For photographs, raise \`postfx.dither\` — the handful of ramp tiers band on
smooth gradients like skies and skin.`,
  },

  "svg-forge": {
    title: "The SVG forge",
    summary: "Extruding vector paths, and what to watch for.",
    body: `\`\`\`tsx
// From markup
model={{ type: "svg", markup: '<svg viewBox="0 0 100 100">…</svg>', depth: 0.3 }}

// Or from a URL
model={{ type: "svg", src: "/logo.svg", depth: 0.35, bevel: 0.02 }}
\`\`\`

Filled paths become extruded 3D with counters resolved as real holes.

**What to watch for.**
- **Fills, not strokes.** A stroke-only SVG has no area to extrude and comes out empty. Convert strokes to outlines first.
- **Flatten groups and transforms** where you can; deeply nested transforms are the usual cause of a mangled result.
- **A \`viewBox\` is effectively required** — without one there is nothing to normalise against.
- Simple, bold marks read far better than detailed illustration. The ASCII pass throws away fine detail anyway.

A logo that fails as SVG will often work as a PNG through the image forge in
\`extrude\` mode, which traces the silhouette instead of parsing paths.`,
  },

  shapes: {
    title: "Parametric shapes",
    summary: "The nine primitives and their character.",
    body: `\`\`\`tsx
model={{ type: "shape", shape: "crystal", detail: 128, distortion: 0.35, seed: 7 }}
\`\`\`

| Shape | Reads as |
| --- | --- |
| \`torusKnot\` | The default. Complex, continuously interesting, never literal |
| \`blob\` | Organic and soft. Good for health, wellness, creative |
| \`crystal\` | Faceted and sharp. Good for data, security, finance |
| \`helix\` | Structured motion. Good for anything about pipelines or process |
| \`sphere\` | Calm and neutral. The quietest option |
| \`torus\` | Simple and geometric |
| \`box\` | Deliberately plain; reads as a container or a package |
| \`capsule\` | Soft geometric, product-like |
| \`gear\` | Literal machinery. Good for infra and automation |

\`detail\` controls surface resolution (default 128 — drop to 64 on mobile-heavy
sites). \`distortion\` drives shape-specific deformation: blob lumpiness,
crystal facet depth. \`seed\` makes the noise-driven shapes deterministic, so
the same seed always gives the same object.

Shapes are the only synchronous source — no canvas work, no network, nothing to
wait for. When in doubt, this is the safe recommendation.`,
  },

  postfx: {
    title: "Post-effects",
    summary: "The full postfx stack and the ones that actually matter.",
    body: `\`postfx\` merges over the preset one level deep, so you set only what you want
to change.

**The ones worth reaching for:**

| Prop | Default | Notes |
| --- | --- | --- |
| \`contrastAdjust\` | \`1\` | Multiplied around mid-grey *before* glyph selection. The single most useful knob — presets sit at 1.5–2.1 |
| \`brightnessAdjust\` | \`0\` | Added before glyph selection |
| \`dither\` | \`0\` | Ordered dithering, 0..1. Recovers gradients the ramp would band. Turn it up for photographs |
| \`vignetteIntensity\` | \`0\` | Darkens the edges. \`vignetteRadius\` (0.8) softens it |
| \`scanlineIntensity\` | \`0\` | CRT scanlines; \`scanlineCount\` (200) sets density |
| \`curvature\` | \`0\` | Barrel distortion, like a CRT tube. Keep it under ~0.08 |
| \`colorPalette\` | \`"none"\` | Post-glyph CRT ramp: \`green\`, \`amber\`, \`cyan\`, \`blue\` |

**The loud ones**, for when loud is the point: \`glitchIntensity\` +
\`glitchFrequency\` (horizontal tearing), \`aberrationStrength\` (RGB split — 0.0035
is already visible), \`jitterIntensity\` + \`jitterSpeed\` (cell shuffle),
\`noiseIntensity\` / \`noiseScale\` / \`noiseSpeed\` (film grain),
\`waveAmplitude\` / \`waveFrequency\` / \`waveSpeed\` (sine warp).

**\`mouseGlowEnabled\`** adds an additive glow that follows the pointer, with
\`mouseGlowRadius\` (200px) and \`mouseGlowIntensity\` (1.5).

**\`targetFPS\`** quantises the effect clock — \`30\` gives a deliberately choppy,
low-fi feel and costs less than a smooth one.

A caution: stacking three or more time-based effects (glitch + jitter + noise +
wave) reads as broken rather than styled, and each one costs frame time.`,
  },

  motion: {
    title: "Motion and controls",
    summary: "Rotation, dragging, viewport navigation, embedded clips.",
    body: `\`\`\`tsx
motion={{
  autoRotate: 0.4,           // rad/s. 0 freezes the model
  hoverBoost: 2,             // spin multiplier while hovered
  draggable: true,           // pointer drag-rotates
  hoverZoom: 1.1,            // camera dolly on hover. 1 disables
  tilt: [0.3, -0.08],        // resting tilt [x, z] in radians
  animation: true,           // play clips in a .glb — or a clip name
  animationSpeed: 1,
  respectReducedMotion: true,
}}
\`\`\`

**Embedded animation.** A \`.glb\` with clips plays automatically.
\`animation: "Walk"\` picks one by name, \`false\` leaves the bind pose.

**Viewport controls** are a separate prop and **off by default**:

\`\`\`tsx
controls={{ zoom: true, pan: true, zoomRange: [0.3, 5], resetToken: 0 }}
\`\`\`

Zoom is off on purpose: in a hero, capturing the wheel means the page stops
scrolling when the pointer crosses the canvas, which visitors read as the page
being broken. **Turn zoom on for editors and model viewers, never for a hero.**
Double-clicking the canvas resets the view with no wiring; bumping
\`resetToken\` does the same programmatically.

**Reduced motion.** With \`respectReducedMotion\` on (the default), a visitor
who has asked for reduced motion gets no auto-rotation, no embedded animation
and no time-based post-fx. Dragging still works, so the scene stays explorable
rather than dead.`,
  },

  transparency: {
    title: "Transparency and backgrounds",
    summary: "Compositing over an existing page background.",
    body: `By default the canvas paints an opaque \`backgroundColor\` (\`#000000\`).

\`\`\`tsx
<GlyphCanvas transparent model={…} />
\`\`\`

With \`transparent\`, cells below \`bgThreshold\` (default \`0.06\` raw luminance)
are punched out, so the page's own background — a gradient, an image, another
section — shows through. This is what lets the hero sit inside an existing
design rather than replacing it.

**Tuning it.** If the glyph field looks like it is floating on a faint grey
rectangle, raise \`bgThreshold\`. If the model's darkest areas are being eaten,
lower it.

**Two cautions.**
- Additive effects lose their anchor on a transparent canvas — \`mouseGlowEnabled\` in particular floods a transparent ground, which is why the pointer glow is not enabled in any preset.
- On a **light** page you must also change the glyph colour. A transparent canvas with a light \`tint\` renders as almost nothing. Use \`preset="paper"\`, or set a dark \`tint\` explicitly.`,
  },

  performance: {
    title: "Performance",
    summary: "What costs frame time, and the order to turn things down.",
    body: `**The cost model.** The ASCII pass runs per character cell, so cost scales with
\`(viewport area) / (cellSize²)\` — halving \`cellSize\` roughly quadruples the
work. Cell size is the first and biggest lever, always.

**Turn things down in this order:**

1. **Raise \`cellSize\`** — 9 → 12 is a large saving and often looks *better*, not worse
2. **Lower \`maxDpr\`** — 1.5 → 1 on retina is close to a 2× saving
3. **Drop shape \`detail\`** — 128 → 64 is usually invisible after the ASCII pass
4. **Drop text \`resolution\`** — 512 → 256 for short words
5. **Remove time-based post-fx** — noise, jitter, glitch and wave each cost every frame
6. **Set \`postfx.targetFPS: 30\`** — halves effect-clock work and reads as intentional

**Already handled for you.** \`pauseOffscreen\` (default on) stops rendering when
the section scrolls away; \`prefers-reduced-motion\` freezes animation; a device
without WebGL gets \`errorFallback\` instead of a crash.

**Bundle size.** Glyphforge itself is small — the weight is \`three\`, which the
host app supplies as a peer dependency. Loading the canvas behind a dynamic
import keeps it off the initial bundle:

\`\`\`tsx
const GlyphCanvas = dynamic(() => import("glyphforge").then((m) => m.GlyphCanvas), { ssr: false })
\`\`\`

**A .glb is the one thing that can be genuinely heavy.** Check the file size
before shipping — anything past a few MB will out-cost the renderer.`,
  },

  accessibility: {
    title: "Accessibility",
    summary: "What the component handles, and what you still owe the page.",
    body: `**Handled for you.**
- \`prefers-reduced-motion\` stops auto-rotation, embedded clips and time-based post-fx
- No WebGL → \`errorFallback\` renders instead of a blank canvas
- Offscreen sections stop rendering
- In overlay layout the content wrapper takes pointer events while the gutter stays click-through, so buttons and links behave normally

**What you still owe the page.**
- **The canvas carries no meaning.** All real content must live in \`children\` as actual DOM — never bake the headline into the model and call it done. Text in a \`.glb\` is invisible to screen readers, search engines and translation.
- **Contrast is yours to check.** Glyph colour against the background needs to clear WCAG AA for any text sitting on it. A violet tint on near-black is decorative, not text-legible — keep headline copy on ground the glyphs don't cover, or dim the canvas behind it.
- **Don't put essential controls over the canvas.** In overlay layout the gutter is drag-to-rotate; a button there competes with the gesture.
- **Give the section a heading.** A \`<section>\` of pure canvas with no \`<h1>\` leaves the page with no outline.`,
  },

  placement: {
    title: "Placement and UX",
    summary: "Where an ASCII hero belongs on a page, and how to lay it out.",
    body: `**Where it earns its place.**

| Placement | How | Works when |
| --- | --- | --- |
| **Full hero** | \`<GlyphHero layout="overlay" height="100vh">\` | The product *is* the craft — dev tools, creative tooling, launches |
| **Split hero** | \`<GlyphHero layout="split" canvasSide="right">\` | There is real copy to read. Safest for anything that must convert |
| **Section band** | \`<GlyphCanvas style={{ height: 420 }} />\` | The page already has a hero. A band mid-page is the lowest-risk placement of all |
| **Page background** | \`<GlyphCanvas transparent />\` fixed behind content | Editorial and portfolio. Needs low contrast and slow motion or it fights every word |
| **Card / thumbnail** | \`<GlyphCanvas style={{ height: 240 }} cellSize={12} />\` | Gallery and feature grids. Raise \`cellSize\` — small canvases need bigger cells |

**Layout rules that hold up.**

1. **Don't centre a headline over a centred model.** It is the shape every generated landing page takes, and the type fights the busiest part of the frame. Offset one of them — the Glyphforge site itself pushes the canvas right and drops the headline bottom-left.
2. **Give the type clean ground.** Either offset the canvas, or leave a quiet region for the text. Legibility over glyphs is worse than it looks in a mockup.
3. **Never enable \`controls.zoom\` in a hero.** Capturing the wheel stops the page scrolling and reads as broken.
4. **One ASCII surface per page.** Two competing glyph fields halve the impact of both and double the frame cost.
5. **Match motion to the copy.** \`autoRotate: 0.4\` is right for a hero; drop to ~0.15 behind body text.
6. **Decide the ground first.** On a light page start from \`paper\`; a dark-ground preset dropped onto white renders as a black box.
7. **Mobile is the real test.** A full-viewport hero on a phone is a lot of glyphs and a lot of GPU — raise \`cellSize\` and consider \`split\`, which reflows to stacked.`,
  },

  assets: {
    title: "Finding a 3D model",
    summary: "The five catalogues, what each allows, and how importing works.",
    body: `When a forged shape or word isn't enough — the subject is genuinely a *thing* —
use \`glyphforge_search_models\`. It searches five catalogues from one call.

| Catalogue | Size | Licence | Direct import |
| --- | --- | --- | --- |
| **Objaverse** | ~46,200 | Per model, mostly CC-BY | Yes |
| **Poly Haven** | 521 | CC0 (public domain) | Yes |
| **Khronos glTF samples** | 119 | Varies per model | Yes |
| **three.js examples** | 24 | Per model | Yes |
| **Sketchfab** | Millions | Per model | **No — manual download** |

**Sketchfab is search-only, deliberately.** Downloading needs an OAuth token
tied to a real account, so rather than pretend, Sketchfab results come back with
a link to the model page. The user downloads the \`.glb\` there, then points
\`model={{ type: "url", src: "…" }}\` at it or uploads it in the Studio.

**Licences are printed exactly as the catalogue states them and never
inferred.** If a licence matters for the project, open the source URL and check
it — several catalogues report "varies per model".

**The best models for ASCII** are the animated rigs: a walking soldier or a
flapping flamingo reads far better than a static prop, because the glyph field
reorganises every frame. \`animated_only: true\` filters to those.

**Once you have a URL:**

\`\`\`tsx
<GlyphHero model={{ type: "url", src: "https://…/model.glb" }} preset="terminal" />
\`\`\`

Embedded clips play automatically; \`motion.animation\` picks one by name.`,
  },

  cli: {
    title: "The CLI",
    summary: "init, add and list.",
    body: `\`\`\`bash
npx glyphforge init          # install deps and scaffold a hero component
npx glyphforge add <name>    # copy the source into your project — you own it
npx glyphforge list          # show what \`add\` can copy
\`\`\`

Options: \`--yes\`/\`-y\` runs the install unattended, \`--dir\`/\`-d\` sets where
\`add\` writes, \`--force\` overwrites existing files.

\`init\` is the fast path. \`add\` is the escape hatch — it ejects the component
source into the project so it can be edited directly, the same trade shadcn/ui
makes. After ejecting, the package is no longer the source of truth for that
component and updates won't reach it.`,
  },

  studio: {
    title: "The Studio",
    summary: "The web app, and what it is useful for from an agent's seat.",
    body: `The Studio is the companion site: forge a model, tune the look live, and copy
out a paste-ready component.

- **Source** — text, shape, image (flat/relief/extrude), SVG, or an uploaded \`.glb\`
- **Look** — presets, ramps, cell size, tint, dithering, transparency and the full post-fx stack, live
- **Viewport** — scroll or pinch to zoom, shift-drag to pan, drag to rotate, double-click to reset
- **Export** — copy the component, copy the install command, download the \`.glb\`, or share a link that encodes the whole config
- **/assets** — search the catalogues and send a model straight into the Studio
- **/community** — a gallery where every card renders the real scene live

Uploads never leave the browser, and the share link carries the config in the
URL — there is no server storing anything.

**Why it matters here:** \`glyphforge_generate_component\` runs the *same* code
generator the Studio's copy button uses, so what an agent hands over and what
the site hands over are byte-identical. When a person wants to tweak by feel
rather than by prop, send them to the Studio.`,
  },

  troubleshooting: {
    title: "Troubleshooting",
    summary: "The failures people actually hit, and their causes.",
    body: `**Nothing renders / blank canvas**
- The canvas fills its container, so a parent with no height renders nothing. Give it an explicit height.
- In Next App Router, the importing file needs \`"use client"\`.
- Check the peer dependencies are installed and the fiber/postprocessing majors match your React major.

**"Cannot find module 'three'"** — peer dependencies are not installed. See the \`install\` topic.

**Hydration or \`window is not defined\` errors** — the component is being server-rendered. Import it with \`dynamic(..., { ssr: false })\`, or move it into a client component.

**The model is a black box on a light page** — a dark-ground preset on white. Use \`preset="paper"\`, or set \`backgroundColor\` plus a dark \`tint\`.

**Text comes out as blobs with no holes** — usually a font that hadn't loaded when the forge ran, so the browser fell back. Await the webfont first. Thin weights also lose their counters at ASCII resolution; go heavier.

**An SVG renders empty** — it is stroke-only, or has no \`viewBox\`. Convert strokes to outlines. As a fallback, export a PNG and use the image forge in \`extrude\` mode.

**A photo is unrecognisable** — \`tones\` is off, so the image only displaces vertices. Turn it on, keep \`autoContrast\`, and raise \`postfx.dither\`.

**Banding on gradients** — the ramp has too few tiers for the content. Raise \`postfx.dither\`, or switch to \`shades\`.

**The page won't scroll over the canvas** — \`controls.zoom\` is on. Turn it off in a hero.

**Two effects on one page interfere** — this was an upstream bug (module-level state) and is fixed; each instance owns its clock and settings. If you see it, you are on a fork of the original project rather than this package.

**It's slow** — see the \`performance\` topic. Raise \`cellSize\` first.`,
  },
} as const satisfies Record<string, Topic>

export type TopicName = keyof typeof TOPICS

export const TOPIC_NAMES = Object.keys(TOPICS) as TopicName[]
