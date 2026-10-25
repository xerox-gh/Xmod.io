import { createPlayer, movePlayer } from '../../../shared/movement.js';
import { serializeConstraint } from '../../../shared/constraints.js';
import { vehicleSnapshot } from '../../../shared/vehicles.js';
import { executeAction } from '../../../shared/actions.js';
import { cleanName, validateInput, Bucket } from '../../../server/validation.js';
import { MSG, PROTOCOL } from '../../../shared/constants.js';
import { base64, unbase64 } from './codec.js';
const encode = (description) =>
  'XMODP2P1.' + base64(new TextEncoder().encode(JSON.stringify(description)));
function decode(code, type) {
  if (typeof code !== 'string' || code.length > 50000 || !code.startsWith('XMODP2P1.'))
    throw new Error('Invalid peer connection code');
  const d = JSON.parse(new TextDecoder().decode(unbase64(code.slice(9))));
  if (d.type !== type || typeof d.sdp !== 'string' || d.sdp.length > 32000)
    throw new Error('Wrong peer code type');
  return d;
}
export class PeerLink {
  constructor(lab) {
    this.lab = lab;
    this.role = null;
    this.status = 'No direct connection';
    this.clock = 0;
    this.generation = 0;
    this.pending = [];
  }
  async setup(role) {
    this.close();
    const g = this.lab.game;
    if (g.net.connected) g.net.disconnect();
    this.role = role;
    this.status = 'Preparing local connection code…';
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => {
      this.status = 'Direct peer: ' + this.pc.connectionState;
      if (this.pc.connectionState === 'failed')
        this.status = 'Direct connection failed. Both browsers need a reachable LAN/direct route.';
    };
    return this.pc;
  }
  async gather() {
    if (this.pc.iceGatheringState === 'complete') return;
    const pc = this.pc;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', changed);
        if (pc.localDescription?.sdp.includes('a=candidate:')) resolve();
        else {
          this.status = 'The browser did not expose a local network candidate';
          reject(
            new Error(
              'No direct network candidate. Allow browser local network access and use a reachable LAN.',
            ),
          );
        }
      }, 10000);
      const changed = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', changed);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', changed);
    });
  }
  async offer(name) {
    const pc = await this.setup('host');
    this.name = cleanName(name, 'Host');
    this.lab.game.actor.name = this.name;
    this.attach(pc.createDataChannel('xmod', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await this.gather();
    this.status = 'Send the offer; paste your friend’s answer to finish';
    return encode(pc.localDescription);
  }
  async answer(code, name) {
    const offer = decode(code, 'offer'),
      pc = await this.setup('guest');
    this.name = cleanName(name, 'Guest');
    pc.ondatachannel = (e) => this.attach(e.channel);
    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await this.gather();
    this.status = 'Send this answer to the host';
    return encode(pc.localDescription);
  }
  async finish(code) {
    if (this.role !== 'host' || !this.pc) throw new Error('Create an offer first');
    await this.pc.setRemoteDescription(decode(code, 'answer'));
    this.status = 'Connecting directly…';
  }
  attach(channel) {
    this.channel = channel;
    this.bucket = new Bucket(70, 100);
    this.actions = new Bucket(28, 42);
    this.spawns = new Bucket(3, 8);
    this.chats = new Bucket(0.75, 4);
    channel.onopen = () => {
      this.status = 'Connected directly · no signaling server';
      if (this.role === 'guest') {
        const g = this.lab.game;
        g.net.socket = {
          readyState: 1,
          send: (data) => this.sendRaw(data),
          close: () => this.close(),
        };
        this.send({ type: MSG.JOIN, name: this.name, protocol: PROTOCOL });
      } else this.lab.game.toast('Peer connected');
    };
    channel.onmessage = (e) => {
      try {
        if (e.data.length > 300000 || !this.bucket.take())
          throw new Error('Peer message rate exceeded');
        const m = JSON.parse(e.data);
        if (this.role === 'host') this.hostMessage(m);
        else if (m.type === MSG.WELCOME) this.lab.game.net.welcome(m);
        else if (m.type === 'peerEvents' && Array.isArray(m.events) && m.events.length <= 800) {
          for (const event of m.events) this.lab.game.net.receive({ type: MSG.EVENT, event });
        } else if (m.type === MSG.ERROR) this.lab.game.toast(m.message);
        else this.lab.game.net.receive(m);
      } catch (error) {
        if (this.role === 'host') this.send({ type: MSG.ERROR, message: error.message });
        else this.lab.game.toast(error.message);
      }
    };
    channel.onclose = () => {
      this.status = 'Peer disconnected';
      if (this.role === 'guest' && this.lab.game.net.connected) {
        this.lab.game.net.connected = false;
        this.lab.game.net.socket = null;
        this.lab.game.net.reset();
      }
      if (this.role === 'host') this.close();
      else {
        this.close();
        this.status = 'Peer disconnected';
      }
    };
    if (channel.readyState === 'open') queueMicrotask(() => channel.onopen?.());
  }
  sendRaw(data) {
    if (this.channel?.readyState === 'open' && this.channel.bufferedAmount < 1e6)
      this.channel.send(data);
  }
  send(message) {
    this.sendRaw(JSON.stringify(message));
  }
  hostMessage(m) {
    const g = this.lab.game,
      sim = g.sim;
    if (m.type === MSG.JOIN) {
      if (this.actor) return;
      const id = 'peer',
        actor = {
          id,
          name: cleanName(m.name, 'Guest'),
          state: createPlayer(sim.world, id),
          input: { yaw: 0, pitch: 0 },
          admin: false,
          health: 100,
        };
      this.actor = actor;
      if (sim.lab.modes.state.id === 'hunt')
        actor.role = g.actor.role === 'hider' ? 'hunter' : 'hider';
      g.actors.set(id, actor);
      this.send({
        type: MSG.WELCOME,
        protocol: PROTOCOL,
        id,
        owner: g.owner,
        room: 'direct',
        roomName: 'Direct peer room',
        entities: [...sim.entities.values()].map((e) => sim.serialize(e)),
        constraints: [...sim.constraints.values()].map(serializeConstraint),
        gravity: -sim.world.gravity.y,
        map: sim.world.map.id,
        timeScale: sim.timeScale,
      });
      return;
    }
    if (!this.actor) throw new Error('Join first');
    if (m.type === MSG.INPUT) {
      this.actor.input = validateInput(m.input);
      this.lastInput = performance.now();
    } else if (m.type === MSG.ACTION) {
      if (!this.actions.take()) throw new Error('Tool rate limit reached');
      if (['spawn', 'duplicate', 'loadBuild'].includes(m.action?.kind) && !this.spawns.take())
        throw new Error('Spawn limit: wait a moment');
      executeAction(sim, this.actor, m.action);
    } else if (m.type === MSG.CHAT) {
      if (!this.chats.take()) throw new Error('Slow down the chat');
      const text = String(m.text || '').slice(0, 180);
      g.chat.message(this.actor.name, text);
      this.send({ type: MSG.CHAT, name: this.actor.name, text });
    } else if (m.type === MSG.PING) this.send({ type: MSG.PONG, ts: m.ts });
  }
  event(event) {
    if (this.role === 'host') {
      if (event.type === 'map' && this.actor) {
        this.actor.state = createPlayer(this.lab.game.sim.world, this.actor.id);
        this.actor.input = { yaw: 0, pitch: 0 };
        this.actor.loadout = {};
      }
      if (this.channel?.readyState === 'open' && this.actor) {
        this.pending.push(event);
        if (this.pending.length > 800) this.pending.shift();
      }
    }
  }
  chat(text) {
    if (this.role === 'host' && this.channel?.readyState === 'open')
      this.send({ type: MSG.CHAT, name: this.name || 'Host', text });
  }
  fixed(dt) {
    if (this.role !== 'host' || !this.actor) return;
    const a = this.actor;
    if (performance.now() - (this.lastInput || 0) > 500)
      a.input = { yaw: a.state.yaw, pitch: a.state.pitch };
    if (!a.state.vehicleId && !a.rc) movePlayer(a.state, a.input, this.lab.game.sim.world, dt);
    else {
      a.state.yaw = a.input.yaw;
      a.state.pitch = a.input.pitch;
    }
  }
  update(dt) {
    if (this.role !== 'host' || !this.actor || this.channel?.readyState !== 'open') return;
    this.clock += dt;
    if (this.clock < 0.05) return;
    this.clock %= 0.05;
    if (this.pending.length) this.send({ type: 'peerEvents', events: this.pending.splice(0) });
    const g = this.lab.game,
      sim = g.sim,
      players = [...g.actors.values()].map((a) => ({
        id: a.id,
        name: a.name || 'Host',
        p: a.state.body.position.toArray(),
        v: a.state.body.velocity.toArray(),
        yaw: a.state.yaw,
        pitch: a.state.pitch,
        fly: a.state.fly,
        crouch: a.state.crouched,
        vehicle: a.state.vehicleId || null,
        health: a.health ?? 100,
        disguise: a.disguise,
        rc: a.rc,
      }));
    const snapshot = {
      type: MSG.SNAPSHOT,
      time: sim.time,
      players,
      props: [...sim.entities.values()].map((e) => ({
        id: e.id,
        p: e.body.position.toArray(),
        q: e.body.quaternion.toArray(),
      })),
      vehicles: vehicleSnapshot(sim),
      projectiles: [...sim.projectiles.values()].map((r) => ({ id: r.id, p: r.p.toArray() })),
      toybox: {
        mode: sim.lab.modes.snapshot(),
        signals: [...sim.lab.values],
        environment: sim.lab.environment,
      },
    };
    this.send(snapshot);
    g.net.avatars.snapshot(players, g.owner);
    g.net.avatars.update();
  }
  close() {
    this.generation++;
    this.pending = [];
    const g = this.lab.game;
    if (this.actor) {
      g.actors.delete(this.actor.id);
      g.sim.world.removeBody(this.actor.state.body);
      g.sim.release(this.actor.id);
      g.sim.clear(this.actor.id);
      this.actor = null;
      g.net.avatars.clear();
    }
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.close();
      this.channel = null;
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.close();
    }
    this.pc = null;
    this.role = null;
    this.status = 'No direct connection';
    if (g.net?.socket && !g.net.socket.addEventListener && g.net.connected) {
      g.net.socket = null;
      g.net.connected = false;
      g.net.reset();
    }
  }
}
