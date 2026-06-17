// src/sim/sim-worker.ts
var wasmPromise;
var wasm;
var KIND = Object.freeze({ any: 0, log: 1, plank: 2, pole: 3, stick: 4, stone: 5, tree_seed: 6, crude_axe: 7, crude_pickaxe: 8, crude_shovel: 9, crude_hammer: 10, hemp: 11, hemp_seed: 12 });
function kindCode(type) {
  return type ? KIND[type] || 0 : 0;
}
async function instantiateWasm() {
  const url = new URL("./wasm/sim_core.wasm", import.meta.url);
  const imports = {};
  try {
    const result = await WebAssembly.instantiateStreaming(fetch(url), imports);
    return result.instance.exports;
  } catch {
    const bytes = await fetch(url).then((response) => response.arrayBuffer());
    const result = await WebAssembly.instantiate(bytes, imports);
    return result.instance.exports;
  }
}
async function loadWasm() {
  if (!wasmPromise) wasmPromise = instantiateWasm();
  wasm = wasm || await wasmPromise;
  return wasm;
}
function nearestItemWithJs(points = [], query = {}) {
  const qx = Number(query.x || 0);
  const qy = Number(query.y || 0);
  const type = query.type || null;
  let best = null;
  let bestD = Infinity;
  for (const point of points) {
    if (type && point.type !== type) continue;
    const dx = Number(point.x || 0) - qx;
    const dy = Number(point.y || 0) - qy;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = point;
    }
  }
  return best ? { id: best.id, type: best.type, x: best.x, y: best.y, distanceSq: bestD, backend: "js-fallback" } : null;
}
async function nearestItem(points = [], query = {}) {
  const module = await loadWasm();
  if (!module?.clear_points || !module?.set_point || !module?.nearest_point) return nearestItemWithJs(points, query);
  const capped = points.slice(0, 4096);
  module.clear_points();
  for (let index = 0; index < capped.length; index++) {
    const point = capped[index];
    module.set_point(index, Number(point.numericId || point.id || index + 1), kindCode(point.type), Number(point.x || 0), Number(point.y || 0));
  }
  const id = module.nearest_point(Number(query.x || 0), Number(query.y || 0), kindCode(query.type), capped.length);
  const match = capped.find((point) => Number(point.numericId || point.id) === id);
  if (!match) return null;
  const dx = Number(match.x || 0) - Number(query.x || 0);
  const dy = Number(match.y || 0) - Number(query.y || 0);
  return { id: match.id, numericId: match.numericId, type: match.type, x: match.x, y: match.y, distanceSq: dx * dx + dy * dy, backend: "rust-wasm" };
}
async function pathfind(query = {}) {
  await loadWasm();
  return { waypoints: [{ x: Number(query.tx || 0), y: Number(query.ty || 0) }], backend: "rust-wasm-direct-path" };
}
async function chunkForPoint(query = {}) {
  const module = await loadWasm();
  const size = Number(query.chunkSize || 256);
  const cx = module.chunk_coord?.(Number(query.x || 0), size) ?? Math.floor(Number(query.x || 0) / size);
  const cy = module.chunk_coord?.(Number(query.y || 0), size) ?? Math.floor(Number(query.y || 0) / size);
  return { cx, cy, key: `${cx}:${cy}`, backend: "rust-wasm" };
}
async function botTick(query = {}) {
  const module = await loadWasm();
  const arrived = module.compute_next_step?.(Number(query.x || 0), Number(query.y || 0), Number(query.tx || 0), Number(query.ty || 0), Number(query.dt || 0), Number(query.speed || 0), Number(query.close || 4)) ?? 1;
  return { x: module.last_step_x?.() ?? Number(query.tx || 0), y: module.last_step_y?.() ?? Number(query.ty || 0), arrived: arrived === 1, backend: "rust-wasm" };
}
self.onmessage = async (event) => {
  const { id, type } = event.data || {};
  try {
    if (type === "ping") {
      const module = await loadWasm();
      self.postMessage({ id, ok: true, result: { version: module.sim_core_version?.() || 0, backend: "rust-wasm" } });
      return;
    }
    if (type === "nearest_item") {
      const result = await nearestItem(event.data.points || [], event.data.query || {});
      self.postMessage({ id, ok: true, result });
      return;
    }
    if (type === "pathfind") {
      const result = await pathfind(event.data.query || {});
      self.postMessage({ id, ok: true, result });
      return;
    }
    if (type === "chunk_for_point") {
      const result = await chunkForPoint(event.data.query || {});
      self.postMessage({ id, ok: true, result });
      return;
    }
    if (type === "bot_tick") {
      const result = await botTick(event.data.query || {});
      self.postMessage({ id, ok: true, result });
      return;
    }
    throw new Error(`unknown sim worker message: ${type}`);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
