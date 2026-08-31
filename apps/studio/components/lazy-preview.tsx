"use client"

import { useEffect, useRef, useState } from "react"
import { GlyphCanvas } from "glyphforge"
import type { CharacterSet } from "glyphforge"
import type { StudioState } from "../lib/config"

/**
 * A gallery card's live ASCII preview.
 *
 * Each canvas holds a WebGL context and browsers cap those at roughly 16 before
 * they start dropping the oldest — a gallery of 20 cards would silently blank
 * the ones you scrolled past. Mounting only what is near the viewport, and
 * unmounting the rest, keeps the count bounded no matter how long the list is.
 */
export function LazyPreview({
  config,
  className,
  height = 200,
}: {
  config: StudioState
  className?: string
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { rootMargin: "150px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const characterSet: CharacterSet =
    config.characterSet === "procedural" ? null : (config.characterSet as CharacterSet)

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, background: config.transparent ? "#0e0e13" : config.backgroundColor }}
    >
      {visible ? (
        <GlyphCanvas
          model={config.model}
          preset={config.preset}
          cellSize={config.cellSize}
          tint={config.useTint ? config.tint : undefined}
          characterSet={characterSet}
          glyphStyle={config.glyphStyle}
          invert={config.invert}
          color={config.color}
          volumeShading={config.volumeShading}
          transparent={config.transparent}
          backgroundColor={config.backgroundColor}
          postfx={config.postfx}
          material={config.material}
          cameraZ={config.cameraZ}
          maxDpr={1.25}
          motion={{ ...config.motion, draggable: false }}
          style={{ minHeight: 0, height: "100%" }}
        />
      ) : (
        <div className="grid h-full place-items-center font-mono text-[10px] text-bone/15">
          ▚▚▚
        </div>
      )}
    </div>
  )
}
