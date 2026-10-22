import * as C from 'cannon-es';
import { freezeGroup } from './behaviors.js';
// Rotate a limb and its descendants around the real constraint pivot.
export function poseLimb(sim, id, angles) {
  const e = sim.entities.get(id);
  if (!['head', 'limb', 'torso'].includes(e?.type)) throw new Error('Choose a dummy limb');
  freezeGroup(sim, id, true);
  const parent = [...sim.constraints.values()].find((c) => c.type === 'joint' && c.b === id);
  const pivot = parent
    ? sim.entities.get(parent.a).body.pointToWorldFrame(new C.Vec3(...parent.pa))
    : e.body.position.clone();
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of sim.constraints.values())
      if (c.type === 'joint' && ids.has(c.a) && !ids.has(c.b)) {
        ids.add(c.b);
        changed = true;
      }
  }
  const rotation = new C.Quaternion();
  rotation.setFromEuler(...angles.map((v) => (v * Math.PI) / 180));
  for (const key of ids) {
    const b = sim.entities.get(key);
    b.body.position.copy(rotation.vmult(b.body.position.vsub(pivot)).vadd(pivot));
    b.body.quaternion.copy(rotation.mult(b.body.quaternion));
    b.body.aabbNeedsUpdate = true;
    sim.emit('change', { entity: sim.serialize(b) });
  }
}
