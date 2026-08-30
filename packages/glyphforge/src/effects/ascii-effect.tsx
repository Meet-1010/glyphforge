"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"
import type { Vector2 } from "three"
import { AsciiEffectImpl } from "./ascii-effect-impl"
import { acquireGlyphAtlas, type GlyphAtlas } from "./glyph-atlas"
import type { AsciiOptions, CharacterSet } from "../types"

export interface AsciiEffectProps extends AsciiOptions {
  /** Canvas size in pixels. Drives the character grid. */
  resolution?: Vector2
  /** Pointer position in pixels, origin bottom-left. */
  mousePos?: Vector2
  /** Set false to freeze the effect clock (reduced motion, off-screen). @default true */
  animate?: boolean
}

function characterSetKey(characterSet: CharacterSet): string {
  if (characterSet == null) return "@none"
  return Array.isArray(characterSet) ? `@custom:${characterSet.join("")}` : characterSet
}

/**
 * The ASCII pass. Drop it inside an `<EffectComposer>`:
 *
 * ```tsx
 * <EffectComposer>
 *   <AsciiEffect characterSet="terminal" tint="#917AFF" />
 * </EffectComposer>
 * ```
 */
export const AsciiEffect = forwardRef<AsciiEffectImpl, AsciiEffectProps>(function AsciiEffect(
  props,
  ref,
) {
  const { characterSet = "terminal", glyphFont = "62px monospace", animate = true, ...options } = props

  const [atlas, setAtlas] = useState<GlyphAtlas | null>(null)
  const atlasKey = characterSetKey(characterSet)

  // Created once and mutated in place. Recreating it on a prop change would
  // recompile the shader and reset the clock on every render.
  const effect = useMemo(() => new AsciiEffectImpl(), [])

  useEffect(() => {
    const acquired = acquireGlyphAtlas(characterSet, glyphFont)
    setAtlas(acquired)
    return () => {
      acquired?.release()
      setAtlas(null)
    }
    // `characterSet` may be a fresh array on every render, so key on contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlasKey, glyphFont])

  useLayoutEffect(() => {
    effect.applyOptions({
      ...options,
      animate,
      glyphAtlas: atlas?.texture ?? null,
      glyphTiles: atlas?.tiles ?? 0,
    })
  })

  useEffect(() => () => effect.dispose(), [effect])

  useImperativeHandle(ref, () => effect, [effect])

  return <primitive object={effect} dispose={null} />
})
