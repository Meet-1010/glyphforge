# glyphforge-mcp-server

An [MCP](https://modelcontextprotocol.io) server for [Glyphforge](https://github.com/Meet-1010/glyphforge) — drop-in WebGL ASCII hero sections for React.

Point a coding agent at it and the agent stops guessing: it learns the library, recommends a hero that suits the site it is actually looking at, says where on the page it belongs and why, and finds the 3D model to put in it.

---

## Add it to your agent

**Claude Code**

```bash
claude mcp add glyphforge -- npx -y glyphforge-mcp
```

**Cursor** — `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "glyphforge": { "command": "npx", "args": ["-y", "glyphforge-mcp"] }
  }
}
```

**Codex** — `~/.codex/config.toml`

```toml
[mcp_servers.glyphforge]
command = "npx"
args = ["-y", "glyphforge-mcp"]
```

**Anything else that speaks MCP** — run `npx -y glyphforge-mcp` over stdio.

No API key, no account, no configuration. The catalogues it searches are public and CORS-open, and there is no Glyphforge server for anything to phone home to.

---

## What it can do

### Learn the library

`glyphforge_get_started` is the entry point: what Glyphforge is, the peer dependencies, the shape of the API, and which tool to reach for next. `glyphforge_get_docs` goes deep on one topic at a time — the text forge, post-effects, transparency, performance, accessibility, placement, troubleshooting — so an agent that only needs the image forge doesn't spend context on the CLI.

### Recommend a hero for a specific site

`glyphforge_recommend_setup` takes a description and returns a considered answer, not a default:

> **"a CLI for database migrations, open source"**, dark ground, full hero, brand `#5AC8FA`
>
> → preset `terminal`, the word `MIGRATE` extruded into real geometry, tinted to the brand colour, with the reasoning for each choice and the UX rules that apply to a full-viewport hero.

It infers tone from the description, and a light background overrides that choice — a dark-ground preset dropped onto a white page renders as a black box, so `paper` wins and says why.

### Read the project and recommend from what's there

`glyphforge_inspect_project` opens the project on disk — read-only, `node_modules` skipped, the walk capped — and reports the framework and router style, which peer dependencies are missing, **the install command pinned to the installed React major**, version conflicts, the site's own palette and whether its ground is light or dark, and the files the hero probably belongs in. Pass `site_description` too and the recommendation comes back grounded in all of that rather than in a guess.

### Find a 3D model, including the ones it can't download

`glyphforge_search_models` searches five catalogues in one call — Objaverse (~46,200), Poly Haven (521, CC0), Khronos glTF samples (119), three.js examples (24), and Sketchfab (millions).

Four of them come back with a direct, loadable URL. **Sketchfab cannot**: downloading needs an OAuth token tied to a real account. Rather than pretend, those results carry the model's page link straight into the agent's chat so the user can click through, download the glTF, and drop it in — with the steps spelled out. `glyphforge_get_model_import` turns any result id into either a loadable URL or that download link.

Licences are reported exactly as each catalogue states them and are never inferred.

### Generate the component

`glyphforge_generate_component` runs the same generator as the Studio's copy button, so what the agent pastes and what the website hands you are byte-identical. Only props that actually differ from the preset are emitted, so the snippet stays short.

---

## Tools

| Tool | What it does |
| --- | --- |
| `glyphforge_get_started` | Learn the library — start here |
| `glyphforge_get_docs` | Documentation by topic (19 topics) |
| `glyphforge_list_presets` | The seven looks and their exact prop values |
| `glyphforge_recommend_setup` | Pick a preset, model and layout for a described site |
| `glyphforge_inspect_project` | Read a project on disk and recommend from what's there |
| `glyphforge_generate_component` | Turn an explicit config into paste-ready TSX |
| `glyphforge_search_models` | Search five 3D catalogues |
| `glyphforge_get_model_import` | Resolve a catalogue id to a loadable URL or a download page |

Every tool is read-only and takes `response_format: "markdown" | "json"`. Nothing here writes to disk, and the only network calls are to the public model catalogues.

---

## Environment

| Variable | Default |
| --- | --- |
| `GLYPHFORGE_OBJAVERSE_INDEX` | Path or URL for the Objaverse category index. Falls back to the 1.6 MB copy bundled with this package, then to the copy in the repo. |

---

## Development

```bash
npm install
npm run build --workspace=glyphforge        # the MCP server imports the library's build output
npm run build --workspace=glyphforge-mcp-server
node packages/glyphforge-mcp/dist/index.js --help
```

Inspect it interactively:

```bash
npm run inspect --workspace=glyphforge-mcp-server
```

The server shares its brains with the website: asset search lives in `glyphforge/catalog` and component generation in `glyphforge/codegen`, both consumed by the Studio and by this server, so the two cannot drift.

---

## Licence

MIT — see [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
