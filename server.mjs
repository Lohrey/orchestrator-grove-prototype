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

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

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

const port = Number(process.env.PORT || 8097);
server.listen(port, () => console.log(`Orchestrator Grove multiplayer server listening on http://127.0.0.1:${port}`));
