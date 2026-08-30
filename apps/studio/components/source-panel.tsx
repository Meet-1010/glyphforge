"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SHAPE_KINDS, type ModelSource, type ShapeKind } from "glyphforge"
import { Button, ColorField, Field, Panel, Segmented, Select, Slider, TextInput, Toggle } from "./ui"

type SourceKind = "text" | "shape" | "image" | "svg" | "upload"

const FONT_STACKS = [
  { value: "system-ui, -apple-system, Segoe UI, sans-serif", label: "System Sans" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "ui-monospace, SFMono-Regular, Menlo, monospace", label: "Monospace" },
  { value: "Impact, Haettenschweiler, sans-serif", label: "Impact" },
  { value: "'Courier New', monospace", label: "Courier" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
]

const WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "700", label: "Bold" },
  { value: "900", label: "Black" },
]

const SHAPE_LABELS: Record<ShapeKind, string> = {
  torusKnot: "Torus knot",
  blob: "Blob",
  crystal: "Crystal",
  helix: "Helix",
  sphere: "Sphere",
  torus: "Torus",
  box: "Box",
  capsule: "Capsule",
  gear: "Gear",
}

function kindOf(model: ModelSource): SourceKind {
  if (model.type === "url") return "upload"
  return model.type
}

export interface SourcePanelProps {
  model: ModelSource
  onChange: (model: ModelSource) => void
  material: { color: string; roughness: number; metalness: number }
  onMaterialChange: (material: { color: string; roughness: number; metalness: number }) => void
  error: string | null
}

export function SourcePanel({
  model,
  onChange,
  material,
  onMaterialChange,
  error,
}: SourcePanelProps) {
  const kind = kindOf(model)

  // Object URLs from file pickers leak unless revoked when replaced.
  const objectUrlRef = useRef<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const takeFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setFileName(file.name)
    return url
  }, [])

  const switchKind = (next: SourceKind) => {
    if (next === kind) return
    switch (next) {
      case "text":
        return onChange({ type: "text", value: "GLYPH", depth: 0.35, bevel: 0.02 })
      case "shape":
        return onChange({ type: "shape", shape: "torusKnot", detail: 128, distortion: 0.35, seed: 1 })
      case "image":
        return onChange({ type: "image", src: "", mode: "relief", depth: 0.4, resolution: 160 })
      case "svg":
        return onChange({ type: "svg", markup: SAMPLE_SVG, depth: 0.35, bevel: 0.02 })
      case "upload":
        return onChange({ type: "url", src: "" })
    }
  }

  return (
    <>
      <Panel title="Source">
        <Segmented
          value={kind}
          onChange={switchKind}
          options={[
            { value: "text", label: "Text" },
            { value: "shape", label: "Shape" },
            { value: "image", label: "Image" },
            { value: "svg", label: "SVG" },
            { value: "upload", label: "GLB" },
          ]}
        />

        {error && (
          <p className="rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2 font-mono text-[10px] leading-relaxed text-red-300/80">
            {error}
          </p>
        )}

        {model.type === "text" && <TextControls model={model} onChange={onChange} />}
        {model.type === "shape" && <ShapeControls model={model} onChange={onChange} />}
        {model.type === "image" && (
          <ImageControls model={model} onChange={onChange} takeFile={takeFile} fileName={fileName} />
        )}
        {model.type === "svg" && (
          <SvgControls model={model} onChange={onChange} takeFile={takeFile} fileName={fileName} />
        )}
        {model.type === "url" && (
          <UploadControls model={model} onChange={onChange} takeFile={takeFile} fileName={fileName} />
        )}
      </Panel>

      <Panel title="Material">
        <p className="font-mono text-[10px] leading-relaxed text-white/30">
          The ASCII pass reads luminance, so lighting matters more than hue. Lower roughness gives
          sharper highlights and more character contrast.
        </p>
        <ColorField
          label="Surface"
          value={material.color}
          onChange={(color) => onMaterialChange({ ...material, color })}
        />
        <Slider
          label="Roughness"
          min={0}
          max={1}
          step={0.01}
          value={material.roughness}
          onChange={(roughness) => onMaterialChange({ ...material, roughness })}
        />
        <Slider
          label="Metalness"
          min={0}
          max={1}
          step={0.01}
          value={material.metalness}
          onChange={(metalness) => onMaterialChange({ ...material, metalness })}
        />
      </Panel>
    </>
  )
}

function TextControls({
  model,
  onChange,
}: {
  model: Extract<ModelSource, { type: "text" }>
  onChange: (model: ModelSource) => void
}) {
  // The font shorthand is stored as one string; edit it as three fields.
  const parsed = parseFont(model.font)

  const setFont = (next: Partial<ReturnType<typeof parseFont>>) => {
    const merged = { ...parsed, ...next }
    onChange({ ...model, font: `${merged.weight} ${merged.size}px ${merged.family}` })
  }

  return (
    <>
      <TextInput
        label="Text"
        value={model.value}
        multiline
        placeholder="SHIP IT"
        onChange={(value) => onChange({ ...model, value })}
      />
      <Select
        label="Typeface"
        value={parsed.family}
        options={FONT_STACKS}
        onChange={(family) => setFont({ family })}
      />
      <Segmented
        label="Weight"
        value={parsed.weight}
        options={WEIGHTS}
        onChange={(weight) => setFont({ weight })}
      />
      <Slider
        label="Depth"
        min={0.02}
        max={1.2}
        step={0.01}
        value={model.depth ?? 0.35}
        onChange={(depth) => onChange({ ...model, depth })}
      />
      <Slider
        label="Bevel"
        min={0}
        max={0.12}
        step={0.005}
        value={model.bevel ?? 0.02}
        onChange={(bevel) => onChange({ ...model, bevel })}
      />
      <Slider
        label="Trace detail"
        min={192}
        max={1024}
        step={64}
        value={model.resolution ?? 512}
        format={(v) => `${v}px`}
        onChange={(resolution) => onChange({ ...model, resolution })}
      />
      <Slider
        label="Smoothing"
        min={0.2}
        max={4}
        step={0.1}
        value={model.smoothing ?? 1.2}
        onChange={(smoothing) => onChange({ ...model, smoothing })}
      />
      <p className="font-mono text-[10px] leading-relaxed text-white/30">
        Emoji work too. Higher trace detail keeps fine serifs; higher smoothing gives chunkier,
        more legible glyphs once the ASCII pass halves the resolution again.
      </p>
    </>
  )
}

function ShapeControls({
  model,
  onChange,
}: {
  model: Extract<ModelSource, { type: "shape" }>
  onChange: (model: ModelSource) => void
}) {
  return (
    <>
      <Select
        label="Shape"
        value={model.shape}
        options={SHAPE_KINDS.map((s) => ({ value: s, label: SHAPE_LABELS[s] }))}
        onChange={(shape) => onChange({ ...model, shape })}
      />
      <Slider
        label="Detail"
        min={16}
        max={384}
        step={8}
        value={model.detail ?? 128}
        format={(v) => String(Math.round(v))}
        onChange={(detail) => onChange({ ...model, detail })}
      />
      <Slider
        label="Distortion"
        min={0}
        max={1}
        step={0.01}
        value={model.distortion ?? 0.35}
        onChange={(distortion) => onChange({ ...model, distortion })}
      />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Slider
            label="Seed"
            min={1}
            max={999}
            step={1}
            value={model.seed ?? 1}
            format={(v) => String(Math.round(v))}
            onChange={(seed) => onChange({ ...model, seed })}
          />
        </div>
        <Button onClick={() => onChange({ ...model, seed: Math.floor(Math.random() * 999) + 1 })}>
          Roll
        </Button>
      </div>
    </>
  )
}

function ImageControls({
  model,
  onChange,
  takeFile,
  fileName,
}: {
  model: Extract<ModelSource, { type: "image" }>
  onChange: (model: ModelSource) => void
  takeFile: (file: File) => string
  fileName: string | null
}) {
  return (
    <>
      <FilePicker
        accept="image/*"
        label={fileName ?? "Choose an image"}
        onPick={(file) => onChange({ ...model, src: takeFile(file) })}
      />
      <TextInput
        label="…or an image URL"
        value={model.src.startsWith("blob:") ? "" : model.src}
        placeholder="https://example.com/logo.png"
        onChange={(src) => onChange({ ...model, src })}
      />
      <Segmented
        label="Mode"
        value={model.mode ?? "relief"}
        options={[
          { value: "relief", label: "Relief" },
          { value: "extrude", label: "Extrude" },
        ]}
        onChange={(mode) => onChange({ ...model, mode })}
      />
      <Slider
        label="Depth"
        min={0.05}
        max={1.5}
        step={0.01}
        value={model.depth ?? 0.4}
        onChange={(depth) => onChange({ ...model, depth })}
      />
      {model.mode === "extrude" ? (
        <>
          <Slider
            label="Threshold"
            min={0.05}
            max={0.95}
            step={0.01}
            value={model.threshold ?? 0.5}
            onChange={(threshold) => onChange({ ...model, threshold })}
          />
          <Slider
            label="Trace detail"
            min={128}
            max={1024}
            step={64}
            value={model.resolution ?? 512}
            format={(v) => `${v}px`}
            onChange={(resolution) => onChange({ ...model, resolution })}
          />
        </>
      ) : (
        <>
          <Slider
            label="Grid detail"
            min={32}
            max={320}
            step={8}
            value={model.resolution ?? 160}
            format={(v) => `${v}²`}
            onChange={(resolution) => onChange({ ...model, resolution })}
          />
          <Toggle
            label="Solid (mirror + rim)"
            checked={model.double ?? false}
            onChange={(double) => onChange({ ...model, double })}
          />
        </>
      )}
      <p className="font-mono text-[10px] leading-relaxed text-white/30">
        Relief suits photos and depth maps. Extrude suits flat logos — it traces the silhouette and
        pushes it out. Remote images need CORS headers; uploads always work.
      </p>
    </>
  )
}

function SvgControls({
  model,
  onChange,
  takeFile,
  fileName,
}: {
  model: Extract<ModelSource, { type: "svg" }>
  onChange: (model: ModelSource) => void
  takeFile: (file: File) => string
  fileName: string | null
}) {
  return (
    <>
      <FilePicker
        accept=".svg,image/svg+xml"
        label={fileName ?? "Choose an SVG"}
        onPick={async (file) => {
          void takeFile(file)
          // Inlining the markup keeps the source shareable and avoids a fetch.
          const markup = await file.text()
          onChange({ type: "svg", markup, depth: model.depth, bevel: model.bevel })
        }}
      />
      <TextInput
        label="…or paste SVG markup"
        value={model.markup ?? ""}
        multiline
        placeholder="<svg viewBox='0 0 24 24'>…</svg>"
        onChange={(markup) => onChange({ type: "svg", markup, depth: model.depth, bevel: model.bevel })}
      />
      <Slider
        label="Depth"
        min={0.02}
        max={1.2}
        step={0.01}
        value={model.depth ?? 0.35}
        onChange={(depth) => onChange({ ...model, depth })}
      />
      <Slider
        label="Bevel"
        min={0}
        max={0.12}
        step={0.005}
        value={model.bevel ?? 0.02}
        onChange={(bevel) => onChange({ ...model, bevel })}
      />
      <p className="font-mono text-[10px] leading-relaxed text-white/30">
        Filled paths extrude cleanly. Strokes do not — outline them first in your editor.
      </p>
    </>
  )
}

function UploadControls({
  model,
  onChange,
  takeFile,
  fileName,
}: {
  model: Extract<ModelSource, { type: "url" }>
  onChange: (model: ModelSource) => void
  takeFile: (file: File) => string
  fileName: string | null
}) {
  return (
    <>
      <FilePicker
        accept=".glb,.gltf,model/gltf-binary"
        label={fileName ?? "Choose a .glb file"}
        onPick={(file) => onChange({ type: "url", src: takeFile(file) })}
      />
      <TextInput
        label="…or a model URL"
        value={model.src.startsWith("blob:") ? "" : model.src}
        placeholder="/models/mine.glb"
        onChange={(src) => onChange({ type: "url", src })}
      />
      <p className="font-mono text-[10px] leading-relaxed text-white/30">
        Auto-fitted and centred on load, so no scale guessing. Uploads stay in your browser — nothing
        is sent anywhere.
      </p>
    </>
  )
}

function FilePicker({
  accept,
  label,
  onPick,
}: {
  accept: string
  label: string
  onPick: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Field label="File">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full truncate rounded-md border border-dashed border-edge-bright bg-ink px-3 py-3 text-left font-mono text-[11px] text-white/55 transition-colors hover:border-violet hover:text-white/80"
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          // Reset so picking the same file twice still fires.
          event.target.value = ""
        }}
      />
    </Field>
  )
}

function parseFont(font?: string) {
  const fallback = { weight: "700", size: 200, family: FONT_STACKS[0].value }
  if (!font) return fallback
  const match = font.match(/^\s*(\d+)\s+(\d+(?:\.\d+)?)px\s+(.+)$/)
  if (!match) return fallback
  return { weight: match[1], size: Number(match[2]), family: match[3] }
}

const SAMPLE_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 5 L61 39 L97 39 L68 60 L79 95 L50 74 L21 95 L32 60 L3 39 L39 39 Z" fill="black"/>
</svg>`
