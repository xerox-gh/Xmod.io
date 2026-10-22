import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { updateGrabs } from '../shared/grabbing.js';
test('hold, rotate, freeze, unfreeze and launch preserve a valid world', () => {
  const s = new Simulation(),
    actor = { id: 'a', state: createPlayer(s.world) },
    actors = new Map([['a', actor]]);
  actor.state.body.position.set(0, 2, 8);
  const e = executeAction(s, actor, { kind: 'spawn', prop: 'crate', p: [0, 2, 2] });
  executeAction(s, actor, { kind: 'grab', id: e.id, point: [0, 2, 2], distance: 4 });
  for (let i = 0; i < 60; i++) {
    updateGrabs(s, actors, 1 / 60);
    s.step(1 / 60);
  }
  assert.equal(s.grabs.size, 1);
  assert.ok(Number.isFinite(e.body.position.y));
  executeAction(s, actor, { kind: 'grabMove', distance: 8, rotate: true, q: [0, 0, 0, 1] });
  executeAction(s, actor, { kind: 'freeze', id: e.id });
  assert.ok(e.frozen);
  assert.equal(s.grabs.size, 0);
  executeAction(s, actor, { kind: 'freeze', id: e.id });
  assert.ok(e.body.mass > 0);
  executeAction(s, actor, { kind: 'launch', id: e.id });
  assert.ok(e.body.velocity.z < -15);
  assert.throws(() => executeAction(s, actor, { kind: 'spawn', prop: 'box', p: [Infinity, 0, 0] }));
});
