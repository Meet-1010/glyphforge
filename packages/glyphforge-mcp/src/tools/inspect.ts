/**
 * Looking at the project the agent is actually in, and recommending from that.
 *
 * Read-only. It reports what is installed, what the page's ground colour looks
 * like, and where the hero probably lives — then, when given a description,
 * runs the recommendation against those findings instead of against a guess.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { inspectProject, type ProjectReport } from "../inspect.js"
import { recommend, TONES, PLACEMENTS, PERFORMANCE } from "../recommend.js"
import { ResponseFormat, reply, fail, describeError, definitionList, codeBlock } from "../format.js"

/**
 * The most-used colour that isn't a neutral.
 *
 * Sites are mostly greys, so the frequency winner is almost always the
 * background. The first saturated colour down the list is the brand one.
 */
function pickBrandColor(palette: string[]): string | null {
  for (const hex of palette) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === 0) continue
    const saturation = (max - min) / max
    const lightness = max / 255
    if (saturation > 0.25 && lightness > 0.2 && lightness < 0.98) return hex
  }
  return null
}

function frameworkLabel(framework: ProjectReport["framework"]): string {
  return {
    "next-app": "Next.js (App Router)",
    "next-pages": "Next.js (Pages Router)",
    "vite-react": "Vite + React",
    remix: "Remix",
    astro: "Astro",
    "create-react-app": "Create React App",
    "react-unknown": "React (framework not recognised)",
    "not-react": "not a React project",
  }[framework]
}

export function registerInspectTool(server: McpServer): void {
  server.registerTool(
    "glyphforge_inspect_project",
    {
      title: "Inspect a project for Glyphforge",
      description: `Read a project on disk and report what adding a Glyphforge hero to it would take — then, if you describe the site, recommend one grounded in what is actually there.

Read-only: it opens \`package.json\` and stylesheets and lists file names. It never writes, and it stays inside the directory you give it. \`node_modules\`, \`.git\` and build output are skipped, and the walk is capped, so this is safe to run on a large repo.

What it finds:
  - Framework and router style — App Router vs Pages Router matters, because the importing file needs \`"use client"\`
  - Which peer dependencies are installed, which are missing, and the exact install command
  - Version conflicts — React 19 with fiber 8, or a fiber/postprocessing major mismatch
  - Whether the page's ground is light or dark, read from \`body\` background and \`color-scheme\`
  - The project's palette, frequency-ranked, and a likely brand colour
  - Candidate files to paste the hero into

Args:
  - project_path (string): Absolute path to the project root — the directory holding package.json. Required.
  - site_description (string): What the site is. Pass it to get a full recommendation alongside the findings.
  - subject (string): What should be in the hero.
  - tone / placement / performance: Same as glyphforge_recommend_setup; all optional.
  - response_format ('markdown' | 'json')

Returns:
  {
    "project": {
      "root": string, "package_name": string, "framework": string,
      "framework_evidence": string[], "typescript": boolean, "tailwind": boolean,
      "react_version": string, "glyphforge_installed": boolean,
      "installed_peers": object, "missing_peers": string[],
      "install_command": string | null, "version_warnings": string[],
      "hero_candidates": string[], "palette": string[],
      "ground": "dark" | "light" | "unknown", "ground_evidence": string[],
      "notes": string[]
    },
    "recommendation": object | null   // same shape as glyphforge_recommend_setup, when site_description was given
  }

Examples:
  - Use when: "add an ASCII hero to my site" and you have the repo open — call this first
  - Use when: the component renders nothing and you want to check the peer dependency versions
  - Don't use when: you have no project on disk (use glyphforge_recommend_setup)

Error Handling:
  - A path that doesn't exist, or isn't a directory, says so and asks for the project root.`,
      inputSchema: {
        project_path: z
          .string()
          .min(1)
          .describe("Absolute path to the project root (the directory with package.json)"),
        site_description: z
          .string()
          .max(1000)
          .optional()
          .describe("What the site is — pass it to get a recommendation too"),
        subject: z.string().max(120).optional().describe("What should be in the hero"),
        tone: z.enum(TONES).optional(),
        placement: z.enum(PLACEMENTS).optional(),
        performance: z.enum(PERFORMANCE).optional(),
        response_format: ResponseFormat,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      let report: ProjectReport
      try {
        report = await inspectProject(params.project_path)
      } catch (error) {
        return fail(
          describeError(error) + ".",
          "Pass an absolute path to the directory that holds package.json.",
        )
      }

      const brandColor = pickBrandColor(report.palette)

      const recommendation = params.site_description
        ? recommend({
            site_description: params.site_description,
            subject: params.subject,
            tone: params.tone,
            placement: params.placement,
            performance: params.performance,
            background: report.groundGuess === "unknown" ? undefined : report.groundGuess,
            brand_color: brandColor ?? undefined,
          })
        : null

      const project = {
        root: report.root,
        package_name: report.packageName ?? null,
        framework: report.framework,
        framework_evidence: report.frameworkEvidence,
        typescript: report.typescript,
        tailwind: report.tailwind,
        react_version: report.reactVersion ?? null,
        glyphforge_installed: report.glyphforgeInstalled,
        installed_peers: report.installedPeers,
        missing_peers: report.missingPeers,
        install_command: report.installCommand,
        version_warnings: report.versionWarnings,
        hero_candidates: report.heroCandidates,
        palette: report.palette,
        brand_color: brandColor,
        ground: report.groundGuess,
        ground_evidence: report.groundEvidence,
        notes: report.notes,
      }

      const structured = {
        project,
        recommendation: recommendation
          ? {
              preset: recommendation.preset,
              placement: recommendation.placement,
              component: recommendation.component,
              model: recommendation.model as unknown as Record<string, unknown>,
              config: recommendation.config as unknown as Record<string, unknown>,
              code: recommendation.code,
              container: recommendation.containerHint,
              rationale: recommendation.rationale,
              guidance: recommendation.guidance,
              warnings: recommendation.warnings,
              next_steps: recommendation.nextSteps,
            }
          : null,
      }

      const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n")

      const markdown = [
        `# ${report.packageName ?? report.root}`,
        "",
        definitionList([
          ["Framework", `${frameworkLabel(report.framework)} — ${report.frameworkEvidence.join("; ")}`],
          ["React", report.reactVersion ?? "not found"],
          ["TypeScript", report.typescript ? "yes" : "no"],
          ["Tailwind", report.tailwind ? "yes" : "no"],
          ["Glyphforge", report.glyphforgeInstalled ? "installed" : "not installed"],
          [
            "Peers installed",
            Object.entries(report.installedPeers)
              .map(([name, version]) => `\`${name}@${version}\``)
              .join(", ") || "none",
          ],
          ["Ground", `${report.groundGuess}${report.groundEvidence.length > 0 ? ` — ${report.groundEvidence[0]}` : ""}`],
          ["Palette", report.palette.map((hex) => `\`${hex}\``).join(" ") || "none found"],
          ["Brand colour", brandColor ? `\`${brandColor}\`` : "no saturated colour found"],
        ]),
        "",
        ...(report.installCommand
          ? ["## Install", "", "```bash", report.installCommand, "```", ""]
          : ["## Install", "", "Everything Glyphforge needs is already installed.", ""]),
        ...(report.versionWarnings.length > 0
          ? ["## Version conflicts", "", list(report.versionWarnings), ""]
          : []),
        ...(report.heroCandidates.length > 0
          ? ["## Where the hero probably goes", "", list(report.heroCandidates.map((f) => `\`${f}\``)), ""]
          : []),
        ...(report.notes.length > 0 ? ["## Notes", "", list(report.notes), ""] : []),
        ...(recommendation
          ? [
              "---",
              "",
              `# Recommended: \`${recommendation.preset}\`, ${recommendation.placement.replace("-", " ")}`,
              "",
              "## Why",
              "",
              list(recommendation.rationale),
              "",
              ...(recommendation.warnings.length > 0
                ? ["## Watch out", "", list(recommendation.warnings), ""]
                : []),
              "## Placement",
              "",
              recommendation.containerHint,
              "",
              list(recommendation.guidance),
              "",
              "## The component",
              "",
              codeBlock(recommendation.code),
              "",
              "## Next",
              "",
              list(recommendation.nextSteps),
            ]
          : [
              "---",
              "",
              "_Pass `site_description` to get a preset, a model and a layout recommended for this project._",
            ]),
      ].join("\n")

      return reply(markdown, structured, params.response_format)
    },
  )
}
