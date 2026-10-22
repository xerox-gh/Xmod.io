import * as C from 'cannon-es';
import { WEAPONS } from './weapons.js';
export function loadout(actor, id, time) {
  actor.loadout ??= {};
  const def = WEAPONS[id];
  if (!def) throw new Error('Unknown weapon');
  const state = (actor.loadout[id] ??= { ammo: def.capacity, next: 0, reloading: 0 });
  if (state.reloading && time >= state.reloading) {
    state.ammo = def.capacity;
    state.reloading = 0;
  }
  return state;
}
export function reloadWeapon(sim, actor, id) {
  const def = WEAPONS[id],
    s = loadout(actor, id, sim.time);
  if (!s.reloading && s.ammo < def.capacity) {
    s.reloading = sim.time + def.reload;
    sim.emit('reload', { owner: actor.id, weapon: id, duration: def.reload });
  }
}
export function shoot(sim, actor, id) {
  const def = WEAPONS[id],
    s = loadout(actor, id, sim.time);
  if (s.reloading || sim.time < s.next) throw new Error('Weapon is not ready');
  if (s.ammo <= 0) {
    reloadWeapon(sim, actor, id);
    return;
  }
  s.ammo--;
  s.next = sim.time + def.interval;
  const st = actor.state,
    origin = st.body.position.vadd(new C.Vec3(0, st.crouched ? 0.25 : 0.65, 0)),
    dir = new C.Vec3(
      -Math.sin(st.yaw) * Math.cos(st.pitch),
      Math.sin(st.pitch),
      -Math.cos(st.yaw) * Math.cos(st.pitch),
    );
  if (id === 'rocket') {
    if (sim.projectiles.size >= 32) {
      const key = sim.projectiles.keys().next().value;
      sim.projectiles.delete(key);
      sim.emit('projectileRemove', { id: key });
    }
    const rocket = {
      id: sim.id('rocket'),
      owner: actor.id,
      p: origin.vadd(dir.scale(0.8)),
      v: dir.scale(38),
      life: 5,
    };
    sim.projectiles.set(rocket.id, rocket);
    sim.emit('projectile', { id: rocket.id, p: rocket.p.toArray(), v: rocket.v.toArray() });
  } else
    for (let i = 0; i < def.pellets; i++) {
      const d = dir.vadd(
        new C.Vec3(
          (Math.random() - 0.5) * def.spread,
          (Math.random() - 0.5) * def.spread,
          (Math.random() - 0.5) * def.spread,
        ),
      );
      d.normalize();
      const end = origin.vadd(d.scale(140)),
        result = new C.RaycastResult();
      sim.world.raycastClosest(
        origin,
        end,
        { collisionFilterMask: 1, skipBackfaces: true },
        result,
      );
      if (result.hasHit) {
        const entity = sim.entities.get(result.body.entityId);
        if (entity && !entity.frozen) {
          entity.body.applyImpulse(
            d.scale(def.impulse),
            result.hitPointWorld.vsub(entity.body.position),
          );
          entity.body.wakeUp();
        }
      }
      sim.emit('tracer', {
        from: origin.toArray(),
        to: (result.hasHit ? result.hitPointWorld : end).toArray(),
        hit: result.hasHit,
      });
    }
  sim.emit('shot', { owner: actor.id, weapon: id, ammo: s.ammo, p: origin.toArray() });
}
export function explode(sim, p) {
  for (const e of sim.entities.values()) {
    const delta = e.body.position.vsub(p),
      dist = delta.length();
    if (dist > 9 || e.frozen) continue;
    delta.normalize();
    delta.y += 0.25;
    e.body.applyImpulse(delta.scale((1 - dist / 9) * Math.min(2500, e.body.mass * 30)));
    e.body.wakeUp();
  }
  sim.emit('explosion', { p: p.toArray() });
}
export function stepProjectiles(sim, dt) {
  for (const [id, r] of sim.projectiles) {
    const next = r.p.vadd(r.v.scale(dt)),
      hit = new C.RaycastResult();
    sim.world.raycastClosest(r.p, next, { collisionFilterMask: 1, skipBackfaces: true }, hit);
    r.life -= dt;
    r.v.y -= 2 * dt;
    if (hit.hasHit || r.life <= 0) {
      explode(sim, hit.hasHit ? hit.hitPointWorld : next);
      sim.projectiles.delete(id);
      sim.emit('projectileRemove', { id });
    } else r.p.copy(next);
  }
}
