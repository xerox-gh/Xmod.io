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
    this.onEvent = () => {};
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
    while (this.entities.size + count > LIMITS.bodies)
      this.removeGroup(this.entities.values().next().value.group);
    let owned = [...this.entities.values()].filter((e) => e.owner === owner);
    while (owned.length + count > LIMITS.perPlayer) {
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
    if (own.length >= LIMITS.perPlayer) this.removeGroup(own[0].group);
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
      frozen: false,
      body: this.makeBody(type, scale),
    };
    entity.body.position.set(...position);
    entity.body.entityId = id;
    if (options.q) entity.body.quaternion.set(...options.q);
    this.entities.set(id, entity);
    this.world.addBody(entity.body);
    this.emit('spawn', { entity: this.serialize(entity) });
    return entity;
  }
  makeBody(type, scale) {
    const d = PROPS[type],
      s = d.size.map((n) => n * scale);
    const shape =
      d.shape === 'sphere'
        ? new C.Sphere(s[0])
        : d.shape === 'cylinder'
          ? new C.Cylinder(s[0], s[0], s[1], 12)
          : new C.Box(vec(s.map((n) => n / 2)));
    const body = new C.Body({
      mass: d.mass * scale ** 3,
      shape,
      material: this.world.defaultMaterial,
      linearDamping: 0.12,
      angularDamping: 0.2,
      sleepSpeedLimit: 0.15,
      sleepTimeLimit: 0.8,
    });
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
      this.vehicles.get(id).vehicle.removeFromWorld(this.world);
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
    if (stack.length > 100) stack.shift();
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
    if (!this.remote) stepProjectiles(this, dt);
    this.world.step(dt);
    if (!this.remote)
      for (const e of [...this.entities.values()])
        if (e.body.position.y < -45 || e.body.position.length() > 350) this.removeGroup(e.group);
  }
}
