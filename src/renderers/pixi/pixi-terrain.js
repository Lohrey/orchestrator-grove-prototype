import {
  computePolylineProgress,
  fillPath,
  strokePath,
  terrainNoise,
  moveThroughPoints,
  isCampaignArrivalActive,
  fillAndStrokePath,
  drawRoundedRect,
  samplePolyline
} from './pixi-layers.js?v=grove_tileset_0628';
import { getCampaignArrivalScene } from '../../campaign-scenes.js?v=t_campaign_scenes_0623';
import { loadLpcTerrain, getLpcTerrain, LPC_TILE_SIZE } from '../shared/lpc-terrain-loader.js?v=grove_tileset_0628';
import { clamp } from '../../utils.js?v=grove_pixi_fixes_0628';

export function buildTerrainBaseTexture(PIXI, renderState, { buildStaticTexture, createGraphicsLayer }) {
  const width = renderState.map.width;
  const height = renderState.map.height;
  return buildStaticTexture(width, height, layer => {
    // ── LPC grass tile overlay (canvas-backed) ────────────────────
    // Draw tiled LPC grass sprites via a temporary canvas, then add as texture.
    const lpcBitmap = getLpcTerrain();
    if (lpcBitmap) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = width;
      tileCanvas.height = height;
      const tc = tileCanvas.getContext('2d');
      tc.globalAlpha = 0.40;
      const ts = LPC_TILE_SIZE;
      for (let y = 0; y < height; y += ts) {
        for (let x = 0; x < width; x += ts) {
          const noise = terrainNoise(x * 0.3, y * 0.3);
          const frame = Math.floor(noise * 15.99);
          const sx = (frame % 4) * ts;
          const sy = Math.floor(frame / 4) * ts;
          tc.drawImage(lpcBitmap, sx, sy, ts, ts, x, y, ts, ts);
        }
      }
      const tileTex = PIXI.Texture.from(tileCanvas);
      const tileSprite = new PIXI.Sprite(tileTex);
      tileSprite.alpha = 1;
      layer.addChild(tileSprite);
    }

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

export function buildTerrainDetailTexture(PIXI, renderState, { buildStaticTexture, createGraphicsLayer }) {
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

export function buildTerrainFeatureTexture(PIXI, renderState, { buildStaticTexture }) {
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

export function updateCampaignArrival(PIXI, renderState, campaignArrivalGraphics, { getCampaignArrivalScene: getScene }) {
  campaignArrivalGraphics.clear();
  if (!isCampaignArrivalActive(renderState)) return;
  const scene = getScene(renderState.campaignArrival?.sceneId);
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

export function renderMapFeature(graphics, feature) {
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

export function getBackdropTexture(width, height, { buildTexture }) {
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
