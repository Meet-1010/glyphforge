"use client"

import Link from "next/link"
import { GlyphCanvas } from "glyphforge"
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
    n: "01",
    title: "Text",
    body: "Any font the browser can render, extruded into real geometry. No .typeface.json, no font files, emoji included.",
    model: { type: "text", value: "Aa", depth: 0.4 } as const,
    preset: "terminal" as const,
  },
  {
    n: "02",
    title: "Shape",
    body: "Nine parametric primitives with seeded distortion. Zero assets, instant, deterministic.",
    model: { type: "shape", shape: "crystal", distortion: 0.5, seed: 7 } as const,
    preset: "blueprint" as const,
  },
  {
    n: "03",
    title: "Image",
    body: "Drop a PNG. Flat maps its tones, relief pushes bright areas forward, extrude traces the silhouette.",
    model: { type: "shape", shape: "gear", distortion: 0.6 } as const,
    preset: "chromatic" as const,
  },
  {
    n: "04",
    title: "SVG",
    body: "Filled paths become extruded 3D with counters resolved as real holes. Paste markup or pick a file.",
    model: {
      type: "svg",
      markup:
        '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 5 L61 39 L97 39 L68 60 L79 95 L50 74 L21 95 L32 60 L3 39 L39 39 Z" fill="black"/></svg>',
      depth: 0.3,
    } as const,
    preset: "glitch" as const,
  },
]

export default function LandingPage() {
  return (
    <main className="bg-ink">
      <SiteNav floating />

      {/* Hero — the canvas is the page, the type sits on it like a caption.
          Deliberately bottom-left rather than centred: a centred headline over a
          centred model is the shape every generated landing page takes. */}
      <section className="relative h-dvh w-full overflow-hidden">
        {/* Offset right on wide screens so the headline sits on clean ground
            instead of fighting the glyphs for legibility. */}
        <div className="absolute inset-0 lg:left-[26%]">
          <GlyphCanvas
            model={{ type: "shape", shape: "torusKnot", detail: 200, distortion: 0.45 }}
            preset="terminal"
            cellSize={8}
            transparent
            postfx={{ contrastAdjust: 1.9, vignetteIntensity: 0.3 }}
            style={{ height: "100%", minHeight: 0 }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
          <div className="px-5 pb-10 sm:px-8 sm:pb-14">
            <div className="mx-auto max-w-6xl">
              <p className="label">Glyphforge — WebGL ASCII for React</p>

              <h1 className="display mt-5 max-w-4xl text-[10vw] leading-[0.9] text-bone sm:text-[7.5vw] lg:text-[6.4rem]">
                One component.
                <br />
                <span className="text-muted">Bring your own model,</span>
                <br />
                or forge one here.
              </h1>

              <div className="mt-9 flex flex-wrap items-end justify-between gap-6 border-t border-rule pt-6">
                <p className="max-w-md font-mono text-[12px] leading-relaxed text-bone-dim">
                  An ASCII shader you drop into any React app. Forge the model in your browser from
                  text, an image, an SVG or a shape — or pull one from 46,000 open assets, animation
                  included.
                </p>

                <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                  <Link
                    href="/studio"
                    className="bg-bone px-5 py-3 font-mono text-[12px] text-ink transition-colors hover:bg-bone-dim"
                  >
                    Open the Studio
                  </Link>
                  <Link
                    href="/assets"
                    className="border border-rule-bright px-5 py-3 font-mono text-[12px] text-bone transition-colors hover:border-bone"
                  >
                    Browse 46,871 models
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section n="01" title="The whole integration">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-[15px] leading-relaxed text-bone-dim">
              No boilerplate repo to clone and strip down. No 25&nbsp;MB demo asset to delete. No
              hand-tuning <Mono>scale=&#123;8&#125;</Mono> until your model fits the frame.
            </p>

            <dl className="mt-9 border-t border-rule">
              {[
                ["Auto-fit", "Any .glb is measured, centred and framed on load"],
                ["Offscreen", "Rendering pauses when the hero scrolls away"],
                ["Reduced motion", "Rotation and animation stop when the OS asks"],
                ["No WebGL", "Falls back quietly instead of a blank rectangle"],
                ["Offline", "Zero network requests at runtime"],
              ].map(([term, def]) => (
                <div
                  key={term}
                  className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-rule py-3"
                >
                  <dt className="font-mono text-[11px] text-bone">{term}</dt>
                  <dd className="font-mono text-[11px] leading-relaxed text-muted">{def}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border border-rule">
            <div className="flex items-center justify-between border-b border-rule bg-ink-3 px-4 py-2.5">
              <span className="font-mono text-[10px] text-muted">ascii-hero.tsx</span>
              <CopyButton text={SNIPPET} variant="ghost" />
            </div>
            <pre className="overflow-x-auto bg-ink-2 p-5 font-mono text-[12px] leading-[1.7] text-bone-dim">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </div>
      </Section>

      <Section n="02" title="Making the model was always the hard part">
        <p className="max-w-xl text-[15px] leading-relaxed text-bone-dim">
          Every ASCII hero demo tells you to go find a <Mono>.glb</Mono> somewhere. Glyphforge builds
          one in the browser instead — and hands you a real mesh you can export and use anywhere.
        </p>

        <div className="mt-10 grid border-l border-t border-rule sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((source) => (
            <article key={source.title} className="border-b border-r border-rule">
              <div className="h-52 border-b border-rule">
                <GlyphCanvas
                  model={source.model}
                  preset={source.preset}
                  cellSize={5}
                  maxDpr={1.5}
                  transparent
                  motion={{ autoRotate: 0.35, draggable: false }}
                  style={{ minHeight: 0, height: "100%" }}
                />
              </div>
              <div className="p-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted">{source.n}</span>
                  <h3 className="font-mono text-[12px] text-bone">{source.title}</h3>
                </div>
                <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-muted">
                  {source.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section n="03" title="Or skip the forge entirely">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            {/* The count set at display scale — it is the strongest single fact
                on the page, so it gets typographic weight rather than a badge. */}
            <p className="display text-[5.5rem] leading-[0.85] text-bone sm:text-[7rem]">46,871</p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              models, one click from your hero
            </p>

            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-bone-dim">
              Objaverse, Poly Haven, the Khronos samples and the three.js rigs, searched from one
              box and sent straight to the Studio. Sketchfab&apos;s catalogue sits alongside them.
            </p>

            <ul className="mt-7 space-y-2.5">
              {[
                "Animated .glb plays in ASCII, clips and all",
                "Auto-fitted and auto-framed on arrival",
                "Licences shown as the source states them, never guessed",
                "Searched from your browser — no server sees the query",
              ].map((item) => (
                <li key={item} className="flex gap-3 font-mono text-[11px] text-bone-dim">
                  <span className="text-muted">├</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/assets"
              className="mt-8 inline-block border border-rule-bright px-5 py-3 font-mono text-[12px] text-bone transition-colors hover:border-bone"
            >
              Browse the library
            </Link>
          </div>

          <figure className="border border-rule">
            <GlyphCanvas
              model={{ type: "url", src: FLAMINGO }}
              preset="terminal"
              cellSize={7}
              maxDpr={1.25}
              transparent
              motion={{ autoRotate: 0.5, draggable: false }}
              style={{ minHeight: 320, height: 320 }}
            />
            <figcaption className="border-t border-rule bg-ink-2 px-4 py-3 font-mono text-[10px] text-muted">
              three.js Flamingo — a real animated rig, running in ASCII
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section n="04" title="Pick your level of control" id="install">
        <div className="border-t border-rule">
          {[
            {
              title: "Use the package",
              body: "One dependency, upgrades cleanly, props for everything.",
              command:
                "npm install glyphforge three @react-three/fiber @react-three/postprocessing postprocessing",
            },
            {
              title: "Let the CLI wire it up",
              body: "Detects Next or Vite, installs peers, writes a working component.",
              command: "npx glyphforge init --yes",
            },
            {
              title: "Own the source",
              body: "Copies the real source into your repo. No runtime dependency, edit anything.",
              command: "npx glyphforge add hero",
            },
          ].map((step) => (
            <div key={step.title} className="grid gap-4 border-b border-rule py-6 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <h3 className="font-mono text-[12px] text-bone">{step.title}</h3>
                <p className="mt-1.5 font-mono text-[11px] text-muted">{step.body}</p>
              </div>
              <div className="flex items-start gap-2">
                <code className="w-full overflow-x-auto whitespace-nowrap border border-rule bg-ink-2 px-3 py-2.5 font-mono text-[11px] text-bone-dim">
                  {step.command}
                </code>
                <CopyButton text={step.command} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <footer className="border-t border-rule px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[12px] text-bone">glyphforge ▮</p>
            <p className="mt-2 max-w-md font-mono text-[10px] leading-relaxed text-muted">
              MIT licensed. ASCII shader derived from{" "}
              <a
                href="https://github.com/egorshest/webgl-ascii-hero"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-bone"
              >
                webgl-ascii-hero
              </a>{" "}
              by egorshest, also MIT.
            </p>
          </div>
          <div className="flex gap-5 font-mono text-[11px]">
            <a
              href="https://github.com/Meet-1010/glyphforge"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-bone"
            >
              GitHub
            </a>
            <Link href="/studio" className="text-bone">
              Open the Studio →
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

/** Numbered section, spec-sheet style: mono index, serif heading, hairline rule. */
function Section({
  n,
  title,
  id,
  children,
}: {
  n: string
  title: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-rule px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-baseline gap-5">
          <span className="font-mono text-[11px] text-muted">{n}</span>
          <h2 className="display max-w-3xl text-[2.2rem] leading-[0.95] text-bone sm:text-[3rem]">
            {title}
          </h2>
        </header>
        {children}
      </div>
    </section>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] text-bone">{children}</code>
}
