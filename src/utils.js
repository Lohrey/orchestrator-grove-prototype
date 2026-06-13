export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (min, max) => min + Math.random() * (max - min);
export const distXY = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const escapeHtml = (s = '') => String(s).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
export function pointInRect(x, y, r) { return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2; }
export function rectDistance(px, py, r) {
  const rx = clamp(px, r.x - r.w / 2, r.x + r.w / 2);
  const ry = clamp(py, r.y - r.h / 2, r.y + r.h / 2);
  return distXY(px, py, rx, ry);
}
export function nearest(list, x, y, predicate = () => true) {
  let best = null, bestD = Infinity;
  for (const item of list) {
    if (!predicate(item)) continue;
    const d = distXY(x, y, item.x, item.y);
    if (d < bestD) { best = item; bestD = d; }
  }
  return best;
}
export function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy, clientX: event.clientX, clientY: event.clientY };
}
