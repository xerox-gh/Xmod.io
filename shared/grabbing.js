import * as C from 'cannon-es';
import { LIMITS } from './constants.js';
// The authority creates a constrained anchor; clients only request distance/rotation.
export function grab(sim, actor, id, point, distance = 5) {
  const e = sim.entities.get(id);
  if (!e) throw new Error('Aim at a prop');
  if ([...sim.grabs.values()].some((g) => g.id === id && g.owner !== actor.id))
    throw new Error('That prop is already held');
  release(sim, actor.id);
  if (e.frozen) freeze(sim, id, false);
  const anchor = new C.Body({
    mass: 0,
    type: C.Body.KINEMATIC,
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
  });
  anchor.position.copy(point);
  sim.world.addBody(anchor);
  const pivot = e.body.pointToLocalFrame(point),
    constraint = new C.PointToPointConstraint(
      e.body,
      pivot,
      anchor,
      new C.Vec3(),
      Math.min(1e5, e.body.mass * 2200),
    );
  constraint.collideConnected = false;
  sim.world.addConstraint(constraint);
  e.body.wakeUp();
  sim.grabs.set(actor.id, {
    owner: actor.id,
    id,
    anchor,
    constraint,
    distance: Number.isFinite(distance) ? Math.max(2, Math.min(25, distance)) : 5,
    rotation: e.body.quaternion.clone(),
  });
  sim.emit('grab', { owner: actor.id, id });
}
export function release(sim, owner) {
  const g = sim.grabs.get(owner);
  if (!g) return;
  sim.world.removeConstraint(g.constraint);
  sim.world.removeBody(g.anchor);
  sim.grabs.delete(owner);
  sim.emit('release', { owner, id: g.id });
}
export function freeze(sim, id, value = true) {
  const e = sim.entities.get(id);
  if (!e) return;
  e.frozen = value;
  e.body.type = value ? C.Body.STATIC : C.Body.DYNAMIC;
  e.body.mass = value ? 0 : sim.makeBody(e.type, e.scale).mass;
  e.body.updateMassProperties();
  e.body.velocity.setZero();
  e.body.angularVelocity.setZero();
  e.body.aabbNeedsUpdate = true;
  e.body.wakeUp();
  sim.lab.configure(e);
  sim.emit('change', { entity: sim.serialize(e) });
}
export function updateGrabs(sim, actors, dt) {
  for (const [owner, g] of sim.grabs) {
    const actor = actors.get(owner),
      e = sim.entities.get(g.id);
    if (!actor || !e) {
      release(sim, owner);
      continue;
    }
    const s = actor.state,
      b = s.body,
      dir = new C.Vec3(
        -Math.sin(s.yaw) * Math.cos(s.pitch),
        Math.sin(s.pitch),
        -Math.cos(s.yaw) * Math.cos(s.pitch),
      );
    const origin = new C.Vec3(
        b.position.x,
        b.position.y + (s.crouched ? 0.25 : 0.65),
        b.position.z,
      ),
      target = origin.vadd(dir.scale(g.distance));
    if (target.distanceTo(e.body.position) > LIMITS.reach + 8) {
      release(sim, owner);
      continue;
    }
    // A moving anchor avoids an instantaneous teleport impulse when the camera moves.
    const delta = target.vsub(g.anchor.position);
    delta.scale(Math.min(1, dt * 22), delta);
    g.anchor.position.vadd(delta, g.anchor.position);
    g.anchor.velocity.setZero();
    e.body.wakeUp();
    if (g.rotate) {
      e.body.quaternion.copy(g.rotation);
      e.body.angularVelocity.setZero();
    }
  }
}
