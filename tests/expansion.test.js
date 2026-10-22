import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cannon-es';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { captureBuild, restoreBuild, encodeBuild, decodeBuild } from '../shared/builds.js';
import { addConstraint, stepAttachments } from '../shared/constraints.js';
import { MAPS } from '../shared/maps.js';
import { PROPS } from '../shared/props.js';
import { stepBehaviors, hitEntity } from '../shared/behaviors.js';
import { stepCars, spawnVehicle } from '../shared/vehicles.js';
const actor = (s) => ({ id: 'local', state: createPlayer(s.world), admin: true, input: {} });
test('build files and share codes round-trip compound props, vehicles and connected joints', () => {
  const s = new Simulation(),
    a = s.spawn('pipe', [0, 3, 0]),
    b = spawnVehicle(s, 'bike', [3, 3, 0], 'local');
  addConstraint(s, 'motor', a.id, b.id, 'local', [0, 3, 0], [0, 3, 0], {
    axis: [0, 1, 0],
    speed: 12,
    bind: 'KeyJ',
  });
  const build = decodeBuild(encodeBuild(captureBuild(s)));
  const copy = new Simulation();
  restoreBuild(copy, build, 'local');
  assert.equal(copy.entities.size, 2);
  assert.equal(copy.constraints.size, 1);
  assert.equal(copy.vehicles.size, 1);
  assert.equal([...copy.entities.values()][0].body.shapes.length, 12);
  assert.equal([...copy.constraints.values()][0].bind, 'KeyJ');
  assert.throws(() => decodeBuild('XMOD1.bad'));
  assert.throws(() =>
    restoreBuild(
      copy,
      { ...build, entities: [{ ...build.entities[0], type: '__proto__' }] },
      'local',
    ),
  );
});
test('duplicator copies an entire contraption; deletes and clear restore with undo', () => {
  const s = new Simulation(),
    a = actor(s),
    x = s.spawn('box', [0, 2, 7]),
    y = s.spawn('barrel', [2, 2, 7]);
  addConstraint(
    s,
    'weld',
    x.id,
    y.id,
    'local',
    x.body.position.toArray(),
    y.body.position.toArray(),
  );
  executeAction(s, a, { kind: 'duplicate', id: x.id, offset: [5, 0, 0] });
  assert.equal(s.entities.size, 4);
  assert.equal(s.constraints.size, 2);
  executeAction(s, a, { kind: 'groupDelete', ids: [x.id] });
  assert.equal(s.constraints.size, 1);
  s.undo('local');
  assert.equal(s.entities.size, 4);
  assert.equal(s.constraints.size, 2);
  executeAction(s, a, { kind: 'clear' });
  assert.equal(s.entities.size, 0);
  s.undo('local');
  assert.equal(s.entities.size, 4);
  assert.equal(s.constraints.size, 2);
});
test('all maps have collision geometry and hills support a falling box', () => {
  for (const id of Object.keys(MAPS)) {
    const s = new Simulation(id);
    assert.ok(s.world.bodies.length > 0);
    const e = s.spawn('box', [0, 8, 0]);
    for (let i = 0; i < 180; i++) s.step(1 / 60);
    assert.ok(Number.isFinite(e.body.position.y));
    assert.ok(e.body.position.y > -0.1, id);
  }
  const s = new Simulation('hills'),
    e = s.spawn('box', [60, 18, 0]);
  for (let i = 0; i < 240; i++) s.step(1 / 60);
  assert.ok(e.body.position.y > 1);
});
test('hinges hold their pivot, sliders travel on one axis and motors respect bindings', () => {
  const s = new Simulation(),
    a = s.spawn('box', [0, 8, 0]),
    b = s.spawn('box', [0, 10, 0]);
  a.frozen = true;
  a.body.mass = 0;
  a.body.type = C.Body.STATIC;
  a.body.updateMassProperties();
  const hinge = addConstraint(s, 'hinge', a.id, b.id, 'local', [0, 9, 0], [0, 9, 0], {
    axis: [0, 1, 0],
  });
  for (let i = 0; i < 120; i++) s.step(1 / 60);
  assert.ok(
    a.body
      .pointToWorldFrame(hinge.joint.pivotA)
      .distanceTo(b.body.pointToWorldFrame(hinge.joint.pivotB)) < 0.2,
  );
  s.removeConstraint(hinge.id);
  b.body.position.set(0, 10, 0);
  b.body.velocity.set(4, 0, 0);
  const slider = addConstraint(
    s,
    'slider',
    a.id,
    b.id,
    'local',
    a.body.position.toArray(),
    b.body.position.toArray(),
    { axis: [1, 0, 0], travel: 3 },
  );
  for (let i = 0; i < 60; i++) s.step(1 / 60);
  assert.ok(Math.abs(b.body.position.y - 10) < 0.2);
  assert.ok(b.body.position.x > 1);
  assert.ok(b.body.position.x < 3.3);
  s.removeConstraint(slider.id);
  const motor = addConstraint(
    s,
    'motor',
    a.id,
    b.id,
    'local',
    a.body.position.toArray(),
    b.body.position.toArray(),
    { axis: [0, 1, 0], speed: 7, bind: 'KeyJ' },
  );
  stepAttachments(s, new Map([['local', { input: { binds: ['KeyJ'] } }]]));
  assert.equal(motor.joint.motorEquation.targetVelocity, 7);
});
test('behavior props bounce, react, detonate and doors keep working after a build reload', () => {
  const s = new Simulation(),
    a = actor(s);
  s.spawn('trampoline', [0, 0, 14]);
  a.state.body.position.set(0, 1, 14);
  a.state.body.velocity.y = -3;
  stepBehaviors(s, new Map([['local', a]]), 1 / 60);
  assert.equal(a.state.body.velocity.y, 14);
  const target = s.spawn('target', [0, 2, 0]);
  hitEntity(s, target);
  assert.equal(target.behavior.hits, 1);
  const barrel = s.spawn('explosive_barrel', [5, 2, 0]);
  hitEntity(s, barrel);
  stepBehaviors(s, new Map(), 1 / 60);
  assert.ok(!s.entities.has(barrel.id));
  executeAction(s, a, { kind: 'spawn', prop: 'door', p: [0, 3, 4] });
  const copy = new Simulation();
  restoreBuild(copy, captureBuild(s), 'local');
  assert.ok([...copy.constraints.values()].some((c) => c.effect === 'door'));
});
test('all expanded props and vehicles remain finite with bounded physics', () => {
  for (const type of Object.keys(PROPS)) {
    const s = new Simulation(),
      e = s.spawn(type, [0, 5, 0]);
    for (let i = 0; i < 8; i++) s.step(1 / 60);
    assert.ok(Number.isFinite(e.body.position.y), type);
  }
  for (const type of ['car', 'boat', 'plane', 'tank', 'bike']) {
    const s = new Simulation();
    spawnVehicle(s, type, [0, 4, 0], 'local');
    for (let i = 0; i < 60; i++) {
      stepCars(s, new Map());
      s.step(1 / 60);
    }
    assert.equal(s.vehicles.size, 1);
  }
});

test('boat floats and drives; plane takes off under power; tank and bike can drive', () => {
  for (const type of ['boat', 'plane', 'tank', 'bike']) {
    const s = new Simulation(),
      a = actor(s),
      p = type === 'boat' ? s.world.map.water.p : [-60, 3, 60];
    const e = spawnVehicle(s, type, p, 'local');
    a.state.body.position.copy(e.body.position);
    executeAction(s, a, { kind: 'vehicle', id: e.id });
    a.input = { forward: 1, right: 0 };
    const start = e.body.position.clone();
    for (let i = 0; i < (type === 'plane' ? 360 : 120); i++) {
      stepCars(s, new Map([['local', a]]));
      s.step(1 / 60);
    }
    assert.ok(e.body.position.distanceTo(start) > 1, type);
    assert.ok(Number.isFinite(e.body.position.y));
    if (type === 'plane') assert.ok(e.body.position.y > 5, 'plane must actually take off');
    if (type === 'boat')
      assert.ok(e.body.position.y > s.world.map.water.p[1] - 0.5, 'boat must float');
  }
});
test('walking jointed NPCs stand, walk, react to hits and accept a frozen manual pose', () => {
  const s = new Simulation(),
    a = actor(s),
    e = executeAction(s, a, { kind: 'spawn', prop: 'npc', p: [0, 0.5, 5] });
  const start = e.body.position.clone();
  for (let i = 0; i < 420; i++) {
    stepBehaviors(s, new Map([['local', a]]), 1 / 60);
    s.step(1 / 60);
  }
  assert.ok(e.body.position.y > 1.3);
  assert.ok(e.body.position.distanceTo(start) > 1);
  const limb = [...s.entities.values()].find((b) => b.type === 'limb');
  hitEntity(s, limb);
  assert.ok(e.behavior.stun > s.time);
  const before = limb.body.quaternion.clone();
  executeAction(s, a, { kind: 'pose', id: limb.id, angles: [30, 0, 0] });
  assert.ok([...s.entities.values()].every((b) => b.frozen));
  assert.notDeepEqual(limb.body.quaternion.toArray(), before.toArray());
  s.undo('local');
  assert.equal(s.entities.size, 10);
});
test('crowbar, grenade, flamethrower and prop exploder have real hit and blast effects', () => {
  for (const weapon of ['crowbar', 'flamethrower', 'exploder']) {
    const s = new Simulation(),
      a = actor(s);
    a.state.body.position.set(0, 1, 10);
    a.state.pitch = 0;
    const e = s.spawn(weapon === 'flamethrower' ? 'target' : 'barrel', [
      0,
      1.65,
      weapon === 'crowbar' ? 8 : 5,
    ]);
    executeAction(s, a, { kind: 'fire', weapon });
    if (weapon === 'crowbar') assert.ok(e.body.velocity.z < 0);
    if (weapon === 'flamethrower') assert.equal(e.behavior.hits, 1);
    if (weapon === 'exploder') assert.ok(!s.entities.has(e.id));
  }
  const s = new Simulation(),
    a = actor(s),
    events = [];
  s.onEvent = (e) => events.push(e);
  a.state.pitch = -0.4;
  executeAction(s, a, { kind: 'fire', weapon: 'grenade' });
  for (let i = 0; i < 170; i++) s.step(1 / 60);
  assert.equal(s.projectiles.size, 0);
  assert.ok(events.some((e) => e.type === 'projectileBounce'));
  assert.ok(events.some((e) => e.type === 'explosion'));
});

test('door servo stops at its open angle and a button closes it', () => {
  const s = new Simulation(),
    a = actor(s),
    e = executeAction(s, a, { kind: 'spawn', prop: 'door', p: [0, 1.5, 0] });
  executeAction(s, a, { kind: 'interact', id: e.id });
  for (let i = 0; i < 180; i++) {
    stepAttachments(s, new Map([['local', a]]));
    s.step(1 / 60);
  }
  const q = e.body.quaternion,
    yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  assert.ok(Math.abs(yaw - 1.4) < 0.15);
  const button = s.spawn('button', [3, 0.5, 0]);
  executeAction(s, a, { kind: 'interact', id: button.id });
  executeAction(s, a, { kind: 'interact', id: button.id });
  assert.equal(e.behavior.open, false);
});

test('far sleeping sphere props use finite instanced proxies and regain detail nearby', async () => {
  const T = await import('three'),
    { PropRegistry } = await import('../client/src/props/registry.js');
  const s = new Simulation(),
    scene = new T.Scene(),
    registry = new PropRegistry(scene, s),
    camera = new T.PerspectiveCamera();
  s.onEvent = (e) => registry.event(e);
  const e = s.spawn('mega_ball', [100, 2, 0], 'local', { frozen: true });
  registry.update(camera);
  assert.equal(registry.proxy.count, 1);
  assert.equal(registry.meshes.get(e.id).visible, false);
  const matrix = new T.Matrix4();
  registry.proxy.getMatrixAt(0, matrix);
  assert.ok(matrix.elements.every(Number.isFinite));
  camera.position.set(90, 2, 0);
  registry.update(camera);
  assert.equal(registry.proxy.count, 0);
  assert.equal(registry.meshes.get(e.id).visible, true);
});
