/**
 * Deterministic code generation — an explicit config in, the component out.
 *
 * Runs the same generator as the Studio's copy button, so what an agent pastes
 * and what the site hands you are byte-identical.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { configFromPreset, generateCode, type GlyphConfig } from "glyphforge/codegen"
import {
  ModelSourceSchema,
  MotionSchema,
  PostFXSchema,
  PRESET_NAMES,
  GLYPH_RAMPS,
  HEX_COLOR,
} from "../schemas.js"
import { ResponseFormat, reply, codeBlock } from "../format.js"

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    "glyphforge_generate_component",
    {
      title: "Generate a Glyphforge component",
      description: `Turn an explicit Glyphforge config into paste-ready TSX.

Only props that differ from the chosen preset are emitted, so the snippet stays short instead of restating the whole preset back at you. This is the same generator behind the Studio's "copy the code" button.

Everything except \`model\` is optional and falls back to the preset's own value.

Args:
  - model (object): The ModelSource. One of:
      { type: "text", value, font?, depth?, bevel?, resolution?, smoothing? }
      { type: "shape", shape, detail?, distortion?, seed? }
      { type: "image", src, mode?, depth?, resolution?, threshold?, double?, tones?, autoContrast?, toneStrength? }
      { type: "svg", src? | markup?, depth?, bevel? }
      { type: "url", src }
    Required.
  - preset ('terminal'|'matrix'|'blueprint'|'brutalist'|'glitch'|'chromatic'|'paper'): default 'terminal'
  - component ('hero' | 'canvas'): \`<GlyphHero>\` with content, or the bare \`<GlyphCanvas />\`. Default 'hero'
  - import_from (string): Import specifier — change it after \`npx glyphforge add\` ejects the source. Default 'glyphforge'
  - cell_size (number): 6-20. Character cell in device px
  - tint (string): Hex colour for every glyph. Pass use_tint=false to keep the model's scene colour
  - use_tint (boolean): default true
  - character_set (string): a named ramp, or 'procedural' to use glyph_style instead
  - glyph_style ('standard'|'dense'|'minimal'|'blocks'): only used when character_set='procedural'
  - invert, color, volume_shading, transparent (boolean)
  - background_color (string): hex, opaque mode only
  - camera_z (number): fixed camera distance; omit for auto-framing
  - postfx (object), motion (object): see glyphforge_get_docs topics 'postfx' and 'motion'
  - material (object): { color?, roughness?, metalness? }
  - response_format ('markdown' | 'json')

Returns:
  {
    "code": string,       // the component, ready to paste
    "install": string,    // npm install command
    "config": object,     // the resolved config, replayable
    "notes": string[]     // anything about this config worth knowing
  }

Examples:
  - Use when: the user picked settings in the Studio and wants them as code
  - Use when: you resolved a model URL and need the component around it
  - Don't use when: you don't know what the look should be yet (use glyphforge_recommend_setup)

Error Handling:
  - An invalid model shape reports which variant failed and what it needed.`,
      inputSchema: {
        model: ModelSourceSchema.describe("What to render"),
        preset: z.enum(PRESET_NAMES).default("terminal").describe("Starting look"),
        component: z.enum(["hero", "canvas"]).default("hero").describe("Full section, or the bare canvas"),
        import_from: z.string().max(200).default("glyphforge").describe("Import specifier"),
        cell_size: z.number().int().min(6).max(20).optional().describe("Character cell in device px"),
        tint: HEX_COLOR.optional().describe("Flat colour for every glyph"),
        use_tint: z.boolean().optional().describe("false keeps the model's own scene colour"),
        character_set: z
          .union([z.enum(GLYPH_RAMPS), z.literal("procedural")])
          .optional()
          .describe("Glyph ramp, or 'procedural'"),
        glyph_style: z
          .enum(["standard", "dense", "minimal", "blocks"])
          .optional()
          .describe("Only used when character_set is 'procedural'"),
        invert: z.boolean().optional(),
        color: z.boolean().optional(),
        volume_shading: z.boolean().optional(),
        transparent: z.boolean().optional().describe("Composite over the page background"),
        background_color: HEX_COLOR.optional(),
        camera_z: z.number().min(0.1).max(100).optional().describe("Fixed camera distance; omit for auto"),
        postfx: PostFXSchema.optional(),
        motion: MotionSchema.optional(),
        material: z
          .object({
            color: HEX_COLOR.optional(),
            roughness: z.number().min(0).max(1).optional(),
            metalness: z.number().min(0).max(1).optional(),
          })
          .strict()
          .optional(),
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
      const notes: string[] = []

      // Seeded from the preset, so anything the caller left alone stays the
      // preset's own value instead of being emitted as an override that undoes it.
      const base = configFromPreset(params.preset, params.model as GlyphConfig["model"])

      const config: GlyphConfig = {
        ...base,
        cellSize: params.cell_size ?? base.cellSize,
        tint: params.tint ?? base.tint,
        useTint: params.use_tint ?? (params.tint !== undefined ? true : base.useTint),
        characterSet: params.character_set ?? base.characterSet,
        glyphStyle: params.glyph_style ?? base.glyphStyle,
        invert: params.invert ?? base.invert,
        color: params.color ?? base.color,
        volumeShading: params.volume_shading ?? base.volumeShading,
        transparent: params.transparent ?? base.transparent,
        backgroundColor: params.background_color ?? base.backgroundColor,
        cameraZ: params.camera_z ?? "auto",
        postfx: { ...base.postfx, ...(params.postfx ?? {}) },
        motion: { ...base.motion, ...(params.motion ?? {}) },
        material: { ...base.material, ...(params.material ?? {}) },
      }

      if (params.character_set === "procedural" && !params.glyph_style) {
        notes.push(
          "`character_set` is 'procedural' with no `glyph_style`, so it falls back to 'standard'. The other styles are 'dense', 'minimal' and 'blocks'.",
        )
      }
      if (config.transparent && config.postfx.mouseGlowEnabled) {
        notes.push(
          "The pointer glow is additive and floods a transparent canvas — that combination is why no preset enables it. Drop `mouseGlowEnabled` or turn `transparent` off.",
        )
      }
      if (config.preset === "paper" && config.transparent) {
        notes.push(
          "`paper` on a transparent canvas relies on the host page being light. On a dark page the black glyphs will disappear.",
        )
      }
      if (config.model.type === "url") {
        notes.push(
          "Check the .glb's file size before shipping — a multi-megabyte model will out-cost the renderer. Embedded animation clips play automatically.",
        )
      }
      if (config.cellSize <= 7) {
        notes.push(
          `Cell size ${config.cellSize} is fine but expensive: cost scales with viewport area over cell size squared. Worth checking on a mid-range phone.`,
        )
      }

      const code = generateCode(config, {
        component: params.component,
        importFrom: params.import_from,
      })
      const install =
        "npm i glyphforge three @react-three/fiber @react-three/postprocessing postprocessing"

      const markdown = [
        `# \`<${params.component === "hero" ? "GlyphHero" : "GlyphCanvas"} />\``,
        "",
        codeBlock(code),
        "",
        "```bash",
        install,
        "```",
        ...(notes.length > 0 ? ["", "## Notes", "", notes.map((n) => `- ${n}`).join("\n")] : []),
      ].join("\n")

      return reply(
        markdown,
        { code, install, config: config as unknown as Record<string, unknown>, notes },
        params.response_format,
      )
    },
  )
}
