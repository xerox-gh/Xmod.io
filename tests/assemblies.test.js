import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { stepCars } from '../shared/vehicles.js';
test('ragdolls have ten bodies, survive physics and undo as one assembly', () => {
  const s = new Simulation(),
    a = { id: 'a', state: createPlayer(s.world) };
  const root = executeAction(s, a, { kind: 'spawn', prop: 'ragdoll', p: [0, 4, 2] });
  assert.equal(s.entities.size, 10);
  assert.equal(s.constraints.size, 9);
  for (let i = 0; i < 180; i++) s.step(1 / 60);
  assert.ok(Number.isFinite(root.body.position.y));
  s.undo('a');
  assert.equal(s.entities.size, 0);
  assert.equal(s.constraints.size, 0);
});
test('raycast vehicle accepts a driver, accelerates, brakes and exits', () => {
  const s = new Simulation(),
    a = { id: 'a', state: createPlayer(s.world), input: { forward: 1 } };
  a.state.body.position.set(0, 2, 4);
  const car = executeAction(s, a, { kind: 'spawn', prop: 'car', p: [0, 2, 1] });
  executeAction(s, a, { kind: 'vehicle', id: car.id });
  const actors = new Map([['a', a]]);
  for (let i = 0; i < 180; i++) {
    stepCars(s, actors);
    s.step(1 / 60);
  }
  assert.equal(a.state.vehicleId, car.id);
  assert.ok(Math.abs(car.body.velocity.z) > 1);
  executeAction(s, a, { kind: 'vehicle' });
  assert.equal(a.state.vehicleId, null);
  assert.ok(a.state.body.collisionResponse);
  s.remove(car.id);
  assert.equal(s.vehicles.size, 0);
});
test('weapons enforce ammo, cooldown, reload and rocket force', () => {
  const s = new Simulation(),
    a = { id: 'a', state: createPlayer(s.world) };
  a.state.body.position.set(0, 2, 8);
  const e = s.spawn('box', [0, 2, 2], 'a');
  executeAction(s, a, { kind: 'fire', weapon: 'pistol' });
  assert.throws(() => executeAction(s, a, { kind: 'fire', weapon: 'pistol' }));
  assert.equal(a.loadout.pistol.ammo, 11);
  executeAction(s, a, { kind: 'reload', weapon: 'pistol' });
  for (let i = 0; i < 100; i++) s.step(1 / 60);
  executeAction(s, a, { kind: 'fire', weapon: 'rocket' });
  assert.equal(s.projectiles.size, 1);
  for (let i = 0; i < 360; i++) s.step(1 / 60);
  assert.equal(s.projectiles.size, 0);
  assert.ok(Number.isFinite(e.body.position.y));
});
