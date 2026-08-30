import path from "node:path"
import type { NextConfig } from "next"

const librarySrc = path.resolve(__dirname, "../../packages/glyphforge/src")

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
  transpilePackages: ["glyphforge"],
  turbopack: {
    resolveAlias: {
      glyphforge: path.join(librarySrc, "index.ts"),
      "glyphforge/forge": path.join(librarySrc, "forge/index.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      glyphforge$: path.join(librarySrc, "index.ts"),
      "glyphforge/forge$": path.join(librarySrc, "forge/index.ts"),
    }
    return config
  },
}

export default nextConfig
