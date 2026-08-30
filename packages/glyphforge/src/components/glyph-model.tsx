"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  Vector3,
  type Material,
} from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { forgeGeometry, isForgeable } from "../forge"
import type { ModelSource } from "../types"

/**
 * Scale and centre any object into a 2-unit box.
 *
 * Upstream made you hand-tune `scale={8}` per model and re-guess after every
 * swap. Auto-fitting means a `.glb` from any source frames correctly on drop.
 */
export function fitObject(object: Object3D, targetSize = 2) {
  const box = new Box3().setFromObject(object)
  if (box.isEmpty()) return

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const longest = Math.max(size.x, size.y, size.z) || 1
  const scale = targetSize / longest

  object.position.sub(center)
  object.position.multiplyScalar(scale)
  object.scale.setScalar(scale)
}

const gltfCache = new Map<string, Promise<Object3D>>()

function loadGltf(src: string): Promise<Object3D> {
  const cached = gltfCache.get(src)
  if (cached) return cached

  const promise = new Promise<Object3D>((resolve, reject) => {
    new GLTFLoader().load(
      src,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => reject(new Error(`glyphforge: failed to load model "${src}"`)),
    )
  })
  // Don't cache rejections, otherwise a transient network blip is permanent.
  promise.catch(() => gltfCache.delete(src))
  gltfCache.set(src, promise)
  return promise
}

export interface GlyphModelProps {
  source: ModelSource
  /** Surface colour. Ignored when the source supplies its own tone texture. */
  color?: string
  /** Lower is glossier and gives the ASCII pass more contrast to work with. @default 0.12 */
  roughness?: number
  /** @default 0 */
  metalness?: number
  /** Keep the `.glb`'s own materials instead of overriding them. @default false */
  keepMaterials?: boolean
  /** Extra uniform scale applied after auto-fit. @default 1 */
  scale?: number
  onReady?: (object: Object3D) => void
  onError?: (error: Error) => void
}

export function GlyphModel({
  source,
  color = "#917AFF",
  roughness = 0.12,
  metalness = 0,
  keepMaterials = false,
  scale = 1,
  onReady,
  onError,
}: GlyphModelProps) {
  const groupRef = useRef<Group>(null)
  const [object, setObject] = useState<Object3D | null>(null)
  const [map, setMap] = useState<Texture | null>(null)

  const toneStrength = source.type === "image" ? (source.toneStrength ?? 0.85) : 0.85

  /**
   * Built from the tone texture when there is one, so tweaking roughness or
   * colour does not re-forge the mesh.
   *
   * The emissive channel carries the picture: the renderer's ACES tone mapping
   * at 0.6 exposure otherwise crushes it to a flat grey, and the glyph ramp has
   * only a handful of tiers to spend. The 2.2 factor undoes that compression so
   * the full range survives into the ASCII pass.
   */
  const material = useMemo(() => {
    if (map) {
      return new MeshStandardMaterial({
        color: "#ffffff",
        map,
        emissive: new Color("#ffffff"),
        emissiveMap: map,
        emissiveIntensity: toneStrength * 2.2,
        roughness: Math.max(roughness, 0.5),
        metalness: 0,
        side: DoubleSide,
      })
    }
    return new MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: false,
      side: FrontSide,
    })
  }, [map, color, roughness, metalness, toneStrength])

  // Serialising the source gives a stable dep for object literals written
  // inline in JSX, which would otherwise re-forge the mesh on every render.
  const sourceKey = JSON.stringify(source)

  useEffect(() => {
    let cancelled = false
    let ownedGeometry: BufferGeometry | null = null
    let ownedTexture: Texture | null = null

    async function build() {
      try {
        let next: Object3D

        if (source.type === "url") {
          if (!source.src) throw new Error("glyphforge: no model file chosen yet")
          const scene = await loadGltf(source.src)
          if (cancelled) return
          // The cache hands out one instance; clone so several heroes can
          // show the same URL without fighting over transforms.
          next = scene.clone(true)
        } else if (isForgeable(source)) {
          const geometry = await forgeGeometry(source)
          if (cancelled) {
            geometry.dispose()
            ;(geometry.userData.map as Texture | undefined)?.dispose()
            return
          }
          ownedGeometry = geometry
          ownedTexture = (geometry.userData.map as Texture | undefined) ?? null
          next = new Mesh(geometry)
        } else {
          throw new Error("glyphforge: unsupported model source")
        }

        fitObject(next)
        if (cancelled) return

        setMap(ownedTexture)
        setObject(next)
        onReady?.(next)
      } catch (error) {
        if (cancelled) return
        const err = error instanceof Error ? error : new Error(String(error))
        onError?.(err)
      }
    }

    void build()

    return () => {
      cancelled = true
      // Only what this effect created is ours to free; cached glTF scenes are
      // shared, and the material is owned by the memo above.
      ownedGeometry?.dispose()
      ownedTexture?.dispose()
      setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  // Assignment is separate from the build so material edits are instant.
  useEffect(() => {
    if (!object || keepMaterials) return
    object.traverse((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh) mesh.material = material
    })
  }, [object, material, keepMaterials])

  useEffect(() => () => material.dispose(), [material])

  if (!object) return null

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={object} />
    </group>
  )
}

/** Free every geometry and material under `object`. */
export function disposeObject(object: Object3D) {
  object.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const material = mesh.material as Material | Material[] | undefined
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else material?.dispose()
  })
}
