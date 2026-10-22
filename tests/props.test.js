import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
test('prop caps evict the oldest body, undo and cleanup respect ownership', () => {
  const s = new Simulation();
  const first = s.spawn('box', [0, 8, 0], 'a');
  for (let i = 0; i < 61; i++) s.spawn('barrel', [0, 10 + i * 2, 0], 'a');
  assert.equal(s.entities.has(first.id), false);
  assert.equal(s.entities.size, 60);
  const b = s.spawn('ball', [1, 3, 0], 'b');
  s.remember('b', { group: b.group });
  s.undo('b');
  assert.equal(s.entities.has(b.id), false);
  const c = s.spawn('crate', [3, 3, 0], 'b');
  s.clear('a');
  assert.equal(s.entities.size, 1);
  assert.ok(s.entities.has(c.id));
});
