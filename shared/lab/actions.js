import * as C from 'cannon-es';
import { LAB_TOOLS, LAB_JOINTS, cleanLabSettings } from './definitions.js';
import { addConstraint } from '../constraints.js';
import { freeze } from '../grabbing.js';
import { FACTIONS } from './ai.js';
const modeSet = new Set(LAB_TOOLS.map(([id]) => id));
export function labAction(sim, actor, a, own) {
  if (a.kind === 'mode') {
    if (!actor.admin) throw new Error('Only the host can start a mode');
    sim.lab.modes.start(a.mode, { role: a.role });
    return true;
  }
  if (a.kind === 'modeAction') {
    if (a.op === 'disguise') sim.lab.modes.disguise(actor, a.id);
    return true;
  }
  if (a.kind === 'gadget') {
    if (a.op === 'release') {
      sim.lab.grapples.delete(actor.id);
      return true;
    }
    sim.lab.fire(actor, a.weapon, a.button === 2 ? 2 : 0);
    return true;
  }
  if (a.kind === 'labConfig') {
    const e = own(sim, actor, a.id);
    const patch = cleanLabSettings(a.settings);
    Object.assign(e.behavior, patch);
    sim.lab.configure(e);
    if (patch.faction)
      for (const p of sim.entities.values())
        if (p.group === e.group) {
          p.color = FACTIONS[patch.faction];
          if (p.behavior.npc) Object.assign(p.behavior, patch);
          sim.emit('change', { entity: sim.serialize(p) });
        }
    if (patch.command === 'guard') {
      e.behavior.guardX = e.body.position.x;
      e.behavior.guardZ = e.body.position.z;
    }
    sim.emit('change', { entity: sim.serialize(e) });
    return true;
  }
  if (a.kind === 'environment') {
    if (!actor.admin) throw new Error('Only the room owner can set wind and currents');
    for (const key of ['windX', 'windZ', 'currentX', 'currentZ', 'whirlpool'])
      if (Number.isFinite(a[key])) sim.lab.environment[key] = Math.max(-20, Math.min(20, a[key]));
    sim.emit('environment', { value: sim.lab.environment });
    return true;
  }
  if (a.kind !== 'tool' || !modeSet.has(a.mode)) return false;
  const e = own(sim, actor, a.id),
    s = { ...cleanLabSettings(a) };
  if (LAB_JOINTS.includes(a.mode)) {
    const b = own(sim, actor, a.other),
      point =
        Array.isArray(a.point) && a.point.length === 3 && a.point.every(Number.isFinite)
          ? a.point
          : e.body.position.toArray();
    if (new C.Vec3(...point).distanceTo(e.body.position) > e.body.boundingRadius + 2)
      throw new Error('Invalid pivot');
    const anchors =
      Array.isArray(a.anchors) &&
      a.anchors.length >= 1 &&
      a.anchors.length <= 4 &&
      a.anchors.every(
        (p) =>
          Array.isArray(p) &&
          p.length === 3 &&
          p.every((n) => Number.isFinite(n) && Math.abs(n) < 170),
      )
        ? a.anchors
        : undefined;
    const c = addConstraint(sim, a.mode, e.id, b.id, actor.id, point, point, {
      ...s,
      axis: a.axis === 'x' ? [1, 0, 0] : a.axis === 'z' ? [0, 0, 1] : [0, 1, 0],
      anchors,
      input: s.input || 'a',
      color: /^#[\da-f]{6}$/i.test(a.color) ? a.color : '#87d8cc',
    });
    if (a.mode === 'pulley') {
      c.anchors = c.joint.anchors;
      c.length = c.joint.rope.length;
    }
    sim.remember(actor.id, { constraint: c.id });
    return true;
  }
  if (a.mode === 'portalLink' || a.mode === 'cameraLink') {
    const b = own(sim, actor, a.other),
      portal = a.mode === 'portalLink';
    if (portal && (e.type !== 'telepad' || b.type !== 'telepad'))
      throw new Error('Select two portal pads');
    if (
      !portal &&
      !((e.type === 'cctv' && b.type === 'monitor') || (e.type === 'monitor' && b.type === 'cctv'))
    )
      throw new Error('Select a camera and a monitor');
    e.behavior[portal ? 'portal' : 'camera'] = b.id;
    b.behavior[portal ? 'portal' : 'camera'] = e.id;
    for (const entity of [e, b]) sim.emit('change', { entity: sim.serialize(entity) });
    return true;
  }
  if (a.mode === 'hover') {
    const ball = sim.spawn(
      'hoverball',
      e.body.position.vadd(new C.Vec3(0, 1, 0)).toArray(),
      actor.id,
      {
        behavior: {
          hover: true,
          height: s.height ?? e.body.position.y + 1,
          bind: s.bind || 'KeyJ',
          downBind: s.downBind || 'KeyK',
        },
      },
    );
    addConstraint(
      sim,
      'weld',
      e.id,
      ball.id,
      actor.id,
      e.body.position.toArray(),
      ball.body.position.toArray(),
    );
    sim.remember(actor.id, { group: ball.group });
    return true;
  }
  const before = { ...e.behavior };
  if (a.mode === 'upright') e.behavior.upright = !e.behavior.upright;
  if (a.mode === 'magnet')
    Object.assign(e.behavior, { magnet: true, strength: s.strength ?? 12, radius: s.radius ?? 10 });
  if (a.mode === 'properties') e.behavior.material = s.material || 'rubber';
  if (a.mode === 'buoyancy') e.behavior.buoyancy = s.buoyancy ?? 1.3;
  if (a.mode === 'trail') e.behavior.trail = s.trail || 'rainbow';
  sim.lab.configure(e);
  sim.emit('change', { entity: sim.serialize(e) });
  sim.remember(actor.id, {
    restore: () => {
      if (sim.entities.has(e.id)) {
        e.behavior = before;
        sim.lab.configure(e);
        sim.emit('change', { entity: sim.serialize(e) });
      }
    },
  });
  return true;
}
