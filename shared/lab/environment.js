import * as C from 'cannon-es';
import { connectedEntities } from '../builds.js';
import { clamp } from './physics.js';
function inWater(sim, p) {
  const w = sim.world.map.water;
  return (
    w &&
    Math.abs(p.x - w.p[0]) < w.s[0] / 2 &&
    Math.abs(p.z - w.p[2]) < w.s[1] / 2 &&
    p.y < w.p[1] + 1
  );
}
export function stepEnvironment(lab, dt) {
  const sim = lab.sim,
    env = lab.environment,
    entities = [...sim.entities.values()],
    zones = entities.filter((e) => e.type === 'gravity_zone');
  const bodies = entities
    .filter((e) => !e.frozen)
    .map((e) => ({ body: e.body, e }))
    .concat(
      [...lab.actors.values()]
        .filter((a) => !a.state.fly && !a.state.vehicleId)
        .map((actor) => ({ body: actor.state.body, actor })),
    );
  for (const { body: b, e } of bodies) {
    if (!b.mass) continue;
    for (const zone of zones) {
      const p = zone.body.pointToLocalFrame(b.position),
        size = ((zone.behavior.zoneSize || 8) * zone.scale) / 2;
      if (Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) > size) continue;
      const s = zone.behavior;
      b.applyForce(
        new C.Vec3(
          (s.gx || 0) - sim.world.gravity.x,
          (s.gy || 0) - sim.world.gravity.y,
          (s.gz || 0) - sim.world.gravity.z,
        ).scale(b.mass),
      );
      b.wakeUp();
      break;
    }
    if (e) {
      const drag = Math.min(8, Math.cbrt(b.mass) * 0.4);
      if (env.windX || env.windZ)
        b.applyForce(
          new C.Vec3(
            (env.windX - b.velocity.x * 0.05) * drag,
            0,
            (env.windZ - b.velocity.z * 0.05) * drag,
          ),
        );
      if (e.type === 'wing' && (b.velocity.lengthSquared() > 0.01 || env.windX || env.windZ)) {
        const normal = b.vectorToWorldFrame(new C.Vec3(0, 1, 0)),
          relative = b.velocity.vsub(new C.Vec3(env.windX, 0, env.windZ));
        const forward = b.vectorToWorldFrame(new C.Vec3(0, 0, -1));
        const speed = relative.dot(forward);
        b.applyForce(normal.scale(Math.min(b.mass * 45, speed * speed * (e.behavior.lift ?? 2))));
        b.applyForce(relative.scale(-b.mass * 0.04));
      }
    }
    if (inWater(sim, b.position)) {
      const w = sim.world.map.water,
        dx = b.position.x - w.p[0],
        dz = b.position.z - w.p[2],
        radius = Math.max(2, Math.hypot(dx, dz));
      if (env.currentX || env.currentZ || env.whirlpool)
        b.applyForce(
          new C.Vec3(
            env.currentX + ((-dz - dx * 0.2) / radius) * env.whirlpool,
            0,
            env.currentZ + ((dx - dz * 0.2) / radius) * env.whirlpool,
          ).scale(b.mass * 1.5),
        );
      if (e?.behavior.buoyancy !== undefined) {
        const depth = w.p[1] + 0.4 - b.position.y;
        b.applyForce(
          new C.Vec3(
            0,
            Math.max(
              0,
              b.mass *
                (Math.abs(sim.world.gravity.y) * e.behavior.buoyancy * clamp(depth, 0, 1) -
                  b.velocity.y * 4),
            ),
            0,
          ),
        );
        b.wakeUp();
      }
    }
  }
  stepPortals(lab);
}
function stepPortals(lab) {
  const sim = lab.sim,
    pads = [...sim.entities.values()].filter((e) => e.type === 'telepad' && e.behavior.portal);
  for (const pad of pads) {
    const exit = sim.entities.get(pad.behavior.portal);
    if (!exit || exit.type !== 'telepad') continue;
    const candidates = [...sim.entities.values()]
      .filter((e) => !e.frozen && e !== pad && e !== exit)
      .map((e) => ({ id: e.id, body: e.body, e }))
      .concat(
        [...lab.actors.values()]
          .filter((a) => !a.state.vehicleId)
          .map((actor) => ({ id: actor.id, body: actor.state.body, actor })),
      );
    for (const item of candidates) {
      const p = pad.body.pointToLocalFrame(item.body.position),
        state = lab.state(item.id);
      if (
        (state.portalUntil || 0) > sim.time ||
        Math.abs(p.x) > 1.5 * pad.scale ||
        Math.abs(p.z) > 1.5 * pad.scale ||
        p.y < 0 ||
        p.y > 2.1
      )
        continue;
      const rotation = exit.body.quaternion.mult(pad.body.quaternion.inverse()),
        target = exit.body.position.vadd(exit.body.vectorToWorldFrame(new C.Vec3(0, 2.6, 0)));
      const members = item.e
        ? connectedEntities(sim, item.id).map((id) => ({ id, body: sim.entities.get(id).body }))
        : [item];
      const origin = item.body.position.clone();
      for (const m of members) {
        const relative = m.body.position.vsub(origin);
        rotation.vmult(relative, relative);
        target.vadd(relative, m.body.position);
        rotation.vmult(m.body.velocity, m.body.velocity);
        rotation.vmult(m.body.angularVelocity, m.body.angularVelocity);
        rotation.mult(m.body.quaternion, m.body.quaternion);
        m.body.aabbNeedsUpdate = true;
        m.body.wakeUp();
        lab.state(m.id).portalUntil = sim.time + 1.5;
      }
      sim.emit('teleport', { p: target.toArray() });
    }
  }
}
