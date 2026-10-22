import * as C from 'cannon-es';
import { LIMITS } from './constants.js';
import { addConstraint } from './constraints.js';
import { freeze } from './grabbing.js';
import { explode } from './combat.js';
// Behavioral props share the same authority and clock as ordinary rigid bodies.
export function spawnDoor(sim, p, owner, yaw = 0) {
  if (sim.constraints.size >= LIMITS.constraints) throw new Error('Constraint limit reached');
  sim.reserve(owner, 2);
  const group = sim.id('door');
  const q = new C.Quaternion();
  q.setFromEuler(0, yaw, 0);
  const door = sim.spawn('door', p, owner, { group, q: q.toArray() });
  const edge = door.body.pointToWorldFrame(new C.Vec3(-0.85, 0, 0));
  const frame = sim.spawn('door_frame', edge.toArray(), owner, { group, q: q.toArray() });
  addConstraint(sim, 'hinge', frame.id, door.id, owner, edge.toArray(), edge.toArray(), {
    axis: [0, 1, 0],
    effect: 'door',
  });
  return door;
}
export function hitEntity(sim, e, power = 1) {
  if (!e) return;
  const root = [...sim.entities.values()].find((b) => b.group === e.group && b.behavior.npc) || e;
  if (root.behavior.npc) {
    root.behavior.stun = sim.time + 3;
    root.body.wakeUp();
  }
  if (e.behavior.explosive) e.behavior.detonate = true;
  if (e.type === 'target') {
    e.behavior.hits = (e.behavior.hits || 0) + 1;
    sim.emit('change', { entity: sim.serialize(e) });
    sim.emit('targetHit', { p: e.body.position.toArray() });
  }
  if (e.type === 'head' || e.type === 'limb' || e.type === 'torso')
    sim.emit('dummyHit', { p: e.body.position.toArray(), power });
}
export function interactProp(sim, e) {
  if (!e) return false;
  if (e.type === 'door') {
    e.behavior.open = !e.behavior.open;
    sim.emit('change', { entity: sim.serialize(e) });
    return true;
  }
  if (e.type === 'button') {
    e.behavior.pressed = !e.behavior.pressed;
    sim.emit('change', { entity: sim.serialize(e) });
    for (const d of sim.entities.values())
      if (
        d.type === 'door' &&
        d.owner === e.owner &&
        d.body.position.distanceTo(e.body.position) < 30
      ) {
        d.behavior.open = e.behavior.pressed;
        sim.emit('change', { entity: sim.serialize(d) });
      }
    return true;
  }
  if (e.type === 'lamp' || e.type === 'neon') {
    e.behavior.lit = !e.behavior.lit;
    sim.emit('change', { entity: sim.serialize(e) });
    return true;
  }
  return false;
}
export function stepBehaviors(sim, actors, dt) {
  let blasts = 0;
  for (const e of [...sim.entities.values()]) {
    if (e.behavior.detonate && blasts++ < 5) {
      const p = e.body.position.clone();
      sim.removeGroup(e.group);
      explode(sim, p);
      continue;
    }
    const near = [...actors.values()].some(
      (a) => a.state.body.position.distanceTo(e.body.position) < 70,
    );
    if (
      e.behavior.npc &&
      near &&
      !e.frozen &&
      !e.behavior.pose &&
      (e.behavior.stun || 0) < sim.time
    ) {
      const t = sim.time * 0.5,
        home = new C.Vec3(e.behavior.homeX || 0, e.body.position.y, e.behavior.homeZ || 0),
        goal = home.vadd(new C.Vec3(Math.sin(t) * 5, 0, Math.cos(t) * 5));
      const delta = goal.vsub(e.body.position);
      delta.y = 0;
      delta.normalize();
      e.body.velocity.x += (delta.x * 1.8 - e.body.velocity.x) * Math.min(1, dt * 3);
      e.body.velocity.z += (delta.z * 1.8 - e.body.velocity.z) * Math.min(1, dt * 3);
      const up = e.body.vectorToWorldFrame(new C.Vec3(0, 1, 0)),
        axis = up.cross(new C.Vec3(0, 1, 0));
      e.body.torque.vadd(axis.scale(180), e.body.torque);
      e.body.angularVelocity.scale(0.94, e.body.angularVelocity);
      // A soft hover support holds the torso over its feet, while limbs remain jointed physics.
      const ground = new C.RaycastResult();
      sim.world.raycastAll(
        e.body.position,
        e.body.position.vadd(new C.Vec3(0, -4, 0)),
        { collisionFilterMask: 1, skipBackfaces: true },
        (hit) => {
          if (!hit.body.entityId && (!ground.hasHit || hit.distance < ground.distance)) {
            ground.hasHit = true;
            ground.set(
              hit.rayFromWorld,
              hit.rayToWorld,
              hit.hitNormalWorld,
              hit.hitPointWorld,
              hit.shape,
              hit.body,
              hit.distance,
            );
          }
        },
      );
      if (ground.hasHit && !ground.body.entityId)
        e.body.applyForce(
          new C.Vec3(
            0,
            Math.max(
              0,
              [...sim.entities.values()]
                .filter((b) => b.group === e.group)
                .reduce((sum, b) => sum + b.body.mass, 0) *
                (Math.abs(sim.world.gravity.y) +
                  (1.85 - ground.distance) * 20 -
                  e.body.velocity.y * 6),
            ),
            0,
          ),
        );
      const limbs = [...sim.entities.values()].filter(
        (b) => b.group === e.group && b.type === 'limb',
      );
      for (let i = 0; i < limbs.length; i++) {
        const leg = limbs[i];
        leg.body.torque.x += Math.sin(sim.time * 7 + (i < 4 ? 0 : Math.PI)) * 2.5;
        leg.body.wakeUp();
      }
      e.body.wakeUp();
    }
    if (e.type !== 'trampoline' && e.type !== 'conveyor') continue;
    const bodies = [...sim.entities.values()]
      .filter((b) => b.id !== e.id && !b.frozen)
      .map((b) => b.body)
      .concat(
        [...actors.values()]
          .filter((a) => !a.state.fly && !a.state.vehicleId)
          .map((a) => a.state.body),
      );
    for (const body of bodies) {
      const p = e.body.pointToLocalFrame(body.position);
      const size = e.type === 'trampoline' ? [4, 0.55, 3] : [3, 0.6, 5];
      if (
        Math.abs(p.x) > (size[0] * e.scale) / 2 ||
        Math.abs(p.z) > (size[2] * e.scale) / 2 ||
        p.y < 0.2 ||
        p.y > 1.7 * e.scale
      )
        continue;
      if (e.type === 'trampoline' && body.velocity.y < 0) {
        body.velocity.y = 14;
        body.wakeUp();
        sim.emit('bounce', { p: body.position.toArray() });
      }
      if (e.type === 'conveyor') {
        const forward = e.body.vectorToWorldFrame(new C.Vec3(0, 0, -1));
        body.velocity.x += (forward.x * 6 - body.velocity.x) * dt * 8;
        body.velocity.z += (forward.z * 6 - body.velocity.z) * dt * 8;
        body.wakeUp();
      }
    }
  }
}
export function freezeGroup(sim, id, value = true) {
  const e = sim.entities.get(id);
  if (!e) return;
  for (const b of sim.entities.values())
    if (b.group === e.group) {
      b.behavior.pose = value;
      freeze(sim, b.id, value);
    }
}
