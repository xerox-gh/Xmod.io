import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { addConstraint } from '../shared/constraints.js';
import { captureBuild, restoreBuild } from '../shared/builds.js';
const setup = () => {
  const sim = new Simulation();
  const actor = { id: 'local', state: createPlayer(sim.world), admin: true, input: { binds: [] } };
  sim.lab.actors.set(actor.id, actor);
  return { sim, actor };
};
test('hover PID settles, altitude controls work, and physical profiles change real mass', () => {
  const { sim, actor } = setup(),
    e = sim.spawn('hoverball', [0, 4, 0]);
  e.behavior.height = 6;
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  assert.ok(Math.abs(e.body.position.y - 6) < 0.25, e.body.position.y);
  actor.input.binds = ['KeyJ'];
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  assert.ok(e.behavior.height > 8.9);
  const cube = sim.spawn('box', [0, 2, 10]);
  const mass = cube.body.mass;
  executeAction(sim, actor, { kind: 'tool', mode: 'properties', id: cube.id, material: 'lead' });
  assert.equal(cube.body.mass, mass * 8);
  executeAction(sim, actor, { kind: 'tool', mode: 'upright', id: cube.id });
  cube.body.quaternion.setFromEuler(0.7, 0.3, 0.5);
  sim.step(1 / 60);
  const up = cube.body.vectorToWorldFrame({ x: 0, y: 1, z: 0 });
  assert.ok(up.y > 0.99);
});
test('winch, pulley, ball sockets, axis and pair-only no-collide persist in builds', () => {
  const { sim, actor } = setup();
  const a = sim.spawn('box', [0, 6, 10], actor.id, { frozen: true }),
    b = sim.spawn('box', [0, 3, 10]);
  const winch = addConstraint(
    sim,
    'winch',
    a.id,
    b.id,
    actor.id,
    a.body.position.toArray(),
    b.body.position.toArray(),
    { bind: 'KeyJ', downBind: 'KeyK', speed: 2 },
  );
  actor.input.binds = ['KeyK'];
  for (let i = 0; i < 30; i++) sim.step(1 / 60);
  assert.ok(winch.length < 2.1);
  const c = sim.spawn('box', [5, 3, 10]);
  addConstraint(
    sim,
    'pulley',
    b.id,
    c.id,
    actor.id,
    b.body.position.toArray(),
    c.body.position.toArray(),
    {
      anchors: [
        [0, 8, 10],
        [5, 8, 10],
      ],
    },
  );
  const pair = addConstraint(
    sim,
    'nocollide',
    b.id,
    c.id,
    actor.id,
    b.body.position.toArray(),
    c.body.position.toArray(),
  );
  assert.equal(pair.joint.collideConnected, false);
  assert.equal(b.body.collisionFilterMask, 3);
  addConstraint(sim, 'ballsocket', a.id, c.id, actor.id, [0, 6, 10], [0, 6, 10]);
  const data = captureBuild(sim);
  const target = new Simulation();
  restoreBuild(target, data, 'local');
  assert.equal(target.constraints.size, 4);
  for (let i = 0; i < 60; i++) target.step(1 / 60);
  assert.ok(
    [...target.entities.values()].every((e) => e.body.position.toArray().every(Number.isFinite)),
  );
});
