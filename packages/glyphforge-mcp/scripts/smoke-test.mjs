#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Starts the built server as a real subprocess and drives it through an actual
 * MCP client, so what is tested is the protocol surface an agent sees rather
 * than the functions behind it.
 *
 *   npm test --workspace=glyphforge-mcp-server
 *   SKIP_NETWORK=1 npm test --workspace=glyphforge-mcp-server
 *
 * The catalogue section talks to the live APIs, because the thing worth knowing
 * is whether Objaverse, Poly Haven and Sketchfab still answer in the shape the
 * parser expects — a mock would pass forever while the real integration rotted.
 * Set SKIP_NETWORK=1 to leave it out.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, "..")
const repoRoot = join(packageRoot, "..", "..")

const SERVER = process.argv[2] ?? join(packageRoot, "dist", "index.js")
// A known-shaped project to inspect: the Studio, which lives in this repo.
const PROJECT = process.argv[3] ?? join(repoRoot, "apps", "studio")
const SKIP_NETWORK = process.env.SKIP_NETWORK === "1"

for (const [path, hint] of [
  [SERVER, "npm run build --workspace=glyphforge-mcp-server"],
  [join(repoRoot, "packages", "glyphforge", "dist", "catalog.js"), "npm run build --workspace=glyphforge"],
]) {
  if (!existsSync(path)) {
    console.error(`Missing ${resolve(path)}\nBuild first:  ${hint}\nOr both:      npm run build:all`)
    process.exit(1)
  }
}

let pass = 0
let fail = 0
const failures = []

function check(name, condition, detail = "") {
  if (condition) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`)
  }
}

function section(title) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`)
}

const transport = new StdioClientTransport({ command: "node", args: [SERVER] })
const client = new Client({ name: "glyphforge-smoke-test", version: "1.0.0" })
await client.connect(transport)

const text = (result) => result.content?.[0]?.text ?? ""
const call = (name, args = {}) => client.callTool({ name, arguments: args })

// -- 1. Handshake -------------------------------------------------------------

section("1. Handshake and tool surface")
const { tools } = await client.listTools()
check("connects over stdio and lists tools", tools.length > 0)
check("exposes 8 tools", tools.length === 8, `got ${tools.length}`)
check("every tool has a substantial description", tools.every((t) => (t.description ?? "").length > 100))
check("every tool declares annotations", tools.every((t) => t.annotations))
check("every tool is read-only", tools.every((t) => t.annotations?.readOnlyHint === true))
check("every name is glyphforge_-prefixed", tools.every((t) => t.name.startsWith("glyphforge_")))

// -- 2. Teaching --------------------------------------------------------------

section("2. Teaching tools")
const started = await call("glyphforge_get_started")
check("get_started returns content", text(started).includes("Glyphforge"))
check("get_started names the other 7 tools", started.structuredContent?.tools?.length === 7)

const topics = started.structuredContent?.topics ?? []
check("get_started advertises topics", topics.length > 0)

// Every advertised topic must actually resolve — a listed topic that 404s is
// worse than one that was never offered.
const unfetchable = []
for (const topic of topics) {
  const result = await call("glyphforge_get_docs", { topic })
  if (result.isError || !(result.structuredContent?.body ?? "").length) unfetchable.push(topic)
}
check("every advertised topic is fetchable", unfetchable.length === 0, unfetchable.join(", "))

// The README states the count; drift between the two is how it went stale before.
const readme = readFileSync(join(packageRoot, "README.md"), "utf8")
const stated = Number(readme.match(/\((\d+) topics\)/)?.[1])
check("the README's topic count matches reality", stated === topics.length, `README says ${stated}, server serves ${topics.length}`)

const docs = await call("glyphforge_get_docs", { topic: "placement" })
check("get_docs('placement') returns the topic", docs.structuredContent?.title === "Placement and UX")
check("get_docs body is substantial", (docs.structuredContent?.body ?? "").length > 1000)

const badTopic = await call("glyphforge_get_docs", { topic: "not-a-topic" })
check("get_docs rejects an unknown topic", badTopic.isError === true)
check("the rejection names the valid topics", text(badTopic).includes("'overview'"))

const presets = await call("glyphforge_list_presets", { response_format: "json" })
const names = (presets.structuredContent?.presets ?? []).map((p) => p.name)
check("list_presets returns 7 presets", presets.structuredContent?.count === 7, `got ${presets.structuredContent?.count}`)
check(
  "presets are the expected 7",
  JSON.stringify(names) === JSON.stringify(["terminal", "matrix", "blueprint", "brutalist", "glitch", "chromatic", "paper"]),
  names.join(","),
)
check("amber is gone", !names.includes("amber"))
check("chromatic carries no tint", presets.structuredContent.presets.find((p) => p.name === "chromatic")?.tint === null)

// -- 3. Recommendation --------------------------------------------------------

section("3. Recommendation logic")
const tech = await call("glyphforge_recommend_setup", {
  site_description: "a CLI for database migrations, open source",
  subject: "MIGRATE",
  background: "dark",
})
check("technical site -> terminal preset", tech.structuredContent?.preset === "terminal", tech.structuredContent?.preset)
check("tone inferred as technical, not data", tech.structuredContent?.tone === "technical", tech.structuredContent?.tone)
check("a short subject becomes extruded text", tech.structuredContent?.model?.type === "text")
check("the subject reaches the model", tech.structuredContent?.model?.value === "MIGRATE")
check("returns rationale", (tech.structuredContent?.rationale ?? []).length >= 2)
check("returns placement guidance", (tech.structuredContent?.guidance ?? []).length >= 2)

const light = await call("glyphforge_recommend_setup", { site_description: "a security startup", background: "light" })
check("a light ground overrides tone -> paper", light.structuredContent?.preset === "paper", light.structuredContent?.preset)
check("the override is explained", (light.structuredContent?.warnings ?? []).length > 0)

const thing = await call("glyphforge_recommend_setup", { site_description: "we sell running shoes", subject: "running shoe" })
check("an object subject falls back to a shape", thing.structuredContent?.model?.type === "shape")
check(
  "an object subject suggests a model search",
  (thing.structuredContent?.next_steps ?? []).some((s) => s.includes("glyphforge_search_models")),
)

const perf = await call("glyphforge_recommend_setup", {
  site_description: "a developer tool",
  performance: "low",
  placement: "card",
})
check("a low budget raises cell size", perf.structuredContent?.config?.cellSize >= 12, `cellSize ${perf.structuredContent?.config?.cellSize}`)
check("a low budget locks the effect clock", perf.structuredContent?.config?.postfx?.targetFPS === 30)

// -- 4. Code generation -------------------------------------------------------

section("4. Code generation")
const matrix = await call("glyphforge_generate_component", { model: { type: "text", value: "SHIP IT" }, preset: "matrix" })
const code = matrix.structuredContent?.code ?? ""
check("generates a component", code.includes("<GlyphHero") && code.includes('preset="matrix"'))
check('emits "use client"', code.startsWith('"use client"'))
// Seeding from the defaults rather than the preset used to emit terminal's
// values as overrides, producing a component that named one preset and
// rendered another.
check("REGRESSION: does not override the preset's ramp", !code.includes("characterSet"), code.match(/characterSet.*/)?.[0] ?? "")
check("REGRESSION: does not override the preset's tint", !code.includes("tint="), code.match(/tint=.*/)?.[0] ?? "")
check("REGRESSION: does not restate the preset's postfx", !code.includes("postfx"), code.match(/postfx.*/)?.[0] ?? "")

const overridden = await call("glyphforge_generate_component", {
  model: { type: "shape", shape: "crystal" },
  preset: "blueprint",
  cell_size: 14,
  component: "canvas",
})
check("explicit overrides are emitted", (overridden.structuredContent?.code ?? "").includes("cellSize={14}"))
check("the requested component is honoured", (overridden.structuredContent?.code ?? "").includes("<GlyphCanvas"))

const badModel = await call("glyphforge_generate_component", { model: { type: "svg" }, preset: "terminal" })
check("rejects an svg model with neither src nor markup", badModel.isError === true)
check("the rejection explains what svg needs", text(badModel).includes("`src`"))

// -- 5. Catalogues ------------------------------------------------------------

if (SKIP_NETWORK) {
  section("5. Model catalogues — SKIPPED (SKIP_NETWORK=1)")
} else {
  section("5. Model catalogues (live network)")
  const search = await call("glyphforge_search_models", { query: "flamingo", animated_only: true, limit: 5 })
  const results = search.structuredContent?.results ?? []
  check("search returns results", results.length > 0, `got ${results.length}`)
  check("every result carries a verbatim licence", results.every((r) => typeof r.license === "string" && r.license.length > 0))
  check(
    "importable results resolve a direct URL",
    results.filter((r) => r.importable && r.provider !== "polyhaven").every((r) => r.model_url?.startsWith("http")),
  )

  const sketchfab = results.filter((r) => r.provider === "sketchfab")
  check("sketchfab results are marked not importable", sketchfab.every((r) => r.importable === false))
  // Their search endpoint returns every viewerUrl with a placeholder slug.
  check(
    "REGRESSION: sketchfab links are not the 'none-' placeholder",
    sketchfab.every((r) => !r.source_url.includes("/3d-models/none-")),
    sketchfab[0]?.source_url ?? "no sketchfab results",
  )
  check("the sketchfab download link surfaces in the markdown", sketchfab.length === 0 || text(search).includes("Download it here"))

  const empty = await call("glyphforge_search_models", { query: "zzzznotarealthing", limit: 3 })
  check("no matches is handled, not thrown", !empty.isError && text(empty).includes("No models matching"))

  const imported = await call("glyphforge_get_model_import", { provider: "threejs", id: "Flamingo.glb" })
  check("get_model_import resolves a real id", imported.structuredContent?.model_url?.endsWith("Flamingo.glb"))
  check("get_model_import returns a usable snippet", (imported.structuredContent?.snippet ?? "").includes('type: "url"'))

  const sf = await call("glyphforge_get_model_import", { provider: "sketchfab", id: "c1516dc3d0ea420b9246334a94e5681e" })
  check("a sketchfab import is not an error", !sf.isError)
  check(
    "a sketchfab import returns a download page, not a file",
    sf.structuredContent?.model_url === null && sf.structuredContent?.download_page?.includes("sketchfab.com/models/"),
  )
  check("a sketchfab import spells out the manual steps", (sf.structuredContent?.instructions ?? []).length >= 4)

  const badId = await call("glyphforge_get_model_import", { provider: "objaverse", id: "deadbeef" })
  check("a bad id errors with a next step", badId.isError && text(badId).includes("glyphforge_search_models"))
}

// -- 6. Inspection ------------------------------------------------------------

section("6. Project inspection")
const inspected = await call("glyphforge_inspect_project", {
  project_path: PROJECT,
  site_description: "a WebGL ASCII component library for React",
})
const project = inspected.structuredContent?.project
check("detects the framework", project?.framework === "next-app", project?.framework)
check("reports evidence for the detection", (project?.framework_evidence ?? []).length > 0)
check("sees that glyphforge is installed", project?.glyphforge_installed === true)
check("reads the palette from the stylesheets", (project?.palette ?? []).length > 0)
check("infers the ground", project?.ground === "dark", project?.ground)
check("finds a hero file", (project?.hero_candidates ?? []).some((f) => f.includes("page.tsx")))
check("flags the App Router 'use client' requirement", (project?.notes ?? []).some((n) => n.includes("use client")))
check("recommends alongside the findings", inspected.structuredContent?.recommendation?.preset != null)

const badPath = await call("glyphforge_inspect_project", { project_path: "/nope/not/here" })
check("a missing path errors with guidance", badPath.isError && text(badPath).includes("package.json"))

await client.close()

console.log(`\n${"=".repeat(52)}`)
console.log(`  ${pass} passed, ${fail} failed`)
if (fail > 0) console.log(`  failures: ${failures.join(", ")}`)
console.log("=".repeat(52))
process.exit(fail > 0 ? 1 : 0)
