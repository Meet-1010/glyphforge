import { Box3, BufferGeometry, ExtrudeGeometry, Vector3 } from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
import type { SvgModelSource } from "../types"

/**
 * Extrude SVG paths into 3D.
 *
 * SVG already carries real outlines, so this skips the tracer entirely and
 * goes straight to `THREE.Shape` via three's own `SVGLoader`.
 */
export async function forgeSvg(source: SvgModelSource): Promise<BufferGeometry> {
  const { src, markup, depth = 0.35, bevel = 0.02 } = source

  let text = markup
  if (!text && src) {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`glyphforge: could not fetch SVG "${src}" (${response.status})`)
    }
    text = await response.text()
  }
  if (!text) throw new Error("glyphforge: svg source needs `src` or `markup`")

  const parsed = new SVGLoader().parse(text)
  const shapes = parsed.paths.flatMap((path) =>
    // `true` merges sub-paths so counter-shapes become holes rather than
    // separate solid islands.
    SVGLoader.createShapes(path),
  )

  if (shapes.length === 0) throw new Error("glyphforge: no drawable paths in SVG")

  const geometry = new ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 12,
  })

  // SVG's Y axis points down and its user units are arbitrary; normalise to a
  // centred 2-unit box so one camera framing works for every source.
  geometry.scale(1, -1, 1)
  geometry.center()

  const box = new Box3().setFromBufferAttribute(geometry.getAttribute("position") as never)
  const size = box.getSize(new Vector3())
  const longest = Math.max(size.x, size.y) || 1
  geometry.scale(2 / longest, 2 / longest, 1)

  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}
