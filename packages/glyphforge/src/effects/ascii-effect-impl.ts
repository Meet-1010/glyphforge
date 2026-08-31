import { BlendFunction, Effect } from "postprocessing"
import {
  Color,
  Uniform,
  Vector2,
  Vector3,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three"
import { asciiFragmentShader } from "./ascii-shader"
import type { AsciiOptions, AsciiPostFX, AsciiStyle, ColorPalette } from "../types"

const STYLE_INDEX: Record<AsciiStyle, number> = {
  standard: 0,
  dense: 1,
  minimal: 2,
  blocks: 3,
}

const PALETTE_INDEX: Record<ColorPalette, number> = {
  none: 0,
  green: 1,
  amber: 2,
  cyan: 3,
  blue: 4,
}

/**
 * Every post-fx default, spelled out.
 *
 * `applyOptions` fills unspecified keys from here rather than leaving the
 * previous value in place. Presets replace `postfx` wholesale with a partial
 * object, so anything a preset does not mention has to be actively reset —
 * otherwise switching away from a preset silently keeps its effects, because
 * the effect instance is long-lived and mutated in place.
 */
const POSTFX_DEFAULTS: Required<AsciiPostFX> = {
  scanlineIntensity: 0,
  scanlineCount: 200,
  targetFPS: 0,
  jitterIntensity: 0,
  jitterSpeed: 1,
  mouseGlowEnabled: false,
  mouseGlowRadius: 200,
  mouseGlowIntensity: 1.5,
  vignetteIntensity: 0,
  vignetteRadius: 0.8,
  colorPalette: "none",
  curvature: 0,
  aberrationStrength: 0,
  noiseIntensity: 0,
  noiseScale: 1,
  noiseSpeed: 1,
  waveAmplitude: 0,
  waveFrequency: 10,
  waveSpeed: 1,
  glitchIntensity: 0,
  glitchFrequency: 0,
  brightnessAdjust: 0,
  contrastAdjust: 1,
  dither: 0,
}

export interface AsciiEffectImplOptions extends AsciiOptions {
  resolution?: Vector2
  mousePos?: Vector2
  glyphAtlas?: Texture | null
  glyphTiles?: number
  /** When false, `time` stops advancing (reduced-motion, or off-screen). */
  animate?: boolean
}

/**
 * The ASCII effect pass.
 *
 * Upstream kept frame state (`time`, `cellSize`, `invert`, `resolution`, …) in
 * module-level variables, so two effects on one page overwrote each other's
 * settings and shared a clock. Everything here is per-instance, and every
 * option is applied by writing uniforms in place — the effect is never
 * reconstructed for a prop change, so the shader compiles exactly once.
 */
export class AsciiEffectImpl extends Effect {
  private _time = 0
  private _frameAccumulator = 0
  private _animate = true
  private _tintColor = new Color()
  private _backgroundColor = new Color()

  constructor(options: AsciiEffectImplOptions = {}) {
    super("GlyphforgeAsciiEffect", asciiFragmentShader, {
      blendFunction: options.transparent ? BlendFunction.NORMAL : BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["cellSize", new Uniform(9)],
        ["invert", new Uniform(true)],
        ["colorMode", new Uniform(true)],
        ["asciiStyle", new Uniform(0)],

        ["glyphAtlas", new Uniform(null)],
        ["glyphTiles", new Uniform(0)],
        ["useGlyphAtlas", new Uniform(false)],

        ["volumeShading", new Uniform(true)],
        ["useTintColor", new Uniform(false)],
        ["tintColor", new Uniform(new Vector3(1, 1, 1))],
        ["transparent", new Uniform(false)],
        ["backgroundColor", new Uniform(new Vector3(0, 0, 0))],
        ["bgThreshold", new Uniform(0.06)],

        ["time", new Uniform(0)],
        ["resolution", new Uniform(new Vector2(1920, 1080))],
        ["mousePos", new Uniform(new Vector2(0, 0))],
        ["targetFPS", new Uniform(0)],

        ["scanlineIntensity", new Uniform(0)],
        ["scanlineCount", new Uniform(200)],
        ["jitterIntensity", new Uniform(0)],
        ["jitterSpeed", new Uniform(1)],
        ["mouseGlowEnabled", new Uniform(false)],
        ["mouseGlowRadius", new Uniform(200)],
        ["mouseGlowIntensity", new Uniform(1.5)],
        ["vignetteIntensity", new Uniform(0)],
        ["vignetteRadius", new Uniform(0.8)],
        ["colorPalette", new Uniform(0)],
        ["curvature", new Uniform(0)],
        ["aberrationStrength", new Uniform(0)],
        ["noiseIntensity", new Uniform(0)],
        ["noiseScale", new Uniform(1)],
        ["noiseSpeed", new Uniform(1)],
        ["waveAmplitude", new Uniform(0)],
        ["waveFrequency", new Uniform(10)],
        ["waveSpeed", new Uniform(1)],
        ["glitchIntensity", new Uniform(0)],
        ["glitchFrequency", new Uniform(0)],
        ["brightnessAdjust", new Uniform(0)],
        ["contrastAdjust", new Uniform(1)],
        ["ditherAmount", new Uniform(0)],
      ]),
    })

    this.applyOptions(options)
  }

  private set<T>(name: string, value: T) {
    const uniform = this.uniforms.get(name)
    if (uniform) uniform.value = value
  }

  /**
   * Apply a complete description of the effect's look.
   *
   * This is declarative, not a patch: any look option left out is reset to its
   * documented default. That matters because the instance is created once and
   * mutated in place, so a "only write what was passed" version leaks settings
   * between presets — switch to a preset that enables pointer glow and every
   * later preset keeps glowing.
   *
   * Frame state (`resolution`, `mousePos`, the glyph atlas, `animate`) is the
   * exception and is only written when supplied, since it is per-frame plumbing
   * rather than part of the look.
   */
  applyOptions(options: AsciiEffectImplOptions) {
    const {
      cellSize = 9,
      invert = true,
      color = true,
      glyphStyle = "standard",
      volumeShading = true,
      tint,
      transparent = false,
      backgroundColor = "#000000",
      bgThreshold = 0.06,
      resolution,
      mousePos,
      glyphAtlas,
      glyphTiles,
      animate,
      postfx,
    } = options

    this.set("cellSize", cellSize)
    this.set("invert", invert)
    this.set("colorMode", color)
    this.set("asciiStyle", STYLE_INDEX[glyphStyle] ?? 0)
    this.set("volumeShading", volumeShading)
    this.set("transparent", transparent)
    this.set("bgThreshold", bgThreshold)

    // An absent tint means "use the scene's own colour", so it must clear the
    // flag rather than leave the last preset's tint switched on.
    this.set("useTintColor", Boolean(tint))
    if (tint) {
      this._tintColor.set(tint)
      this.set("tintColor", new Vector3(this._tintColor.r, this._tintColor.g, this._tintColor.b))
    }

    this._backgroundColor.set(backgroundColor)
    this.set(
      "backgroundColor",
      new Vector3(this._backgroundColor.r, this._backgroundColor.g, this._backgroundColor.b),
    )

    const fx: Required<AsciiPostFX> = { ...POSTFX_DEFAULTS, ...(postfx ?? {}) }

    this.set("scanlineIntensity", fx.scanlineIntensity)
    this.set("scanlineCount", fx.scanlineCount)
    this.set("targetFPS", fx.targetFPS)
    this.set("jitterIntensity", fx.jitterIntensity)
    this.set("jitterSpeed", fx.jitterSpeed)
    this.set("mouseGlowEnabled", fx.mouseGlowEnabled)
    this.set("mouseGlowRadius", fx.mouseGlowRadius)
    this.set("mouseGlowIntensity", fx.mouseGlowIntensity)
    this.set("vignetteIntensity", fx.vignetteIntensity)
    this.set("vignetteRadius", fx.vignetteRadius)
    this.set("colorPalette", PALETTE_INDEX[fx.colorPalette] ?? 0)
    this.set("curvature", fx.curvature)
    this.set("aberrationStrength", fx.aberrationStrength)
    this.set("noiseIntensity", fx.noiseIntensity)
    this.set("noiseScale", fx.noiseScale)
    this.set("noiseSpeed", fx.noiseSpeed)
    this.set("waveAmplitude", fx.waveAmplitude)
    this.set("waveFrequency", fx.waveFrequency)
    this.set("waveSpeed", fx.waveSpeed)
    this.set("glitchIntensity", fx.glitchIntensity)
    this.set("glitchFrequency", fx.glitchFrequency)
    this.set("brightnessAdjust", fx.brightnessAdjust)
    this.set("contrastAdjust", fx.contrastAdjust)
    this.set("ditherAmount", fx.dither)

    // -- frame state: only written when supplied ------------------------------
    if (animate !== undefined) this._animate = animate
    if (resolution !== undefined) this.set("resolution", resolution)
    if (mousePos !== undefined) this.set("mousePos", mousePos)
    if (glyphAtlas !== undefined) {
      this.set("glyphAtlas", glyphAtlas)
      this.set("useGlyphAtlas", Boolean(glyphAtlas))
    }
    if (glyphTiles !== undefined) this.set("glyphTiles", glyphTiles)
  }

  override update(renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, deltaTime = 0) {
    // A lost context makes every uniform write throw; skip the frame instead.
    const context = renderer.getContext() as WebGLRenderingContext | null
    if (!context || context.isContextLost?.()) return

    if (!this._animate) {
      this.uniforms.get("time")!.value = this._time
      return
    }

    const targetFPS = this.uniforms.get("targetFPS")!.value as number
    if (targetFPS > 0) {
      // Quantise the clock so time-driven effects step at `targetFPS` while the
      // scene itself keeps rendering smoothly.
      const frameDuration = 1 / targetFPS
      this._frameAccumulator += deltaTime
      while (this._frameAccumulator >= frameDuration) {
        this._time += frameDuration
        this._frameAccumulator -= frameDuration
      }
    } else {
      this._time += deltaTime
    }

    this.uniforms.get("time")!.value = this._time
  }

  override dispose() {
    // The atlas texture is owned and refcounted by the atlas cache, so it is
    // released by the React layer rather than disposed here.
    this.set("glyphAtlas", null)
    this.set("useGlyphAtlas", false)
    super.dispose()
  }
}
