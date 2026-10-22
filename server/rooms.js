import { stepBehaviors } from '../shared/behaviors.js';
import { Simulation, round } from '../shared/simulation.js';
import { createPlayer, movePlayer } from '../shared/movement.js';
import { updateGrabs, release } from '../shared/grabbing.js';
import { stepAttachments, serializeConstraint } from '../shared/constraints.js';
import { stepCars, exitCar, vehicleSnapshot } from '../shared/vehicles.js';
import { STEP, LIMITS, MSG, PROTOCOL } from '../shared/constants.js';
export class Room {
  constructor(id, owner) {
    this.id = id;
    this.name = id;
    this.owner = owner;
    this.sim = new Simulation();
    this.players = new Map();
    this.emptySince = null;
    this.sim.onEvent = (event) => {
      if (event.type === 'map')
        for (const a of this.players.values()) {
          a.state = createPlayer(this.sim.world, a.id);
          a.input = { yaw: 0, pitch: 0 };
          a.loadout = {};
        }
      this.broadcast({ type: MSG.EVENT, event });
    };
    for (const [type, p] of [
      ['crate', [-5, 1, -4]],
      ['crate', [-5, 2.8, -4]],
      ['barrel', [5, 1, -5]],
      ['ball', [3, 1, -1]],
    ])
      this.sim.spawn(type, p, 'world');
  }
  send(socket, message) {
    if (socket.readyState !== 1) return;
    if (socket.bufferedAmount > 2e6) {
      socket.close(4008, 'Connection is too slow');
      return;
    }
    socket.send(JSON.stringify(message));
  }
  broadcast(message) {
    for (const p of this.players.values()) this.send(p.socket, message);
  }
  join(id, name, socket) {
    if (this.players.size >= LIMITS.players) throw new Error('Room is full');
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw new Error('That name is already in use in this room');
    if (!this.players.size) this.owner = id;
    const state = createPlayer(this.sim.world, id);
    state.body.position.x = (this.players.size % 5) * 1.5;
    const actor = {
      id,
      name,
      state,
      socket,
      input: { yaw: 0, pitch: 0 },
      admin: id === this.owner,
      lastInput: performance.now(),
    };
    this.players.set(id, actor);
    this.emptySince = null;
    this.send(socket, {
      type: MSG.WELCOME,
      protocol: PROTOCOL,
      id,
      room: this.id,
      roomName: this.name,
      owner: this.owner,
      entities: [...this.sim.entities.values()].map((e) => this.sim.serialize(e)),
      constraints: [...this.sim.constraints.values()].map(serializeConstraint),
      gravity: -this.sim.world.gravity.y,
      map: this.sim.world.map.id,
      timeScale: this.sim.timeScale,
    });
    this.broadcast({ type: MSG.CHAT, name: 'SERVER', text: `${name} joined the playground.` });
    return actor;
  }
  leave(id) {
    const actor = this.players.get(id);
    if (!actor) return;
    release(this.sim, id);
    if (actor.state.vehicleId) exitCar(this.sim, actor);
    this.sim.clear(id);
    this.sim.world.removeBody(actor.state.body);
    this.players.delete(id);
    this.broadcast({ type: MSG.CHAT, name: 'SERVER', text: `${actor.name} left.` });
    if (id === this.owner && this.players.size) {
      const next = this.players.values().next().value;
      this.owner = next.id;
      next.admin = true;
      this.broadcast({ type: MSG.EVENT, event: { type: 'owner', id: this.owner } });
    }
    if (!this.players.size) this.emptySince = performance.now();
  }
  tick() {
    const now = performance.now(),
      dt = STEP * this.sim.timeScale;
    for (const a of this.players.values()) {
      if (now - a.lastInput > 350) a.input = { yaw: a.state.yaw, pitch: a.state.pitch };
      if (a.state.vehicleId && !this.sim.vehicles.has(a.state.vehicleId)) exitCar(this.sim, a);
      if (!a.state.vehicleId && dt) movePlayer(a.state, a.input, this.sim.world, dt);
      else {
        a.state.yaw = a.input.yaw;
        a.state.pitch = a.input.pitch;
      }
    }
    if (!dt) return;
    updateGrabs(this.sim, this.players, dt);
    stepBehaviors(this.sim, this.players, dt);
    stepAttachments(this.sim, this.players);
    stepCars(this.sim, this.players);
    this.sim.step(dt);
  }
  snapshot() {
    return {
      type: MSG.SNAPSHOT,
      time: this.sim.time,
      players: [...this.players.values()].map((a) => ({
        id: a.id,
        name: a.name,
        p: a.state.body.position.toArray().map(round),
        v: a.state.body.velocity.toArray().map(round),
        yaw: a.state.yaw,
        pitch: a.state.pitch,
        fly: a.state.fly,
        crouch: a.state.crouched,
        vehicle: a.state.vehicleId || null,
      })),
      props: [...this.sim.entities.values()].map((e) => ({
        id: e.id,
        p: e.body.position.toArray().map(round),
        q: e.body.quaternion.toArray().map(round),
      })),
      vehicles: vehicleSnapshot(this.sim),
      projectiles: [...this.sim.projectiles.values()].map((r) => ({ id: r.id, p: r.p.toArray() })),
    };
  }
}
