"use client"

import { useState } from "react"
import Link from "next/link"
import { SiteNav } from "../../components/site-nav"
import { CopyButton, Segmented } from "../../components/ui"

/**
 * The setup guide.
 *
 * Four ways in, ordered by how much you do yourself: hand the job to an agent,
 * install the package, let the CLI scaffold it, or eject the source. The MCP
 * route leads because it is the only one that can look at your project first.
 */

type ClientId = "claude" | "cursor" | "codex" | "other"

const MCP_CLIENTS: Record<
  ClientId,
  { label: string; where: string; lang: string; snippet: string; note?: string }
> = {
  claude: {
    label: "Claude Code",
    where: "Run this anywhere — it writes the config for you.",
    lang: "bash",
    snippet: "claude mcp add glyphforge -- npx -y glyphforge-mcp",
    note: "Add --scope project to commit it with the repo so your whole team gets it.",
  },
  cursor: {
    label: "Cursor",
    where: ".cursor/mcp.json in the project, or ~/.cursor/mcp.json for every project",
    lang: "json",
    snippet: `{
  "mcpServers": {
    "glyphforge": {
      "command": "npx",
      "args": ["-y", "glyphforge-mcp"]
    }
  }
}`,
  },
  codex: {
    label: "Codex",
    where: "~/.codex/config.toml",
    lang: "toml",
    snippet: `[mcp_servers.glyphforge]
command = "npx"
args = ["-y", "glyphforge-mcp"]`,
  },
  other: {
    label: "Anything else",
    where: "Most clients take the same shape — stdio, a command and its arguments.",
    lang: "json",
    snippet: `{
  "mcpServers": {
    "glyphforge": {
      "command": "npx",
      "args": ["-y", "glyphforge-mcp"]
    }
  }
}`,
    note: "Windsurf, Zed and VS Code all read a config of this shape. There is no API key and nothing to configure.",
  },
}

const TOOLS: Array<[string, string]> = [
  ["glyphforge_get_started", "Learns the library — the agent calls this first"],
  ["glyphforge_get_docs", "Twenty topics: the forges, post-effects, placement, troubleshooting"],
  ["glyphforge_list_presets", "The seven looks and their exact prop values"],
  ["glyphforge_recommend_setup", "Picks a preset, model and layout for a described site"],
  ["glyphforge_inspect_project", "Reads your repo and recommends from what is actually there"],
  ["glyphforge_generate_component", "Turns a config into paste-ready TSX"],
  ["glyphforge_search_models", "Searches five catalogues, ~46,800 models"],
  ["glyphforge_get_model_import", "Resolves a result to a loadable .glb URL"],
]

const ASKS = [
  "Add a Glyphforge hero to this site.",
  "What preset suits a security product on a dark page?",
  "Find an animated flamingo and put it in the hero.",
  "This renders a black box on our white page — fix it.",
]

const PEERS_19 = "npm i glyphforge three @react-three/fiber@^9 @react-three/postprocessing@^3 postprocessing"
const PEERS_18 = "npm i glyphforge three @react-three/fiber@^8 @react-three/postprocessing@^2 postprocessing"

const FIRST_COMPONENT = `"use client"

import { GlyphHero } from "glyphforge"

export function AsciiHero() {
  return (
    <GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix">
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 4.5rem)", margin: 0 }}>
        Ship a hero people screenshot.
      </h1>
    </GlyphHero>
  )
}`

const ANCHORS: Array<[string, string]> = [
  ["#agent", "Agent"],
  ["#package", "Package"],
  ["#cli", "CLI"],
  ["#eject", "Eject"],
  ["#trouble", "Trouble"],
]

export default function SetupPage() {
  const [client, setClient] = useState<ClientId>("claude")
  const active = MCP_CLIENTS[client]

  return (
    <main className="min-h-dvh bg-ink">
      <SiteNav />

      <header className="border-b border-rule px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="label">Setup</p>
          <h1 className="display mt-5 max-w-3xl text-[2.6rem] leading-[0.95] text-bone sm:text-[4rem]">
            Four ways in.
            <br />
            <span className="text-muted">Pick how much you want to do yourself.</span>
          </h1>
          <p className="mt-7 max-w-xl font-mono text-[12px] leading-relaxed text-bone-dim">
            Every route ends at the same component. The difference is who makes the decisions —
            your agent, the CLI, or you.
          </p>

          <nav className="mt-9 flex flex-wrap gap-2">
            {ANCHORS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-[var(--radius-pill)] border border-rule px-4 py-2 font-mono text-[11px] text-bone-dim transition-colors hover:border-rule-bright hover:text-bone"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* -- Prerequisites ------------------------------------------------- */}

      <Guide n="00" title="Before anything else" id="prereq">
        <p className="max-w-2xl font-mono text-[12px] leading-relaxed text-bone-dim">
          Glyphforge does not bundle the renderer — <Mono>three</Mono>, React Three Fiber and
          postprocessing are peer dependencies your app supplies. The one thing worth getting right
          up front is the pairing, because Fiber&apos;s major tracks React&apos;s.
        </p>

        <div className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-rule">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th className="px-4 py-3 font-normal">Your React</th>
                <th className="px-4 py-3 font-normal">@react-three/fiber</th>
                <th className="px-4 py-3 font-normal">@react-three/postprocessing</th>
              </tr>
            </thead>
            <tbody className="text-bone-dim">
              <tr className="border-b border-rule">
                <td className="px-4 py-3 text-bone">19</td>
                <td className="px-4 py-3">^9</td>
                <td className="px-4 py-3">^3</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-bone">18</td>
                <td className="px-4 py-3">^8</td>
                <td className="px-4 py-3">^2</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-muted">
          Install unpinned and npm resolves Fiber 9, which fails at runtime on a React 18 app. If
          you take the agent route below, it reads your <Mono>package.json</Mono> and pins these for
          you.
        </p>
      </Guide>

      {/* -- Agent / MCP ---------------------------------------------------- */}

      <Guide n="01" title="Let your agent wire it up" id="agent">
        <p className="max-w-2xl font-mono text-[12px] leading-relaxed text-bone-dim">
          Glyphforge ships an MCP server, so Claude Code, Cursor or Codex can read your project and
          make the calls a person would otherwise have to make — which preset suits the site, where
          the hero belongs on the page, whether a word or a real 3D model is the right subject.
          It is the only route that looks at your code first.
        </p>

        <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div>
            <Segmented
              label="Your editor"
              value={client}
              options={(Object.keys(MCP_CLIENTS) as ClientId[]).map((id) => ({
                value: id,
                label: MCP_CLIENTS[id].label,
              }))}
              onChange={setClient}
            />
            <p className="mt-5 font-mono text-[11px] leading-relaxed text-muted">{active.where}</p>
            {active.note && (
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">{active.note}</p>
            )}
          </div>

          <CodeBlock code={active.snippet} lang={active.lang} />
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-mono text-[12px] text-bone">Then just ask</h3>
            <ul className="mt-4 space-y-2.5">
              {ASKS.map((ask) => (
                <li key={ask} className="flex gap-3 font-mono text-[11px] leading-relaxed text-bone-dim">
                  <span className="text-muted">├</span>
                  <span>&ldquo;{ask}&rdquo;</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-mono text-[11px] leading-relaxed text-muted">
              Ask for a model it cannot download — anything on Sketchfab — and it hands you the
              link to grab it yourself rather than pretending.
            </p>
          </div>

          <div>
            <h3 className="font-mono text-[12px] text-bone">What it can do</h3>
            <dl className="mt-4 space-y-3">
              {TOOLS.map(([name, what]) => (
                <div key={name} className="border-b border-rule pb-3 last:border-0">
                  <dt className="font-mono text-[11px] text-bone-dim">{name}</dt>
                  <dd className="mt-1 font-mono text-[11px] leading-relaxed text-muted">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Guide>

      {/* -- Package -------------------------------------------------------- */}

      <Guide n="02" title="Install the package" id="package">
        <Step n={1} title="Install it and its peers">
          <p className="mb-4 font-mono text-[11px] leading-relaxed text-muted">
            Pick the line that matches your React major.
          </p>
          <Command label="React 19" command={PEERS_19} />
          <div className="mt-3">
            <Command label="React 18" command={PEERS_18} />
          </div>
        </Step>

        <Step n={2} title="Write the component">
          <CodeBlock code={FIRST_COMPONENT} lang="tsx" />
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-muted">
            No model of your own needed — <Mono>type: &quot;text&quot;</Mono> extrudes real geometry
            from any font the browser can render. Drop <Mono>model</Mono> entirely and you get a
            forged torus knot.
          </p>
        </Step>

        <Step n={3} title="Mind your framework">
          <ul className="space-y-3 font-mono text-[11px] leading-relaxed text-bone-dim">
            <li>
              <span className="text-bone">Next, App Router</span> — the file importing it needs{" "}
              <Mono>&quot;use client&quot;</Mono> at the top. The components already carry it; the
              page holding them has to as well.
            </li>
            <li>
              <span className="text-bone">Next, Pages Router</span> — import it through{" "}
              <Mono>dynamic(..., {"{ ssr: false }"})</Mono> if you hit a{" "}
              <Mono>window is not defined</Mono> error.
            </li>
            <li>
              <span className="text-bone">Vite / CRA</span> — nothing special, it just works.
            </li>
            <li>
              <span className="text-bone">Astro</span> — wrap it in a React island with{" "}
              <Mono>client:only=&quot;react&quot;</Mono>. It must not be server-rendered.
            </li>
          </ul>
        </Step>

        <Step n={4} title="Give it height" last>
          <p className="font-mono text-[11px] leading-relaxed text-bone-dim">
            The canvas fills its container, so a parent with no height renders nothing at all. That
            is the single most common first-run problem.{" "}
            <Mono>&lt;GlyphHero&gt;</Mono> sets its own height; the bare{" "}
            <Mono>&lt;GlyphCanvas&gt;</Mono> takes whatever you give it.
          </p>
        </Step>
      </Guide>

      {/* -- CLI ------------------------------------------------------------ */}

      <Guide n="03" title="Let the CLI scaffold it" id="cli">
        <p className="max-w-2xl font-mono text-[12px] leading-relaxed text-bone-dim">
          One command. It detects Next or Vite, installs the peers at the right majors, and writes a
          working component you can run immediately.
        </p>
        <div className="mt-7 max-w-2xl">
          <Command command="npx glyphforge init --yes" />
        </div>
        <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-muted">
          Drop <Mono>--yes</Mono> to be asked before anything is installed.
        </p>
      </Guide>

      {/* -- Eject ---------------------------------------------------------- */}

      <Guide n="04" title="Own the source" id="eject">
        <p className="max-w-2xl font-mono text-[12px] leading-relaxed text-bone-dim">
          Copies the real component source into your repo — the same trade shadcn/ui makes. No
          runtime dependency on the package, and you can edit the shader itself.
        </p>
        <div className="mt-7 max-w-2xl">
          <Command command="npx glyphforge add hero" />
        </div>
        <div className="mt-3 max-w-2xl">
          <Command command="npx glyphforge list" />
        </div>
        <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-muted">
          Worth knowing the trade: once ejected, the package is no longer the source of truth for
          that component and future fixes will not reach it.
        </p>
      </Guide>

      {/* -- Troubleshooting ------------------------------------------------ */}

      <Guide n="05" title="When it does not work" id="trouble">
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          <Problem symptom="Nothing renders — a blank rectangle">
            The parent has no height. The canvas fills its container, so give it an explicit one. In
            Next App Router, also check the importing file has <Mono>&quot;use client&quot;</Mono>.
          </Problem>
          <Problem symptom="Cannot find module 'three'">
            The peer dependencies are not installed. See the table at the top — and check the Fiber
            major matches your React major.
          </Problem>
          <Problem symptom="window is not defined">
            It is being server-rendered. Import it with{" "}
            <Mono>dynamic(..., {"{ ssr: false }"})</Mono>, or move it into a client component.
          </Problem>
          <Problem symptom="A black box on our light page">
            A dark-ground preset on white. Use <Mono>preset=&quot;paper&quot;</Mono>, or set{" "}
            <Mono>backgroundColor</Mono> with a dark <Mono>tint</Mono>.
          </Problem>
          <Problem symptom="Text comes out as blobs with no holes">
            Usually a webfont that had not loaded when the forge ran, so the browser fell back. Wait
            for the font. Thin weights also lose their counters at ASCII resolution — go heavier.
          </Problem>
          <Problem symptom="The page will not scroll over the canvas">
            <Mono>controls.zoom</Mono> is on and capturing the wheel. Turn it off in a hero; it is
            meant for editors and viewers.
          </Problem>
        </div>

        <p className="mt-12 max-w-2xl font-mono text-[11px] leading-relaxed text-muted">
          Still stuck? The agent route knows all of this — ask it, or{" "}
          <a
            href="https://github.com/Meet-1010/glyphforge/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bone-dim underline underline-offset-2 transition-colors hover:text-bone"
          >
            open an issue
          </a>
          .
        </p>
      </Guide>

      <footer className="border-t border-rule px-5 py-14 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <p className="font-mono text-[11px] text-muted">
            Rather tune it by feel than by prop?
          </p>
          <Link
            href="/studio"
            className="rounded-[var(--radius-pill)] bg-bone px-5 py-3 font-mono text-[12px] text-ink transition-colors hover:bg-bone-dim"
          >
            Open the Studio
          </Link>
        </div>
      </footer>
    </main>
  )
}

/* -- Local building blocks --------------------------------------------- */

function Guide({
  n,
  title,
  id,
  children,
}: {
  n: string
  title: string
  id: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-rule px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="mb-9 flex items-baseline gap-5">
          <span className="font-mono text-[11px] text-muted">{n}</span>
          <h2 className="display max-w-3xl text-[1.9rem] leading-[0.95] text-bone sm:text-[2.6rem]">
            {title}
          </h2>
        </header>
        {children}
      </div>
    </section>
  )
}

/** A numbered step, with the connecting rule dropped on the last one. */
function Step({
  n,
  title,
  children,
  last = false,
}: {
  n: number
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-7">
      <div className="flex sm:flex-col sm:items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-rule-bright font-mono text-[11px] text-bone">
          {n}
        </span>
        {!last && (
          // `flex-1`, not `w-full`: beside the badge in a flex row, a full-width
          // rule adds 100% on top of the badge and blows the page open sideways.
          <span className="ml-4 min-w-0 flex-1 border-t border-rule sm:ml-0 sm:mt-2 sm:h-full sm:w-px sm:flex-none sm:border-l sm:border-t-0" />
        )}
      </div>
      <div className={`min-w-0 ${last ? "pb-0" : "pb-10"}`}>
        <h3 className="mb-4 font-mono text-[12px] text-bone">{title}</h3>
        {children}
      </div>
    </div>
  )
}

/** A one-line shell command with a copy button, matching the landing page. */
function Command({ command, label }: { command: string; label?: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-full min-w-0">
        {label && <div className="mb-1.5 font-mono text-[10px] text-muted">{label}</div>}
        <code className="block w-full overflow-x-auto whitespace-nowrap rounded-[var(--radius-sm)] border border-rule bg-ink-2 px-3 py-2.5 font-mono text-[11px] text-bone-dim">
          {command}
        </code>
      </div>
      <div className={label ? "pt-[22px]" : ""}>
        <CopyButton text={command} />
      </div>
    </div>
  )
}

/** A multi-line block — config or component source. */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-ink-2">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{lang}</span>
        <CopyButton text={code} variant="ghost" />
      </div>
      <pre className="overflow-x-auto px-4 py-4">
        <code className="font-mono text-[11px] leading-relaxed text-bone-dim">{code}</code>
      </pre>
    </div>
  )
}

function Problem({ symptom, children }: { symptom: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-mono text-[11px] text-bone">{symptom}</h3>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[11px] text-bone-dim">{children}</code>
}
