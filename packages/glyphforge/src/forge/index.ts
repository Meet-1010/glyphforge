import type { BufferGeometry } from "three"
import type { ModelSource, ShapeKind } from "../types"
import { forgeImage } from "./image"
import { forgeShape } from "./shapes"
import { forgeSvg } from "./svg"
import { forgeText } from "./text"

export { forgeText, DEFAULT_TEXT_FONT } from "./text"
export { forgeSvg } from "./svg"
export { forgeImage } from "./image"
export { forgeShape } from "./shapes"
export { exportModel, downloadModel, downloadBlob, type ExportOptions } from "./export"
export {
  traceContours,
  contoursToShapes,
  contourBounds,
  simplify,
  signedArea,
  type Point,
} from "./contour"
export { rasterizeText, rasterizeImage, thresholdRaster, loadImage, fitTransform } from "./raster"

/** Everything `forgeGeometry` can build. `url` models are loaded, not forged. */
export type ForgeableSource = Exclude<ModelSource, { type: "url" }>

export const SHAPE_KINDS: ShapeKind[] = [
  "torusKnot",
  "blob",
  "crystal",
  "helix",
  "sphere",
  "torus",
  "box",
  "capsule",
  "gear",
]

/** What `<GlyphHero />` renders when given no `model`. */
export const DEFAULT_MODEL: ModelSource = { type: "shape", shape: "torusKnot", detail: 128 }

/**
 * Build geometry from any forgeable source.
 *
 * Shapes are synchronous; text, SVG and image sources need canvas or network
 * work, so the whole entry point is async for a single call signature.
 */
export async function forgeGeometry(source: ForgeableSource): Promise<BufferGeometry> {
  switch (source.type) {
    case "text":
      return forgeText(source)
    case "svg":
      return forgeSvg(source)
    case "image":
      return forgeImage(source)
    case "shape":
      return forgeShape(source)
    default: {
      const exhaustive: never = source
      throw new Error(`glyphforge: unknown model source ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function isForgeable(source: ModelSource): source is ForgeableSource {
  return source.type !== "url"
}
