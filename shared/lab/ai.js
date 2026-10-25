import * as C from 'cannon-es';
export const FACTIONS = {
  red: '#dc7d79',
  blue: '#7cadda',
  green: '#8fc58b',
  hostile: '#b986bd',
  friendly: '#a6d6c6',
};
const enemy = (a, b) =>
  a !== b &&
  !(a === 'friendly' && ['blue', 'green'].includes(b)) &&
  !(b === 'friendly' && ['blue', 'green'].includes(a));
export function hurt(lab, e, damage) {
  if (!e) return;
  const root =
    [...lab.sim.entities.values()].find((p) => p.group === e.group && p.behavior.npc) || e;
  if (!root.behavior.npc && root.type !== 'core' && !root.behavior.hiding) return;
  if (root.behavior.hiding) lab.state(root.id).hidingHitAt = lab.sim.time;
  root.behavior.health = (root.behavior.health ?? 100) - damage;
  if (root.behavior.health <= 0 && root.behavior.npc) {
    root.behavior.npc = false;
    lab.state(root.id).deadUntil = lab.sim.time + 12;
    lab.sim.emit('npcDown', { p: root.body.position.toArray() });
  }
  if (root.behavior.health <= 0 && root.behavior.hiding) lab.sim.remove(root.id);
}
function clearRay(sim, a, b, ignore) {
  let blocked = false;
  sim.world.raycastAll(a, b, { collisionFilterMask: 1, skipBackfaces: true }, (hit) => {
    const source = sim.entities.get(ignore),
      other = sim.entities.get(hit.body.entityId);
    if (
      hit.body.entityId !== ignore &&
      !(source && other && source.group === other.group) &&
      hit.distance < a.distanceTo(b) - 1
    )
      blocked = true;
  });
  return !blocked;
}
export function stepAI(lab, dt) {
  const sim = lab.sim,
    actors = [...lab.actors.values()],
    roots = [...sim.entities.values()].filter((e) => e.behavior.npc || e.behavior.nextbot),
    cores = [...sim.entities.values()].filter((e) => e.type === 'core' && e.behavior.health > 0);
  for (const e of sim.entities.values()) {
    const state = lab.state(e.id);
    if (state.deadUntil && sim.time > state.deadUntil) {
      sim.removeGroup(e.group);
      continue;
    }
    if (e.type === 'turret' && e.behavior.turret && (lab.values.get(e.id)?.a ?? 1) > 0) {
      const target = roots
        .filter((n) => enemy(e.behavior.faction || 'friendly', n.behavior.faction || 'friendly'))
        .sort(
          (a, b) =>
            a.body.position.distanceTo(e.body.position) -
            b.body.position.distanceTo(e.body.position),
        )[0];
      if (target && target.body.position.distanceTo(e.body.position) < 40) {
        const d = target.body.position.vsub(e.body.position);
        const local = e.body.vectorToLocalFrame(d);
        state.turretYaw = Math.atan2(-local.x, -local.z);
        state.turretPitch = Math.atan2(local.y, Math.hypot(local.x, local.z));
        if (
          (state.attackAt || 0) < sim.time &&
          clearRay(sim, e.body.position, target.body.position, e.id)
        ) {
          state.attackAt = sim.time + 0.35;
          hurt(lab, target, 15);
          target.body.applyImpulse(d.unit().scale(25));
          sim.emit('tracer', {
            from: e.body.position.toArray(),
            to: target.body.position.toArray(),
            hit: true,
          });
        }
      }
    }
  }
  for (const e of roots) {
    const s = e.behavior,
      b = e.body,
      state = lab.state(e.id);
    if (e.frozen || s.pose || (s.stun || 0) > sim.time) continue;
    const faction = s.faction || 'friendly';
    const targets = roots
      .filter((n) => n !== e && enemy(faction, n.behavior.faction || 'friendly'))
      .map((e) => ({ e, body: e.body }));
    if (faction === 'hostile' || s.nextbot)
      targets.push(
        ...actors.map((actor) => ({ actor, body: actor.state.body })),
        ...cores.map((e) => ({ e, body: e.body })),
      );
    targets.sort(
      (a, c) => a.body.position.distanceTo(b.position) - c.body.position.distanceTo(b.position),
    );
    const target = targets.find((t) => t.body.position.distanceTo(b.position) < 55),
      actor = actors.find((a) => a.id === e.owner) || actors[0];
    let goal;
    if (target) goal = target.body.position;
    else if (s.command === 'follow' && actor) goal = actor.state.body.position;
    else if (s.command === 'guard')
      goal = new C.Vec3(s.guardX ?? b.position.x, b.position.y, s.guardZ ?? b.position.z);
    else continue; // The original jointed walker supplies wandering and balance.
    const d = goal.vsub(b.position);
    const aim = b.vectorToLocalFrame(d);
    state.aimYaw = Math.atan2(-aim.x, -aim.z);
    state.aimPitch = Math.atan2(aim.y, Math.hypot(aim.x, aim.z));
    d.y = 0;
    const distance = d.normalize(),
      speed = s.nextbot ? s.speed || 12 : Math.max(1, Math.min(6, s.speed || 2.8));
    const stop = target ? (s.npcWeapon === 'ranged' ? 10 : 1.7) : s.command === 'follow' ? 3 : 1;
    const feeler = b.position.vadd(d.scale(2.5)),
      hit = new C.RaycastResult();
    sim.world.raycastClosest(
      b.position,
      feeler,
      { collisionFilterMask: 1, skipBackfaces: true },
      hit,
    );
    if (hit.hasHit && hit.body.entityId !== target?.e?.id && hit.body.entityId !== e.id) {
      const side = new C.Vec3(-d.z, 0, d.x);
      const right = new C.RaycastResult();
      sim.world.raycastClosest(
        b.position,
        b.position.vadd(side.scale(3)),
        { collisionFilterMask: 1 },
        right,
      );
      d.vadd(side.scale(right.hasHit ? -1 : 1), d);
      d.normalize();
      if (Math.abs(b.velocity.y) < 0.8) b.velocity.y = s.nextbot ? 8 : 5;
    }
    if (distance > stop) {
      b.velocity.x += (d.x * speed - b.velocity.x) * Math.min(1, dt * 7);
      b.velocity.z += (d.z * speed - b.velocity.z) * Math.min(1, dt * 7);
    } else {
      b.velocity.x = 0;
      b.velocity.z = 0;
    }
    if (
      target &&
      distance < (s.npcWeapon === 'ranged' ? 25 : 2.6) &&
      (state.attackAt || 0) < sim.time &&
      clearRay(sim, b.position, target.body.position, e.id)
    ) {
      state.attackAt = sim.time + (s.npcWeapon === 'ranged' ? 0.9 : 0.65);
      if (target.e) hurt(lab, target.e, 12);
      else target.actor.health = Math.max(0, (target.actor.health ?? 100) - (s.nextbot ? 30 : 8));
      if (s.npcWeapon === 'ranged')
        sim.emit('tracer', {
          from: b.position.toArray(),
          to: target.body.position.toArray(),
          hit: true,
        });
      else sim.emit('dummyHit', { p: target.body.position.toArray(), power: 1 });
      if (s.npcWeapon === 'ranged')
        sim.emit('shot', { owner: e.id, weapon: 'pistol', ammo: 0, p: b.position.toArray() });
    }
    b.wakeUp();
  }
}
