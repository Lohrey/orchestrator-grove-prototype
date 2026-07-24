// src/systems/collision-system.js
// Collision system: point-in-polygon impassable zones.
// Part of the Game class composition root — installed via installCollisionSystem(Game, deps).
//
// Provides:
//   - this.impassableZones: array of { id, points: [{x,y},...] }
//   - addImpassableZone(id, points): register a polygon
//   - removeImpassableZone(id): unregister (e.g. when a bridge completes)
//   - isImpassable(x, y): point-in-polygon test across all zones
//   - isLineImpassable(x1, y1, x2, y2): sample several points along the line
//
// Used by moveToward() in world.js to block entity movement into canyons,
// unbuilt-bridge gaps, and other quest-locked terrain.

export function installCollisionSystem(Game, deps) {
  Object.assign(Game.prototype, {
    /**
     * Initialize per-instance collision state. Called from world.js init.
     * Kept as a method so resetWorldCollections can clear it cleanly.
     */
    initCollisionState() {
      this.impassableZones = [];
    },

    /**
     * Register an impassable polygon zone.
     * @param {string} id - unique zone id (e.g. 'canyon_band_a')
     * @param {Array<{x:number,y:number}>} points - closed polygon vertices
     */
    addImpassableZone(id, points) {
      if (!id || !Array.isArray(points) || points.length < 3) return;
      // Replace existing zone with same id (idempotent registration)
      this.impassableZones = (this.impassableZones || []).filter(z => z.id !== id);
      this.impassableZones.push({ id, points: points.map(p => ({ x: p.x, y: p.y })) });
    },

    /**
     * Remove an impassable zone by id (e.g. after bridge completes).
     */
    removeImpassableZone(id) {
      if (!id || !this.impassableZones) return;
      this.impassableZones = this.impassableZones.filter(z => z.id !== id);
    },

    /**
     * Point-in-polygon test against all impassable zones.
     * Uses the ray-casting algorithm (even-odd rule).
     * Returns true if (x, y) is inside any registered polygon.
     */
    isImpassable(x, y) {
      const zones = this.impassableZones;
      if (!zones || !zones.length) return false;
      for (const zone of zones) {
        if (pointInPolygon(x, y, zone.points)) return true;
      }
      return false;
    },

    /**
     * Sample several points along a line segment; return true if any sample
     * is impassable. Useful for sweeps (movement intents, projectile paths).
     * @param {number} samples - count of intermediate samples (default 5)
     */
    isLineImpassable(x1, y1, x2, y2, samples = 5) {
      const zones = this.impassableZones;
      if (!zones || !zones.length) return false;
      const n = Math.max(1, Math.floor(samples));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        if (this.isImpassable(x, y)) return true;
      }
      return false;
    }
  });
}

/**
 * Ray-casting point-in-polygon test. Returns true if (px, py) lies inside
 * the polygon described by `points` (array of {x, y}). Handles concave and
 * convex polygons; treats the polygon as implicitly closed.
 */
function pointInPolygon(px, py, points) {
  let inside = false;
  const n = points.length;
  if (n < 3) return false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
