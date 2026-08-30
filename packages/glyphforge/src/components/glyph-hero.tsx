"use client"

import type { CSSProperties, ReactNode } from "react"
import { GlyphCanvas, type GlyphCanvasProps } from "./glyph-canvas"

export interface GlyphHeroProps extends GlyphCanvasProps {
  /**
   * `overlay` centres your content on top of the canvas.
   * `split` puts content on one side and the canvas on the other.
   * @default "overlay"
   */
  layout?: "overlay" | "split"
  /** Which side the canvas sits on in `split` layout. @default "right" */
  canvasSide?: "left" | "right"
  /** Section height. @default "100vh" for overlay, "min(90vh, 720px)" for split */
  height?: string | number
  /** Your headline, copy and CTAs. */
  children?: ReactNode
  /** Class applied to the outer section. */
  className?: string
  /** Class applied to the canvas element itself. */
  canvasClassName?: string
  /** Style applied to the canvas element. `style` styles the outer section. */
  canvasStyle?: CSSProperties
}

/**
 * A complete hero section: the ASCII canvas plus your content.
 *
 * ```tsx
 * <GlyphHero model={{ type: "text", value: "GLYPHFORGE" }} preset="matrix">
 *   <h1>Ship a hero people screenshot.</h1>
 * </GlyphHero>
 * ```
 *
 * Reach for `<GlyphCanvas />` instead when you already have your own layout.
 */
export function GlyphHero({
  layout = "overlay",
  canvasSide = "right",
  height,
  children,
  className,
  canvasClassName,
  canvasStyle,
  style,
  ...canvasProps
}: GlyphHeroProps) {
  const resolvedHeight = height ?? (layout === "overlay" ? "100vh" : "min(90vh, 720px)")
  const background = canvasProps.transparent ? "transparent" : (canvasProps.backgroundColor ?? "#000000")

  if (layout === "split") {
    return (
      <section
        className={className}
        data-glyphforge="hero"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "stretch",
          minHeight: resolvedHeight,
          background,
          ...style,
        }}
      >
        <div
          style={{
            order: canvasSide === "right" ? 0 : 1,
            display: "grid",
            alignContent: "center",
            padding: "clamp(24px, 5vw, 72px)",
          }}
        >
          {children}
        </div>
        <GlyphCanvas
          {...canvasProps}
          className={canvasClassName}
          style={{ order: canvasSide === "right" ? 1 : 0, minHeight: 320, ...canvasStyle }}
        />
      </section>
    )
  }

  return (
    <section
      className={className}
      data-glyphforge="hero"
      style={{
        position: "relative",
        minHeight: resolvedHeight,
        background,
        ...style,
      }}
    >
      <GlyphCanvas
        {...canvasProps}
        className={canvasClassName}
        style={{ position: "absolute", inset: 0, height: "100%", ...canvasStyle }}
      />
      {children != null && (
        <div style={contentStyle}>
          {/* The gutter around your content stays click-through so drag-to-rotate
              works across most of the hero; the content itself takes pointer
              events so buttons and links behave normally. */}
          <div style={{ pointerEvents: "auto" }}>{children}</div>
        </div>
      )}
    </section>
  )
}

const contentStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  minHeight: "inherit",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: "clamp(24px, 5vw, 72px)",
  pointerEvents: "none",
}
