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
  c.restore();
}
