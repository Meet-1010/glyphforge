/**
 * Read-only inspection of the project an agent is working in.
 *
 * The point is to ground a recommendation in what is actually installed and
 * actually rendered, rather than in what the user remembered to mention. It
 * reads; it never writes, and it never leaves the directory it was given.
 */

import { readFile, readdir, stat } from "node:fs/promises"
import { join, resolve, relative, sep } from "node:path"
import { PEER_DEPENDENCIES } from "./constants.js"

/** Directories never worth walking, and expensive to walk by accident. */
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage",
  ".turbo", ".cache", ".vercel", ".svelte-kit", "vendor", "target", ".venv",
])

/** Hard ceiling on the walk, so a monorepo can't turn one call into a minute. */
const MAX_ENTRIES = 4_000
const MAX_DEPTH = 6
const MAX_CSS_BYTES = 200_000

export type Framework =
  | "next-app"
  | "next-pages"
  | "vite-react"
  | "remix"
  | "astro"
  | "create-react-app"
  | "react-unknown"
  | "not-react"

export interface ProjectReport {
  root: string
  packageName?: string
  framework: Framework
  frameworkEvidence: string[]
  typescript: boolean
  tailwind: boolean
  reactVersion?: string
  glyphforgeInstalled: boolean
  installedPeers: Record<string, string>
  missingPeers: string[]
  installCommand: string | null
  versionWarnings: string[]
  heroCandidates: string[]
  palette: string[]
  groundGuess: "dark" | "light" | "unknown"
  groundEvidence: string[]
  notes: string[]
}

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T
  } catch {
    return null
  }
}

/** Breadth-limited walk returning project-relative paths. */
async function walk(root: string): Promise<string[]> {
  const found: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (queue.length > 0 && found.length < MAX_ENTRIES) {
    const next = queue.shift()
    if (!next) break
    const { dir, depth } = next

    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (found.length >= MAX_ENTRIES) break
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue
        if (depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 })
        continue
      }
      if (entry.isFile()) found.push(relative(root, full))
    }
  }

  return found
}

function detectFramework(
  pkg: PackageJson | null,
  files: string[],
): { framework: Framework; evidence: string[] } {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const evidence: string[] = []
  const has = (name: string) => name in deps

  const hasFile = (predicate: (path: string) => boolean) => files.some(predicate)
  const segments = (path: string) => path.split(sep)

  if (has("next")) {
    evidence.push(`\`next\` ${deps.next} in package.json`)
    const appRouter = hasFile((p) => {
      const parts = segments(p)
      const i = parts.indexOf("app")
      return i !== -1 && /^(layout|page)\.(t|j)sx?$/.test(parts[parts.length - 1] ?? "")
    })
    const pagesRouter = hasFile((p) => segments(p)[0] === "pages" || segments(p).includes("pages"))
    if (appRouter) {
      evidence.push("an `app/` directory with `layout`/`page` files")
      return { framework: "next-app", evidence }
    }
    if (pagesRouter) {
      evidence.push("a `pages/` directory")
      return { framework: "next-pages", evidence }
    }
    return { framework: "next-app", evidence: [...evidence, "no router directory found — assuming App Router"] }
  }

  if (has("@remix-run/react") || has("@remix-run/node")) {
    evidence.push("Remix packages in package.json")
    return { framework: "remix", evidence }
  }
  if (has("astro")) {
    evidence.push(`\`astro\` ${deps.astro} in package.json`)
    return { framework: "astro", evidence }
  }
  if (has("react-scripts")) {
    evidence.push("`react-scripts` in package.json")
    return { framework: "create-react-app", evidence }
  }
  if (has("vite") && has("react")) {
    evidence.push(`\`vite\` ${deps.vite} with React`)
    return { framework: "vite-react", evidence }
  }
  if (has("react")) {
    evidence.push("`react` is present but no recognised framework")
    return { framework: "react-unknown", evidence }
  }

  evidence.push("no `react` dependency found")
  return { framework: "not-react", evidence }
}

const HERO_PATTERNS = [
  /^app\/page\.(t|j)sx$/,
  /^src\/app\/page\.(t|j)sx$/,
  /^pages\/index\.(t|j)sx$/,
  /^src\/pages\/index\.(t|j)sx$/,
  /^src\/App\.(t|j)sx$/,
  /^app\/routes\/_index\.(t|j)sx$/,
  /(^|\/)(hero|Hero)\.(t|j)sx$/,
  /(^|\/)components\/(hero|Hero)[^/]*\.(t|j)sx$/,
  /^src\/pages\/index\.astro$/,
]

function findHeroCandidates(files: string[]): string[] {
  const normalised = files.map((f) => f.split(sep).join("/"))
  const hits = normalised.filter((path) => HERO_PATTERNS.some((pattern) => pattern.test(path)))
  return [...new Set(hits)].slice(0, 8)
}

const HEX_PATTERN = /#[0-9a-fA-F]{6}\b/g

/**
 * The palette, read off the project's own stylesheets.
 *
 * Frequency-ranked rather than exhaustive: the colours a site uses most are the
 * ones a hero has to sit inside.
 */
async function readPalette(
  root: string,
  files: string[],
): Promise<{ palette: string[]; ground: "dark" | "light" | "unknown"; evidence: string[] }> {
  const styleFiles = files
    .filter((f) => /\.(css|scss|sass)$/.test(f))
    .sort((a, b) => a.split(sep).length - b.split(sep).length)
    .slice(0, 12)

  const counts = new Map<string, number>()
  const evidence: string[] = []
  let darkSignals = 0
  let lightSignals = 0

  for (const file of styleFiles) {
    let content: string
    try {
      content = (await readFile(join(root, file), "utf8")).slice(0, MAX_CSS_BYTES)
    } catch {
      continue
    }

    for (const match of content.match(HEX_PATTERN) ?? []) {
      const hex = match.toUpperCase()
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }

    // A body/background rule is worth more than a stray colour anywhere else.
    const bodyBackground = content.match(/body\s*\{[^}]*background[^;]*:\s*([^;]+);/)?.[1]
    if (bodyBackground) {
      const value = bodyBackground.trim().toLowerCase()
      const hex = value.match(/#[0-9a-f]{6}/)?.[0]
      if (hex) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        if (lum > 0.5) {
          lightSignals += 2
          evidence.push(`\`body\` background \`${hex}\` in ${file} is light`)
        } else {
          darkSignals += 2
          evidence.push(`\`body\` background \`${hex}\` in ${file} is dark`)
        }
      } else if (value.includes("white") || value.includes("#fff")) {
        lightSignals += 2
        evidence.push(`\`body\` background in ${file} is white`)
      } else if (value.includes("black") || value.includes("#000")) {
        darkSignals += 2
        evidence.push(`\`body\` background in ${file} is black`)
      }
    }

    if (/color-scheme:\s*dark/.test(content)) {
      darkSignals += 1
      evidence.push(`\`color-scheme: dark\` in ${file}`)
    }
    if (/color-scheme:\s*light/.test(content)) {
      lightSignals += 1
      evidence.push(`\`color-scheme: light\` in ${file}`)
    }
  }

  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex)

  let ground: "dark" | "light" | "unknown" =
    darkSignals > lightSignals ? "dark" : lightSignals > darkSignals ? "light" : "unknown"

  // Tailwind v4 sites set their ground through `@theme` tokens and a utility
  // class, so there is no `body { background }` rule to read. The most-used
  // colour in the stylesheet is the next best evidence.
  if (ground === "unknown" && palette.length > 0) {
    const top = palette[0]
    const r = parseInt(top.slice(1, 3), 16)
    const g = parseInt(top.slice(3, 5), 16)
    const b = parseInt(top.slice(5, 7), 16)
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    ground = lum > 0.5 ? "light" : "dark"
    evidence.push(
      `no \`body\` background rule found — inferred from \`${top}\`, the most-used colour in the stylesheets`,
    )
  }

  return { palette, ground, evidence }
}

/**
 * Pin the renderer majors to the installed React.
 *
 * Unpinned, `npm i @react-three/fiber` resolves to the React 19 line, which
 * then fails at runtime on a React 18 app — an install command that breaks the
 * project is worse than no install command.
 */
function pinPeers(peers: string[], reactVersion?: string): string[] {
  const major = reactVersion?.match(/(\d+)/)?.[1]
  if (major !== "18" && major !== "19") return peers
  const pins: Record<string, string> =
    major === "18"
      ? { "@react-three/fiber": "@^8", "@react-three/postprocessing": "@^2" }
      : { "@react-three/fiber": "@^9", "@react-three/postprocessing": "@^3" }
  return peers.map((peer) => `${peer}${pins[peer] ?? ""}`)
}

function checkVersions(peers: Record<string, string>, reactVersion?: string): string[] {
  const warnings: string[] = []
  const major = (range?: string) => {
    if (!range) return null
    const match = range.match(/(\d+)/)
    return match ? Number(match[1]) : null
  }

  const react = major(reactVersion)
  const fiber = major(peers["@react-three/fiber"])
  const post = major(peers["@react-three/postprocessing"])

  if (react === 19 && fiber !== null && fiber < 9) {
    warnings.push(
      `React 19 is installed but \`@react-three/fiber\` is v${fiber}. Fiber 9 is the React 19 line — upgrade with \`npm i @react-three/fiber@^9 @react-three/postprocessing@^3\`.`,
    )
  }
  if (react === 18 && fiber !== null && fiber >= 9) {
    warnings.push(
      `React 18 is installed but \`@react-three/fiber\` is v${fiber}, which targets React 19. Either upgrade React or pin \`@react-three/fiber@^8 @react-three/postprocessing@^2\`.`,
    )
  }
  if (fiber !== null && post !== null) {
    const expected = fiber >= 9 ? 3 : 2
    if (post !== expected) {
      warnings.push(
        `\`@react-three/fiber\` v${fiber} pairs with \`@react-three/postprocessing\` v${expected}, but v${post} is installed.`,
      )
    }
  }
  return warnings
}

export async function inspectProject(inputPath: string): Promise<ProjectReport> {
  const root = resolve(inputPath)

  const rootStat = await stat(root).catch(() => null)
  if (!rootStat) throw new Error(`No such directory: ${root}`)
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${root}`)

  const pkg = await readJson<PackageJson>(join(root, "package.json"))
  const files = await walk(root)
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }

  const { framework, evidence: frameworkEvidence } = detectFramework(pkg, files)

  const installedPeers: Record<string, string> = {}
  for (const peer of PEER_DEPENDENCIES) {
    const version = deps[peer]
    if (version) installedPeers[peer] = version
  }
  const missingPeers = PEER_DEPENDENCIES.filter((peer) => !(peer in installedPeers))
  const glyphforgeInstalled = "glyphforge" in deps

  const toInstall = [
    ...(glyphforgeInstalled ? [] : ["glyphforge"]),
    ...pinPeers(missingPeers, deps.react),
  ]

  const { palette, ground, evidence: groundEvidence } = await readPalette(root, files)

  const notes: string[] = []
  if (!pkg) notes.push("No `package.json` found at this path — is it the project root?")
  if (framework === "not-react") {
    notes.push(
      "No React dependency found. Glyphforge is a React component library, so it needs a React app — or use `glyphforge/forge` to build geometry and render it with plain three.js yourself.",
    )
  }
  if (framework === "next-app") {
    notes.push(
      "App Router: the file importing `GlyphHero`/`GlyphCanvas` needs `\"use client\"` at the top. Both components already carry it, but the importing page must be a client component too.",
    )
  }
  if (framework === "astro") {
    notes.push(
      "Astro: wrap the component in a React island with a `client:only=\"react\"` directive — it must not be server-rendered.",
    )
  }
  if (!("typescript" in deps) && !files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    notes.push("This looks like a JavaScript project — the snippets are TSX; strip the types or rename to `.jsx`.")
  }

  return {
    root,
    packageName: pkg?.name,
    framework,
    frameworkEvidence,
    typescript: "typescript" in deps || files.some((f) => f.endsWith(".tsx")),
    tailwind: "tailwindcss" in deps,
    reactVersion: deps.react,
    glyphforgeInstalled,
    installedPeers,
    missingPeers,
    installCommand: toInstall.length > 0 ? `npm i ${toInstall.join(" ")}` : null,
    versionWarnings: checkVersions(installedPeers, deps.react),
    heroCandidates: findHeroCandidates(files),
    palette,
    groundGuess: ground,
    groundEvidence,
    notes,
  }
}
