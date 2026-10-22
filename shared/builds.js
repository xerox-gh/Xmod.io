import * as C from 'cannon-es';
import { PROPS } from './props.js';
import { MAPS } from './maps.js';
import { LIMITS } from './constants.js';
import { addConstraint, serializeConstraint } from './constraints.js';
import { freeze } from './grabbing.js';
import { setupVehicle } from './vehicles.js';
const vector = (a, n = 3) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
export function connectedEntities(sim, start) {
  const ids = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of sim.entities.values())
      if ([...ids].some((id) => sim.entities.get(id)?.group === e.group) && !ids.has(e.id)) {
        ids.add(e.id);
        changed = true;
      }
    for (const c of sim.constraints.values())
      if (ids.has(c.a) || ids.has(c.b))
        for (const id of [c.a, c.b])
          if (!ids.has(id)) {
            ids.add(id);
            changed = true;
          }
  }
  return [...ids].filter((id) => sim.entities.has(id));
}
export function captureBuild(sim, ids = [...sim.entities.keys()], external = false) {
  const set = new Set(ids);
  return {
    format: 'xmod-build',
    version: 1,
    map: sim.world.map.id,
    entities: [...sim.entities.values()].filter((e) => set.has(e.id)).map((e) => sim.serialize(e)),
    constraints: [...sim.constraints.values()]
      .filter((c) => (external ? set.has(c.a) || set.has(c.b) : set.has(c.a) && set.has(c.b)))
      .map(serializeConstraint),
  };
}
export function validateBuild(data, { external = false } = {}) {
  if (
    !data ||
    data.format !== 'xmod-build' ||
    data.version !== 1 ||
    !Object.hasOwn(MAPS, data.map) ||
    !Array.isArray(data.entities) ||
    data.entities.length > LIMITS.bodies ||
    !Array.isArray(data.constraints) ||
    data.constraints.length > LIMITS.constraints
  )
    throw new Error('Not a supported Xmod build');
  const ids = new Set();
  const entities = data.entities.map((e) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !/^[\w-]{1,64}$/.test(e.id) ||
      ids.has(e.id) ||
      !Object.hasOwn(PROPS, e.type) ||
      !vector(e.p) ||
      e.p.some((v) => Math.abs(v) > 170) ||
      !vector(e.q, 4) ||
      Math.hypot(...e.q) < 0.5 ||
      Math.hypot(...e.q) > 1.5 ||
      !Number.isFinite(e.scale) ||
      e.scale < 0.35 ||
      e.scale > 4 ||
      !/^#[\da-f]{6}$/i.test(e.color)
    )
      throw new Error('Invalid prop in build');
    ids.add(e.id);
    return {
      id: e.id,
      type: e.type,
      owner: typeof e.owner === 'string' ? e.owner : 'local',
      group: typeof e.group === 'string' ? e.group : e.id,
      p: [...e.p],
      q: [...e.q],
      scale: e.scale,
      color: e.color,
      frozen: !!e.frozen,
      behavior: safeBehavior(e.behavior),
    };
  });
  const constraints = data.constraints.map((c) => {
    if (
      !c ||
      !['weld', 'rope', 'wheel', 'joint', 'hinge', 'motor', 'slider'].includes(c.type) ||
      c.a === c.b ||
      (!external && (!ids.has(c.a) || !ids.has(c.b))) ||
      !vector(c.pa) ||
      !vector(c.pb) ||
      c.pa.some((x) => Math.abs(x) > 100) ||
      c.pb.some((x) => Math.abs(x) > 100)
    )
      throw new Error('Invalid constraint in build');
    const out = { type: c.type, a: c.a, b: c.b, pa: [...c.pa], pb: [...c.pb] };
    for (const k of ['axis', 'axisA', 'axisB', 'pivotA', 'pivotB'])
      if (vector(c[k]) && Math.hypot(...c[k]) < 100) out[k] = [...c[k]];
    out.speed = Math.max(-30, Math.min(30, Number(c.speed) || 0));
    out.travel = Math.max(0.25, Math.min(12, Number(c.travel) || 4));
    out.bind = /^Key[FJKLUIO]$/.test(c.bind) ? c.bind : 'KeyF';
    out.effect = ['thruster', 'balloon', 'wheel', 'door'].includes(c.effect) ? c.effect : undefined;
    out.length = Math.max(0.1, Math.min(100, Number(c.length) || 1));
    return out;
  });
  return { ...data, entities, constraints };
}
function safeBehavior(value) {
  const out = {};
  if (value && typeof value === 'object')
    for (const key of ['npc', 'explosive', 'lit', 'open', 'pressed', 'pose'])
      if (typeof value[key] === 'boolean') out[key] = value[key];
  for (const key of ['health', 'stun', 'hits', 'homeX', 'homeY', 'homeZ'])
    if (Number.isFinite(value?.[key])) out[key] = Math.max(-200, Math.min(200, value[key]));
  return out;
}
export function restoreBuild(
  sim,
  raw,
  owner,
  { offset = [0, 0, 0], preserve = false, remember = true } = {},
) {
  const data = validateBuild(raw, { external: preserve });
  if (data.entities.length > LIMITS.perPlayer && owner !== 'local' && !preserve)
    throw new Error(`A build can contain at most ${LIMITS.perPlayer} bodies per player`);
  if (
    !vector(offset) ||
    data.entities.some((e) => e.p.some((v, i) => Math.abs(v + offset[i]) > 170))
  )
    throw new Error('Build would be outside the map');
  if (sim.constraints.size + data.constraints.length > LIMITS.constraints)
    throw new Error('Not enough free constraints');
  if (preserve) {
    while (sim.entities.size + data.entities.length > LIMITS.bodies)
      sim.removeGroup(sim.entities.values().next().value.group);
  } else sim.reserve(owner, data.entities.length);
  const idMap = new Map(),
    groupMap = new Map(),
    created = [];
  try {
    for (const source of data.entities) {
      if (preserve && sim.entities.has(source.id))
        throw new Error('Cannot restore an ID already in use');
      if (!groupMap.has(source.group))
        groupMap.set(source.group, preserve ? source.group : sim.id('build'));
      const e = sim.spawn(
        source.type,
        source.p.map((n, i) => n + offset[i]),
        preserve ? source.owner : owner,
        {
          id: preserve ? source.id : undefined,
          group: groupMap.get(source.group),
          q: source.q,
          scale: source.scale,
          color: source.color,
          behavior: source.behavior,
          frozen: source.frozen,
          restoring: preserve,
        },
      );
      idMap.set(source.id, e.id);
      created.push(e.id);
      if (PROPS[e.type].vehicle) setupVehicle(sim, e);
      if (source.frozen) freeze(sim, e.id, true);
    }
    for (const c of data.constraints) {
      const a = sim.entities.get(idMap.get(c.a) || c.a),
        b = sim.entities.get(idMap.get(c.b) || c.b);
      if (!a || !b) continue;
      addConstraint(
        sim,
        c.type,
        a.id,
        b.id,
        owner,
        a.body.pointToWorldFrame(new C.Vec3(...c.pa)).toArray(),
        b.body.pointToWorldFrame(new C.Vec3(...c.pb)).toArray(),
        c,
      );
    }
  } catch (error) {
    for (const id of created) sim.remove(id);
    throw error;
  }
  if (remember)
    sim.remember(owner, {
      restore: () => {
        for (const id of created) sim.remove(id);
      },
    });
  return created;
}
export function deleteWithUndo(sim, owner, ids) {
  const data = captureBuild(sim, ids, true);
  if (!data.entities.length) return;
  for (const e of data.entities) sim.remove(e.id);
  sim.remember(owner, {
    restore: () => restoreBuild(sim, data, owner, { preserve: true, remember: false }),
  });
}
export function encodeBuild(data) {
  validateBuild(data);
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return 'XMOD1.' + btoa(s);
}
export function decodeBuild(code) {
  if (typeof code !== 'string' || code.length > 512000 || !code.startsWith('XMOD1.'))
    throw new Error('Invalid or oversized share code');
  try {
    return validateBuild(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(code.slice(6)), (c) => c.charCodeAt(0)),
        ),
      ),
    );
  } catch {
    throw new Error('Share code is damaged or unsupported');
  }
}
