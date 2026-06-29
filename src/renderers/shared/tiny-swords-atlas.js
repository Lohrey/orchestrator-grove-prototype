// ── Tiny Swords sprite atlas loader (shared across render paths) ──────
//
// Loads the TexturePacker JSON Hash atlas (tiny_swords_atlas.png +
// tiny_swords_atlas.json, 197 frames at 8192×8192 RGBA8888) and returns a
// lookup object usable by BOTH the Canvas2D renderer (drawImage with a
// source rect) and the Pixi renderer (TODO: PIXI.Texture frame slicing).
//
// The atlas PNG is loaded as an ImageBitmap (GPU-resident, WebGPU-ready).
// The JSON frames are parsed into a flat { name → {x,y,w,h} } map.
//
// Frame names in the JSON use folder paths, e.g.:
//   "Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png"
// getFrame() supports fuzzy matching so you can look up "Pawn_Blue" and it
// will find the full-path key.
//
// IMPORTANT — sub-sheets:
// Many troop frames are themselves sprite sheets packed into the atlas.
// For example Pawn_Blue is a 1152×1152 region containing a 6×6 grid of
// 192×192 animation cells (36 walk/idle frames).  This loader exposes the
// raw region via getFrame() and also provides getSheetFrames() to slice a
// region into individual animation cells.

// Resolve relative to this module's URL so the atlas works under any base path.
// This module lives at src/renderers/shared/tiny-swords-atlas.js, so we need
// ../../../ to climb shared/ → renderers/ → src/ → project root (where assets/ lives).
const _ATLAS_BASE = new URL('../../../assets/tiny-swords/', import.meta.url).href;
const ATLAS_PNG_URL = _ATLAS_BASE + 'tiny_swords_atlas.png';
const ATLAS_JSON_URL = _ATLAS_BASE + 'tiny_swords_atlas.json';

/** Standard cell size for Tiny Swords troop sub-sheets (192×192). */
const TROOP_CELL = 192;

let _atlasPromise = null;
let _atlas = null;

/**
 * Load (or return cached) the Tiny Swords atlas.
 *
 * @returns {Promise<{bitmap:ImageBitmap, frames:Object, getFrame:Function, getSheetFrames:Function}|null>}
 *   null if loading fails (callers should fall back to procedural drawing).
 */
export async function loadTinySwordsAtlas() {
  if (_atlas) return _atlas;
  if (_atlasPromise) return _atlasPromise;

  _atlasPromise = (async () => {
    try {
      // Fetch JSON + PNG in parallel
      const [jsonRes, imgRes] = await Promise.all([
        fetch(ATLAS_JSON_URL),
        fetch(ATLAS_PNG_URL)
      ]);
      if (!jsonRes.ok) throw new Error(`Atlas JSON HTTP ${jsonRes.status}`);
      if (!imgRes.ok) throw new Error(`Atlas PNG HTTP ${imgRes.status}`);

      const data = await jsonRes.json();
      const blob = await imgRes.blob();

      // Create ImageBitmap (GPU-resident, WebGPU-ready)
      let bitmap;
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(blob);
      } else {
        // Fallback: use an Image element (Node/offscreen test envs)
        bitmap = await blobToImage(blob);
      }

      // Flatten frames into { name → {x,y,w,h} }
      const rawFrames = data.frames || {};
      const frames = {};
      for (const [key, val] of Object.entries(rawFrames)) {
        const f = val.frame || val;
        frames[key] = { x: f.x, y: f.y, w: f.w, h: f.h };
      }

      const meta = data.meta || {};
      console.info(
        `[tiny-swords-atlas] Loaded ${Object.keys(frames).length} frames, ` +
        `atlas ${meta.size?.w || '?'}×${meta.size?.h || '?'}`
      );

      _atlas = {
        bitmap,
        frames,
        meta,
        /**
         * Look up a frame by name with fuzzy matching.
         * Exact key match first, then case-insensitive partial match
         * (e.g. "Pawn_Blue" → "Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png").
         * @param {string} name
         * @returns {{x,y,w,h}|null}
         */
        getFrame(name) {
          if (!name || !frames) return null;
          // Exact match
          if (frames[name]) return frames[name];
          // Normalize: case-insensitive, strip extension
          const needle = name.toLowerCase().replace(/\.png$/i, '');
          // Try "ends with" first (most specific: Pawn_Blue.png suffix)
          for (const key of Object.keys(frames)) {
            const norm = key.toLowerCase();
            if (norm.endsWith('/' + needle + '.png') || norm.endsWith('/' + needle)) {
              return frames[key];
            }
          }
          // Broader: contains the needle as a path segment
          for (const key of Object.keys(frames)) {
            const segs = key.toLowerCase().replace(/\.png$/i, '').split('/');
            if (segs.includes(needle)) return frames[key];
          }
          // Loose: contains anywhere
          for (const key of Object.keys(frames)) {
            if (key.toLowerCase().includes(needle)) return frames[key];
          }
          return null;
        },

        /**
         * Slice a sub-sheet frame (e.g. a troop walk-cycle) into individual
         * animation cells of TROOP_CELL × TROOP_CELL.
         *
         * @param {string} name — frame name (fuzzy), e.g. "Pawn_Blue"
         * @param {number} [cellSize=192]
         * @returns {Array<{x,y,w,h}>|null} array of cell rects, or null if frame not found
         */
        getSheetFrames(name, cellSize = TROOP_CELL) {
          const region = this.getFrame(name);
          if (!region) return null;
          const cols = Math.floor(region.w / cellSize);
          const rows = Math.floor(region.h / cellSize);
          const cells = [];
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              cells.push({
                x: region.x + col * cellSize,
                y: region.y + row * cellSize,
                w: cellSize,
                h: cellSize
              });
            }
          }
          return cells.length ? cells : null;
        }
      };

      return _atlas;
    } catch (err) {
      console.warn('[tiny-swords-atlas] Failed to load atlas — procedural fallback active:', err.message || err);
      _atlas = null;
      return null;
    } finally {
      _atlasPromise = null; // allow retry on failure
    }
  })();

  return _atlasPromise;
}

/** Synchronous accessor — returns the cached atlas or null if not yet loaded. */
export function getTinySwordsAtlas() {
  return _atlas;
}

/**
 * Helper: resolve a frame from the currently-loaded atlas without awaiting.
 * Returns null if atlas not loaded or frame not found.
 */
export function tinySwordsFrame(name) {
  return _atlas ? _atlas.getFrame(name) : null;
}

/** Helper: resolve animation cells from the currently-loaded atlas. */
export function tinySwordsSheetFrames(name, cellSize = TROOP_CELL) {
  return _atlas ? _atlas.getSheetFrames(name, cellSize) : null;
}

// ── Internal: fallback image creation when createImageBitmap unavailable ──
function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('No Image or createImageBitmap available'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
    img.src = url;
  });
}

export { ATLAS_PNG_URL, ATLAS_JSON_URL, TROOP_CELL };
