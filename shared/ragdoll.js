import { addConstraint } from './constraints.js';
import { LIMITS } from './constants.js';
// Ten independent bodies and nine cone/twist joints make a poseable dummy.
export function spawnRagdoll(sim, p, owner) {
  if (sim.constraints.size + 9 > LIMITS.constraints)
    throw new Error('Not enough free constraints for a ragdoll');
  sim.reserve(owner, 10);
  const group = sim.id('rag'),
    at = (x, y, z = 0) => [p[0] + x, p[1] + y, p[2] + z];
  const torso = sim.spawn('torso', at(0, 1.8), owner, { group }),
    head = sim.spawn('head', at(0, 2.62), owner, { group });
  const joint = (a, b, pa, pb) =>
    addConstraint(
      sim,
      'joint',
      a.id,
      b.id,
      owner,
      a.body.position.toArray(),
      b.body.position.toArray(),
      { pivotA: pa, pivotB: pb },
    );
  joint(torso, head, [0, 0.48, 0], [0, -0.3, 0]);
  for (const side of [-1, 1]) {
    const upperArm = sim.spawn('limb', at(side * 0.52, 1.9), owner, { group }),
      forearm = sim.spawn('limb', at(side * 0.52, 1.17), owner, { group });
    const thigh = sim.spawn('limb', at(side * 0.2, 0.96), owner, { group }),
      calf = sim.spawn('limb', at(side * 0.2, 0.23), owner, { group });
    joint(torso, upperArm, [side * 0.35, 0.35, 0], [0, 0.35, 0]);
    joint(upperArm, forearm, [0, -0.35, 0], [0, 0.35, 0]);
    joint(torso, thigh, [side * 0.2, -0.45, 0], [0, 0.35, 0]);
    joint(thigh, calf, [0, -0.35, 0], [0, 0.35, 0]);
  }
  return torso;
}
