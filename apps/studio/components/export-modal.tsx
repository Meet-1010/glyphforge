"use client"

import { useEffect, useMemo, useState } from "react"
import { downloadModel } from "glyphforge"
import type { Object3D } from "three"
import { generateCode, isEphemeral, shareUrl, type StudioState } from "../lib/config"
import { Button, CopyButton, Segmented } from "./ui"

type Tab = "component" | "install" | "model" | "share"

export interface ExportModalProps {
  state: StudioState
  object: Object3D | null
  onClose: () => void
}

export function ExportModal({ state, object, onClose }: ExportModalProps) {
  const [tab, setTab] = useState<Tab>("component")
  const [component, setComponent] = useState<"hero" | "canvas">("hero")
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const code = useMemo(() => generateCode(state, { component }), [state, component])
  const link = useMemo(() => shareUrl(state), [state])
  const ephemeral = isEphemeral(state.model)

  const handleDownload = async () => {
    if (!object) return
    setExporting(true)
    setExportError(null)
    try {
      await downloadModel(object, "glyphforge-model.glb")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-rule bg-ink-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export"
      >
        <header className="flex items-center justify-between border-b border-rule px-5 py-4">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">Export</h2>
            <p className="mt-1 font-mono text-[10px] text-bone/30">
              Everything here runs in your browser. Nothing was uploaded.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="border-b border-rule px-5 py-3">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "component", label: "Component" },
              { value: "install", label: "Install" },
              { value: "model", label: "Model" },
              { value: "share", label: "Share" },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "component" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Segmented
                  value={component}
                  onChange={setComponent}
                  options={[
                    { value: "hero", label: "Full hero" },
                    { value: "canvas", label: "Canvas only" },
                  ]}
                />
                <CopyButton text={code} label="Copy code" variant="primary" />
              </div>
              <Code>{code}</Code>
              <p className="font-mono text-[10px] leading-relaxed text-bone/35">
                Only the props that differ from the{" "}
                <span className="text-bone">{state.preset}</span> preset are written out, so this
                stays readable. Save it as{" "}
                <span className="text-bone/60">components/ascii-hero.tsx</span>.
              </p>
              {ephemeral && (
                <Warning>
                  Your model came from a local file, so <code>src</code> points at a temporary
                  blob URL that dies with this tab. Download the model below and reference it from
                  your <code>public/</code> folder instead.
                </Warning>
              )}
            </div>
          )}

          {tab === "install" && (
            <div className="space-y-5">
              <Step
                n={1}
                title="Add the package"
                body="Peer dependencies are three and the React Three Fiber stack."
              >
                <CommandRow command="npm install glyphforge three @react-three/fiber @react-three/postprocessing postprocessing" />
              </Step>
              <Step n={2} title="Or scaffold it" body="Detects your framework and writes the component for you.">
                <CommandRow command="npx glyphforge init --yes" />
              </Step>
              <Step
                n={3}
                title="Prefer to own the source?"
                body="Copies the real source into your repo — no runtime dependency on the package."
              >
                <CommandRow command="npx glyphforge add hero" />
              </Step>
            </div>
          )}

          {tab === "model" && (
            <div className="space-y-4">
              <p className="font-mono text-[11px] leading-relaxed text-bone/50">
                Download what you forged as a standard <span className="text-bone">.glb</span>. It
                opens in Blender, Unity, Godot, or any glTF viewer — this is a real mesh, not a
                screenshot.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={handleDownload} disabled={!object || exporting}>
                  {exporting ? "Exporting…" : "Download .glb"}
                </Button>
                {!object && (
                  <span className="font-mono text-[10px] text-bone/30">
                    Waiting for the model to finish building…
                  </span>
                )}
              </div>
              {exportError && <Warning>{exportError}</Warning>}
              <p className="font-mono text-[10px] leading-relaxed text-bone/30">
                Once downloaded, drop it in <span className="text-bone/55">public/models/</span> and
                switch the component to{" "}
                <span className="text-bone/55">{`model={{ type: "url", src: "/models/glyphforge-model.glb" }}`}</span>
                .
              </p>
            </div>
          )}

          {tab === "share" && (
            <div className="space-y-4">
              {link ? (
                <>
                  <p className="font-mono text-[11px] leading-relaxed text-bone/50">
                    This link restores every setting on this page. The whole config is encoded in the
                    URL — there's no server holding it.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={link}
                      onFocus={(event) => event.target.select()}
                      className="w-full truncate rounded-[var(--radius-pill)] border border-rule bg-ink px-4 py-2 font-mono text-[10px] text-bone/60 outline-none"
                    />
                    <CopyButton text={link} label="Copy link" variant="primary" />
                  </div>
                </>
              ) : (
                <Warning>
                  Configs using an uploaded file can&apos;t be shared as a link — the file only exists
                  in this browser tab. Download the <code>.glb</code>, host it, then point the model
                  source at that URL.
                </Warning>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-[var(--radius-md)] border border-rule bg-ink p-4 font-mono text-[11px] leading-relaxed text-bone/75">
      <code>{children}</code>
    </pre>
  )
}

function CommandRow({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="w-full overflow-x-auto whitespace-nowrap rounded-[var(--radius-sm)] border border-rule bg-ink px-3 py-2 font-mono text-[10px] text-bone">
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  )
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-rule-bright font-mono text-[10px] text-bone/45">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="font-mono text-[11px] text-bone/80">{title}</h3>
        <p className="font-mono text-[10px] leading-relaxed text-bone/35">{body}</p>
        {children}
      </div>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-rule-bright bg-ink-3 px-3 py-2 font-mono text-[10px] leading-relaxed text-bone-dim">
      {children}
    </p>
  )
}
