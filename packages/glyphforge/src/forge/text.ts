import { BufferGeometry, ExtrudeGeometry } from "three"
import { contourBounds, contoursToShapes, traceContours } from "./contour"
import { fitTransform, rasterizeText } from "./raster"
import type { TextModelSource } from "../types"

export const DEFAULT_TEXT_FONT = "700 200px system-ui, -apple-system, Segoe UI, sans-serif"

/**
 * Extrude live browser text into a 3D mesh.
 *
 * No `.typeface.json` conversion and no font files to ship: whatever the page
 * can render, this can extrude, including webfonts and emoji.
 */
export async function forgeText(source: TextModelSource): Promise<BufferGeometry> {
  const {
    value,
    font = DEFAULT_TEXT_FONT,
    depth = 0.35,
    bevel = 0.02,
    resolution = 512,
    smoothing = 1.2,
  } = source

  const trimmed = value.trim()
  if (!trimmed) throw new Error("glyphforge: text source is empty")

  const raster = await rasterizeText(trimmed, font, Math.max(128, Math.min(1536, resolution)))
  const contours = traceContours(raster.mask, raster.width, raster.height)

  if (contours.length === 0) {
    throw new Error(
      `glyphforge: "${trimmed}" rasterised to nothing. Check the font shorthand ("${font}") renders these characters.`,
    )
  }

  const bounds = contourBounds(contours)
  const { scale, offset } = fitTransform(bounds, 2)
  const shapes = contoursToShapes(contours, { smoothing, scale, offset, flipY: true })

  if (shapes.length === 0) throw new Error("glyphforge: no closed outlines found in text")

  const geometry = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 4,
  })

  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}
