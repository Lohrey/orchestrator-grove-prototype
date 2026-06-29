// ── Coordinator: re-exports shared constants/helpers and delegates draw to layer modules ──
import { createDepthDrawable, sortDepthDrawables } from './depth-sort.js?v=t_da28d8dd';
import {
  BOT_RENDER_MIN_ZOOM,
  DECORATIVE_DETAIL_RENDER_MIN_ZOOM,
  LOOSE_ITEM_RENDER_MIN_ZOOM,
  circleInView,
  fogDynamicVisible,
  fogEnabled,
  fogRevealSources,
  fogStaticVisible,
  getNightAmount,
  getRockOpacity,
  getTreeDrawRadius,
  getTreeOpacity,
  getWorldViewBounds,
  isCampaignArrivalActive,
  lightingEnabled,
  rectInView,
  shouldRenderBots,
  shouldRenderDecorativeDetails,
  shouldRenderLooseGroundItems,
  structureFogPoint
} from './renderers/shared/renderer-utils.js?v=grove_stone_transparency_0628';

import {
  drawCampaignArrival,
  drawGrid,
  drawMapBase,
  drawMapFeatures,
  drawViewportBackdrop
} from './renderers/canvas2d/background-layer.js?v=t_renderer_split_0627';

import {
  drawHempPlant,
  drawHole,
  drawItem,
  drawProjectile,
  drawRock,
  drawStructure,
  drawTree,
  drawZones
} from './renderers/canvas2d/world-layer.js?v=grove_sprite_fix_0629';

import {
  drawAssistant,
  drawBot,
  drawMonster,
  drawPlayerActor,
  drawPlayerTarget,
  pushRemotePlayersToDepth
} from './renderers/canvas2d/entities-layer.js?v=grove_sprite_fix_0629';

import {
  drawFloaters,
  drawFogOfWar,
  drawNightTint,
  drawRevealSourceGlows,
  drawStructureLightGlows
} from './renderers/canvas2d/effects-layer.js?v=t_renderer_split_0627';

import {
  drawPlacement,
  drawZoneDraft
} from './renderers/canvas2d/overlay-layer.js?v=t_renderer_split_0627';

import { drawHud } from './renderers/canvas2d/hud-layer.js?v=t_health_system_0628';

// Re-export public API surface that tests and consumers rely on
export {
  BOT_RENDER_MIN_ZOOM,
  DECORATIVE_DETAIL_RENDER_MIN_ZOOM,
  LOOSE_ITEM_RENDER_MIN_ZOOM,
  shouldRenderBots,
  shouldRenderDecorativeDetails,
  shouldRenderLooseGroundItems
};

function prepareAnimationState(game, now, view, { renderLooseGroundItems = true } = {}) {
  if (renderLooseGroundItems) {
    for (const item of game.items || []) {
      if (view && !circleInView(item.x, item.y, 20, view)) continue;
      item._bob = Math.sin(now / 400 + item.bob) * 2;
    }
  }
  for (const hemp of game.hempPlants || []) {
    if (view && !circleInView(hemp.x, hemp.y, (hemp.radius || 14) + 18, view)) continue;
    hemp._sway = Math.sin(now / 550 + hemp.x * .05) * 2;
  }
  for (const monster of game.monsters || []) {
    if (view && !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
    monster._wobble = Math.sin(now / 520 + (monster.phase || 0)) * 2;
  }
  for (const tree of game.trees || []) {
    if (view && !circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view)) continue;
    const stage = tree.growthStage || 'grown_tree';
    tree._sway = Math.sin(now / 1100 + tree.x * .017) * (stage === 'sapling' ? 1.5 : 2.5);
  }
}

export function drawWorld(renderState, ctx) {
  const game = renderState;
  const c = ctx;
  const now = performance.now();
  const view = getWorldViewBounds(game);
  const lighting = lightingEnabled(game);
  const revealSources = fogEnabled(game) || lighting ? fogRevealSources(game) : [];
  const campaignArrivalActive = isCampaignArrivalActive(game);
  const renderLooseGroundItems = shouldRenderLooseGroundItems(game.camera?.zoom);
  const renderDecorativeDetails = shouldRenderDecorativeDetails(game.camera?.zoom);
  const renderBots = shouldRenderBots(game.camera?.zoom);
  prepareAnimationState(game, now, view, { renderLooseGroundItems });
  c.clearRect(0, 0, game.W, game.H);
  drawViewportBackdrop(game, c, { lightingEnabled, getNightAmount });

  c.save();
  c.scale(game.camera.zoom || 1, game.camera.zoom || 1);
  c.translate(-game.camera.x, -game.camera.y);
  drawMapBase(game, c, view, { renderDecorativeDetails });
  drawMapFeatures(game, c, view);
  if (campaignArrivalActive) drawCampaignArrival(game, c, view, now);
  drawGrid(game, c, view);
  drawZones(game, c, view);
  if (lighting) drawNightTint(game, c, view);
  if (lighting) drawStructureLightGlows(game, c, view);
  const visibleStructures = [];
  const visibleProjectiles = [];
  const visibleItems = [];
  const visibleMonsters = [];
  const visibleBots = [];
  const depthDrawables = [];
  const pushDepth = (kind, entity, draw, options = {}) => {
    depthDrawables.push(createDepthDrawable(kind, entity, draw, { ...options, order: depthDrawables.length }));
  };

  // Pre-pass: collect all visible occludable entities (items, bots, monsters,
  // structures, projectiles) so we can compute transparency for trees and rocks.
  for (const hole of game.holes || []) if (circleInView(hole.x, hole.y, 24, view) && fogStaticVisible(game, hole.x, hole.y)) drawHole(game, c, hole);

  // First pass: collect structures, projectiles, items, monsters, bots into
  // visibility arrays and push them to depth sort.
  for (const structure of game.structures || []) {
    const fogPoint = structureFogPoint(structure);
    if (!rectInView(structure.x, structure.y, structure.w || 48, structure.h || 48, view) || !fogStaticVisible(game, fogPoint.x, fogPoint.y)) continue;
    visibleStructures.push(structure);
    pushDepth('structure', structure, () => drawStructure(game, c, structure, now));
  }
  for (const projectile of game.projectiles || []) {
    if (!circleInView(projectile.x, projectile.y, 18, view)) continue;
    if (!fogDynamicVisible(game, projectile.x, projectile.y)) continue;
    visibleProjectiles.push(projectile);
    pushDepth('projectile', projectile, () => drawProjectile(c, projectile));
  }
  if (renderLooseGroundItems) {
    for (const item of game.items || []) {
      if (!circleInView(item.x, item.y, 20, view) || !fogDynamicVisible(game, item.x, item.y)) continue;
      visibleItems.push(item);
      const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
      pushDepth('item', item, () => drawItem(game, c, item, now), { bob });
    }
  }
  for (const monster of game.monsters || []) {
    if ((monster.hp || 0) <= 0 || !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
    if (!fogDynamicVisible(game, monster.x, monster.y)) continue;
    visibleMonsters.push(monster);
    pushDepth('monster', monster, () => drawMonster(game, c, monster, now));
  }
  if (renderBots) {
    for (const bot of game.bots || []) {
      if (!circleInView(bot.x, bot.y, (bot.r || 11) + 18, view) || !fogDynamicVisible(game, bot.x, bot.y)) continue;
      visibleBots.push(bot);
      pushDepth('bot', bot, () => drawBot(game, c, bot, now));
    }
  }
  if (!campaignArrivalActive) {
    if (!view || circleInView(game.player.x, game.player.y, (game.player.r || 13) + 42, view)) {
      pushDepth('player', game.player, () => drawPlayerActor(game, c, now));
    }
    if (!view || circleInView(game.assistant.x, game.assistant.y, 42, view)) {
      pushDepth('assistant', game.assistant, () => drawAssistant(c, game.assistant.x, game.assistant.y, now, game.assistant.facingX, game.assistant.facingY));
    }
  }
  pushRemotePlayersToDepth(game, c, view, depthDrawables, now);

  // Shared occluder set for transparency on trees and rocks (stone deposits).
  const occluders = { items: visibleItems, bots: visibleBots, monsters: visibleMonsters, structures: visibleStructures, projectiles: visibleProjectiles };

  for (const rock of game.rocks || []) {
    if (!circleInView(rock.x, rock.y, (rock.radius || 18) + 16, view) || !fogStaticVisible(game, rock.x, rock.y)) continue;
    pushDepth('rock', rock, () => drawRock(game, c, rock, getRockOpacity(game, rock, now, occluders)));
  }
  for (const hemp of game.hempPlants || []) {
    if (!circleInView(hemp.x, hemp.y, (hemp.radius || 14) + 18, view) || !fogStaticVisible(game, hemp.x, hemp.y)) continue;
    pushDepth('hemp', hemp, () => drawHempPlant(game, c, hemp, now));
  }
  for (const tree of game.trees || []) {
    if (!circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view) || !fogStaticVisible(game, tree.x, tree.y)) continue;
    pushDepth('tree', tree, () => drawTree(game, c, tree, now, getTreeOpacity(game, tree, now, occluders)));
  }
  for (const drawable of sortDepthDrawables(depthDrawables)) drawable.draw();
  if (game.player.target && (!view || circleInView(game.player.target.x, game.player.target.y, 64, view))) drawPlayerTarget(game, c);
  drawPlacement(game, c);
  drawZoneDraft(game, c);
  drawFloaters(game, c, view);
  if (lighting) drawRevealSourceGlows(game, c, view, revealSources);
  drawFogOfWar(game, c, view, revealSources);
  c.restore();

  drawHud(game, c);
}
