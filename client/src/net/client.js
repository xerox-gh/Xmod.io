import * as C from 'cannon-es';
import { MSG, PROTOCOL } from '../../../shared/constants.js';
import { Track } from './interpolation.js';
import { Avatars } from './avatars.js';
import { normalizeServerUrl } from './endpoint.js';
export class NetworkClient {
  constructor(game) {
    this.game = game;
    this.connected = false;
    this.socket = null;
    this.tracks = new Map();
    this.avatars = new Avatars(game.view.scene);
    this.clock = 0;
    this.pingClock = 0;
    this.latency = 0;
    this.roomName = '';
    let saved = '';
    try {
      saved = localStorage.getItem('xmod.server') || '';
    } catch {}
    this.base =
      saved ||
      import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.MODE === 'pages' ? '' : location.origin);
  }
  setServer(value) {
    const next = normalizeServerUrl(value, location.protocol);
    if (next === this.base) return;
    if (this.connected) this.disconnect();
    this.base = next;
    try {
      localStorage.setItem('xmod.server', next);
    } catch {}
  }
  async rooms() {
    if (!this.base) throw new Error('Add a multiplayer server URL first.');
    const response = await fetch(new URL('/api/rooms', this.base), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Room server is unavailable');
    return response.json();
  }
  connect(name, room) {
    if (!this.base) return Promise.reject(new Error('Add a multiplayer server URL first.'));
    if (this.socket) this.disconnect();
    return new Promise((resolve, reject) => {
      const url = new URL('/ws', this.base);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      this.socket = socket;
      let welcomed = false;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Connection timed out'));
      }, 8000);
      socket.onopen = () => this.send({ type: MSG.JOIN, name, room, protocol: PROTOCOL });
      socket.onmessage = ({ data }) => {
        try {
          const message = JSON.parse(data);
          if (message.type === MSG.WELCOME) {
            welcomed = true;
            clearTimeout(timeout);
            this.welcome(message);
            resolve();
          } else if (message.type === MSG.ERROR) {
            this.game.toast(message.message);
            this.game.console.print(message.message);
            if (!welcomed) {
              clearTimeout(timeout);
              reject(new Error(message.message));
              socket.close();
            }
          } else this.receive(message);
        } catch (error) {
          console.warn('Network packet rejected', error);
        }
      };
      socket.onerror = () => {
        if (!welcomed) {
          clearTimeout(timeout);
          reject(
            new Error('Cannot reach that multiplayer server. Check its address and try again.'),
          );
        }
      };
      socket.onclose = (event) => {
        clearTimeout(timeout);
        if (this.socket !== socket) return;
        this.socket = null;
        if (this.connected) {
          this.connected = false;
          this.reset();
          this.game.toast(event.reason || 'Disconnected from room');
          this.game.overlay = 'pause';
          this.game.input.unlock();
          this.game.menus.show();
        }
        if (!welcomed) reject(new Error(event.reason || 'Connection closed'));
      };
    });
  }
  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  action(action) {
    this.send({ type: MSG.ACTION, action });
    if (action.kind === 'noclip') this.game.player.setFly();
  }
  welcome(m) {
    const g = this.game;
    g.tools.deactivate();
    g.sim.clear();
    g.sim.remote = true;
    g.sim.grabs.clear();
    g.sim.undoStacks.clear();
    this.tracks.clear();
    this.avatars.clear();
    this.connected = true;
    this.id = m.id;
    this.roomName = m.roomName;
    g.owner = m.id;
    g.actor.id = m.id;
    g.actor.admin = m.owner === m.id;
    g.actors = new Map([[m.id, g.actor]]);
    g.player.state.id = m.id;
    g.player.state.vehicleId = null;
    g.player.setFly(false);
    g.player.state.body.position.set(0, 2.2, 14);
    g.player.state.body.velocity.setZero();
    g.sim.world.gravity.y = -m.gravity;
    g.weapons.states.clear();
    g.actor.loadout = {};
    for (const e of m.entities) this.replica(e);
    for (const c of m.constraints) g.constraintView.event({ type: 'constraint', constraint: c });
    g.toast(`Joined ${m.roomName}`);
  }
  replica(data) {
    const g = this.game,
      e = g.sim.spawn(data.type, data.p, data.owner, { ...data });
    e.frozen = data.frozen;
    e.body.mass = 0;
    e.body.type = C.Body.KINEMATIC;
    e.body.collisionFilterMask = 2;
    e.body.updateMassProperties();
    this.tracks.set(e.id, new Track());
  }
  receive(m) {
    const g = this.game;
    if (m.type === MSG.PONG) {
      this.latency = Math.round(performance.now() - m.ts);
      return;
    }
    if (m.type === MSG.CHAT) {
      g.chat.message(m.name, m.text);
      return;
    }
    if (m.type === MSG.EVENT) {
      const e = m.event;
      if (e.type === 'spawn') {
        this.replica(e.entity);
        return;
      }
      if (e.type === 'remove') {
        g.sim.remove(e.id);
        this.tracks.delete(e.id);
        return;
      }
      if (e.type === 'change') {
        const entity = g.sim.entities.get(e.entity.id);
        if (entity) {
          if (entity.scale !== e.entity.scale) {
            const next = g.sim.makeBody(entity.type, e.entity.scale);
            while (entity.body.shapes.length) entity.body.removeShape(entity.body.shapes[0]);
            entity.body.addShape(next.shapes[0]);
          }
          Object.assign(entity, {
            scale: e.entity.scale,
            color: e.entity.color,
            frozen: e.entity.frozen,
          });
        }
        g.onSimEvent(e);
        return;
      }
      if (e.type === 'owner') g.actor.admin = e.id === this.id;
      if (e.type === 'gravity') g.sim.world.gravity.y = -e.value;
      if (e.type === 'shot' && e.owner === this.id) g.weapons.state(e.weapon).ammo = e.ammo;
      g.onSimEvent(e);
      return;
    }
    if (m.type === MSG.SNAPSHOT) {
      for (const p of m.props) this.tracks.get(p.id)?.push(p);
      this.avatars.snapshot(m.players, this.id);
      g.vehicles.states = m.vehicles;
      const own = m.players.find((p) => p.id === this.id);
      if (own) {
        const b = g.player.state.body,
          err = b.position.distanceTo(new C.Vec3(...own.p));
        if (err > 4) b.position.set(...own.p);
        else if (err > 0.15) b.position.lerp(new C.Vec3(...own.p), 0.18, b.position);
        if (own.vehicle) b.position.set(...own.p);
        g.player.state.fly = own.fly;
        g.player.state.vehicleId = own.vehicle;
        b.collisionResponse = !own.vehicle;
        b.type = own.vehicle || own.fly ? C.Body.KINEMATIC : C.Body.DYNAMIC;
      }
      for (const r of m.projectiles) {
        const record = g.projectiles.rockets.get(r.id);
        if (record) record.mesh.position.fromArray(r.p);
      }
    }
  }
  update(dt) {
    if (!this.connected) return;
    this.clock += dt;
    this.pingClock += dt;
    if (this.clock >= 0.05) {
      this.clock %= 0.05;
      const p = this.game.player;
      const input = this.game.input.locked
        ? { ...p.packet, activate: this.game.input.down('KeyF') }
        : { yaw: p.yaw, pitch: p.pitch };
      this.send({ type: MSG.INPUT, input });
    }
    if (this.pingClock > 2) {
      this.pingClock = 0;
      this.send({ type: MSG.PING, ts: performance.now() });
    }
    for (const [id, track] of this.tracks) {
      const state = track.sample(),
        entity = this.game.sim.entities.get(id);
      if (state && entity) {
        entity.body.position.copy(state.p);
        entity.body.quaternion.copy(state.q);
        entity.body.velocity.setZero();
        entity.body.aabbNeedsUpdate = true;
      }
    }
    this.avatars.update();
  }
  reset() {
    const g = this.game;
    this.avatars.clear();
    this.tracks.clear();
    g.sim.clear();
    for (const id of [...g.constraintView.lines.keys()]) g.constraintView.remove(id);
    g.sim.remote = false;
    g.sim.world.gravity.y = -20;
    g.owner = 'local';
    g.actor.id = 'local';
    g.actor.admin = true;
    g.actors = new Map([['local', g.actor]]);
    g.player.state.vehicleId = null;
    g.player.setFly(false);
    g.player.state.body.type = C.Body.DYNAMIC;
    g.player.state.body.collisionResponse = true;
    g.player.state.body.position.set(0, 2.2, 14);
    g.weapons.states.clear();
    g.actor.loadout = {};
  }
  disconnect() {
    if (this.socket) {
      const s = this.socket;
      this.socket = null;
      this.connected = false;
      s.close(1000, 'Left room');
      this.reset();
    }
  }
}
