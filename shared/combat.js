import * as C from 'cannon-es';
import { hitEntity } from './behaviors.js';
import { WEAPONS } from './weapons.js';
export function loadout(actor, id, time) {
  actor.loadout ??= {};
  const def = WEAPONS[id];
  if (!Object.hasOwn(WEAPONS, id)) throw new Error('Unknown weapon');
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
export function shoot(sim, actor, id, aiming = false) {
  const def = WEAPONS[id],
    s = loadout(actor, id, sim.time);
  if (s.reloading || sim.time + 1e-6 < s.next) {
    // A held trigger can arrive just before the next server tick. Ignore it
    // without consuming ammo or flooding the builder with error toasts.
    if (def.automatic) return false;
    throw new Error('Weapon is not ready');
  }
  if (s.ammo <= 0) {
    reloadWeapon(sim, actor, id);
    return;
  }
  if (!def.unlimited) s.ammo--;
  s.next = sim.time + def.interval;
  if (def.gadget) return sim.lab.fire(actor, id, 0);
  const st = actor.state,
    origin = st.body.position.vadd(new C.Vec3(0, st.crouched ? 0.25 : 0.65, 0)),
    dir = new C.Vec3(
      -Math.sin(st.yaw) * Math.cos(st.pitch),
      Math.sin(st.pitch),
      -Math.cos(st.yaw) * Math.cos(st.pitch),
    );
  if (id === 'rocket' || id === 'grenade') {
    if (sim.projectiles.size >= 32) {
      const key = sim.projectiles.keys().next().value;
      sim.projectiles.delete(key);
      sim.emit('projectileRemove', { id: key });
    }
    const rocket = {
      id: sim.id('rocket'),
      owner: actor.id,
      kind: id,
      p: origin.vadd(dir.scale(0.8)),
      v: dir.scale(id === 'grenade' ? 16 : 38),
      life: id === 'grenade' ? 2.6 : 5,
    };
    sim.projectiles.set(rocket.id, rocket);
    sim.emit('projectile', {
      id: rocket.id,
      kind: id,
      p: rocket.p.toArray(),
      v: rocket.v.toArray(),
    });
  } else if (id === 'flamethrower') {
    const hit = new C.RaycastResult();
    sim.world.raycastClosest(
      origin,
      origin.vadd(dir.scale(9)),
      { collisionFilterMask: 1, skipBackfaces: true },
      hit,
    );
    const range = hit.hasHit ? hit.distance + 0.8 : 9;
    for (const e of sim.entities.values()) {
      const delta = e.body.position.vsub(origin),
        distance = delta.length();
      if (distance > range || distance < 0.2) continue;
      delta.normalize();
      if (delta.dot(dir) > 0.87) {
        hitEntity(sim, e, 0.2);
        sim.lab.ignite(e);
        if (!e.frozen) e.body.applyImpulse(dir.scale(25));
      }
    }
    sim.emit('flame', { p: origin.vadd(dir.scale(2)).toArray(), dir: dir.toArray() });
  } else {
    const hitIds = new Set();
    const spread = def.spread * (aiming && def.aimFov ? 0.35 : 1);
    for (let i = 0; i < def.pellets; i++) {
      const d = dir.vadd(
        new C.Vec3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
        ),
      );
      d.normalize();
      const end = origin.vadd(d.scale(def.range || 140)),
        result = new C.RaycastResult();
      sim.world.raycastClosest(
        origin,
        end,
        { collisionFilterMask: 1, skipBackfaces: true },
        result,
      );
      if (result.hasHit) {
        const entity = sim.entities.get(result.body.entityId);
        if (entity) hitIds.add(entity.id);
        hitEntity(sim, entity);
        if (entity && id === 'exploder') {
          const p = entity.body.position.clone();
          sim.removeGroup(entity.group);
          explode(sim, p);
        }
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
    sim.lab.modes.shot(actor, hitIds);
  }
  sim.emit('shot', { owner: actor.id, weapon: id, ammo: s.ammo, p: origin.toArray() });
  return true;
}
export function explode(sim, p) {
  for (const e of sim.entities.values()) {
    const delta = e.body.position.vsub(p),
      dist = delta.length();
    if (dist > 9) continue;
    hitEntity(sim, e, 3);
    if (e.frozen) continue;
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
    r.v.y -= (r.kind === 'grenade' ? 20 : 2) * dt;
    if (r.kind === 'grenade' && hit.hasHit && r.life > 0) {
      r.p.copy(hit.hitPointWorld.vadd(hit.hitNormalWorld.scale(0.08)));
      const dot = r.v.dot(hit.hitNormalWorld);
      r.v.vsub(hit.hitNormalWorld.scale(2 * dot), r.v);
      r.v.scale(0.6, r.v);
      sim.emit('projectileBounce', { id, p: r.p.toArray(), v: r.v.toArray() });
      continue;
    }
    if (hit.hasHit || r.life <= 0) {
      explode(sim, hit.hasHit ? hit.hitPointWorld : next);
      sim.projectiles.delete(id);
      sim.emit('projectileRemove', { id });
    } else r.p.copy(next);
  }
}
