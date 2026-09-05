#!/usr/bin/env node
/**
 * Glyphforge MCP server.
 *
 * Connects a coding agent — Claude Code, Cursor, Codex, anything that speaks
 * MCP — to Glyphforge: what the library is and how it works, which hero suits
 * the site the agent is looking at, where on the page it belongs, and where to
 * get a 3D model when a forged shape isn't enough.
 *
 * stdio transport: this runs as a subprocess of the client, so stdout is the
 * JSON-RPC channel and every diagnostic goes to stderr.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SERVER_NAME, SERVER_VERSION, REPO_URL } from "./constants.js"
import { registerDocsTools } from "./tools/docs.js"
import { registerRecommendTool } from "./tools/recommend.js"
import { registerGenerateTool } from "./tools/generate.js"
import { registerModelTools } from "./tools/models.js"
import { registerInspectTool } from "./tools/inspect.js"

const HELP = `
  ${SERVER_NAME} v${SERVER_VERSION}

  An MCP server for Glyphforge — drop-in WebGL ASCII hero sections for React.

  Usage
    glyphforge-mcp                 Run the server over stdio (how a client starts it)
    glyphforge-mcp --help          Show this
    glyphforge-mcp --version       Print the version

  Tools
    glyphforge_get_started         Learn the library — start here
    glyphforge_get_docs            Documentation by topic
    glyphforge_list_presets        The seven looks and their exact prop values
    glyphforge_recommend_setup     Pick a preset, model and layout for a described site
    glyphforge_inspect_project     Read a project on disk and recommend from what's there
    glyphforge_generate_component  Turn an explicit config into paste-ready TSX
    glyphforge_search_models       Search five 3D catalogues, ~46,800 models
    glyphforge_get_model_import    Resolve a catalogue id to a loadable .glb URL

  Environment
    GLYPHFORGE_OBJAVERSE_INDEX     Path or URL for the Objaverse category index.
                                   Defaults to the copy bundled with this package.

  Add it to a client
    Claude Code   claude mcp add glyphforge -- npx -y glyphforge-mcp
    Cursor        .cursor/mcp.json  -> { "mcpServers": { "glyphforge": { "command": "npx", "args": ["-y", "glyphforge-mcp"] } } }
    Codex         ~/.codex/config.toml -> [mcp_servers.glyphforge] command = "npx", args = ["-y", "glyphforge-mcp"]

  ${REPO_URL}
`

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP)
    return
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(SERVER_VERSION)
    return
  }

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: `Glyphforge renders a 3D model as a live WebGL ASCII scene, as one React component.

Call \`glyphforge_get_started\` before doing anything else with it — it explains the library, the peer dependencies and which tool to reach for next.

Typical paths:
- "add an ASCII hero to my site", with the project on disk -> \`glyphforge_inspect_project\` (pass \`site_description\`), which grounds the recommendation in the installed dependencies and the site's own palette
- "what would suit my site", no repo to hand -> \`glyphforge_recommend_setup\`
- The hero needs a real object rather than a word or a shape -> \`glyphforge_search_models\`, then \`glyphforge_get_model_import\`
- You already know the props -> \`glyphforge_generate_component\`

Sketchfab results cannot be downloaded automatically — pass the model page link to the user and let them download it themselves. Licences come back exactly as each catalogue states them; never infer one.`,
    },
  )

  registerDocsTools(server)
  registerRecommendTool(server)
  registerGenerateTool(server)
  registerModelTools(server)
  registerInspectTool(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} ready on stdio`)
}

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] fatal:`, error instanceof Error ? error.message : error)
  process.exit(1)
})
