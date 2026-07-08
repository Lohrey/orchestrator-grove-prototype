// src/systems/camera-system.js
// Camera viewport, zoom, coordinate transforms, and canvas presentation sizing.
// Part of the Game class composition root — installed via installCameraSystem(Game, deps).

import { clamp, canvasPoint } from '../utils.js';

export function installCameraSystem(Game, deps) {
  const {
    CAMERA_MAX_ZOOM,
    CAMERA_MIN_ZOOM,
    CAMERA_EDGE_VIEWPORT_PADDING_RATIO,
    CAMERA_WHEEL_SENSITIVITY
  } = deps;

  Object.assign(Game.prototype, {
    resizeCanvas(clampEntities = true) {
      if (this.renderBackend?.kind === 'webgl2' && this._useWebGL2FullscreenPresentation !== false) {
        this._resizeWebGL2Presentation(clampEntities);
        return;
      }

      // ── Integer scaling: fixed native resolution ──
      // Canvas2D keeps the 640×360 native backing store and CSS integer scale.
      // Pixi manages its own resolution, so it keeps the dynamic-backing-store path.
      const useIntegerScaling = this._useIntegerScaling !== false
        && this.renderBackend?.kind !== 'pixi';
      if (!useIntegerScaling) {
        // Legacy path: backing store matches the CSS viewport size (Pixi, etc.)
        const canvasRect = this.canvas.getBoundingClientRect();
        const parentRect = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
        const rect = canvasRect.width && canvasRect.height ? canvasRect : parentRect;
        const w = Math.max(1, Math.round(rect.width || window.innerWidth || this.canvas.width));
        const h = Math.max(1, Math.round(rect.height || window.innerHeight || this.canvas.height));
        if (this.canvas.width === w && this.canvas.height === h) return;
        this.canvas.width = w;
        this.canvas.height = h;
        this.W = w; this.H = h;
        if (clampEntities && this.player) {
          this.player.x = clamp(this.player.x, 20, Math.max(20, this.map.width - 20));
          this.player.y = clamp(this.player.y, 20, Math.max(20, this.map.height - 20));
          this.assistant.x = clamp(this.assistant.x, 20, Math.max(20, this.map.width - 20));
          this.assistant.y = clamp(this.assistant.y, 20, Math.max(20, this.map.height - 20));
        }
        this.clampCamera();
        this.renderBackend?.resize?.({ width: w, height: h, canvas: this.canvas });
        return;
      }
      // Integer-scaling path: fixed 640×360 backing store
      const NATIVE_W = 640;
      const NATIVE_H = 360;
      const alreadyNative = this.canvas.width === NATIVE_W && this.canvas.height === NATIVE_H;
      this.canvas.width = NATIVE_W;
      this.canvas.height = NATIVE_H;
      this.W = NATIVE_W;
      this.H = NATIVE_H;
      this._updateIntegerScale();
      if (!alreadyNative) {
        // Only clamp entities / notify renderer when the backing store actually changed
        if (clampEntities && this.player) {
          this.player.x = clamp(this.player.x, 20, Math.max(20, this.map.width - 20));
          this.player.y = clamp(this.player.y, 20, Math.max(20, this.map.height - 20));
          this.assistant.x = clamp(this.assistant.x, 20, Math.max(20, this.map.width - 20));
          this.assistant.y = clamp(this.assistant.y, 20, Math.max(20, this.map.height - 20));
        }
        this.clampCamera();
        this.renderBackend?.resize?.({ width: NATIVE_W, height: NATIVE_H, canvas: this.canvas });
      }
    },
    _resizeWebGL2Presentation(clampEntities = true) {
      const NATIVE_W = 640;
      const NATIVE_H = 360;
      const parentEl = this.canvas.parentElement || this.canvas;
      const parent = parentEl.getBoundingClientRect();
      const win = typeof window !== 'undefined' ? window : {};
      const cssW = Math.max(1, Math.round(parentEl.clientWidth || parent.width || win.innerWidth || NATIVE_W));
      const cssH = Math.max(1, Math.round(parentEl.clientHeight || parent.height || win.innerHeight || NATIVE_H));
      const pixelRatio = Math.max(1, Math.min(2, Number(win.devicePixelRatio) || 1));
      const backingW = Math.max(1, Math.round(cssW * pixelRatio));
      const backingH = Math.max(1, Math.round(cssH * pixelRatio));
      const aspect = cssW / cssH;
      const nativeAspect = NATIVE_W / NATIVE_H;
      const logicalW = aspect >= nativeAspect ? Math.max(NATIVE_W, Math.round(NATIVE_H * aspect)) : NATIVE_W;
      const logicalH = aspect >= nativeAspect ? NATIVE_H : Math.max(NATIVE_H, Math.round(NATIVE_W / aspect));
      const changed = this.canvas.width !== backingW
        || this.canvas.height !== backingH
        || this.W !== logicalW
        || this.H !== logicalH;

      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.marginLeft = '0';
      this.canvas.style.marginRight = '0';
      this.canvas.style.display = 'block';
      this.canvas.width = backingW;
      this.canvas.height = backingH;
      this.W = logicalW;
      this.H = logicalH;
      this._presentationScaleX = backingW / logicalW;
      this._presentationScaleY = backingH / logicalH;

      if (!changed) return;
      if (clampEntities && this.player) {
        this.player.x = clamp(this.player.x, 20, Math.max(20, this.map.width - 20));
        this.player.y = clamp(this.player.y, 20, Math.max(20, this.map.height - 20));
        this.assistant.x = clamp(this.assistant.x, 20, Math.max(20, this.map.width - 20));
        this.assistant.y = clamp(this.assistant.y, 20, Math.max(20, this.map.height - 20));
      }
      this.clampCamera();
      this.renderBackend?.resize?.({
        width: backingW,
        height: backingH,
        logicalWidth: logicalW,
        logicalHeight: logicalH,
        pixelRatio,
        canvas: this.canvas
      });
    },
    _updateIntegerScale() {
      // Scale the canvas to fit the parent while preserving 16:9 aspect ratio.
      // The backing store stays 640×360; only the element's CSS size changes.
      // Use integer factors above native size; allow fractional downscale below native.
      const parent = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
      const screenW = parent.width || window.innerWidth;
      const screenH = parent.height || window.innerHeight;
      const fitScale = Math.max(0.1, Math.min(screenW / 640, screenH / 360));
      const scale = fitScale >= 1 ? Math.max(1, Math.floor(fitScale)) : fitScale;
      this.canvas.style.width = `${Math.round(640 * scale)}px`;
      this.canvas.style.height = `${Math.round(360 * scale)}px`;
      this.canvas.style.marginLeft = 'auto';
      this.canvas.style.marginRight = 'auto';
      this.canvas.style.display = 'block';
      this._integerScale = scale;
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
      const scaleX = rect.width / Math.max(1, this.W || this.canvas.width);
      const scaleY = rect.height / Math.max(1, this.H || this.canvas.height);
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
      const p = canvasPoint(this.canvas, event, this.W || this.canvas.width, this.H || this.canvas.height);
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
