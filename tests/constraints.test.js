import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { stepAttachments } from '../shared/constraints.js';
test('all building modes create real constraints and cleanup removes them', () => {
  const s = new Simulation(),
    actor = { id: 'a', state: createPlayer(s.world), input: { activate: true } },
    actors = new Map([['a', actor]]);
  actor.state.body.position.set(0, 3, 8);
  const a = s.spawn('box', [0, 4, 0], 'a'),
    b = s.spawn('box', [2, 4, 0], 'a');
  executeAction(s, actor, { kind: 'tool', mode: 'weld', id: a.id, other: b.id });
  assert.equal(s.constraints.size, 1);
  for (const mode of ['wheel', 'thruster', 'balloon'])
    executeAction(s, actor, {
      kind: 'tool',
      mode,
      id: a.id,
      point: [0, 4.6, 0],
      normal: [0, 1, 0],
    });
  assert.equal(s.constraints.size, 4);
  for (let i = 0; i < 60; i++) {
    stepAttachments(s, actors);
    s.step(1 / 60);
  }
  assert.ok(Number.isFinite(a.body.position.y));
  executeAction(s, actor, { kind: 'tool', mode: 'paint', id: b.id, color: '#ff0088' });
  assert.equal(b.color, '#ff0088');
  s.undo('a');
  assert.notEqual(b.color, '#ff0088');
  executeAction(s, actor, { kind: 'tool', mode: 'resize', id: b.id, scale: 2 });
  assert.equal(b.scale, 2);
  s.undo('a');
  assert.equal(b.scale, 1);
  s.clear('a');
  assert.equal(s.constraints.size, 0);
  assert.equal(s.entities.size, 0);
});
