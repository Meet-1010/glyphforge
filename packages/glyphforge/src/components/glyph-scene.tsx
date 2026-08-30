"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import {
  Box3,
  MathUtils,
  PMREMGenerator,
  Group,
  PerspectiveCamera,
  Sphere,
  Vector2,
  type Object3D,
  type Texture,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { AsciiEffect } from "../effects/ascii-effect"
import { GlyphModel, type GlyphModelProps } from "./glyph-model"
import type { AsciiOptions, MotionOptions, ModelSource } from "../types"

const DEFAULT_MOTION: Required<Omit<MotionOptions, "tilt">> & { tilt: [number, number] } = {
  autoRotate: 0.4,
  hoverBoost: 2,
  draggable: true,
  hoverZoom: 1.1,
  tilt: [0.3, -0.08],
  respectReducedMotion: true,
}

/**
 * Procedural image-based lighting.
 *
 * `RoomEnvironment` is generated on the GPU from three's own code, so unlike
 * drei's `<Environment preset="studio" />` it needs no CDN fetch. A drop-in
 * plugin should never make a network request the host app did not ask for.
 */
function SceneEnvironment({ intensity = 0.35 }: { intensity?: number }) {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    let texture: Texture | null = null
    try {
      texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environment = texture
      // three >= r163 exposes this; older versions simply ignore it.
      ;(scene as unknown as { environmentIntensity?: number }).environmentIntensity = intensity
    } catch {
      // No IBL is survivable — the directional lights still shape the model.
    }
    return () => {
      scene.environment = null
      texture?.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])

  return null
}

interface RotatingGroupProps {
  motion: MotionOptions
  hovered: boolean
  reducedMotion: boolean
  children: ReactNode
}

/**
 * Auto-spin plus pointer drag.
 *
 * Handlers bind to this canvas's own DOM element. Upstream used a global
 * `document.querySelector("[data-model-canvas-container]")`, so a second hero
 * on the same page silently drove the first one.
 */
function RotatingGroup({ motion, hovered, reducedMotion, children }: RotatingGroupProps) {
  const groupRef = useRef<Group>(null)
  const { gl } = useThree()

  const settings = { ...DEFAULT_MOTION, ...motion }
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const manual = useRef({ x: 0, y: 0 })
  const autoY = useRef(0)

  useEffect(() => {
    if (!settings.draggable) return
    const element = gl.domElement

    const onPointerDown = (event: PointerEvent) => {
      dragging.current = true
      lastPointer.current = { x: event.clientX, y: event.clientY }
      element.setPointerCapture?.(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return
      manual.current.y += (event.clientX - lastPointer.current.x) * 0.005
      manual.current.x -= (event.clientY - lastPointer.current.y) * 0.005
      lastPointer.current = { x: event.clientX, y: event.clientY }
    }

    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false
      element.releasePointerCapture?.(event.pointerId)
    }

    element.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    return () => {
      element.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [gl, settings.draggable])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const spin = hovered ? settings.autoRotate * settings.hoverBoost : settings.autoRotate
    if (!dragging.current && !reducedMotion) {
      // Clamp delta so a backgrounded tab does not snap the model on return.
      autoY.current += Math.min(delta, 0.1) * spin
    }

    group.rotation.x = manual.current.x + settings.tilt[0]
    group.rotation.y = manual.current.y + autoY.current
    group.rotation.z = settings.tilt[1]
  })

  return <group ref={groupRef}>{children}</group>
}

/**
 * Distance that frames a sphere of `radius` in both axes.
 *
 * Framing the bounding *sphere* rather than the box keeps the model the same
 * size through a full rotation, instead of pulsing as its silhouette changes.
 */
function distanceForRadius(camera: PerspectiveCamera, radius: number, padding = 1.35): number {
  const fovV = MathUtils.degToRad(camera.fov)
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * Math.max(camera.aspect, 0.0001))
  const vertical = radius / Math.sin(fovV / 2)
  const horizontal = radius / Math.sin(fovH / 2)
  return Math.max(vertical, horizontal) * padding
}

function CameraRig({
  hovered,
  hoverZoom,
  cameraZ,
  radius,
}: {
  hovered: boolean
  hoverZoom: number
  cameraZ: number | "auto"
  radius: number | null
}) {
  const { camera } = useThree()

  useFrame(() => {
    const perspective = camera as PerspectiveCamera
    // Auto-framing recomputes every frame so a resize reframes rather than
    // cropping — the aspect ratio is half the equation.
    const base =
      cameraZ === "auto"
        ? radius
          ? distanceForRadius(perspective, radius)
          : perspective.position.z
        : cameraZ

    const target = hovered ? base / hoverZoom : base
    camera.position.z += (target - camera.position.z) * 0.08
    camera.position.x += (0 - camera.position.x) * 0.08
    camera.position.y += (0 - camera.position.y) * 0.08
    camera.lookAt(0, 0, 0)
  })

  return null
}

export interface GlyphSceneProps {
  source: ModelSource
  ascii: AsciiOptions
  motion?: MotionOptions
  material?: Pick<GlyphModelProps, "color" | "roughness" | "metalness" | "keepMaterials" | "scale">
  resolution: Vector2
  mousePos: Vector2
  hovered: boolean
  reducedMotion: boolean
  /** Pause the effect clock when the hero is scrolled out of view. */
  animate: boolean
  cameraZ: number | "auto"
  onReady?: (object: Object3D) => void
  onError?: (error: Error) => void
}

/** Scene contents. Render inside an R3F `<Canvas>`. */
export function GlyphScene({
  source,
  ascii,
  motion = {},
  material = {},
  resolution,
  mousePos,
  hovered,
  reducedMotion,
  animate,
  cameraZ,
  onReady,
  onError,
}: GlyphSceneProps) {
  const settings = { ...DEFAULT_MOTION, ...motion }
  const [composerReady, setComposerReady] = useState(false)
  const [radius, setRadius] = useState<number | null>(null)
  const frames = useRef(0)

  const handleReady = (object: Object3D) => {
    const sphere = new Box3().setFromObject(object).getBoundingSphere(new Sphere())
    setRadius(sphere.radius > 0 ? sphere.radius : null)
    onReady?.(object)
  }

  // `postprocessing` reads renderer state when a pass is added; adding it on
  // the very first render can land before the context is fully configured.
  // One completed frame is enough, and is imperceptible.
  useFrame(() => {
    if (!composerReady && ++frames.current >= 2) setComposerReady(true)
  })

  const transparent = ascii.transparent ?? false

  const asciiProps = useMemo(
    () => ({ ...ascii, resolution, mousePos, animate: animate && !reducedMotion }),
    [ascii, resolution, mousePos, animate, reducedMotion],
  )

  return (
    <>
      {!transparent && <color attach="background" args={[ascii.backgroundColor ?? "#000000"]} />}
      <SceneEnvironment />
      <ambientLight intensity={0.08} />
      <directionalLight position={[2, 3.5, 6]} intensity={6} />
      <directionalLight position={[-2, 1.5, 4]} intensity={0.35} />

      <CameraRig
        hovered={hovered}
        hoverZoom={settings.hoverZoom}
        cameraZ={cameraZ}
        radius={radius}
      />

      <RotatingGroup motion={motion} hovered={hovered} reducedMotion={reducedMotion}>
        <GlyphModel source={source} {...material} onReady={handleReady} onError={onError} />
      </RotatingGroup>

      {composerReady && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <AsciiEffect {...asciiProps} />
        </EffectComposer>
      )}
    </>
  )
}
