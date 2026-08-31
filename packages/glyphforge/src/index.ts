/**
 * Glyphforge — drop-in WebGL ASCII hero sections for React.
 *
 * Derived in part from webgl-ascii-hero (MIT, (c) 2025 egorshest).
 * See NOTICE at the repository root.
 */

// Components
export { GlyphHero, type GlyphHeroProps } from "./components/glyph-hero"
export { GlyphCanvas, type GlyphCanvasProps } from "./components/glyph-canvas"
export { GlyphScene, type GlyphSceneProps } from "./components/glyph-scene"
export {
  GlyphModel,
  fitObject,
  disposeObject,
  type GlyphModelProps,
  type GlyphModelResult,
} from "./components/glyph-model"

// Effect
export { AsciiEffect, type AsciiEffectProps } from "./effects/ascii-effect"
export { AsciiEffectImpl, type AsciiEffectImplOptions } from "./effects/ascii-effect-impl"
export { asciiFragmentShader } from "./effects/ascii-shader"
export { GLYPH_RAMPS, acquireGlyphAtlas, resolveCharacters, type GlyphAtlas } from "./effects/glyph-atlas"

// Looks
export { PRESETS, PRESET_NAMES, resolvePreset, type PresetName } from "./presets"

// Hooks
export { useInView } from "./hooks/use-in-view"
export { useReducedMotion } from "./hooks/use-reduced-motion"

// Model forge — also available standalone from "glyphforge/forge"
export {
  forgeGeometry,
  forgeText,
  forgeSvg,
  forgeImage,
  forgeShape,
  exportModel,
  downloadModel,
  downloadBlob,
  isForgeable,
  SHAPE_KINDS,
  DEFAULT_MODEL,
  DEFAULT_TEXT_FONT,
  type ForgeableSource,
  type ExportOptions,
} from "./forge"

// Types
export type {
  AsciiOptions,
  AsciiPostFX,
  AsciiStyle,
  ControlOptions,
  CharacterSet,
  ColorPalette,
  GlyphRampName,
  ImageModelSource,
  ModelSource,
  MotionOptions,
  ShapeKind,
  ShapeModelSource,
  SvgModelSource,
  TextModelSource,
  UrlModelSource,
} from "./types"
