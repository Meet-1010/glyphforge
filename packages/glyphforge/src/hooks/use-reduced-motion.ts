"use client"

import { useEffect, useState } from "react"

/**
 * Tracks `prefers-reduced-motion: reduce`.
 *
 * A spinning, glitching hero is exactly the kind of thing that triggers
 * vestibular discomfort, and this component is meant to be dropped into other
 * people's landing pages, so honouring the OS setting is on by default.
 */
export function useReducedMotion(enabled = true): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [enabled])

  return enabled && reduced
}
