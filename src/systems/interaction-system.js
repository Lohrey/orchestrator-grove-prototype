// src/systems/interaction-system.js
// Canvas event binding, tap/context handling, hover detection, and context menus.
// Part of the Game class composition root — installed via installInteractionSystem(Game, deps).

import { distXY, escapeHtml, canvasPoint } from '../utils.js?v=20260613-player-tools';

export function installInteractionSystem(Game, deps) {
  const {
    CAMERA_WHEEL_SENSITIVITY,
    STORAGE_STRUCTURE_TYPES,
    isBuildingKitItemType,
    itemLabel,
    BUILDING_TYPES
  } = deps;

  Object.assign(Game.prototype, {
    handleCanvasTap(p, { allowMoveOnEmpty = false } = {}) {
      Object.assign(this.mouse, p);
      if (this.player?.dead) { this.respawnPlayer(); return true; }
      if (this.justDraggedZone) { this.justDraggedZone = false; return true; }
      if (this.justDrewZone) { this.justDrewZone = false; return true; }
      if (this.zoneDraft?.active) return true;
      if (this.placementType) { this.placeStructure(this.placementType, p.x, p.y); return true; }
      if (this.teachLocationEdit) { if (this.applyTeachLocationSelection(p.x, p.y)) return true; }
      this.hideMenus();
      const bot = this.botAt(p.x, p.y);
      if (bot) {
        if (this.isDogBot(bot)) { this.showDogPopup(bot, bot.inventory ? 'reward' : 'progress'); return true; }
        this.showBotMenu(bot, p.clientX, p.clientY, { refreshEdit: true });
        return true;
      }
      const s = this.structureAt(p.x, p.y); if (s) { this.showStructureMenu(s, p.clientX, p.clientY); return true; }
      const tree = this.treeAt(p.x, p.y); if (tree) { this.showTreeMenu(tree, p.clientX, p.clientY); return true; }
      const hole = this.holeAt(p.x, p.y); if (hole) { this.showHoleMenu(hole, p.clientX, p.clientY); return true; }
      const z = this.zoneAt(p.x, p.y); if (z) { this.showZoneMenu(z, p.clientX, p.clientY); return true; }
      if (allowMoveOnEmpty) { this.setPlayerDestination(p.x, p.y); return true; }
      return false;
    },
    handleCanvasContextAction(p) {
      Object.assign(this.mouse, p);
      if (this.zoneDraft?.active) return true;
      if (this.placementType) { this.cancelPlacement(); return true; }
      if (this.teachLocationEdit) { if (this.applyTeachLocationSelection(p.x, p.y)) return true; }
      this.hideMenus();
      const append = this.keys.has('shift');
      const friendlyBot = this.botAt(p.x, p.y);
      if (friendlyBot && !this.isHostileTarget(friendlyBot)) {
        if (this.isDogBot(friendlyBot)) { this.showDogPopup(friendlyBot, friendlyBot.inventory ? 'reward' : 'progress'); return true; }
        this.showBotMenu(friendlyBot, p.clientX, p.clientY, { refreshEdit: true });
        return true;
      }
      const attackTarget = this.attackTargetAt(p.x, p.y); if (attackTarget && this.queuePlayerAttackTarget(attackTarget, { append })) return true;
      const item = this.itemAt(p.x, p.y);
      if (item) return isBuildingKitItemType(item.type) ? (this.showBuildingKitItemMenu(item, p.clientX, p.clientY), true) : this.queuePlayerItemPickup(item, { append });
      const s = this.structureAt(p.x, p.y);
      if (s) {
        if (this.queuePlayerDemolishStructure(s, { append })) return true;
        if (STORAGE_STRUCTURE_TYPES.includes(s.type)) return this.queuePlayerPaletteInteraction(s, { append });
        if (this.queuePlayerThroneAttack(s, { append })) return true;
        return this.queuePlayerStructureDeposit(s, { append }) || (this.showStructureMenu(s, p.clientX, p.clientY), true);
      }
      const hole = this.holeAt(p.x, p.y); if (hole) { if (this.player.inventory?.type === 'tree_seed' && this.queuePlayerPlantSeedAtHole(hole, { append })) return true; this.showHoleMenu(hole, p.clientX, p.clientY); return true; }
      const hemp = this.hempAt(p.x, p.y); if (hemp && this.queuePlayerHempAction(hemp, { append })) return true;
      const tree = this.treeAt(p.x, p.y);
      if (tree) {
        if (this.player.inventory?.type === 'crude_axe' && this.queuePlayerResourceAction(tree, 'chop_tree', { append })) return true;
        if (!this.player.inventory && this.queuePlayerTreeSearch(tree)) return true;
        this.showTreeMenu(tree, p.clientX, p.clientY);
        return true;
      }
      const rock = this.rockAt(p.x, p.y); if (rock && this.queuePlayerStoneMining(rock, { append })) return true;
      if (this.queuePlayerDeployHeldKit(p.x, p.y, { append })) return true;
      this.setPlayerDestination(p.x, p.y, {}, { append });
      return true;
    },
    bindCanvas() {
      this.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const p = canvasPoint(this.canvas, e);
        Object.assign(this.mouse, { ...p, screenX: p.x, screenY: p.y });
        const factor = Math.exp(-e.deltaY * CAMERA_WHEEL_SENSITIVITY);
        this.setCameraZoom((this.camera.zoom || 1) * factor, p.x, p.y);
      }, { passive: false });
      this.canvas.addEventListener('mousemove', e => {
        Object.assign(this.mouse, this.canvasToWorld(e));
        if (this.zoneResize?.active) {
          const d = this.zoneResize;
          this.resizeZoneFromPointer(d, this.mouse.x, this.mouse.y);
          d.moved = d.moved || distXY(this.mouse.x, this.mouse.y, d.startMouseX, d.startMouseY) > 2;
          this.updateHover();
          e.preventDefault();
          return;
        }
        if (this.zoneDrag?.active) {
          const d = this.zoneDrag;
          this.moveZoneFromPointer(d, this.mouse.x, this.mouse.y);
          const pt = this.zoneAnchorPoint(d.zone);
          d.moved = d.moved || distXY(pt.x, pt.y, d.startAnchorX, d.startAnchorY) > 2;
          this.updateHover();
          e.preventDefault();
          return;
        }
        if (this.zoneDraft?.active && this.zoneDraft.started) {
          this.zoneDraft.x2 = this.mouse.x; this.zoneDraft.y2 = this.mouse.y;
          if (this.zoneDraft.kind === 'radius') this.zoneDraft.radius = Math.max(8, distXY(this.zoneDraft.x1, this.zoneDraft.y1, this.mouse.x, this.mouse.y));
        }
        this.updateHover();
      });
      this.canvas.addEventListener('mouseleave', () => { this.finishZoneResize(); this.finishZoneDrag(); this.mouse.hoverBot = null; this.mouse.hoverStructure = null; this.mouse.hoverMonster = null; this.mouse.hoverTree = null; this.mouse.hoverHole = null; this.mouse.hoverItem = null; this.mouse.hoverHemp = null; this.mouse.hoverZone = null; this.canvas.style.cursor = 'default'; });
      this.canvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const chatRectMode = !this.zoneDraft?.active && !this.placementType && this.isChatActive?.();
        const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
        if (!this.zoneDraft?.active && !this.placementType && !this.teachLocationEdit) {
          const resizeHit = this.zoneResizeHandleAt(p.x, p.y);
          if (resizeHit) {
            this.zoneResize = { active: true, zone: resizeHit.zone, handle: resizeHit.handle, startMouseX: p.x, startMouseY: p.y, startBounds: this.zoneBounds(resizeHit.zone), moved: false };
            this.hideMenus();
            e.preventDefault();
            return;
          }
          const z = this.zoneAt(p.x, p.y);
          if (z && !z.builtIn) {
            const b = this.zoneBounds(z);
            this.zoneDrag = { active: true, zone: z, offsetX: p.x - b.x, offsetY: p.y - b.y, startAnchorX: b.x, startAnchorY: b.y, moved: false };
            this.hideMenus();
            e.preventDefault();
            return;
          }
        }
        if (!this.zoneDraft?.active && !chatRectMode) return;
        if (chatRectMode) this.zoneDraft = { active: true, started: false, x1: 0, y1: 0, x2: 0, y2: 0, fromChatDrag: true };
        this.zoneDraft.started = true; this.zoneDraft.x1 = p.x; this.zoneDraft.y1 = p.y; this.zoneDraft.x2 = p.x; this.zoneDraft.y2 = p.y;
        e.preventDefault();
      });
      this.canvas.addEventListener('mouseup', e => {
        if (this.zoneResize?.active && e.button === 0) {
          const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
          this.finishZoneResize();
          e.preventDefault();
          return;
        }
        if (this.zoneDrag?.active && e.button === 0) {
          const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
          this.finishZoneDrag();
          e.preventDefault();
          return;
        }
        if (!this.zoneDraft?.active || !this.zoneDraft.started || e.button !== 0) return;
        const p = this.canvasToWorld(e); this.zoneDraft.x2 = p.x; this.zoneDraft.y2 = p.y;
        const zone = this.finishZoneDrawing();
        if (zone && ['draw_zone', 'draw_radius'].includes(this.teachLocationEdit?.mode)) this.applyTeachZoneToStep(zone);
        else if (zone) this.chat.insertAtCursor(this.zoneText(zone));
        this.justDrewZone = Boolean(zone);
        e.preventDefault();
      });

      const touchPointers = new Map();
      let longPressTimer = 0;
      let longPressFired = false;
      let activeTouchGesture = null;
      const clearLongPress = () => { clearTimeout(longPressTimer); longPressTimer = 0; };
      const touchPointFromEvent = event => {
        const p = this.canvasToWorld(event);
        return { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, screenX: p.screenX, screenY: p.screenY, x: p.x, y: p.y };
      };
      const startLongPress = pointerId => {
        clearLongPress();
        longPressFired = false;
        longPressTimer = setTimeout(() => {
          const entry = touchPointers.get(pointerId);
          if (!entry || activeTouchGesture?.pinching || entry.panned || entry.moved) return;
          longPressFired = true;
          this.suppressNextClick = true;
          this.handleCanvasContextAction({ clientX: entry.clientX, clientY: entry.clientY, screenX: entry.screenX, screenY: entry.screenY, x: entry.x, y: entry.y });
        }, 560);
      };
      const pinchMetrics = () => {
        const pts = [...touchPointers.values()];
        if (pts.length < 2) return null;
        const a = pts[0], b = pts[1];
        return {
          distance: Math.max(1, Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY)),
          centerX: (a.screenX + b.screenX) / 2,
          centerY: (a.screenY + b.screenY) / 2
        };
      };
      const beginPinch = () => {
        const metrics = pinchMetrics();
        if (!metrics) return;
        clearLongPress();
        activeTouchGesture = { pinching: true, startDistance: metrics.distance, startZoom: this.camera.zoom || 1, lastCenterX: metrics.centerX, lastCenterY: metrics.centerY };
      };
      this.canvas.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        e.preventDefault();
        try { this.canvas.setPointerCapture?.(e.pointerId); } catch {}
        const p = touchPointFromEvent(e);
        touchPointers.set(e.pointerId, { ...p, startScreenX: p.screenX, startScreenY: p.screenY, lastScreenX: p.screenX, lastScreenY: p.screenY, moved: false, panned: false });
        Object.assign(this.mouse, p);
        this.updateHover();
        if (touchPointers.size >= 2) beginPinch();
        else {
          activeTouchGesture = { pinching: false, panning: false };
          startLongPress(e.pointerId);
        }
      }, { passive: false });
      this.canvas.addEventListener('pointermove', e => {
        if (!touchPointers.has(e.pointerId)) return;
        e.preventDefault();
        const p = touchPointFromEvent(e);
        const entry = touchPointers.get(e.pointerId);
        const dx = p.screenX - entry.lastScreenX;
        const dy = p.screenY - entry.lastScreenY;
        const movedFromStart = Math.hypot(p.screenX - entry.startScreenX, p.screenY - entry.startScreenY);
        Object.assign(entry, p, { moved: entry.moved || movedFromStart > 8 });
        Object.assign(this.mouse, p);
        if (touchPointers.size >= 2) {
          if (!activeTouchGesture?.pinching) beginPinch();
          const metrics = pinchMetrics();
          if (metrics && activeTouchGesture?.pinching) {
            const ratio = metrics.distance / activeTouchGesture.startDistance;
            this.setCameraZoom(activeTouchGesture.startZoom * ratio, metrics.centerX, metrics.centerY);
            this.camera.x -= (metrics.centerX - activeTouchGesture.lastCenterX) / (this.camera.zoom || 1);
            this.camera.y -= (metrics.centerY - activeTouchGesture.lastCenterY) / (this.camera.zoom || 1);
            this.clampCamera();
            activeTouchGesture.lastCenterX = metrics.centerX;
            activeTouchGesture.lastCenterY = metrics.centerY;
            this.refreshMouseWorld();
            this.updateHover();
          }
          return;
        }
        if (entry.moved) clearLongPress();
        if (entry.moved && !longPressFired && !this.zoneDraft?.active && !this.placementType) {
          activeTouchGesture = { pinching: false, panning: true };
          entry.panned = true;
          this.camera.x -= dx / (this.camera.zoom || 1);
          this.camera.y -= dy / (this.camera.zoom || 1);
          this.clampCamera();
          this.refreshMouseWorld();
          this.updateHover();
        }
        entry.lastScreenX = p.screenX;
        entry.lastScreenY = p.screenY;
      }, { passive: false });
      const finishTouchPointer = e => {
        const entry = touchPointers.get(e.pointerId);
        if (!entry) return;
        e.preventDefault();
        clearLongPress();
        const wasPinching = !!activeTouchGesture?.pinching || touchPointers.size > 1;
        const p = touchPointFromEvent(e);
        touchPointers.delete(e.pointerId);
        try { this.canvas.releasePointerCapture?.(e.pointerId); } catch {}
        if (wasPinching) {
          this.suppressNextClick = true;
          activeTouchGesture = touchPointers.size >= 2 ? activeTouchGesture : null;
          if (touchPointers.size >= 2) beginPinch();
          return;
        }
        if (!longPressFired && !entry.panned && !entry.moved) {
          this.suppressNextClick = true;
          this.handleCanvasTap(p, { allowMoveOnEmpty: true });
        } else {
          this.suppressNextClick = true;
        }
        longPressFired = false;
        activeTouchGesture = null;
      };
      this.canvas.addEventListener('pointerup', finishTouchPointer, { passive: false });
      this.canvas.addEventListener('pointercancel', e => {
        if (!touchPointers.has(e.pointerId)) return;
        e.preventDefault();
        clearLongPress();
        touchPointers.delete(e.pointerId);
        longPressFired = false;
        activeTouchGesture = null;
        this.suppressNextClick = true;
      }, { passive: false });
      this.canvas.addEventListener('click', e => {
        if (this.suppressNextClick) { this.suppressNextClick = false; e.preventDefault(); return; }
        if (this.player?.dead && typeof this.respawnPlayer === 'function') { this.respawnPlayer(); e.preventDefault(); return; }
        const p = this.canvasToWorld(e);
        this.handleCanvasTap(p, { allowMoveOnEmpty: false });
      });
      this.canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        const p = this.canvasToWorld(e);
        this.handleCanvasContextAction(p);
      });
    },
    finishZoneDrag() {
      const d = this.zoneDrag;
      if (!d?.active) return null;
      this.zoneDrag = null;
      this.justDraggedZone = Boolean(d.moved);
      if (d.moved) {
        this.syncZonesUi();
        const p = this.zoneAnchorPoint(d.zone);
        this.addFloat(`Moved ${d.zone.name}`, p.x, p.y - 8, '#d3a95f');
        this.updateHover();
      }
      return d.zone;
    },
    finishZoneResize() {
      const d = this.zoneResize;
      if (!d?.active) return null;
      this.zoneResize = null;
      this.justDraggedZone = Boolean(d.moved);
      if (d.moved) {
        this.syncZonesUi();
        const p = this.zoneAnchorPoint(d.zone);
        this.addFloat(`Resized ${d.zone.name}`, p.x, p.y - 8, '#d3a95f');
        this.updateHover();
      }
      return d.zone;
    },
    updateHover() {
      this.mouse.hoverBot = this.botAt(this.mouse.x, this.mouse.y);
      this.mouse.hoverStructure = !this.mouse.hoverBot ? this.structureAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverMonster = !this.mouse.hoverBot && !this.mouse.hoverStructure ? this.monsterAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverItem = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster ? this.itemAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverTree = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster && !this.mouse.hoverItem ? this.treeAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverRock = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster && !this.mouse.hoverTree && !this.mouse.hoverItem ? this.rockAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverHole = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster && !this.mouse.hoverTree && !this.mouse.hoverRock && !this.mouse.hoverItem ? this.holeAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverHemp = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster && !this.mouse.hoverTree && !this.mouse.hoverRock && !this.mouse.hoverHole && !this.mouse.hoverItem ? this.hempAt(this.mouse.x, this.mouse.y) : null;
      this.mouse.hoverZone = !this.mouse.hoverStructure && !this.mouse.hoverBot && !this.mouse.hoverMonster && !this.mouse.hoverTree && !this.mouse.hoverRock && !this.mouse.hoverHole && !this.mouse.hoverItem && !this.mouse.hoverHemp ? this.zoneAt(this.mouse.x, this.mouse.y) : null;
      const resizeHit = !this.zoneDraft?.active && !this.placementType ? this.zoneResizeHandleAt(this.mouse.x, this.mouse.y) : null;
      this.canvas.style.cursor = this.zoneDraft?.active || this.placementType ? 'crosshair' : (this.zoneResize?.active ? 'nwse-resize' : (this.zoneDrag?.active ? 'grabbing' : (resizeHit ? (resizeHit.handle === 'e' ? 'ew-resize' : 'nwse-resize') : (this.mouse.hoverBot || this.mouse.hoverStructure || this.mouse.hoverMonster || this.mouse.hoverTree || this.mouse.hoverRock || this.mouse.hoverHole || this.mouse.hoverItem || this.mouse.hoverHemp || this.mouse.hoverZone ? 'pointer' : 'default'))));
    },
    placeMenu(el,x,y) { this.hideMenus(); el.style.left=`${Math.min(x, window.innerWidth-310)}px`; el.style.top=`${Math.min(y, window.innerHeight-260)}px`; el.hidden=false; },
  });
}
