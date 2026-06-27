import { BUILDING_TYPES } from '../data.js?v=t_building_kits_0618';
import { getCampaignArrivalScene } from '../campaign-scenes.js?v=t_campaign_scenes_0623';
import { getDepthAnchorY } from '../depth-sort.js?v=t_da28d8dd';
import { clamp } from '../utils.js?v=20260613-player-tools';
import {
  drawFogOfWarOverlayScreen,
  fogRevealSources as buildFogRevealSources,
  isLightEmittingStructure,
  isPointCurrentlyVisible,
  isPointExplored,
  structureLightRadius as getFogStructureLightRadius
} from '../fog-of-war.js?v=t_building_kits_0618';
import {
  drawBuildingAsset,
  drawBuildingPreviewAsset,
  drawHeldToolAsset,
  drawItemAsset,
  itemLabel
} from '../visual-assets.js?v=t_building_kits_0618';

const LOOSE_ITEM_RENDER_MIN_ZOOM = 0.55;
const DECORATIVE_DETAIL_RENDER_MIN_ZOOM = 0.55;
const BOT_RENDER_MIN_ZOOM = 0.30;
const BOT_HAND_TOOL_TYPES = new Set(['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer']);
const LIGHT_OCCLUDER_PAD = 420;
const MAX_HIGH_RES_DEVICE_PIXEL_RATIO = 2;
const CHARACTER_FRAME_SIZE = { width: 96, height: 80 };
const CHARACTER_ANIMATION_NAMES = ['idle', 'run', 'attack1', 'attack2'];
const CHARACTER_PATHS = {
  idle: 'IDLE',
  run: 'RUN',
  attack1: 'ATTACK 1',
  attack2: 'ATTACK 2'
};
const CHARACTER_SCALE = 1.38;
const CHARACTER_GROUND_OFFSET = 11;

function normalizeRendererSettings(settings = {}) {
  return {
    highResolution: settings?.highResolution !== false,
    antialias: settings?.antialias !== false
  };
}

function getRendererResolution(settings) {
  if (!settings.highResolution) return 1;
  return clamp(window.devicePixelRatio || 1, 1, MAX_HIGH_RES_DEVICE_PIXEL_RATIO);
}

function fillPath(graphics, color, alpha, draw) {
  draw(graphics);
  graphics.fill({ color, alpha });
}

function strokePath(graphics, color, width, alpha, draw, options = {}) {
  graphics.setStrokeStyle({ color, width, alpha, ...options });
  draw(graphics);
  graphics.stroke();
}

function fillAndStrokePath(graphics, { fill = null, fillAlpha = 1, stroke = null, strokeWidth = 1, strokeAlpha = 1, strokeOptions = {} } = {}, draw) {
  if (fill != null) fillPath(graphics, fill, fillAlpha, draw);
  if (stroke != null) strokePath(graphics, stroke, strokeWidth, strokeAlpha, draw, strokeOptions);
}

export async function createPixiRenderer({ canvas, capture = false, settings = null }) {
  const PIXI = await import('../../vendor/pixi/pixi.mjs');
  const rendererSettings = normalizeRendererSettings(settings);
  const app = new PIXI.Application();
  await app.init({
    canvas,
    backgroundAlpha: 1,
    antialias: rendererSettings.antialias,
    autoDensity: rendererSettings.highResolution,
    resolution: getRendererResolution(rendererSettings),
    preference: 'webgl',
    preserveDrawingBuffer: !!capture
  });
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  app.ticker.stop();
  app.stage.sortableChildren = true;

  const characterAssets = { ready: false };
  loadCharacterAssets(PIXI).then(assets => {
    Object.assign(characterAssets, assets);
  }).catch(error => {
    console.warn('Character sprites failed to load; using fallback actor rendering.', error);
  });

  const textureCache = new Map();
  const objectMaps = {
    zones: new Map(),
    holes: new Map(),
    trees: new Map(),
    hemp: new Map(),
    rocks: new Map(),
    structures: new Map(),
    items: new Map(),
    monsters: new Map(),
    projectiles: new Map(),
    bots: new Map(),
    remotePlayers: new Map(),
    floaters: new Map()
  };

  const backgroundLayer = new PIXI.Container();
  const worldViewport = new PIXI.Container();
  const worldStaticLayer = new PIXI.Container();
  const zoneLayer = new PIXI.Container();
  const holeLayer = new PIXI.Container();
  const depthLayer = new PIXI.Container();
  const effectsLayer = new PIXI.Container();
  const floaterLayer = new PIXI.Container();
  const worldOverlayLayer = new PIXI.Container();
  const overlayLayer = new PIXI.Container();
  const hudLayer = new PIXI.Container();

  depthLayer.sortableChildren = true;
  floaterLayer.sortableChildren = true;
  worldViewport.addChild(worldStaticLayer, zoneLayer, holeLayer, depthLayer, effectsLayer, floaterLayer, worldOverlayLayer);
  app.stage.addChild(backgroundLayer, worldViewport, overlayLayer, hudLayer);

  const backdrop = new PIXI.Sprite();
  backgroundLayer.addChild(backdrop);

  const terrainBaseSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  const terrainDetailSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  const terrainFeatureSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  const campaignArrivalLayer = new PIXI.Container();
  const campaignArrivalGraphics = new PIXI.Graphics();
  campaignArrivalLayer.addChild(campaignArrivalGraphics);
  worldStaticLayer.addChild(terrainBaseSprite, terrainDetailSprite, terrainFeatureSprite, campaignArrivalLayer);
  terrainDetailSprite.visible = false;

  const playerView = createActorView(PIXI, {
    id: 'player',
    label: 'Player',
    bodyColor: 0xeef5ef,
    accentColor: 0x76b77f,
    radius: 14,
    showLabel: false,
    characterAssets
  });
  const assistantView = createAssistantView(PIXI);
  const placementPreview = new PIXI.Sprite();
  placementPreview.alpha = 0.72;
  const playerTargetGraphics = new PIXI.Graphics();
  const zoneDraftGraphics = new PIXI.Graphics();
  effectsLayer.addChild(placementPreview, playerTargetGraphics, zoneDraftGraphics);
  depthLayer.addChild(playerView.container, assistantView.container);

  const hudBar = new PIXI.Graphics();
  const fpsBadge = new PIXI.Graphics();
  const hudText = createText(PIXI, '', { fontSize: 13, fontWeight: '700' });
  const fpsText = createText(PIXI, '', { fontSize: 13, fontWeight: '800' });
  hudLayer.addChild(hudBar, fpsBadge, hudText, fpsText);

  const overlayCanvas = makeCanvas(canvas.width, canvas.height);
  const overlayContext = overlayCanvas.getContext('2d', { alpha: true });
  const overlayTexture = PIXI.Texture.from(overlayCanvas);
  const overlaySprite = new PIXI.Sprite(overlayTexture);
  const fogOverlayCanvas = makeCanvas(canvas.width, canvas.height);
  const fogOverlayContext = fogOverlayCanvas.getContext('2d', { alpha: true });
  const fogOverlayTexture = PIXI.Texture.from(fogOverlayCanvas);
  const fogOverlaySprite = new PIXI.Sprite(fogOverlayTexture);
  worldOverlayLayer.addChild(overlaySprite, fogOverlaySprite);

  let lastViewportWidth = 0;
  let lastViewportHeight = 0;
  let lastMapSignature = '';
  let lastFogOverlaySignature = '';
  let terrainTextures = {
    base: null,
    details: null,
    features: null
  };

  function destroyDisplayObject(displayObject) {
    if (displayObject?.destroy) displayObject.destroy({ children: true });
  }

  function getCacheEntry(key, factory) {
    if (!textureCache.has(key)) textureCache.set(key, factory());
    return textureCache.get(key);
  }

  function makeCanvas(width, height) {
    const el = document.createElement('canvas');
    el.width = Math.max(1, Math.ceil(width));
    el.height = Math.max(1, Math.ceil(height));
    return el;
  }

  function buildTexture(key, width, height, draw) {
    return getCacheEntry(key, () => {
      const offscreen = makeCanvas(width, height);
      const ctx = offscreen.getContext('2d', { alpha: true });
      draw(ctx, offscreen);
      return PIXI.Texture.from(offscreen);
    });
  }

  function roundedCanvasRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, width, height, r);
      return;
    }
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
  }

  function getNameTagTexture(text) {
    const label = String(text || '');
    const font = '700 11px system-ui';
    const measureCanvas = makeCanvas(2, 2);
    const measureCtx = measureCanvas.getContext('2d', { alpha: true });
    measureCtx.font = font;
    const width = Math.ceil(measureCtx.measureText(label).width + 14);
    const height = 20;
    return buildTexture(`nametag:${label}`, width * 2, height * 2, ctx => {
      ctx.scale(2, 2);
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(6,10,8,.82)';
      ctx.strokeStyle = 'rgba(255,244,208,.38)';
      roundedCanvasRect(ctx, 0, 0, width, height, 999);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff4d0';
      ctx.fillText(label, width / 2, height / 2 + 0.5);
    });
  }

  function destroyTerrainTextures() {
    for (const texture of Object.values(terrainTextures)) {
      if (texture && texture !== PIXI.Texture.EMPTY) texture.destroy(true);
    }
    terrainTextures = { base: null, details: null, features: null };
  }

  function buildStaticTexture(width, height, draw) {
    const layer = new PIXI.Container();
    draw(layer);
    const texture = PIXI.RenderTexture.create({ width: Math.max(1, Math.ceil(width)), height: Math.max(1, Math.ceil(height)), resolution: 1 });
    app.renderer.render({ container: layer, target: texture, clear: true });
    layer.destroy({ children: true });
    return texture;
  }

  function createGraphicsLayer(parent, draw) {
    const graphics = new PIXI.Graphics();
    parent.addChild(graphics);
    draw(graphics);
    return graphics;
  }

  function getBackdropTexture(width, height) {
    return buildTexture(`backdrop:${width}x${height}`, width, height, ctx => {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#0a100d');
      sky.addColorStop(0.62, '#101712');
      sky.addColorStop(1, '#0b0f0d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * 0.26, height * 0.18, 0, width * 0.26, height * 0.18, Math.max(width, height) * 0.58);
      glow.addColorStop(0, 'rgba(116, 173, 112, 0.18)');
      glow.addColorStop(0.48, 'rgba(116, 173, 112, 0.05)');
      glow.addColorStop(1, 'rgba(116, 173, 112, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    });
  }

  function getBuildingTexture(type, width, height, hover = false) {
    const def = BUILDING_TYPES[type] || { type, w: width, h: height, color: '#6b766f' };
    return buildTexture(`building:${type}:${width}x${height}:${hover ? 'hover' : 'idle'}`, width + 24, height + 24, ctx => {
      ctx.translate((width + 24) / 2, (height + 24) / 2);
      drawBuildingAsset(ctx, { type, x: 0, y: 0, w: width, h: height }, def, { hover, now: 0 });
    });
  }

  function getPlacementTexture(type, width, height) {
    return buildTexture(`placement:${type}:${width}x${height}`, width + 24, height + 24, ctx => {
      drawBuildingPreviewAsset(ctx, 12, 12, width, height, { ...(BUILDING_TYPES[type] || {}), type, w: width, h: height });
    });
  }

  function getItemTexture(type) {
    return buildTexture(`item:${type}`, 40, 40, ctx => {
      ctx.translate(20, 20);
      drawItemAsset(ctx, type);
    });
  }

  function getToolTexture(type) {
    return buildTexture(`tool:${type}`, 42, 42, ctx => {
      ctx.translate(21, 21);
      drawHeldToolAsset(ctx, 0, 0, type);
    });
  }

  function drawRoundedRect(graphics, x, y, width, height, radius, fill, alpha = 1, stroke = null, strokeWidth = 1, strokeAlpha = 1) {
    fillAndStrokePath(
      graphics,
      { fill, fillAlpha: alpha, stroke, strokeWidth, strokeAlpha },
      path => path.roundRect(x, y, width, height, radius)
    );
  }

  function updateBackdrop(width, height) {
    if (width === lastViewportWidth && height === lastViewportHeight) return;
    lastViewportWidth = width;
    lastViewportHeight = height;
    backdrop.texture = getBackdropTexture(width, height);
    backdrop.width = width;
    backdrop.height = height;
    lastFogOverlaySignature = '';
  }

  function resizeOverlayCanvas(targetCanvas, targetSprite, targetTexture, width, height, x = 0, y = 0) {
    if (targetCanvas.width !== width) targetCanvas.width = width;
    if (targetCanvas.height !== height) targetCanvas.height = height;
    targetSprite.position.set(x, y);
    targetSprite.scale.set(1);
    targetTexture.source.update();
    targetTexture.update();
  }

  function updateWorldStatic(renderState) {
    const featureSignature = JSON.stringify({
      width: renderState.map.width,
      height: renderState.map.height,
      campaignArrival: renderState.campaignArrival?.active ? renderState.campaignArrival.sceneId || 'active' : 'idle',
      features: (renderState.mapFeatures || []).map(feature => ({
        id: feature.id || null,
        type: feature.type || null,
        x: feature.x || 0,
        y: feature.y || 0,
        w: feature.w || 0,
        h: feature.h || 0,
        rx: feature.rx || 0,
        ry: feature.ry || 0,
        rotation: feature.rotation || 0,
        points: feature.points || []
      }))
    });
    if (featureSignature === lastMapSignature) return;
    lastMapSignature = featureSignature;
    destroyTerrainTextures();
    terrainTextures.base = buildTerrainBaseTexture(renderState);
    terrainTextures.details = buildTerrainDetailTexture(renderState);
    terrainTextures.features = buildTerrainFeatureTexture(renderState);
    terrainBaseSprite.texture = terrainTextures.base;
    terrainBaseSprite.width = renderState.map.width;
    terrainBaseSprite.height = renderState.map.height;
    terrainDetailSprite.texture = terrainTextures.details;
    terrainDetailSprite.width = renderState.map.width;
    terrainDetailSprite.height = renderState.map.height;
    terrainFeatureSprite.texture = terrainTextures.features;
    terrainFeatureSprite.width = renderState.map.width;
    terrainFeatureSprite.height = renderState.map.height;
  }

  function buildTerrainBaseTexture(renderState) {
    const width = renderState.map.width;
    const height = renderState.map.height;
    return buildStaticTexture(width, height, layer => {
      const base = createGraphicsLayer(layer, graphics => {
        fillPath(graphics, 0x15281d, 1, path => path.rect(0, 0, width, height));
        fillPath(graphics, 0x25482d, 0.95, path => path.rect(0, 0, width, height));
        fillPath(graphics, 0x325936, 0.36, path => {
          path.ellipse(width * 0.20, height * 0.16, width * 0.64, height * 0.38);
          path.ellipse(width * 0.76, height * 0.74, width * 0.44, height * 0.28);
        });
        fillPath(graphics, 0x203b27, 0.42, path => {
          path.ellipse(width * 0.54, height * 0.52, width * 0.84, height * 0.62);
        });
        fillPath(graphics, 0x111d16, 0.22, path => {
          path.ellipse(width * 0.50, height * 0.56, width * 0.98, height * 0.78);
        });
      });
      base.blendMode = 'normal';

      const sunlight = createGraphicsLayer(layer, graphics => {
        fillPath(graphics, 0xb1d368, 0.18, path => path.ellipse(width * 0.18, height * 0.15, width * 0.64, height * 0.46));
        fillPath(graphics, 0x6a9c4a, 0.06, path => path.ellipse(width * 0.35, height * 0.40, width * 0.52, height * 0.34));
      });
      sunlight.blendMode = 'screen';

      const patches = createGraphicsLayer(layer, graphics => drawPainterlyGroundPatches(graphics, width, height));
      patches.blendMode = 'normal';
      const atmosphere = createGraphicsLayer(layer, graphics => drawAtmosphericBands(graphics, width, height));
      atmosphere.blendMode = 'screen';
    });
  }

  function buildTerrainDetailTexture(renderState) {
    const width = renderState.map.width;
    const height = renderState.map.height;
    return buildStaticTexture(width, height, layer => {
      const stream = createGraphicsLayer(layer, graphics => drawLushStream(graphics, width, height));
      stream.blendMode = 'screen';
      const trail = createGraphicsLayer(layer, graphics => drawGoldenTrail(graphics, width, height));
      trail.blendMode = 'screen';
      const details = createGraphicsLayer(layer, graphics => drawTerrainSprites(graphics, width, height));
      details.blendMode = 'normal';
    });
  }

  function buildTerrainFeatureTexture(renderState) {
    const width = renderState.map.width;
    const height = renderState.map.height;
    return buildStaticTexture(width, height, layer => {
      for (const feature of renderState.mapFeatures || []) {
        if (isCampaignArrivalActive(renderState) && feature.id === getCampaignArrivalScene()?.parkedFeatureId) continue;
        const graphic = new PIXI.Graphics();
        layer.addChild(graphic);
        renderMapFeature(graphic, feature);
      }
    });
  }

  function isCampaignArrivalActive(renderState) {
    return !!renderState.campaignArrival?.active && renderState.gameMode === 'campaign';
  }

  function updateCampaignArrival(renderState) {
    campaignArrivalGraphics.clear();
    if (!isCampaignArrivalActive(renderState)) return;
    const scene = getCampaignArrivalScene(renderState.campaignArrival?.sceneId);
    if (!scene) return;
    const parkedFeature = (renderState.mapFeatures || []).find(feature => feature.id === scene.parkedFeatureId) || null;
    const points = scene.path || [];
    if (points.length < 2) return;
    const progress = clamp(Number(renderState.campaignArrival?.progress ?? computePolylineProgress(performance.now(), renderState.campaignArrival?.startedAt, scene.durationMs)), 0, 1);
    const state = samplePolyline(points, progress);
    const parkedRotation = Number.isFinite(parkedFeature?.rotation) ? parkedFeature.rotation : state.angle;
    const rotation = state.angle + ((parkedRotation - state.angle) * Math.min(1, progress * 1.15));
    renderMapFeature(campaignArrivalGraphics, {
      ...parkedFeature,
      x: state.x,
      y: state.y,
      rotation,
      label: parkedFeature?.label || 'camper van',
      hideLabel: true
    });
  }

  function computePolylineProgress(now, startedAt, durationMs) {
    if (!Number.isFinite(now) || !Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
    return clamp((now - startedAt) / durationMs, 0, 1);
  }

  function samplePolyline(points, progress) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      const ax = a.x ?? a[0] ?? 0;
      const ay = a.y ?? a[1] ?? 0;
      const bx = b.x ?? b[0] ?? 0;
      const by = b.y ?? b[1] ?? 0;
      const length = Math.hypot(bx - ax, by - ay);
      if (length <= 0) continue;
      segments.push({ ax, ay, bx, by, length, angle: Math.atan2(by - ay, bx - ax) });
      total += length;
    }
    if (!segments.length || total <= 0) {
      const first = points[0] || {};
      return { x: first.x ?? first[0] ?? 0, y: first.y ?? first[1] ?? 0, angle: 0 };
    }
    const target = total * clamp(progress, 0, 1);
    let traveled = 0;
    for (const segment of segments) {
      const next = traveled + segment.length;
      if (target <= next) {
        const local = segment.length ? (target - traveled) / segment.length : 0;
        return {
          x: segment.ax + ((segment.bx - segment.ax) * local),
          y: segment.ay + ((segment.by - segment.ay) * local),
          angle: segment.angle
        };
      }
      traveled = next;
    }
    const last = segments[segments.length - 1];
    return { x: last.bx, y: last.by, angle: last.angle };
  }

  function drawAtmosphericBands(graphics, width, height) {
    fillPath(graphics, 0x0e1712, 0.14, path => path.roundRect(0, 0, width, height, 0));
    fillPath(graphics, 0x203424, 0.10, path => path.ellipse(width * 0.22, height * 0.18, width * 0.58, height * 0.24));
    fillPath(graphics, 0x5d8c46, 0.06, path => path.ellipse(width * 0.66, height * 0.72, width * 0.48, height * 0.26));
  }

  function drawPainterlyGroundPatches(graphics, width, height) {
    const patches = [
      [0x4f7d3d, 0.20, 92, 32, -0.25, 28, 128, 176],
      [0x78a24b, 0.14, 64, 18, 0.38, 82, 154, 218],
      [0x1b3322, 0.18, 118, 38, -0.12, 140, 214, 284],
      [0x9aa64f, 0.09, 46, 13, 0.18, 24, 92, 168]
    ];
    for (const [color, alpha, rx, ry, rotation, offsetX, stepY, stepX] of patches) {
      for (let y = offsetX; y < height + 60; y += stepY) {
        for (let x = (offsetX * 3 + ((y / stepY) % 2) * 67) % stepX; x < width + 80; x += stepX) {
          const jitter = terrainNoise(x, y) - 0.5;
          fillPath(graphics, color, alpha, path => {
            path.ellipse(
              x + jitter * 28,
              y + jitter * 22,
              rx * (0.72 + terrainNoise(y, x) * 0.55),
              ry * (0.7 + terrainNoise(x + 99, y) * 0.5),
              rotation + jitter * 0.25
            );
          });
        }
      }
    }
  }

  function drawLushStream(graphics, width, height) {
    strokePath(graphics, 0x568c82, 58, 0.34, path => {
      path.moveTo(width * 0.03, height * 0.78);
      path.bezierCurveTo(width * 0.18, height * 0.60, width * 0.28, height * 0.70, width * 0.42, height * 0.50);
      path.bezierCurveTo(width * 0.56, height * 0.30, width * 0.70, height * 0.42, width * 0.96, height * 0.16);
    }, { cap: 'round', join: 'round' });
    strokePath(graphics, 0xb5e0b2, 8, 0.16, path => {
      path.moveTo(width * 0.08, height * 0.74);
      path.bezierCurveTo(width * 0.28, height * 0.62, width * 0.33, height * 0.62, width * 0.48, height * 0.46);
      path.bezierCurveTo(width * 0.61, height * 0.33, width * 0.76, height * 0.39, width * 0.91, height * 0.22);
    }, { cap: 'round', join: 'round' });
  }

  function drawGoldenTrail(graphics, width, height) {
    strokePath(graphics, 0x977037, 34, 0.22, path => {
      path.moveTo(80, height - 130);
      path.bezierCurveTo(350, 520, 640, 760, width - 120, 250);
    }, { cap: 'round', join: 'round' });
    strokePath(graphics, 0xe7bc5b, 5, 0.12, path => {
      path.moveTo(120, height - 155);
      path.bezierCurveTo(420, 585, 670, 700, width - 170, 285);
    }, { cap: 'round', join: 'round' });
  }

  function drawTerrainSprites(graphics, width, height) {
    for (let y = 34; y < height; y += 66) {
      for (let x = 24 + ((y / 66) % 2) * 31; x < width; x += 78) {
        const n = terrainNoise(x, y);
        if (n < 0.28) continue;
        const bladeCount = n > 0.82 ? 5 : 3;
        const bladeColor = n > 0.66 ? 0x98c45c : 0x538f48;
        const bladeAlpha = n > 0.66 ? 0.34 : 0.28;
        const bladeWidth = n > 0.72 ? 2 : 1.2;
        for (let i = 0; i < bladeCount; i++) {
          const bx = x + (i - 2) * 4 + (terrainNoise(y + i * 17, x) - 0.5) * 9;
          const by = y + (terrainNoise(x + i * 23, y) - 0.5) * 12;
          const lean = (terrainNoise(bx, by) - 0.5) * 10;
          strokePath(graphics, bladeColor, bladeWidth, bladeAlpha, path => {
            path.moveTo(bx, by + 8);
            path.quadraticCurveTo(bx + lean * 0.35, by, bx + lean, by - 10 - n * 6);
          }, { cap: 'round', join: 'round' });
        }
        if (n > 0.91) {
          fillPath(graphics, 0xe8c75b, 0.64, path => path.circle(x + 10, y - 8, 2.3));
        }
        if (n > 0.96) {
          fillPath(graphics, 0xdceaa0, 0.44, path => path.ellipse(x - 14, y + 12, 9, 4, -0.4));
        }
      }
    }
  }

  function renderMapFeature(graphics, feature) {
    graphics.clear();
    if (!feature) return;
    if (feature.type === 'road') {
      const points = feature.points || [];
      if (points.length < 2) return;
      strokePath(graphics, 0x0f1411, (feature.width || 86) + 22, 0.86, path => moveThroughPoints(path, points), { pixelLine: true });
      strokePath(graphics, 0x2f332e, feature.width || 86, 0.96, path => moveThroughPoints(path, points), { pixelLine: true });
      strokePath(graphics, 0x70776c, 3, 0.28, path => moveThroughPoints(path, points), { pixelLine: true });
      return;
    }
    if (feature.type === 'parking_lot') {
      const width = feature.w || 340;
      const height = feature.h || 180;
      graphics.position.set(feature.x || 0, feature.y || 0);
      graphics.rotation = feature.rotation || 0;
      drawRoundedRect(graphics, -width / 2, -height / 2, width, height, 18, 0x262b28, 0.95, 0xc5d3c0, 4, 0.34);
      return;
    }
    if (feature.type === 'lake') {
      graphics.position.set(feature.x || 0, feature.y || 0);
      graphics.rotation = feature.rotation || 0;
      fillPath(graphics, 0x2f7888, 1, path => path.ellipse(0, 0, feature.rx || 210, feature.ry || 120));
      fillPath(
        graphics,
        0x8bcfc8,
        0.28,
        path => path.ellipse(-(feature.rx || 210) * 0.18, -(feature.ry || 120) * 0.22, (feature.rx || 210) * 0.72, (feature.ry || 120) * 0.54)
      );
      return;
    }
    if (feature.type === 'camper_van') {
      const width = feature.w || 118;
      const height = feature.h || 58;
      graphics.position.set(feature.x || 0, feature.y || 0);
      graphics.rotation = feature.rotation || 0;
      fillPath(graphics, 0x0d1611, 0.24, path => path.ellipse(0, height * 0.20, width * 0.40, height * 0.12));
      drawRoundedRect(graphics, -width * 0.46, -height * 0.18, width * 0.92, height * 0.42, 12, 0xeef3ef, 1, 0x17201d, 2, 1);
      drawRoundedRect(graphics, -width * 0.23, -height * 0.33, width * 0.44, height * 0.18, 7, 0xcfd8d3, 1, 0x17201d, 2, 1);
      drawRoundedRect(graphics, -width * 0.27, -height * 0.12, width * 0.18, height * 0.15, 3, 0x80a9c9, 0.9, 0x17201d, 1.2, 1);
      drawRoundedRect(graphics, width * 0.02, -height * 0.12, width * 0.18, height * 0.15, 3, 0x80a9c9, 0.9, 0x17201d, 1.2, 1);
      drawRoundedRect(graphics, -width * 0.03, -height * 0.02, width * 0.13, height * 0.05, 1.5, 0xb7c2ba, 1, 0x17201d, 1, 1);
      fillPath(graphics, 0x1f2723, 1, path => {
        path.circle(-width * 0.27, height * 0.24, height * 0.11);
        path.circle(width * 0.29, height * 0.24, height * 0.11);
      });
      fillPath(graphics, 0xcfd8d3, 1, path => {
        path.circle(-width * 0.27, height * 0.24, height * 0.05);
        path.circle(width * 0.29, height * 0.24, height * 0.05);
      });
    }
  }

  function terrainNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function moveThroughPoints(graphics, points, dash = 0, gap = 0) {
    if (!points.length) return;
    const [firstX, firstY] = points[0] || [0, 0];
    graphics.moveTo(firstX, firstY);
    if (dash > 0 && gap > 0 && graphics.setLineDash) graphics.setLineDash([dash, gap]);
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i] || [0, 0];
      graphics.lineTo(x, y);
    }
  }

  function reconcileMap(targetMap, nextItems, getKey, createView, updateView, parent, options = {}) {
    const seen = new Set();
    for (const item of nextItems || []) {
      const key = getKey(item);
      seen.add(key);
      let view = targetMap.get(key);
      if (!view) {
        view = createView(item);
        targetMap.set(key, view);
        parent.addChild(view.container || view);
      }
      updateView(view, item);
    }
    for (const [key, view] of targetMap.entries()) {
      if (seen.has(key)) continue;
      if (options.beforeDelete) options.beforeDelete(view);
      parent.removeChild(view.container || view);
      destroyDisplayObject(view.container || view);
      targetMap.delete(key);
    }
  }

  function updateZones(renderState) {
    reconcileMap(
      objectMaps.zones,
      (renderState.zones || []).filter(zone => !zone.hidden),
      zone => zone.id,
      zone => ({ container: new PIXI.Graphics(), id: zone.id }),
      (view, zone) => {
        const g = view.container;
        g.clear();
        g.zIndex = -1000;
        const stroke = renderState.mouse.hoverZone === zone ? 0xfff4d0 : 0xd3a95f;
        const fillAlpha = renderState.mouse.hoverZone === zone ? 0.18 : 0.10;
        fillAndStrokePath(g, { fill: 0xd3a95f, fillAlpha, stroke, strokeWidth: 2 }, path => {
          if (zone.kind === 'radius') path.circle(zone.x, zone.y, zone.radius || 84);
          else path.roundRect(zone.x, zone.y, zone.w || 0, zone.h || 0, 14);
        });
      },
      zoneLayer
    );
  }

  function updateHoles(renderState) {
    reconcileMap(
      objectMaps.holes,
      renderState.holes || [],
      hole => hole.id || hole.ref,
      () => ({ container: new PIXI.Graphics() }),
      (view, hole) => {
        const g = view.container;
        g.clear();
        g.zIndex = (hole.y || 0) - 40;
        fillAndStrokePath(
          g,
          { fill: hole.planted ? 0x35593a : 0x2a2118, fillAlpha: hole.planted ? 0.75 : 0.55, stroke: hole.planted ? 0x9abf8f : 0xc7b683, strokeWidth: 2 },
          path => path.circle(hole.x, hole.y, hole.radius || 16)
        );
      },
      holeLayer
    );
  }

  function updateTrees(renderState) {
    reconcileMap(
      objectMaps.trees,
      renderState.trees || [],
      tree => tree.id || tree.ref,
      tree => ({ container: createTreeView(PIXI, tree, getNameTagTexture) }),
      (view, tree) => updateTreeView(view.container, tree, renderState.mouse.hoverTree === tree, getNameTagTexture),
      depthLayer
    );
  }

  function updateHemp(renderState) {
    reconcileMap(
      objectMaps.hemp,
      renderState.hempPlants || [],
      hemp => hemp.id || hemp.ref,
      hemp => ({ container: createHempView(PIXI, hemp) }),
      (view, hemp) => updateHempView(view.container, hemp, renderState.mouse.hoverHemp === hemp),
      depthLayer
    );
  }

  function updateRocks(renderState) {
    reconcileMap(
      objectMaps.rocks,
      renderState.rocks || [],
      rock => rock.id || rock.ref,
      rock => ({ container: createRockView(PIXI, rock) }),
      (view, rock) => updateRockView(view.container, rock),
      depthLayer
    );
  }

  function updateStructures(renderState) {
    reconcileMap(
      objectMaps.structures,
      renderState.structures || [],
      structure => structure.id || structure.ref,
      structure => ({ container: createStructureView(PIXI, structure, getBuildingTexture) }),
      (view, structure) => updateStructureView(view.container, structure, renderState.mouse.hoverStructure === structure, getBuildingTexture),
      depthLayer
    );
  }

  function updateItems(renderState) {
    const visibleItems = (renderState.camera?.zoom || 1) >= LOOSE_ITEM_RENDER_MIN_ZOOM ? (renderState.items || []) : [];
    reconcileMap(
      objectMaps.items,
      visibleItems,
      item => item.id || item.ref,
      item => ({ container: createItemView(PIXI, item, getItemTexture) }),
      (view, item) => updateItemView(view.container, item, renderState.mouse.hoverItem === item, getItemTexture),
      depthLayer
    );
  }

  function updateMonsters(renderState) {
    reconcileMap(
      objectMaps.monsters,
      renderState.monsters || [],
      monster => monster.id || monster.ref,
      monster => ({ container: createMonsterView(PIXI, monster) }),
      (view, monster) => updateMonsterView(view.container, monster, renderState.mouse.hoverMonster === monster),
      depthLayer
    );
  }

  function updateProjectiles(renderState) {
    reconcileMap(
      objectMaps.projectiles,
      renderState.projectiles || [],
      projectile => projectile.id || projectile.ref,
      () => ({ container: new PIXI.Graphics() }),
      (view, projectile) => {
        const g = view.container;
        g.clear();
        g.position.set(projectile.x || 0, projectile.y || 0);
        g.zIndex = getDepthAnchorY('projectile', projectile);
        const angle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
        g.rotation = angle;
        strokePath(g, 0xf1dfb8, 2, 1, path => {
          path.moveTo(-8, 0);
          path.lineTo(8, 0);
        });
        fillAndStrokePath(
          g,
          { fill: 0xd3a95f, fillAlpha: 1, stroke: 0xd3a95f, strokeWidth: 1 },
          path => {
            path.moveTo(10, 0);
            path.lineTo(3, -3);
            path.lineTo(3, 3);
            path.lineTo(10, 0);
          }
        );
      },
      depthLayer
    );
  }

  function updateBots(renderState) {
    const visibleBots = (renderState.camera?.zoom || 1) >= BOT_RENDER_MIN_ZOOM ? (renderState.bots || []) : [];
    reconcileMap(
      objectMaps.bots,
      visibleBots,
      bot => bot.id || bot.ref,
      bot => ({ container: createBotView(PIXI, bot, getItemTexture, getToolTexture) }),
      (view, bot) => updateBotView(view.container, bot, renderState.mouse.hoverBot === bot, getItemTexture, getToolTexture),
      depthLayer
    );
  }

  function updateRemotePlayers(renderState) {
    const remotePlayers = Object.values(renderState.multiplayer?.players || {}).filter(player => player && player.id !== renderState.multiplayer?.playerId && !player.disconnected);
    reconcileMap(
      objectMaps.remotePlayers,
      remotePlayers,
      player => player.id,
      player => ({ container: createRemotePlayerView(PIXI, player) }),
      (view, player) => updateRemotePlayerView(view.container, player),
      depthLayer
    );
  }

  function updateFloaters(renderState) {
    reconcileMap(
      objectMaps.floaters,
      renderState.floaters || [],
      floater => floater.id || `${floater.text}:${floater.x}:${floater.y}`,
      floater => ({ container: createFloaterView(PIXI, floater) }),
      (view, floater) => updateFloaterView(view.container, floater),
      floaterLayer
    );
  }

  function updatePlayer(renderState) {
    updateActorView(PIXI, playerView, {
      x: renderState.player.x,
      y: renderState.player.y,
      radius: renderState.player.r || 13,
      bodyColor: 0xeef5ef,
      accentColor: 0x76b77f,
      facingX: renderState.player.facingX || 1,
      facingY: renderState.player.facingY || 0,
      inventoryType: renderState.player.inventory?.type || null,
      weaponType: renderState.player.equipment?.weapon || null,
      shieldType: renderState.player.equipment?.shield || null,
      action: inferPlayerAction(renderState),
      hover: false,
      zIndex: getDepthAnchorY('player', renderState.player)
    }, getItemTexture, getToolTexture);
    updateAssistantView(assistantView, renderState.assistant, getDepthAnchorY('assistant', renderState.assistant));
  }

  function updateEffects(renderState) {
    updatePlacementPreview(renderState);
    updatePlayerTarget(renderState);
    updateZoneDraft(renderState);
  }

  function updatePlacementPreview(renderState) {
    const type = renderState.placementType;
    if (!type) {
      placementPreview.visible = false;
      return;
    }
    const def = BUILDING_TYPES[type] || { w: 80, h: 60 };
    placementPreview.visible = true;
    placementPreview.texture = getPlacementTexture(type, def.w || 80, def.h || 60);
    placementPreview.anchor.set(0.5);
    placementPreview.position.set(renderState.mouse.x || 0, renderState.mouse.y || 0);
    placementPreview.zIndex = 999999;
  }

  function updatePlayerTarget(renderState) {
    const target = renderState.player.target;
    playerTargetGraphics.clear();
    if (!target) return;
    playerTargetGraphics.zIndex = 999998;
    strokePath(playerTargetGraphics, 0x86b6d6, 2, 1, path => {
      path.circle(target.x, target.y, 14);
      path.moveTo(target.x - 19, target.y);
      path.lineTo(target.x + 19, target.y);
      path.moveTo(target.x, target.y - 19);
      path.lineTo(target.x, target.y + 19);
    });
    const queued = renderState.player.targetQueue || [];
    if (queued.length) {
      let previous = target;
      for (const nextTarget of queued) {
        strokePath(playerTargetGraphics, 0x9abf8f, 2, 1, path => {
          path.moveTo(previous.x, previous.y);
          path.lineTo(nextTarget.x, nextTarget.y);
          path.circle(nextTarget.x, nextTarget.y, 10);
        });
        previous = nextTarget;
      }
    }
  }

  function updateZoneDraft(renderState) {
    const draft = renderState.zoneDraft;
    zoneDraftGraphics.clear();
    if (!draft?.active || !draft.started) return;
    zoneDraftGraphics.zIndex = 999997;
    fillAndStrokePath(zoneDraftGraphics, { fill: 0xd3a95f, fillAlpha: 0.13, stroke: 0xfff4d0, strokeWidth: 2 }, path => {
      if (draft.kind === 'radius') {
        path.circle(draft.x1, draft.y1, draft.radius || Math.hypot((draft.x2 || 0) - (draft.x1 || 0), (draft.y2 || 0) - (draft.y1 || 0)));
      } else {
        const x = Math.min(draft.x1 || 0, draft.x2 || 0);
        const y = Math.min(draft.y1 || 0, draft.y2 || 0);
        const width = Math.abs((draft.x2 || 0) - (draft.x1 || 0));
        const height = Math.abs((draft.y2 || 0) - (draft.y1 || 0));
        path.roundRect(x, y, width, height, 14);
      }
    });
  }

  function updateHud(renderState) {
    const zoom = Math.round((renderState.camera?.zoom || 1) * 100);
    const multiplayer = renderState.multiplayer?.enabled ? ` | Multiplayer ${renderState.multiplayer.sessionId || 'session'}` : '';
    const clock = renderState.dayNight?.label ? ` | ${renderState.dayNight.label}` : '';
    const text = renderState.mobile
      ? `Tap move/select | Long-press action | Pinch or +/- zoom ${zoom}%${clock}${multiplayer}`
      : `WASD/arrows pan | Wheel zoom ${zoom}% | Right-click move/attack/deposit | E act | B build${clock}${multiplayer}`;
    hudText.text = text;
    hudText.position.set(30, 18);
    fpsText.text = `${Math.round(Number(renderState.fps || 0)) || 0} FPS`;
    fpsText.position.set(Math.max(20, renderState.W - fpsText.width - 30), 18);

    hudBar.clear();
    const barWidth = Math.min(renderState.W - 32, hudText.width + 28);
    drawRoundedRect(hudBar, 16, 14, barWidth, renderState.mobile ? 28 : 32, 999, 0x090e0c, 0.72, 0xd3a95f, 1);
    fpsBadge.clear();
    if (renderState.showFpsOverlay === false) {
      fpsText.visible = false;
      return;
    }
    fpsText.visible = true;
    const fps = Number(renderState.fps || 0);
    const target = Math.max(1, Number(renderState.targetFps || 60));
    const badgeColor = fps >= target * 0.85 ? 0x74cd89 : fps >= target * 0.6 ? 0xd3a95f : 0xcf5e52;
    drawRoundedRect(
      fpsBadge,
      Math.max(16, renderState.W - (fpsText.width + 24) - 16),
      14,
      fpsText.width + 24,
      28,
      999,
      0x080c0a,
      0.78,
      badgeColor,
      1
    );
  }

  function resize({ width, height } = {}) {
    const nextWidth = Math.max(1, Math.round(width || canvas.width || 1));
    const nextHeight = Math.max(1, Math.round(height || canvas.height || 1));
    app.renderer.resolution = getRendererResolution(rendererSettings);
    app.renderer.autoDensity = rendererSettings.highResolution;
    app.renderer.resize(nextWidth, nextHeight);
    updateBackdrop(nextWidth, nextHeight);
  }

  resize({
    width: canvas.parentElement?.clientWidth || canvas.clientWidth || canvas.width,
    height: canvas.parentElement?.clientHeight || canvas.clientHeight || canvas.height
  });

  function getWorldViewBounds(renderState) {
    const zoom = Math.max(0.001, renderState.camera?.zoom || 1);
    const left = renderState.camera?.x || 0;
    const top = renderState.camera?.y || 0;
    const width = renderState.W / zoom;
    const height = renderState.H / zoom;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  function getClippedMapView(renderState, view) {
    const mapWidth = renderState.map?.width || 0;
    const mapHeight = renderState.map?.height || 0;
    if (mapWidth <= 0 || mapHeight <= 0) return null;
    const left = Math.max(0, Math.floor(view?.left ?? 0));
    const top = Math.max(0, Math.floor(view?.top ?? 0));
    const right = Math.min(mapWidth, Math.ceil(view?.right ?? mapWidth));
    const bottom = Math.min(mapHeight, Math.ceil(view?.bottom ?? mapHeight));
    if (right <= left || bottom <= top) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function circleInView(x, y, radius, view) {
    return x + radius >= view.left && x - radius <= view.right && y + radius >= view.top && y - radius <= view.bottom;
  }

  function rectInView(x, y, width, height, view) {
    return x + width >= view.left && x <= view.right && y + height >= view.top && y <= view.bottom;
  }

  function getTreeDrawRadius(tree) {
    if (tree.stump) return Math.max(12, tree.radius || 20);
    if (tree.growthStage === 'sapling') return Math.max(10, tree.radius || 12);
    if (tree.growthStage === 'small_tree') return Math.max(18, tree.radius || 18);
    return Math.max(22, tree.radius || 22);
  }

  function lightingEnabled(renderState) {
    return renderState.lightingEffectsEnabled !== false;
  }

  function fogEnabled(renderState) {
    return !!renderState.fogOfWar?.enabled;
  }

  function getNightAmount(renderState) {
    return clamp(renderState.dayNight?.nightAmount ?? 0, 0, 1);
  }

  function structureFogPoint(structure) {
    return {
      x: (structure.x || 0) + (structure.w || 48) / 2,
      y: (structure.y || 0) + (structure.h || 48) / 2
    };
  }

  function fogStaticVisible(renderState, x, y) {
    return !fogEnabled(renderState) || isPointCurrentlyVisible(renderState.fogOfWar, x, y) || isPointExplored(renderState.fogOfWar, x, y);
  }

  function fogRevealSources(renderState) {
    return buildFogRevealSources({
      player: renderState.player,
      assistant: renderState.assistant,
      bots: renderState.bots,
      structures: renderState.structures,
      multiplayer: renderState.multiplayer
    });
  }

  function fogLightOccluders(renderState, view) {
    const occluders = [];
    for (const structure of renderState.structures || []) {
      const point = structureFogPoint(structure);
      if (!fogStaticVisible(renderState, point.x, point.y)) continue;
      if (!rectInView((structure.x || 0) - LIGHT_OCCLUDER_PAD, (structure.y || 0) - LIGHT_OCCLUDER_PAD, (structure.w || 48) + LIGHT_OCCLUDER_PAD * 2, (structure.h || 48) + LIGHT_OCCLUDER_PAD * 2, view)) continue;
      occluders.push({ kind: 'structure', x: structure.x || 0, y: structure.y || 0, w: structure.w || 48, h: structure.h || 48, shadowStrength: 0.08 });
    }
    for (const tree of renderState.trees || []) {
      const radius = getTreeDrawRadius(tree) * 0.34;
      if (!fogStaticVisible(renderState, tree.x, tree.y)) continue;
      if (!circleInView(tree.x, tree.y, radius + LIGHT_OCCLUDER_PAD, view)) continue;
      occluders.push({ kind: 'tree', x: tree.x, y: tree.y, radius: clamp(radius, 14, 34), shadowStrength: 0.04 });
    }
    for (const rock of renderState.rocks || []) {
      const radius = rock.radius || 18;
      if (!fogStaticVisible(renderState, rock.x, rock.y)) continue;
      if (!circleInView(rock.x, rock.y, radius + LIGHT_OCCLUDER_PAD, view)) continue;
      occluders.push({ kind: 'rock', x: rock.x, y: rock.y, radius: clamp(radius * 0.95, 14, 42), shadowStrength: 0.02 });
    }
    return occluders;
  }

  function drawNightTintOverlay(renderState, context, view) {
    const night = getNightAmount(renderState);
    if (night <= 0.01) return;
    context.fillStyle = `rgba(2, 9, 19, ${0.07 + night * 0.24})`;
    context.fillRect(view.left, view.top, view.width, view.height);
  }

  function drawStructureLightGlowsOverlay(renderState, context, view) {
    const night = getNightAmount(renderState);
    for (const structure of renderState.structures || []) {
      if (!isLightEmittingStructure(structure)) continue;
      const center = structureFogPoint(structure);
      if (!fogStaticVisible(renderState, center.x, center.y)) continue;
      const radius = getFogStructureLightRadius(structure);
      if (!circleInView(center.x, center.y, radius + 24, view)) continue;
      const alpha = 0.08 + night * 0.34;
      context.save();
      context.globalCompositeOperation = 'screen';
      const glow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
      glow.addColorStop(0, `rgba(255, 209, 113, ${alpha})`);
      glow.addColorStop(0.45, `rgba(211, 169, 95, ${alpha * 0.46})`);
      glow.addColorStop(1, 'rgba(211, 169, 95, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawRevealSourceGlowsOverlay(renderState, context, view, revealSources) {
    const night = getNightAmount(renderState);
    const sources = (revealSources || []).filter(source => source.kind !== 'structure');
    if (!sources.length) return;
    context.save();
    context.globalCompositeOperation = 'screen';
    for (const source of sources) {
      const radius = clamp((source.radius || 160) * 0.42, 70, 150);
      if (!circleInView(source.x, source.y, radius + 16, view)) continue;
      const tint = source.kind === 'player'
        ? [255, 226, 150]
        : source.kind === 'assistant'
          ? [126, 194, 255]
          : [156, 220, 166];
      const alpha = 0.08 + night * (source.kind === 'player' ? 0.24 : 0.16);
      const glow = context.createRadialGradient(source.x, source.y, 0, source.x, source.y, radius);
      glow.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha})`);
      glow.addColorStop(0.55, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha * 0.35})`);
      glow.addColorStop(1, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(source.x, source.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function fogOverlaySignature(renderState, view, fogView, revealSources, occluders, nightAmount) {
    const zoom = Math.max(0.001, renderState.camera?.zoom || 1);
    const cameraX = Math.round((renderState.camera?.x || 0) * zoom);
    const cameraY = Math.round((renderState.camera?.y || 0) * zoom);
    const zoomBucket = Math.round(zoom * 1000);
    const nightBucket = Math.round(clamp(nightAmount || 0, 0, 1) * 20);
    const sourcesKey = (revealSources || []).map(source => [
      source.kind || '',
      Math.round((source.x || 0) * 2),
      Math.round((source.y || 0) * 2),
      Math.round(source.radius || 0),
      Math.round((source.strength ?? 1) * 100)
    ].join(':')).join('|');
    const occluderKey = renderState.dynamicShadowsEnabled
      ? (occluders || []).map(occluder => [
          occluder.kind || '',
          Math.round(occluder.x || 0),
          Math.round(occluder.y || 0),
          Math.round(occluder.radius || occluder.w || 0),
          Math.round(occluder.h || 0)
        ].join(':')).join('|')
      : '';
    return [
      fogOverlayCanvas.width,
      fogOverlayCanvas.height,
      renderState.map?.width || 0,
      renderState.map?.height || 0,
      renderState.fogOfWar?.revision || 0,
      renderState.fogOfWar?.cellSize || 0,
      nightBucket,
      fogView.left,
      fogView.top,
      fogView.right,
      fogView.bottom,
      sourcesKey,
      occluderKey
    ].join(';');
  }

  function updateFogOverlay(renderState, view, fogView, revealSources, occluders, nightAmount) {
    if (!fogOverlayContext || !fogView) {
      fogOverlaySprite.visible = false;
      lastFogOverlaySignature = '';
      return;
    }
    const signature = fogOverlaySignature(renderState, view, fogView, revealSources, occluders, nightAmount);
    fogOverlaySprite.visible = true;
    if (signature === lastFogOverlaySignature) return;
    lastFogOverlaySignature = signature;
    resizeOverlayCanvas(fogOverlayCanvas, fogOverlaySprite, fogOverlayTexture, fogView.width, fogView.height, fogView.left, fogView.top);
    fogOverlayContext.clearRect(0, 0, fogOverlayCanvas.width, fogOverlayCanvas.height);
    drawFogOfWarOverlayScreen(fogOverlayContext, {
      fog: renderState.fogOfWar,
      map: renderState.map,
      view: fogView,
      fogView,
      sources: revealSources,
      occluders,
      nightAmount,
      zoom: 1,
      width: fogOverlayCanvas.width,
      height: fogOverlayCanvas.height,
      originX: fogView.left,
      originY: fogView.top
    });
    fogOverlayTexture.source.update();
    fogOverlayTexture.update();
  }

  function updateOverlay(renderState) {
    if (!overlayContext) {
      overlaySprite.visible = false;
      fogOverlaySprite.visible = false;
      return;
    }
    const lighting = lightingEnabled(renderState);
    const fog = fogEnabled(renderState);
    if (!lighting && !fog) {
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlaySprite.visible = false;
      fogOverlaySprite.visible = false;
      lastFogOverlaySignature = '';
      overlayTexture.source.update();
      overlayTexture.update();
      return;
    }
    const view = getWorldViewBounds(renderState);
    const clippedFogView = getClippedMapView(renderState, view);
    const revealSources = fog || lighting ? fogRevealSources(renderState) : [];
    const occluders = renderState.dynamicShadowsEnabled ? fogLightOccluders(renderState, clippedFogView || view) : [];
    const nightAmount = lighting ? getNightAmount(renderState) : 0;
    if (lighting && clippedFogView) {
      resizeOverlayCanvas(overlayCanvas, overlaySprite, overlayTexture, clippedFogView.width, clippedFogView.height, clippedFogView.left, clippedFogView.top);
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayContext.setTransform(1, 0, 0, 1, -clippedFogView.left, -clippedFogView.top);
      drawNightTintOverlay(renderState, overlayContext, clippedFogView);
      drawStructureLightGlowsOverlay(renderState, overlayContext, clippedFogView);
      drawRevealSourceGlowsOverlay(renderState, overlayContext, clippedFogView, revealSources);
      overlayTexture.source.update();
      overlayTexture.update();
      overlaySprite.visible = true;
    } else {
      overlaySprite.visible = false;
    }
    if (fog && clippedFogView) {
      updateFogOverlay(renderState, view, clippedFogView, revealSources, occluders, nightAmount);
    } else {
      fogOverlaySprite.visible = false;
      lastFogOverlaySignature = '';
    }
  }

  return {
    kind: 'pixi',
    text: 'PixiJS scene renderer',
    webgpu: false,
    app,
    getSettings() {
      return { ...rendererSettings };
    },
    updateSettings(nextSettings = {}) {
      const normalized = normalizeRendererSettings(nextSettings);
      const antialiasChanged = normalized.antialias !== rendererSettings.antialias;
      rendererSettings.highResolution = normalized.highResolution;
      rendererSettings.antialias = normalized.antialias;
      resize({ width: app.screen.width || canvas.clientWidth || canvas.width, height: app.screen.height || canvas.clientHeight || canvas.height });
      return {
        settings: { ...rendererSettings },
        reloadRequired: antialiasChanged
      };
    },
    resize,
    draw(renderState) {
      resize({ width: renderState.W, height: renderState.H });
      updateWorldStatic(renderState);
      worldViewport.scale.set(renderState.camera?.zoom || 1);
      worldViewport.position.set(-(renderState.camera?.x || 0) * (renderState.camera?.zoom || 1), -(renderState.camera?.y || 0) * (renderState.camera?.zoom || 1));
      terrainDetailSprite.visible = (renderState.camera?.zoom || 1) >= DECORATIVE_DETAIL_RENDER_MIN_ZOOM;

      updateCampaignArrival(renderState);
      updateZones(renderState);
      updateHoles(renderState);
      updateTrees(renderState);
      updateHemp(renderState);
      updateRocks(renderState);
      updateStructures(renderState);
      updateItems(renderState);
      updateMonsters(renderState);
      updateProjectiles(renderState);
      updateBots(renderState);
      updateRemotePlayers(renderState);
      updatePlayer(renderState);
      updateFloaters(renderState);
      updateEffects(renderState);
      updateOverlay(renderState);
      updateHud(renderState);
      app.renderer.render(app.stage);
    },
    destroy() {
      destroyTerrainTextures();
      for (const viewMap of Object.values(objectMaps)) {
        for (const view of viewMap.values()) destroyDisplayObject(view.container || view);
        viewMap.clear();
      }
      for (const texture of textureCache.values()) texture.destroy(true);
      textureCache.clear();
      app.destroy(false);
    }
  };
}

function createText(PIXI, text, style = {}) {
  const { resolution, ...textStyle } = style;
  return new PIXI.Text({
    text,
    resolution: resolution ?? undefined,
    style: {
      fill: '#e6eee8',
      fontFamily: 'system-ui',
      ...textStyle
    }
  });
}

function createTreeView(PIXI, tree, getNameTagTexture) {
  const container = new PIXI.Container();
  container.sortableChildren = true;
  container.trunk = new PIXI.Graphics();
  container.foliage = new PIXI.Graphics();
  container.hoverRing = new PIXI.Graphics();
  container.label = new PIXI.Sprite(getNameTagTexture(''));
  container.label.anchor.set(0.5);
  container.label.visible = false;
  container.addChild(container.hoverRing, container.trunk, container.foliage, container.label);
  updateTreeView(container, tree, false, getNameTagTexture);
  return container;
}

  function updateTreeView(container, tree, hover, getNameTagTexture) {
  const radius = tree.radius || (tree.stump ? 14 : (tree.growthStage === 'sapling' ? 14 : 22));
  container.position.set(tree.x || 0, tree.y || 0);
  container.zIndex = getDepthAnchorY('tree', tree);
    container.hoverRing.clear();
    if (hover) {
      fillAndStrokePath(container.hoverRing, { fill: 0xfff4d0, fillAlpha: 0.15, stroke: 0xfff4d0, strokeWidth: 2 }, path => path.circle(0, 0, radius + 12));
    }
    container.trunk.clear();
    container.foliage.clear();
    if (tree.stump) {
      fillPath(container.trunk, 0x71411f, 1, path => path.ellipse(0, 6, radius, Math.max(6, radius * 0.45)));
      container.label.visible = hover;
      container.label.texture = getNameTagTexture('tree stump');
      container.label.position.set(0, -radius - 8);
      return;
    }
    fillPath(
      container.trunk,
      0x71411f,
      1,
      path => path.roundRect(-Math.max(4, radius * 0.18), -radius * 0.2, Math.max(8, radius * 0.36), radius * 1.3, 4)
    );

    const leafColor = tree.growthStage === 'sapling' ? 0x80b46d : tree.growthStage === 'small_tree' ? 0x5b8d49 : 0x46753d;
    fillPath(container.foliage, leafColor, 1, path => {
      path.circle(-radius * 0.34, -radius * 0.55, radius * 0.72);
      path.circle(radius * 0.34, -radius * 0.60, radius * 0.76);
      path.circle(0, -radius * 0.92, radius * 0.84);
    });
    container.label.visible = hover;
    if (hover) {
      container.label.texture = getNameTagTexture(tree.growthStage === 'sapling' ? 'small sapling' : tree.growthStage === 'small_tree' ? 'small tree' : 'grown tree');
      container.label.position.set(0, -radius - 18);
    }
  }

function createHempView(PIXI, hemp) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.label = createText(PIXI, 'hemp plant', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.label);
  updateHempView(container, hemp, false);
  return container;
}

function updateHempView(container, hemp, hover) {
  const radius = hemp.radius || 14;
  container.position.set(hemp.x || 0, hemp.y || 0);
  container.zIndex = getDepthAnchorY('hemp', hemp);
  container.graphics.clear();
  fillAndStrokePath(container.graphics, { fill: 0x8fbf76, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0xd8f0c8, strokeWidth: 2 }, path => {
    path.ellipse(0, 2, radius * 0.8, radius * 0.44);
  });
  strokePath(container.graphics, hover ? 0xfff4d0 : 0xd8f0c8, 2, 1, path => {
    path.moveTo(-radius * 0.4, -radius * 0.3);
    path.lineTo(radius * 0.2, radius * 0.35);
    path.moveTo(0, -radius * 0.4);
    path.lineTo(radius * 0.5, radius * 0.28);
  });
  container.label.visible = hover;
  container.label.position.set(0, -radius - 10);
}

function createRockView(PIXI, rock) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.addChild(container.graphics);
  updateRockView(container, rock);
  return container;
}

function updateRockView(container, rock) {
  const radius = rock.radius || 18;
  container.position.set(rock.x || 0, rock.y || 0);
  container.zIndex = getDepthAnchorY('rock', rock);
  container.graphics.clear();
  fillAndStrokePath(container.graphics, { fill: 0x6d7771, fillAlpha: 1, stroke: 0x3a4242, strokeWidth: 2 }, path => {
    path.moveTo(-radius * 0.9, radius * 0.1);
    path.lineTo(-radius * 0.3, -radius * 0.75);
    path.lineTo(radius * 0.7, -radius * 0.65);
    path.lineTo(radius, radius * 0.2);
    path.lineTo(radius * 0.1, radius * 0.9);
    path.lineTo(-radius * 0.7, radius * 0.45);
    path.lineTo(-radius * 0.9, radius * 0.1);
  });
}

function createStructureView(PIXI, structure, getBuildingTexture) {
  const container = new PIXI.Container();
  const hoverRing = new PIXI.Graphics();
  const shadow = new PIXI.Graphics();
  const sprite = new PIXI.Sprite();
  const label = createText(PIXI, '', { fontSize: 11, fontWeight: '700' });
  const subtitle = createText(PIXI, '', { fontSize: 10, fontWeight: '600', fill: '#ffe3a7' });
  const bars = new PIXI.Graphics();
  label.anchor.set(0.5, 0);
  subtitle.anchor.set(0.5, 0);
  container.hoverRing = hoverRing;
  container.shadow = shadow;
  container.sprite = sprite;
  container.label = label;
  container.subtitle = subtitle;
  container.bars = bars;
  container.addChild(shadow, hoverRing, sprite, label, subtitle, bars);
  updateStructureView(container, structure, false, getBuildingTexture);
  return container;
}

function updateStructureView(container, structure, hover, getBuildingTexture) {
  const def = BUILDING_TYPES[structure.type] || { w: structure.w || 90, h: structure.h || 60 };
  const width = structure.w || def.w || 90;
  const height = structure.h || def.h || 60;
  container.position.set(structure.x || 0, structure.y || 0);
  container.zIndex = getDepthAnchorY('structure', { ...structure, h: height });
  container.shadow.clear();
  container.hoverRing.clear();
  container.bars.clear();
  fillPath(container.shadow, 0x000000, 0.22, path => path.ellipse(0, height * 0.24, width * 0.42, height * 0.18));
  if (structure.rangedAttack && hover) {
    strokePath(container.hoverRing, 0xd3a95f, 2, 0.32, path => path.circle(0, 0, structure.rangedAttack.range || 260));
  }
  container.sprite.texture = getBuildingTexture(structure.type, width, height, hover);
  container.sprite.anchor.set(0.5);
  container.label.visible = hover;
  container.subtitle.visible = hover;
  if (hover) {
    container.label.text = structure.name || BUILDING_TYPES[structure.type]?.label || structure.type;
    container.label.position.set(0, height * 0.48);
    container.subtitle.text = structureHoverLine(structure);
    container.subtitle.position.set(0, height * 0.48 + 16);
    if (structure.type === 'throne') {
      drawBarGraphic(
        container.bars,
        -42,
        height / 2 + 8,
        84,
        7,
        Math.max(0, structure.hp || 0) / Math.max(1, structure.maxHp || 120),
        structure.ownerId === 'p1' ? 0x80a9c9 : 0xc86b5f
      );
    }
    if (structure.processing) {
      drawBarGraphic(
        container.bars,
        -28,
        height / 2 + 8,
        56,
        6,
        1 - Math.max(0, structure.processing.remaining || 0) / Math.max(0.1, structure.processing.total || 1),
        0xd3a95f
      );
    }
  }
}

function structureHoverLine(structure) {
  if (structure.type === 'throne') return `${structure.ownerLabel || 'player'} · ${Math.max(0, Math.ceil(structure.hp ?? 0))}/${structure.maxHp || 120} HP`;
  if (['item_palette', 'power_station', 'robotics_parts_bin'].includes(structure.type)) return `${structure.storageType || 'empty'} ${structure.stored || 0}/${structure.capacity || 0}`;
  if (['camper_van', 'hammock_camp', 'ultrabook_desk', 'solar_array', 'portable_3d_printer', 'assembler'].includes(structure.type)) return structure.label || 'story object';
  if (structure.type === 'workbench') return `S${structure.sticks || 0} R${structure.stones || 0} ${(structure.workbenchRecipe || 'crude_axe').replace('crude_', '')}`;
  if (structure.type === 'factory') return `L${structure.logs || 0} P${structure.planks || 0} Po${structure.poles || 0} Se${structure.tree_seeds || 0}`;
  if (structure.type === 'smithery') return `S${structure.sticks || 0} P${structure.planks || 0} ${(structure.smitheryRecipe || 'wooden_sword').replace('wooden_', '')}`;
  if (structure.type === 'bowmaker') return `S${structure.sticks || 0}/2 H${structure.hemps || 0}/3 B${structure.bows || 0}`;
  if (structure.type === 'defensetower') return `R${structure.rangedAttack?.range || 260} · ${structure.rangedAttack?.damage || 1}/s`;
  return `L${structure.logs || 0} P${structure.planks || 0} Po${structure.poles || 0}`;
}

function createItemView(PIXI, item, getItemTexture) {
  const container = new PIXI.Container();
  const hoverRing = new PIXI.Graphics();
  const shadow = new PIXI.Graphics();
  const sprite = new PIXI.Sprite(getItemTexture(item.type));
  const label = createText(PIXI, itemLabel(item.type), { fontSize: 11, fontWeight: '700' });
  sprite.anchor.set(0.5);
  label.anchor.set(0.5, 1);
  container.hoverRing = hoverRing;
  container.shadow = shadow;
  container.sprite = sprite;
  container.label = label;
  container.addChild(hoverRing, shadow, sprite, label);
  updateItemView(container, item, false, getItemTexture);
  return container;
}

function updateItemView(container, item, hover, getItemTexture) {
  const bob = Math.sin(performance.now() / 400 + (item.bob || 0)) * 2;
  container.position.set(item.x || 0, (item.y || 0) + bob);
  container.zIndex = getDepthAnchorY('item', item, { bob });
  container.hoverRing.clear();
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.24, path => path.ellipse(0, 9, 11, 4));
  if (hover) {
    fillAndStrokePath(container.hoverRing, { fill: 0xfff4d0, fillAlpha: 0.20, stroke: 0xfff4d0, strokeWidth: 2 }, path => path.circle(0, 0, 17));
  }
  container.sprite.texture = getItemTexture(item.type);
  container.label.visible = hover;
  container.label.position.set(0, -24);
}

function createMonsterView(PIXI, monster) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.health = new PIXI.Graphics();
  container.label = createText(PIXI, monster.name || 'passive monster', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.health, container.label);
  updateMonsterView(container, monster, false);
  return container;
}

function updateMonsterView(container, monster, hover) {
  const radius = monster.radius || 18;
  container.position.set(monster.x || 0, monster.y || 0);
  container.zIndex = getDepthAnchorY('monster', monster);
  container.graphics.clear();
  if (hover) {
    fillPath(container.graphics, 0xfff4d0, 0.18, path => path.circle(0, 0, radius + 8));
  }
  const body = monster.type === 'night_monster' ? 0x6b3f2f : 0x344d47;
  fillAndStrokePath(container.graphics, { fill: body, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x0d1714, strokeWidth: hover ? 3 : 2 }, path => {
    path.ellipse(0, 0, radius, radius * 0.82);
  });
  fillPath(container.graphics, monster.type === 'night_monster' ? 0xffd982 : 0xe5ece8, 1, path => {
    path.circle(-radius * 0.33, -radius * 0.1, 3.2);
    path.circle(radius * 0.33, -radius * 0.1, 3.2);
  });
  container.health.clear();
  drawBarGraphic(container.health, -20, -radius - 16, 40, 5, (monster.hp || 0) / Math.max(1, monster.maxHp || 10), 0x8fb9b5);
  container.label.visible = hover;
  if (hover) container.label.position.set(0, -radius - 26);
}

function createBotView(PIXI, bot, getItemTexture, getToolTexture) {
  const isDog = bot.kind === 'dog';
  return isDog ? createDogView(PIXI, bot, getItemTexture) : createWorkerBotView(PIXI, bot, getItemTexture, getToolTexture);
}

function createWorkerBotView(PIXI, bot, getItemTexture, getToolTexture) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.toolRight = new PIXI.Sprite();
  container.toolRight.anchor.set(0.5);
  container.toolLeft = new PIXI.Sprite();
  container.toolLeft.anchor.set(0.5);
  container.label = createText(PIXI, bot.name || `Bot ${bot.id}`, { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.shadow, container.body, container.inventory, container.toolRight, container.toolLeft, container.label);
  updateBotView(container, bot, false, getItemTexture, getToolTexture);
  return container;
}

function createDogView(PIXI, bot, getItemTexture) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.label = createText(PIXI, bot.name || 'Dog', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 0);
  container.addChild(container.shadow, container.body, container.inventory, container.label);
  updateBotView(container, bot, false, getItemTexture, () => null);
  return container;
}

function updateBotView(container, bot, hover, getItemTexture, getToolTexture) {
  if (bot.kind === 'dog') {
    updateDogView(container, bot, hover, getItemTexture);
    return;
  }
  const radius = bot.r || 11;
  const bodyColor = parseColor(bot.color || '#76b77f');
  const facingRight = (bot.facingX ?? 1) >= 0;
  const inventoryIsHandTool = isBotHandTool(bot.inventory?.type);
  const handToolTypes = inventoryIsHandTool ? [bot.inventory?.type] : [];
  container.position.set(bot.x || 0, bot.y || 0);
  container.zIndex = getDepthAnchorY('bot', bot);
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.26, path => path.ellipse(0, radius + 5, radius + 8, 5));
  container.body.clear();
  fillAndStrokePath(container.body, { fill: bodyColor, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x0e1512, strokeWidth: hover ? 4 : 2 }, path => {
    path.roundRect(-radius - 2, -radius - 2, (radius + 2) * 2, (radius + 2) * 2, 8);
  });
  fillPath(container.body, 0xffffff, 0.22, path => {
    path.roundRect(-radius + 2, -radius + 2, radius * 1.4, radius * 0.58, 5);
  });
  container.inventory.visible = !!(bot.inventory?.type) && !inventoryIsHandTool;
  if (bot.inventory?.type && !inventoryIsHandTool) {
    container.inventory.texture = getItemTexture(bot.inventory.type);
    container.inventory.position.set(-1, -24);
    container.inventory.scale.set(0.72);
  }
  container.toolRight.visible = handToolTypes.length > 0 || !!bot.equipment?.weapon;
  container.toolLeft.visible = !!bot.equipment?.shield;
  if (handToolTypes.length > 0 || bot.equipment?.weapon) {
    container.toolRight.texture = getToolTexture(handToolTypes[0] || bot.equipment.weapon);
    container.toolRight.position.set((facingRight ? 1 : -1) * (radius + 8), 5);
    container.toolRight.scale.set(0.86);
  }
  if (handToolTypes[1] || bot.equipment?.shield) {
    container.toolLeft.texture = getToolTexture(handToolTypes[1] || bot.equipment.shield);
    container.toolLeft.position.set(-17, -7);
    container.toolLeft.scale.set(0.86);
    container.toolLeft.visible = true;
  }
  container.label.visible = hover;
  if (hover) {
    container.label.text = bot.name || `Bot ${bot.id}`;
    container.label.position.set(0, -radius - 24);
  }
}

function updateDogView(container, bot, hover, getItemTexture) {
  const radius = bot.r || 12;
  container.position.set(bot.x || 0, bot.y || 0);
  container.zIndex = getDepthAnchorY('bot', bot);
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.25, path => path.ellipse(0, radius + 6, radius + 9, 5));
  container.body.clear();
  if (hover) {
    fillPath(container.body, 0xfff4d0, 0.15, path => path.circle(0, 0, radius + 10));
  }
  fillAndStrokePath(container.body, { fill: 0x8a6246, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x3c281f, strokeWidth: hover ? 3 : 2 }, path => {
    path.roundRect(-radius - 3, -radius + 2, (radius + 3) * 2, radius * 1.45, 8);
  });
  fillPath(container.body, 0x9d7457, 1, path => path.ellipse(0, -radius * 0.2, radius * 0.95, radius * 0.78));
  container.inventory.visible = !!bot.inventory?.type;
  if (bot.inventory?.type) {
    container.inventory.texture = getItemTexture(bot.inventory.type);
    container.inventory.position.set(0, -radius * 1.75);
    container.inventory.scale.set(0.72);
  }
  container.label.text = bot.name || 'Dog';
  container.label.position.set(0, radius + 10);
  container.label.visible = true;
}

function createActorView(PIXI, options) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  container.character = null;
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.weapon = new PIXI.Sprite();
  container.weapon.anchor.set(0.5);
  container.shield = new PIXI.Sprite();
  container.shield.anchor.set(0.5);
  container.label = createText(PIXI, options.label || '', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.shadow, container.body, container.inventory, container.weapon, container.shield, container.label);
  return { container, options };
}

function updateActorView(PIXI, view, actorState, getItemTexture, getToolTexture) {
  const { container } = view;
  const radius = actorState.radius || 13;
  container.position.set(actorState.x || 0, actorState.y || 0);
  container.zIndex = actorState.zIndex || 0;
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.28, path => path.ellipse(0, radius + 5, radius + 8, 5));
  const animation = getCharacterAnimationFrame(view.options.characterAssets, actorState);
  if (animation) {
    if (!container.character) {
      container.character = new PIXI.Sprite(animation.textures[0]);
      container.character.anchor.set(0.5, 1);
      container.character.visible = false;
      container.addChildAt(container.character, 1);
    }
    container.character.visible = true;
    container.body.visible = false;
    const frameTexture = getCharacterFrameTexture(container.character, animation, actorState);
    if (frameTexture) container.character.texture = frameTexture;
    container.character.scale.set(animation.scale);
    container.character.position.set(0, animation.yOffset);
    container.character.anchor.set(0.5, 1);
  } else {
    if (container.character) container.character.visible = false;
    container.body.visible = true;
    container.body.clear();
    fillAndStrokePath(container.body, { fill: actorState.bodyColor, fillAlpha: 1, stroke: 0x26322d, strokeWidth: 2 }, path => path.circle(0, 0, radius + 1));
    const look = getLookOffset(actorState.facingX, actorState.facingY, 4);
    fillPath(container.body, actorState.accentColor, 1, path => path.circle(look.x, -3 + look.y, 3));
  }
  container.inventory.visible = !!actorState.inventoryType;
  if (actorState.inventoryType) {
    container.inventory.texture = getItemTexture(actorState.inventoryType);
    container.inventory.position.set(0, -25);
    container.inventory.scale.set(0.72);
  }
  container.weapon.visible = !!actorState.weaponType;
  if (actorState.weaponType) {
    container.weapon.texture = getToolTexture(actorState.weaponType);
    container.weapon.position.set(19, -5);
    container.weapon.scale.set(0.86);
  }
  container.shield.visible = !!actorState.shieldType;
  if (actorState.shieldType) {
    container.shield.texture = getToolTexture(actorState.shieldType);
    container.shield.position.set(-18, -5);
    container.shield.scale.set(0.86);
  }
}

function createAssistantView(PIXI) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.addChild(container.graphics);
  return { container };
}

function updateAssistantView(view, assistant, zIndex) {
  const g = view.container.graphics;
  const look = getLookOffset(assistant.facingX || 1, assistant.facingY || 0, 2.8);
  const radius = 9 + Math.sin(performance.now() / 500) * 1;
  view.container.position.set(assistant.x || 0, assistant.y || 0);
  view.container.zIndex = zIndex;
  g.clear();
  fillPath(g, 0x76b77f, 0.16, path => path.circle(0, 0, radius + 7));
  fillPath(g, 0x76b77f, 1, path => path.circle(0, 0, radius));
  fillPath(g, 0xe6f4e5, 1, path => path.circle(look.x, -3 + look.y, 2));
}

function createRemotePlayerView(PIXI, player) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.label = createText(PIXI, player.label || player.id, { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.label);
  updateRemotePlayerView(container, player);
  return container;
}

function updateRemotePlayerView(container, player) {
  const color = player.id === 'p1' ? 0x80a9c9 : 0xc86b5f;
  container.position.set(player.x || 0, player.y || 0);
  container.zIndex = getDepthAnchorY('remote_player', player);
  container.graphics.clear();
  fillPath(container.graphics, 0x000000, 0.24, path => path.ellipse(0, 18, 22, 7));
  fillAndStrokePath(container.graphics, { fill: color, fillAlpha: 1, stroke: 0xfff4d0, strokeWidth: 2.5 }, path => path.circle(0, 0, 15));
  container.label.text = player.label || (player.id === 'p1' ? 'Player 1' : 'Player 2');
  container.label.position.set(0, -27);
}

function createFloaterView(PIXI, floater) {
  const container = createText(PIXI, floater.text || '', { fontSize: 12, fontWeight: '800' });
  container.anchor.set(0.5);
  updateFloaterView(container, floater);
  return container;
}

function updateFloaterView(container, floater) {
  container.text = floater.text || '';
  container.position.set(floater.x || 0, floater.y || 0);
  container.alpha = Math.max(0, Math.min(1, (floater.life || 0) / Math.max(1, floater.max || 1)));
  container.zIndex = 1000000 + (floater.y || 0);
  container.style.fill = floater.color || '#d3a95f';
}

function drawBarGraphic(graphics, x, y, width, height, ratio, color) {
  fillPath(graphics, 0x050807, 0.78, path => path.roundRect(x, y, width, height, height / 2));
  fillPath(graphics, color, 1, path => path.roundRect(x + 1, y + 1, Math.max(0, (width - 2) * Math.max(0, Math.min(1, ratio))), height - 2, height / 2));
}

function getLookOffset(facingX = 1, facingY = 0, amount = 4) {
  const length = Math.hypot(facingX, facingY);
  if (length < 0.001) return { x: amount, y: 0 };
  return { x: (facingX / length) * amount, y: (facingY / length) * amount * 0.6 };
}

function parseColor(value) {
  const clean = String(value || '#76b77f').replace('#', '').slice(0, 6);
  const parsed = Number.parseInt(clean || '76b77f', 16);
  return Number.isFinite(parsed) ? parsed : 0x76b77f;
}

function isBotHandTool(type) {
  return BOT_HAND_TOOL_TYPES.has(type);
}

async function loadCharacterAssets(PIXI) {
  const basePath = '/public/assets/character/Sprites';
  const entries = await Promise.all(CHARACTER_ANIMATION_NAMES.flatMap(name => ['up', 'down', 'left', 'right'].map(async direction => {
    const folder = CHARACTER_PATHS[name];
    const file = `${basePath}/${folder}/${name}_${direction}.png`;
    try {
      const image = await loadImage(file);
      const animation = sliceCharacterSheet(PIXI, image, CHARACTER_FRAME_SIZE);
      return [`${name}:${direction}`, animation];
    } catch {
      return [`${name}:${direction}`, null];
    }
  })));
  const byAction = {};
  for (const [key, frameTextures] of entries) {
    const [name, direction] = key.split(':');
    (byAction[name] ||= {})[direction] = frameTextures;
  }
  return {
    ready: true,
    ...byAction
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load character asset: ${src}`));
    image.src = src;
  });
}

function sliceCharacterSheet(PIXI, image, frameSize) {
  const bounds = findOpaqueBounds(image, frameSize);
  if (!bounds) return null;
  const frames = [];
  const columns = Math.max(1, Math.floor((image.width || 0) / frameSize.width));
  const rows = Math.max(1, Math.floor((image.height || 0) / frameSize.height));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const canvas = document.createElement('canvas');
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        col * frameSize.width + bounds.x,
        row * frameSize.height + bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      const texture = PIXI.Texture.from(canvas);
      frames.push(texture);
    }
  }
  return { textures: frames, scale: CHARACTER_SCALE, yOffset: CHARACTER_GROUND_OFFSET };
}

function getCharacterAnimationFrame(characterAssets, actorState) {
  if (!characterAssets?.ready) return null;
  const facing = getFacingDirection(actorState.facingX, actorState.facingY);
  const action = getCharacterAction(actorState.action);
  const animationKey = action === 'attack' ? (Math.floor(performance.now() / 250) % 2 === 0 ? 'attack1' : 'attack2') : action;
  const animation = characterAssets[animationKey] || characterAssets.idle;
  const textures = animation?.[facing]?.textures || animation?.down?.textures;
  if (!Array.isArray(textures) || textures.length === 0) return null;
  const speed = action === 'run' ? 70 : action === 'attack' ? 55 : 110;
  return {
    textures,
    speed,
    scale: animation?.[facing]?.scale || animation?.down?.scale || CHARACTER_SCALE,
    yOffset: animation?.[facing]?.yOffset || animation?.down?.yOffset || CHARACTER_GROUND_OFFSET
  };
}

function getCharacterFrameTexture(characterSprite, animation, actorState) {
  const textures = animation.textures || [];
  if (textures.length === 0) return null;
  const now = performance.now();
  const action = getCharacterAction(actorState.action);
  const stateKey = `${action}:${getFacingDirection(actorState.facingX, actorState.facingY)}:${textures.length}`;
  characterSprite._animState ||= { key: null, startedAt: 0, frameIndex: 0, lastFrameIndex: -1 };
  const animState = characterSprite._animState;
  if (animState.key !== stateKey) {
    animState.key = stateKey;
    animState.startedAt = now;
    animState.frameIndex = 0;
    animState.lastFrameIndex = -1;
  }
  if (action === 'attack') {
    const attackDuration = 280;
    const elapsed = now - animState.startedAt;
    const lastIndex = textures.length - 1;
    const nextIndex = elapsed >= attackDuration ? lastIndex : Math.min(lastIndex, Math.floor((elapsed / attackDuration) * textures.length));
    animState.frameIndex = nextIndex;
  } else {
    const frameDuration = Math.max(50, animation.speed || 100);
    animState.frameIndex = Math.floor((now - animState.startedAt) / frameDuration) % textures.length;
  }
  return textures[animState.frameIndex] || textures[0];
}

function findOpaqueBounds(image, frameSize) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const frameX = minX % frameSize.width;
  const frameY = minY % frameSize.height;
  const widthPx = Math.min(frameSize.width, maxX - minX + 1);
  const heightPx = Math.min(frameSize.height, maxY - minY + 1);
  return {
    x: frameX,
    y: frameY,
    width: widthPx,
    height: heightPx
  };
}

function getCharacterAction(action) {
  const value = String(action || '').toLowerCase();
  if (value.includes('attack')) return 'attack';
  if (value.includes('run') || value.includes('move') || value.includes('walk') || value.includes('dash') || value.includes('target')) return 'run';
  if (value.includes('hurt') || value.includes('death') || value.includes('heal')) return 'idle';
  return 'idle';
}

function getFacingDirection(facingX = 1, facingY = 0) {
  if (Math.abs(facingX) > Math.abs(facingY)) return facingX < 0 ? 'left' : 'right';
  return facingY < 0 ? 'up' : 'down';
}

function inferPlayerAction(renderState) {
  if (renderState.player?.attackCooldown > 0) return 'attack';
  if (renderState.player?.target || (Array.isArray(renderState.player?.targetQueue) && renderState.player.targetQueue.length > 0)) return 'run';
  return 'idle';
}
