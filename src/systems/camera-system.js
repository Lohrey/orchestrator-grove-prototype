// src/systems/camera-system.js
// Camera viewport, zoom, coordinate transforms.
// Part of the Game class composition root — installed via installCameraSystem(Game, deps).

import { clamp, canvasPoint } from '../utils.js?v=20260613-player-tools';

export function installCameraSystem(Game, deps) {
  const {
    CAMERA_MAX_ZOOM,
    CAMERA_MIN_ZOOM,
    CAMERA_EDGE_VIEWPORT_PADDING_RATIO,
    CAMERA_WHEEL_SENSITIVITY
  } = deps;

  Object.assign(Game.prototype, {
    resizeCanvas(clampEntities = true) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const parentRect = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
      const rect = canvasRect.width && canvasRect.height ? canvasRect : parentRect;
      const w = Math.max(1, Math.round(rect.width || window.innerWidth || this.canvas.width));
      const h = Math.max(1, Math.round(rect.height || window.innerHeight || this.canvas.height));
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.canvas.width = w;
      this.canvas.height = h;
      this.W = w;
      this.H = h;
      if (clampEntities && this.player) {
        this.player.x = clamp(this.player.x, 20, Math.max(20, this.map.width - 20));
        this.player.y = clamp(this.player.y, 20, Math.max(20, this.map.height - 20));
        this.assistant.x = clamp(this.assistant.x, 20, Math.max(20, this.map.width - 20));
        this.assistant.y = clamp(this.assistant.y, 20, Math.max(20, this.map.height - 20));
      }
      this.clampCamera();
      this.renderBackend?.resize?.({ width: w, height: h, canvas: this.canvas });
    },
    clampCamera() {
      const zoom = clamp(this.camera.zoom || 1, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
      this.camera.zoom = zoom;
      const viewW = this.W / zoom;
      const viewH = this.H / zoom;
      const edgePadX = Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2);
      const edgePadY = Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2);
      const maxX = Math.max(0, this.map.width - viewW) + edgePadX;
      const maxY = Math.max(0, this.map.height - viewH) + edgePadY;
      this.camera.x = clamp(this.camera.x, -edgePadX, maxX);
      this.camera.y = clamp(this.camera.y, -edgePadY, maxY);
    },
    screenToWorld(screenX, screenY) {
      const zoom = this.camera.zoom || 1;
      return {
        x: clamp(screenX / zoom + this.camera.x, 0, this.map.width),
        y: clamp(screenY / zoom + this.camera.y, 0, this.map.height)
      };
    },
    worldToScreen(worldX, worldY) {
      const zoom = this.camera.zoom || 1;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = rect.width / Math.max(1, this.canvas.width);
      const scaleY = rect.height / Math.max(1, this.canvas.height);
      return {
        x: rect.left + ((worldX - this.camera.x) * zoom * scaleX),
        y: rect.top + ((worldY - this.camera.y) * zoom * scaleY)
      };
    },
    refreshMouseWorld() {
      const world = this.screenToWorld(this.mouse.screenX || 0, this.mouse.screenY || 0);
      this.mouse.x = world.x;
      this.mouse.y = world.y;
    },
    setCameraZoom(nextZoom, anchorScreenX = this.W / 2, anchorScreenY = this.H / 2) {
      const oldZoom = this.camera.zoom || 1;
      const zoom = clamp(nextZoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
      if (Math.abs(zoom - oldZoom) < 0.001) return false;
      const anchorWorldX = anchorScreenX / oldZoom + this.camera.x;
      const anchorWorldY = anchorScreenY / oldZoom + this.camera.y;
      this.camera.zoom = zoom;
      this.camera.x = anchorWorldX - anchorScreenX / zoom;
      this.camera.y = anchorWorldY - anchorScreenY / zoom;
      this.clampCamera();
      this.refreshMouseWorld();
      this.updateHover();
      return true;
    },
    canvasToWorld(event) {
      const p = canvasPoint(this.canvas, event);
      const world = this.screenToWorld(p.x, p.y);
      return {
        ...p,
        screenX: p.x,
        screenY: p.y,
        x: world.x,
        y: world.y
      };
    },
    updateCamera(dt) {
      let dx = 0, dy = 0;
      if (this.keys.has('arrowleft') || this.keys.has('a')) dx--;
      if (this.keys.has('arrowright') || this.keys.has('d')) dx++;
      if (this.keys.has('arrowup') || this.keys.has('w')) dy--;
      if (this.keys.has('arrowdown') || this.keys.has('s')) dy++;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const speed = this.camera.speed * (this.keys.has('shift') ? (this.camera.fastMultiplier || 2.35) : 1);
        this.camera.x += (dx / len) * speed * dt;
        this.camera.y += (dy / len) * speed * dt;
        this.clampCamera();
        this.refreshMouseWorld();
        this.updateHover();
      }
    },
  });
}
