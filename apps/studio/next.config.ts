import path from "node:path"
import type { NextConfig } from "next"

const librarySrc = path.resolve(__dirname, "../../packages/glyphforge/src")

/**
 * Static export is opt-in via `npm run build:static`.
 *
 * Every route here already prerenders to HTML — there are no API routes, server
 * actions or runtime data fetching, since the catalogues are queried from the
 * browser. So the site can ship as plain files to any static host.
 *
 * It stays opt-in rather than always-on because `output: "export"` forbids ever
 * adding an API route, and the community page is explicitly written to grow a
 * backend later. The default build keeps that door open; this flag is for when
 * you want Cloudflare Pages, GitHub Pages or a Render static site.
 *
 * `trailingSlash` emits `assets/index.html` instead of `assets.html`. Netlify
 * and Cloudflare resolve the extensionless form on their own, but GitHub Pages
 * does not — the directory form works everywhere.
 */
const isStatic = process.env.GLYPHFORGE_STATIC === "1"

/**
 * The Studio compiles the library from source rather than its build output.
 *
 * Consuming `dist` meant every library edit needed a rebuild, and `tsup --clean`
 * deletes that directory while Next is mid-read — which repeatedly left the dev
 * server serving a broken module graph. Source resolution removes the race and
 * the rebuild step. The publishable bundle is still verified separately by
 * `npm run build` and by the CLI's eject test.
 */
const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export" as const, trailingSlash: true } : {}),
  transpilePackages: ["glyphforge"],
  turbopack: {
    resolveAlias: {
      glyphforge: path.join(librarySrc, "index.ts"),
      "glyphforge/forge": path.join(librarySrc, "forge/index.ts"),
      "glyphforge/catalog": path.join(librarySrc, "catalog/index.ts"),
      "glyphforge/codegen": path.join(librarySrc, "codegen/index.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      glyphforge$: path.join(librarySrc, "index.ts"),
      "glyphforge/forge$": path.join(librarySrc, "forge/index.ts"),
      "glyphforge/catalog$": path.join(librarySrc, "catalog/index.ts"),
      "glyphforge/codegen$": path.join(librarySrc, "codegen/index.ts"),
    }
    return config
  },
}

export default nextConfig
