import * as C from 'cannon-es';
import { workshopAction } from './workshop-actions.js';
import { deleteWithUndo } from './builds.js';
import { spawnDoor } from './behaviors.js';
import { LIMITS, BIND_KEYS } from './constants.js';
import { PROPS } from './props.js';
import { grab, release, freeze } from './grabbing.js';
import { addConstraint, attachDevice, resize } from './constraints.js';
import { spawnRagdoll } from './ragdoll.js';
import { spawnVehicle, enterCar, exitCar } from './vehicles.js';
import { shoot, reloadWeapon } from './combat.js';
export const finiteVector = (v, n = 3) =>
  Array.isArray(v) && v.length === n && v.every(Number.isFinite);
export function targetEntity(sim, actor, id) {
  const e = sim.entities.get(id);
  if (!e) throw new Error('Aim at an object');
  if (e.body.position.distanceTo(actor.state.body.position) > LIMITS.reach)
    throw new Error('Object is out of reach');
  return e;
}
export function ownEntity(sim, actor, id) {
  const e = targetEntity(sim, actor, id);
  if (e.owner !== actor.id && e.owner !== 'world' && !actor.admin)
    throw new Error('You can only edit your own props');
  return e;
}
export function executeAction(sim, actor, a) {
  if (!a || typeof a.kind !== 'string') throw new Error('Invalid action');
  if (workshopAction(sim, actor, a, ownEntity, targetEntity)) return;
  if (a.kind === 'spawn') {
    if (!Object.hasOwn(PROPS, a.prop) || PROPS[a.prop].category === 'internal')
      throw new Error('Unknown prop');
    if (
      !finiteVector(a.p) ||
      a.p.some((n) => Math.abs(n) > 150) ||
      new C.Vec3(...a.p).distanceTo(actor.state.body.position) > 20
    )
      throw new Error('Spawn point is out of reach');
    const yaw = Number.isFinite(a.yaw) ? a.yaw : 0;
    const e =
      a.prop === 'ragdoll' || a.prop === 'npc'
        ? spawnRagdoll(sim, a.p, actor.id)
        : PROPS[a.prop].vehicle
          ? spawnVehicle(sim, a.prop, a.p, actor.id, yaw)
          : a.prop === 'door'
            ? spawnDoor(sim, a.p, actor.id, yaw)
            : sim.spawn(a.prop, a.p, actor.id);
    if (a.prop === 'npc') {
      e.behavior = { npc: true, homeX: a.p[0], homeZ: a.p[2], health: 100 };
      sim.emit('change', { entity: sim.serialize(e) });
    }
    if (a.prop !== 'ragdoll' && a.prop !== 'npc') e.body.quaternion.setFromEuler(0, yaw, 0);
    sim.remember(actor.id, { group: e.group });
    return e;
  }
  if (a.kind === 'undo') return sim.undo(actor.id);
  if (a.kind === 'clear')
    return deleteWithUndo(
      sim,
      actor.id,
      [...sim.entities.values()]
        .filter((e) => actor.id === 'local' || e.owner === actor.id)
        .map((e) => e.id),
    );
  if (a.kind === 'fire') return shoot(sim, actor, a.weapon);
  if (a.kind === 'reload') return reloadWeapon(sim, actor, a.weapon);
  if (a.kind === 'vehicle') {
    if (actor.state.vehicleId) return exitCar(sim, actor);
    return enterCar(sim, actor, a.id);
  }
  if (a.kind === 'noclip') {
    if (actor.state.vehicleId) exitCar(sim, actor);
    actor.state.fly = !actor.state.fly;
    return;
  }
  if (a.kind === 'gravity') {
    if (!actor.admin) throw new Error('Only the room owner can change gravity');
    if (!Number.isFinite(a.value) || a.value < -40 || a.value > 40)
      throw new Error('Gravity must be between -40 and 40');
    sim.world.gravity.set(0, -a.value, 0);
    sim.emit('gravity', { value: a.value });
    return;
  }
  if (a.kind === 'grab') {
    const e = targetEntity(sim, actor, a.id);
    const p = finiteVector(a.point) ? new C.Vec3(...a.point) : e.body.position.clone();
    if (p.distanceTo(e.body.position) > e.body.boundingRadius + 0.5)
      throw new Error('Invalid grab point');
    return grab(sim, actor, a.id, p, a.distance);
  }
  if (a.kind === 'release') return release(sim, actor.id);
  if (a.kind === 'grabMove') {
    const g = sim.grabs.get(actor.id);
    if (!g) return;
    if (Number.isFinite(a.distance)) g.distance = Math.max(2, Math.min(25, a.distance));
    g.rotate = !!a.rotate;
    if (g.rotate && finiteVector(a.q, 4) && Math.hypot(...a.q) > 0.5 && Math.hypot(...a.q) < 1.5) {
      g.rotation.set(...a.q);
      g.rotation.normalize();
    }
    return;
  }
  if (a.kind === 'freeze') {
    const e = targetEntity(sim, actor, a.id);
    release(sim, actor.id);
    freeze(sim, e.id, !e.frozen);
    return;
  }
  if (a.kind === 'launch') {
    const g = sim.grabs.get(actor.id),
      e = targetEntity(sim, actor, g?.id || a.id);
    release(sim, actor.id);
    if (e.frozen) freeze(sim, e.id, false);
    const s = actor.state,
      dir = new C.Vec3(
        -Math.sin(s.yaw) * Math.cos(s.pitch),
        Math.sin(s.pitch),
        -Math.cos(s.yaw) * Math.cos(s.pitch),
      );
    e.body.applyImpulse(dir.scale(Math.min(2500, e.body.mass * 24)));
    return;
  }
  if (a.kind === 'tool') {
    const e = ownEntity(sim, actor, a.id),
      mode = a.mode;
    if (['weld', 'rope', 'hinge', 'slider', 'motor'].includes(mode)) {
      const b = ownEntity(sim, actor, a.other);
      const axis = ['x', 'y', 'z'].includes(a.axis) ? a.axis : 'y';
      const pivot =
        finiteVector(a.point) &&
        new C.Vec3(...a.point).distanceTo(e.body.position) < e.body.boundingRadius + 1
          ? a.point
          : e.body.position.toArray();
      const options = {
        axis: axis === 'x' ? [1, 0, 0] : axis === 'z' ? [0, 0, 1] : [0, 1, 0],
        speed: Math.max(-30, Math.min(30, Number.isFinite(a.speed) ? a.speed : -8)),
        bind: BIND_KEYS.includes(a.bind) ? a.bind : 'KeyF',
        travel: Math.max(0.25, Math.min(12, Number(a.travel) || 4)),
      };
      const c = addConstraint(
        sim,
        mode,
        e.id,
        b.id,
        actor.id,
        mode === 'rope' ? e.body.position.toArray() : pivot,
        mode === 'rope' ? b.body.position.toArray() : pivot,
        options,
      );
      sim.remember(actor.id, { constraint: c.id });
      return;
    }
    if (['wheel', 'thruster', 'balloon'].includes(mode)) {
      if (
        !finiteVector(a.point) ||
        !finiteVector(a.normal) ||
        Math.hypot(...a.normal) < 0.9 ||
        Math.hypot(...a.normal) > 1.1 ||
        new C.Vec3(...a.point).distanceTo(e.body.position) > e.body.boundingRadius + 1
      )
        throw new Error('Invalid attachment');
      return attachDevice(sim, actor, e, mode, a.point, a.normal);
    }
    if (mode === 'resize') {
      const old = resize(sim, e.id, Number.isFinite(a.scale) ? a.scale : e.scale * 1.25);
      sim.remember(actor.id, { restore: () => resize(sim, e.id, old) });
      return;
    }
    if (mode === 'paint') {
      if (!/^#[0-9a-f]{6}$/i.test(a.color)) throw new Error('Invalid paint color');
      const old = e.color;
      e.color = a.color;
      sim.emit('change', { entity: sim.serialize(e) });
      sim.remember(actor.id, {
        restore: () => {
          if (sim.entities.has(e.id)) {
            e.color = old;
            sim.emit('change', { entity: sim.serialize(e) });
          }
        },
      });
      return;
    }
    if (mode === 'remove') {
      deleteWithUndo(
        sim,
        actor.id,
        [...sim.entities.values()].filter((b) => b.group === e.group).map((b) => b.id),
      );
      return;
    }
    throw new Error('Invalid tool mode');
  }
  throw new Error('Unknown action');
}
