"use client"

import { PRESET_NAMES, PRESETS, type PresetName } from "glyphforge"
import type { AsciiPostFX } from "glyphforge"
import type { StudioState } from "../lib/config"
import { ColorField, Field, Panel, Segmented, Select, Slider, Toggle } from "./ui"

const RAMPS = [
  { value: "terminal", label: "Terminal" },
  { value: "classic", label: "Classic ASCII" },
  { value: "blocks", label: "Blocks" },
  { value: "shades", label: "Shades" },
  { value: "dots", label: "Dots" },
  { value: "binary", label: "Binary" },
  { value: "katakana", label: "Katakana" },
  { value: "runic", label: "Runic" },
  { value: "procedural", label: "Procedural (no font)" },
]

const PALETTES = [
  { value: "none", label: "None" },
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "cyan", label: "Cyan" },
  { value: "blue", label: "Blue" },
]

const PRESET_BLURBS: Record<PresetName, string> = {
  terminal: "Violet terminal glyphs, punchy contrast",
  matrix: "Katakana rain on a curved green CRT",
  amber: "Warm amber monitor with a soft glow",
  blueprint: "Cyan dots on near-black, very legible",
  brutalist: "Solid blocks, reads like a low-res render",
  glitch: "Broken signal — tearing, jitter, RGB split",
  chromatic: "Keeps the model's own scene colour",
  paper: "Black glyphs on warm white, for light pages",
}

export interface LookPanelProps {
  state: StudioState
  onChange: (patch: Partial<StudioState>) => void
}

export function LookPanel({ state, onChange }: LookPanelProps) {
  const setFx = (patch: Partial<AsciiPostFX>) =>
    onChange({ postfx: { ...state.postfx, ...patch } })

  /** Applying a preset replaces the look wholesale — that's what makes it a preset. */
  const applyPreset = (preset: PresetName) => {
    const p = PRESETS[preset] as Record<string, unknown>
    onChange({
      preset,
      cellSize: (p.cellSize as number) ?? 9,
      invert: (p.invert as boolean) ?? true,
      color: (p.color as boolean) ?? true,
      volumeShading: (p.volumeShading as boolean) ?? true,
      characterSet: (p.characterSet as string) ?? "terminal",
      tint: (p.tint as string) ?? state.tint,
      useTint: p.tint !== undefined,
      backgroundColor: (p.backgroundColor as string) ?? "#000000",
      postfx: { ...((p.postfx as AsciiPostFX) ?? {}) },
    })
  }

  return (
    <>
      <Panel title="Preset">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => applyPreset(name)}
              title={PRESET_BLURBS[name]}
              className={`rounded-md border px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider transition-colors ${
                state.preset === name
                  ? "border-violet bg-violet/10 text-violet"
                  : "border-edge text-white/45 hover:border-edge-bright hover:text-white/75"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-white/30">
          {PRESET_BLURBS[state.preset]}
        </p>
      </Panel>

      <Panel title="Glyphs">
        <Select
          label="Character ramp"
          value={state.characterSet}
          options={RAMPS}
          onChange={(characterSet) => onChange({ characterSet })}
        />
        {state.characterSet === "procedural" && (
          <Segmented
            label="Procedural style"
            value={state.glyphStyle}
            options={[
              { value: "standard", label: "Std" },
              { value: "dense", label: "Dense" },
              { value: "minimal", label: "Min" },
              { value: "blocks", label: "Blocks" },
            ]}
            onChange={(glyphStyle) => onChange({ glyphStyle })}
          />
        )}
        <Slider
          label="Cell size"
          min={4}
          max={28}
          step={1}
          value={state.cellSize}
          format={(v) => `${Math.round(v)}px`}
          onChange={(cellSize) => onChange({ cellSize })}
        />
        <Toggle label="Invert brightness" checked={state.invert} onChange={(invert) => onChange({ invert })} />
        <Toggle label="Colour" checked={state.color} onChange={(color) => onChange({ color })} />
        <Toggle
          label="Volume shading"
          checked={state.volumeShading}
          onChange={(volumeShading) => onChange({ volumeShading })}
        />
      </Panel>

      <Panel title="Colour">
        <Toggle
          label="Flat tint"
          checked={state.useTint}
          onChange={(useTint) => onChange({ useTint })}
        />
        {state.useTint && (
          <ColorField label="Tint" value={state.tint} onChange={(tint) => onChange({ tint })} />
        )}
        <Toggle
          label="Transparent background"
          checked={state.transparent}
          onChange={(transparent) => onChange({ transparent })}
        />
        {!state.transparent && (
          <ColorField
            label="Background"
            value={state.backgroundColor}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
          />
        )}
        <Select
          label="CRT palette"
          value={state.postfx.colorPalette ?? "none"}
          options={PALETTES}
          onChange={(colorPalette) => setFx({ colorPalette: colorPalette as AsciiPostFX["colorPalette"] })}
        />
        <p className="font-mono text-[10px] leading-relaxed text-white/30">
          Transparent mode drops the background entirely so the hero composites over whatever your
          page already has behind it.
        </p>
      </Panel>

      <Panel title="Grade">
        <Slider
          label="Contrast"
          min={0.5}
          max={3.5}
          step={0.05}
          value={state.postfx.contrastAdjust ?? 1}
          onChange={(contrastAdjust) => setFx({ contrastAdjust })}
        />
        <Slider
          label="Brightness"
          min={-0.5}
          max={0.5}
          step={0.01}
          value={state.postfx.brightnessAdjust ?? 0}
          onChange={(brightnessAdjust) => setFx({ brightnessAdjust })}
        />
        <Slider
          label="Dither"
          min={0}
          max={2}
          step={0.05}
          value={state.postfx.dither ?? 0}
          onChange={(dither) => setFx({ dither })}
        />
        <p className="font-mono text-[10px] leading-relaxed text-white/30">
          Dithering recovers gradients that the glyph ramp would otherwise band into flat steps.
          Turn it up for photographs, leave it at zero for hard-edged logos.
        </p>
      </Panel>

      <Panel title="CRT">
        <Slider
          label="Scanlines"
          min={0}
          max={1}
          step={0.01}
          value={state.postfx.scanlineIntensity ?? 0}
          onChange={(scanlineIntensity) => setFx({ scanlineIntensity })}
        />
        <Slider
          label="Scanline count"
          min={60}
          max={600}
          step={10}
          value={state.postfx.scanlineCount ?? 200}
          format={(v) => String(Math.round(v))}
          onChange={(scanlineCount) => setFx({ scanlineCount })}
        />
        <Slider
          label="Curvature"
          min={0}
          max={0.4}
          step={0.005}
          value={state.postfx.curvature ?? 0}
          onChange={(curvature) => setFx({ curvature })}
        />
        <Slider
          label="Vignette"
          min={0}
          max={1}
          step={0.01}
          value={state.postfx.vignetteIntensity ?? 0}
          onChange={(vignetteIntensity) => setFx({ vignetteIntensity })}
        />
        <Slider
          label="Frame rate lock"
          min={0}
          max={60}
          step={1}
          value={state.postfx.targetFPS ?? 0}
          format={(v) => (v === 0 ? "smooth" : `${Math.round(v)} fps`)}
          onChange={(targetFPS) => setFx({ targetFPS })}
        />
      </Panel>

      <Panel title="Distortion">
        <Slider
          label="RGB split"
          min={0}
          max={0.02}
          step={0.0005}
          value={state.postfx.aberrationStrength ?? 0}
          format={(v) => v.toFixed(4)}
          onChange={(aberrationStrength) => setFx({ aberrationStrength })}
        />
        <Slider
          label="Glitch"
          min={0}
          max={0.4}
          step={0.005}
          value={state.postfx.glitchIntensity ?? 0}
          onChange={(glitchIntensity) => setFx({ glitchIntensity })}
        />
        <Slider
          label="Glitch rate"
          min={0}
          max={30}
          step={1}
          value={state.postfx.glitchFrequency ?? 0}
          format={(v) => `${Math.round(v)}/s`}
          onChange={(glitchFrequency) => setFx({ glitchFrequency })}
        />
        <Slider
          label="Jitter"
          min={0}
          max={2}
          step={0.01}
          value={state.postfx.jitterIntensity ?? 0}
          onChange={(jitterIntensity) => setFx({ jitterIntensity })}
        />
        <Slider
          label="Grain"
          min={0}
          max={0.4}
          step={0.005}
          value={state.postfx.noiseIntensity ?? 0}
          onChange={(noiseIntensity) => setFx({ noiseIntensity })}
        />
        <Slider
          label="Wave"
          min={0}
          max={0.06}
          step={0.001}
          value={state.postfx.waveAmplitude ?? 0}
          format={(v) => v.toFixed(3)}
          onChange={(waveAmplitude) => setFx({ waveAmplitude })}
        />
      </Panel>

      <Panel title="Glow">
        <Toggle
          label="Follow pointer"
          checked={state.postfx.mouseGlowEnabled ?? false}
          onChange={(mouseGlowEnabled) => setFx({ mouseGlowEnabled })}
        />
        {state.postfx.mouseGlowEnabled && (
          <>
            <Slider
              label="Radius"
              min={40}
              max={600}
              step={10}
              value={state.postfx.mouseGlowRadius ?? 200}
              format={(v) => `${Math.round(v)}px`}
              onChange={(mouseGlowRadius) => setFx({ mouseGlowRadius })}
            />
            <Slider
              label="Intensity"
              min={0}
              max={2}
              step={0.05}
              value={state.postfx.mouseGlowIntensity ?? 1.5}
              onChange={(mouseGlowIntensity) => setFx({ mouseGlowIntensity })}
            />
          </>
        )}
      </Panel>

      <Panel title="Motion">
        <Slider
          label="Spin speed"
          min={0}
          max={2}
          step={0.05}
          value={state.motion.autoRotate ?? 0.4}
          onChange={(autoRotate) => onChange({ motion: { ...state.motion, autoRotate } })}
        />
        <Slider
          label="Hover boost"
          min={1}
          max={6}
          step={0.1}
          value={state.motion.hoverBoost ?? 2}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(hoverBoost) => onChange({ motion: { ...state.motion, hoverBoost } })}
        />
        <Slider
          label="Hover zoom"
          min={1}
          max={2}
          step={0.01}
          value={state.motion.hoverZoom ?? 1.1}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(hoverZoom) => onChange({ motion: { ...state.motion, hoverZoom } })}
        />
        <Toggle
          label="Auto-frame camera"
          checked={state.cameraZ === "auto"}
          onChange={(auto) => onChange({ cameraZ: auto ? "auto" : 4.5 })}
        />
        {state.cameraZ !== "auto" && (
          <Slider
            label="Camera distance"
            min={2.5}
            max={9}
            step={0.1}
            value={state.cameraZ}
            onChange={(cameraZ) => onChange({ cameraZ })}
          />
        )}
        <Toggle
          label="Drag to rotate"
          checked={state.motion.draggable ?? true}
          onChange={(draggable) => onChange({ motion: { ...state.motion, draggable } })}
        />
        <Field label="Accessibility">
          <p className="font-mono text-[10px] leading-relaxed text-white/30">
            Auto-rotation and time-based effects stop automatically for visitors with
            <span className="text-white/50"> prefers-reduced-motion</span> set. Rendering also pauses
            when the hero scrolls out of view.
          </p>
        </Field>
      </Panel>
    </>
  )
}
