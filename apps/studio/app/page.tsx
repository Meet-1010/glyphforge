"use client"

import Link from "next/link"
import { GlyphCanvas, GlyphHero } from "glyphforge"
import { CopyButton } from "../components/ui"
import { SiteNav } from "../components/site-nav"

const FLAMINGO =
  "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Flamingo.glb"

const SNIPPET = `import { GlyphHero } from "glyphforge"

<GlyphHero
  model={{ type: "text", value: "SHIP IT" }}
  preset="matrix"
/>`

const SOURCES = [
  {
    title: "Text",
    body: "Any font the browser can render, extruded into real geometry. No .typeface.json, no font files, emoji included.",
    model: { type: "text", value: "Aa", depth: 0.4 } as const,
    preset: "terminal" as const,
  },
  {
    title: "Shape",
    body: "Nine parametric primitives with seeded distortion. Zero assets, instant, deterministic.",
    model: { type: "shape", shape: "crystal", distortion: 0.5, seed: 7 } as const,
    preset: "blueprint" as const,
  },
  {
    title: "Image",
    body: "Drop a PNG. Relief mode displaces by luminance; extrude mode traces the silhouette and pushes it out.",
    model: { type: "shape", shape: "gear", distortion: 0.6 } as const,
    preset: "amber" as const,
  },
  {
    title: "SVG",
    body: "Filled paths become extruded 3D with holes resolved correctly. Paste markup or pick a file.",
    model: { type: "shape", shape: "torusKnot", distortion: 0.4 } as const,
    preset: "glitch" as const,
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-ink">
      <SiteNav floating />

      <GlyphHero
        model={{ type: "shape", shape: "torusKnot", detail: 200, distortion: 0.45 }}
        preset="terminal"
        cellSize={8}
        height="100dvh"
        postfx={{ contrastAdjust: 1.9, vignetteIntensity: 0.3 }}
      >
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet">
            ASCII hero sections
          </p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] text-white sm:text-5xl md:text-6xl">
            One component.
            <br />
            <span className="text-violet">Bring your own model —</span>
            <br />
            or forge one here.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-pretty text-sm leading-relaxed text-white/55">
            A WebGL ASCII shader you can drop into any React app. Forge the model in your browser
            from text, an image, an SVG or a shape — or pull one from 46,000 open 3D assets,
            animation included. No Blender, no asset pipeline, no backend.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/studio"
              className="rounded-lg bg-violet px-5 py-3 font-mono text-[12px] text-ink transition-colors hover:bg-violet-dim"
            >
              Forge a model →
            </Link>
            <a
              href="#install"
              className="rounded-lg border border-edge-bright px-5 py-3 font-mono text-[12px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              npm install glyphforge
            </a>
          </div>
        </div>
      </GlyphHero>

      {/* One component */}
      <section className="border-t border-edge px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <SectionLabel>The whole integration</SectionLabel>
            <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
              Two props and you&apos;re done.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              No boilerplate repo to clone and strip down. No 25&nbsp;MB demo asset to delete. No
              hand-tuning <code className="font-mono text-violet">scale=&#123;8&#125;</code> until
              your model fits the frame — every source is auto-fitted and centred on load.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Auto-fits any .glb — no scale guessing",
                "Pauses rendering when scrolled offscreen",
                "Honours prefers-reduced-motion by default",
                "Falls back gracefully with no WebGL",
                "Zero network requests at runtime",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 font-mono text-[11px] text-white/50">
                  <span className="text-violet">+</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-edge bg-ink-panel px-4 py-2.5">
              <span className="font-mono text-[10px] text-white/35">ascii-hero.tsx</span>
              <CopyButton text={SNIPPET} variant="ghost" />
            </div>
            <pre className="overflow-x-auto rounded-b-lg border border-edge bg-ink p-4 font-mono text-[11px] leading-relaxed text-white/75">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Forge sources */}
      <section className="border-t border-edge px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionLabel>The forge</SectionLabel>
          <h2 className="mt-4 max-w-xl text-2xl font-bold text-white sm:text-3xl">
            Making the model was always the hard part.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/55">
            Every ASCII hero demo tells you to go find a <code className="font-mono text-violet">.glb</code>{" "}
            somewhere. Glyphforge builds one in the browser instead — and hands you a real mesh you
            can export and use anywhere.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {SOURCES.map((source) => (
              <article
                key={source.title}
                className="overflow-hidden rounded-xl border border-edge bg-ink-raised"
              >
                <div className="h-44 border-b border-edge">
                  <GlyphCanvas
                    model={source.model}
                    preset={source.preset}
                    cellSize={7}
                    cameraZ={4}
                    maxDpr={1.25}
                    motion={{ autoRotate: 0.35, draggable: false }}
                    style={{ minHeight: 0 }}
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-mono text-[12px] text-white">{source.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/45">{source.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Asset library */}
      <section className="border-t border-edge px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <SectionLabel>Or skip the forge</SectionLabel>
            <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
              46,871 models, one click from your hero.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Search Objaverse, Poly Haven, the Khronos samples and the three.js rigs from one box,
              then send any of them straight to the Studio. Sketchfab&apos;s catalogue is searchable
              alongside them.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Animated .glb plays in ASCII, clips and all",
                "Auto-fitted and auto-framed on arrival",
                "Licences shown as the source states them, never guessed",
                "Searched from your browser — no server sees your query",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 font-mono text-[11px] text-white/50">
                  <span className="text-violet">+</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/assets"
              className="mt-7 inline-block rounded-lg border border-edge-bright px-5 py-3 font-mono text-[12px] text-white/75 transition-colors hover:border-violet hover:text-violet"
            >
              Browse the library →
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-edge">
            <GlyphCanvas
              model={{ type: "url", src: FLAMINGO }}
              preset="terminal"
              cellSize={7}
              maxDpr={1.25}
              motion={{ autoRotate: 0.5, draggable: false }}
              style={{ minHeight: 300, height: 300 }}
            />
            <p className="border-t border-edge bg-ink-raised px-4 py-3 font-mono text-[10px] text-white/35">
              three.js Flamingo — a real animated rig, running in ASCII
            </p>
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="scroll-mt-16 border-t border-edge px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>Install</SectionLabel>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Pick your level of control.</h2>

          <div className="mt-8 space-y-4">
            <InstallCard
              title="Use the package"
              body="One dependency, upgrades cleanly, props for everything."
              command="npm install glyphforge three @react-three/fiber @react-three/postprocessing postprocessing"
            />
            <InstallCard
              title="Let the CLI wire it up"
              body="Detects Next or Vite, installs peers, writes a working component."
              command="npx glyphforge init --yes"
            />
            <InstallCard
              title="Own the source"
              body="Copies the real source into your repo. No runtime dependency, edit anything."
              command="npx glyphforge add hero"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-edge px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[11px] text-white/45">
              glyph<span className="text-violet">forge</span> — MIT licensed
            </p>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-white/25">
              ASCII shader derived from{" "}
              <a
                href="https://github.com/egorshest/webgl-ascii-hero"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-white/50"
              >
                webgl-ascii-hero
              </a>{" "}
              by egorshest, MIT licensed.
            </p>
          </div>
          <Link
            href="/studio"
            className="self-start font-mono text-[11px] text-violet transition-colors hover:text-white sm:self-auto"
          >
            Open Studio →
          </Link>
        </div>
      </footer>
    </main>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet">{children}</span>
  )
}

function InstallCard({ title, body, command }: { title: string; body: string; command: string }) {
  return (
    <div className="rounded-xl border border-edge bg-ink-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[12px] text-white">{title}</h3>
        <CopyButton text={command} variant="ghost" />
      </div>
      <p className="mt-1.5 text-[12px] text-white/45">{body}</p>
      <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded-md border border-edge bg-ink px-3 py-2.5 font-mono text-[10px] text-violet">
        {command}
      </code>
    </div>
  )
}
