import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The library is consumed straight from source in this workspace so Studio
  // edits show up without a rebuild step.
  transpilePackages: ["glyphforge"],
}

export default nextConfig
