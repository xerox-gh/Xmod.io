import * as C from 'cannon-es';
import { spawnRagdoll } from '../ragdoll.js';
import { spawnVehicle, enterCar, exitCar } from '../vehicles.js';
import { FACTIONS } from './ai.js';
export const MODE_NAMES = {
  sandbox: 'Sandbox',
  hunt: 'Prop Hunt',
  race: 'Contraption Derby',
  horde: 'Beacon Defense',
  lava: 'Rising Lava',
  fort: 'Build & Destroy',
};
export class LabModes {
  constructor(lab) {
    this.lab = lab;
    this.state = { id: 'sandbox', phase: 'free', elapsed: 0 };
    this.spawned = new Set();
    this.players = new Map();
    this.ghosts = new Map();
  }
  actorState(actor) {
    if (!this.players.has(actor.id))
      this.players.set(actor.id, {
        checkpoint: 0,
        lap: 0,
        start: this.lab.sim.time,
        frames: [],
        health: 100,
      });
    return this.players.get(actor.id);
  }
  stop() {
    for (const actor of this.lab.actors.values())
      if (this.spawned.has(this.lab.sim.entities.get(actor.state.vehicleId)?.group))
        exitCar(this.lab.sim, actor);
    for (const id of this.spawned) this.lab.sim.removeGroup(id);
    this.spawned.clear();
    this.players.clear();
    this.nextWave = -1;
    for (const actor of this.lab.actors.values()) {
      actor.health = 100;
      actor.disguise = null;
      actor.role = null;
    }
    this.state = { id: 'sandbox', phase: 'free', elapsed: 0 };
  }
  spawn(type, p, behavior = {}) {
    const sim = this.lab.sim;
    const e = sim.spawn(type, p, 'local', { behavior });
    this.spawned.add(e.group);
    return e;
  }
  start(id, options = {}) {
    if (!Object.hasOwn(MODE_NAMES, id)) throw new Error('Unknown game mode');
    this.stop();
    const sim = this.lab.sim;
    this.state = {
      id,
      elapsed: 0,
      phase: id === 'fort' ? 'build' : 'play',
      wave: 0,
      lava: 0,
      remaining: id === 'fort' ? 180 : 180,
      score: 0,
      result: '',
    };
    const actors = [...this.lab.actors.values()];
    actors.forEach((a, i) => {
      a.health = 100;
      a.role =
        id === 'hunt'
          ? i === 0
            ? options.role || 'hunter'
            : options.role === 'hider'
              ? 'hunter'
              : 'hider'
          : null;
      this.actorState(a);
    });
    if (id === 'race') {
      this.checkpoints = [...sim.entities.values()]
        .filter((e) => e.type === 'checkpoint')
        .map((e) => e.body.position.toArray());
      if (this.checkpoints.length < 3) {
        this.checkpoints = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2,
            p = [Math.sin(angle) * 30, 2, Math.cos(angle) * 30],
            hit = new C.RaycastResult();
          sim.world.raycastClosest(
            new C.Vec3(p[0], 90, p[2]),
            new C.Vec3(p[0], -15, p[2]),
            { collisionFilterMask: 1 },
            hit,
          );
          if (hit.hasHit) p[1] = hit.hitPointWorld.y + 2;
          this.checkpoints.push(p);
          this.spawn('checkpoint', p);
        }
      }
      for (const a of actors) {
        a.state.body.position.set(
          this.checkpoints[0][0],
          this.checkpoints[0][1] + 2,
          this.checkpoints[0][2] + 5,
        );
        if (!a.state.vehicleId) {
          const car = spawnVehicle(
            sim,
            'car',
            [a.state.body.position.x, a.state.body.position.y - 1, a.state.body.position.z],
            a.id,
          );
          this.spawned.add(car.group);
          enterCar(sim, a, car.id);
        }
      }
    }
    if (id === 'horde' || id === 'fort') {
      const a = actors[0],
        p = a ? a.state.body.position.toArray() : [0, 2, 0];
      this.core = this.spawn('core', [p[0] + 4, 1.5, p[2] - 8]);
      this.state.core = this.core.id;
    }
    if (id === 'hunt' && actors.length < 2) {
      if (actors[0]?.role === 'hider')
        for (let i = 0; i < 2; i++) this.npc([8 + i * 4, 2, 5], 'hostile', 'ranged');
      else
        for (let i = 0; i < 4; i++)
          this.spawn(['barrel', 'crate', 'chair', 'ball'][i], [-12 + i * 8, 2, -10], {
            hiding: true,
            health: 20,
          });
    }
    if (id === 'fort')
      for (let i = 0; i < 8; i++)
        this.spawn('crate', [(i % 4) * 2 - 3, 1 + Math.floor(i / 4) * 1.7, -30], {
          breakable: true,
        });
    sim.emit('mode', { state: this.snapshot() });
  }
  npc(p, faction = 'hostile', weapon = 'melee') {
    const sim = this.lab.sim;
    if (sim.entities.size > 180 || sim.constraints.size + 9 > 200) return null;
    const e = spawnRagdoll(sim, p, 'local');
    this.spawned.add(e.group);
    e.behavior = {
      npc: true,
      faction,
      npcWeapon: weapon,
      health: 100 + this.state.wave * 15,
      speed: 2 + this.state.wave * 0.15,
      homeX: p[0],
      homeZ: p[2],
    };
    for (const part of sim.entities.values())
      if (part.group === e.group) {
        part.color = FACTIONS[faction];
        sim.emit('change', { entity: sim.serialize(part) });
      }
    return e;
  }
  guardAction(actor, a) {
    if (this.state.id === 'fort') {
      if (this.state.phase === 'build' && a.kind === 'fire')
        throw new Error('Build phase: weapons unlock after three minutes');
      if (
        this.state.phase === 'battle' &&
        a.kind === 'fire' &&
        !['rocket', 'grenade'].includes(a.weapon)
      )
        throw new Error('Battle phase: rockets and grenades only');
      if (
        this.state.phase === 'battle' &&
        [
          'tool',
          'spawn',
          'loadBuild',
          'duplicate',
          'freeze',
          'gadget',
          'labConfig',
          'groupMove',
        ].includes(a.kind)
      )
        throw new Error('Battle phase: building resumes next round');
    }
  }
  shot(actor, hitIds) {
    if (this.state.id !== 'hunt' || actor.role !== 'hunter') return;
    const sim = this.lab.sim,
      origin = actor.state.body.position.vadd(new C.Vec3(0, 0.65, 0)),
      s = actor.state,
      dir = new C.Vec3(
        -Math.sin(s.yaw) * Math.cos(s.pitch),
        Math.sin(s.pitch),
        -Math.cos(s.yaw) * Math.cos(s.pitch),
      );
    for (const other of this.lab.actors.values())
      if (other !== actor && other.role === 'hider' && (other.health ?? 100) > 0) {
        const delta = other.state.body.position.vsub(origin),
          along = delta.dot(dir),
          side = delta.vsub(dir.scale(along)).length();
        if (along > 0 && along < 140 && side < 1.1) {
          const hit = new C.RaycastResult();
          sim.world.raycastClosest(
            origin,
            other.state.body.position,
            { collisionFilterMask: 1, skipBackfaces: true },
            hit,
          );
          if (!hit.hasHit || hit.distance > along - 1.2) {
            other.health = Math.max(0, (other.health ?? 100) - 25);
            if (!other.health) this.state.score++;
            return;
          }
        }
      }
    const hidden = [...hitIds].some(
      (id) =>
        this.lab.sim.entities.get(id)?.behavior.hiding ||
        this.lab.states.get(id)?.hidingHitAt === sim.time,
    );
    if (hidden) {
      this.state.score++;
      return;
    }
    actor.health = Math.max(0, (actor.health ?? 100) - 5);
  }
  disguise(actor, id) {
    if (this.state.id !== 'hunt' || actor.role !== 'hider')
      throw new Error('Choose the hider role in Prop Hunt first');
    const e = this.lab.sim.entities.get(id);
    if (!e || e.body.position.distanceTo(actor.state.body.position) > 30)
      throw new Error('Aim at a nearby prop');
    actor.disguise = { type: e.type, color: e.color, scale: e.scale, yaw: actor.state.yaw };
  }
  step(dt) {
    const s = this.state,
      sim = this.lab.sim;
    if (s.id === 'sandbox' || s.phase === 'over') return;
    s.elapsed += dt;
    s.remaining = Math.max(
      0,
      (s.id === 'fort' ? (s.phase === 'build' ? 180 : 120) : 180) - s.elapsed,
    );
    if (s.id === 'race')
      for (const actor of this.lab.actors.values()) {
        const state = this.actorState(actor),
          point = this.checkpoints[state.checkpoint];
        if (sim.time - (state.sample || 0) > 0.1) {
          state.sample = sim.time;
          state.frames.push({
            t: sim.time - state.start,
            p: actor.state.body.position.toArray(),
            yaw: actor.state.yaw,
          });
          if (state.frames.length > 3000) state.frames.shift();
        }
        if (point && actor.state.body.position.distanceTo(new C.Vec3(...point)) < 6) {
          state.checkpoint++;
          if (state.checkpoint === this.checkpoints.length) {
            state.lap++;
            state.last = Math.round((sim.time - state.start) * 1000);
            const best = this.ghosts.get(actor.id);
            if (!best || state.last < best.ms)
              this.ghosts.set(actor.id, { ms: state.last, frames: state.frames });
            state.frames = [];
            state.start = sim.time;
            state.checkpoint = 0;
          }
        }
      }
    if (s.id === 'horde' || (s.id === 'fort' && s.phase === 'battle')) {
      const alive = [...sim.entities.values()].filter(
        (e) => e.behavior.npc && e.behavior.faction === 'hostile',
      );
      if (!alive.length && (this.nextWave || 0) < sim.time) {
        s.wave++;
        this.nextWave = sim.time + 5;
        for (let i = 0; i < Math.min(5, s.wave + 1); i++)
          this.npc(
            [Math.sin(i * 1.7) * 20, 2, -20 - Math.cos(i * 1.7) * 12],
            'hostile',
            s.wave > 2 ? 'ranged' : 'melee',
          );
      }
      if ((this.core && !sim.entities.has(this.core.id)) || this.core?.behavior.health <= 0) {
        s.phase = 'over';
        s.result = 'Beacon lost';
      }
    }
    if (s.id === 'lava') {
      s.lava = s.elapsed * 0.15;
      for (const a of this.lab.actors.values())
        if (a.state.body.position.y < s.lava + 1)
          a.health = Math.max(0, (a.health ?? 100) - 60 * dt);
    }
    if (s.id === 'fort' && s.remaining === 0) {
      if (s.phase === 'build') {
        s.phase = 'battle';
        s.elapsed = 0;
        s.remaining = 120;
      } else {
        s.phase = 'over';
        s.result = 'Round complete';
      }
    }
    if (s.id === 'hunt' && s.remaining === 0) {
      s.phase = 'over';
      s.result = 'Time up';
    }
    const actors = [...this.lab.actors.values()];
    if (actors.length && actors.every((a) => (a.health ?? 100) <= 0)) {
      s.phase = 'over';
      s.result = 'Round over';
    }
  }
  snapshot() {
    return {
      ...this.state,
      players: Object.fromEntries(
        [...this.lab.actors.values()].map((a) => [
          a.id,
          {
            ...this.actorState(a),
            frames: undefined,
            health: a.health ?? 100,
            role: a.role,
            disguise: a.disguise,
          },
        ]),
      ),
    };
  }
}
