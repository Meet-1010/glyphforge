import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  type Material,
} from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"

export interface ExportOptions {
  /** Name written into the glTF node. @default "glyphforge-model" */
  name?: string
  /** Emit binary `.glb` rather than JSON `.gltf`. @default true */
  binary?: boolean
}

/**
 * Serialise geometry (or a whole object) to a glTF blob, in the browser.
 *
 * This is what closes the loop for the Studio: forge a shape from text or an
 * image, then walk away with a real `.glb` usable in any engine, not just here.
 */
export async function exportModel(
  input: BufferGeometry | Object3D,
  options: ExportOptions = {},
): Promise<Blob> {
  const { name = "glyphforge-model", binary = true } = options

  let root: Object3D
  let temporary: { mesh: Mesh; material: Material } | null = null

  if (input instanceof BufferGeometry) {
    const material = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0 })
    const mesh = new Mesh(input, material)
    mesh.name = name
    temporary = { mesh, material }
    root = mesh
  } else {
    root = input
  }

  const scene = new Scene()
  scene.name = name
  scene.add(root)

  try {
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(scene, { binary })

    if (binary) {
      return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" })
    }
    return new Blob([JSON.stringify(result, null, 2)], { type: "model/gltf+json" })
  } finally {
    // Detach so the caller's geometry/object stays usable in the live preview.
    scene.remove(root)
    temporary?.material.dispose()
  }
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined") return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Forge, serialise and download in one call. */
export async function downloadModel(
  input: BufferGeometry | Object3D,
  filename = "glyphforge-model.glb",
  options: ExportOptions = {},
) {
  const blob = await exportModel(input, { binary: filename.endsWith(".glb"), ...options })
  downloadBlob(blob, filename)
}
