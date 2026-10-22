import { WEAPONS } from '../../../shared/weapons.js';
import pistol from './pistol.js';
import shotgun from './shotgun.js';
import rocket from './rocket.js';
export class Weapons {
  constructor(game) {
    this.game = game;
    this.config = { pistol, shotgun, rocket };
    this.states = new Map();
    this.time = 0;
  }
  has(id) {
    return !!WEAPONS[id];
  }
  state(id) {
    if (!this.states.has(id))
      this.states.set(id, { ammo: WEAPONS[id].capacity, next: 0, reload: 0 });
    return this.states.get(id);
  }
  fire(id) {
    if (!this.has(id)) return;
    const s = this.state(id);
    if (this.time < s.next || s.reload) return;
    if (s.ammo <= 0) {
      this.reload(id);
      return;
    }
    s.ammo--;
    s.next = this.time + WEAPONS[id].interval;
    this.game.action({ kind: 'fire', weapon: id });
    this.game.player.recoil += this.config[id].recoil;
    this.game.effects?.muzzle(this.config[id].flash);
  }
  reload(id) {
    if (!this.has(id)) return;
    const s = this.state(id);
    if (!s.reload && s.ammo < WEAPONS[id].capacity) {
      s.reload = this.time + WEAPONS[id].reload;
      this.game.action({ kind: 'reload', weapon: id });
      this.game.toast('Reloading…');
    }
  }
  ammoLabel(id) {
    const s = this.state(id);
    return s.reload ? 'RELOADING' : `${s.ammo} / ${WEAPONS[id].capacity}`;
  }
  update(dt) {
    this.time += dt;
    for (const [id, s] of this.states)
      if (s.reload && this.time >= s.reload) {
        s.reload = 0;
        s.ammo = WEAPONS[id].capacity;
      }
  }
}
