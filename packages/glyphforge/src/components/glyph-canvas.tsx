"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { Canvas } from "@react-three/fiber"
import { Vector2 } from "three"
import { GlyphScene } from "./glyph-scene"
import type { GlyphModelProps, GlyphModelResult } from "./glyph-model"
import { DEFAULT_MODEL } from "../forge"
import { resolvePreset, type PresetName } from "../presets"
import { useInView } from "../hooks/use-in-view"
import { useReducedMotion } from "../hooks/use-reduced-motion"
import type { AsciiOptions, ControlOptions, ModelSource, MotionOptions } from "../types"

function supportsWebGL(): boolean {
  if (typeof document === "undefined") return true
  try {
    const canvas = document.createElement("canvas")
    return Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    )
  } catch {
    return false
  }
}

export interface GlyphCanvasProps extends AsciiOptions {
  /** What to render. Omit for the default forged torus knot. */
  model?: ModelSource
  /** Starting point for the look. Any other prop overrides it. @default "terminal" */
  preset?: PresetName
  motion?: MotionOptions
  /**
   * Viewport navigation — scroll/pinch to zoom, shift-drag to pan.
   * Off by default: a hero that eats the page's scroll reads as broken.
   */
  controls?: ControlOptions
  material?: Pick<GlyphModelProps, "color" | "roughness" | "metalness" | "keepMaterials" | "scale">
  /**
   * Camera distance. `"auto"` frames the model in the current viewport, which
   * matters for wide or flat sources like long text.
   * @default "auto"
   */
  cameraZ?: number | "auto"
  /** Device pixel ratio ceiling. Raise for crisper glyphs, lower for speed. @default 1.5 */
  maxDpr?: number
  /** Stop rendering when scrolled out of view. @default true */
  pauseOffscreen?: boolean
  /** Shown while the model is being forged or loaded. */
  fallback?: ReactNode
  /** Shown if WebGL is unavailable or the model fails. Defaults to a quiet message. */
  errorFallback?: ReactNode | ((error: Error) => ReactNode)
  onReady?: (result: GlyphModelResult) => void
  onError?: (error: Error) => void
  className?: string
  style?: CSSProperties
}

/**
 * The WebGL surface on its own. Fills its container.
 *
 * ```tsx
 * <GlyphCanvas model={{ type: "text", value: "SHIP IT" }} preset="matrix" />
 * ```
 */
export function GlyphCanvas({
  model = DEFAULT_MODEL,
  preset = "terminal",
  motion,
  controls,
  material,
  cameraZ = "auto",
  maxDpr = 1.5,
  pauseOffscreen = true,
  fallback,
  errorFallback,
  onReady,
  onError,
  className,
  style,
  ...asciiOverrides
}: GlyphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [webglOk, setWebglOk] = useState(true)

  const resolution = useMemo(() => new Vector2(1920, 1080), [])
  const mousePos = useMemo(() => new Vector2(0, 0), [])

  const inView = useInView(containerRef, pauseOffscreen)
  const reducedMotion = useReducedMotion(motion?.respectReducedMotion ?? true)

  const ascii = useMemo(
    () => resolvePreset(preset, asciiOverrides as AsciiOptions),
    // Spread props change identity every render; compare by value instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, JSON.stringify(asciiOverrides)],
  )

  useEffect(() => setWebglOk(supportsWebGL()), [])

  // A failed model swaps the whole <Canvas> out for the error fallback, so
  // without this the component stays dead even after the source is corrected.
  const modelKey = JSON.stringify(model)
  useEffect(() => {
    setError(null)
    setReady(false)
  }, [modelKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateResolution = () => {
      const rect = container.getBoundingClientRect()
      resolution.set(rect.width || 1920, rect.height || 1080)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      // Shader UV origin is bottom-left; DOM origin is top-left.
      mousePos.set(event.clientX - rect.left, rect.height - (event.clientY - rect.top))
    }

    updateResolution()
    const observer = new ResizeObserver(updateResolution)
    observer.observe(container)
    container.addEventListener("pointermove", handlePointerMove)

    return () => {
      observer.disconnect()
      container.removeEventListener("pointermove", handlePointerMove)
    }
  }, [resolution, mousePos])

  const handleReady = useCallback(
    (result: GlyphModelResult) => {
      setReady(true)
      setError(null)
      onReady?.(result)
    },
    [onReady],
  )

  const handleError = useCallback(
    (nextError: Error) => {
      setError(nextError)
      onError?.(nextError)
    },
    [onError],
  )

  const containerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 320,
    overflow: "hidden",
    background: ascii.transparent ? "transparent" : (ascii.backgroundColor ?? "#000000"),
    touchAction: (motion?.draggable ?? true) ? "none" : undefined,
    ...style,
  }

  if (!webglOk || error) {
    const resolved =
      typeof errorFallback === "function" ? errorFallback(error ?? new Error("WebGL unavailable")) : errorFallback
    return (
      <div ref={containerRef} className={className} style={containerStyle} data-glyphforge="error">
        {resolved ?? <DefaultErrorFallback message={error?.message} webgl={webglOk} />}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-glyphforge="canvas"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, maxDpr]}
        gl={{
          alpha: ascii.transparent ?? false,
          antialias: false,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, typeof cameraZ === "number" ? cameraZ : 4.5], fov: 50 }}
        style={{ background: ascii.transparent ? "transparent" : (ascii.backgroundColor ?? "#000000") }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.6
        }}
      >
        <GlyphScene
          source={model}
          ascii={ascii}
          motion={motion}
          material={material}
          resolution={resolution}
          mousePos={mousePos}
          hovered={hovered}
          reducedMotion={reducedMotion}
          animate={inView}
          cameraZ={cameraZ}
          controls={controls}
          onReady={handleReady}
          onError={handleError}
        />
      </Canvas>

      {!ready && (
        <div style={overlayStyle} data-glyphforge="loading">
          {fallback ?? <DefaultLoading tint={ascii.tint} />}
        </div>
      )}
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
}

function DefaultLoading({ tint = "#917AFF" }: { tint?: string }) {
  return (
    <span
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: tint,
        opacity: 0.6,
      }}
    >
      forging
    </span>
  )
}

function DefaultErrorFallback({ message, webgl }: { message?: string; webgl: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        padding: 24,
        textAlign: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.55)",
      }}
    >
      <p style={{ margin: 0, maxWidth: 380 }}>
        {webgl
          ? (message ?? "Could not build this model.")
          : "This browser does not support WebGL, so the ASCII scene can't render."}
      </p>
    </div>
  )
}
