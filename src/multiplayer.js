const SESSION_PREFIX = 'grove-mp';

function randomSessionId() {
  return `${SESSION_PREFIX}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeUrl(pathAndQuery) {
  try { return new URL(pathAndQuery, window.location.href).href; }
  catch { return pathAndQuery; }
}

async function loadSocketIoClient() {
  if (window.io) return window.io;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('socket.io client not available; run npm start for live multiplayer'));
    document.head.appendChild(script);
  });
  return window.io;
}

export function createMultiplayerController({ game, dom, addChat }) {
  const state = { socket: null, sessionId: null, playerId: 'p1', role: 'solo', connected: false };

  function setStatus(text) {
    if (dom.multiplayerStatus) dom.multiplayerStatus.textContent = text;
    if (game.multiplayer) game.multiplayer.status = text;
  }

  function setSessionLink(sessionId, mode = 'host') {
    if (!dom.multiplayerSessionLink) return;
    const href = safeUrl(`index.html?multiplayer=${mode}&session=${encodeURIComponent(sessionId)}`);
    dom.multiplayerSessionLink.href = href;
    dom.multiplayerSessionLink.textContent = href;
    dom.multiplayerSessionLink.hidden = false;
  }

  function startLocalSession({ role, sessionId, playerId }) {
    state.sessionId = sessionId;
    state.playerId = playerId;
    state.role = role;
    const snapshot = game.startMultiplayerSession({ sessionId, role, playerId });
    window.multiplayerDebug = api;
    setStatus(`${role === 'host' ? 'Hosting' : 'Joined'} ${sessionId} as ${playerId}. Socket pending.`);
    setSessionLink(sessionId, role === 'host' ? 'client' : 'host');
    return snapshot;
  }

  async function connectSocket() {
    if (!state.sessionId || state.socket) return state.socket;
    try {
      const io = await loadSocketIoClient();
      const socket = io({ transports: ['websocket', 'polling'] });
      state.socket = socket;
      socket.on('connect', () => {
        state.connected = true;
        socket.emit(state.role === 'host' ? 'session:create' : 'session:join', { sessionId: state.sessionId, playerId: state.playerId, state: game.getLocalPlayerNetState() });
        setStatus(`Socket connected · ${state.sessionId} · ${state.playerId}`);
      });
      socket.on('session:state', payload => game.applyRemoteMultiplayerState(payload?.state || payload));
      socket.on('player:update', payload => game.applyRemoteMultiplayerState(payload));
      socket.on('session:error', err => setStatus(`Socket error: ${err?.message || err}`));
      socket.on('disconnect', () => { state.connected = false; setStatus(`Socket disconnected · local ${state.sessionId} still playable`); });
      game.onMultiplayerState = payload => socket.connected && socket.emit('player:update', payload);
      return socket;
    } catch (err) {
      setStatus(`${err.message}. Local downloadable session is active.`);
      game.onMultiplayerState = null;
      return null;
    }
  }

  async function hostSession({ openSeparate = false, sessionId = randomSessionId() } = {}) {
    if (openSeparate && !new URLSearchParams(window.location.search).get('multiplayer')) {
      const href = safeUrl(`index.html?multiplayer=host&session=${encodeURIComponent(sessionId)}`);
      setSessionLink(sessionId, 'client');
      const popup = window.open(href, '_blank', 'noopener');
      if (popup) { setStatus(`Opened separate host instance: ${sessionId}`); return { sessionId, opened: true, href }; }
    }
    const snapshot = startLocalSession({ role: 'host', sessionId, playerId: 'p1' });
    await connectSocket();
    addChat?.('system', `Multiplayer host ready. Session <code>${sessionId}</code>. Player 1 starts bottom-left; Player 2 starts top-right. Destroy the enemy throne.`);
    return snapshot;
  }

  async function joinSession(sessionId = dom.multiplayerJoinCode?.value?.trim()) {
    const id = sessionId || randomSessionId();
    const snapshot = startLocalSession({ role: 'client', sessionId: id, playerId: 'p2' });
    await connectSocket();
    addChat?.('system', `Joined multiplayer session <code>${id}</code> as Player 2.`);
    return snapshot;
  }

  function downloadSave() {
    const payload = game.exportMultiplayerSave();
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${payload.session?.sessionId || randomSessionId()}.multiplayer.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    setStatus(`Downloaded ${a.download}`);
    return payload;
  }

  function bind() {
    dom.multiplayerHostBtn?.addEventListener('click', () => hostSession({ openSeparate: true }));
    dom.multiplayerJoinBtn?.addEventListener('click', () => joinSession());
    dom.multiplayerSaveBtn?.addEventListener('click', downloadSave);
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('multiplayer');
    const sessionId = params.get('session') || randomSessionId();
    if (mode === 'host') hostSession({ openSeparate: false, sessionId });
    if (mode === 'client' || mode === 'join') joinSession(sessionId);
  }

  const api = { hostSession, joinSession, downloadSave, connectSocket, get state() { return { ...state }; } };
  bind();
  return api;
}
