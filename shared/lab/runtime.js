import { stepDevices, physicsMaterial } from './physics.js';
import { stepWires } from './wires.js';
import { stepEnvironment } from './environment.js';
import { ignite, stepFire } from './fracture.js';
import { GADGETS, fireGadget, stepGadgets } from './gadgets.js';
import { freeze } from '../grabbing.js';
import { stepAI, hurt } from './ai.js';
import { LabModes } from './modes.js';
// All persistent parameters live on entities/constraints; transient integrals,
// signal values and cooldowns stay here and cannot inflate a saved build.
export class LabRuntime {
  constructor(sim) {
    this.sim = sim;
    this.actors = new Map();
    this.states = new Map();
    this.values = new Map();
    this.breakQueue = new Set();
    this.grapples = new Map();
    this.singularities = new Map();
    this.ice = [];
    this.loops = [];
    this.modes = new LabModes(this);
    this.environment = { windX: 0, windZ: 0, currentX: 0, currentZ: 0, whirlpool: 0 };
  }
  state(id) {
    if (!this.states.has(id)) this.states.set(id, {});
    return this.states.get(id);
  }
  configure(e) {
    physicsMaterial(this, e);
    if (e.type === 'gravity_zone') {
      e.body.collisionResponse = false;
      e.body.mass = 0;
      e.body.type = 2;
      e.body.updateMassProperties();
    }
  }
  ignite(e) {
    ignite(this, e);
  }
  fire(actor, id, button = 0) {
    if (!Object.hasOwn(GADGETS, id)) throw new Error('Unknown gadget');
    return fireGadget(this, actor, id, button);
  }
  hit(e, power = 1) {
    if (!e) return;
    hurt(this, e, power * 20);
    const s = this.state(e.id);
    s.damage = (s.damage || 0) + power;
    if (e.behavior.cryo && power >= 1) {
      e.behavior.cryo = false;
      freeze(this.sim, e.id, false);
    }
    if (e.type === 'glass' || e.type === 'pot' || (e.behavior.breakable && s.damage >= 3))
      this.breakQueue.add(e.id);
  }
  step(dt) {
    stepWires(this, dt);
    stepDevices(this, dt);
    stepEnvironment(this, dt);
    stepGadgets(this, dt);
    stepAI(this, dt);
    this.modes.step(dt);
    stepFire(this, dt);
    for (const id of this.states.keys())
      if (!this.sim.entities.has(id) && !this.actors.has(id) && !id.startsWith('gadget_')) {
        this.states.delete(id);
        this.values.delete(id);
      }
  }
  reset() {
    this.states.clear();
    this.values.clear();
    this.breakQueue.clear();
    this.grapples.clear();
    this.singularities.clear();
    this.ice = [];
    this.loops = [];
    this.modes.stop();
  }
}
