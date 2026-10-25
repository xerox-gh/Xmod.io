import * as C from 'cannon-es';
import { freeze } from '../grabbing.js';
import { resize } from '../constraints.js';
import { clamp } from './physics.js';
export const GADGETS = {
  grapple: {
    name: 'Grappling hook',
    hint: 'LMB hook · RMB release · J reel / K extend · F pull prop',
  },
  odm: {
    name: 'Dual tether gear',
    hint: 'LMB left / RMB right hook · R release · J reel / K extend',
  },
  swap: { name: 'Swap gun', hint: 'LMB select prop A, then prop B · swaps position and velocity' },
  singularity: {
    name: 'Singularity grenade',
    hint: 'LMB throw · three-second vortex, then outward blast',
  },
  cryo: { name: 'Cryo ray', hint: 'LMB freeze prop / create ice patch · hard hits thaw props' },
  scale_ray: {
    name: 'Scale ray',
    hint: 'LMB grow · RMB shrink · mass and collider change together',
  },
  rc: {
    name: 'RC controller',
    hint: 'LMB link vehicle / contraption · WASD remote drive · RMB disconnect',
  },
};
const aim = (actor) => {
  const s = actor.state;
  return {
    origin: s.body.position.vadd(new C.Vec3(0, s.crouched ? 0.25 : 0.65, 0)),
    dir: new C.Vec3(
      -Math.sin(s.yaw) * Math.cos(s.pitch),
      Math.sin(s.pitch),
      -Math.cos(s.yaw) * Math.cos(s.pitch),
    ),
  };
};
export function fireGadget(lab, actor, id, button = 0) {
  const sim = lab.sim,
    now = sim.time,
    state = lab.state('gadget_' + actor.id),
    { origin, dir } = aim(actor);
  if ((state[id] || -1) > now) return false;
  state[id] = now + 0.15;
  const hit = new C.RaycastResult();
  sim.world.raycastClosest(
    origin,
    origin.vadd(dir.scale(60)),
    { collisionFilterMask: 1, skipBackfaces: true },
    hit,
  );
  const e = sim.entities.get(hit.body?.entityId);
  if (id === 'grapple' || id === 'odm') {
    if (button === 2 && id === 'grapple') {
      lab.grapples.delete(actor.id);
      return true;
    }
    if (!hit.hasHit) return false;
    const hooks = lab.grapples.get(actor.id) || {},
      key = button === 2 ? 'right' : 'left';
    hooks[key] = {
      id: e?.id,
      point: e ? e.body.pointToLocalFrame(hit.hitPointWorld) : hit.hitPointWorld.clone(),
      length: Math.max(2, hit.distance),
    };
    lab.grapples.set(actor.id, hooks);
  } else if (id === 'singularity') {
    if (lab.singularities.size >= 8) throw new Error('Eight singularities is the limit');
    const record = {
      id: sim.id('vortex'),
      p: origin.vadd(dir.scale(1)),
      v: dir.scale(18),
      phase: 'thrown',
      until: now + 0.8,
    };
    lab.singularities.set(record.id, record);
  } else if (id === 'cryo') {
    if (!hit.hasHit) return false;
    if (e) {
      e.behavior.cryo = true;
      e.behavior.material = 'ice';
      freeze(sim, e.id, true);
      sim.emit('change', { entity: sim.serialize(e) });
    }
    let floor = hit.hitPointWorld.clone(),
      distance = 30;
    sim.world.raycastAll(
      floor.vadd(new C.Vec3(0, 1, 0)),
      floor.vadd(new C.Vec3(0, -25, 0)),
      { collisionFilterMask: 1, skipBackfaces: true },
      (ground) => {
        if (!ground.body.entityId && ground.hitNormalWorld.y > 0.4 && ground.distance < distance) {
          distance = ground.distance;
          floor = ground.hitPointWorld.clone();
        }
      },
    );
    lab.ice.push({ p: floor.toArray(), until: now + 20 });
    if (lab.ice.length > 16) lab.ice.shift();
    sim.emit('ice', { p: floor.toArray() });
  } else if (id === 'rc') {
    if (button === 2) {
      if (actor.rc && sim.vehicles.get(actor.rc)?.driver === actor.id)
        sim.vehicles.get(actor.rc).driver = null;
      actor.rc = null;
      return true;
    }
    if (!e) return false;
    if (e.owner !== actor.id && e.owner !== 'world' && !actor.admin)
      throw new Error('Link your own vehicle');
    const car = sim.vehicles.get(e.id);
    if (car?.driver && car.driver !== actor.id) throw new Error('Vehicle already has a driver');
    if (actor.rc && sim.vehicles.get(actor.rc)?.driver === actor.id)
      sim.vehicles.get(actor.rc).driver = null;
    actor.rc = e.id;
    actor.state.body.velocity.setZero();
    if (car) car.driver = actor.id;
  } else {
    if (!e) return false;
    if (e.owner !== actor.id && e.owner !== 'world' && !actor.admin)
      throw new Error('Use this gadget on your own props');
    if (id === 'scale_ray')
      lab.state(e.id).targetScale = clamp(
        (lab.state(e.id).targetScale || e.scale) * (button === 2 ? 0.7 : 1.4),
        0.35,
        4,
      );
    if (id === 'swap') {
      const first = sim.entities.get(state.swapTarget);
      if (!first || first === e) {
        state.swapTarget = e.id;
        sim.emit('gadgetHint', {
          owner: actor.id,
          text: 'First prop selected · shoot a second prop',
        });
        return true;
      }
      const before = [first, e].map((p) => ({
        id: p.id,
        p: p.body.position.clone(),
        v: p.body.velocity.clone(),
        q: p.body.quaternion.clone(),
        w: p.body.angularVelocity.clone(),
      }));
      for (let i = 0; i < 2; i++) {
        const b = [first, e][i].body,
          from = before[1 - i];
        b.position.copy(from.p);
        b.velocity.copy(from.v);
        b.quaternion.copy(from.q);
        b.angularVelocity.copy(from.w);
        b.aabbNeedsUpdate = true;
        b.wakeUp();
        sim.emit('change', { entity: sim.serialize([first, e][i]) });
      }
      sim.remember(actor.id, {
        restore: () => {
          for (const old of before) {
            const item = sim.entities.get(old.id);
            if (item) {
              item.body.position.copy(old.p);
              item.body.velocity.copy(old.v);
              item.body.quaternion.copy(old.q);
              item.body.angularVelocity.copy(old.w);
              item.body.aabbNeedsUpdate = true;
              sim.emit('change', { entity: sim.serialize(item) });
            }
          }
        },
      });
      state.swapTarget = null;
    }
  }
  sim.emit('gadget', {
    weapon: id,
    from: origin.toArray(),
    to: hit.hasHit ? hit.hitPointWorld.toArray() : origin.vadd(dir.scale(60)).toArray(),
  });
  return true;
}
export function stepGadgets(lab, dt) {
  const sim = lab.sim;
  for (const [owner, hooks] of lab.grapples) {
    const actor = lab.actors.get(owner);
    if (!actor) {
      lab.grapples.delete(owner);
      continue;
    }
    for (const hook of Object.values(hooks)) {
      const prop = sim.entities.get(hook.id);
      if (hook.id && !prop) continue;
      const anchor = prop ? prop.body.pointToWorldFrame(hook.point) : hook.point,
        body = actor.state.body,
        delta = anchor.vsub(body.position),
        distance = delta.normalize();
      const binds = actor.input?.binds || [];
      hook.length = clamp(
        hook.length + (Number(binds.includes('KeyK')) - Number(binds.includes('KeyJ'))) * 10 * dt,
        1.5,
        60,
      );
      const extension = distance - hook.length;
      if (binds.includes('KeyF') && prop && !prop.frozen) {
        prop.body.applyForce(delta.scale(-Math.min(10000, prop.body.mass * 35)));
        prop.body.wakeUp();
      } else if (extension > 0) {
        body.applyForce(delta.scale(Math.min(body.mass * 80, extension * body.mass * 35)));
        const outward = body.velocity.dot(delta);
        if (outward < 0) body.velocity.vsub(delta.scale(outward * 0.7), body.velocity);
        if (prop && !prop.frozen) {
          prop.body.applyForce(delta.scale(-Math.min(5000, extension * body.mass * 20)));
          prop.body.wakeUp();
        }
      }
    }
  }
  for (const e of sim.entities.values()) {
    const state = lab.state(e.id);
    if (state.thaw) {
      state.thaw = false;
      lab.hit(e, 1);
    }
    if (state.targetScale !== undefined) {
      const next = e.scale + (state.targetScale - e.scale) * Math.min(1, dt * 7);
      if (Math.abs(next - e.scale) > 0.008) {
        resize(sim, e.id, next);
        lab.configure(e);
      } else delete state.targetScale;
    }
  }
  for (const [id, r] of lab.singularities) {
    if (r.phase === 'thrown') {
      const next = r.p.vadd(r.v.scale(dt)),
        hit = new C.RaycastResult();
      sim.world.raycastClosest(r.p, next, { collisionFilterMask: 1 }, hit);
      r.p.copy(hit.hasHit ? hit.hitPointWorld : next);
      r.v.y -= 20 * dt;
      if (hit.hasHit || sim.time >= r.until) {
        r.phase = 'vortex';
        r.until = sim.time + 3;
      }
    } else {
      for (const e of sim.entities.values()) {
        if (e.frozen) continue;
        const d = r.p.vsub(e.body.position),
          distance = d.normalize();
        if (distance < 0.4 || distance > 18) continue;
        const swirl = new C.Vec3(-d.z, 0.15, d.x);
        e.body.applyForce(
          d.scale(e.body.mass * 35 * (1 - distance / 18)).vadd(swirl.scale(e.body.mass * 12)),
        );
        e.body.wakeUp();
      }
      if (sim.time >= r.until) {
        for (const e of sim.entities.values()) {
          const d = e.body.position.vsub(r.p),
            distance = d.normalize();
          if (!e.frozen && distance < 18)
            e.body.applyImpulse(d.scale(e.body.mass * 18 * (1 - distance / 18)));
        }
        sim.emit('explosion', { p: r.p.toArray() });
        lab.singularities.delete(id);
      }
    }
  }
  lab.ice = lab.ice.filter((p) => p.until > sim.time);
  sim.world.iceZones = lab.ice;
  for (const e of sim.entities.values())
    if (!e.frozen) {
      const state = lab.state(e.id),
        icy = lab.ice.some(
          (p) =>
            Math.hypot(e.body.position.x - p.p[0], e.body.position.z - p.p[2]) < 3 &&
            Math.abs(e.body.position.y - p.p[1]) < 2,
        );
      if (icy) {
        e.body.material = lab.materials.ice;
        state.tempIce = true;
      } else if (state.tempIce) {
        state.tempIce = false;
        lab.configure(e);
      }
    }
  for (const actor of lab.actors.values()) {
    if (actor.rc && !sim.entities.has(actor.rc)) actor.rc = null;
    const e = sim.entities.get(actor.rc);
    if (e && !sim.vehicles.has(e.id) && !e.frozen) {
      const input = actor.input || {},
        forward = e.body.vectorToWorldFrame(new C.Vec3(0, 0, -1));
      e.body.applyForce(forward.scale(e.body.mass * 20 * (input.forward || 0)));
      e.body.torque.y -= (input.right || 0) * e.body.mass * 8;
      e.body.wakeUp();
    }
  }
}
