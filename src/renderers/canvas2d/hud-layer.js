import {
  roundedRect
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';

export function drawHud(game, c) {
  c.save();
  const zoom = Math.round((game.camera.zoom || 1) * 100);
  const mp = game.multiplayer?.enabled ? ` · Multiplayer ${game.multiplayer.sessionId || 'session'} · destroy enemy throne` : '';
  const clock = game.dayNight ? ` · ${game.dayNight.label} ${Math.round((game.dayNight.phase || 0) * 100)}%` : '';
  const mobile = !!game.mobile;
  const text = mobile
    ? `Tap move/select · Long-press action · Drag pan · Pinch/＋/－ zoom ${zoom}% · Menu/Build/Chat buttons${clock}${mp}`
    : `WASD / arrows pan · Hold Shift = fast pan · Mouse wheel zoom ${zoom}% · Right-click moves/attacks/deposits · E acts · B build${clock}${mp}`;
  c.font = mobile ? '800 12px system-ui' : '700 13px system-ui';
  const w = Math.min(game.W - 32, c.measureText(text).width + 28);
  const h = mobile ? 28 : 32;
  c.fillStyle = 'rgba(9, 14, 12, .72)';
  c.strokeStyle = 'rgba(211, 169, 95, .25)';
  c.lineWidth = 1;
  roundedRect(c, 16, 14, w, h, 999); c.fill(); c.stroke();
  c.fillStyle = '#e6eee8';
  c.fillText(text, 30, 35);
  if (game.showFpsOverlay !== false) {
    const fps = Math.round(Number(game.fps || 0));
    const target = Math.max(1, Number(game.targetFps || 60));
    const fpsText = `${fps || '…'} FPS`;
    c.font = '800 13px system-ui';
    const fw = c.measureText(fpsText).width + 24;
    const fx = Math.max(16, game.W - fw - 16);
    const color = fps >= target * 0.85 ? 'rgba(116, 205, 137, .65)' : fps >= target * 0.6 ? 'rgba(211, 169, 95, .72)' : 'rgba(207, 94, 82, .72)';
    c.fillStyle = 'rgba(8, 12, 10, .78)';
    c.strokeStyle = color;
    roundedRect(c, fx, 14, fw, 28, 999); c.fill(); c.stroke();
    c.fillStyle = '#f4fbf5';
    c.textAlign = 'right';
    c.fillText(fpsText, game.W - 28, 33);
  }
  // ── Player HP HUD badge (bottom-left) ──
  if (game.player) {
    const hp = Math.max(0, game.player.hp ?? 0);
    const maxHp = game.player.maxHp || 10;
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const hpColor = ratio > 0.6 ? '#5ecf6e' : ratio > 0.3 ? '#d3a95f' : '#c86b5f';
    c.textAlign = 'left';
    c.font = '800 13px system-ui';
    const hpLabel = `HP ${hp}/${maxHp}`;
    const hpW = c.measureText(hpLabel).width + 24;
    const hpH = 28;
    const hpX = 16;
    const hpY = game.H - hpH - 16;
    c.fillStyle = 'rgba(8, 12, 10, .82)';
    c.strokeStyle = hpColor;
    c.lineWidth = 1;
    roundedRect(c, hpX, hpY, Math.max(hpW, 100), hpH, 999); c.fill(); c.stroke();
    // mini health bar inside badge
    const barX = hpX + hpW + 4;
    const barW = Math.min(80, game.W - barX - 16);
    if (barW > 20) {
      c.save();
      roundedRect(c, barX, hpY + 6, barW, hpH - 12, (hpH - 12) / 2); c.fillStyle = 'rgba(5,8,7,.78)'; c.fill();
      roundedRect(c, barX + 1, hpY + 7, Math.max(0, (barW - 2) * ratio), hpH - 14, (hpH - 14) / 2); c.fillStyle = hpColor; c.fill();
      c.restore();
    }
    c.fillStyle = '#f4fbf5';
    c.fillText(hpLabel, hpX + 12, hpY + 19);
  }
  // ── Death overlay ──
  if (game.player?.dead) {
    c.fillStyle = 'rgba(20, 5, 5, .55)';
    c.fillRect(0, 0, game.W, game.H);
    c.textAlign = 'center';
    c.font = '900 36px system-ui';
    c.fillStyle = '#f5d8d4';
    c.fillText('You were defeated', game.W / 2, game.H / 2 - 30);
    c.font = '700 18px system-ui';
    c.fillStyle = '#e6eee8';
    c.fillText('Click anywhere or press R to respawn', game.W / 2, game.H / 2 + 12);
  }
  c.restore();
}
