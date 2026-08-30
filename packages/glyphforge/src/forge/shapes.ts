import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Curve,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector3,
} from "three"
import type { ShapeModelSource } from "../types"

/** Deterministic PRNG so a given `seed` always forges the same mesh. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cheap value noise, smooth enough for surface displacement. */
function makeNoise3(seed: number) {
  const random = mulberry32(seed)
  const table = new Float32Array(256)
  for (let i = 0; i < table.length; i++) table[i] = random()

  const hash = (x: number, y: number, z: number) =>
    table[(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & 255]

  const fade = (t: number) => t * t * (3 - 2 * t)

  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const zi = Math.floor(z)
    const xf = fade(x - xi)
    const yf = fade(y - yi)
    const zf = fade(z - zi)

    let result = 0
    for (let dz = 0; dz < 2; dz++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const weight =
            (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf)
          result += hash(xi + dx, yi + dy, zi + dz) * weight
        }
      }
    }
    return result * 2 - 1
  }
}

class HelixCurve extends Curve<Vector3> {
  constructor(
    private turns: number,
    private radius: number,
    private heightSpan: number,
  ) {
    super()
  }

  getPoint(t: number, target = new Vector3()) {
    const angle = t * Math.PI * 2 * this.turns
    return target.set(
      Math.cos(angle) * this.radius,
      (t - 0.5) * this.heightSpan,
      Math.sin(angle) * this.radius,
    )
  }
}

function gearShape(teeth: number, innerRadius: number, outerRadius: number, boreRadius: number) {
  const shape = new Shape()
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    // Square-ish tooth profile: alternate between root and tip radius.
    const phase = Math.floor((i / steps) * teeth * 2) % 2
    const radius = phase === 0 ? outerRadius : innerRadius
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()

  const bore = new Shape()
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, false)
  shape.holes.push(bore)
  return shape
}

/** Build a parametric primitive. Synchronous and asset-free. */
export function forgeShape(source: ShapeModelSource): BufferGeometry {
  const { shape, detail = 128, distortion = 0.35, seed = 1 } = source
  const segments = Math.max(8, Math.min(512, Math.round(detail)))

  let geometry: BufferGeometry

  switch (shape) {
    case "torusKnot":
      geometry = new TorusKnotGeometry(
        0.75,
        0.26 * (0.5 + distortion),
        segments * 2,
        Math.max(8, Math.round(segments / 4)),
        2,
        3,
      )
      break

    case "blob": {
      const subdivision = Math.max(1, Math.min(6, Math.round(Math.log2(segments)) - 2))
      geometry = new IcosahedronGeometry(1, subdivision)
      displace(geometry, seed, distortion, 1.6)
      break
    }

    case "crystal": {
      geometry = new IcosahedronGeometry(1, 1)
      const random = mulberry32(seed)
      const position = geometry.getAttribute("position")
      const vertex = new Vector3()
      // Per-vertex radial jitter with no smoothing gives hard facets.
      const offsets = new Map<string, number>()
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i)
        const key = `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)},${vertex.z.toFixed(3)}`
        let offset = offsets.get(key)
        if (offset === undefined) {
          offset = 1 + (random() - 0.5) * 2 * distortion
          offsets.set(key, offset)
        }
        vertex.multiplyScalar(offset)
        position.setXYZ(i, vertex.x, vertex.y, vertex.z)
      }
      position.needsUpdate = true
      break
    }

    case "helix":
      geometry = new TubeGeometry(
        new HelixCurve(3, 0.7, 1.8),
        segments * 2,
        0.12 + distortion * 0.12,
        Math.max(6, Math.round(segments / 8)),
        false,
      )
      break

    case "sphere":
      geometry = new SphereGeometry(1, segments, Math.max(8, Math.round(segments / 2)))
      break

    case "torus":
      geometry = new TorusGeometry(
        0.75,
        0.3 * (0.5 + distortion),
        Math.max(8, Math.round(segments / 4)),
        segments,
      )
      break

    case "box": {
      const s = Math.max(1, Math.round(segments / 16))
      geometry = new BoxGeometry(1.4, 1.4, 1.4, s, s, s)
      break
    }

    case "capsule":
      geometry = new CapsuleGeometry(0.6, 1.1, Math.max(4, Math.round(segments / 8)), segments)
      break

    case "gear": {
      const teeth = Math.max(6, Math.round(6 + distortion * 24))
      geometry = new ExtrudeGeometry(gearShape(teeth, 0.78, 1, 0.32), {
        depth: 0.4,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
        curveSegments: 24,
      })
      break
    }

    default:
      geometry = new TorusKnotGeometry(0.75, 0.26, 256, 32, 2, 3)
  }

  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

function displace(geometry: BufferGeometry, seed: number, amount: number, frequency: number) {
  const noise = makeNoise3(seed)
  const position = geometry.getAttribute("position")
  const vertex = new Vector3()

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    const n =
      noise(vertex.x * frequency, vertex.y * frequency, vertex.z * frequency) * 0.6 +
      noise(vertex.x * frequency * 2.3, vertex.y * frequency * 2.3, vertex.z * frequency * 2.3) * 0.3
    vertex.multiplyScalar(1 + n * amount)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
}
