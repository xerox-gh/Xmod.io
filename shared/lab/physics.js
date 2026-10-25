import * as C from 'cannon-es';
import { MATERIALS } from './definitions.js';
import { PROPS } from '../props.js';
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function physicsMaterial(lab, e) {
  const sim = lab.sim;
  if (lab.materialWorld !== sim.world) {
    lab.materialWorld = sim.world;
    lab.materials = { normal: sim.world.defaultMaterial };
    for (const key of Object.keys(MATERIALS).filter((k) => k !== 'normal'))
      lab.materials[key] = new C.Material(key);
    const entries = Object.entries(lab.materials);
    for (let i = 0; i < entries.length; i++)
      for (let j = i; j < entries.length; j++) {
        const a = MATERIALS[entries[i][0]],
          b = MATERIALS[entries[j][0]];
        sim.world.addContactMaterial(
          new C.ContactMaterial(entries[i][1], entries[j][1], {
            friction: a.friction * b.friction,
            restitution: Math.max(a.restitution, b.restitution),
          }),
        );
      }
    for (const [key, material] of entries)
      sim.world.addContactMaterial(
        new C.ContactMaterial(material, sim.world.playerMaterial, {
          friction: 0,
          restitution: MATERIALS[key].restitution,
        }),
      );
  }
  const key = e.behavior.material || 'normal',
    profile = MATERIALS[key] || MATERIALS.normal;
  e.body.material = lab.materials[key] || lab.materials.normal;
  e.body.linearDamping = profile.drag;
  e.body.mass = e.frozen ? 0 : PROPS[e.type].mass * e.scale ** 3 * profile.density;
  e.body.updateMassProperties();
}
export function stepDevices(lab, dt) {
  const sim = lab.sim,
    entities = [...sim.entities.values()];
  for (const c of sim.constraints.values())
    if (['winch', 'hydraulic'].includes(c.type)) {
      const binds = lab.actors.get(c.owner)?.input?.binds || [];
      const direction =
        Number(binds.includes(c.bind || 'KeyJ')) - Number(binds.includes(c.downBind || 'KeyK'));
      const wired = lab.values.get(c.b)?.a;
      c.length = clamp(c.length + direction * (c.speed ?? 3) * dt, 0.4, 60);
      if (wired !== undefined) c.length = clamp(wired, 0.4, 60);
      c.joint.distance = c.length;
      if (c.type === 'winch') {
        if (
          sim.entities.get(c.a).body.position.distanceTo(sim.entities.get(c.b).body.position) >
          c.length
        )
          c.joint.enable();
        else c.joint.disable();
      }
      if (direction || wired !== undefined) {
        sim.entities.get(c.a)?.body.wakeUp();
        sim.entities.get(c.b)?.body.wakeUp();
      }
    }
  for (const e of entities) {
    const b = e.body,
      s = e.behavior;
    if (e.frozen) continue;
    if (s.hover) {
      const binds = lab.actors.get(e.owner)?.input?.binds || [];
      s.height = clamp(
        (s.height ?? 4) +
          (Number(binds.includes(s.bind || 'KeyJ')) -
            Number(binds.includes(s.downBind || 'KeyK'))) *
            3 *
            dt,
        -20,
        100,
      );
      const state = lab.state(e.id),
        error = s.height - b.position.y;
      state.integral = clamp((state.integral || 0) + error * dt, -4, 4);
      const connected = [...sim.constraints.values()].filter(
        (c) => (c.a === e.id || c.b === e.id) && c.type === 'weld',
      );
      const mass =
        b.mass +
        connected.reduce(
          (n, c) => n + (sim.entities.get(c.a === e.id ? c.b : c.a)?.body.mass || 0),
          0,
        );
      b.applyForce(
        new C.Vec3(
          0,
          clamp(
            mass * (-sim.world.gravity.y + error * 16 + state.integral * 1.2 - b.velocity.y * 8),
            -mass * 30,
            mass * 80,
          ),
          0,
        ),
      );
      b.wakeUp();
    }
    if (s.upright) {
      const q = b.quaternion,
        yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
      b.quaternion.setFromEuler(0, yaw, 0);
      b.angularVelocity.x = b.angularVelocity.z = 0;
      b.angularFactor.set(0, 1, 0);
      b.aabbNeedsUpdate = true;
    } else b.angularFactor.set(1, 1, 1);
    if (s.magnet)
      for (const other of entities) {
        if (other === e || other.frozen) continue;
        const delta = b.position.vsub(other.body.position),
          d = delta.length();
        if (d < 0.3 || d > (s.radius || 10)) continue;
        delta.normalize();
        const strength = (s.strength ?? 12) * (1 - d / (s.radius || 10));
        other.body.applyForce(delta.scale(other.body.mass * strength));
        other.body.wakeUp();
      }
  }
}
