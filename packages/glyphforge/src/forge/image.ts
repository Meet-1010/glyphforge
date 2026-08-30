import { BufferAttribute, BufferGeometry, ExtrudeGeometry, PlaneGeometry } from "three"
import { contourBounds, contoursToShapes, traceContours } from "./contour"
import {
  applyAutoLevels,
  createToneTexture,
  fitTransform,
  rasterizeImage,
  thresholdRaster,
  type ImageRaster,
} from "./raster"
import type { ImageModelSource } from "../types"

/**
 * Turn a raster image into geometry.
 *
 * `flat` maps the picture onto a plane — the most faithful "photo as ASCII".
 * `relief` additionally displaces the surface by luminance, for depth.
 * `extrude` traces the silhouette and pushes it out, for flat logos and icons.
 *
 * For `flat` and `relief`, the image is also attached as a tone texture (see
 * `geometry.userData.map`). Without it the ASCII pass only ever sees light
 * bouncing off a bumpy surface, and the subject is unrecognisable.
 */
export async function forgeImage(source: ImageModelSource): Promise<BufferGeometry> {
  const {
    src,
    mode = "relief",
    depth = 0.4,
    threshold = 0.5,
    double = false,
    tones = true,
    autoContrast = true,
  } = source

  if (!src) throw new Error("glyphforge: no image chosen yet")

  if (mode === "extrude") {
    const resolution = Math.max(64, Math.min(1024, source.resolution ?? 512))
    const raster = await rasterizeImage(src, resolution)
    const { mask, width, height } = thresholdRaster(raster, threshold, "auto")
    const contours = traceContours(mask, width, height)

    if (contours.length === 0) {
      throw new Error(
        'glyphforge: nothing crossed the threshold. Try a different `threshold`, or use mode "flat".',
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

  const raster = await rasterizeImage(src, Math.max(24, Math.min(384, source.resolution ?? 160)))
  if (autoContrast) applyAutoLevels(raster)

  const geometry =
    mode === "flat" ? buildPlane(raster.aspect) : buildRelief(raster, depth, double)

  if (tones) {
    // Carried on userData so `forgeGeometry` keeps its single-return signature;
    // GlyphModel picks this up and builds a textured material from it.
    geometry.userData.map = await createToneTexture(src, 1024, autoContrast)
  }

  return geometry
}

/** A plane sized to the image's aspect, normalised into a 2-unit box. */
function buildPlane(aspect: number): BufferGeometry {
  const width = aspect >= 1 ? 2 : 2 * aspect
  const height = aspect >= 1 ? 2 / aspect : 2
  const geometry = new PlaneGeometry(width, height, 1, 1)
  geometry.computeVertexNormals()
  return geometry
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

  for (let layer = 0; layer < layers; layer++) {
    const sign = layer === 0 ? 1 : -1
    const base = layer * vertexCount
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const v = base + i
        const u = width === 1 ? 0.5 : x / (width - 1)
        const w = height === 1 ? 0.5 : y / (height - 1)
        const displacement = luminance[i] * (double ? depth / 2 : depth)

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
        quad(a, a + 1, a + width + 1, a + width, flip)
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
      indices.push(currentFront, currentFront + vertexCount, nextFront + vertexCount)
      indices.push(currentFront, nextFront + vertexCount, nextFront)
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
