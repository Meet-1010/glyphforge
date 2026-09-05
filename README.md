# Glyphforge

**ASCII hero sections you can drop into any React app — and a browser-based forge so you don't need a 3D model to start.**

```tsx
import { GlyphHero } from "glyphforge"

<GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix" />
```

<!-- Add a capture of the Studio or a rendered hero here. -->

---

## The idea

WebGL ASCII heroes look great and almost nobody ships one, because every version of this is a repo you fork that says *"now replace `user-model.glb` with your own"*. That step is where it dies: most people don't have a `.glb`, and getting one means Blender, a marketplace, or a licence they didn't read.

Glyphforge removes that step in two ways:

1. **It's a package, not a boilerplate.** One component, install it like anything else.
2. **It forges the model in your browser.** Type a word, drop a PNG, paste an SVG, or pick a parametric shape. Real geometry, exportable as a standard `.glb`.

---

## Repository layout

```
packages/glyphforge/       The npm package — components, ASCII shader, model forge, CLI
packages/glyphforge-mcp/   The MCP server — the same brains, for coding agents
apps/studio/               The site — landing, Studio, asset search, community
```

| | |
| --- | --- |
| **Library** | React components, the GLSL ASCII pass, five model generators, glTF export |
| **CLI** | `npx glyphforge init` to scaffold, `npx glyphforge add` to eject the source |
| **MCP server** | `npx glyphforge-mcp` — teaches an agent the library, recommends a hero for the site it is looking at, finds the model |
| **`/studio`** | Forge a model, tune the look live, copy the component or download the `.glb` |
| **`/assets`** | Search open 3D catalogues and send a model straight into the Studio |
| **`/community`** | Live gallery of creations, each one a running scene rather than a screenshot |

---

## Local development

```bash
npm install
npm run dev
```

Starts the Studio on [localhost:3000](http://localhost:3000). No build step first —
the Studio resolves `glyphforge` to the library's **source**, so editing the
library hot-reloads like any other file in the app.

Other scripts:

```bash
npm run build       # build the publishable package (dist/)
npm run typecheck   # typecheck every workspace
```

The publishable bundle is verified separately by `npm run build` and by the CLI's
eject path, rather than by being what the dev server consumes. That split is
deliberate: pointing the Studio at `dist` meant every library edit needed a
rebuild, and `tsup --clean` deletes that directory while Next is mid-read, which
repeatedly left the dev server serving a broken module graph.

---

## What the Studio does

- **Source** — text, parametric shape, image (flat, relief, or silhouette extrude), SVG, or an uploaded `.glb`
- **Look** — seven presets, eight glyph ramps, cell size, tint, dithering, transparency, and the full post-fx stack live
- **Viewport** — scroll or pinch to zoom, shift-drag to pan, drag to rotate, double-click to reset
- **Export** — copy a paste-ready component, copy the install command, download the model as `.glb`, or share a link that encodes the whole config

Uploads never leave the browser. The share link carries the config in the URL; there's no server storing anything.

## Asset search

`/assets` searches five open catalogues and imports straight into the Studio.

| Catalogue | Size | Licence | Direct import |
| --- | --- | --- | --- |
| Objaverse | ~46,200 | Per model, mostly CC-BY | yes |
| Poly Haven | 521 | CC0 | yes |
| Khronos glTF samples | 119 | Varies per model | yes |
| three.js examples | 24 | Per model | yes |
| Sketchfab | millions | Per model | no — search only |

Both the APIs and their file CDNs send `Access-Control-Allow-Origin: *`, so
search and download both run in the browser with no proxy and no API key. Poly
Haven's multi-file glTF resolves its own `.bin` and textures because the whole
directory is CORS-open. Nothing about a search reaches a Glyphforge server,
because there isn't one.

Sketchfab is the one exception, deliberately: downloading needs an OAuth token
tied to a real account, so rather than pretend, those results link out to the
model page and you bring the `.glb` back yourself.

Licences are printed exactly as the source states them and never inferred.

## Community

`/community` is a gallery where each card renders the real scene, live — a
creation is a few hundred bytes of config, not an asset, so the page can rebuild
it in your browser and hand it back to the Studio still editable.

Being straight about the limits: with no backend there is nothing to upload
*to*. Featured entries ship in `apps/studio/data/community.json`, your own saves
live in `localStorage` on that one browser, and submissions go through a
pre-filled GitHub issue carrying a share link. Wiring a real backend later means
replacing `apps/studio/lib/gallery.ts` — the page reads through it, not around
it.

---

## For coding agents

The MCP server puts everything above inside Claude Code, Cursor, Codex — anything
that speaks [MCP](https://modelcontextprotocol.io):

```bash
claude mcp add glyphforge -- npx -y glyphforge-mcp
```

The agent can then learn the library, get a preset, model and layout recommended
for the site it is actually looking at, read the project on disk to check peer
dependencies and infer the palette, search all five model catalogues, and
generate the component. Sketchfab results arrive as a link the user can click
and download from, because that step needs an account.

It shares its brains with this site rather than reimplementing them — asset
search lives in `glyphforge/catalog` and component generation in
`glyphforge/codegen`, both consumed by the Studio and the server, so the code an
agent hands you is byte-identical to the code the Studio's copy button hands you.

See [`packages/glyphforge-mcp`](./packages/glyphforge-mcp) for the tool list and
per-client setup.

---

## Deploying

Every route prerenders to static HTML — no API routes, no server actions, no
runtime data fetching, because the catalogues are queried from the browser. That
leaves two good options.

**Vercel** (recommended). Import the repo and set **Root Directory** to
`apps/studio`; it picks up the npm workspace from the root lockfile on its own.
The static pages are served from the edge, so nothing cold-starts.

**Any static host** — Cloudflare Pages, Netlify, GitHub Pages, a Render static
site:

```bash
npm run build:static     # writes apps/studio/out/
```

Static export is opt-in rather than the default, because `output: "export"`
forbids ever adding an API route and the community page is written to grow a
backend later. `trailingSlash` is enabled in that mode so pages land as
`assets/index.html`; Netlify and Cloudflare resolve the extensionless form
themselves, but GitHub Pages needs the directory form.

Worth knowing on free tiers: Render's free *web services* sleep after 15 minutes
and take ~50s to wake, which is rough for a demo linked from a README — use a
static site there instead. Vercel's Hobby tier is non-commercial under their
terms.

The one asset to watch is `public/objaverse-index.json` at 1.7 MB, fetched once
per visitor who opens `/assets`.

---

## How the text forge works

Browsers don't expose glyph outlines, so there's no direct path from a webfont to a mesh. Glyphforge rasterises the string to a canvas, traces it with marching squares, links the segments into closed loops, simplifies them, and resolves nesting so counters (`O`, `B`, `%`) become real holes rather than solid blobs. Then it extrudes.

The upside of doing it this way: it works with *any* font the page can render, including webfonts and emoji, with no font files to ship. The same tracer drives image silhouette extrusion.

---

## Relationship to the original

This project began as a rebuild of [webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero) by egorshest (MIT). The GLSL ASCII shader and glyph-atlas approach come from there and are credited in [NOTICE](./NOTICE).

What changed on the way to a distributable plugin:

- **Packaged, not forked** — an npm package with a one-line component, plus a CLI that can eject the source
- **Per-instance state** — upstream kept the clock and every setting in module-level variables, so two effects on one page overwrote each other
- **Uniforms updated in place** — the effect is no longer reconstructed (and the shader recompiled) on prop changes
- **The `style` API actually works** — `dense`, `minimal` and `blocks` were declared upstream but always returned an empty glyph
- **No runtime network calls** — replaced drei's `<Environment preset="studio" />`, which fetches an HDR from a CDN, with a procedural environment
- **Auto-fit and auto-framing** — no more hand-tuning `scale={8}` per model
- **Accessibility and battery** — honours `prefers-reduced-motion`, pauses offscreen, degrades without WebGL
- **Transparency** — the pass can composite over an existing page background
- **The forge** — the part that removes the "go find a model" step entirely

---

## Licence

MIT — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

MIT requires the original copyright notice to travel with the code, so the upstream attribution in `NOTICE` stays regardless of how this is distributed.
