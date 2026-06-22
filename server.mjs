import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const sessions = new Map();
let boundPort = null;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    port: boundPort,
    sessions: sessions.size
  });
});

app.get('/api/multiplayer/sessions/:id/save', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.multiplayer.json"`);
  res.end(JSON.stringify({ schema: 'orchestrator-grove-multiplayer-session-v1', exportedAt: new Date().toISOString(), session }, null, 2));
});

io.on('connection', socket => {
  socket.on('session:create', ({ sessionId, playerId = 'p1', state }) => {
    if (!sessionId) return socket.emit('session:error', { message: 'missing sessionId' });
    const session = sessions.get(sessionId) || { sessionId, players: {}, states: {}, createdAt: new Date().toISOString() };
    session.players[playerId] = socket.id;
    session.states[playerId] = state;
    sessions.set(sessionId, session);
    socket.join(sessionId);
    socket.data.sessionId = sessionId;
    socket.data.playerId = playerId;
    socket.emit('session:state', { sessionId, state });
  });

  socket.on('session:join', ({ sessionId, playerId = 'p2', state }) => {
    if (!sessionId) return socket.emit('session:error', { message: 'missing sessionId' });
    const session = sessions.get(sessionId) || { sessionId, players: {}, states: {}, createdAt: new Date().toISOString() };
    session.players[playerId] = socket.id;
    session.states[playerId] = state;
    sessions.set(sessionId, session);
    socket.join(sessionId);
    socket.data.sessionId = sessionId;
    socket.data.playerId = playerId;
    for (const remote of Object.values(session.states)) socket.emit('session:state', { sessionId, state: remote });
    socket.to(sessionId).emit('session:state', { sessionId, state });
  });

  socket.on('player:update', state => {
    const sessionId = state?.sessionId || socket.data.sessionId;
    const playerId = state?.playerId || socket.data.playerId;
    if (!sessionId || !playerId) return;
    const session = sessions.get(sessionId) || { sessionId, players: {}, states: {}, createdAt: new Date().toISOString() };
    session.players[playerId] = socket.id;
    session.states[playerId] = { ...state, sessionId, playerId };
    sessions.set(sessionId, session);
    socket.to(sessionId).emit('player:update', session.states[playerId]);
  });

  socket.on('disconnect', () => {
    const { sessionId, playerId } = socket.data || {};
    if (sessionId && playerId) socket.to(sessionId).emit('player:update', { sessionId, playerId, disconnected: true });
  });
});

const defaultPort = 8097;
const configuredPort = process.env.PORT ? Number(process.env.PORT) : null;

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = error => {
      server.off('error', onError);
      reject(error);
    };

    server.once('error', onError);
    server.listen(port, () => {
      server.off('error', onError);
      boundPort = port;
      resolve(port);
    });
  });
}

async function start() {
  if (configuredPort) {
    try {
      const port = await listen(configuredPort);
      console.log(`Orchestrator Grove multiplayer server listening on http://127.0.0.1:${port}`);
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${configuredPort} is already in use. Stop the process using it or start with a different PORT.`);
        process.exit(1);
      }
      throw error;
    }
    return;
  }

  for (let port = defaultPort; port < defaultPort + 20; port += 1) {
    try {
      await listen(port);
      if (port !== defaultPort) {
        console.warn(`Port ${defaultPort} was busy; using ${port} instead.`);
      }
      console.log(`Orchestrator Grove multiplayer server listening on http://127.0.0.1:${port}`);
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }

  console.error(`No free port found in the range ${defaultPort}-${defaultPort + 19}. Set PORT manually and try again.`);
  process.exit(1);
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
