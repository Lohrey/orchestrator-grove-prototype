// src/systems/code-loop/code-loop-worker-source.js
// Source text for the isolated Code Loop WebWorker.
// The worker is spawned from a Blob URL (see code-loop-system.js) so the
// plain-HTML entry point keeps working without a bundler. The worker runs
// untrusted player/AI bot code inside a WebWorker isolate with a minimal
// whitelist `bot` API. Each bot.* call posts an "intention" to the main
// thread and awaits the validated result. The main thread remains
// authoritative: it validates every intention through the existing DSL
// validation chain and executes it through the taught-loop machinery.
//
// Safety model:
//   - Worker isolate: a crash or infinite loop cannot freeze the main thread.
//   - Whitelist API: only bot.pickUp / bot.deposit / bot.moveTo / bot.wait /
//     bot.findNearest are exposed. No direct access to world, game, canvas,
//     DOM, fetch, or globals that matter.
//   - Stop/Kill = worker.terminate() on the main thread (clean, immediate).

export const CODE_LOOP_WORKER_SOURCE = `
"use strict";
let pendingId = 0;
const pending = new Map();

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'result') {
    const resolver = pending.get(msg.id);
    if (resolver) {
      pending.delete(msg.id);
      if (msg.error) resolver.reject(new Error(msg.error));
      else resolver.resolve(msg.value);
    }
    return;
  }
  if (msg.type === 'run') {
    runCode(msg.code, msg.options || {});
    return;
  }
};

function send(op, args, timeoutMs) {
  const id = ++pendingId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    self.postMessage({ type: 'intention', id, op, args });
    const limit = Number(timeoutMs) || 60000;
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('bot.' + op + '() timed out after ' + limit + 'ms (step did not complete)'));
      }
    }, limit);
  });
}

function makeBotApi() {
  return {
    pickUp: (type) => send('pickUp', { type: String(type || '') }),
    deposit: (target) => send('deposit', { target: String(target || '') }),
    moveTo: (location) => send('moveTo', { location: String(location || '') }),
    wait: (seconds) => send('wait', { seconds: Number(seconds) || 1 }),
    findNearest: (type) => send('findNearest', { type: String(type || '') }),
    say: (message) => { self.postMessage({ type: 'log', level: 'log', message: String(message || '') }); }
  };
}

async function runCode(code, options) {
  const bot = makeBotApi();
  self.postMessage({ type: 'log', level: 'log', message: 'Code Loop: started.' });
  try {
    // Wrap player code in an async function scope exposing only the whitelist
    // bot binding. Top-level return exits the loop cleanly.
    const fn = new Function('bot', 'wait', 'findNearest',
      'return (async () => {' + String(code) + '})();');
    await fn(bot, bot.wait.bind(bot), bot.findNearest.bind(bot));
    self.postMessage({ type: 'done', reason: 'completed' });
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    const stack = (err && err.stack) ? String(err.stack) : '';
    self.postMessage({ type: 'error', message, stack });
  }
}
`;
