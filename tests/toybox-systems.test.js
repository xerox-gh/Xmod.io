import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { addConstraint } from '../shared/constraints.js';
import { spawnRagdoll } from '../shared/ragdoll.js';
import { Puppets } from '../client/src/lab/puppets.js';
import { captureBuild } from '../shared/builds.js';
import { packBuild, unpackBuild, saveCard, loadCard, crc32 } from '../client/src/lab/codec.js';
const setup = () => {
  const sim = new Simulation(),
    actor = {
      id: 'local',
      admin: true,
      state: createPlayer(sim.world),
      input: { binds: [] },
      health: 100,
    };
  actor.state.body.position.set(0, 2, 10);
  sim.lab.actors.set(actor.id, actor);
  return { sim, actor };
};
test('wires propagate sensor values, gates, clock/latch state and actuators without recursion', () => {
  const { sim } = setup(),
    clock = sim.spawn('logic_clock', [0, 4, 0]),
    latch = sim.spawn('logic_latch', [2, 4, 0]),
    screen = sim.spawn('digital_screen', [4, 4, 0]);
  addConstraint(sim, 'wire', clock.id, latch.id, 'local', [0, 4, 0], [2, 4, 0], { input: 'a' });
  addConstraint(sim, 'wire', latch.id, screen.id, 'local', [2, 4, 0], [4, 4, 0], { input: 'a' });
  for (let i = 0; i < 10; i++) sim.step(1 / 60);
  assert.equal(sim.lab.values.get(screen.id).out, 1);
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  assert.equal(sim.lab.values.get(screen.id).out, 0);
  const inverted = sim.spawn('logic_not', [5, 4, 0]);
  sim.step(1 / 60);
  assert.equal(sim.lab.values.get(inverted.id).out, 1);
  const laser = sim.spawn('laser_sensor', [20, 4, 0], 'local', { frozen: true });
  sim.spawn('box', [20, 4, -5], 'local', { frozen: true });
  sim.step(1 / 60);
  assert.ok(sim.lab.values.get(laser.id).out < 6);
});
test('gravity zones, water flow and teleporters affect physical bodies and preserve speed', () => {
  const { sim } = setup(),
    zone = sim.spawn('gravity_zone', [20, 5, 0], 'local', { behavior: { gy: 20, zoneSize: 10 } }),
    cube = sim.spawn('box', [20, 4, 0]);
  sim.step(1 / 60);
  assert.ok(cube.body.velocity.y > 0);
  sim.remove(zone.id);
  const first = sim.spawn('telepad', [0, 0, 0], 'local', { behavior: {} }),
    exit = sim.spawn('telepad', [20, 0, 20]);
  first.behavior.portal = exit.id;
  exit.behavior.portal = first.id;
  cube.body.position.set(0, 1, 0);
  cube.body.velocity.set(3, 2, 4);
  const speed = cube.body.velocity.length();
  sim.lab.sim.world.gravity.setZero();
  sim.step(1 / 60);
  assert.ok(cube.body.position.distanceTo(exit.body.position) < 4);
  assert.ok(Math.abs(cube.body.velocity.length() - speed) < 0.1);
  const float = sim.spawn('box', [10, -3.5, 35], 'local', { behavior: { buoyancy: 2 } });
  sim.world.gravity.y = -20;
  sim.lab.environment.currentX = 5;
  sim.step(1 / 60);
  assert.ok(float.body.velocity.y > 0 && float.body.velocity.x > 0);
});
test('glass creates convex Voronoi shards, flame spreads and cold props thaw on hits', () => {
  const { sim } = setup(),
    glass = sim.spawn('glass', [0, 4, 0]);
  sim.lab.hit(glass);
  sim.step(1 / 60);
  assert.equal(sim.entities.has(glass.id), false);
  const shards = [...sim.entities.values()].filter((e) => e.type === 'glass_shard');
  assert.ok(shards.length >= 3);
  assert.ok(shards.every((e) => e.body.shapes[0].vertices?.length >= 6));
  const a = sim.spawn('crate', [8, 2, 0]),
    b = sim.spawn('plank', [8, 2.7, 0]);
  sim.lab.ignite(a);
  for (let i = 0; i < 30; i++) sim.step(1 / 60);
  assert.equal(b.behavior.burning, true);
  a.behavior.cryo = true;
  executeAction(
    sim,
    { id: 'local', admin: true, state: createPlayer(sim.world) },
    { kind: 'freeze', id: a.id },
  );
  sim.lab.hit(a);
  assert.equal(a.frozen, false);
  assert.equal(a.behavior.cryo, false);
});
test('gadgets swap real velocities, tether a player, shrink colliders and bound singularities', () => {
  const { sim, actor } = setup(),
    a = sim.spawn('box', [0, 2.65, 4]),
    b = sim.spawn('box', [4, 2.65, 4]);
  a.body.velocity.x = 2;
  b.body.velocity.x = 7;
  sim.lab.fire(actor, 'swap');
  sim.time += 0.2;
  actor.state.yaw = -Math.atan2(4, 6);
  sim.lab.fire(actor, 'swap');
  assert.equal(a.body.velocity.x, 7);
  assert.equal(b.body.velocity.x, 2);
  actor.state.yaw = 0;
  sim.time += 0.3;
  sim.lab.fire(actor, 'grapple');
  assert.ok(sim.lab.grapples.has(actor.id));
  sim.time += 0.3;
  sim.lab.fire(actor, 'scale_ray', 2);
  const target = [...sim.entities.values()].find((e) => sim.lab.state(e.id).targetScale);
  assert.ok(target);
  const scale = target.scale;
  for (let i = 0; i < 30; i++) sim.step(1 / 60);
  assert.ok(target.scale < scale);
  sim.lab.fire(actor, 'singularity');
  assert.equal(sim.lab.singularities.size, 1);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  assert.equal(sim.lab.singularities.size, 0);
});
test('build gzip links and PNG metadata round-trip validated physics data and reject corruption', async () => {
  const { sim } = setup();
  sim.spawn('box', [0, 2, 0]);
  const build = captureBuild(sim),
    code = await packBuild(build);
  assert.deepEqual(await unpackBuild(code), build);
  const bytes = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]),
    png = new Blob([bytes], { type: 'image/png' }),
    card = await saveCard(png, build);
  assert.deepEqual(await loadCard(card), build);
  const corrupt = new Uint8Array(await card.arrayBuffer());
  corrupt[30] ^= 1;
  await assert.rejects(() => loadCard(new Blob([corrupt])));
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('mini modes have actual phases, health penalties, checkpoints, waves and rising lava', () => {
  const { sim, actor } = setup();
  sim.lab.modes.start('hunt');
  sim.lab.modes.shot(actor, new Set());
  assert.equal(actor.health, 95);
  assert.equal([...sim.entities.values()].filter((e) => e.behavior.hiding).length, 4);
  sim.lab.modes.start('fort');
  assert.throws(() => executeAction(sim, actor, { kind: 'fire', weapon: 'pistol' }), /Build phase/);
  sim.lab.modes.step(180);
  assert.equal(sim.lab.modes.state.phase, 'battle');
  assert.throws(() => executeAction(sim, actor, { kind: 'fire', weapon: 'pistol' }), /rockets/);
  sim.lab.modes.start('horde');
  sim.lab.modes.step(1);
  assert.equal(sim.lab.modes.state.wave, 1);
  assert.ok([...sim.entities.values()].some((e) => e.behavior.npc));
  sim.lab.modes.start('lava');
  actor.state.body.position.y = 0.5;
  sim.lab.modes.step(1);
  assert.equal(actor.health, 40);
  sim.lab.modes.start('race');
  assert.equal(sim.lab.modes.checkpoints.length, 6);
  assert.ok(actor.state.vehicleId);
});
test('faction attacks damage opponents and puppet clips record, loop, clone and release', () => {
  const { sim, actor } = setup(),
    red = spawnRagdoll(sim, [0, 2, 0], 'local'),
    blue = spawnRagdoll(sim, [0, 2, -7], 'local');
  red.behavior = { npc: true, faction: 'red', npcWeapon: 'ranged', health: 100 };
  blue.behavior = { npc: true, faction: 'blue', npcWeapon: 'ranged', health: 100 };
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  assert.ok(red.behavior.health < 100 || blue.behavior.health < 100);
  const box = sim.spawn('box', [10, 3, 0]);
  const game = {
    sim,
    net: { connected: false },
    selection: { ids: new Set([box.id]) },
    props: { aim: () => ({ id: box.id }) },
    view: { camera: {} },
    resume() {},
    toast() {},
  };
  const lab = { game, target: box.id },
    puppets = new Puppets(lab);
  puppets.record();
  for (let i = 0; i < 51; i++) {
    box.body.position.x = 10 + i * 0.02;
    puppets.update(0.1);
  }
  assert.equal(puppets.recording, false);
  assert.ok(puppets.data.frames.length >= 50);
  puppets.play();
  puppets.fixed(0.5);
  const first = box.body.position.x;
  puppets.fixed(1);
  assert.notEqual(box.body.position.x, first);
  assert.equal(box.frozen, true);
  puppets.stop();
  assert.equal(box.frozen, false);
  const before = sim.entities.size;
  puppets.play(puppets.data, true);
  assert.equal(sim.entities.size, before + 1);
  puppets.stop();
});
