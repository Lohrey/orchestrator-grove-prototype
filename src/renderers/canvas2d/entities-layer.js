import {
  circleInView,
  drawBar,
  drawNameTag,
  drawShadow,
  getLookOffset,
  isBotHandTool,
  roundedRect
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';
import { createDepthDrawable } from '../../depth-sort.js?v=t_da28d8dd';
import {
  drawHeldToolAsset,
  drawMiniItemAsset
} from '../../visual-assets.js?v=t_building_kits_0618';
import {
  getSpriteCache,
  isSpriteCacheReady,
  botSpriteKey,
  playerSpriteKey,
  SPRITE_SIZE
} from '../shared/sprite-cache.js?v=t_sprite_cache_0628';
import {
  loadTinySwordsAtlas,
  getTinySwordsAtlas
} from '../shared/tiny-swords-atlas.js?v=ts_fix2_0628';

// ── Tiny Swords sprite atlas integration ──────────────────────────────
// Loaded once at module init; getTinySwordsAtlas() returns null until ready,
// at which point bots/pawns switch from procedural circles to atlas sprites.
// See shared/tiny-swords-atlas.js for the loader contract.
let _tsReady = false;
let _tsPawnFrames = null;   // Pawn_Blue walk-cycle cells (192×192 sub-sheet)
let _tsKnightFrames = null; // Warrior (Knight) walk-cycle cells (192×192 sub-sheet)
let _tsTowerFrame = null;   // Tower frame rect

export async function initTinySwordsSprites() {
  if (_tsReady) return;
  const atlas = await loadTinySwordsAtlas();
  if (!atlas) { _tsReady = true; return; } // load failed — procedural fallback
  // Pawn_Blue: 1152×1152 → 6×6 grid of 192px cells (walk/idle cycle)
  _tsPawnFrames = atlas.getSheetFrames('Pawn_Blue');
  // Warrior_Blue: 1152×1536 → 6×8 grid of 192px cells (walk/idle/attack cycle)
  _tsKnightFrames = atlas.getSheetFrames('Warrior_Blue');
  // Tower_Blue for defensive towers / buildings
  _tsTowerFrame = atlas.getFrame('Tower_Blue') || atlas.getFrame('Castle_Blue');
  _tsReady = true;
  if (_tsPawnFrames) console.info(`[tiny-swords] Pawn walk cycle: ${_tsPawnFrames.length} frames`);
  else console.warn('[tiny-swords] Pawn_Blue sub-sheet not found — using single frame');
  if (_tsKnightFrames) console.info(`[tiny-swords] Warrior/Knight walk cycle: ${_tsKnightFrames.length} frames`);
  else console.warn('[tiny-swords] Warrior_Blue sub-sheet not found — using procedural fallback for player');
}

/**
 * Draw a Tiny Swords atlas cell (or full frame) centered at (cx, cy),
 * scaled to fit drawSize×drawSize. Optionally flip horizontally.
 */
function drawAtlasCell(c, bitmap, frame, cx, cy, drawSize, flipX) {
  if (!frame) return false;
  c.drawImage(
    bitmap,
    frame.x, frame.y, frame.w, frame.h,   // source
    cx - drawSize / 2, cy - drawSize / 2, // dest (centered)
    drawSize, drawSize
  );
  return true;
}

function drawMiniItem(c, x, y, type) {
  c.save();
  c.translate(x, y);
  drawMiniItemAsset(c, type);
  c.restore();
}

export function drawMonster(game, c, m, now) {
  const hover = game.mouse.hoverMonster === m;
  const r = m.radius || 18;
  const wobble = m._wobble ?? Math.sin(now / 520 + (m.phase || 0)) * 2;
  c.save();
  drawShadow(c, m.x, m.y + r * .7, r * 1.1, r * .34, .27);
  c.translate(m.x, m.y + wobble);
  c.fillStyle = hover ? 'rgba(255,244,208,.18)' : 'rgba(0,0,0,0)';
  if (hover) { c.beginPath(); c.arc(0, 0, r + 8, 0, Math.PI * 2); c.fill(); }
  const body = c.createRadialGradient(-r * .25, -r * .35, 2, 0, 0, r * 1.15);
  if (m.type === 'night_monster') {
    body.addColorStop(0, '#d3a95f');
    body.addColorStop(0.42, '#6b3f2f');
    body.addColorStop(1, '#17201d');
  } else {
    body.addColorStop(0, '#8fb9b5');
    body.addColorStop(1, '#344d47');
  }
  c.fillStyle = body;
  c.strokeStyle = hover ? '#fff4d0' : (m.type === 'night_monster' ? '#070908' : '#0d1714');
  c.lineWidth = hover ? 3 : 2;
  c.beginPath();
  c.ellipse(0, 0, r, r * .82, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.fillStyle = m.type === 'night_monster' ? '#ffd982' : '#e5ece8';
  c.beginPath(); c.arc(-r * .33, -r * .1, 3.2, 0, Math.PI * 2); c.arc(r * .33, -r * .1, 3.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#16211d';
  c.beginPath(); c.arc(-r * .33, -r * .1, 1.4, 0, Math.PI * 2); c.arc(r * .33, -r * .1, 1.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(229,236,232,.45)';
  c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, r * .14, r * .25, .15, Math.PI - .15); c.stroke();
  c.restore();
  drawBar(c, m.x - 20, m.y - r - 16, 40, 5, (m.hp || 0) / Math.max(1, m.maxHp || 10), '#8fb9b5');
  if (hover) drawNameTag(c, `${m.name || 'passive monster'} · ${m.hp || 0}/${m.maxHp || 10} hp`, m.x, m.y - r - 28);
}

export function drawDogBot(game, c, b, now) {
  const hover = game.mouse.hoverBot === b;
  const r = b.r || 12;
  const bob = Math.sin(now / 180 + (b.id || 0)) * 1.8;
  const facingRight = (b.facingX ?? 1) >= 0;
  c.save();
  drawShadow(c, b.x, b.y + r + 6, r + 9, 5, .25);
  c.translate(b.x, b.y + bob);
  if (hover) {
    c.beginPath();
    c.fillStyle = 'rgba(255,244,208,.15)';
    c.arc(0, 0, r + 10, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#8a6246';
  c.strokeStyle = hover ? '#fff4d0' : '#3c281f';
  c.lineWidth = hover ? 3 : 2;
  roundedRect(c, -r - 3, -r + 2, (r + 3) * 2, r * 1.45, 8);
  c.fill();
  c.stroke();
  c.fillStyle = '#9d7457';
  c.beginPath();
  c.ellipse(0, -r * .2, r * .95, r * .78, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  const earSide = facingRight ? 1 : -1;
  c.fillStyle = '#6f4b35';
  c.beginPath();
  c.moveTo(-r * .45 * earSide, -r * .75);
  c.lineTo(-r * .8 * earSide, -r * 1.35);
  c.lineTo(-r * .15 * earSide, -r * 1.05);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(r * .18 * earSide, -r * .7);
  c.lineTo(r * .55 * earSide, -r * 1.25);
  c.lineTo(r * .02 * earSide, -r * .96);
  c.closePath();
  c.fill();
  c.fillStyle = '#1b120f';
  c.beginPath();
  c.arc(-r * .22 * earSide, -r * .15, 1.8, 0, Math.PI * 2);
  c.arc(r * .16 * earSide, -r * .15, 1.8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e5ece8';
  c.beginPath();
  c.arc(r * .42 * earSide, -r * .02, 2.7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#bfe6c5';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-r * .45, r * .45);
  c.lineTo(-r * .95, r * .85);
  c.lineTo(-r * .68, r * .2);
  c.stroke();
  c.fillStyle = '#d7e8cf';
  c.font = '800 9px system-ui';
  c.textAlign = 'center';
  c.fillText(b.name || 'Dog', 0, r + 14);
  if (b.inventory) drawMiniItem(c, 0, -r * 1.75, b.inventory.type);
  if (hover) drawNameTag(c, `${b.name || 'Dog'} · fetch helper`, b.x, b.y - r - 28);
  c.restore();
}

// Original vector-path bot drawing, kept as fallback for debugging or when sprite cache isn't ready
export function drawBotVector(game, c, b, now) {
  if (b.kind === 'dog') return drawDogBot(game, c, b, now);
  const hover = game.mouse.hoverBot === b;
  const inventoryIsHandTool = isBotHandTool(b.inventory?.type);
  const facingRight = (b.facingX ?? 1) >= 0;
  const handToolTypes = inventoryIsHandTool ? [b.inventory.type] : [];
  c.save();
  drawShadow(c, b.x, b.y + b.r + 5, b.r + 8, 5, .26);
  const pulse = hover ? Math.sin(now / 160) * 1.5 : 0;
  c.fillStyle = b.color;
  c.strokeStyle = hover ? '#fff4d0' : '#0e1512';
  c.lineWidth = hover ? 4 : 2;
  roundedRect(c, b.x - b.r - 2 - pulse, b.y - b.r - 2 - pulse, (b.r + 2 + pulse) * 2, (b.r + 2 + pulse) * 2, 8);
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.22)';
  roundedRect(c, b.x - b.r + 2, b.y - b.r + 2, b.r * 1.4, b.r * .58, 5); c.fill();
  c.fillStyle = '#06100d';
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillText(b.id, b.x, b.y + 3);
  if (b.inventory && !inventoryIsHandTool) drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
  handToolTypes.slice(0, 2).forEach((type, index) => {
    const side = (index === 0 ? 1 : -1) * (facingRight ? 1 : -1);
    drawHeldToolAsset(c, b.x + side * (b.r + 8), b.y + 5 + index * 2, type);
  });
  if (b.equipment?.weapon) drawHeldToolAsset(c, b.x + 17, b.y - 5, b.equipment.weapon);
  if (b.equipment?.shield) drawHeldToolAsset(c, b.x - 17, b.y - 7, b.equipment.shield);
  drawAmmoBadge(c, b, b.x, b.y + b.r + 16);
  if (hover) drawNameTag(c, b.name || `Bot ${b.id}`, b.x, b.y - b.r - 24);
  c.restore();
}

// Fast sprite-based bot drawing — single drawImage call for the body, then overlay details
export function drawBot(game, c, b, now) {
  if (b.kind === 'dog') return drawDogBotSprite(game, c, b, now);
  const hover = game.mouse.hoverBot === b;
  const inventoryIsHandTool = isBotHandTool(b.inventory?.type);
  const facingRight = (b.facingX ?? 1) >= 0;
  const handToolTypes = inventoryIsHandTool ? [b.inventory.type] : [];

  // ── Tiny Swords atlas path (Pawn sprite) ──
  // When the atlas is loaded, bots render as Tiny Swords Pawn sprites with a
  // walk-cycle animation driven by bot movement state. Falls back to the
  // procedural sprite cache (or vector) if the atlas isn't ready.
  const atlas = getTinySwordsAtlas();
  if (atlas && _tsPawnFrames && !hover) {
    // Advance walk-cycle frame based on movement (use bot id + time for variety)
    const moving = b._moving || b.vx || b.vy;
    const speed = moving ? 8 : 0; // frames per second of animation
    const frameIdx = Math.floor((now * speed) / 1000 + (b.id ? String(b.id).charCodeAt(0) : 0)) % _tsPawnFrames.length;
    const frame = _tsPawnFrames[frameIdx];
    const drawSize = (b.r || 12) * 2.6; // scale pawn to roughly match bot footprint
    c.save();
    drawShadow(c, b.x, b.y + (b.r || 12) * .7, (b.r || 12) + 4, 4, .26);
    if (!facingRight) {
      // Flip horizontally for leftward movement
      c.translate(b.x + drawSize / 2, b.y);
      c.scale(-1, 1);
      drawAtlasCell(c, atlas.bitmap, frame, 0, 0, drawSize);
    } else {
      drawAtlasCell(c, atlas.bitmap, frame, b.x, b.y, drawSize);
    }
    // Overlay: id label + items (only when zoomed in)
    const zoom = game.camera?.zoom || 1;
    if (zoom >= 0.5) {
      c.fillStyle = '#06100d';
      c.font = '800 10px system-ui';
      c.textAlign = 'center';
      c.fillText(b.id, b.x, b.y + 3);
      if (b.inventory && !inventoryIsHandTool) drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
      handToolTypes.slice(0, 2).forEach((type, index) => {
        const side = (index === 0 ? 1 : -1) * (facingRight ? 1 : -1);
        drawHeldToolAsset(c, b.x + side * (b.r + 8), b.y + 5 + index * 2, type);
      });
      if (b.equipment?.weapon) drawHeldToolAsset(c, b.x + 17, b.y - 5, b.equipment.weapon);
      if (b.equipment?.shield) drawHeldToolAsset(c, b.x - 17, b.y - 7, b.equipment.shield);
      drawAmmoBadge(c, b, b.x, b.y + (b.r || 12) + 16);
    }
    c.restore();
    return;
  }

  // ── Procedural sprite-cache path (fallback) ──
  const spriteCache = getSpriteCache();
  const useSprite = spriteCache && !hover;

  if (useSprite) {
    const key = botSpriteKey(b);
    const sprite = spriteCache[key];
    if (sprite) {
      // Single drawImage blit for the body
      c.drawImage(sprite, b.x - SPRITE_SIZE / 2, b.y - SPRITE_SIZE / 2);

      // Overlay pass: name badge, items, tools (only when zoomed in enough to see them)
      const zoom = game.camera?.zoom || 1;
      if (zoom >= 0.5) {
        c.save();
        c.fillStyle = '#06100d';
        c.font = '800 10px system-ui';
        c.textAlign = 'center';
        c.fillText(b.id, b.x, b.y + 3);
        if (b.inventory && !inventoryIsHandTool) drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
        handToolTypes.slice(0, 2).forEach((type, index) => {
          const side = (index === 0 ? 1 : -1) * (facingRight ? 1 : -1);
          drawHeldToolAsset(c, b.x + side * (b.r + 8), b.y + 5 + index * 2, type);
        });
        if (b.equipment?.weapon) drawHeldToolAsset(c, b.x + 17, b.y - 5, b.equipment.weapon);
        if (b.equipment?.shield) drawHeldToolAsset(c, b.x - 17, b.y - 7, b.equipment.shield);
        drawAmmoBadge(c, b, b.x, b.y + b.r + 16);
        c.restore();
      }
      return;
    }
  }

  // Fallback: full vector drawing
  drawBotVector(game, c, b, now);
}

// Fast sprite-based dog bot drawing
function drawDogBotSprite(game, c, b, now) {
  const hover = game.mouse.hoverBot === b;
  const spriteCache = getSpriteCache();
  const useSprite = spriteCache && !hover;

  if (useSprite) {
    const key = botSpriteKey(b);
    const sprite = spriteCache[key];
    if (sprite) {
      c.drawImage(sprite, b.x - SPRITE_SIZE / 2, b.y - SPRITE_SIZE / 2);
      // Overlay: name + inventory
      const zoom = game.camera?.zoom || 1;
      if (zoom >= 0.5) {
        c.save();
        c.fillStyle = '#d7e8cf';
        c.font = '800 9px system-ui';
        c.textAlign = 'center';
        c.fillText(b.name || 'Dog', b.x, b.y + (b.r || 12) + 14);
        if (b.inventory) drawMiniItem(c, b.x, b.y - (b.r || 12) * 1.75, b.inventory.type);
        c.restore();
      }
      return;
    }
  }

  // Fallback: full vector dog drawing
  drawDogBot(game, c, b, now);
}

export function pushRemotePlayersToDepth(game, c, view, depthDrawables, now) {
  const players = game.multiplayer?.players || {};
  const localId = game.multiplayer?.playerId;
  for (const player of Object.values(players)) {
    if (!player || player.id === localId || player.disconnected) continue;
    if (view && !circleInView(player.x, player.y, 52, view)) continue;
    depthDrawables.push(createDepthDrawable('remote_player', player, () => drawRemotePlayer(game, c, player), { order: depthDrawables.length }));
  }
}

export function drawRemotePlayer(game, c, player) {
  c.save();
  drawShadow(c, player.x, player.y + 18, 22, 7, .24);
  c.fillStyle = player.id === 'p1' ? '#80a9c9' : '#c86b5f';
  c.strokeStyle = '#fff4d0';
  c.lineWidth = 2.5;
  c.beginPath(); c.arc(player.x, player.y, 15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#07100d';
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillText(player.id === 'p1' ? 'P1' : 'P2', player.x, player.y + 3);
  drawNameTag(c, player.label || (player.id === 'p1' ? 'Player 1' : 'Player 2'), player.x, player.y - 27);
  c.restore();
}

function drawAmmoBadge(c, actor, x, y) {
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

export function drawPlayerActor(game, c, now) {
  c.save();
  const breathe = Math.sin(now / 520) * .8;
  const hpRatio = Math.max(0, Math.min(1, (game.player.hp ?? 0) / Math.max(1, game.player.maxHp || 10)));
  const lowHp = hpRatio <= 0.3;
  const facingRight = (game.player.facingX ?? 1) >= 0;

  // ── Tiny Swords atlas path (Warrior/Knight sprite for player) ──
  const atlas = getTinySwordsAtlas();
  if (atlas && _tsKnightFrames) {
    const drawSize = (game.player.r || 13) * 3.0; // knight is taller/bigger than pawn
    // Animate walk cycle based on movement; slow idle bob when stationary
    const moving = game.player.target || (Array.isArray(game.player.targetQueue) && game.player.targetQueue.length > 0);
    const speed = moving ? 8 : 1; // fps: 8 when walking, ~1 for gentle idle
    const frameIdx = Math.floor((now * speed) / 1000) % _tsKnightFrames.length;
    const frame = _tsKnightFrames[frameIdx];
    drawShadow(c, game.player.x, game.player.y + (game.player.r || 13) * .7, (game.player.r || 13) + 5, 5, .28);
    if (!facingRight) {
      c.translate(game.player.x + drawSize / 2, game.player.y + breathe);
      c.scale(-1, 1);
      drawAtlasCell(c, atlas.bitmap, frame, 0, 0, drawSize);
    } else {
      drawAtlasCell(c, atlas.bitmap, frame, game.player.x, game.player.y + breathe, drawSize);
    }
  } else {
    // Fallback: procedural sprite cache or vector drawing
    const spriteCache = getSpriteCache();
    const sprite = spriteCache ? spriteCache[playerSpriteKey(game.player)] : null;

    if (sprite) {
      c.drawImage(sprite, game.player.x - SPRITE_SIZE / 2, game.player.y - SPRITE_SIZE / 2 + breathe);
    } else {
      // Fallback: vector drawing
      drawShadow(c, game.player.x, game.player.y + game.player.r + 5, game.player.r + 8, 5, .28);
      const look = getLookOffset(game.player.facingX, game.player.facingY, 4);
      c.fillStyle = lowHp ? '#f5d8d4' : '#eef5ef';
      c.strokeStyle = '#26322d';
      c.lineWidth = 2;
      c.beginPath(); c.arc(game.player.x, game.player.y + breathe, game.player.r + 1, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#76b77f';
      c.beginPath(); c.arc(game.player.x + look.x, game.player.y - 3 + breathe + look.y, 3, 0, Math.PI * 2); c.fill();
    }
  }

  // Overlay pass (always for player since it's important)
  const look = getLookOffset(game.player.facingX, game.player.facingY, 4);
  if (game.player.inventory) {
    drawMiniItem(c, game.player.x, game.player.y - 25, game.player.inventory.type);
    drawNameTag(c, game.player.inventory.type, game.player.x, game.player.y - 34);
  }
  if (game.player.equipment?.weapon) drawHeldToolAsset(c, game.player.x + 19, game.player.y - 5, game.player.equipment.weapon);
  if (game.player.equipment?.shield) drawHeldToolAsset(c, game.player.x - 18, game.player.y - 5, game.player.equipment.shield);
  drawAmmoBadge(c, game.player, game.player.x, game.player.y + 28);
  c.restore();
  // ── Health bar above player (green→yellow→red gradient) ──
  const barColor = hpRatio > 0.6 ? '#5ecf6e' : hpRatio > 0.3 ? '#d3a95f' : '#c86b5f';
  drawBar(c, game.player.x - 22, game.player.y - game.player.r - 18, 44, 5, hpRatio, barColor);
}

export function drawPlayerTarget(game, c) {
  const queuedTargets = game.player.targetQueue || [];
  c.save();
  c.strokeStyle = '#86b6d6';
  c.lineWidth = 2;
  c.setLineDash([4, 4]);
  c.beginPath(); c.arc(game.player.target.x, game.player.target.y, 14, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  c.moveTo(game.player.target.x - 19, game.player.target.y); c.lineTo(game.player.target.x + 19, game.player.target.y);
  c.moveTo(game.player.target.x, game.player.target.y - 19); c.lineTo(game.player.target.x, game.player.target.y + 19);
  c.stroke();
  if (game.player.target.started && game.player.target.total) {
    const total = game.player.target.total || 1;
    const done = 1 - Math.max(0, game.player.target.remaining || 0) / total;
    drawBar(c, game.player.target.x - 24, game.player.target.y - 34, 48, 7, done, '#d3a95f');
    drawNameTag(c, game.player.target.processLabel || 'working', game.player.target.x, game.player.target.y - 42);
  }
  if (queuedTargets.length) {
    c.strokeStyle = '#9abf8f';
    c.fillStyle = '#9abf8f';
    let prev = game.player.target;
    for (const target of queuedTargets) {
      c.beginPath();
      c.moveTo(prev.x, prev.y);
      c.lineTo(target.x, target.y);
      c.stroke();
      c.beginPath();
      c.arc(target.x, target.y, 10, 0, Math.PI * 2);
      c.stroke();
      prev = target;
    }
  }
  c.restore();
}

export function drawAssistant(c, x, y, now, facingX = 1, facingY = 0) {
  c.save();
  const r = 9 + Math.sin(now / 500) * 1;
  const look = getLookOffset(facingX, facingY, 2.8);
  c.fillStyle = 'rgba(118,183,127,.16)';
  c.beginPath(); c.arc(x, y, r + 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#76b77f';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e6f4e5';
  c.beginPath(); c.arc(x + look.x, y - 3 + look.y, 2, 0, Math.PI * 2); c.fill();
  c.restore();
}
