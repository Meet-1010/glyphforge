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
import type { AsciiOptions, AsciiStyle, ColorPalette } from "../types"

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
      ]),
    })

    this.applyOptions(options)
  }

  private set<T>(name: string, value: T) {
    const uniform = this.uniforms.get(name)
    if (uniform) uniform.value = value
  }

  /** Write every supplied option into its uniform. Safe to call every render. */
  applyOptions(options: AsciiEffectImplOptions) {
    const {
      cellSize,
      invert,
      color,
      glyphStyle,
      volumeShading,
      tint,
      transparent,
      backgroundColor,
      bgThreshold,
      resolution,
      mousePos,
      glyphAtlas,
      glyphTiles,
      animate,
      postfx,
    } = options

    if (cellSize !== undefined) this.set("cellSize", cellSize)
    if (invert !== undefined) this.set("invert", invert)
    if (color !== undefined) this.set("colorMode", color)
    if (glyphStyle !== undefined) this.set("asciiStyle", STYLE_INDEX[glyphStyle] ?? 0)
    if (volumeShading !== undefined) this.set("volumeShading", volumeShading)
    if (transparent !== undefined) this.set("transparent", transparent)
    if (bgThreshold !== undefined) this.set("bgThreshold", bgThreshold)
    if (animate !== undefined) this._animate = animate

    if (tint !== undefined) {
      this.set("useTintColor", Boolean(tint))
      if (tint) {
        this._tintColor.set(tint)
        this.set("tintColor", new Vector3(this._tintColor.r, this._tintColor.g, this._tintColor.b))
      }
    }

    if (backgroundColor !== undefined) {
      this._backgroundColor.set(backgroundColor)
      this.set(
        "backgroundColor",
        new Vector3(this._backgroundColor.r, this._backgroundColor.g, this._backgroundColor.b),
      )
    }

    if (resolution !== undefined) this.set("resolution", resolution)
    if (mousePos !== undefined) this.set("mousePos", mousePos)

    if (glyphAtlas !== undefined) {
      this.set("glyphAtlas", glyphAtlas)
      this.set("useGlyphAtlas", Boolean(glyphAtlas))
    }
    if (glyphTiles !== undefined) this.set("glyphTiles", glyphTiles)

    if (postfx) {
      const fx = postfx
      if (fx.scanlineIntensity !== undefined) this.set("scanlineIntensity", fx.scanlineIntensity)
      if (fx.scanlineCount !== undefined) this.set("scanlineCount", fx.scanlineCount)
      if (fx.targetFPS !== undefined) this.set("targetFPS", fx.targetFPS)
      if (fx.jitterIntensity !== undefined) this.set("jitterIntensity", fx.jitterIntensity)
      if (fx.jitterSpeed !== undefined) this.set("jitterSpeed", fx.jitterSpeed)
      if (fx.mouseGlowEnabled !== undefined) this.set("mouseGlowEnabled", fx.mouseGlowEnabled)
      if (fx.mouseGlowRadius !== undefined) this.set("mouseGlowRadius", fx.mouseGlowRadius)
      if (fx.mouseGlowIntensity !== undefined) this.set("mouseGlowIntensity", fx.mouseGlowIntensity)
      if (fx.vignetteIntensity !== undefined) this.set("vignetteIntensity", fx.vignetteIntensity)
      if (fx.vignetteRadius !== undefined) this.set("vignetteRadius", fx.vignetteRadius)
      if (fx.colorPalette !== undefined) {
        this.set("colorPalette", PALETTE_INDEX[fx.colorPalette] ?? 0)
      }
      if (fx.curvature !== undefined) this.set("curvature", fx.curvature)
      if (fx.aberrationStrength !== undefined) this.set("aberrationStrength", fx.aberrationStrength)
      if (fx.noiseIntensity !== undefined) this.set("noiseIntensity", fx.noiseIntensity)
      if (fx.noiseScale !== undefined) this.set("noiseScale", fx.noiseScale)
      if (fx.noiseSpeed !== undefined) this.set("noiseSpeed", fx.noiseSpeed)
      if (fx.waveAmplitude !== undefined) this.set("waveAmplitude", fx.waveAmplitude)
      if (fx.waveFrequency !== undefined) this.set("waveFrequency", fx.waveFrequency)
      if (fx.waveSpeed !== undefined) this.set("waveSpeed", fx.waveSpeed)
      if (fx.glitchIntensity !== undefined) this.set("glitchIntensity", fx.glitchIntensity)
      if (fx.glitchFrequency !== undefined) this.set("glitchFrequency", fx.glitchFrequency)
      if (fx.brightnessAdjust !== undefined) this.set("brightnessAdjust", fx.brightnessAdjust)
      if (fx.contrastAdjust !== undefined) this.set("contrastAdjust", fx.contrastAdjust)
    }
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
