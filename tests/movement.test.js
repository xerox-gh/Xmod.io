import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../client/src/physics/world.js';
import { createPlayer, movePlayer } from '../shared/movement.js';
test('flatgrass collisions, jump, sprint, noclip, and rescue are finite', () => {
  const world = createWorld(),
    p = createPlayer(world);
  const tick = (i, n = 60) => {
    for (let j = 0; j < n; j++) {
      movePlayer(p, i, world, 1 / 60);
      world.step(1 / 60);
    }
  };
  tick({}, 100);
  assert.ok(p.grounded);
  assert.ok(p.body.position.y > 0.7);
  tick({ forward: 1, sprint: true }, 30);
  assert.ok(p.body.velocity.z < -10);
  tick({ jump: true }, 1);
  assert.ok(p.body.velocity.y > 5);
  p.fly = true;
  tick({ jump: true }, 20);
  assert.ok(p.body.position.y > 5);
  p.body.position.y = -100;
  tick({}, 1);
  assert.ok(p.body.position.y > 0);
});
