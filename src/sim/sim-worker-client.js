const pending = new Map();
let seq = 1;

function request(worker, message, timeoutMs = 4000) {
  const id = seq++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`sim worker timeout for ${message.type}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ ...message, id });
  });
}

export function createSimWorkerClient({ enabled = true } = {}) {
  if (!enabled || !window.Worker) {
    return { enabled: false, ready: false, status: 'disabled', ping: async () => ({ ok: false, disabled: true }), nearestItem: async () => null, pathfind: async query => ({ waypoints: [{ x: query?.tx || 0, y: query?.ty || 0 }], backend: 'disabled-fallback' }), chunkForPoint: async query => ({ cx: 0, cy: 0, key: '0:0', backend: 'disabled-fallback' }), botTick: async query => ({ x: query?.tx || 0, y: query?.ty || 0, arrived: true, backend: 'disabled-fallback' }), destroy() {} };
  }

  const worker = new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' });
  const client = {
    enabled: true,
    ready: false,
    status: 'starting',
    version: null,
    async ping() {
      return request(worker, { type: 'ping' });
    },
    async nearestItem(points, query) {
      return request(worker, { type: 'nearest_item', points, query });
    },
    async pathfind(query) {
      return request(worker, { type: 'pathfind', query });
    },
    async chunkForPoint(query) {
      return request(worker, { type: 'chunk_for_point', query });
    },
    async botTick(query) {
      return request(worker, { type: 'bot_tick', query });
    },
    destroy() {
      worker.terminate();
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
    }
  };

  worker.onmessage = event => {
    const { id, ok, result, error } = event.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error || 'sim worker error'));
  };
  worker.onerror = event => {
    client.status = event.message || 'worker error';
  };

  client.readyPromise = client.ping().then(result => {
    client.ready = true;
    client.status = 'ready';
    client.version = result.version;
    return result;
  }).catch(err => {
    client.ready = false;
    client.status = err.message;
    return { ok: false, error: err.message };
  });

  return client;
}
