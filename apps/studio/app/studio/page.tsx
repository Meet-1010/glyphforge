"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { GlyphCanvas } from "glyphforge"
import type { CharacterSet, ModelSource } from "glyphforge"
import type { Object3D } from "three"
import { DEFAULT_STATE, decodeState, type StudioState } from "../../lib/config"
import { SourcePanel } from "../../components/source-panel"
import { LookPanel } from "../../components/look-panel"
import { ExportModal } from "../../components/export-modal"
import { Button } from "../../components/ui"
import { saveCreation } from "../../lib/gallery"

export default function StudioPage() {
  const [state, setState] = useState<StudioState>(DEFAULT_STATE)
  const [error, setError] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<"source" | "look">("source")
  const [saveTitle, setSaveTitle] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const objectRef = useRef<Object3D | null>(null)
  const [animations, setAnimations] = useState<string[]>([])
  const [resetToken, setResetToken] = useState(0)

  // Read a shared config from the URL. Done here rather than with
  // `useSearchParams` so the page needs no Suspense boundary.
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("c")
    if (!encoded) return
    const restored = decodeState(encoded)
    if (restored) setState(restored)
  }, [])

  const patch = useCallback((next: Partial<StudioState>) => {
    setState((previous) => ({ ...previous, ...next }))
  }, [])

  const setModel = useCallback(
    (model: ModelSource) => {
      setError(null)
      patch({ model })
    },
    [patch],
  )

  /**
   * Photographs want the opposite of what a lit 3D shape wants: no inversion
   * (bright subject reads as dense glyphs on a dark page), no volume shading
   * exaggeration, a finer grid, and barely any spin so a flat plane does not
   * rotate out of view.
   */
  const tuneForPhoto = useCallback(() => {
    setState((previous) => ({
      ...previous,
      invert: false,
      volumeShading: false,
      cellSize: 6,
      characterSet: "classic",
      postfx: { ...previous.postfx, contrastAdjust: 1.2, brightnessAdjust: 0, dither: 1 },
      motion: { ...previous.motion, autoRotate: 0.12, hoverBoost: 1.6 },
    }))
  }, [])

  const characterSet: CharacterSet =
    state.characterSet === "procedural" ? null : (state.characterSet as CharacterSet)

  const canvasKey = useMemo(
    // Toggling alpha needs a fresh WebGL context, so remount on that one change.
    () => `${state.transparent ? "alpha" : "opaque"}`,
    [state.transparent],
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-rule px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-[13px] font-bold tracking-tight text-bone">
            glyph<span className="text-bone">forge</span>
          </Link>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-bone/30 sm:inline">
            Studio
          </span>
          <Link
            href="/assets"
            className="hidden font-mono text-[11px] text-bone/40 transition-colors hover:text-bone md:inline"
          >
            Assets
          </Link>
          <Link
            href="/community"
            className="hidden font-mono text-[11px] text-bone/40 transition-colors hover:text-bone md:inline"
          >
            Community
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-bone/25 xl:inline">
            drag to rotate · scroll to zoom · shift-drag to pan
          </span>
          <Button onClick={() => setState(DEFAULT_STATE)} variant="ghost">
            Reset
          </Button>
          <Button onClick={() => { setSaved(false); setSaveTitle(defaultTitle(state)) }}>Save</Button>
          <Button variant="primary" onClick={() => setShowExport(true)}>
            Export
          </Button>
        </div>
      </header>

      {/* Mobile panel switcher */}
      <div className="flex shrink-0 gap-1 border-b border-rule p-2 lg:hidden">
        {(["source", "look"] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setMobilePanel(panel)}
            className={`flex-1  px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              mobilePanel === panel ? "bg-bone text-ink" : "text-bone/45"
            }`}
          >
            {panel}
          </button>
        ))}
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_300px]">
        <aside
          className={`min-h-0 overflow-y-auto border-rule lg:border-r lg:block ${
            mobilePanel === "source" ? "block" : "hidden"
          } order-2 lg:order-1`}
        >
          <SourcePanel
            model={state.model}
            onChange={setModel}
            material={state.material}
            onMaterialChange={(material) => patch({ material })}
            onTuneForPhoto={tuneForPhoto}
            error={error}
          />
        </aside>

        <div className="relative order-1 min-h-[42vh] bg-ink lg:order-2 lg:min-h-0">
          {state.transparent && <TransparencyGrid />}
          <GlyphCanvas
            key={canvasKey}
            model={state.model}
            preset={state.preset}
            cellSize={state.cellSize}
            tint={state.useTint ? state.tint : undefined}
            characterSet={characterSet}
            glyphStyle={state.glyphStyle}
            invert={state.invert}
            color={state.color}
            volumeShading={state.volumeShading}
            transparent={state.transparent}
            backgroundColor={state.backgroundColor}
            postfx={state.postfx}
            motion={state.motion}
            material={state.material}
            cameraZ={state.cameraZ}
            controls={{ zoom: true, pan: true, resetToken }}
            maxDpr={2}
            pauseOffscreen={false}
            style={{ position: "absolute", inset: 0, height: "100%" }}
            onReady={({ object, animations: clips }) => {
              objectRef.current = object
              setAnimations(clips)
              setError(null)
            }}
            onError={(nextError) => setError(nextError.message)}
          />

          {/* Viewport controls, floated over the canvas rather than buried in a
              side panel — they act on what you are looking at. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
            <span className="bg-ink/70 px-2 py-1 font-mono text-[9px] leading-relaxed text-bone/35 backdrop-blur-sm lg:hidden">
              drag · pinch to zoom
            </span>
            <span className="hidden bg-ink/70 px-2 py-1 font-mono text-[9px] text-bone/35 backdrop-blur-sm lg:inline xl:hidden">
              scroll to zoom · shift-drag to pan
            </span>
            <div className="pointer-events-auto ml-auto">
              <Button onClick={() => setResetToken((token) => token + 1)}>Reset view</Button>
            </div>
          </div>
        </div>

        <aside
          className={`min-h-0 overflow-y-auto border-rule lg:border-l lg:block ${
            mobilePanel === "look" ? "block" : "hidden"
          } order-3`}
        >
          <LookPanel state={state} onChange={patch} animations={animations} />
        </aside>
      </main>

      {showExport && (
        <ExportModal state={state} object={objectRef.current} onClose={() => setShowExport(false)} />
      )}

      {saveTitle !== null && (
        <SaveDialog
          title={saveTitle}
          saved={saved}
          onTitleChange={setSaveTitle}
          onClose={() => setSaveTitle(null)}
          onSave={() => {
            const result = saveCreation(saveTitle, state)
            if (result) setSaved(true)
          }}
        />
      )}
    </div>
  )
}

function defaultTitle(state: StudioState): string {
  const model = state.model
  if (model.type === "text") return model.value.split("\n")[0].slice(0, 40) || "Untitled"
  if (model.type === "shape") return `${model.shape} · ${state.preset}`
  if (model.type === "image") return `image · ${state.preset}`
  if (model.type === "svg") return `svg · ${state.preset}`
  return `model · ${state.preset}`
}

function SaveDialog({
  title,
  saved,
  onTitleChange,
  onClose,
  onSave,
}: {
  title: string
  saved: boolean
  onTitleChange: (title: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md border border-rule bg-ink-2 p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Save creation"
      >
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">Save</h2>

        {saved ? (
          <>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-bone/55">
              Saved to this browser. It&apos;s on your Community page now.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/community"
                className="bg-bone px-3 py-2 font-mono text-[11px] text-ink transition-colors hover:bg-bone-dim"
              >
                View gallery
              </Link>
              <Button variant="ghost" onClick={onClose}>
                Keep editing
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-bone/30">
              Stored in this browser only — nothing is uploaded, and clearing site data clears it.
            </p>
            <input
              autoFocus
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSave()
                if (event.key === "Escape") onClose()
              }}
              className="mt-4 w-full border border-rule bg-ink px-3 py-2 font-mono text-[12px] text-bone outline-none focus:border-bone"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={onSave}>
                Save
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Checkerboard so transparent mode is visibly transparent, not just black. */
function TransparencyGrid() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(45deg, #17171f 25%, transparent 25%), linear-gradient(-45deg, #17171f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #17171f 75%), linear-gradient(-45deg, transparent 75%, #17171f 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        backgroundColor: "#0e0e13",
      }}
    />
  )
}
