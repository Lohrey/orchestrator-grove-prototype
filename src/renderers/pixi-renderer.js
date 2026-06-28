import { BUILDING_TYPES } from '../data.js?v=t_building_kits_0618';
import { getCampaignArrivalScene } from '../campaign-scenes.js?v=t_campaign_scenes_0623';
import { getDepthAnchorY } from '../depth-sort.js?v=t_da28d8dd';
import { clamp } from '../utils.js?v=20260613-player-tools';
import {
  drawBuildingAsset,
  drawBuildingPreviewAsset,
  drawHeldToolAsset,
  drawItemAsset,
  itemLabel
} from '../visual-assets.js?v=t_building_kits_0618';
import {
  LOOSE_ITEM_RENDER_MIN_ZOOM,
  DECORATIVE_DETAIL_RENDER_MIN_ZOOM,
  BOT_RENDER_MIN_ZOOM,
  normalizeRendererSettings,
  getRendererResolution,
  fillPath,
  strokePath,
  fillAndStrokePath,
  drawRoundedRect,
  createText,
  makeCanvas,
  isCampaignArrivalActive
} from './pixi/pixi-layers.js?v=t_renderer_split_0627';
import {
  loadCharacterAssets,
  inferPlayerAction
} from './pixi/pixi-character-assets.js?v=t_renderer_split_0627';
import { loadDogSpriteSheet } from './pixi/pixi-dog-spritesheet.js?v=t_dog_spritesheet_0627';
import {
  buildTerrainBaseTexture,
  buildTerrainDetailTexture,
  buildTerrainFeatureTexture,
  updateCampaignArrival,
  getBackdropTexture,
  renderMapFeature
} from './pixi/pixi-terrain.js?v=t_renderer_split_0627';
import {
  createTreeView,
  updateTreeView,
  createHempView,
  updateHempView,
  createRockView,
  updateRockView,
  createStructureView,
  updateStructureView,
  createItemView,
  updateItemView,
  createMonsterView,
  updateMonsterView,
  createBotView,
  updateBotView,
  createActorView,
  updateActorView,
  createAssistantView,
  updateAssistantView,
  createRemotePlayerView,
  updateRemotePlayerView,
  createFloaterView,
  updateFloaterView,
  drawProjectile
} from './pixi/pixi-entities.js?v=stone_deposit_interact_0628';
import {
  updateOverlay,
  updatePlacementPreview,
  updatePlayerTarget,
  updateZoneDraft,
  updateHud
} from './pixi/pixi-effects.js?v=stone_deposit_interact_0628';

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

  // Load golden retriever spritesheet for dog entities (non-blocking, vector fallback used on failure)
  loadDogSpriteSheet(PIXI).catch(error => {
    console.warn('Dog spritesheet failed to load; using vector fallback for dogs.', error);
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
  const playerTargetLabel = createText(PIXI, '', { fontSize: 11, fontWeight: '700' });
  playerTargetLabel.anchor.set(0.5, 1);
  playerTargetLabel.visible = false;
  const zoneDraftGraphics = new PIXI.Graphics();
  effectsLayer.addChild(placementPreview, playerTargetGraphics, playerTargetLabel, zoneDraftGraphics);
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
  const lastFogOverlaySignatureRef = { value: '' };
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

  function updateBackdrop(width, height) {
    if (width === lastViewportWidth && height === lastViewportHeight) return;
    lastViewportWidth = width;
    lastViewportHeight = height;
    backdrop.texture = getBackdropTexture(width, height, { buildTexture });
    backdrop.width = width;
    backdrop.height = height;
    lastFogOverlaySignatureRef.value = '';
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
    terrainTextures.base = buildTerrainBaseTexture(PIXI, renderState, { buildStaticTexture, createGraphicsLayer });
    terrainTextures.details = buildTerrainDetailTexture(PIXI, renderState, { buildStaticTexture, createGraphicsLayer });
    terrainTextures.features = buildTerrainFeatureTexture(PIXI, renderState, { buildStaticTexture, createGraphicsLayer });
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
      rock => ({ container: createRockView(PIXI, rock, getNameTagTexture) }),
      (view, rock) => updateRockView(view.container, rock, renderState.mouse.hoverRock === rock, getNameTagTexture),
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
        drawProjectile(view.container, projectile);
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
    updatePlacementPreview(renderState, placementPreview, getPlacementTexture, BUILDING_TYPES);
    updatePlayerTarget(renderState, playerTargetGraphics, playerTargetLabel);
    updateZoneDraft(renderState, zoneDraftGraphics);
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

      updateCampaignArrival(PIXI, renderState, campaignArrivalGraphics, { getCampaignArrivalScene });
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
      updateOverlay(renderState, {
        overlayCanvas, overlayContext, overlaySprite, overlayTexture,
        fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture,
        resizeOverlayCanvas, lastFogOverlaySignatureRef
      });
      updateHud(renderState, {
        hudBar, fpsBadge, hudText, fpsText, drawRoundedRect
      });
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
