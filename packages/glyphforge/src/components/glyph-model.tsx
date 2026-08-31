"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import {
  AnimationClip,
  AnimationMixer,
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
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import { forgeGeometry, isForgeable } from "../forge"
import type { ModelSource } from "../types"

/** What a finished model hands back to the host. */
export interface GlyphModelResult {
  object: Object3D
  /** Names of embedded glTF animation clips, empty for static models. */
  animations: string[]
  /** World-space size after auto-fitting, so the camera can frame it. */
  size: Vector3
}

/** Cap the vertex walk so a half-million-poly scene still measures instantly. */
const MEASURE_BUDGET = 120_000

/**
 * Measure an object from its actual vertex positions.
 *
 * `Box3.setFromObject` goes through `geometry.boundingBox`, which three.js
 * expands by every morph target's extents — the Flamingo's flap targets inflate
 * it by ~1.5x, so fitting against it silently shrinks the model by a third.
 * Walking POSITION directly measures the rest pose, which is what the viewer
 * actually sees.
 */
export function measureObject(object: Object3D): Box3 {
  object.updateWorldMatrix(false, true)

  let total = 0
  object.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.isMesh && mesh.geometry?.attributes?.position) {
      total += mesh.geometry.attributes.position.count
    }
  })

  const stride = Math.max(1, Math.ceil(total / MEASURE_BUDGET))
  const box = new Box3()
  const vertex = new Vector3()

  object.traverse((child) => {
    const mesh = child as Mesh
    const position = mesh.geometry?.attributes?.position
    if (!mesh.isMesh || !position) return
    for (let i = 0; i < position.count; i += stride) {
      box.expandByPoint(vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld))
    }
  })

  // Sampling can clip the extremes slightly; a touch of padding covers it.
  if (stride > 1 && !box.isEmpty()) box.expandByScalar(box.getSize(vertex).length() * 0.01)
  return box.isEmpty() ? new Box3().setFromObject(object) : box
}

/**
 * Scale and centre any object into a 2-unit box.
 *
 * Upstream made you hand-tune `scale={8}` per model and re-guess after every
 * swap. Auto-fitting means a `.glb` from any source frames correctly on drop.
 */
export function fitObject(object: Object3D, targetSize = 2): Vector3 {
  const box = measureObject(object)
  if (box.isEmpty()) return new Vector3(targetSize, targetSize, targetSize)

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const longest = Math.max(size.x, size.y, size.z) || 1
  const scale = targetSize / longest

  object.position.sub(center)
  object.position.multiplyScalar(scale)
  object.scale.setScalar(scale)

  return size.multiplyScalar(scale)
}

interface LoadedGltf {
  scene: Object3D
  animations: AnimationClip[]
}

const gltfCache = new Map<string, Promise<LoadedGltf>>()

function loadGltf(src: string): Promise<LoadedGltf> {
  const cached = gltfCache.get(src)
  if (cached) return cached

  const promise = new Promise<LoadedGltf>((resolve, reject) => {
    new GLTFLoader().load(
      src,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }),
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
  /** `true` plays the first embedded clip, a string picks one by name. @default true */
  animation?: boolean | string
  /** Playback speed multiplier. @default 1 */
  animationSpeed?: number
  /** Freeze playback (reduced motion, or scrolled offscreen). @default false */
  paused?: boolean
  onReady?: (result: GlyphModelResult) => void
  onError?: (error: Error) => void
}

export function GlyphModel({
  source,
  color = "#917AFF",
  roughness = 0.12,
  metalness = 0,
  keepMaterials = false,
  scale = 1,
  animation = true,
  animationSpeed = 1,
  paused = false,
  onReady,
  onError,
}: GlyphModelProps) {
  const groupRef = useRef<Group>(null)
  const [object, setObject] = useState<Object3D | null>(null)
  const [clips, setClips] = useState<AnimationClip[]>([])
  const [map, setMap] = useState<Texture | null>(null)
  const mixerRef = useRef<AnimationMixer | null>(null)

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
        let nextClips: AnimationClip[] = []

        if (source.type === "url") {
          if (!source.src) throw new Error("glyphforge: no model file chosen yet")
          const gltf = await loadGltf(source.src)
          if (cancelled) return
          // SkeletonUtils.clone, not Object3D.clone: a plain clone leaves
          // SkinnedMeshes pointing at the original's bones, so an animated
          // model either freezes or tears itself apart.
          next = cloneSkinned(gltf.scene)
          nextClips = gltf.animations
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

        const size = fitObject(next)
        if (cancelled) return

        setMap(ownedTexture)
        setClips(nextClips)
        setObject(next)
        onReady?.({ object: next, animations: nextClips.map((clip) => clip.name), size })
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
      setClips([])
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

  // Embedded glTF animation.
  useEffect(() => {
    if (!object || clips.length === 0 || animation === false) return

    const clip =
      typeof animation === "string"
        ? (AnimationClip.findByName(clips, animation) ?? clips[0])
        : clips[0]
    if (!clip) return

    const mixer = new AnimationMixer(object)
    mixer.clipAction(clip).play()
    mixerRef.current = mixer

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(object)
      mixerRef.current = null
    }
  }, [object, clips, animation])

  useFrame((_, delta) => {
    if (paused) return
    // Clamp so returning to a backgrounded tab does not fast-forward the clip.
    mixerRef.current?.update(Math.min(delta, 0.1) * animationSpeed)
  })

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
