import * as C from 'cannon-es';
import { createWorld } from './physics.js';
import { PROPS } from './props.js';
import { LIMITS } from './constants.js';
import { removeConstraint } from './constraints.js';
import { release } from './grabbing.js';
import { stepProjectiles } from './combat.js';
export const vec = (a) => new C.Vec3(...a);
export const round = (n) => Math.round(n * 1000) / 1000;
export class Simulation {
  constructor(mapId = 'flatgrass') {
    this.world = createWorld(mapId);
    this.entities = new Map();
    this.serial = 0;
    this.constraints = new Map();
    this.grabs = new Map();
    this.vehicles = new Map();
    this.undoStacks = new Map();
    this.projectiles = new Map();
    this.time = 0;
    this.remote = false;
    this.timeScale = 1;
    this.physicsMs = 0;
    this.perfTicks = 0;
    this.lastImpact = -1;
    this.onEvent = () => {};
  }
  changeMap(id) {
    const world = createWorld(id);
    this.clear();
    this.undoStacks.clear();
    for (const id of this.projectiles.keys()) this.emit('projectileRemove', { id });
    this.projectiles.clear();
    this.world = world;
    this.emit('map', { map: id });
  }
  id(prefix = 'p') {
    return `${prefix}${++this.serial}`;
  }
  removeConstraint(id) {
    removeConstraint(this, id);
  }
  release(owner) {
    release(this, owner);
  }
  reserve(owner, count) {
    const cap = owner === 'local' ? LIMITS.bodies : LIMITS.perPlayer;
    if (count > cap) throw new Error(`A build can contain at most ${LIMITS.perPlayer} bodies`);
    while (this.entities.size + count > LIMITS.bodies)
      this.removeGroup(this.entities.values().next().value.group);
    let owned = [...this.entities.values()].filter((e) => e.owner === owner);
    while (owned.length + count > cap) {
      this.removeGroup(owned[0].group);
      owned = [...this.entities.values()].filter((e) => e.owner === owner);
    }
  }
  emit(type, data) {
    this.onEvent({ type, ...data });
  }
  spawn(type, position, owner = 'local', options = {}) {
    const def = PROPS[type];
    if (!def) throw new Error('Unknown prop');
    const own = [...this.entities.values()].filter((e) => e.owner === owner);
    if (!options.restoring && own.length >= (owner === 'local' ? LIMITS.bodies : LIMITS.perPlayer))
      this.removeGroup(own[0].group);
    while (this.entities.size >= LIMITS.bodies)
      this.removeGroup(this.entities.values().next().value.group);
    const id = options.id || this.id(),
      scale = options.scale || 1;
    const entity = {
      id,
      type,
      owner,
      group: options.group || id,
      scale,
      color: options.color || def.color,
      frozen: options.frozen ?? !!def.anchored,
      behavior: { ...(def.behavior || {}), ...(options.behavior || {}) },
      body: this.makeBody(type, scale),
    };
    entity.body.position.set(...position);
    if (entity.frozen) {
      entity.body.mass = 0;
      entity.body.type = C.Body.STATIC;
      entity.body.updateMassProperties();
    }
    entity.body.entityId = id;
    if (options.q) {
      entity.body.quaternion.set(...options.q);
      entity.body.quaternion.normalize();
    }
    entity.body.aabbNeedsUpdate = true;
    this.entities.set(id, entity);
    this.world.addBody(entity.body);
    if (!this.remote)
      entity.body.addEventListener('collide', (event) => {
        const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (speed > 2 && this.time - this.lastImpact > 0.075) {
          this.lastImpact = this.time;
          this.emit('impact', { p: entity.body.position.toArray(), speed, material: entity.type });
        }
        if (entity.behavior.explosive && speed > 11) entity.behavior.detonate = true;
        if (entity.behavior.npc && speed > 9) entity.behavior.stun = this.time + 3;
      });
    this.emit('spawn', { entity: this.serialize(entity) });
    return entity;
  }
  makeBody(type, scale) {
    const d = PROPS[type],
      s = d.size.map((n) => n * scale);
    let shape =
      d.shape === 'sphere'
        ? new C.Sphere(s[0])
        : d.shape === 'cylinder'
          ? new C.Cylinder(s[0], s[0], s[1], 12)
          : new C.Box(vec(s.map((n) => n / 2)));
    if (d.shape === 'cone') shape = new C.Cylinder(0.02 * s[0], s[0], s[1], 8);
    if (d.shape === 'ramp') {
      const [x, y, z] = s.map((n) => n / 2);
      shape = new C.ConvexPolyhedron({
        vertices: [
          [-x, -y, -z],
          [x, -y, -z],
          [-x, -y, z],
          [x, -y, z],
          [-x, y, -z],
          [x, y, -z],
        ].map((p) => new C.Vec3(...p)),
        faces: [
          [0, 2, 3, 1],
          [0, 1, 5, 4],
          [0, 4, 2],
          [1, 3, 5],
          [2, 4, 5, 3],
        ].map((f) => f.reverse()),
      });
    }
    const body = new C.Body({
      mass: d.mass * scale ** 3,
      shape: d.shape === 'pipe' ? undefined : shape,
      material: this.world.defaultMaterial,
      linearDamping: 0.12,
      angularDamping: 0.2,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.8,
    });
    if (d.shape === 'pipe') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          r = s[0] * 0.88;
        const q = new C.Quaternion();
        q.setFromEuler(0, -a, 0);
        body.addShape(
          new C.Box(new C.Vec3(s[0] * 0.13, s[1] / 2, s[0] * 0.26)),
          new C.Vec3(Math.cos(a) * r, 0, Math.sin(a) * r),
          q,
        );
      }
    }
    body.collisionFilterGroup = 1;
    body.collisionFilterMask = 3;
    return body;
  }
  serialize(e) {
    return {
      id: e.id,
      type: e.type,
      owner: e.owner,
      group: e.group,
      scale: e.scale,
      color: e.color,
      frozen: e.frozen,
      behavior: { ...e.behavior },
      p: e.body.position.toArray().map(round),
      q: e.body.quaternion.toArray().map(round),
    };
  }
  remove(id) {
    const e = this.entities.get(id);
    if (!e) return;
    for (const [key, c] of this.constraints)
      if (c.a === id || c.b === id) this.removeConstraint?.(key);
    for (const [key, g] of this.grabs) if (g.id === id) this.release?.(key);
    if (this.vehicles.has(id)) {
      this.vehicles.get(id).vehicle?.removeFromWorld(this.world);
      this.vehicles.delete(id);
    }
    this.world.removeBody(e.body);
    this.entities.delete(id);
    this.emit('remove', { id });
  }
  removeGroup(group) {
    for (const e of [...this.entities.values()]) if (e.group === group) this.remove(e.id);
  }
  remember(owner, item) {
    const stack = this.undoStacks.get(owner) || [];
    stack.push(item);
    if (stack.length > 40) stack.shift();
    this.undoStacks.set(owner, stack);
  }
  undo(owner) {
    const item = this.undoStacks.get(owner)?.pop();
    if (item?.group) this.removeGroup(item.group);
    if (item?.constraint) this.removeConstraint?.(item.constraint);
    if (item?.restore) item.restore();
  }
  clear(owner) {
    for (const e of [...this.entities.values()]) if (!owner || e.owner === owner) this.remove(e.id);
    this.undoStacks.delete(owner);
  }
  step(dt) {
    this.time += dt;
    // Sleeping bodies are skipped by cannon's broadphase and solver. Shorten only
    // the idle timeout far from every player; moving bodies are never forced asleep.
    if (!this.remote && ++this.perfTicks % 30 === 0) {
      const players = this.world.bodies.filter((b) => b.collisionFilterGroup === 2);
      for (const e of this.entities.values()) {
        const distant = players.every((b) => b.position.distanceTo(e.body.position) > 70);
        e.body.sleepTimeLimit = distant ? 0.3 : 0.8;
      }
    }
    if (!this.remote) stepProjectiles(this, dt);
    const start = performance.now();
    this.world.step(dt);
    this.physicsMs = performance.now() - start;
    if (!this.remote)
      for (const e of [...this.entities.values()])
        if (e.body.position.y < -45 || e.body.position.length() > 350) this.removeGroup(e.group);
  }
}
