import { saveSettings } from '../core/settings.js';
export class Menus {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'menu-screen';
    this.el.innerHTML = `<div class="menu-top"><a class="wordmark">Xmod<span>.io</span></a><span class="build-label"><i></i> SANDBOX / EARLY ACCESS</span></div><div class="menu-layout"><section class="intro"><div class="eyebrow"><span class="line"></span> A PHYSICS PLAYGROUND</div><h1>Big ideas.<br>Zero rules<span>.</span></h1><p>Build a contraption. Break the laws of physics.<br>Or just throw a sofa at your friends.</p><button class="play-button" id="play"><span><small>YOUR WORLD. YOUR WAY.</small><strong>Enter playground</strong></span><b>↗</b></button><div class="menu-links"><button id="weapons">⌐ Weapons</button><button id="multiplayer">◎ Multiplayer</button><button id="workbench">▧ Workbench</button><button id="settings">⚙ Settings</button><button id="controls">⌘ Controls</button></div><span class="intro-foot">NO DOWNLOADS. NO ASSETS. JUST POSSIBILITIES.</span></section><div class="map-caption"><span>01 / THE ORIGINAL PLAYGROUND</span><h2>Flatgrass</h2><p>Room to make something ridiculous.</p><div><span>PROCEDURAL WORLD</span><span>200 PHYSICS BODIES</span></div></div></div><footer class="menu-bottom"><span><b>●</b> READY WHEN YOU ARE</span><span>MADE TO BE MESSED WITH ↗</span><span>v0.3 / XMOD.IO</span></footer>`;
    root.append(this.el);
    this.el.querySelector('#play').onclick = () => game.resume();
    this.el.querySelector('#weapons').onclick = () => game.spawnMenu.open('Weapons');
    this.el.querySelector('#workbench').onclick = () => game.workbench.open();
    const toybox = document.createElement('button');
    toybox.id = 'toybox';
    toybox.textContent = '◇ Toybox';
    toybox.onclick = () => game.lab.open();
    this.el.querySelector('.menu-links').insertBefore(toybox, this.el.querySelector('#workbench'));
    this.el.querySelector('.menu-bottom span:last-child').textContent = 'v0.4 / XMOD.IO';
    this.el.querySelector('#settings').onclick = () => this.settings();
    this.el.querySelector('#controls').onclick = () => this.controls();
    this.el.querySelector('#multiplayer').onclick = () => this.multiplayer();
    this.panel = document.createElement('div');
    this.panel.className = 'overlay';
    this.panel.hidden = true;
    root.append(this.panel);
  }
  show() {
    this.game.overlay = this.game.started ? 'pause' : 'menu';
    this.el.hidden = false;
    this.panel.hidden = true;
    this.el.querySelector('.play-button strong').textContent = this.game.started
      ? 'Back to playground'
      : 'Enter playground';
  }
  hide() {
    this.el.hidden = true;
    this.panel.hidden = true;
  }
  modal(title, content) {
    this.game.overlay = 'modal';
    this.game.input.unlock();
    this.el.hidden = true;
    this.panel.hidden = false;
    this.panel.innerHTML = `<section class="modal"><header><div><span class="eyebrow">XMOD.IO / PLAYGROUND</span><h2>${title}</h2></div><button class="icon-button" id="back" aria-label="Back to main menu">×</button></header>${content}</section>`;
    this.panel.querySelector('#back').onclick = () => this.show();
  }
  settings() {
    const s = this.game.settings;
    this.modal(
      'Make yourself at home.',
      `<div class="settings-list"><label>Field of view <output>${s.fov}°</output><input data-setting="fov" aria-label="Field of view" type="range" min="65" max="115" value="${s.fov}"></label><label>Mouse sensitivity <output>${s.sensitivity}</output><input data-setting="sensitivity" aria-label="Mouse sensitivity" type="range" min="0.2" max="3" step="0.05" value="${s.sensitivity}"></label><label>Sound volume <output>${Math.round(s.volume * 100)}%</output><input data-setting="volume" aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value="${s.volume}"></label><label>Soft shadows<input data-setting="shadows" aria-label="Soft shadows" type="checkbox" ${s.shadows ? 'checked' : ''}></label><label>Resolution scale<select data-setting="pixelRatio" aria-label="Resolution scale"><option value="1">Performance (1×)</option><option value="1.5">Balanced (1.5×)</option><option value="2">Sharp (2×)</option></select></label></div>`,
    );
    this.panel.querySelector('select').value = s.pixelRatio;
    this.panel.querySelectorAll('[data-setting]').forEach(
      (el) =>
        (el.oninput = () => {
          const key = el.dataset.setting;
          s[key] = el.type === 'checkbox' ? el.checked : +el.value;
          const o = el.parentElement.querySelector('output');
          if (o)
            o.textContent =
              key === 'fov'
                ? `${s[key]}°`
                : key === 'volume'
                  ? `${Math.round(s[key] * 100)}%`
                  : s[key];
          saveSettings(s);
          this.game.view.renderer.shadowMap.enabled = s.shadows;
          this.game.view.renderer.setPixelRatio(Math.min(devicePixelRatio, s.pixelRatio));
        }),
    );
  }
  controls() {
    this.modal(
      'Your keys to the sandbox.',
      `<div class="control-grid">${[
        ['W A S D', 'Move / drive'],
        ['MOUSE', 'Look / aim'],
        ['SPACE', 'Jump / brake'],
        ['SHIFT', 'Sprint'],
        ['C', 'Crouch / slide'],
        ['V', 'Toggle noclip'],
        ['1–9 / WHEEL', 'Switch tools'],
        ['Q', 'Object library'],
        ['LMB / RMB', 'Use tool / secondary'],
        ['E', 'Enter car / rotate held prop'],
        ['R', 'Tool mode / reload'],
        ['Z', 'Undo last action'],
        ['F', 'Thrusters / wheel motors'],
        ['N', 'Day / night'],
        ['B', 'Workbench / save / maps'],
        ['G', 'Box select / group move'],
        ['H / P', 'Slow motion / freeze time'],
        ['F2 / F5', 'Screenshot / camera mode'],
        ['F3', 'Performance overlay'],
        ['T', 'Room chat'],
        ['` / ENTER', 'Console'],
        ['ESC', 'Pause / close menu'],
      ]
        .map(([key, action]) => `<span><kbd>${key}</kbd><strong>${action}</strong></span>`)
        .join('')}</div>`,
    );
  }
  multiplayer() {
    this.modal('Better with friends.', '<p class="muted">Connecting to the room server…</p>');
    this.game.openMultiplayer?.(this.panel);
  }
}
