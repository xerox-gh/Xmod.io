import * as C from 'cannon-es';
import { LIMITS } from './constants.js';
import { freeze } from './grabbing.js';
import { SliderConstraint } from './slider.js';
const v = (a) => new C.Vec3(...a);
export function addConstraint(sim, type, a, b, owner, pointA, pointB, options = {}) {
  if (sim.constraints.size >= LIMITS.constraints) throw new Error('Constraint limit reached');
  const ea = sim.entities.get(a),
    eb = sim.entities.get(b);
  if (!ea || !eb || a === b) throw new Error('Select two different props');
  let joint;
  if (type === 'weld') joint = new C.LockConstraint(ea.body, eb.body, { maxForce: 1e6 });
  else if (type === 'rope')
    joint = new C.DistanceConstraint(
      ea.body,
      eb.body,
      options.length || Math.max(0.5, ea.body.position.distanceTo(eb.body.position)),
      4e4,
    );
  else if (['wheel', 'hinge', 'motor'].includes(type)) {
    const axis = v(options.axis || [1, 0, 0]);
    joint = new C.HingeConstraint(ea.body, eb.body, {
      pivotA: ea.body.pointToLocalFrame(v(pointA)),
      pivotB: eb.body.pointToLocalFrame(v(pointB)),
      axisA: options.axisA ? v(options.axisA) : ea.body.vectorToLocalFrame(axis),
      axisB: options.axisB ? v(options.axisB) : eb.body.vectorToLocalFrame(axis),
      collideConnected: false,
      maxForce: 8e4,
    });
    if (type !== 'hinge') joint.enableMotor();
    joint.setMotorMaxForce(120);
    joint.setMotorSpeed(0);
  } else if (type === 'slider') {
    joint = new SliderConstraint(
      ea.body,
      eb.body,
      options.axisA ? ea.body.vectorToWorldFrame(v(options.axisA)) : v(options.axis || [1, 0, 0]),
      options.travel || 4,
    );
  } else if (type === 'joint')
    joint = new C.ConeTwistConstraint(ea.body, eb.body, {
      pivotA: v(options.pivotA),
      pivotB: v(options.pivotB),
      axisA: v([0, 1, 0]),
      axisB: v([0, 1, 0]),
      angle: Math.PI / 3,
      twistAngle: Math.PI / 3,
      maxForce: 2e4,
    });
  else throw new Error('Invalid constraint');
  joint.collideConnected = false;
  sim.world.addConstraint(joint);
  const id = sim.id('c');
  const record = {
    id,
    type,
    a,
    b,
    owner,
    pa: ea.body.pointToLocalFrame(v(pointA || ea.body.position.toArray())).toArray(),
    pb: eb.body.pointToLocalFrame(v(pointB || eb.body.position.toArray())).toArray(),
    length: ea.body.position.distanceTo(eb.body.position),
    joint,
    ...options,
    a,
    b,
    id,
    owner,
    joint,
  };
  record.pa = (
    joint.pivotA || ea.body.pointToLocalFrame(v(pointA || ea.body.position.toArray()))
  ).toArray();
  record.pb = (
    joint.pivotB || eb.body.pointToLocalFrame(v(pointB || eb.body.position.toArray()))
  ).toArray();
  sim.constraints.set(id, record);
  sim.emit('constraint', { constraint: serializeConstraint(record) });
  return record;
}
export function serializeConstraint(c) {
  const { joint, ...data } = c;
  if (c.type === 'slider' && joint) data.axisA = joint.railAxis.toArray();
  if (joint?.axisA) data.axisA = joint.axisA.toArray();
  if (joint?.axisB) data.axisB = joint.axisB.toArray();
  return data;
}
export function removeConstraint(sim, id) {
  const c = sim.constraints.get(id);
  if (!c) return;
  sim.world.removeConstraint(c.joint);
  sim.constraints.delete(id);
  sim.emit('unconstraint', { id });
}
export function resize(sim, id, scale) {
  const e = sim.entities.get(id);
  if (!e) return;
  const old = e.scale;
  scale = Math.max(0.35, Math.min(4, scale));
  // Replacing the collision shape preserves the body identity used by every joint.
  const next = sim.makeBody(e.type, scale);
  while (e.body.shapes.length) e.body.removeShape(e.body.shapes[0]);
  next.shapes.forEach((shape, i) =>
    e.body.addShape(shape, next.shapeOffsets[i], next.shapeOrientations[i]),
  );
  e.scale = scale;
  e.body.mass = e.frozen ? 0 : next.mass;
  e.body.updateMassProperties();
  e.body.updateBoundingRadius();
  e.body.aabbNeedsUpdate = true;
  e.body.wakeUp();
  for (const c of [...sim.constraints.values()])
    if (c.a === id || c.b === id) removeConstraint(sim, c.id);
  sim.emit('change', { entity: sim.serialize(e) });
  return old;
}
export function stepAttachments(sim, actors) {
  for (const c of sim.constraints.values()) {
    const a = sim.entities.get(c.a),
      b = sim.entities.get(c.b);
    if (!a || !b) continue;
    if (c.type === 'rope') {
      if (a.body.position.distanceTo(b.body.position) > c.length) c.joint.enable();
      else c.joint.disable();
    }
    const input = actors.get(c.owner)?.input;
    const active = !!(
      input?.binds?.includes(c.bind || 'KeyF') ||
      ((!c.bind || c.bind === 'KeyF') && input?.activate) ||
      [...sim.entities.values()].some(
        (e) => e.owner === c.owner && e.type === 'button' && e.behavior.pressed,
      )
    );
    if (c.type === 'wheel' || c.type === 'motor') {
      c.joint.setMotorSpeed(active ? (c.speed ?? -18) : 0);
      if (active) {
        a.body.wakeUp();
        b.body.wakeUp();
      }
    }
    if (c.effect === 'door') {
      const q = a.body.quaternion.inverse().mult(b.body.quaternion);
      const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
      c.joint.enableMotor();
      c.joint.setMotorSpeed(Math.max(-2, Math.min(2, (yaw - (b.behavior.open ? 1.4 : 0)) * 5)));
    }
    if (c.effect === 'thruster' && active) {
      const direction = b.body.vectorToWorldFrame(new C.Vec3(0, 1, 0));
      a.body.applyForce(
        direction.scale(Math.min(2400, a.body.mass * 35)),
        b.body.position.vsub(a.body.position),
      );
      a.body.wakeUp();
    }
    if (c.effect === 'balloon') {
      b.body.applyForce(new C.Vec3(0, 80, 0));
      b.body.wakeUp();
    }
  }
}
export function attachDevice(sim, actor, target, kind, point, normal) {
  if (sim.constraints.size >= LIMITS.constraints) throw new Error('Constraint limit reached');
  const p = v(point),
    n = v(normal);
  if (n.length() < 0.1) n.set(0, 1, 0);
  n.normalize();
  const entity = sim.spawn(kind, p.vadd(n.scale(kind === 'balloon' ? 2 : 0.5)).toArray(), actor.id);
  entity.body.quaternion.setFromVectors(new C.Vec3(0, 1, 0), n);
  if (!sim.entities.has(target.id)) {
    sim.remove(entity.id);
    throw new Error('Make room before attaching more objects');
  }
  const type = kind === 'wheel' ? 'wheel' : kind === 'balloon' ? 'rope' : 'weld';
  const c = addConstraint(sim, type, target.id, entity.id, actor.id, point, point, {
    axis: n.toArray(),
    effect: kind,
  });
  if (kind !== 'balloon') freeze(sim, entity.id, false);
  sim.remember(actor.id, { group: entity.group });
  return entity;
}
