/** Shared constants. */

export const SERVER_NAME = "glyphforge-mcp-server"
export const SERVER_VERSION = "0.1.0"

/** Ceiling on any single tool response, so a broad search can't flood the context. */
export const CHARACTER_LIMIT = 25_000

export const REPO_URL = "https://github.com/Meet-1010/glyphforge"
export const STUDIO_URL = "https://glyphforge.dev"

/**
 * Where the Objaverse category index comes from when the server isn't running
 * inside the monorepo. Overridable with GLYPHFORGE_OBJAVERSE_INDEX.
 */
export const OBJAVERSE_INDEX_FALLBACK_URL =
  "https://raw.githubusercontent.com/Meet-1010/glyphforge/main/apps/studio/public/objaverse-index.json"

/** Peer dependencies a host app needs before `glyphforge` will render. */
export const PEER_DEPENDENCIES = [
  "three",
  "@react-three/fiber",
  "@react-three/postprocessing",
  "postprocessing",
] as const
