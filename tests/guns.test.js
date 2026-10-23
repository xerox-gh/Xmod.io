import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { createPlayer } from '../shared/movement.js';
import { executeAction } from '../shared/actions.js';
import { WEAPONS } from '../shared/weapons.js';
import { Weapons } from '../client/src/weapons/index.js';
import { makeFirearmModels } from '../client/src/weapons/firearms.js';
const ids = ['smg', 'rifle', 'sniper', 'revolver', 'lmg'];
function setup() {
  const sim = new Simulation(),
    actor = { id: 'local', state: createPlayer(sim.world), admin: true };
  actor.state.body.position.set(0, 1, 10);
  return { sim, actor };
}
test('each new gun hits props, consumes authority ammo, reloads and rejects unknown IDs', () => {
  for (const id of ids) {
    const { sim, actor } = setup(),
      box = sim.spawn('box', [0, 1.65, 4]);
    assert.equal(executeAction(sim, actor, { kind: 'fire', weapon: id, aim: true }), true);
    assert.ok(box.body.velocity.z < 0, id);
    assert.equal(actor.loadout[id].ammo, WEAPONS[id].capacity - 1);
    executeAction(sim, actor, { kind: 'reload', weapon: id });
    sim.time += WEAPONS[id].reload + 0.01;
    executeAction(sim, actor, { kind: 'fire', weapon: id });
    assert.equal(actor.loadout[id].ammo, WEAPONS[id].capacity - 1);
  }
  const { sim, actor } = setup();
  for (const id of ['__proto__', 'constructor', 'missing'])
    assert.throws(() => executeAction(sim, actor, { kind: 'fire', weapon: id }), /Unknown weapon/);
});
test('automatic fire cannot bypass cooldowns or spend ammo on early requests', () => {
  for (const id of ['smg', 'rifle', 'lmg']) {
    const { sim, actor } = setup();
    executeAction(sim, actor, { kind: 'fire', weapon: id });
    for (let i = 0; i < 20; i++)
      assert.equal(executeAction(sim, actor, { kind: 'fire', weapon: id }), false);
    assert.equal(actor.loadout[id].ammo, WEAPONS[id].capacity - 1);
    sim.time += WEAPONS[id].interval;
    assert.equal(executeAction(sim, actor, { kind: 'fire', weapon: id }), true);
    assert.equal(actor.loadout[id].ammo, WEAPONS[id].capacity - 2);
  }
});
test('aiming reduces authority spread and scoped weapons retain their own range', () => {
  const original = Math.random;
  Math.random = () => 0.9;
  try {
    const { sim, actor } = setup(),
      traces = [];
    sim.onEvent = (e) => {
      if (e.type === 'tracer') traces.push(e);
    };
    executeAction(sim, actor, { kind: 'fire', weapon: 'rifle' });
    sim.time += 1;
    executeAction(sim, actor, { kind: 'fire', weapon: 'rifle', aim: true });
    const sideways = (t) => Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]);
    assert.ok(sideways(traces[1]) < sideways(traces[0]) * 0.5);
    assert.ok(WEAPONS.sniper.range > WEAPONS.smg.range);
  } finally {
    Math.random = original;
  }
});
test('client keeps one ammo deduction per accepted shot and supplies aiming metadata', () => {
  const sent = [],
    game = {
      input: { locked: true, buttons: new Set([2]) },
      overlay: null,
      cameraRig: { mode: 'first' },
      player: { state: {}, recoil: 0 },
      toolId: 'rifle',
      action: (a) => {
        sent.push(a);
        return true;
      },
      selectTool: () => {},
      toast: () => {},
    };
  const weapons = new Weapons(game);
  assert.equal(weapons.aiming, true);
  weapons.fire('rifle');
  weapons.fire('rifle');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].aim, true);
  assert.equal(weapons.state('rifle').ammo, 29);
  weapons.update(0.11);
  weapons.fire('rifle');
  assert.equal(weapons.state('rifle').ammo, 28);
  game.action = () => false;
  weapons.update(0.11);
  weapons.fire('rifle');
  assert.equal(weapons.state('rifle').ammo, 28);
  game.overlay = 'spawn';
  assert.equal(weapons.aiming, false);
});
test('procedural firearm models have distinct silhouettes and finite geometry', () => {
  const models = makeFirearmModels();
  assert.equal(Object.keys(models).length, 8);
  for (const id of [...ids, 'pistol', 'shotgun', 'rocket']) {
    let parts = 0;
    models[id].traverse((m) => {
      if (m.isMesh) {
        parts++;
        assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));
      }
    });
    assert.ok(parts >= 5, id);
    assert.equal(models[id].userData.weapon, id);
  }
  assert.notEqual(models.sniper.children.length, models.revolver.children.length);
});
