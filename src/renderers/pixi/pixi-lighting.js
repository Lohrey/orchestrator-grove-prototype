// ── Screen-space lightmap lighting system ─────────────────────────
// Renders all light sources to an offscreen Canvas2D each frame,
// then applies the result as a multiply-blend sprite over the world.
//
// Architecture:
//   1. collectLightSources() gathers every active light from renderState
//   2. updateLightmap() renders lights to an offscreen canvas (dark base +
//      additive radial gradients)
//   3. The canvas texture is shown via a Pixi Sprite with blendMode='multiply'
//   4. Multiply darkens unlit areas; lit areas pass through nearly unchanged
//
// The result: real GPU-calculated lighting where lights cut through darkness.

import {
  isLightEmittingStructure,
  structureLightRadius
} from '../../fog-of-war.js?v=grove_lighting_0628';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ═══════════════════════════════════════════════════════════════════
// TUNING CONSTANTS — adjust these to change the look
// ═══════════════════════════════════════════════════════════════════

/** Ambient darkness floor (0 = always bright, 1 = always near-black).
 *  Even at midday this much darkness applies so the lighting effect is
 *  visible. Range 0.0–1.0. Recommended 0.30–0.45. */
export const AMBIENT_DARKNESS = 0.38;

/** Maximum darkness at deepest night. Range 0.0–1.0.
 *  At 0.88 unlit areas are 12% brightness — dark but navigable. */
export const MAX_DARKNESS = 0.88;

/** Cool blue tint applied to the darkness base (0 = neutral gray,
 *  higher = more blue night atmosphere). */
export const DARKNESS_BLUE_TINT = 0.04;

// ═══════════════════════════════════════════════════════════════════
// LIGHT SOURCE COLLECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Collect all active light sources from renderState.
 * Each light: { x, y (world coords), radius, color: [r,g,b], intensity: 0-1, flicker: 0-1 }
 *
 * Sources:
 *   - Player: warm torch light (always on)
 *   - Assistant: cool blue glow
 *   - Bots: dim green light
 *   - Light-emitting structures (sawbench, factory, etc.): warm amber glow with flicker
 */
export function collectLightSources(renderState) {
  const sources = [];
  const player = renderState.player;
  const assistant = renderState.assistant;
  const bots = renderState.bots || [];
  const structures = renderState.structures || [];

  // Player — warm torch / personal light
  if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
    sources.push({
      x: player.x,
      y: player.y,
      radius: 235,
      color: [255, 232, 168],
      intensity: 1.0,
      flicker: 0.03
    });
  }

  // Assistant — cool blue-white light
  if (assistant && Number.isFinite(assistant.x) && Number.isFinite(assistant.y)) {
    sources.push({
      x: assistant.x,
      y: assistant.y,
      radius: 145,
      color: [136, 200, 255],
      intensity: 0.62,
      flicker: 0.02
    });
  }

  // Bots — dim green-tinted utility light
  for (const bot of bots) {
    if (!bot || !Number.isFinite(bot.x) || !Number.isFinite(bot.y)) continue;
    sources.push({
      x: bot.x,
      y: bot.y,
      radius: 115,
      color: [162, 222, 174],
      intensity: 0.48,
      flicker: 0.02
    });
  }

  // Light-emitting structures — warm amber glow with fire-like flicker
  for (const structure of structures) {
    if (!isLightEmittingStructure(structure)) continue;
    const cx = (structure.x || 0) + (structure.w || 48) / 2;
    const cy = (structure.y || 0) + (structure.h || 48) / 2;
    const baseRadius = structureLightRadius(structure);
    if (baseRadius <= 0) continue;
    sources.push({
      x: cx,
      y: cy,
      radius: Math.max(80, baseRadius * 0.82),
      color: [255, 212, 126],
      intensity: 0.78,
      flicker: 0.07 // stronger flicker for fire/lamp structures
    });
  }

  return sources;
}

// ═══════════════════════════════════════════════════════════════════
// DARKNESS COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute the effective darkness level for this frame.
 * Blends the day/night cycle nightAmount with the ambient darkness floor.
 * @returns {number} 0 (full bright) to 1 (near-black)
 */
export function computeDarkness(renderState) {
  const nightAmount = clamp(renderState.dayNight?.nightAmount ?? 0, 0, 1);
  return clamp(
    AMBIENT_DARKNESS + nightAmount * (MAX_DARKNESS - AMBIENT_DARKNESS),
    0,
    MAX_DARKNESS
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIGHTMAP RENDERING
// ═══════════════════════════════════════════════════════════════════

/**
 * Render the screen-space lightmap to the lightmap canvas.
 *
 * The lightmap is a grayscale (+ subtle color) texture where:
 *   - Unlit areas = dark gray (proportional to 1-darkness)
 *   - Lit areas = bright (radial gradients from each light source)
 *
 * When applied as multiply blend: sceneColor * lightmap / 255 = result.
 * Dark areas of the lightmap darken the scene; bright areas preserve it.
 *
 * @param {object} renderState - Current render state snapshot
 * @param {object} view - Clipped world view bounds { left, top, width, height, right, bottom }
 * @param {object} deps - { lightmapCanvas, lightmapContext, lightmapSprite, lightmapTexture, resizeOverlayCanvas }
 */
export function updateLightmap(renderState, view, deps) {
  const {
    lightmapCanvas,
    lightmapContext,
    lightmapSprite,
    lightmapTexture,
    resizeOverlayCanvas
  } = deps;

  if (!lightmapContext || !view || view.width <= 0 || view.height <= 0) {
    if (lightmapSprite) lightmapSprite.visible = false;
    return;
  }

  lightmapSprite.visible = true;

  const darkness = computeDarkness(renderState);
  const lights = collectLightSources(renderState);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Position and size the lightmap canvas to cover the visible world area.
  // The sprite lives inside worldViewport so Pixi's camera transform handles
  // the pan/zoom automatically.
  lightmapSprite.position.set(view.left, view.top);
  lightmapSprite.scale.set(1);
  resizeOverlayCanvas(
    lightmapCanvas,
    lightmapSprite,
    lightmapTexture,
    view.width,
    view.height,
    view.left,
    view.top
  );

  const ctx = lightmapContext;
  const w = lightmapCanvas.width;
  const h = lightmapCanvas.height;

  // ── Step 1: Fill with darkness base ────────────────────────────
  // Slightly blue-tinted gray for night atmosphere.
  // brightness = 1 - darkness; blue tint shifts G down and B up slightly.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  const brightness = 1 - darkness;
  const baseR = Math.round(brightness * 255);
  const baseG = Math.round(brightness * (255 - DARKNESS_BLUE_TINT * 128));
  const baseB = Math.round(brightness * (255 + DARKNESS_BLUE_TINT * 64));
  ctx.fillStyle = `rgb(${clamp(baseR, 0, 255)}, ${clamp(baseG, 0, 255)}, ${clamp(baseB, 0, 255)})`;
  ctx.fillRect(0, 0, w, h);

  // ── Step 2: Draw lights additively ─────────────────────────────
  // Switch to world-space coordinates so light positions match entities.
  ctx.setTransform(1, 0, 0, 1, -view.left, -view.top);
  ctx.globalCompositeOperation = 'lighter'; // additive blend

  for (const light of lights) {
    // Cull lights entirely outside the visible area
    if (
      light.x + light.radius < view.left ||
      light.x - light.radius > view.right ||
      light.y + light.radius < view.top ||
      light.y - light.radius > view.bottom
    )
      continue;

    const [r, g, b] = light.color;

    // Flicker: subtle intensity oscillation for living light effect
    const flickerAmount = light.flicker || 0;
    const flicker =
      flickerAmount > 0
        ? 1 + Math.sin(now * 0.006 + light.x * 0.021 + light.y * 0.013) * flickerAmount
        : 1;
    const intensity = clamp(light.intensity * flicker, 0, 1);

    // Radial gradient: bright center fading to transparent at edge.
    // With 'lighter' blend, alpha controls how much color is added.
    const grad = ctx.createRadialGradient(
      light.x, light.y, 0,
      light.x, light.y, light.radius
    );
    grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
    grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, ${intensity * 0.82})`);
    grad.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, ${intensity * 0.45})`);
    grad.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, ${intensity * 0.14})`);
    grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Restore default composite mode
  ctx.globalCompositeOperation = 'source-over';

  // Upload the updated lightmap to the GPU texture
  lightmapTexture.source.update();
  lightmapTexture.update();
}

/**
 * Set up the lightmap resources: canvas, context, texture, sprite.
 * Returns the resources object for use with updateLightmap().
 *
 * @param {object} PIXI - The PixiJS namespace
 * @param {object} makeCanvas - Canvas factory function
 * @param {number} width - Initial canvas width
 * @param {number} height - Initial canvas height
 * @returns {object} { lightmapCanvas, lightmapContext, lightmapSprite, lightmapTexture }
 */
export function createLightmapResources(PIXI, makeCanvas, width, height) {
  const lightmapCanvas = makeCanvas(width || 256, height || 256);
  const lightmapContext = lightmapCanvas.getContext('2d', { alpha: true });

  // Initialize with neutral (no darkening) state
  lightmapContext.fillStyle = '#ffffff';
  lightmapContext.fillRect(0, 0, lightmapCanvas.width, lightmapCanvas.height);

  const lightmapTexture = PIXI.Texture.from(lightmapCanvas);
  const lightmapSprite = new PIXI.Sprite(lightmapTexture);

  // Multiply blend: sceneColor * lightmapColor / 255
  // Dark lightmap pixels darken the scene; bright pixels preserve it.
  lightmapSprite.blendMode = 'multiply';
  lightmapSprite.zIndex = -1; // below fog and other overlays

  return { lightmapCanvas, lightmapContext, lightmapSprite, lightmapTexture };
}
