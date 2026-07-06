// ── Coordinator: re-exports shared constants/helpers and delegates draw to layer modules ──
import { createDepthDrawable, sortDepthDrawables } from './shared/depth-sort.js';
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
  structureFogPoint,
  drawBar,
  drawShadow,
  drawNameTag,
  roundedRect
} from './shared/renderer-utils.js';

import {
  drawCampaignArrival,
  drawGrid,
  drawMapBase,
  drawMapFeatures,
  drawViewportBackdrop
} from './canvas2d/background-layer.js';

import {
  drawHempPlant,
  drawHole,
  drawItem,
  drawProjectile,
  drawRock,
  drawStructure,
  drawTree,
  drawZones
} from './canvas2d/world-layer.js';

import {
  drawAssistant,
  drawBot,
  drawMonster,
  drawPlayerActor,
  drawPlayerTarget,
  pushRemotePlayersToDepth
} from './canvas2d/entities-layer.js';

import {
  drawFloaters,
  drawFogOfWar,
  drawNightTint,
  drawRevealSourceGlows,
  drawStructureLightGlows
} from './canvas2d/effects-layer.js';

import {
  drawPlacement,
  drawZoneDraft
} from './canvas2d/overlay-layer.js';

import { drawHud } from './canvas2d/hud-layer.js';
import { BUILDING_TYPES } from '../data.js';

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

/**
 * Draw the full game world.
 *
 * @param {object} renderState - the render state snapshot
 * @param {CanvasRenderingContext2D} ctx - the 2D context to draw into
 * @param {object} [options]
 * @param {'canvas2d'|'skip'} [options.spriteDrawMode='canvas2d']
 *   - 'canvas2d' (default): Canvas2D draws all entity sprites via the
 *     depth-sorted pass (existing behavior).
 *   - 'skip': Canvas2D draws background + overlays only. Entity sprites are
 *     expected to be rendered by another path (e.g. WebGL2 batcher). The
 *     depth-sorted pass is skipped, but visibility arrays are still collected
 *     for overlay drawing (health bars, hover highlights, name tags).
 *     Non-sprite-cached entities (hemp plants, holes, projectiles, tree
 *     stumps) are still drawn by Canvas2D for visual parity.
 * @param {Function} [options.compositeCallback]
 *   Called as compositeCallback(ctx) after the background pass (map base,
 *   features, grid, zones) but BEFORE the entity sprite pass / overlay pass.
 *   Used by the WebGL2 renderer to composite the GL canvas between the
 *   background and the overlays. Only invoked when spriteDrawMode is 'skip'.
 *   The ctx is in the world-transformed state when called.
 */
export function drawWorld(renderState, ctx, options = {}) {
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
  const spriteDrawMode = options.spriteDrawMode === 'skip' ? 'skip' : 'canvas2d';
  const skipSprites = spriteDrawMode === 'skip';
  const compositeCallback = typeof options.compositeCallback === 'function' ? options.compositeCallback : null;
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

  // ── Composite hook: inject the WebGL2 sprite layer between background
  //    and overlays. Only fires when spriteDrawMode is 'skip'.
  if (skipSprites && compositeCallback) {
    compositeCallback(c);
  }

  // Visibility arrays — collected in both modes so overlays (health bars,
  // occlusion math) work even when sprites are drawn elsewhere.
  const visibleStructures = [];
  const visibleProjectiles = [];
  const visibleItems = [];
  const visibleMonsters = [];
  const visibleBots = [];
  const depthDrawables = [];
  const pushDepth = (kind, entity, draw, options = {}) => {
    depthDrawables.push(createDepthDrawable(kind, entity, draw, { ...options, order: depthDrawables.length }));
  };

  // Holes: always drawn (not in the sprite cache; Canvas2D draws them).
  for (const hole of game.holes || []) if (circleInView(hole.x, hole.y, 24, view) && fogStaticVisible(game, hole.x, hole.y)) drawHole(game, c, hole);

  if (!skipSprites) {
    // ── Default Canvas2D path: depth-sorted entity sprites ──
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
  } else {
    // ── Skip mode: WebGL2 handles entity sprites. Canvas2D still draws
    //    entities that are NOT in the sprite cache (hemp plants, tree
    //    stumps, projectiles) plus overlay decorations (health bars, hover
    //    highlights, name tags, bot id labels, held tools) for parity.
    drawSkipModeOverlays(game, c, view, now, {
      renderLooseGroundItems,
      renderBots,
      campaignArrivalActive,
      visibleStructures,
      visibleItems,
      visibleMonsters,
      visibleBots,
      visibleProjectiles
    });
  }

  if (game.player.target && (!view || circleInView(game.player.target.x, game.player.target.y, 64, view))) drawPlayerTarget(game, c);
  drawPlacement(game, c);
  drawZoneDraft(game, c);
  drawFloaters(game, c, view);
  if (lighting) drawRevealSourceGlows(game, c, view, revealSources);
  drawFogOfWar(game, c, view, revealSources);
  c.restore();

  drawHud(game, c);
}

/**
 * Draw entities + overlays that Canvas2D must handle when the WebGL2 batcher
 * owns the sprite pass. This covers:
 *   - Entities NOT in the sprite cache: hemp plants, tree stumps, projectiles.
 *   - Depth-sorted overlay decorations for sprite-cached entities: health
 *     bars, hover highlights, name tags, bot id labels / held tools, structure
 *     hover status labels, monster bars.
 *
 * Visibility arrays are populated so occlusion math stays consistent with the
 * WebGL2 sprite pass.
 */
function drawSkipModeOverlays(game, c, view, now, opts) {
  const { renderLooseGroundItems, renderBots, campaignArrivalActive,
    visibleStructures, visibleItems, visibleMonsters, visibleBots, visibleProjectiles } = opts;

  // Collect visibility (mirrors the WebGL2 sprite-pass iteration) so occluder
  // sets match for any later computations.
  for (const structure of game.structures || []) {
    const fogPoint = structureFogPoint(structure);
    if (!rectInView(structure.x, structure.y, structure.w || 48, structure.h || 48, view) || !fogStaticVisible(game, fogPoint.x, fogPoint.y)) continue;
    visibleStructures.push(structure);
  }
  for (const projectile of game.projectiles || []) {
    if (!circleInView(projectile.x, projectile.y, 18, view)) continue;
    if (!fogDynamicVisible(game, projectile.x, projectile.y)) continue;
    visibleProjectiles.push(projectile);
    // Projectiles are not in the sprite cache — draw via Canvas2D.
    drawProjectile(c, projectile);
  }
  if (renderLooseGroundItems) {
    for (const item of game.items || []) {
      if (!circleInView(item.x, item.y, 20, view) || !fogDynamicVisible(game, item.x, item.y)) continue;
      visibleItems.push(item);
    }
  }
  for (const monster of game.monsters || []) {
    if ((monster.hp || 0) <= 0 || !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
    if (!fogDynamicVisible(game, monster.x, monster.y)) continue;
    visibleMonsters.push(monster);
  }
  if (renderBots) {
    for (const bot of game.bots || []) {
      if (!circleInView(bot.x, bot.y, (bot.r || 11) + 18, view) || !fogDynamicVisible(game, bot.x, bot.y)) continue;
      visibleBots.push(bot);
    }
  }

  // Build a depth-sorted overlay list. Hemp, stumps, and projectiles need
  // their full draw; sprite-cached entities get overlay-only draws.
  const depthDrawables = [];
  const pushDepth = (kind, entity, draw, options = {}) => {
    depthDrawables.push(createDepthDrawable(kind, entity, draw, { ...options, order: depthDrawables.length }));
  };

  for (const structure of visibleStructures) {
    pushDepth('structure', structure, () => drawStructureOverlay(game, c, structure, now));
  }
  for (const monster of visibleMonsters) {
    pushDepth('monster', monster, () => drawMonsterOverlay(game, c, monster, now));
  }
  if (renderBots) {
    for (const bot of visibleBots) {
      pushDepth('bot', bot, () => drawBotOverlay(game, c, bot, now));
    }
  }
  if (!campaignArrivalActive && game.player) {
    if (!view || circleInView(game.player.x, game.player.y, (game.player.r || 13) + 42, view)) {
      pushDepth('player', game.player, () => drawPlayerOverlay(game, c, now));
    }
    if (game.assistant && (!view || circleInView(game.assistant.x, game.assistant.y, 42, view))) {
      pushDepth('assistant', game.assistant, () => drawAssistant(c, game.assistant.x, game.assistant.y, now, game.assistant.facingX, game.assistant.facingY));
    }
  }
  pushRemotePlayersToDepth(game, c, view, depthDrawables, now);

  // Rocks, hemp, trees: hemp and stumps are drawn fully (not cached); rocks
  // and live trees get overlay-only (health bars, hover).
  for (const rock of game.rocks || []) {
    if (!circleInView(rock.x, rock.y, (rock.radius || 18) + 16, view) || !fogStaticVisible(game, rock.x, rock.y)) continue;
    pushDepth('rock', rock, () => drawRockOverlay(game, c, rock));
  }
  for (const hemp of game.hempPlants || []) {
    if (!circleInView(hemp.x, hemp.y, (hemp.radius || 14) + 18, view) || !fogStaticVisible(game, hemp.x, hemp.y)) continue;
    pushDepth('hemp', hemp, () => drawHempPlant(game, c, hemp, now));
  }
  for (const tree of game.trees || []) {
    if (!circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view) || !fogStaticVisible(game, tree.x, tree.y)) continue;
    if (tree.stump) {
      pushDepth('tree', tree, () => drawTree(game, c, tree, now, 1));
    } else {
      pushDepth('tree', tree, () => drawTreeOverlay(game, c, tree, now));
    }
  }

  for (const drawable of sortDepthDrawables(depthDrawables)) drawable.draw();
}

// ── Skip-mode overlay draws (sprite body is rendered by WebGL2; these
//    functions only draw decorations: health bars, hover highlights, labels,
//    held tools, etc.) ──────────────────────────────────────────────────

function drawStructureOverlay(game, c, s, now) {
  const hover = game.mouse.hoverStructure === s;
  if (s.rangedAttack && hover) {
    c.save();
    c.strokeStyle = 'rgba(211,169,95,.32)';
    c.lineWidth = 2;
    c.setLineDash([8, 9]);
    c.beginPath(); c.arc(s.x, s.y, s.rangedAttack.range || 260, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  // Hover status label and bars (matches drawStructure hover path).
  if (hover) {
    c.save();
    c.font = '700 12px system-ui';
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(3, 6, 5, .72)';
    c.fillStyle = '#f5faf6';
    c.strokeText(s.name, s.x, s.y + 5);
    c.fillText(s.name, s.x, s.y + 5);
    c.font = '11px system-ui';
    c.fillStyle = '#ffe3a7';
    const line = structureStatusLine(s);
    c.strokeText(line, s.x, s.y + 22);
    c.fillText(line, s.x, s.y + 22);
    if (s.type === 'throne') drawBar(c, s.x - 42, s.y + s.h / 2 + 8, 84, 7, Math.max(0, s.hp || 0) / Math.max(1, s.maxHp || 120), s.ownerId === 'p1' ? '#80a9c9' : '#c86b5f');
    if (s.processing) drawBar(c, s.x - 28, s.y + s.h / 2 + 8, 56, 6, 1 - Math.max(0, s.processing.remaining || 0) / Math.max(0.1, s.processing.total || 1), '#d3a95f');
    c.restore();
  }
}

function structureStatusLine(s) {
  return s.type === 'throne'
    ? `${s.ownerLabel || 'player'} · ${Math.max(0, Math.ceil(s.hp ?? 0))}/${s.maxHp || 120} HP`
    : ['item_palette', 'power_station', 'robotics_parts_bin'].includes(s.type)
      ? `${s.storageType || 'empty'} ${s.stored || 0}/${s.capacity || 0}`
    : ['camper_van', 'hammock_camp', 'ultrabook_desk', 'solar_array', 'portable_3d_printer', 'assembler'].includes(s.type)
      ? (s.label || 'story object')
    : s.type === 'workbench'
      ? `S${s.sticks || 0} R${s.stones || 0} ${(s.workbenchRecipe || 'crude_axe').replace('crude_', '')}`
      : s.type === 'factory'
        ? `L${s.logs || 0} P${s.planks || 0} Po${s.poles || 0} Se${s.tree_seeds || 0}`
        : s.type === 'smithery'
          ? `S${s.sticks || 0} P${s.planks || 0} ${(s.smitheryRecipe || 'wooden_sword').replace('wooden_', '')}`
          : s.type === 'bowmaker'
            ? `S${s.sticks || 0}/2 H${s.hemps || 0}/3 B${s.bows || 0}`
            : s.type === 'defensetower'
              ? `R${s.rangedAttack?.range || 260} · ${s.rangedAttack?.damage || 1}/s`
              : `L${s.logs || 0} P${s.planks || 0} Po${s.poles || 0}`;
}

function drawMonsterOverlay(game, c, m, now) {
  const r = m.radius || 18;
  // Health bar (above the WebGL2 sprite)
  if ((m.hp || 0) < (m.maxHp || 10)) {
    drawBar(c, m.x - 20, m.y - r - 16, 40, 5, (m.hp || 0) / Math.max(1, m.maxHp || 10), '#8fb9b5');
  }
  if (game.mouse.hoverMonster === m) {
    drawNameTag(c, `${m.name || 'passive monster'} · ${m.hp || 0}/${m.maxHp || 10} hp`, m.x, m.y - r - 28);
  }
}

function drawRockOverlay(game, c, r) {
  if (!r.depleted && r.hp < r.maxHp) {
    drawBar(c, r.x - 18, r.y - r.radius - 13, 36, 5, r.hp / r.maxHp, '#d0bf86');
  }
  if (game.mouse.hoverRock === r) {
    drawNameTag(c, r.depleted ? 'depleted stone deposit' : 'stone deposit', r.x, r.y - r.radius - 24);
  }
}

function drawTreeOverlay(game, c, t, now) {
  // Health bar for damaged trees
  if (t.hp < t.maxHp) {
    drawBar(c, t.x - 18, t.y - (t.radius || 22) - 16, 36, 5, t.hp / t.maxHp, '#9abf8f');
  }
  if (game.mouse.hoverTree === t) {
    const stage = t.growthStage || 'grown_tree';
    drawNameTag(c, stage === 'small_tree' ? 'small tree' : 'grown tree', t.x, t.y - (t.radius || 22) - 28);
  }
}

// Inline mini-item + held-tool overlays for bots/player (mirrors the overlay
// pass in entities-layer.js drawBot/drawPlayerActor, minus the sprite body
// which the WebGL2 batcher renders).
import { drawHeldToolAsset, drawMiniItemAsset } from '../visual-assets.js';
import { isBotHandTool } from './shared/renderer-utils.js';
import { SPRITE_SIZE as _SPRITE_SIZE, BOT_COLORS as _BOT_COLORS, getSpriteCache as _getSpriteCache } from './shared/sprite-cache.js';

function _drawMiniItem(c, x, y, type) {
  c.save();
  c.translate(x, y);
  drawMiniItemAsset(c, type);
  c.restore();
}

function _drawAmmoBadge(c, actor, x, y) {
  if (!actor?.equipment?.weapon || actor.equipment.weapon !== 'bow') return;
  const ammo = Number(actor.ammunition || 0);
  c.save();
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillStyle = ammo > 0 ? '#d3a95f' : '#c86b5f';
  c.strokeStyle = 'rgba(6,10,8,.85)';
  c.lineWidth = 3;
  const text = `AR ${ammo}`;
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
  c.restore();
}

function drawBotOverlay(game, c, b, now) {
  const hover = game.mouse.hoverBot === b;
  const inventoryIsHandTool = isBotHandTool(b.inventory?.type);
  const facingRight = (b.facingX ?? 1) >= 0;
  const handToolTypes = inventoryIsHandTool ? [b.inventory.type] : [];
  const zoom = game.camera?.zoom || 1;

  // Hover highlight glow behind/around the sprite
  if (hover) {
    c.save();
    c.fillStyle = 'rgba(255,244,208,.18)';
    c.beginPath();
    c.arc(b.x, b.y, _SPRITE_SIZE / 2 + 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff4d0';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(b.x, b.y, _SPRITE_SIZE / 2 + 2, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Overlay decorations (only when zoomed in enough to see them)
  if (zoom >= 0.5) {
    c.save();
    c.fillStyle = '#06100d';
    c.font = '800 10px system-ui';
    c.textAlign = 'center';
    c.fillText(b.id, b.x, b.y + 3);
    if (b.inventory && !inventoryIsHandTool) _drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
    handToolTypes.slice(0, 2).forEach((type, index) => {
      const side = (index === 0 ? 1 : -1) * (facingRight ? 1 : -1);
      drawHeldToolAsset(c, b.x + side * (b.r + 8), b.y + 5 + index * 2, type);
    });
    if (b.equipment?.weapon) drawHeldToolAsset(c, b.x + 17, b.y - 5, b.equipment.weapon);
    if (b.equipment?.shield) drawHeldToolAsset(c, b.x - 17, b.y - 7, b.equipment.shield);
    _drawAmmoBadge(c, b, b.x, b.y + b.r + 16);
    c.restore();
  }
  if (hover) drawNameTag(c, b.name || `Bot ${b.id}`, b.x, b.y - _SPRITE_SIZE / 2 - 12);
}

function drawPlayerOverlay(game, c, now) {
  const breathe = Math.sin(now / 520) * .8;
  const playerDrawSize = _SPRITE_SIZE;
  // Carried item above head
  if (game.player.inventory) {
    const itemY = game.player.y - playerDrawSize / 2 - 12;
    _drawMiniItem(c, game.player.x, itemY, game.player.inventory.type);
    drawNameTag(c, game.player.inventory.type, game.player.x, itemY - 9);
  }
  if (game.player.equipment?.weapon) drawHeldToolAsset(c, game.player.x + 19, game.player.y - 5, game.player.equipment.weapon);
  if (game.player.equipment?.shield) drawHeldToolAsset(c, game.player.x - 18, game.player.y - 5, game.player.equipment.shield);
  _drawAmmoBadge(c, game.player, game.player.x, game.player.y + 28);
  // Health bar
  const hpRatio = Math.max(0, Math.min(1, (game.player.hp ?? 0) / Math.max(1, game.player.maxHp || 10)));
  const barColor = hpRatio > 0.6 ? '#5ecf6e' : hpRatio > 0.3 ? '#d3a95f' : '#c86b5f';
  drawBar(c, game.player.x - 22, game.player.y - game.player.r - 18, 44, 5, hpRatio, barColor);
}
