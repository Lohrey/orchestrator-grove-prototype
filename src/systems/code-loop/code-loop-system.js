// src/systems/code-loop/code-loop-system.js
// Code Loop system: runs player/AI-authored JavaScript-like bot code inside
// an isolated WebWorker and routes every bot.* call through the existing
// taught-loop / DSL validation chain on the main thread. The main thread
// stays authoritative — bot code never touches the world directly.
//
// Install with installCodeLoopSystem(Game). Exposes:
//   game.createCodeLoopSession({ botId }) -> session
//   game.startCodeLoop(session, code)     -> void
//   game.stopCodeLoop(session)            -> void
//   game.codeLoopSessions                 -> Map of active sessions
//
// Each session binds a bot. Intentions map to existing taught-loop step ops:
//   pickUp   -> pick_up (validates item type via validateDslProgram)
//   deposit  -> deposit_to_structure (resolves target building)
//   moveTo   -> move_to_structure (resolves target building)
//   wait     -> wait
//   findNearest -> query, no state change

import { CODE_LOOP_WORKER_SOURCE } from './code-loop-worker-source.js';

let SESSION_SEQ = 0;

function buildWorkerUrl() {
  const blob = new Blob([CODE_LOOP_WORKER_SOURCE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

function isObject(value) { return value && typeof value === 'object'; }

export function installCodeLoopSystem(Game) {
  Object.assign(Game.prototype, {
    createCodeLoopSession({ botId } = {}) {
      const bot = this.findBot(botId);
      if (!bot) throw new Error(`Bot ${botId} not found`);
      const id = ++SESSION_SEQ;
      const session = {
        id,
        botId: bot.id,
        worker: null,
        running: false,
        status: 'idle',
        lastError: null,
        logs: [],
        onLog: null,
        onError: null,
        onDone: null
      };
      if (!this.codeLoopSessions) this.codeLoopSessions = new Map();
      this.codeLoopSessions.set(id, session);
      return session;
    },

    codeLoopLog(session, message, level = 'log') {
      const entry = { t: Date.now(), level, message: String(message || '') };
      session.logs.push(entry);
      if (session.logs.length > 200) session.logs.shift();
      session.onLog?.(entry);
    },

    startCodeLoop(session, code) {
      if (!session) return;
      if (session.running) this.stopCodeLoop(session);
      const bot = this.findBot(session.botId);
      if (!bot) {
        session.lastError = `Bot ${session.botId} not found`;
        session.onError?.(session.lastError);
        return;
      }
      const workerUrl = buildWorkerUrl();
      let worker;
      try {
        worker = new Worker(workerUrl, { type: 'module' });
      } catch (err) {
        session.lastError = `Failed to spawn Code Loop worker: ${err.message}`;
        session.status = 'error';
        session.onError?.(session.lastError);
        URL.revokeObjectURL(workerUrl);
        return;
      }
      session.worker = worker;
      session.running = true;
      session.status = 'running';
      session.lastError = null;
      session.logs = [];
      worker.onmessage = (e) => this.handleCodeLoopMessage(session, e.data || {});
      worker.onerror = (e) => {
        this.codeLoopLog(session, `Worker fatal: ${e.message || 'unknown error'}`, 'error');
        session.lastError = e.message || 'Worker fatal error';
        session.status = 'error';
        session.running = false;
        session.onError?.(session.lastError);
      };
      // Park the bot under taught_loop with empty steps while code runs so
      // updateBot() does not double-step it. We drive state manually.
      bot.paused = true;
      bot.message = 'Code Loop running.';
      worker.postMessage({ type: 'run', code: String(code || ''), options: {} });
    },

    stopCodeLoop(session) {
      if (!session) return;
      if (session.worker) {
        try { session.worker.terminate(); } catch (_) {}
        session.worker = null;
      }
      session.running = false;
      session.status = 'stopped';
      const bot = this.findBot(session.botId);
      if (bot) {
        bot.paused = false;
        bot.message = 'Code Loop stopped.';
        bot.program = 'idle';
        bot.state = 'idle';
        bot.runtime = { pc: 0, memory: {}, wait: 0 };
        bot.target = null;
        bot.targetItemId = null;
        bot.targetItemPurpose = null;
        bot.targetHoleId = null;
        bot.timer = 0;
      }
    },

    handleCodeLoopMessage(session, msg) {
      const bot = this.findBot(session.botId);
      if (!bot) {
        this.stopCodeLoop(session);
        return;
      }
      switch (msg.type) {
        case 'log':
          this.codeLoopLog(session, msg.message, msg.level || 'log');
          return;
        case 'intention':
          this.fulfillCodeLoopIntention(session, bot, msg)
            .catch(err => {
              this.codeLoopLog(session, `Intention error: ${err.message}`, 'error');
              session.worker?.postMessage({
                type: 'result', id: msg.id,
                error: err.message || 'intention failed'
              });
            });
          return;
        case 'done':
          session.status = 'completed';
          session.running = false;
          session.worker = null;
          bot.paused = false;
          bot.program = 'idle';
          bot.state = 'idle';
          bot.message = 'Code Loop completed.';
          this.codeLoopLog(session, `Code Loop completed (${session.logs.length} log entries).`, 'log');
          session.onDone?.('completed');
          return;
        case 'error':
          session.status = 'error';
          session.lastError = msg.message || 'unknown error';
          session.running = false;
          session.worker = null;
          bot.paused = false;
          bot.program = 'idle';
          bot.state = 'idle';
          bot.message = `Code Loop error: ${session.lastError}`;
          this.codeLoopLog(session, `Error: ${session.lastError}`, 'error');
          if (msg.stack) this.codeLoopLog(session, msg.stack, 'error');
          session.onError?.(session.lastError);
          return;
        default:
          return;
      }
    },

    // Validate an intention against the existing DSL validation chain, then
    // execute it synchronously by reusing the taught-loop step executor.
    // Returns { ok, value } for the worker; throws on validation failure.
    async fulfillCodeLoopIntention(session, bot, msg) {
      const op = String(msg.op || '');
      const args = isObject(msg.args) ? msg.args : {};
      let step;
      if (op === 'pickUp') {
        const type = this.normalizeItemType(args.type, null);
        if (!type) throw new Error(`pickUp: unknown item type "${args.type}"`);
        step = { op: 'pick_up', type };
      } else if (op === 'deposit') {
        const structure = this.resolveCodeLoopStructure(args.target, bot);
        if (!structure) throw new Error(`deposit: target "${args.target}" not found`);
        const heldType = bot.inventory?.type;
        if (!heldType) throw new Error('deposit: bot is not carrying anything');
        step = { op: 'deposit_to_structure', type: heldType, structureId: structure.id, structureName: structure.name };
      } else if (op === 'moveTo') {
        const structure = this.resolveCodeLoopStructure(args.location, bot);
        if (!structure) throw new Error(`moveTo: location "${args.location}" not found`);
        step = { op: 'move_to_structure', structureId: structure.id, structureName: structure.name };
      } else if (op === 'wait') {
        const seconds = Math.max(0.1, Math.min(30, Number(args.seconds) || 1));
        step = { op: 'wait', seconds };
      } else if (op === 'findNearest') {
        // Read-only query — no validation needed, no state change.
        const type = this.normalizeItemType(args.type, null);
        const item = this.nearestItemToBot(bot, type);
        if (item) {
          session.worker?.postMessage({ type: 'result', id: msg.id, value: { type: item.type, x: Math.round(item.x), y: Math.round(item.y), ref: item.ref } });
        } else {
          session.worker?.postMessage({ type: 'result', id: msg.id, value: null });
        }
        return;
      } else {
        throw new Error(`Unknown bot method: bot.${op}`);
      }

      // Validate the synthesized step via the DSL chain. This re-uses the same
      // validation logic the DSL Safe Mode tab uses, so guarantees are shared.
      const checked = this.validateDslProgram({
        id: 'code_loop_step',
        name: 'Code Loop step',
        steps: [step],
        repeat: false
      });
      if (!checked.ok) throw new Error(`Validation failed: ${checked.error}`);

      // Execute the step on the bound bot. We run it by temporarily swapping
      // the bot onto a single-step taught loop and ticking the executor once
      // per frame until it reports completion. We drive this from the normal
      // per-frame bot update loop (see advanceCodeLoopSessions below).
      const prevProgram = bot.program;
      const prevTaught = bot.taughtLoop ? bot.taughtLoop.slice() : null;
      const prevRepeat = bot.taughtLoopRepeat;
      const prevRuntime = { ...bot.runtime };
      bot.program = 'taught_loop';
      bot.state = 'taught_loop';
      bot.paused = false;
      bot.taughtLoop = [step];
      bot.taughtLoopRepeat = false;
      bot.runtime = { pc: 0, memory: {}, wait: 0 };
      bot.target = null;
      bot.targetItemId = null;
      bot.targetItemPurpose = null;
      bot.targetHoleId = null;
      bot.timer = 0;
      // Stash context so the per-frame driver can resolve and restore.
      bot._codeLoopPending = {
        session, msg, prevProgram, prevTaught, prevRepeat, prevRuntime
      };
    },

    resolveCodeLoopStructure(rawRef, bot) {
      const raw = String(rawRef || '').trim();
      if (!raw) return null;
      // "sawbench 2" -> nearest sawbench matching index/name, falls back to first.
      const matchName = (s) => s.name.toLowerCase() === raw.toLowerCase();
      const matchType = (s) => s.type.toLowerCase() === raw.toLowerCase();
      const matchTypeIndex = (s, typeLabel, idx) => s.type.toLowerCase() === typeLabel;
      const byExact = this.structures.find(matchName);
      if (byExact) return byExact;
      const lower = raw.toLowerCase();
      const m = lower.match(/^([a-z_]+)\\s+(\\d+)$/);
      if (m) {
        const typeLabel = m[1];
        const wantIdx = Number(m[2]) - 1;
        const matches = this.structures.filter(s => s.type.toLowerCase() === typeLabel)
          .sort((a, b) => a.id - b.id);
        if (wantIdx >= 0 && wantIdx < matches.length) return matches[wantIdx];
      }
      const byType = this.structures.filter(matchType).sort((a, b) => a.id - b.id);
      if (byType.length) {
        // Closest of that type to bot.
        const d = (bx, by, s) => Math.hypot(bx - s.x, by - s.y);
        byType.sort((a, b) => d(bot.x, bot.y, a) - d(bot.x, bot.y, b));
        return byType[0];
      }
      return null;
    },

    nearestItemToBot(bot, type) {
      if (!type) return null;
      const items = this.items || [];
      let best = null;
      let bestD = Infinity;
      for (const item of items) {
        if (item.type !== type) continue;
        const d = Math.hypot(bot.x - item.x, bot.y - item.y);
        if (d < bestD) { bestD = d; best = item; }
      }
      return best;
    },

    // Called from the main per-frame bot update loop for bots that have a
    // pending Code Loop intention. Steps the synthesised taught-loop step
    // exactly once. When the step completes, posts the result back to worker.
    advanceCodeLoopSessions(dt) {
      if (!this.codeLoopSessions) return;
      for (const session of this.codeLoopSessions.values()) {
        if (!session.running) continue;
        const bot = this.findBot(session.botId);
        if (!bot || !bot._codeLoopPending) continue;
        const pending = bot._codeLoopPending;
        // Run the taught-loop executor for this single pending step.
        const beforePc = bot.runtime.pc;
        const beforeProgram = bot.program;
        try {
          this.programTaughtLoop(bot, dt);
        } catch (err) {
          // Execution error — fail the intention, restore state.
          this.restoreCodeLoopBot(bot, pending);
          this.codeLoopLog(session, `Execution error: ${err.message}`, 'error');
          session.worker?.postMessage({ type: 'result', id: pending.msg.id, error: err.message });
          continue;
        }
        // Completion detection: taught loop flips program to 'idle' when the
        // single step completes (taughtLoopRepeat=false) OR advances pc.
        const completed = bot.program === 'idle' || bot.program !== 'taught_loop' || bot.runtime.pc !== beforePc;
        if (!completed) continue;
        // Step completed successfully.
        this.restoreCodeLoopBot(bot, pending);
        session.worker?.postMessage({ type: 'result', id: pending.msg.id, value: { ok: true } });
      }
    },

    restoreCodeLoopBot(bot, pending) {
      bot._codeLoopPending = null;
      bot.program = pending.prevProgram;
      bot.state = pending.prevProgram;
      bot.taughtLoop = pending.prevTaught;
      bot.taughtLoopRepeat = pending.prevRepeat;
      bot.runtime = { ...pending.prevRuntime, pc: 0, wait: 0 };
      bot.paused = true; // Code Loop owns this bot again
      bot.target = null;
      bot.targetItemId = null;
      bot.targetItemPurpose = null;
      bot.targetHoleId = null;
      bot.timer = 0;
    }
  });
}
