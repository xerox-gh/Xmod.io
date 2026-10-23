import { WEAPONS } from '../../../shared/weapons.js';
export class Weapons {
  constructor(game) {
    this.game = game;
    this.config = WEAPONS;
    this.states = new Map();
    this.time = 0;
    this.kick = 0;
  }
  has(id) {
    return Object.hasOwn(WEAPONS, id);
  }
  get aiming() {
    const g = this.game;
    return !!(
      this.has(g.toolId) &&
      WEAPONS[g.toolId].aimFov &&
      g.input.locked &&
      !g.overlay &&
      !g.recorder?.playing &&
      g.cameraRig?.mode === 'first' &&
      g.input.buttons.has(2) &&
      !g.player.state.vehicleId
    );
  }
  state(id) {
    if (!this.has(id)) throw new Error('Unknown weapon');
    if (!this.states.has(id))
      this.states.set(id, { ammo: WEAPONS[id].capacity, next: 0, reload: 0, reloadStart: 0 });
    return this.states.get(id);
  }
  equip(id) {
    if (!this.has(id)) return;
    this.game.weaponChoice = id;
    this.game.selectTool(4);
    this.game.toast(`${WEAPONS[id].name} equipped`);
  }
  fire(id) {
    if (!this.has(id)) return;
    const s = this.state(id),
      def = WEAPONS[id];
    if (this.time < s.next || s.reload) return;
    if (s.ammo <= 0) {
      this.reload(id);
      return;
    }
    const accepted = this.game.action({ kind: 'fire', weapon: id, aim: this.aiming });
    if (accepted === false) return;
    if (!def.unlimited) s.ammo--;
    s.next = this.time + def.interval;
    this.game.player.recoil += def.recoil;
    this.kick = Math.min(0.14, this.kick + 0.035);
    this.game.effects?.muzzle(def.flash);
  }
  reload(id) {
    if (!this.has(id)) return;
    const s = this.state(id);
    if (!s.reload && s.ammo < WEAPONS[id].capacity) {
      s.reloadStart = this.time;
      s.reload = this.time + WEAPONS[id].reload;
      this.game.action({ kind: 'reload', weapon: id });
      this.game.toast('Reloading…');
    }
  }
  ammoLabel(id) {
    if (WEAPONS[id].unlimited) return 'MELEE';
    const s = this.state(id);
    return s.reload ? 'RELOADING' : `${s.ammo} / ${WEAPONS[id].capacity}`;
  }
  reloadProgress(id) {
    if (!this.has(id)) return 0;
    const s = this.state(id);
    return s.reload
      ? Math.max(0, Math.min(1, (this.time - s.reloadStart) / WEAPONS[id].reload))
      : 0;
  }
  update(dt) {
    this.time += dt;
    this.kick *= Math.exp(-18 * dt);
    for (const [id, s] of this.states)
      if (s.reload && this.time >= s.reload) {
        s.reload = 0;
        s.ammo = WEAPONS[id].capacity;
      }
  }
}
