import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Glyphforge — ASCII hero sections, one component",
  description:
    "Drop a WebGL ASCII hero into any React app with one component. Forge the 3D model in your browser from text, an image, an SVG or a parametric shape — no Blender, no asset pipeline.",
  keywords: ["ascii", "webgl", "hero section", "react", "three.js", "shader", "3d", "generative"],
  openGraph: {
    title: "Glyphforge",
    description: "ASCII hero sections, one component. Forge the model in your browser.",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
