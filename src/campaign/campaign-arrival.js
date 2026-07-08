// src/campaign/campaign-arrival.js
// Campaign arrival cinematic: van drives into scene, camera follows, quest 1 begins.
// Part of the Game class composition root — installed via installCampaignArrivalSystem(Game, deps).
//
// Dependencies (passed via deps):
//   CAMPAIGN_START, getCampaignArrivalScene, clamp, CAMERA_EDGE_VIEWPORT_PADDING_RATIO.

import { clamp } from '../utils.js';

export function installCampaignArrivalSystem(Game, deps) {
  const {
    CAMPAIGN_START,
    getCampaignArrivalScene,
    CAMERA_EDGE_VIEWPORT_PADDING_RATIO
  } = deps;

  Object.assign(Game.prototype, {
    beginCampaignArrival() {
      const scene = getCampaignArrivalScene();
      if (!scene) return null;
      const points = scene.path || [];
      if (points.length >= 2) {
        const start = this.sampleCampaignArrivalPath(points, 0);
        const zoom = this.camera.zoom || 1;
        const viewW = this.W / zoom;
        const viewH = this.H / zoom;
        this.camera.x = clamp(start.x - viewW / 2, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
        this.camera.y = clamp(start.y - viewH / 2, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
      }
      this.campaignArrival = {
        active: true,
        sceneId: scene.id,
        startedAt: performance.now(),
        durationMs: scene.durationMs || 4600
      };
      this.setPaused(true);
      return this.campaignArrival;
    },

    updateCampaignArrivalState(now = performance.now()) {
      if (!this.campaignArrival?.active) return null;
      const scene = getCampaignArrivalScene(this.campaignArrival.sceneId);
      const durationMs = Math.max(1, Number(this.campaignArrival.durationMs || scene?.durationMs || 4600));
      const startedAt = Number(this.campaignArrival.startedAt || now);
      const progress = clamp((now - startedAt) / durationMs, 0, 1);
      this.campaignArrival.progress = progress;
      const points = scene?.path || [];
      if (points.length >= 2) {
        const state = this.sampleCampaignArrivalPath(points, progress);
        const zoom = this.camera.zoom || 1;
        const viewW = this.W / zoom;
        const viewH = this.H / zoom;
        const leadX = Number(scene?.cameraFollow?.offsetX || 0);
        const leadY = Number(scene?.cameraFollow?.offsetY || 0);
        const targetX = clamp(state.x - (viewW / 2) + leadX, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
        const targetY = clamp(state.y - (viewH / 2) + leadY, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
        const smoothing = clamp(Number(scene?.cameraFollow?.smoothing ?? 0.14), 0.01, 1);
        this.camera.x += (targetX - this.camera.x) * smoothing;
        this.camera.y += (targetY - this.camera.y) * smoothing;
      }
      if (progress >= 1) {
        this.campaignArrival.active = false;
        this.campaignArrival.completedAt = now;
        const zoom = this.camera.zoom || 1;
        const viewW = this.W / zoom;
        const viewH = this.H / zoom;
        this.camera.x = clamp(CAMPAIGN_START.x - viewW / 2, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
        this.camera.y = clamp(CAMPAIGN_START.y - viewH / 2, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
        // Van arrival: no longer drops the assembler automatically.
        // The van is now the interactable "unpack" progression gate.
        // Quest 1 begins on arrival — prompt the player to unpack the van.
        if (!this.campaignArrival.arrivalDialogueShown) {
          this.campaignArrival.arrivalDialogueShown = true;
          this.queueDialogue('arrival_1');
          // Start quest 1 after a short delay (let arrival dialogue show first)
          const self = this;
          setTimeout(() => {
            if (self.campaignQuest?.active && self.campaignQuest.currentQuest === 1 && !self.campaignQuest.completedQuests.includes(1)) {
              self.queueDialogue('quest1_van_prompt');
            }
          }, 3500);
        }
        this.setPaused(false);
      }
      return this.campaignArrival;
    },

    sampleCampaignArrivalPath(points, progress) {
      const segments = [];
      let total = 0;
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        if (!a || !b) continue;
        const ax = a.x ?? a[0] ?? 0;
        const ay = a.y ?? a[1] ?? 0;
        const bx = b.x ?? b[0] ?? 0;
        const by = b.y ?? b[1] ?? 0;
        const length = Math.hypot(bx - ax, by - ay);
        if (length <= 0) continue;
        segments.push({ ax, ay, bx, by, length, angle: Math.atan2(by - ay, bx - ax) });
        total += length;
      }
      if (!segments.length || total <= 0) {
        const first = points[0] || {};
        return { x: first.x ?? first[0] ?? 0, y: first.y ?? first[1] ?? 0, angle: 0 };
      }
      const target = total * clamp(progress, 0, 1);
      let traveled = 0;
      for (const segment of segments) {
        const next = traveled + segment.length;
        if (target <= next) {
          const local = segment.length ? (target - traveled) / segment.length : 0;
          return {
            x: segment.ax + ((segment.bx - segment.ax) * local),
            y: segment.ay + ((segment.by - segment.ay) * local),
            angle: segment.angle
          };
        }
        traveled = next;
      }
      const last = segments[segments.length - 1];
      return { x: last.bx, y: last.by, angle: last.angle };
    }
  });
}
