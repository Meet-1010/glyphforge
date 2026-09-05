/**
 * The recommendation tool — a described site in, a specific setup out.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { recommend, TONES, PLACEMENTS, PERFORMANCE } from "../recommend.js"
import { ResponseFormat, reply, codeBlock } from "../format.js"

export function registerRecommendTool(server: McpServer): void {
  server.registerTool(
    "glyphforge_recommend_setup",
    {
      title: "Recommend a Glyphforge setup",
      description: `Choose a specific Glyphforge hero for a specific site: which preset, which model, which layout, where on the page it belongs, and the paste-ready component.

This is the tool to reach for when someone says "what would suit my site" rather than naming props themselves. Describe the site and it returns a considered answer with the reasoning, the UX caveats that apply to that placement, and code.

The tone is inferred from the description when you don't pass one. A light background overrides the tone-based preset choice, because a dark-ground preset on a light page renders as a black box.

Args:
  - site_description (string): What the site or product is. The more concrete the better — "a CLI for database migrations" beats "a tech company". Required.
  - subject (string): What should be *in* the hero. A short word or two becomes extruded 3D text; something that names an object triggers a model-search suggestion instead.
  - tone ('technical'|'security'|'data'|'corporate'|'editorial'|'minimal'|'brutalist'|'playful'|'luxury'): Override the inferred tone.
  - background (string): 'dark', 'light', or a hex colour like '#0B0B0F'. Drives the preset and the canvas background.
  - placement ('full-hero'|'split-hero'|'section-band'|'page-background'|'card'): Where it goes. Default 'split-hero', the safest for a page that has to convert.
  - brand_color (string): Hex colour, applied as the glyph tint so the section belongs to the site.
  - performance ('high'|'balanced'|'low'): Frame budget. 'low' for mobile-heavy audiences — raises cell size, drops detail, locks the effect clock to 30fps.
  - model_url (string): A .glb you already have, which skips the model recommendation.
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "tone": string,              // the tone used, inferred or given
    "tone_inferred": boolean,
    "preset": string,            // one of the seven presets
    "placement": string,
    "component": "hero" | "canvas",
    "model": object,             // the recommended ModelSource
    "config": object,            // the full resolved config, replayable through glyphforge_generate_component
    "code": string,              // paste-ready TSX
    "install": string,           // npm install command
    "container": string,         // how to wrap it for this placement
    "rationale": string[],       // why each choice was made
    "guidance": string[],        // UX rules that apply to this placement
    "warnings": string[],        // conflicts found in the inputs
    "next_steps": string[]
  }

Examples:
  - Use when: "I run a security startup, dark site, what hero should I use?" -> site_description="security startup", background="dark"
  - Use when: "we sell running shoes, put one in the hero" -> subject="running shoe" (returns a shape plus a model-search next step)
  - Use when: "add an ASCII band halfway down our docs site" -> placement="section-band"
  - Don't use when: you already know the exact props (use glyphforge_generate_component)`,
      inputSchema: {
        site_description: z
          .string()
          .min(3, "Describe the site in at least a few words")
          .max(1000)
          .describe("What the site or product is"),
        subject: z
          .string()
          .max(120)
          .optional()
          .describe("What should be in the hero — a word to extrude, or an object to find a model for"),
        tone: z.enum(TONES).optional().describe("Override the tone inferred from the description"),
        background: z
          .string()
          .max(32)
          .optional()
          .describe("'dark', 'light', or a hex colour like '#0B0B0F'"),
        placement: z
          .enum(PLACEMENTS)
          .optional()
          .describe("Where the canvas goes (default 'split-hero')"),
        brand_color: z.string().max(32).optional().describe("Hex colour for the glyph tint"),
        performance: z
          .enum(PERFORMANCE)
          .optional()
          .describe("Frame budget: 'low' for mobile-heavy audiences (default 'balanced')"),
        model_url: z.string().max(500).optional().describe("A .glb URL you already have"),
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
      const result = recommend({
        site_description: params.site_description,
        subject: params.subject,
        tone: params.tone,
        background: params.background,
        placement: params.placement,
        brand_color: params.brand_color,
        performance: params.performance,
        model_url: params.model_url,
      })

      const structured = {
        tone: result.tone,
        tone_inferred: result.toneInferred,
        preset: result.preset,
        placement: result.placement,
        component: result.component,
        model: result.model as unknown as Record<string, unknown>,
        config: result.config as unknown as Record<string, unknown>,
        code: result.code,
        install: result.install,
        container: result.containerHint,
        rationale: result.rationale,
        guidance: result.guidance,
        warnings: result.warnings,
        next_steps: result.nextSteps,
      }

      const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n")

      const markdown = [
        `# Recommended: \`${result.preset}\`, ${result.placement.replace("-", " ")}`,
        "",
        `Read as **${result.tone}**${result.toneInferred ? " (inferred from the description — pass `tone` to override)" : ""}.`,
        "",
        "## Why",
        "",
        list(result.rationale),
        "",
        ...(result.warnings.length > 0 ? ["## Watch out", "", list(result.warnings), ""] : []),
        "## Placement",
        "",
        result.containerHint,
        "",
        list(result.guidance),
        "",
        "## The component",
        "",
        codeBlock(result.code),
        "",
        "```bash",
        result.install,
        "```",
        "",
        "## Next",
        "",
        list(result.nextSteps),
      ].join("\n")

      return reply(markdown, structured, params.response_format)
    },
  )
}
