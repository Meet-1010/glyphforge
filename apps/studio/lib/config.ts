/**
 * Studio editor state.
 *
 * The interesting half — generating a component, diffing against the preset,
 * encoding a share link — lives in `glyphforge/codegen`, because the MCP server
 * has to produce byte-identical output and two copies would drift. What stays
 * here is the browser-only part: a share URL derived from `window.location`.
 */
export {
  DEFAULT_CONFIG as DEFAULT_STATE,
  generateCode,
  encodeState,
  decodeState,
  isEphemeral,
  type GlyphConfig as StudioState,
  type CodeOptions,
} from "glyphforge/codegen"

import { shareUrl as buildShareUrl, type GlyphConfig } from "glyphforge/codegen"

/** The current page, carrying this look. `null` when the model can't leave the browser. */
export function shareUrl(state: GlyphConfig): string | null {
  if (typeof window === "undefined") return null
  return buildShareUrl(state, `${window.location.origin}${window.location.pathname}`)
}
