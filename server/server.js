import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { Room } from './rooms.js';
import { Bucket, cleanName, cleanRoom, validateInput, parseMessage } from './validation.js';
import { executeAction } from '../shared/actions.js';
import { LIMITS, STEP, MSG, PROTOCOL } from '../shared/constants.js';
export function createGameServer(options = {}) {
  const app = express(),
    server = createServer(app),
    rooms = new Map();
  app.disable('x-powered-by');
  const origins = (options.origins || process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  app.use((req, res, next) => {
    if (origins.includes(req.headers.origin)) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Vary', 'Origin');
    }
    next();
  });
  app.get('/api/health', (_, res) =>
    res.json({ name: 'Xmod.io', protocol: PROTOCOL, rooms: rooms.size }),
  );
  app.get('/api/rooms', (_, res) =>
    res.json(
      [...rooms.values()]
        .filter((r) => r.players.size)
        .map((r) => ({
          id: r.id,
          name: r.name,
          players: r.players.size,
          maxPlayers: LIMITS.players,
          props: r.sim.entities.size,
        })),
    ),
  );
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*splat}', (req, res) => {
      if (req.path.startsWith('/api/')) return res.sendStatus(404);
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 8192,
    perMessageDeflate: false,
    verifyClient: (info) => !origins.length || origins.includes(info.origin),
  });
  const sockets = new Set();
  wss.on('connection', (socket, req) => {
    if ([...sockets].filter((s) => s.ip === req.socket.remoteAddress).length >= 24) {
      socket.close(4008, 'Too many connections');
      return;
    }
    socket.ip = req.socket.remoteAddress;
    sockets.add(socket);
    let actor = null,
      room = null;
    const id = randomUUID().slice(0, 12),
      messages = new Bucket(100, 160),
      actions = new Bucket(28, 42),
      spawn = new Bucket(3, 8),
      chat = new Bucket(0.75, 4),
      input = new Bucket(35, 45);
    socket.alive = true;
    const error = (text) => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: MSG.ERROR, message: text }));
    };
    const joinTimer = setTimeout(() => {
      if (!actor) socket.close(4000, 'Join a room first');
    }, 10000);
    socket.on('pong', () => {
      socket.alive = true;
    });
    socket.on('message', (data) => {
      try {
        if (!messages.take()) {
          socket.close(4008, 'Message rate exceeded');
          return;
        }
        const m = parseMessage(data);
        if (m.type === MSG.PING) {
          room?.send(socket, { type: MSG.PONG, ts: m.ts });
          return;
        }
        if (m.type === MSG.JOIN) {
          if (actor) throw new Error('Already in a room');
          if (m.protocol !== PROTOCOL) throw new Error('Protocol mismatch. Refresh the page.');
          const roomId = cleanRoom(m.room || 'lobby'),
            name = cleanName(m.name);
          if (!rooms.has(roomId)) {
            if (rooms.size >= LIMITS.rooms) throw new Error('Room limit reached');
            rooms.set(roomId, new Room(roomId, id));
          }
          room = rooms.get(roomId);
          actor = room.join(id, name, socket);
          clearTimeout(joinTimer);
          return;
        }
        if (!actor) throw new Error('Join a room first');
        if (m.type === MSG.INPUT) {
          if (!input.take()) return;
          actor.input = validateInput(m.input);
          actor.lastInput = performance.now();
          return;
        }
        if (m.type === MSG.CHAT) {
          if (!chat.take()) throw new Error('Slow down the chat');
          if (typeof m.text !== 'string') throw new Error('Invalid chat');
          const text = m.text
            .replace(/[\x00-\x1f\x7f]/g, '')
            .trim()
            .slice(0, 180);
          if (text) room.broadcast({ type: MSG.CHAT, name: actor.name, text });
          return;
        }
        if (m.type === MSG.ACTION) {
          if (!actions.take()) throw new Error('Tool rate limit reached');
          const a = m.action;
          if (!a || typeof a !== 'object') throw new Error('Invalid action');
          if (
            (a.kind === 'spawn' ||
              (a.kind === 'tool' && ['wheel', 'balloon', 'thruster'].includes(a.mode))) &&
            !spawn.take()
          )
            throw new Error('Spawn limit: wait a moment');
          if (a.kind === 'kick') {
            if (!actor.admin) throw new Error('Only the room owner can kick');
            const target = [...room.players.values()].find(
              (p) => p.name.toLowerCase() === String(a.name).toLowerCase(),
            );
            if (!target || target.id === actor.id) throw new Error('Player not found');
            target.socket.close(4003, 'Kicked by the room owner');
            return;
          }
          executeAction(room.sim, actor, a);
          return;
        }
        throw new Error('Unknown message');
      } catch (e) {
        error(e.message);
      }
    });
    socket.on('close', () => {
      clearTimeout(joinTimer);
      sockets.delete(socket);
      if (actor) room.leave(id);
    });
    socket.on('error', () => socket.close());
  });
  let previous = performance.now(),
    accumulator = 0,
    ticks = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(0.1, (now - previous) / 1000);
    previous = now;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 5) {
      for (const room of rooms.values()) if (room.players.size) room.tick();
      accumulator -= STEP;
      ticks++;
      if (ticks % 3 === 0)
        for (const room of rooms.values()) if (room.players.size) room.broadcast(room.snapshot());
    }
    if (steps > 5) accumulator = 0;
    for (const [id, r] of rooms) if (r.emptySince && now - r.emptySince > 60000) rooms.delete(id);
  }, 1000 / 60);
  const heartbeat = setInterval(() => {
    for (const s of sockets) {
      if (!s.alive) {
        s.terminate();
        continue;
      }
      s.alive = false;
      s.ping();
    }
  }, 30000);
  return {
    app,
    server,
    wss,
    rooms,
    listen(port = Number(process.env.PORT) || 3001, host = '0.0.0.0') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address())));
    },
    async close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const s of sockets) s.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = createGameServer();
  game.listen().then((a) => console.log(`Xmod.io server listening on port ${a.port}`));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => game.close().then(() => process.exit(0)));
}
