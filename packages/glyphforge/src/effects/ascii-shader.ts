/**
 * Glyphforge ASCII post-processing fragment shader.
 *
 * Derived from webgl-ascii-hero (https://github.com/egorshest/webgl-ascii-hero),
 * Copyright (c) 2025 egorshest, MIT licensed. See NOTICE at the repository root.
 *
 * Modifications by Glyphforge:
 *   - `asciiStyle` 1..3 (dense / minimal / blocks) are actually implemented;
 *     upstream declared them in the public API but always returned 0.
 *   - Added `transparent` + `backgroundColor` so the effect can composite over
 *     an arbitrary page background instead of being locked to opaque black.
 *   - Added `bgThreshold` so the background cut-off is tunable per model
 *     instead of being a hard-coded 0.06 luminance constant.
 *   - Background/empty-cell logic writes alpha, not just black.
 */
export const asciiFragmentShader = /* glsl */ `
// --- Core -------------------------------------------------------------------
uniform float cellSize;
uniform bool  invert;
uniform bool  colorMode;
uniform int   asciiStyle;

// --- Glyph atlas ------------------------------------------------------------
uniform sampler2D glyphAtlas;
uniform float     glyphTiles;
uniform bool      useGlyphAtlas;

// --- Look -------------------------------------------------------------------
uniform bool  volumeShading;
uniform bool  useTintColor;
uniform vec3  tintColor;
uniform bool  transparent;
uniform vec3  backgroundColor;
uniform float bgThreshold;

// --- Frame state ------------------------------------------------------------
uniform float time;
uniform vec2  resolution;
uniform vec2  mousePos;
uniform float targetFPS;

// --- PostFX -----------------------------------------------------------------
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float jitterIntensity;
uniform float jitterSpeed;
uniform bool  mouseGlowEnabled;
uniform float mouseGlowRadius;
uniform float mouseGlowIntensity;
uniform float vignetteIntensity;
uniform float vignetteRadius;
uniform int   colorPalette;
uniform float curvature;
uniform float aberrationStrength;
uniform float noiseIntensity;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float waveSpeed;
uniform float glitchIntensity;
uniform float glitchFrequency;
uniform float brightnessAdjust;
uniform float contrastAdjust;
uniform float ditherAmount;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Compact recursive ordered-dither construction, no array lookups so it works
// on both GLSL1 and GLSL3 targets.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(a * 0.5) * 0.25 + bayer2(a);
}

vec3 applyColorPalette(vec3 color, int palette) {
  float lum = dot(color, LUMA);
  if (palette == 1) return vec3(0.1, lum * 0.9, 0.1);              // green phosphor
  if (palette == 2) return vec3(lum, lum * 0.6, lum * 0.2);        // amber
  if (palette == 3) return vec3(0.0, lum * 0.8, lum);              // cyan
  if (palette == 4) return vec3(0.1, 0.2, lum);                    // blue
  return color;
}

// Procedural glyph fallback, used when no glyph atlas texture is supplied.
// Returns coverage in [0,1] for the sub-cell position \`p\`.
float getChar(float brightness, vec2 p, int style) {
  if (brightness < 0.01) return 0.0;

  vec2 grid = floor(p * 4.0);

  if (style == 1) {
    // dense — heavy hatching that fills out fast, good for solid silhouettes
    float t = clamp(brightness, 0.0, 1.0);
    float diag  = (mod(grid.x + grid.y, 2.0) == 0.0) ? 1.0 : 0.0;
    float cross_ = (grid.x == 1.0 || grid.x == 2.0 || grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
    float solid = 1.0;
    float a = smoothstep(0.00, 0.35, t);
    float b = smoothstep(0.30, 0.70, t);
    float c = smoothstep(0.65, 1.00, t);
    return clamp(diag * a + cross_ * b + solid * c, 0.0, 1.0);
  }

  if (style == 2) {
    // minimal — single centred dot that grows; airy, typographic
    float t = smoothstep(0.05, 1.0, brightness);
    float d = length(p - 0.5);
    return 1.0 - smoothstep(t * 0.42, t * 0.42 + 0.06, d);
  }

  if (style == 3) {
    // blocks — quantised quadrant fills, reads like ▖▗▘▝█
    float t = clamp(brightness, 0.0, 1.0);
    float q = floor(t * 4.99);
    vec2 half_ = floor(p * 2.0);
    float idx = half_.y * 2.0 + half_.x;      // 0..3 quadrant index
    if (q >= 4.0) return 1.0;
    if (q <= 0.0) return 0.0;
    return idx < q ? 1.0 : 0.0;
  }

  // style 0 — standard: smooth blend between density tiers (upstream behaviour)
  float dotP   = (grid.x == 1.0 && grid.y == 1.0) ? 1.0 : 0.0;
  float block2 = (grid.x == 1.0 || grid.x == 2.0) && (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
  float barH   = (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
  float barH2  = (grid.y == 0.0 || grid.y == 3.0) ? 1.0 : (grid.y == 1.0 || grid.y == 2.0) ? 0.5 : 0.0;
  float edge   = (grid.x == 0.0 || grid.x == 2.0 || grid.y == 0.0 || grid.y == 2.0) ? 1.0 : 0.3;

  float t0 = 1.0 - smoothstep(0.0, 0.15, brightness);
  float t1 = smoothstep(0.08, 0.22, brightness) * (1.0 - smoothstep(0.22, 0.35, brightness));
  float t2 = smoothstep(0.20, 0.38, brightness) * (1.0 - smoothstep(0.38, 0.50, brightness));
  float t3 = smoothstep(0.35, 0.52, brightness) * (1.0 - smoothstep(0.52, 0.65, brightness));
  float t4 = smoothstep(0.50, 0.70, brightness) * (1.0 - smoothstep(0.70, 0.82, brightness));
  float t5 = smoothstep(0.68, 1.00, brightness);

  return clamp(dotP * t0 * 0.5 + block2 * t1 + barH * t2 + barH2 * t3 + edge * t4 + t5, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 workUV = uv;

  // ---- pre-pass geometry distortion ----------------------------------------
  if (curvature > 0.0) {
    vec2 centered = workUV * 2.0 - 1.0;
    centered *= 1.0 + curvature * dot(centered, centered);
    workUV = centered * 0.5 + 0.5;
    if (workUV.x < 0.0 || workUV.x > 1.0 || workUV.y < 0.0 || workUV.y > 1.0) {
      outputColor = transparent ? vec4(0.0) : vec4(backgroundColor, 1.0);
      return;
    }
  }

  if (waveAmplitude > 0.0) {
    workUV.x += sin(workUV.y * waveFrequency + time * waveSpeed) * waveAmplitude;
    workUV.y += cos(workUV.x * waveFrequency + time * waveSpeed) * waveAmplitude;
  }

  // ---- cell addressing -----------------------------------------------------
  vec2 cellCount = resolution / max(cellSize, 1.0);
  vec2 cellCoord = floor(uv * cellCount);

  if (jitterIntensity > 0.0) {
    float jitterTime = time * jitterSpeed;
    float jx = (random(vec2(cellCoord.y, floor(jitterTime))) - 0.5) * jitterIntensity * 2.0;
    float jy = (random(vec2(cellCoord.x, floor(jitterTime + 1000.0))) - 0.5) * jitterIntensity * 2.0;
    cellCoord += vec2(jx, jy);
  }

  if (glitchIntensity > 0.0 && glitchFrequency > 0.0) {
    float glitchTime = floor(time * glitchFrequency);
    if (random(vec2(glitchTime, cellCoord.y)) < glitchIntensity) {
      cellCoord.x += (random(vec2(glitchTime + 1.0, cellCoord.y)) - 0.5) * 20.0;
    }
  }

  // ---- sample the scene at cell centre -------------------------------------
  vec2 cellUV = (cellCoord + 0.5) / cellCount;
  vec4 cellColor;
  if (aberrationStrength > 0.0) {
    float o = aberrationStrength;
    cellColor = vec4(
      texture(inputBuffer, cellUV + vec2(o, 0.0)).r,
      texture(inputBuffer, cellUV).g,
      texture(inputBuffer, cellUV - vec2(o, 0.0)).b,
      texture(inputBuffer, cellUV).a
    );
  } else {
    cellColor = texture(inputBuffer, cellUV);
  }

  // Raw luminance, before grading — used to decide "is this the background?"
  float rawLuminance = dot(cellColor.rgb, LUMA);
  float rawAlpha = cellColor.a;

  cellColor.rgb = (cellColor.rgb - 0.5) * contrastAdjust + 0.5 + brightnessAdjust;

  if (noiseIntensity > 0.0) {
    cellColor.rgb += (noise(cellUV * noiseScale + time * noiseSpeed) - 0.5) * noiseIntensity;
  }

  float brightness = dot(cellColor.rgb, LUMA);
  if (invert) brightness = 1.0 - brightness;

  // Volume shading widens the range so shadows read dense and highlights sparse.
  float brightnessForGlyph = brightness;
  if (volumeShading) {
    brightnessForGlyph = clamp((brightness - 0.5) * 1.6 + 0.5, 0.0, 1.0);
  }

  // Ordered dithering trades a little spatial noise for tonal resolution. The
  // glyph ramp only has a handful of tiers, so a smooth gradient otherwise
  // collapses into visible bands; offsetting each cell by under one tier lets
  // neighbouring cells straddle a boundary and average out to the true value.
  if (ditherAmount > 0.0) {
    float tiers = useGlyphAtlas && glyphTiles > 0.0 ? glyphTiles : 8.0;
    brightnessForGlyph += (bayer4(cellCoord) - 0.5) * ditherAmount / tiers;
    brightnessForGlyph = clamp(brightnessForGlyph, 0.0, 1.0);
  }

  float emptyThreshold = volumeShading ? 0.04 : 0.14;
  vec2  localUV = fract(uv * cellCount);

  // In transparent mode the scene is rendered on a clear buffer, so alpha is the
  // reliable occupancy signal; opaque mode falls back to a luminance floor.
  bool isBackground = transparent ? (rawAlpha < 0.02) : (rawLuminance < bgThreshold);

  float charValue;
  if (isBackground || brightness < emptyThreshold) {
    charValue = 0.0;
  } else if (useGlyphAtlas && glyphTiles > 0.0) {
    float tile = clamp(floor(brightnessForGlyph * glyphTiles), 0.0, glyphTiles - 1.0);
    float inset = 0.02;
    vec2 inner = inset + localUV * (1.0 - 2.0 * inset);
    charValue = texture(glyphAtlas, vec2((tile + inner.x) / glyphTiles, inner.y)).r;
  } else {
    charValue = getChar(brightnessForGlyph, localUV, asciiStyle);
  }

  // ---- glyph colour and coverage are kept separate so the opaque branch can
  //      composite over an arbitrary background without double-darkening ------
  vec3 glyphColor;
  if (colorMode) {
    glyphColor = useTintColor ? tintColor : cellColor.rgb;
  } else {
    glyphColor = vec3(brightness);
  }
  glyphColor = applyColorPalette(glyphColor, colorPalette);

  float coverage = clamp(charValue, 0.0, 1.0);

  // ---- screen-space post ---------------------------------------------------
  float glow = 0.0;
  if (mouseGlowEnabled) {
    glow = exp(-length(uv * resolution - mousePos) / max(mouseGlowRadius, 1.0)) * mouseGlowIntensity;
  }

  float shade = 1.0;
  if (scanlineIntensity > 0.0) {
    float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
    shade *= 1.0 - (scanline * scanlineIntensity);
  }
  if (vignetteIntensity > 0.0) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) / max(vignetteRadius, 0.001);
    shade *= mix(1.0, vignette, vignetteIntensity);
  }

  if (transparent) {
    // Coverage drives alpha so the host page background shows through between
    // characters. Scanline/vignette dim alpha too, otherwise they read as grey
    // smears over a light page instead of as dimming.
    float alpha = clamp(max(coverage, glow) * shade, 0.0, 1.0);
    outputColor = vec4(glyphColor + glow, alpha);
  } else {
    vec3 composited = mix(backgroundColor, glyphColor, coverage) + glow;
    outputColor = vec4(composited * shade, 1.0);
  }
}
`
