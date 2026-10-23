import { WEAPONS } from '../../../shared/weapons.js';
import { WEAPON_NAMES } from './workbench.js';
import { PROPS } from '../../../shared/props.js';
import { HOTBAR, TOOL_MODES } from '../../../shared/constants.js';
export class HUD {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `<div class="game-brand"><b class="brand-symbol">×</b><strong>Xmod<span>.io</span></strong><span class="world-tag">FLATGRASS</span></div><div class="performance"><i></i><span id="status-label">SOLO PLAYGROUND</span><span id="fps">60 FPS</span></div><div class="scope-overlay" hidden><div class="scope-reticle"></div><span>LONGSHOT · 4×</span></div><div class="crosshair"><i></i><i></i></div><div id="target-label"></div><div class="quick-guide"><span><kbd>B</kbd> Workbench</span><span><kbd>G</kbd> Select</span><span><kbd>Q</kbd> Objects / guns</span><span><kbd>V</kbd> Noclip</span><span><kbd>Z</kbd> Undo</span><span><kbd>E</kbd> Interact</span></div><div class="tool-info"><span class="eyebrow" id="tool-mode">BUILD / EXPERIMENT / REPEAT</span><h3 id="tool-name">Physics gun</h3><p id="tool-hint"></p></div><div class="hotbar">${HOTBAR.map((t, i) => `<button title="${t.name}" data-slot="${i}"><kbd>${i + 1}</kbd><span class="slot-icon">${['⌁', '⚒', '▧', '♟', '⌐', '╒', '↗', '◈', '▣'][i]}</span><small>${t.name}</small></button>`).join('')}</div><div class="world-info"><span id="body-count">0 / 200 PROPS</span><span id="movement-status">ON FOOT</span></div><div id="toast" role="status"></div>`;
    root.append(this.el);
    root.append(this.el.querySelector('#toast'));
    this.el
      .querySelectorAll('[data-slot]')
      .forEach((b) => (b.onclick = () => game.selectTool(+b.dataset.slot)));
    this.clock = 0;
    this.frames = 0;
  }
  update(dt) {
    const g = this.game;
    this.el.hidden = !g.started || ['menu', 'pause', 'modal', 'spawn'].includes(g.overlay);
    this.clock += dt;
    this.frames++;
    if (this.clock > 0.6) {
      this.el.querySelector('#fps').textContent = `${Math.round(this.frames / this.clock)} FPS`;
      this.clock = this.frames = 0;
    }
    const tool = HOTBAR[g.slot];
    this.el.querySelector('#tool-name').textContent =
      g.slot === 4
        ? WEAPON_NAMES[g.toolId]
        : g.slot === 8
          ? PROPS[g.vehicleChoice].name
          : tool.name;
    const weapon = WEAPONS[g.toolId];
    const scoped = !!(g.weapons.aiming && weapon?.scope);
    this.el.querySelector('.scope-overlay').hidden = !scoped;
    this.el.querySelector('.crosshair').hidden = scoped;
    this.el.querySelector('#tool-hint').textContent = weapon?.gun
      ? `${weapon.automatic ? 'Hold' : 'Click'} LMB fire · RMB ${weapon.scope ? 'scope' : 'aim'} · R reload · Q weapons`
      : tool.hint;
    const slot = this.el.querySelector('[data-slot="4"]');
    slot.querySelector('small').textContent = WEAPON_NAMES[g.weaponChoice];
    slot.title = WEAPON_NAMES[g.weaponChoice];
    this.el.querySelector('#tool-mode').textContent =
      g.toolId === 'toolgun'
        ? `MODE / ${TOOL_MODES[g.toolMode]}`
        : g.toolId === 'spawner'
          ? `OBJECT / ${g.spawner.selected.toUpperCase()}`
          : g.weapons?.has(g.toolId)
            ? `AMMO / ${g.weapons.ammoLabel(g.toolId)}`
            : 'BUILD / EXPERIMENT / REPEAT';
    this.el
      .querySelectorAll('[data-slot]')
      .forEach((b) => b.classList.toggle('selected', +b.dataset.slot === g.slot));
    this.el.querySelector('#body-count').textContent = `${g.sim.entities.size} / 200 BODIES`;
    this.el.querySelector('#movement-status').textContent = g.vehicleId
      ? 'DRIVING · E EXIT'
      : g.player.state.fly
        ? 'NOCLIP ENABLED'
        : g.player.state.crouched
          ? 'SLIDING / CROUCHING'
          : 'ON FOOT';
    this.el.querySelector('.world-tag').textContent =
      g.sim.world.map.name.toUpperCase() + (g.sim.timeScale !== 1 ? ` · ×${g.sim.timeScale}` : '');
    this.el.querySelector('#status-label').textContent = g.net?.connected
      ? `${g.net.roomName} · ${g.net.latency} MS`
      : 'SOLO PLAYGROUND';
  }
}
