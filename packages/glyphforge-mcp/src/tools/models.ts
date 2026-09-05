/**
 * Finding a 3D model, and getting it into the component.
 *
 * Four of the five catalogues can be imported by URL directly. Sketchfab
 * cannot — downloading needs an account — so those results carry the model page
 * link and say plainly what the user has to do there.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  PROVIDERS,
  searchAssets,
  resolveAssetUrl,
  type AssetResult,
  type ProviderId,
} from "glyphforge/catalog"
import { ensureCatalogConfigured } from "../catalog-node.js"
import { ResponseFormat, reply, fail, describeError, codeBlock } from "../format.js"

const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id) as [ProviderId, ...ProviderId[]]

/** Resolving these costs nothing — the URL is built from the id, not fetched. */
const FREE_TO_RESOLVE: ProviderId[] = ["objaverse", "khronos", "threejs"]

interface SerialisedResult {
  id: string
  provider: ProviderId
  name: string
  author?: string
  license: string
  tags: string[]
  animated?: boolean
  polycount?: number
  source_url: string
  importable: boolean
  model_url?: string
  note?: string
}

async function serialise(asset: AssetResult): Promise<SerialisedResult> {
  const base: SerialisedResult = {
    id: asset.id,
    provider: asset.provider,
    name: asset.name,
    ...(asset.author ? { author: asset.author } : {}),
    license: asset.license,
    tags: asset.tags.slice(0, 8),
    ...(asset.animated !== undefined ? { animated: asset.animated } : {}),
    ...(asset.polycount !== undefined ? { polycount: asset.polycount } : {}),
    source_url: asset.sourceUrl,
    importable: asset.importable,
  }

  if (asset.provider === "sketchfab") {
    base.note =
      "Sketchfab downloads need an account. Open source_url, download the glTF, then host the .glb and point `model={{ type: \"url\", src: … }}` at it."
    return base
  }

  if (FREE_TO_RESOLVE.includes(asset.provider)) {
    try {
      base.model_url = await asset.resolveModelUrl()
    } catch {
      base.note = "Could not resolve a direct URL — call glyphforge_get_model_import with this id."
    }
    return base
  }

  base.note = "Call glyphforge_get_model_import with this provider and id for the direct .glb URL."
  return base
}

export function registerModelTools(server: McpServer): void {
  server.registerTool(
    "glyphforge_search_models",
    {
      title: "Search 3D model catalogues",
      description: `Search five open 3D catalogues for a model to put in a Glyphforge hero, and return loadable URLs.

| Catalogue | Size | Licence | Direct import |
| --- | --- | --- | --- |
| objaverse | ~46,200 | Per model, mostly CC-BY | yes |
| polyhaven | 521 | CC0 | yes |
| khronos | 119 | Varies per model | yes |
| threejs | 24 | Per model | yes |
| sketchfab | millions | Per model | **no — manual download** |

Sketchfab is search-only on purpose: downloading needs an OAuth token tied to a real account. Those results come back with the model page URL so the user can download it themselves, and are marked \`importable: false\`.

Licences are reported exactly as each catalogue states them and are never inferred. Several say "varies per model" — open the source URL if the licence matters.

Animated rigs read far better in ASCII than static props do, because the glyph field reorganises every frame. \`animated_only: true\` filters to models a catalogue actually reports as animated (Objaverse publishes no animation flag, so it is excluded by that filter rather than guessed at).

Args:
  - query (string): What to search for, e.g. "flamingo", "sports car", "helmet". Required.
  - providers (string[]): Which catalogues. Default: all five.
  - animated_only (boolean): Only models reported as animated. Default false.
  - limit (number): 1-50 results. Default 20.
  - offset (number): Skip this many, for paging. Default 0.
  - response_format ('markdown' | 'json')

Returns:
  {
    "query": string,
    "total": number,            // matches found before paging
    "count": number,            // returned in this response
    "offset": number,
    "has_more": boolean,
    "next_offset": number,      // present when has_more
    "results": [
      {
        "id": string, "provider": string, "name": string, "author": string,
        "license": string,      // verbatim from the catalogue
        "tags": string[], "animated": boolean, "polycount": number,
        "source_url": string,   // the model's page — for Sketchfab, where to download
        "importable": boolean,
        "model_url": string,    // direct .glb, when resolving it is free
        "note": string          // what to do next when there is no model_url
      }
    ],
    "failed": [ { "provider": string, "message": string } ]
  }

Examples:
  - Use when: "put a flamingo in the hero" -> query="flamingo", animated_only=true
  - Use when: "we sell headphones" -> query="headphones"
  - Don't use when: a word or a forged shape would do (use glyphforge_recommend_setup)

Error Handling:
  - A catalogue that is down is reported in \`failed\` and the others still return.
  - No matches returns a message naming the catalogues searched, not an error.`,
      inputSchema: {
        query: z.string().min(1, "Give something to search for").max(200).describe("What to search for"),
        providers: z
          .array(z.enum(PROVIDER_IDS))
          .min(1)
          .optional()
          .describe("Which catalogues to search (default: all five)"),
        animated_only: z.boolean().default(false).describe("Only models reported as animated"),
        limit: z.number().int().min(1).max(50).default(20).describe("Maximum results"),
        offset: z.number().int().min(0).default(0).describe("Results to skip, for paging"),
        response_format: ResponseFormat,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      ensureCatalogConfigured()
      const providers = (params.providers ?? PROVIDER_IDS) as ProviderId[]

      let outcome
      try {
        outcome = await searchAssets({
          query: params.query,
          providers,
          animatedOnly: params.animated_only,
          // Fetch a page's worth past the offset, then slice.
          limit: params.offset + params.limit,
        })
      } catch (error) {
        return fail(
          `the catalogue search failed: ${describeError(error)}.`,
          "Try a narrower `providers` list — a single catalogue being down should not stop the others.",
        )
      }

      const page = outcome.results.slice(params.offset, params.offset + params.limit)
      const results = await Promise.all(page.map(serialise))
      const hasMore = outcome.total > params.offset + results.length

      const structured = {
        query: params.query,
        total: outcome.total,
        count: results.length,
        offset: params.offset,
        has_more: hasMore,
        ...(hasMore ? { next_offset: params.offset + results.length } : {}),
        results,
        failed: outcome.failed,
      }

      if (results.length === 0) {
        const searched = providers.join(", ")
        const text = `No models matching "${params.query}" in: ${searched}.${
          params.animated_only
            ? " `animated_only` is on, which excludes Objaverse entirely — it publishes no animation flag. Try it off."
            : " Try a broader term, or a single word."
        }`
        return reply(text, structured, params.response_format)
      }

      const markdown = [
        `# "${params.query}" — ${outcome.total} match${outcome.total === 1 ? "" : "es"}`,
        "",
        `Showing ${results.length} from ${params.offset}.`,
        "",
        ...results.map((result) => {
          const lines = [
            `## ${result.name} — \`${result.provider}\``,
            "",
            `- **Licence**: ${result.license}`,
            ...(result.author ? [`- **Author**: ${result.author}`] : []),
            ...(result.animated !== undefined ? [`- **Animated**: ${result.animated ? "yes" : "no"}`] : []),
            ...(result.polycount ? [`- **Polycount**: ${result.polycount.toLocaleString()}`] : []),
            `- **Source**: ${result.source_url}`,
          ]
          if (result.model_url) {
            lines.push("", codeBlock(`model={{ type: "url", src: "${result.model_url}" }}`, "tsx"))
          } else if (result.provider === "sketchfab") {
            lines.push(
              "",
              `**Download it here → ${result.source_url}**`,
              "",
              "Sketchfab needs an account to download, so this one is manual: open that page, hit Download, pick glTF, then host the `.glb` (or upload it in the Studio) and point `model={{ type: \"url\", src: … }}` at it.",
            )
          } else if (result.note) {
            lines.push("", result.note)
          }
          return `${lines.join("\n")}\n`
        }),
        ...(outcome.failed.length > 0
          ? [
              "---",
              "",
              "**Catalogues that failed:**",
              ...outcome.failed.map((f) => `- \`${f.provider}\`: ${f.message}`),
            ]
          : []),
        ...(hasMore ? ["", `_More available — call again with \`offset: ${params.offset + results.length}\`._`] : []),
      ].join("\n")

      return reply(markdown, structured, params.response_format)
    },
  )

  server.registerTool(
    "glyphforge_get_model_import",
    {
      title: "Resolve a model's import URL",
      description: `Turn a catalogue id into a loadable .glb URL and the component that uses it.

Use this after \`glyphforge_search_models\` when a result came back without a \`model_url\` — Poly Haven needs a second request to resolve its glTF variant, and Sketchfab needs a human.

Args:
  - provider ('objaverse'|'polyhaven'|'khronos'|'threejs'|'sketchfab'): Which catalogue the id belongs to. Required.
  - id (string): The result's \`id\`. Required.
  - preset (string): Preset to wrap it in, for the generated snippet. Default 'terminal'.
  - response_format ('markdown' | 'json')

Returns:
  {
    "provider": string,
    "id": string,
    "importable": boolean,
    "model_url": string | null,   // null for Sketchfab
    "download_page": string,      // where a human downloads it, when needed
    "snippet": string,            // the component, when there is a URL
    "instructions": string[]      // what to do next
  }

Examples:
  - Use when: a Poly Haven result looked right and you need its actual file URL
  - Use when: the user picked a Sketchfab model and needs the download link

Error Handling:
  - Sketchfab returns \`importable: false\` with the download page rather than an error — that is the expected path, not a failure.
  - An id that is not in the catalogue says so and suggests re-running the search.`,
      inputSchema: {
        provider: z.enum(PROVIDER_IDS).describe("Which catalogue the id belongs to"),
        id: z.string().min(1).max(200).describe("The result's id"),
        preset: z
          .enum(["terminal", "matrix", "blueprint", "brutalist", "glitch", "chromatic", "paper"])
          .default("terminal")
          .describe("Preset for the generated snippet"),
        response_format: ResponseFormat,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ provider, id, preset, response_format }) => {
      ensureCatalogConfigured()

      if (provider === "sketchfab") {
        const page = `https://sketchfab.com/models/${id}`
        const instructions = [
          `Open ${page}`,
          "Sign in and hit **Download 3D Model** — pick the glTF option (that gives you a `.glb`).",
          "Put the file somewhere the site can serve it — `public/models/…` in most React apps — or upload it in the Glyphforge Studio.",
          'Point the component at it: `model={{ type: "url", src: "/models/your-file.glb" }}`.',
          "Check the licence on that page before shipping it. Sketchfab licences vary per model and are never inferred here.",
        ]
        const structured = {
          provider,
          id,
          importable: false,
          model_url: null,
          download_page: page,
          snippet: "",
          instructions,
        }
        const markdown = [
          `# Sketchfab model \`${id}\``,
          "",
          `**Download it here → ${page}**`,
          "",
          "Sketchfab needs an account to download, so this step is the user's rather than something this server can do for them.",
          "",
          ...instructions.map((step, index) => `${index + 1}. ${step}`),
        ].join("\n")
        return reply(markdown, structured, response_format)
      }

      let url: string
      try {
        url = await resolveAssetUrl(provider, id)
      } catch (error) {
        return fail(
          `could not resolve \`${id}\` from \`${provider}\`: ${describeError(error)}.`,
          "Re-run `glyphforge_search_models` and use the `id` exactly as it came back.",
        )
      }

      const snippet = `<GlyphHero model={{ type: "url", src: "${url}" }} preset="${preset}" />`
      const instructions = [
        "Embedded animation clips play automatically — `motion={{ animation: \"ClipName\" }}` picks one by name.",
        "Check the file size before shipping. A multi-megabyte model will out-cost the renderer by a wide margin.",
        "Hot-linking a catalogue CDN is fine for a prototype; for production, download the file and serve it yourself.",
        ...(provider === "polyhaven"
          ? [
              "This is a multi-file glTF, not a single `.glb`: the loader pulls sibling `.bin` and texture files from the same directory, which works because Poly Haven's CDN is CORS-open. If you self-host it, take the whole directory — the 1k variant is chosen here because the ASCII pass cannot resolve 8k textures anyway.",
            ]
          : []),
      ]

      const structured = {
        provider,
        id,
        importable: true,
        model_url: url,
        download_page: url,
        snippet,
        instructions,
      }

      const markdown = [
        `# \`${id}\` — ${provider}`,
        "",
        `Direct URL: ${url}`,
        "",
        codeBlock(snippet),
        "",
        instructions.map((step) => `- ${step}`).join("\n"),
      ].join("\n")

      return reply(markdown, structured, response_format)
    },
  )
}
