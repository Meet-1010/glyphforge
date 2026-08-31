"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import {
  MathUtils,
  PMREMGenerator,
  Group,
  PerspectiveCamera,
  Vector2,
  Vector3,
  type Texture,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { AsciiEffect } from "../effects/ascii-effect"
import { GlyphModel, type GlyphModelProps, type GlyphModelResult } from "./glyph-model"
import type { AsciiOptions, ControlOptions, MotionOptions, ModelSource } from "../types"

const DEFAULT_MOTION: Required<Omit<MotionOptions, "tilt">> & { tilt: [number, number] } = {
  autoRotate: 0.4,
  hoverBoost: 2,
  draggable: true,
  hoverZoom: 1.1,
  tilt: [0.3, -0.08],
  animation: true,
  animationSpeed: 1,
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
  /** When pan is enabled those gestures belong to the camera, not the model. */
  panButtons: boolean
  children: ReactNode
}

/**
 * Auto-spin plus pointer drag.
 *
 * Handlers bind to this canvas's own DOM element. Upstream used a global
 * `document.querySelector("[data-model-canvas-container]")`, so a second hero
 * on the same page silently drove the first one.
 */
function RotatingGroup({ motion, hovered, reducedMotion, panButtons, children }: RotatingGroupProps) {
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
      // Middle, right and shift-drag are the camera's pan gesture.
      if (panButtons && (event.button === 1 || event.button === 2 || event.shiftKey)) return
      if (event.button !== 0 && event.button !== undefined) return
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
  }, [gl, settings.draggable, panButtons])

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
 * Distance that frames a model of `size` in both axes.
 *
 * Framing the bounding *sphere* seems tidier but punishes anything deep: the
 * Flamingo is 176 units nose-to-tail and 89 tall, so a sphere fit pushes the
 * camera back until you are looking at a tiny head-on cross-section. The model
 * only spins about Y, so its horizontal silhouette sweeps between the X and Z
 * extents while its height never changes — fitting those two directly keeps it
 * large without ever clipping.
 */
function distanceForSize(camera: PerspectiveCamera, size: Vector3, padding = 1.25): number {
  const fovV = MathUtils.degToRad(camera.fov)
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * Math.max(camera.aspect, 0.0001))

  const halfWidth = Math.max(size.x, size.z) / 2
  const halfHeight = size.y / 2

  const vertical = halfHeight / Math.tan(fovV / 2)
  const horizontal = halfWidth / Math.tan(fovH / 2)

  // Half-depth keeps the near face outside the camera as the model turns.
  return Math.max(vertical, horizontal) * padding + halfWidth * 0.35
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Camera dolly, with optional zoom and pan.
 *
 * Auto-framing sets the base distance; user zoom is a multiplier on top of it
 * rather than an absolute position, so resizing the window or swapping the
 * model still reframes correctly without throwing away where the viewer had
 * zoomed to.
 */
function CameraRig({
  hovered,
  hoverZoom,
  cameraZ,
  size,
  controls,
}: {
  hovered: boolean
  hoverZoom: number
  cameraZ: number | "auto"
  size: Vector3 | null
  controls: ControlOptions
}) {
  const { camera, gl } = useThree()

  const zoom = useRef(1)
  const pan = useRef(new Vector3())
  const distance = useRef<number | null>(null)

  const [minZoom, maxZoom] = controls.zoomRange ?? [0.3, 5]
  const zoomEnabled = controls.zoom ?? false
  const panEnabled = controls.pan ?? false

  const reset = useCallback(() => {
    zoom.current = 1
    pan.current.set(0, 0, 0)
  }, [])

  // A new model gets a fresh view; keeping the old zoom would drop you inside
  // an unrelated mesh.
  useEffect(reset, [size, reset])
  useEffect(reset, [controls.resetToken, reset])

  useEffect(() => {
    if (!zoomEnabled && !panEnabled) return
    const element = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance = 0
    let panning = false
    let last = { x: 0, y: 0 }

    /** World units per screen pixel at the current camera distance. */
    const worldPerPixel = () => {
      const perspective = camera as PerspectiveCamera
      const height = element.clientHeight || 1
      const d = distance.current ?? perspective.position.z
      return (2 * d * Math.tan(MathUtils.degToRad(perspective.fov) / 2)) / height
    }

    const onWheel = (event: WheelEvent) => {
      if (!zoomEnabled) return
      // Only swallow the page's scroll when this canvas is actually zooming.
      event.preventDefault()
      // Exponential so each notch feels the same at any zoom level.
      zoom.current = clamp(zoom.current * Math.exp(-event.deltaY * 0.0015), minZoom, maxZoom)
    }

    // Shift/middle/right start a pan; a plain left drag is the model's own
    // rotate handler and must be left alone.
    const isPanGesture = (event: PointerEvent) =>
      panEnabled && (event.button === 1 || event.button === 2 || event.shiftKey)

    const onPointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (isPanGesture(event)) {
        panning = true
        last = { x: event.clientX, y: event.clientY }
        element.setPointerCapture?.(event.pointerId)
        event.preventDefault()
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

      if (pointers.size === 2 && zoomEnabled) {
        const [a, b] = [...pointers.values()]
        const next = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDistance > 0 && next > 0) {
          zoom.current = clamp(zoom.current * (next / pinchDistance), minZoom, maxZoom)
        }
        pinchDistance = next
        return
      }

      if (!panning) return
      const scale = worldPerPixel()
      pan.current.x -= (event.clientX - last.x) * scale
      pan.current.y += (event.clientY - last.y) * scale
      last = { x: event.clientX, y: event.clientY }
    }

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinchDistance = 0
      if (panning && pointers.size === 0) {
        panning = false
        element.releasePointerCapture?.(event.pointerId)
      }
    }

    // Right-drag panning would otherwise open the browser menu mid-gesture.
    const onContextMenu = (event: Event) => {
      if (panEnabled) event.preventDefault()
    }

    element.addEventListener("wheel", onWheel, { passive: false })
    element.addEventListener("pointerdown", onPointerDown)
    element.addEventListener("dblclick", reset)
    element.addEventListener("contextmenu", onContextMenu)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)

    return () => {
      element.removeEventListener("wheel", onWheel)
      element.removeEventListener("pointerdown", onPointerDown)
      element.removeEventListener("dblclick", reset)
      element.removeEventListener("contextmenu", onContextMenu)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
    }
  }, [camera, gl, zoomEnabled, panEnabled, minZoom, maxZoom, reset])

  useFrame(() => {
    const perspective = camera as PerspectiveCamera
    // Recomputed every frame so a resize reframes rather than crops — the
    // aspect ratio is half the equation.
    const base =
      cameraZ === "auto"
        ? size
          ? distanceForSize(perspective, size)
          : perspective.position.z
        : cameraZ

    const target = base / (zoom.current * (hovered ? hoverZoom : 1))
    distance.current = target

    camera.position.z += (target - camera.position.z) * 0.12
    camera.position.x += (pan.current.x - camera.position.x) * 0.15
    camera.position.y += (pan.current.y - camera.position.y) * 0.15
    camera.lookAt(pan.current.x, pan.current.y, 0)
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
  /** Viewport navigation. Off by default so heroes never eat page scroll. */
  controls?: ControlOptions
  onReady?: (result: GlyphModelResult) => void
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
  controls = {},
  onReady,
  onError,
}: GlyphSceneProps) {
  const settings = { ...DEFAULT_MOTION, ...motion }
  const [composerReady, setComposerReady] = useState(false)
  const [size, setSize] = useState<Vector3 | null>(null)
  const frames = useRef(0)

  const handleReady = (result: GlyphModelResult) => {
    setSize(result.size.lengthSq() > 0 ? result.size : null)
    onReady?.(result)
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
        size={size}
        controls={controls}
      />

      <RotatingGroup
        motion={motion}
        hovered={hovered}
        reducedMotion={reducedMotion}
        panButtons={controls.pan ?? false}
      >
        <GlyphModel
          source={source}
          {...material}
          animation={settings.animation}
          animationSpeed={settings.animationSpeed}
          paused={!animate || reducedMotion}
          onReady={handleReady}
          onError={onError}
        />
      </RotatingGroup>

      {composerReady && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <AsciiEffect {...asciiProps} />
        </EffectComposer>
      )}
    </>
  )
}
