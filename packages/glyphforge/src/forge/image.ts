import { BufferAttribute, BufferGeometry, ExtrudeGeometry } from "three"
import { contourBounds, contoursToShapes, traceContours } from "./contour"
import { fitTransform, rasterizeImage, thresholdRaster, type ImageRaster } from "./raster"
import type { ImageModelSource } from "../types"

/**
 * Turn a raster image into geometry.
 *
 * `relief` displaces a grid by luminance, which suits photos, depth maps and
 * shaded logos. `extrude` traces the silhouette and pushes it out, which suits
 * flat icons and single-colour marks.
 */
export async function forgeImage(source: ImageModelSource): Promise<BufferGeometry> {
  const { src, mode = "relief", depth = 0.4, threshold = 0.5, double = false } = source

  if (mode === "extrude") {
    const resolution = Math.max(64, Math.min(1024, source.resolution ?? 512))
    const raster = await rasterizeImage(src, resolution)
    const { mask, width, height } = thresholdRaster(raster, threshold, "auto")
    const contours = traceContours(mask, width, height)

    if (contours.length === 0) {
      throw new Error(
        "glyphforge: nothing crossed the threshold. Try a different `threshold`, or use mode \"relief\".",
      )
    }

    const bounds = contourBounds(contours)
    const { scale, offset } = fitTransform(bounds, 2)
    const shapes = contoursToShapes(contours, { smoothing: 1.4, scale, offset, flipY: true })
    if (shapes.length === 0) throw new Error("glyphforge: no closed outlines found in image")

    const geometry = new ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.08,
      bevelSize: depth * 0.08,
      bevelOffset: 0,
      bevelSegments: 2,
      curveSegments: 4,
    })
    geometry.center()
    geometry.computeVertexNormals()
    return geometry
  }

  const resolution = Math.max(24, Math.min(384, source.resolution ?? 160))
  const raster = await rasterizeImage(src, resolution)
  return buildRelief(raster, depth, double)
}

/**
 * Displaced grid. When `double` is set the grid is mirrored and rimmed so the
 * result is a closed solid instead of a sheet that disappears edge-on.
 */
function buildRelief(raster: ImageRaster, depth: number, double: boolean): BufferGeometry {
  const { luminance, width, height, aspect } = raster

  const sizeX = aspect >= 1 ? 2 : 2 * aspect
  const sizeY = aspect >= 1 ? 2 / aspect : 2

  const vertexCount = width * height
  const layers = double ? 2 : 1
  const positions = new Float32Array(vertexCount * layers * 3)
  const uvs = new Float32Array(vertexCount * layers * 2)

  const heightAt = (i: number) => luminance[i]

  for (let layer = 0; layer < layers; layer++) {
    const sign = layer === 0 ? 1 : -1
    const base = layer * vertexCount
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const v = base + i
        const u = width === 1 ? 0.5 : x / (width - 1)
        const w = height === 1 ? 0.5 : y / (height - 1)
        const displacement = heightAt(i) * (double ? depth / 2 : depth)

        positions[v * 3 + 0] = (u - 0.5) * sizeX
        positions[v * 3 + 1] = -(w - 0.5) * sizeY
        positions[v * 3 + 2] = sign * displacement

        uvs[v * 2 + 0] = u
        uvs[v * 2 + 1] = 1 - w
      }
    }
  }

  const indices: number[] = []
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (flip) indices.push(a, c, d, a, b, c)
    else indices.push(a, d, c, a, c, b)
  }

  for (let layer = 0; layer < layers; layer++) {
    const base = layer * vertexCount
    const flip = layer === 1
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const a = base + y * width + x
        const b = a + 1
        const c = a + width + 1
        const d = a + width
        quad(a, b, c, d, flip)
      }
    }
  }

  if (double) {
    // Stitch the two layers along the border so the solid is watertight.
    const border: number[] = []
    for (let x = 0; x < width; x++) border.push(x)
    for (let y = 1; y < height; y++) border.push(y * width + (width - 1))
    for (let x = width - 2; x >= 0; x--) border.push((height - 1) * width + x)
    for (let y = height - 2; y >= 1; y--) border.push(y * width)

    for (let k = 0; k < border.length; k++) {
      const currentFront = border[k]
      const nextFront = border[(k + 1) % border.length]
      const currentBack = currentFront + vertexCount
      const nextBack = nextFront + vertexCount
      indices.push(currentFront, currentBack, nextBack)
      indices.push(currentFront, nextBack, nextFront)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}
