import {
  lightingEnabled,
  fogEnabled,
  getNightAmount,
  structureFogPoint,
  fogStaticVisible,
  fogRevealSources,
  fogLightOccluders,
  circleInView,
  getWorldViewBounds,
  getClippedMapView,
  strokePath,
  fillAndStrokePath
} from './pixi-layers.js?v=t_renderer_split_0627';
import {
  isLightEmittingStructure,
  structureLightRadius as getFogStructureLightRadius,
  drawFogOfWarOverlayScreen
} from '../../fog-of-war.js?v=t_building_kits_0618';
import {
  isPointCurrentlyVisible,
  isPointExplored,
  fogRevealSources as buildFogRevealSources
} from '../../fog-of-war.js?v=t_building_kits_0618';

const fogHelpers = { isPointCurrentlyVisible, isPointExplored };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function drawNightTintOverlay(renderState, context, view) {
  const night = getNightAmount(renderState);
  if (night <= 0.01) return;
  context.fillStyle = `rgba(2, 9, 19, ${0.07 + night * 0.24})`;
  context.fillRect(view.left, view.top, view.width, view.height);
}

export function drawStructureLightGlowsOverlay(renderState, context, view) {
  const night = getNightAmount(renderState);
  for (const structure of renderState.structures || []) {
    if (!isLightEmittingStructure(structure)) continue;
    const center = structureFogPoint(structure);
    if (!fogStaticVisible(renderState, center.x, center.y, fogHelpers)) continue;
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

export function drawRevealSourceGlowsOverlay(renderState, context, view, revealSources) {
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

export function updateFogOverlay(renderState, view, fogView, revealSources, occluders, nightAmount, {
  fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture,
  resizeOverlayCanvas, lastFogOverlaySignatureRef
}) {
  if (!fogOverlayContext || !fogView) {
    fogOverlaySprite.visible = false;
    lastFogOverlaySignatureRef.value = '';
    return;
  }
  fogOverlaySprite.visible = true;

  // The fog sprite covers the ENTIRE map at world (0,0). The worldViewport
  // transform (scale + translate) handles camera movement automatically, so
  // we never need to reposition the sprite. This eliminates drift, opposite-
  // direction movement, and visible canvas edges.
  const mapWidth = renderState.map?.width || 0;
  const mapHeight = renderState.map?.height || 0;

  // Signature: only depends on fog state, sources, and map size — NOT camera.
  // Adding camera position here would force a full-map redraw every frame.
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
  const signature = [
    mapWidth, mapHeight,
    renderState.fogOfWar?.revision || 0,
    renderState.fogOfWar?.cellSize || 0,
    nightBucket,
    sourcesKey,
    occluderKey
  ].join(';');

  if (signature === lastFogOverlaySignatureRef.value) return;
  lastFogOverlaySignatureRef.value = signature;

  // Resize canvas to full map size (only when map dimensions change).
  if (fogOverlayCanvas.width !== mapWidth || fogOverlayCanvas.height !== mapHeight) {
    fogOverlayCanvas.width = Math.max(1, mapWidth);
    fogOverlayCanvas.height = Math.max(1, mapHeight);
  }
  fogOverlaySprite.position.set(0, 0);
  fogOverlaySprite.scale.set(1);

  // Redraw the full-map fog. Areas outside the current viewport are still
  // drawn (cheap fillRect + cell punch-out) so the edges are always dark.
  fogOverlayContext.clearRect(0, 0, fogOverlayCanvas.width, fogOverlayCanvas.height);
  drawFogOfWarOverlayScreen(fogOverlayContext, {
    fog: renderState.fogOfWar,
    map: renderState.map,
    view: { left: 0, top: 0, width: mapWidth, height: mapHeight, right: mapWidth, bottom: mapHeight },
    fogView: { left: 0, top: 0, width: mapWidth, height: mapHeight, right: mapWidth, bottom: mapHeight },
    sources: revealSources,
    occluders,
    nightAmount,
    zoom: 1,
    width: mapWidth,
    height: mapHeight,
    originX: 0,
    originY: 0
  });
  fogOverlayTexture.source.update();
  fogOverlayTexture.update();
}

export function updateOverlay(renderState, {
  overlayCanvas, overlayContext, overlaySprite, overlayTexture,
  fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture,
  resizeOverlayCanvas, lastFogOverlaySignatureRef
}) {
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
    lastFogOverlaySignatureRef.value = '';
    overlayTexture.source.update();
    overlayTexture.update();
    return;
  }
  const view = getWorldViewBounds(renderState);
  const clippedFogView = getClippedMapView(renderState, view);
  const revealSources = fog || lighting ? fogRevealSources(renderState, buildFogRevealSources) : [];
  const occluders = renderState.dynamicShadowsEnabled ? fogLightOccluders(renderState, clippedFogView || view, fogHelpers) : [];
  const nightAmount = lighting ? getNightAmount(renderState) : 0;
  if (lighting && clippedFogView) {
    // Reposition the lighting overlay sprite every frame (same drift fix as fog).
    overlaySprite.position.set(clippedFogView.left, clippedFogView.top);
    overlaySprite.scale.set(1);
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
    updateFogOverlay(renderState, view, clippedFogView, revealSources, occluders, nightAmount, {
      fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture,
      resizeOverlayCanvas, lastFogOverlaySignatureRef
    });
  } else {
    fogOverlaySprite.visible = false;
    lastFogOverlaySignatureRef.value = '';
  }
}

// ── Effects: placement preview, player target, zone draft ──────────
export function updatePlacementPreview(renderState, placementPreview, getPlacementTexture, BUILDING_TYPES) {
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

export function updatePlayerTarget(renderState, playerTargetGraphics) {
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

export function updateZoneDraft(renderState, zoneDraftGraphics) {
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

export function updateHud(renderState, {
  hudBar, fpsBadge, hudText, fpsText, drawRoundedRect
}) {
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
