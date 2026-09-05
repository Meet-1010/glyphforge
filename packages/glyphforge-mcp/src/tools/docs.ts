/**
 * Teaching tools: what Glyphforge is, how it works, and what the looks are.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { PRESETS, PRESET_NAMES } from "glyphforge/presets"
import { TOPICS, TOPIC_NAMES, type TopicName } from "../knowledge.js"
import { REPO_URL, STUDIO_URL } from "../constants.js"
import { ResponseFormat, reply, definitionList } from "../format.js"

/** When to reach for each preset. Pairs with the real values in `PRESETS`. */
const PRESET_GUIDE: Record<string, { look: string; reachFor: string }> = {
  terminal: {
    look: "Violet glyphs, punchy contrast, no effects",
    reachFor: "The default. Developer tools, SaaS, anything that should read as clean rather than styled",
  },
  matrix: {
    look: "Green phosphor katakana, scanlines, curvature, grain",
    reachFor: "Security, infra, hacker-adjacent — anything wanting a CRT in a server room",
  },
  blueprint: {
    look: "Cyan dots on near-black, flat shading, vignette",
    reachFor: "Technical and diagrammatic work — data, engineering, hardware. The most legible of the set",
  },
  brutalist: {
    look: "Solid white block glyphs at cell size 12",
    reachFor: "Bold editorial and agency sites. Reads almost like a low-res render",
  },
  glitch: {
    look: "Red, chromatic aberration, tearing, jitter, 30fps lock",
    reachFor: "Music, gaming, events, launches. Loud on purpose",
  },
  chromatic: {
    look: "The model's own scene colour, shade ramp, vignette",
    reachFor: "When the model's material colour should survive instead of a flat tint",
  },
  paper: {
    look: "Black glyphs on warm white (#F5F3EE)",
    reachFor: "Light pages. The only preset built for a light background",
  },
}

export function registerDocsTools(server: McpServer): void {
  server.registerTool(
    "glyphforge_get_started",
    {
      title: "Learn Glyphforge",
      description: `Start here. Explains what Glyphforge is, how to install it, the shape of the API, and which of the other tools to reach for next.

Call this once before working with Glyphforge for the first time in a session. It is self-contained — no network, no arguments beyond the output format.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "overview": string,        // what the library is and the problem it solves
    "install": string,         // install command and peer dependency table
    "quickstart": string,      // the smallest working component
    "topics": string[],        // every topic glyphforge_get_docs accepts
    "tools": [ { "name": string, "use_when": string } ],
    "repo": string,
    "studio": string
  }

Examples:
  - Use when: the user mentions Glyphforge, an ASCII hero, or you find \`glyphforge\` in their package.json
  - Use when: you need the peer dependency list before installing
  - Don't use when: you want a specific look recommended for a specific site (use glyphforge_recommend_setup)`,
      inputSchema: { response_format: ResponseFormat },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ response_format }) => {
      const tools = [
        {
          name: "glyphforge_recommend_setup",
          use_when: "You know what the site is and need a specific preset, model and layout chosen for it",
        },
        {
          name: "glyphforge_inspect_project",
          use_when: "You have the project on disk and want the recommendation grounded in what is actually installed",
        },
        {
          name: "glyphforge_generate_component",
          use_when: "You already know the config and want paste-ready code",
        },
        {
          name: "glyphforge_search_models",
          use_when: "The hero needs a real 3D object rather than text or a forged shape",
        },
        {
          name: "glyphforge_get_model_import",
          use_when: "You picked a search result and need its loadable URL or download page",
        },
        {
          name: "glyphforge_get_docs",
          use_when: "You need depth on one area — the forge, post-effects, performance, placement, troubleshooting",
        },
        {
          name: "glyphforge_list_presets",
          use_when: "You want the exact prop values behind each built-in look",
        },
      ]

      const structured = {
        overview: TOPICS.overview.body,
        install: TOPICS.install.body,
        quickstart: `import { GlyphHero } from "glyphforge"\n\n<GlyphHero model={{ type: "text", value: "SHIP IT" }} preset="matrix" />`,
        topics: TOPIC_NAMES,
        tools,
        repo: REPO_URL,
        studio: STUDIO_URL,
      }

      const markdown = `# Glyphforge

${TOPICS.overview.body}

---

## ${TOPICS.install.title}

${TOPICS.install.body}

---

## Where to go next

${tools.map((tool) => `- **\`${tool.name}\`** — ${tool.use_when}`).join("\n")}

Topics available from \`glyphforge_get_docs\`: ${TOPIC_NAMES.map((t) => `\`${t}\``).join(", ")}.

Repository: ${REPO_URL}`

      return reply(markdown, structured, response_format)
    },
  )

  server.registerTool(
    "glyphforge_get_docs",
    {
      title: "Glyphforge documentation by topic",
      description: `Return the Glyphforge documentation for one topic. Use this instead of guessing at prop names or behaviour.

Topics:
  - overview, install, api — what it is, how to install, every prop with defaults
  - presets, ramps — the seven looks and the eight glyph ramps
  - model-sources — the five things \`model\` accepts
  - text-forge, image-forge, svg-forge, shapes — each source in depth, with the failure modes
  - postfx, motion, transparency — effects, rotation and controls, compositing over a page
  - performance, accessibility — what costs frame time, what the component handles for you and what it doesn't
  - placement — where an ASCII hero belongs on a page and how to lay it out
  - assets — the five model catalogues and their licences
  - cli, studio — the scaffolding CLI and the companion web app
  - troubleshooting — the failures people actually hit, and their causes

Args:
  - topic (string): One of the topic names above. Required.
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  { "topic": string, "title": string, "summary": string, "body": string, "related": string[] }

Examples:
  - Use when: "why is my SVG rendering empty" -> topic="svg-forge" or "troubleshooting"
  - Use when: you are about to set postfx props -> topic="postfx"
  - Don't use when: you want a recommendation for a specific site (use glyphforge_recommend_setup)

Error Handling:
  - An unknown topic returns the list of valid topics rather than failing silently.`,
      inputSchema: {
        topic: z
          .enum(TOPIC_NAMES as [TopicName, ...TopicName[]])
          .describe("Which documentation topic to return"),
        response_format: ResponseFormat,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ topic, response_format }) => {
      const entry = TOPICS[topic]
      const related = TOPIC_NAMES.filter((name) => name !== topic).slice(0, 6)
      const structured = {
        topic,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        related,
      }
      const markdown = `# ${entry.title}\n\n_${entry.summary}_\n\n${entry.body}`
      return reply(markdown, structured, response_format)
    },
  )

  server.registerTool(
    "glyphforge_list_presets",
    {
      title: "List Glyphforge presets",
      description: `List the seven built-in presets with their actual prop values and the situations each one suits.

A preset is only a starting point: every individual prop overrides it, and \`postfx\` merges one level deep rather than replacing wholesale.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "count": number,
    "presets": [
      {
        "name": string,          // e.g. "matrix"
        "look": string,          // one line describing the look
        "reach_for": string,     // when this preset is the right choice
        "characterSet": string,  // the glyph ramp it uses
        "cellSize": number,
        "tint": string | null,   // null for chromatic, which keeps scene colour
        "backgroundColor": string,
        "postfx": object         // the effects it enables
      }
    ]
  }

Examples:
  - Use when: the user asks "what looks are available"
  - Use when: you need the exact postfx values a preset sets before overriding one
  - Don't use when: you want one chosen for a specific site (use glyphforge_recommend_setup)`,
      inputSchema: { response_format: ResponseFormat },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ response_format }) => {
      const presets = PRESET_NAMES.map((name) => {
        const preset = PRESETS[name] as Record<string, unknown>
        const guide = PRESET_GUIDE[name] ?? { look: "", reachFor: "" }
        return {
          name,
          look: guide.look,
          reach_for: guide.reachFor,
          characterSet: String(preset.characterSet ?? "terminal"),
          cellSize: Number(preset.cellSize ?? 9),
          tint: (preset.tint as string | undefined) ?? null,
          backgroundColor: (preset.backgroundColor as string | undefined) ?? "#000000",
          postfx: (preset.postfx as Record<string, unknown> | undefined) ?? {},
        }
      })

      const markdown = [
        "# Glyphforge presets",
        "",
        "A preset is a starting point — every prop still overrides it, and `postfx` merges one level deep.",
        "",
        ...presets.map((preset) =>
          [
            `## \`${preset.name}\``,
            "",
            preset.look,
            "",
            definitionList([
              ["Reach for it when", preset.reach_for],
              ["Ramp", `\`${preset.characterSet}\``],
              ["Cell size", preset.cellSize],
              ["Tint", preset.tint ? `\`${preset.tint}\`` : "none — keeps the model's scene colour"],
              ["Background", `\`${preset.backgroundColor}\``],
              [
                "Effects",
                Object.keys(preset.postfx).length > 0
                  ? Object.entries(preset.postfx)
                      .map(([key, value]) => `\`${key}: ${String(value)}\``)
                      .join(", ")
                  : "none",
              ],
            ]),
            "",
          ].join("\n"),
        ),
      ].join("\n")

      return reply(markdown, { count: presets.length, presets }, response_format)
    },
  )
}
