import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/server.js';
import { Bucket, validateInput, parseMessage } from '../server/validation.js';
import { PROTOCOL } from '../shared/constants.js';
function client(url) {
  const socket = new WebSocket(url),
    messages = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw)));
  return {
    socket,
    messages,
    send: (m) => socket.send(JSON.stringify(m)),
    async wait(type, predicate = () => true) {
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        const i = messages.findIndex((m) => m.type === type && predicate(m));
        if (i >= 0) return messages.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`Timed out waiting for ${type}`);
    },
    async open() {
      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
    },
  };
}
test('two clients share authoritative props, movement, chat and owner moderation', async () => {
  const server = createGameServer(),
    address = await server.listen(0, '127.0.0.1'),
    url = `ws://127.0.0.1:${address.port}/ws`,
    a = client(url),
    b = client(url);
  try {
    await Promise.all([a.open(), b.open()]);
    a.send({ type: 'join', protocol: PROTOCOL, name: 'Alice', room: 'test' });
    const welcome = await a.wait('welcome');
    b.send({ type: 'join', protocol: PROTOCOL, name: 'Bob', room: 'test' });
    const wb = await b.wait('welcome');
    assert.notEqual(welcome.id, wb.id);
    a.send({ type: 'action', action: { kind: 'spawn', prop: 'barrel', p: [0, 2, 9] } });
    const ea = await a.wait(
        'event',
        (m) => m.event.type === 'spawn' && m.event.entity.owner === welcome.id,
      ),
      eb = await b.wait(
        'event',
        (m) => m.event.type === 'spawn' && m.event.entity.id === ea.event.entity.id,
      );
    assert.equal(ea.event.entity.id, eb.event.entity.id);
    a.send({ type: 'input', input: { yaw: 0, pitch: 0, forward: 1, sprint: true } });
    const snapshot = await b.wait(
      'snapshot',
      (m) => m.players.find((p) => p.id === welcome.id)?.p[2] < 13.8,
    );
    assert.ok(snapshot.props.some((p) => p.id === ea.event.entity.id));
    b.send({ type: 'chat', text: 'hello <script>alert(1)</script>' });
    const chat = await a.wait('chat', (m) => m.name === 'Bob');
    assert.match(chat.text, /hello/);
    b.send({ type: 'action', action: { kind: 'gravity', value: 0 } });
    assert.match((await b.wait('error')).message, /owner/);
    b.send({ type: 'action', action: { kind: 'tool', mode: 'remove', id: ea.event.entity.id } });
    assert.match((await b.wait('error')).message, /own/);
    a.send({
      type: 'action',
      action: { kind: 'tool', mode: 'paint', id: ea.event.entity.id, color: '#ff88cc' },
    });
    await b.wait('event', (m) => m.event.type === 'change' && m.event.entity.color === '#ff88cc');
    a.send({ type: 'action', action: { kind: 'kick', name: 'Bob' } });
    await new Promise((resolve) => b.socket.once('close', resolve));
    assert.equal(b.socket.readyState, WebSocket.CLOSED);
    const list = await fetch(`http://127.0.0.1:${address.port}/api/rooms`).then((r) => r.json());
    assert.equal(list[0].id, 'test');
  } finally {
    a.socket.terminate();
    b.socket.terminate();
    await server.close();
  }
});
test('invalid messages, malformed movement and message buckets are bounded', () => {
  assert.throws(() => parseMessage(Buffer.from('[]')));
  assert.throws(() => parseMessage(Buffer.alloc(9000)));
  assert.throws(() => validateInput({ yaw: Infinity, pitch: 0 }));
  const input = validateInput({ yaw: 99, pitch: 99, forward: 100, right: -100 });
  assert.equal(input.forward, 1);
  assert.equal(input.right, -1);
  assert.equal(input.pitch, 1.5);
  const bucket = new Bucket(0, 2);
  assert.ok(bucket.take());
  assert.ok(bucket.take());
  assert.equal(bucket.take(), false);
});
