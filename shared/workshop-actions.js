import * as C from 'cannon-es';
import { MAPS } from './maps.js';
import { LIMITS, BIND_KEYS } from './constants.js';
import { captureBuild, connectedEntities, restoreBuild, deleteWithUndo } from './builds.js';
import { interactProp, freezeGroup } from './behaviors.js';
import { poseLimb } from './posing.js';
const kinds = new Set([
  'map',
  'time',
  'loadBuild',
  'duplicate',
  'groupMove',
  'groupDelete',
  'interact',
  'pose',
  'poseFreeze',
  'motorConfig',
]);
const vector = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
export function workshopAction(sim, actor, a, own, target) {
  if (!kinds.has(a.kind)) return false;
  if (a.kind === 'map' || a.kind === 'time') {
    if (!actor.admin) throw new Error('Only the room owner can change the world');
    if (a.kind === 'map') {
      if (!Object.hasOwn(MAPS, a.map)) throw new Error('Unknown map');
      sim.changeMap(a.map);
    } else {
      if (![0, 0.25, 1].includes(a.value)) throw new Error('Invalid time scale');
      sim.timeScale = a.value;
      sim.emit('time', { value: a.value });
    }
  } else if (a.kind === 'loadBuild') restoreBuild(sim, a.build, actor.id);
  else if (a.kind === 'duplicate') {
    const e = own(sim, actor, a.id),
      ids = connectedEntities(sim, e.id);
    if (
      ids.some((id) => {
        const b = sim.entities.get(id);
        return b.owner !== actor.id && b.owner !== 'world' && !actor.admin;
      })
    )
      throw new Error('Contraption includes another player’s prop');
    const offset = vector(a.offset) ? a.offset : [4, 1, 0];
    if (Math.hypot(...offset) > 25) throw new Error('Duplicate distance is too large');
    restoreBuild(sim, captureBuild(sim, ids), actor.id, { offset });
  } else if (a.kind === 'groupMove' || a.kind === 'groupDelete') {
    if (!Array.isArray(a.ids) || !a.ids.length || a.ids.length > LIMITS.bodies)
      throw new Error('Select some props first');
    const ids = [...new Set(a.ids)],
      entities = ids.map((id) => own(sim, actor, id));
    if (a.kind === 'groupDelete') deleteWithUndo(sim, actor.id, ids);
    else {
      if (
        !vector(a.delta) ||
        Math.hypot(...a.delta) > 30 ||
        entities.some((e) =>
          e.body.position.toArray().some((n, i) => Math.abs(n + a.delta[i]) > 170),
        )
      )
        throw new Error('Move must stay within the map and 30 units');
      const before = entities.map((e) => [e.id, e.body.position.clone()]);
      for (const e of entities) {
        e.body.position.vadd(new C.Vec3(...a.delta), e.body.position);
        e.body.aabbNeedsUpdate = true;
        e.body.wakeUp();
        sim.emit('change', { entity: sim.serialize(e) });
      }
      sim.remember(actor.id, {
        restore: () => {
          for (const [id, p] of before) {
            const e = sim.entities.get(id);
            if (e) {
              e.body.position.copy(p);
              e.body.aabbNeedsUpdate = true;
              e.body.wakeUp();
              sim.emit('change', { entity: sim.serialize(e) });
            }
          }
        },
      });
    }
  } else if (a.kind === 'interact') interactProp(sim, target(sim, actor, a.id));
  else if (a.kind === 'poseFreeze') {
    own(sim, actor, a.id);
    freezeGroup(sim, a.id, !!a.value);
  } else if (a.kind === 'pose') {
    const e = own(sim, actor, a.id);
    if (!vector(a.angles) || a.angles.some((v) => Math.abs(v) > 180))
      throw new Error('Invalid joint angle');
    const ids = [...sim.entities.values()].filter((b) => b.group === e.group).map((b) => b.id),
      before = captureBuild(sim, ids, true);
    poseLimb(sim, e.id, a.angles);
    sim.remember(actor.id, {
      restore: () => {
        for (const id of ids) sim.remove(id);
        restoreBuild(sim, before, actor.id, { preserve: true, remember: false });
      },
    });
  } else if (a.kind === 'motorConfig') {
    const e = own(sim, actor, a.id);
    if (!Number.isFinite(a.speed) || Math.abs(a.speed) > 30 || !BIND_KEYS.includes(a.bind))
      throw new Error('Invalid motor setting');
    for (const c of sim.constraints.values())
      if ((c.a === e.id || c.b === e.id) && ['wheel', 'motor'].includes(c.type)) {
        c.speed = a.speed;
        c.bind = a.bind;
        sim.emit('motor', { id: c.id, speed: c.speed, bind: c.bind });
      }
  }
  return true;
}
