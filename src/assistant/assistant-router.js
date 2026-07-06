import {
  createSemanticCatalogFingerprint,
  SEMANTIC_ROUTER_AMBIGUITY_GAP,
  SEMANTIC_ROUTER_STORAGE_KEY,
  SEMANTIC_ROUTER_THRESHOLD
} from './semantic-router.js';

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function readSemanticRouterState() {
  const raw = storageGet(SEMANTIC_ROUTER_STORAGE_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function writeSemanticRouterState(state) {
  return storageSet(SEMANTIC_ROUTER_STORAGE_KEY, JSON.stringify(state || {}));
}

export function createAssistantSemanticRouter({
  workerUrl = new URL('./assistant-router.worker.js', import.meta.url),
  threshold = SEMANTIC_ROUTER_THRESHOLD,
  ambiguityGap = SEMANTIC_ROUTER_AMBIGUITY_GAP,
  maxPacks = 3
} = {}) {
  let worker = null;
  let ready = false;
  let destroyed = false;
  let messageSeq = 0;
  let initFingerprint = '';
  let initPromise = null;
  let routePromise = null;
  let trainPromise = null;
  let lastRoute = null;
  let lastStatus = {
    ready: false,
    mode: 'disabled',
    status: 'Semantic router not initialized yet.',
    profileCount: 0
  };
  const pending = new Map();
  const listeners = new Set();
  let memory = readSemanticRouterState();

  const notify = () => {
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  };

  function getState() {
    return {
      ready,
      destroyed,
      ...lastStatus,
      lastRoute
    };
  }

  function onStateChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function ensureWorker() {
    if (destroyed) throw new Error('Semantic router has been destroyed');
    if (worker) return worker;
    worker = new Worker(workerUrl, { type: 'module' });
    worker.onmessage = event => {
      const { type, payload = {} } = event.data || {};
      if (type === 'READY') {
        ready = true;
        lastStatus = {
          ready: true,
          mode: payload.mode || lastStatus.mode,
          status: payload.status || lastStatus.status,
          profileCount: payload.profileCount ?? lastStatus.profileCount
        };
        notify();
        if (payload.id && pending.has(payload.id)) {
          const pendingRequest = pending.get(payload.id);
          pending.delete(payload.id);
          pendingRequest.resolve(payload);
        }
        return;
      }
      if (type === 'ROUTE_RESULT') {
        lastRoute = payload.route || null;
        notify();
        const pendingRequest = pending.get(payload.id);
        if (pendingRequest) {
          pending.delete(payload.id);
          pendingRequest.resolve(payload.route);
        }
        return;
      }
      if (type === 'TRAIN_RESULT') {
        if (payload?.result?.memory) {
          memory = payload.result.memory;
          writeSemanticRouterState(memory);
        }
        const pendingRequest = pending.get(payload.id);
        if (pendingRequest) {
          pending.delete(payload.id);
          pendingRequest.resolve(payload.result);
        }
        notify();
        return;
      }
      if (type === 'STATE') {
        const pendingRequest = pending.get(payload.id);
        if (pendingRequest) {
          pending.delete(payload.id);
          pendingRequest.resolve(payload.state);
        }
        return;
      }
      if (type === 'ERROR') {
        const pendingRequest = pending.get(payload.id);
        if (pendingRequest) {
          pending.delete(payload.id);
          pendingRequest.reject(new Error(payload.error || 'Semantic router worker error'));
          return;
        }
        lastStatus = { ...lastStatus, status: payload.error || lastStatus.status };
        notify();
      }
    };
    worker.onerror = error => {
      lastStatus = { ...lastStatus, ready: false, status: error.message || 'Semantic router worker error' };
      ready = false;
      const err = new Error(error.message || 'Semantic router worker error');
      for (const [key, pendingRequest] of pending.entries()) {
        pendingRequest.reject(err);
        pending.delete(key);
      }
      notify();
    };
    lastStatus = { ...lastStatus, status: 'Semantic router worker starting...' };
    notify();
    return worker;
  }

  function post(type, payload = {}) {
    const target = ensureWorker();
    const id = ++messageSeq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      target.postMessage({ id, type, payload });
    });
  }

  async function syncCatalog(knowledgePacks = {}, loadout = []) {
    const nextFingerprint = createSemanticCatalogFingerprint(knowledgePacks, loadout);
    if (initPromise && nextFingerprint === initFingerprint) return initPromise;
    initFingerprint = nextFingerprint;
    const target = ensureWorker();
    const payload = { knowledgePacks, loadout, memory };
    initPromise = new Promise((resolve, reject) => {
      const id = ++messageSeq;
      pending.set(id, {
        resolve: response => resolve(response),
        reject: error => reject(error)
      });
      target.postMessage({ id, type: 'INIT', payload });
    }).finally(() => {
      initPromise = null;
    });
    return initPromise;
  }

  async function route(text, { knowledgePacks = {}, loadout = [] } = {}) {
    await syncCatalog(knowledgePacks, loadout);
    routePromise = post('ROUTE', { text, knowledgePacks, loadout, threshold, ambiguityGap, maxPacks });
    try {
      return await routePromise;
    } finally {
      routePromise = null;
    }
  }

  async function train(text, packId, { knowledgePacks = {}, loadout = [] } = {}) {
    await syncCatalog(knowledgePacks, loadout);
    trainPromise = post('TRAIN', { text, packId, knowledgePacks, loadout });
    try {
      return await trainPromise;
    } finally {
      trainPromise = null;
    }
  }

  async function exportState() {
    await syncCatalog({}, []);
    return post('EXPORT_STATE', {});
  }

  async function importState(state = {}) {
    memory = state && typeof state === 'object' ? state : {};
    writeSemanticRouterState(memory);
    await syncCatalog({}, []);
    return post('IMPORT_STATE', { state: memory });
  }

  function getLastRoute() {
    return lastRoute;
  }

  function getStatus() {
    return getState();
  }

  function destroy() {
    destroyed = true;
    ready = false;
    lastStatus = { ready: false, mode: 'disabled', status: 'Semantic router destroyed.', profileCount: 0 };
    if (worker) {
      try { worker.terminate(); } catch {
        // ignore terminate failures
      }
    }
    worker = null;
    pending.clear();
    notify();
  }

  return {
    syncCatalog,
    route,
    train,
    exportState,
    importState,
    getState,
    getStatus,
    getLastRoute,
    onStateChange,
    destroy
  };
}
