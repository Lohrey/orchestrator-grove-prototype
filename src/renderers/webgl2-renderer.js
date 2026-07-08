// ── WebGL2 renderer: uses instanced sprite batcher for world rendering ──
// Falls back to Canvas 2D / OffscreenCanvas / main-thread paths when unavailable.
//
// Architecture:
// 1. WebGL2 batcher renders ALL world sprites (items, trees, rocks, monsters,
//    structures, bots, player, dog, projectiles) to a hidden WebGL canvas.
// 2. Canvas 2D (main or worker) renders background (map, grid, zones), then
//    composites the WebGL canvas on top, then draws overlays (fog, lighting,
//    text, name tags, UI) on top of the composited result.
// 3. The integration happens via drawWorld({ spriteDrawMode: 'skip' }) so the
//    Canvas2D path skips entity sprite drawing but still runs background and
//    overlay passes for parity.

import { createWebGL2Batcher, isWebGL2Supported, MAX_BATCH } from './webgl2/batcher.js';
import { createCanvas2dRenderer } from './canvas2d-renderer.js';
import {
  getSpriteCache,
  initSpriteCache,
  botSpriteKey,
  playerSpriteKey,
  treeSpriteKey,
  rockSpriteKey,
  monsterSpriteKey,
  structureSpriteKey,
  getCharacterWalkFrame,
  isCharacterSpriteReady,
  BOT_COLORS,
  SPRITE_SIZE
} from './shared/sprite-cache.js';
import {
  getWorldViewBounds,
  circleInView,
  rectInView,
  fogStaticVisible,
  fogDynamicVisible,
  shouldRenderBots,
  shouldRenderLooseGroundItems,
  getTreeDrawRadius,
  getTreeOpacity,
  getRockOpacity,
  structureFogPoint,
  isCampaignArrivalActive
} from './shared/renderer-utils.js';
import { drawWorld } from './canvas-renderer.js';
import { createDepthDrawable, sortDepthDrawables } from './shared/depth-sort.js';

// ── Atlas builder ──────────────────────────────────────────────────────
// Packs mixed-size sprites (32/64/256) into a single power-of-2 texture
// atlas using a row-based shelf-pack algorithm. Array entries (tree sway,
// monster wobble, bot walk) get one UV entry per frame, keyed as
// `<baseKey>_<frameIndex>`.

const ATLAS_PADDING = 2; // 2px gutter between sprites to avoid UV bleed

/**
 * Collect every drawable sprite from the cache into a flat list of
 * { key, frameIndex, image, w, h } entries. Skips `_meta` keys and
 * frames that are not blittable (null/undefined).
 */
function collectSpriteEntries(spriteCache) {
  const entries = [];
  for (const key of Object.keys(spriteCache)) {
    if (key.endsWith('_meta')) continue;
    const value = spriteCache[key];
    const meta = spriteCache[key + '_meta'];
    if (!meta || typeof meta !== 'object') continue;
    const w = meta.w || SPRITE_SIZE;
    const h = meta.h || SPRITE_SIZE;
    const cx = meta.cx ?? w / 2;
    const cy = meta.cy ?? h / 2;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const img = value[i];
        if (img) entries.push({ key, frameIndex: i, image: img, w, h, cx, cy });
      }
    } else if (value) {
      entries.push({ key, frameIndex: -1, image: value, w, h, cx, cy });
    }
  }
  return entries;
}

/**
 * Sort entries by height descending so the shelf-packer places the tallest
 * (structures, 256) first and shorter sprites (items, 32) fill the rows
 * underneath, minimizing wasted vertical space.
 */
function sortByHeightDesc(entries) {
  return entries.slice().sort((a, b) => {
    if (b.h !== a.h) return b.h - a.h;
    return b.w - a.w;
  });
}

/**
 * Choose the smallest power-of-2 atlas dimension that fits all sprites.
 * Returns { w, h }. Caps at 4096×4096 per WebGL MAX_TEXTURE_SIZE.
 */
function chooseAtlasSize(entries) {
  // Estimate total area + a packing-efficiency fudge factor (1.4×).
  let totalArea = 0;
  let maxW = 0;
  for (const e of entries) {
    totalArea += (e.w + ATLAS_PADDING) * (e.h + ATLAS_PADDING);
    if (e.w > maxW) maxW = e.w;
  }
  const minSide = Math.max(maxW, Math.ceil(Math.sqrt(totalArea * 1.4)));
  // Round up to the nearest power of 2, capped at 4096.
  let side = 64;
  while (side < minSide && side < 4096) side *= 2;
  if (side > 4096) side = 4096;
  return { w: side, h: side };
}

/**
 * Shelf-pack: place sprites left-to-right on the current row; when the row
 * is full, wrap to a new row whose height equals the tallest sprite on it.
 * Returns a list of placements { entry, px, py }.
 *
 * If placements don't fit in the chosen atlas size, the caller must bump
 * the atlas size and retry.
 */
function shelfPack(entries, atlasW, atlasH) {
  const placements = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const entry of entries) {
    const w = entry.w + ATLAS_PADDING;
    const h = entry.h + ATLAS_PADDING;
    if (x + w > atlasW) {
      // wrap to next row
      y += rowH;
      x = 0;
      rowH = 0;
    }
    if (y + h > atlasH) {
      return null; // doesn't fit — caller bumps atlas size
    }
    placements.push({ entry, px: x, py: y });
    x += w;
    if (h > rowH) rowH = h;
  }
  return placements;
}

/**
 * Build a texture atlas from the sprite cache.
 * Packs all sprites (mixed sizes: items=32, bots/trees/rocks/monsters/player=64,
 * structures=256) into a single atlas canvas. Array entries get one UV per
 * frame keyed as `<baseKey>_<frameIndex>`.
 *
 * Returns { canvas, uvMap, atlasW, atlasH } or null if the cache is empty.
 *
 * Exported as a pure function so unit tests can mock the sprite cache without
 * a DOM environment.
 */
export function buildAtlas(spriteCache) {
  if (!spriteCache) return null;
  const entries = sortByHeightDesc(collectSpriteEntries(spriteCache));
  if (entries.length === 0) return null;

  // Try increasing power-of-2 sizes until everything fits (cap 4096).
  let size = chooseAtlasSize(entries);
  let placements = null;
  let tries = 0;
  while (!placements && size.w <= 4096 && tries < 6) {
    placements = shelfPack(entries, size.w, size.h);
    if (!placements) {
      size = { w: size.w * 2, h: size.h * 2 };
    }
    tries++;
  }
  if (!placements) return null;

  // Create atlas on a canvas
  const atlasW = size.w;
  const atlasH = size.h;
  const atlasCanvas = (typeof document !== 'undefined'
    ? document.createElement('canvas')
    : new OffscreenCanvas(atlasW, atlasH));
  atlasCanvas.width = atlasW;
  atlasCanvas.height = atlasH;
  const actx = atlasCanvas.getContext('2d');
  actx.clearRect(0, 0, atlasW, atlasH);

  // Blit each sprite into place and record UV coordinates.
  const uvMap = {};
  for (const { entry, px, py } of placements) {
    const img = entry.image;
    // Blit any drawImage-able source (ImageBitmap, HTMLCanvasElement,
    // OffscreenCanvas). Guard with try/catch so unblittable stubs (e.g. in
    // Node unit tests) don't abort the atlas build — UV correctness is
    // verifiable even when pixels aren't copied.
    if (img) {
      try {
        actx.drawImage(img, px, py, entry.w, entry.h);
      } catch {
        /* skip unblittable entries (test stubs, broken bitmaps) */
      }
    }

    // UVs: keep Canvas2D orientation (v0=top, v1=bottom).
    const u0 = px / atlasW;
    const v0 = py / atlasH;
    const u1 = (px + entry.w) / atlasW;
    const v1 = (py + entry.h) / atlasH;

    // Center offsets (cx, cy) from the meta — the shader places the sprite's
    // top-left at (x, y), so the render loop must pass (entityX - cx, entityY - cy)
    // to center the sprite on the entity position (matching Canvas2D's
    // drawImage(sprite, x - cx, y - cy) convention).
    const { cx, cy } = entry;

    if (entry.frameIndex >= 0) {
      uvMap[`${entry.key}_${entry.frameIndex}`] = { u0, v0, u1, v1, w: entry.w, h: entry.h, cx, cy };
    } else {
      uvMap[entry.key] = { u0, v0, u1, v1, w: entry.w, h: entry.h, cx, cy };
    }
  }

  return { canvas: atlasCanvas, uvMap, atlasW, atlasH };
}

/**
 * Create a WebGL2-based renderer.
 * Returns the renderer object, or null if WebGL2 is unsupported.
 *
 * @param {{ canvas: HTMLCanvasElement }} opts
 * @returns {Promise<object|null>}
 */
export async function createWebGL2Renderer({ canvas }) {
  if (!isWebGL2Supported()) return null;

  // Separate off-DOM canvas for WebGL rendering. The main canvas keeps its
  // 2D context for background + overlays; the GL canvas is composited in
  // via drawImage and must never be inserted into the page or it will leak
  // a duplicate sprite pass outside the main game viewport.
  const glCanvas = document.createElement('canvas');
  glCanvas.width = canvas.width;
  glCanvas.height = canvas.height;

  const batcher = createWebGL2Batcher(glCanvas);
  if (!batcher) {
    console.warn('[webgl2-renderer] Batcher creation failed');
    return null;
  }

  // Init sprite cache and build atlas
  await initSpriteCache();
  const spriteCache = getSpriteCache();
  const atlas = buildAtlas(spriteCache);

  if (atlas) {
    batcher.setAtlas(atlas.canvas);
  }

  const ctx2d = canvas.getContext('2d', { alpha: false });

  // ── UV lookup helper ─────────────────────────────────────────────────
  // Returns the UV rect for a sprite key + optional frame index.
  // Multi-frame keys are stored as `<baseKey>_<frameIndex>`; single-frame
  // keys are stored as `<baseKey>`.
  function getSpriteUV(key, frameIndex = -1) {
    if (!atlas || !atlas.uvMap) return null;
    if (frameIndex >= 0) {
      const keyed = atlas.uvMap[`${key}_${frameIndex}`];
      if (keyed) return keyed;
      // Fall back to base key (single-frame)
      return atlas.uvMap[key] || null;
    }
    return atlas.uvMap[key] || null;
  }

  // ── Per-sprite draw helper ───────────────────────────────────────────
  // Centers the sprite at (x, y) using its meta w/h as world-space size.
  // The shader places the sprite's top-left at the given position, so we
  // subtract cx/cy to center it on the entity (matching Canvas2D's
  // drawImage(sprite, x - cx, y - cy) convention).
  function drawWorldSprite(x, y, key, frameIndex, opacity = 1, additive) {
    const uv = getSpriteUV(key, frameIndex);
    if (!uv) return false;
    batcher.drawSprite(
      x - (uv.cx ?? uv.w / 2), y - (uv.cy ?? uv.h / 2),
      uv.w, uv.h,
      0, // rotation
      uv.u0, uv.v0, uv.u1, uv.v1,
      [1, 1, 1, opacity],
      additive || [0, 0, 0, 0]
    );
    return true;
  }

  // ── Full scene sprite pass via the batcher ───────────────────────────
  // Mirrors the Canvas2D drawWorld entity iteration: structures, trees,
  // rocks, hemp, holes, items, monsters, bots, player, projectiles.
  // Culling + zoom gates + fog checks match the Canvas2D path.
  function drawSprites(renderState) {
    const game = renderState;
    const now = performance.now();
    const zoom = game.camera?.zoom || 1;
    const view = getWorldViewBounds(game);
    const renderLooseGroundItems = shouldRenderLooseGroundItems(zoom);
    const renderBots = shouldRenderBots(zoom);
    const campaignArrivalActive = isCampaignArrivalActive(game);

    // ── Pre-pass: collect visibility arrays for occlusion math ────────
    const visibleItems = [];
    const visibleBots = [];
    const visibleMonsters = [];
    const visibleStructures = [];
    const visibleProjectiles = [];
    if (renderLooseGroundItems) {
      for (const item of game.items || []) {
        if (!circleInView(item.x, item.y, 20, view) || !fogDynamicVisible(game, item.x, item.y)) continue;
        visibleItems.push(item);
      }
    }
    if (renderBots) {
      for (const bot of game.bots || []) {
        if (!circleInView(bot.x, bot.y, (bot.r || 11) + 18, view) || !fogDynamicVisible(game, bot.x, bot.y)) continue;
        visibleBots.push(bot);
      }
    }
    for (const monster of game.monsters || []) {
      if ((monster.hp || 0) <= 0 || !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
      if (!fogDynamicVisible(game, monster.x, monster.y)) continue;
      visibleMonsters.push(monster);
    }
    for (const structure of game.structures || []) {
      const fogPoint = structureFogPoint(structure);
      if (!rectInView(structure.x, structure.y, structure.w || 48, structure.h || 48, view)) continue;
      if (!fogStaticVisible(game, fogPoint.x, fogPoint.y)) continue;
      visibleStructures.push(structure);
    }
    for (const projectile of game.projectiles || []) {
      if (!circleInView(projectile.x, projectile.y, 18, view)) continue;
      if (!fogDynamicVisible(game, projectile.x, projectile.y)) continue;
      visibleProjectiles.push(projectile);
    }

    const occluders = {
      items: visibleItems,
      bots: visibleBots,
      monsters: visibleMonsters,
      structures: visibleStructures,
      projectiles: visibleProjectiles
    };

    // ── Render order ───────────────────────────────────────────────────
    // All sprite-cached entities are collected into depth drawables and
    // Y-sorted by foot position (using depth-sort.js for parity with the
    // Canvas2D path). This ensures entities lower on screen (higher foot Y)
    // are drawn after (in front of) entities higher on screen, preventing
    // transparent-rectangle overdraw when sprites overlap.
    //
    // Trees and rocks get a small layer bias so they sort behind actors at
    // the same foot Y (matching the KIND_LAYER_BIAS in depth-sort.js).
    const depthDrawables = [];
    const pushDepth = (kind, entity, draw, options = {}) => {
      depthDrawables.push(createDepthDrawable(kind, entity, draw, { ...options, order: depthDrawables.length }));
    };

    // 1) Structures
    for (const structure of visibleStructures) {
      pushDepth('structure', structure, () => {
        drawWorldSprite(structure.x, structure.y, structureSpriteKey(structure), -1, 1);
      });
    }

    // 2) Trees (with sway frame selection + occlusion opacity)
    for (const tree of game.trees || []) {
      if (tree.stump) continue; // stumps render via Canvas2D overlay fallback
      if (!circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view)) continue;
      if (!fogStaticVisible(game, tree.x, tree.y)) continue;
      const key = treeSpriteKey(tree);
      if (!key) continue;
      // Sway frame: 500ms per step, per-tree offset
      const frameIndex = Math.floor((now / 500 + (tree.id || 0) * 0.7) % 4);
      const opacity = getTreeOpacity(game, tree, now, occluders);
      pushDepth('tree', tree, () => {
        drawWorldSprite(tree.x, tree.y, key, frameIndex, opacity);
      });
    }

    // 3) Rocks (normal/depleted, with occlusion opacity)
    for (const rock of game.rocks || []) {
      if (!circleInView(rock.x, rock.y, (rock.radius || 18) + 16, view)) continue;
      if (!fogStaticVisible(game, rock.x, rock.y)) continue;
      const key = rockSpriteKey(rock);
      const opacity = getRockOpacity(game, rock, now, occluders);
      pushDepth('rock', rock, () => {
        drawWorldSprite(rock.x, rock.y, key, -1, opacity);
      });
    }

    // Hemp, holes, and projectiles are not in the sprite cache, so they
    // remain drawn by the Canvas2D overlay pass.

    // 5) Items (with zoom gate + bob animation)
    if (renderLooseGroundItems) {
      for (const item of visibleItems) {
        const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
        const key = `item_${item.type}`;
        pushDepth('item', item, () => {
          drawWorldSprite(item.x, item.y + bob, key, -1, 1);
        }, { sortOffsetY: bob + 10 });
      }
    }

    // 6) Monsters (with wobble frame selection)
    for (const monster of visibleMonsters) {
      const key = monsterSpriteKey(monster);
      // Wobble frame: 400ms per step (matches Canvas2D), per-monster offset
      const frameIndex = Math.floor((now / 400 + (monster.id || 0) * 0.7) % 4);
      pushDepth('monster', monster, () => {
        drawWorldSprite(monster.x, monster.y, key, frameIndex, 1);
      });
    }

    // 7) Bots (walk cycle when moving, idle when not; zoom gate)
    if (renderBots) {
      for (const bot of visibleBots) {
        const facingRight = (bot.facingX ?? 1) >= 0;
        const isMoving = !!(bot.target || bot.vx || bot.vy);

        // ── Character walk-cycle PNG path (8-frame) ──
        if (isCharacterSpriteReady(bot.kind === 'dog' ? 'dog' : 'bot')) {
          const charName = bot.kind === 'dog' ? 'dog' : 'bot';
          const frameIdx = isMoving
            ? Math.floor((now / 100 + (bot.id || 0) * 0.7) % 8)
            : 0;
          const walkKey = `char_${charName}_walk`;
          const uv = getSpriteUV(walkKey, frameIdx);
          if (uv) {
            // Flip: WebGL2 batcher doesn't support per-sprite flip, so we
            // swap u0/u1 when facing left. The atlas stores frames in
            // Canvas2D orientation (v0=top), so this is a clean horizontal mirror.
            pushDepth('bot', bot, () => {
              if (facingRight) {
                batcher.drawSprite(
                  bot.x - (uv.cx ?? uv.w / 2), bot.y - (uv.cy ?? uv.h / 2),
                  uv.w, uv.h, 0, uv.u0, uv.v0, uv.u1, uv.v1,
                  [1, 1, 1, 1], [0, 0, 0, 0]
                );
              } else {
                batcher.drawSprite(
                  bot.x - (uv.cx ?? uv.w / 2), bot.y - (uv.cy ?? uv.h / 2),
                  uv.w, uv.h, 0, uv.u1, uv.v0, uv.u0, uv.v1,
                  [1, 1, 1, 1], [0, 0, 0, 0]
                );
              }
            });
            continue;
          }
        }

        // ── Procedural fallback ──
        if (bot.kind === 'dog') {
          const key = botSpriteKey(bot); // dog_left / dog_right
          pushDepth('bot', bot, () => {
            drawWorldSprite(bot.x, bot.y, key, -1, 1);
          });
          continue;
        }
        const key = botSpriteKey(bot);
        const colorIdx = BOT_COLORS.indexOf(bot.color || BOT_COLORS[0]);
        let frameIndex = -1;
        if (isMoving && colorIdx >= 0) {
          // Walk-cycle frame key: bot_<i>_walk → UV key bot_<i>_walk_<f>
          frameIndex = Math.floor((now / 140 + (bot.id || 0) * 0.7) % 4);
          const walkKey = `bot_${colorIdx}_walk`;
          const uv = getSpriteUV(walkKey, frameIndex);
          if (uv) {
            pushDepth('bot', bot, () => {
              drawWorldSprite(bot.x, bot.y, walkKey, frameIndex, 1);
            });
            continue;
          }
        }
        pushDepth('bot', bot, () => {
          drawWorldSprite(bot.x, bot.y, key, -1, 1);
        });
      }
    }

    // 8) Player (facing-based sprite selection)
    if (!campaignArrivalActive && game.player) {
      if (!view || circleInView(game.player.x, game.player.y, (game.player.r || 13) + 42, view)) {
        const facingRight = (game.player.facingX ?? 1) >= 0;
        const isMoving = !!(game.player.target && !game.player.target.started);

        // ── Character walk-cycle PNG path (8-frame) ──
        if (isCharacterSpriteReady('player')) {
          const frameIdx = isMoving ? Math.floor((now / 100) % 8) : 0;
          const walkKey = 'char_player_walk';
          const uv = getSpriteUV(walkKey, frameIdx);
          if (uv) {
            pushDepth('player', game.player, () => {
              if (facingRight) {
                batcher.drawSprite(
                  game.player.x - (uv.cx ?? uv.w / 2), game.player.y - (uv.cy ?? uv.h / 2),
                  uv.w, uv.h, 0, uv.u0, uv.v0, uv.u1, uv.v1,
                  [1, 1, 1, 1], [0, 0, 0, 0]
                );
              } else {
                batcher.drawSprite(
                  game.player.x - (uv.cx ?? uv.w / 2), game.player.y - (uv.cy ?? uv.h / 2),
                  uv.w, uv.h, 0, uv.u1, uv.v0, uv.u0, uv.v1,
                  [1, 1, 1, 1], [0, 0, 0, 0]
                );
              }
            });
          } else {
            // UV miss → procedural fallback
            const pKey = playerSpriteKey(game.player);
            pushDepth('player', game.player, () => {
              drawWorldSprite(game.player.x, game.player.y, pKey, -1, 1);
            });
          }
        } else {
          // ── Procedural fallback ──
          const pKey = playerSpriteKey(game.player);
          pushDepth('player', game.player, () => {
            drawWorldSprite(game.player.x, game.player.y, pKey, -1, 1);
          });
        }
      }
    }

    // ── Y-sort and draw all collected sprites ──────────────────────────
    // sortDepthDrawables returns a new array (stable sort by sortY, then
    // layer bias, then sortX, then insertion order). Sprites with lower
    // foot Y draw first (behind); higher foot Y draw last (in front).
    for (const drawable of sortDepthDrawables(depthDrawables)) {
      drawable.draw();
    }

    // 9) Projectiles — not in sprite cache; Canvas2D overlay draws them.
  }

  return {
    kind: 'webgl2',
    text: 'WebGL2 sprite batcher',
    webgpu: false,
    ctx: ctx2d,
    isWebGL2: true,
    atlas,
    uvMap: atlas ? atlas.uvMap : {},
    resize({ width = canvas.width, height = canvas.height } = {}) {
      if (glCanvas.width !== width) glCanvas.width = width;
      if (glCanvas.height !== height) glCanvas.height = height;
      batcher.resize(width, height);
    },
    draw(renderState) {
      const logicalW = Math.max(1, renderState.W || canvas.width);
      const logicalH = Math.max(1, renderState.H || canvas.height);
      const scaleX = canvas.width / logicalW;
      const scaleY = canvas.height / logicalH;

      // Phase 1: Render all world sprites via the WebGL2 batcher.
      batcher.clear();
      batcher.setCamera(logicalW, logicalH, renderState.camera?.x || 0, renderState.camera?.y || 0, renderState.camera?.zoom || 1);
      drawSprites(renderState);
      batcher.flush();

      // Phase 2: Composite.
      // Canvas2D draws background (map base, grid, zones), then we composite
      // the GL canvas on top, then Canvas2D draws overlays (fog, lighting,
      // health bars, text, UI). This is achieved via drawWorld with
      // spriteDrawMode:'skip', which:
      //   (a) runs the background pass normally,
      //   (b) skips entity sprite drawing but still collects visibility arrays
      //       for occlusion math and overlays (health bars),
      //   (c) draws fog, lighting, floaters, UI overlays on top.
      // The WebGL canvas is injected between background and overlays by
      // passing a compositeCallback that runs after the background save/scale
      // but before overlays. Simpler: run drawWorld in two halves isn't trivial
      // here, so we composite BEFORE calling drawWorld with spriteDrawMode:'skip'.
      // This puts GL sprites UNDER the background, which is wrong.
      //
      // Correct approach: drawWorld({ spriteDrawMode:'skip' }) draws background
      // AND overlays in one pass; we composite the GL result in the gap between
      // them via a compositeCallback hook. The callback receives the ctx and
      // runs inside the camera-transformed save block, after the background and
      // before the overlay pass.

      ctx2d.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      try {
        drawWorld(renderState, ctx2d, {
          spriteDrawMode: 'skip',
          compositeCallback: (c) => {
            // Composite the GL canvas in backing-pixel space; drawWorld will
            // restore its logical camera transform after this callback.
            c.save();
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.drawImage(glCanvas, 0, 0);
            c.restore();
          }
        });
      } finally {
        ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      }
    },
    destroy() {
      batcher.destroy();
    }
  };
}

export { isWebGL2Supported };
