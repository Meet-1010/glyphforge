import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

/**
 * Glyphforge CLI.
 *
 * Zero dependencies on purpose: `npx glyphforge init` should start working
 * immediately rather than resolving a tree first.
 */

const PEER_DEPS = ["three", "@react-three/fiber", "@react-three/postprocessing", "postprocessing"]

const COLORS = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  violet: "\u001b[38;5;141m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
}

const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined
const paint = (color: keyof typeof COLORS, text: string) =>
  supportsColor ? `${COLORS[color]}${text}${COLORS.reset}` : text

const log = (message = "") => console.log(message)
const ok = (message: string) => log(`${paint("green", "+")} ${message}`)
const warn = (message: string) => log(`${paint("yellow", "!")} ${message}`)
const fail = (message: string) => log(`${paint("red", "x")} ${message}`)

/** Source subtrees each `add` target pulls in. */
const BUNDLES: Record<string, { dirs: string[]; files: string[]; description: string }> = {
  hero: {
    description: "Everything: hero + canvas + ASCII effect + model forge",
    dirs: ["components", "effects", "forge", "hooks"],
    files: ["types.ts", "presets.ts", "index.ts"],
  },
  effect: {
    description: "Just the ASCII post-processing effect",
    dirs: ["effects"],
    files: ["types.ts", "presets.ts"],
  },
  forge: {
    description: "Just the in-browser model generators",
    dirs: ["forge"],
    files: ["types.ts"],
  },
}

function packageRoot(): string {
  // dist/cli.cjs -> package root
  return resolve(__dirname, "..")
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

function detectProject(cwd: string) {
  const pkgPath = join(cwd, "package.json")
  const pkg = readJson(pkgPath)
  if (!pkg) return null

  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  }

  const framework = deps.next ? "next" : deps.vite || deps["@vitejs/plugin-react"] ? "vite" : "react"

  let packageManager: "npm" | "pnpm" | "yarn" | "bun" = "npm"
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) packageManager = "pnpm"
  else if (existsSync(join(cwd, "yarn.lock"))) packageManager = "yarn"
  else if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) packageManager = "bun"

  // Where component source conventionally lives in this project.
  const candidates = ["src/components", "components", "app/components", "src"]
  const componentsDir = candidates.find((c) => existsSync(join(cwd, c))) ?? "components"

  return { pkg, deps, framework, packageManager, componentsDir, missing: PEER_DEPS.filter((d) => !deps[d]) }
}

function installCommand(pm: string, packages: string[]) {
  const list = packages.join(" ")
  if (pm === "pnpm") return `pnpm add ${list}`
  if (pm === "yarn") return `yarn add ${list}`
  if (pm === "bun") return `bun add ${list}`
  return `npm install ${list}`
}

function copyTree(from: string, to: string, written: string[]) {
  if (!existsSync(from)) return
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from)) {
    const source = join(from, entry)
    const target = join(to, entry)
    if (statSync(source).isDirectory()) {
      copyTree(source, target, written)
    } else {
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
      written.push(target)
    }
  }
}

function commandAdd(args: string[], cwd: string) {
  const target = args[0] ?? "hero"
  const bundle = BUNDLES[target]

  if (!bundle) {
    fail(`Unknown component "${target}".`)
    log(`\nAvailable:`)
    for (const [name, meta] of Object.entries(BUNDLES)) {
      log(`  ${paint("bold", name.padEnd(8))} ${paint("dim", meta.description)}`)
    }
    process.exitCode = 1
    return
  }

  const project = detectProject(cwd)
  const outDirFlagIndex = args.findIndex((a) => a === "--dir" || a === "-d")
  const outDir =
    outDirFlagIndex >= 0 && args[outDirFlagIndex + 1]
      ? args[outDirFlagIndex + 1]
      : join(project?.componentsDir ?? "components", "glyphforge")

  const src = join(packageRoot(), "src")
  if (!existsSync(src)) {
    fail("Could not find Glyphforge source to copy. Reinstall the package and try again.")
    process.exitCode = 1
    return
  }

  const destination = resolve(cwd, outDir)
  if (existsSync(destination) && readdirSync(destination).length > 0 && !args.includes("--force")) {
    fail(`${outDir} already exists and is not empty. Re-run with --force to overwrite.`)
    process.exitCode = 1
    return
  }

  const written: string[] = []
  for (const dir of bundle.dirs) copyTree(join(src, dir), join(destination, dir), written)
  for (const file of bundle.files) {
    const source = join(src, file)
    if (!existsSync(source)) continue
    mkdirSync(destination, { recursive: true })
    copyFileSync(source, join(destination, file))
    written.push(join(destination, file))
  }

  log()
  ok(`Copied ${written.length} files into ${paint("bold", outDir)}`)
  log(paint("dim", "  This is the real Glyphforge source — edit it freely, it's yours now."))

  if (project && project.missing.length > 0) {
    log()
    warn(`Missing peer dependencies: ${project.missing.join(", ")}`)
    log(`  ${paint("violet", installCommand(project.packageManager, project.missing))}`)
  }

  log()
  log(paint("bold", "Use it:"))
  log(
    paint(
      "dim",
      `  import { GlyphHero } from "${toImportPath(cwd, destination)}"\n\n  <GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix" />`,
    ),
  )
  log()
}

function toImportPath(cwd: string, destination: string) {
  const rel = relative(cwd, destination).split("\\").join("/")
  if (rel.startsWith("src/")) return `@/${rel.slice(4)}`
  return `@/${rel}`
}

const EXAMPLE_COMPONENT = `"use client"

import { GlyphHero } from "glyphforge"

export function AsciiHero() {
  return (
    <GlyphHero
      // Swap this for { type: "url", src: "/models/yours.glb" } to use your own
      // model, or forge one at https://github.com/Meet-1010/glyphforge#studio
      model={{ type: "text", value: "SHIP IT" }}
      preset="matrix"
      height="100vh"
    >
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 4.5rem)", margin: 0, color: "white" }}>
        Your headline goes here
      </h1>
      <p style={{ marginTop: 16, color: "rgba(255,255,255,0.6)" }}>
        Drag to rotate. Hover to speed it up.
      </p>
    </GlyphHero>
  )
}
`

function commandInit(args: string[], cwd: string) {
  const project = detectProject(cwd)

  log()
  log(paint("violet", paint("bold", "  Glyphforge")))
  log(paint("dim", "  ASCII hero sections, one component."))
  log()

  if (!project) {
    fail("No package.json here. Run this inside your project.")
    process.exitCode = 1
    return
  }

  ok(`Detected ${paint("bold", project.framework)} (${project.packageManager})`)

  const needed = [...project.missing]
  if (!project.deps.glyphforge) needed.unshift("glyphforge")

  if (needed.length > 0) {
    const command = installCommand(project.packageManager, needed)
    if (args.includes("--yes") || args.includes("-y")) {
      log(`${paint("dim", "  running:")} ${command}`)
      try {
        execSync(command, { cwd, stdio: "inherit" })
        ok("Dependencies installed")
      } catch {
        fail("Install failed. Run it yourself:")
        log(`  ${paint("violet", command)}`)
        process.exitCode = 1
        return
      }
    } else {
      log()
      warn("Install these first:")
      log(`  ${paint("violet", command)}`)
      log(paint("dim", "  (or re-run with --yes to install automatically)"))
    }
  } else {
    ok("All dependencies present")
  }

  const componentPath = join(cwd, project.componentsDir, "ascii-hero.tsx")
  if (existsSync(componentPath) && !args.includes("--force")) {
    warn(`${relative(cwd, componentPath)} already exists, leaving it alone.`)
  } else {
    mkdirSync(dirname(componentPath), { recursive: true })
    writeFileSync(componentPath, EXAMPLE_COMPONENT)
    ok(`Created ${paint("bold", relative(cwd, componentPath))}`)
  }

  log()
  log(paint("bold", "Next:"))
  log(`  1. Drop ${paint("violet", "<AsciiHero />")} into a page.`)
  if (project.framework === "next") {
    log(paint("dim", "     It's a client component already — no extra directive needed."))
  }
  log(`  2. Forge a model at ${paint("violet", "https://github.com/Meet-1010/glyphforge#studio")} and paste the config back.`)
  log(`  3. Want to own the source? ${paint("violet", "npx glyphforge add hero")}`)
  log()
}

function commandHelp() {
  log()
  log(paint("violet", paint("bold", "  Glyphforge")))
  log(paint("dim", "  Drop-in WebGL ASCII hero sections for React."))
  log()
  log(paint("bold", "  Usage"))
  log("    npx glyphforge <command> [options]")
  log()
  log(paint("bold", "  Commands"))
  log(`    ${"init".padEnd(14)} ${paint("dim", "Install deps and scaffold a hero component")}`)
  log(`    ${"add <name>".padEnd(14)} ${paint("dim", "Copy the source into your project (you own it)")}`)
  log(`    ${"list".padEnd(14)} ${paint("dim", "Show what `add` can copy")}`)
  log()
  log(paint("bold", "  Options"))
  log(`    ${"--yes, -y".padEnd(14)} ${paint("dim", "Run the install for me")}`)
  log(`    ${"--dir, -d".padEnd(14)} ${paint("dim", "Where `add` should write files")}`)
  log(`    ${"--force".padEnd(14)} ${paint("dim", "Overwrite existing files")}`)
  log()
  log(paint("dim", "  Studio: https://github.com/Meet-1010/glyphforge#studio"))
  log()
}

function commandList() {
  log()
  log(paint("bold", "  Available components"))
  for (const [name, meta] of Object.entries(BUNDLES)) {
    log(`    ${paint("violet", name.padEnd(10))} ${paint("dim", meta.description)}`)
  }
  log()
  log(paint("dim", "  npx glyphforge add hero"))
  log()
}

function main() {
  const [, , command, ...args] = process.argv
  const cwd = process.cwd()

  switch (command) {
    case "init":
      return commandInit(args, cwd)
    case "add":
      return commandAdd(args, cwd)
    case "list":
      return commandList()
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return commandHelp()
    default:
      fail(`Unknown command "${command}".`)
      commandHelp()
      process.exitCode = 1
  }
}

main()
