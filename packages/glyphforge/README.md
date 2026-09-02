# Glyphforge

**Drop-in WebGL ASCII hero sections for React — and a model forge so you don't have to go find a `.glb` first.**

```bash
npm install glyphforge three @react-three/fiber @react-three/postprocessing postprocessing
```

```tsx
import { GlyphHero } from "glyphforge"

<GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix" />
```

That's the whole integration. No boilerplate repo to clone, no demo asset to delete, no `scale={8}` to hand-tune.

---

## Why this exists

Every ASCII-hero demo hands you a repo to fork and then tells you to *"replace `user-model.glb` with your own"*. That one line is the entire problem — most people don't have a `.glb`, and getting one means Blender, a marketplace, or a licence you didn't read.

Glyphforge builds the model in the browser instead. Type a word. Drop a PNG. Paste an SVG. Pick a parametric shape. You get real geometry you can also **export as a standard `.glb`** and use anywhere else.

---

## Model sources

Everything below runs client-side. No backend, no API key, no upload.

| Source | What it does |
| --- | --- |
| `text` | Extrudes live browser text into 3D. Any font the page can render — webfonts and emoji included. No `.typeface.json` conversion. |
| `image` | `relief` displaces a grid by luminance (photos, depth maps). `extrude` traces the silhouette and pushes it out (flat logos, icons). |
| `svg` | Filled paths become extruded 3D, with counters resolved as real holes. |
| `shape` | Nine parametric primitives with seeded distortion — deterministic, instant, zero assets. |
| `url` | Your own `.glb` / `.gltf`. Auto-fitted and centred on load. |

```tsx
<GlyphHero model={{ type: "text", value: "ACME", font: "900 200px Georgia", depth: 0.4 }} />
<GlyphHero model={{ type: "image", src: "/logo.png", mode: "extrude" }} />
<GlyphHero model={{ type: "svg", src: "/mark.svg", depth: 0.3 }} />
<GlyphHero model={{ type: "shape", shape: "crystal", distortion: 0.5, seed: 7 }} />
<GlyphHero model={{ type: "url", src: "/models/mine.glb" }} />
```

Browsers don't expose glyph outlines, so `text` rasterises the string and traces it with marching squares, nests the contours to find holes, and extrudes the result. That same tracer powers `image` extrude mode.

### Forge without rendering

```ts
import { forgeGeometry, exportModel } from "glyphforge/forge"

const geometry = await forgeGeometry({ type: "text", value: "HELLO" })
const blob = await exportModel(geometry) // a real .glb
```

---

## Presets

`terminal` · `matrix` · `blueprint` · `brutalist` · `glitch` · `chromatic` · `paper`

```tsx
<GlyphHero preset="matrix" />                 // start from a preset
<GlyphHero preset="matrix" cellSize={12} />   // override anything
```

Build one interactively in **[the Studio](https://github.com/Meet-1010/glyphforge#studio)** and copy the generated component out.

---

## Components

### `<GlyphHero />`

A complete hero section: canvas plus your content.

```tsx
<GlyphHero model={{ type: "shape", shape: "torusKnot" }} preset="terminal" layout="overlay">
  <h1>Your headline</h1>
</GlyphHero>
```

- `layout="overlay"` — content centred over the canvas (default)
- `layout="split"` — content one side, canvas the other (`canvasSide="left" | "right"`)

### `<GlyphCanvas />`

Just the WebGL surface, filling its container. Use it when you already have a layout.

### `<AsciiEffect />`

The raw post-processing pass, for your own R3F scene:

```tsx
<EffectComposer>
  <AsciiEffect characterSet="terminal" tint="#917AFF" cellSize={9} />
</EffectComposer>
```

---

## Props

### Look

| Prop | Default | |
| --- | --- | --- |
| `preset` | `"terminal"` | Starting point; every other prop overrides it |
| `cellSize` | `9` | Character cell size in px. Smaller = finer and costlier |
| `characterSet` | `"terminal"` | Ramp name, your own `string[]` (sparse→dense), or `null` for procedural glyphs |
| `glyphStyle` | `"standard"` | Procedural style when `characterSet` is `null`: `standard` · `dense` · `minimal` · `blocks` |
| `tint` | preset | One flat colour for every glyph. Omit to keep scene colour |
| `invert` | `true` | Flip brightness→density |
| `volumeShading` | `true` | Widen the range so shadows read dense, highlights sparse |
| `transparent` | `false` | Composite over the host page instead of an opaque background |
| `backgroundColor` | `"#000000"` | Opaque-mode background |
| `postfx` | preset | Scanlines, curvature, vignette, glitch, grain, aberration, pointer glow, fps lock |

Built-in ramps: `terminal` `classic` `blocks` `shades` `dots` `binary` `katakana` `runic`.

### Scene

| Prop | Default | |
| --- | --- | --- |
| `cameraZ` | `"auto"` | Frames the model for the current viewport. Set a number to pin it |
| `maxDpr` | `1.5` | Pixel-ratio ceiling |
| `pauseOffscreen` | `true` | Stop rendering when scrolled out of view |
| `motion` | | `autoRotate`, `hoverBoost`, `hoverZoom`, `draggable`, `tilt`, `animation`, `animationSpeed`, `respectReducedMotion` |
| `controls` | off | Viewport navigation: `zoom`, `pan`, `zoomRange`, `resetToken` |
| `material` | | `color`, `roughness`, `metalness`, `keepMaterials` |
| `fallback` / `errorFallback` | | Loading and failure UI |

`cameraZ="auto"` matters more than it sounds: a long word auto-fits to a wide, flat mesh, and a fixed camera distance would render it as an unreadable sliver.

### Camera controls

```tsx
<GlyphCanvas controls={{ zoom: true, pan: true }} />
```

Scroll or pinch to zoom, shift/middle/right-drag to pan, double-click to reset.
Left-drag still rotates the model.

Both are **off by default**, and that default is deliberate: a hero section that
captures the wheel stops the page scrolling the moment the pointer crosses it,
which visitors read as the site being broken. Turn them on for editors and
viewers — the Studio does.

Zoom is a multiplier on the auto-framed distance rather than an absolute
position, so resizing the window still reframes correctly without discarding
where the viewer had zoomed to.

### Animation

Embedded glTF clips play automatically:

```tsx
<GlyphCanvas
  model={{ type: "url", src: "/models/walk.glb" }}
  motion={{ animation: "Walk", animationSpeed: 0.8 }}
/>
```

`animation` takes `true` (first clip), a clip name, or `false`. Rigged models are
cloned with `SkeletonUtils`, so skinned meshes keep their own bones. Playback
stops for `prefers-reduced-motion` and while the hero is offscreen.

---

## Behaviour worth knowing

- **Reduced motion** — auto-rotation and time-driven effects stop when the visitor has `prefers-reduced-motion: reduce`. Dragging still works.
- **Offscreen** — the render loop pauses when the hero scrolls away.
- **No WebGL** — renders a quiet fallback instead of a blank rectangle.
- **No network at runtime** — lighting comes from a procedurally generated environment, not a CDN-hosted HDR.
- **Multiple instances** — every effect owns its state, so two heroes on one page don't fight over settings or share a clock.

---

## CLI

```bash
npx glyphforge init --yes   # detect framework, install peers, scaffold a component
npx glyphforge add hero     # copy the real source into your repo — you own it
npx glyphforge list         # what `add` can copy
```

`add` copies the actual library source (not a duplicated template), so ejected code never drifts from the package.

---

## Requirements

React 18+, and `three` ≥ 0.155 with `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing` as peers.

`.glb` files with Draco or KTX2 compression need their loaders configured — decode them ahead of time, or forge the model here instead.

---

## Licence

MIT — see [LICENSE](./LICENSE).

The GLSL ASCII shader and the glyph-atlas approach are derived from
[webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero) by egorshest,
also MIT. See [NOTICE](./NOTICE) for the full attribution.
