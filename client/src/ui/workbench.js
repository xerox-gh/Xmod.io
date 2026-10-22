import { MAPS } from '../../../shared/maps.js';
import { PROPS } from '../../../shared/props.js';
import { TOOL_MODES, BIND_KEYS } from '../../../shared/constants.js';
import { WEAPONS } from '../../../shared/weapons.js';
import { CAMERA_MODES } from '../player/camera-rig.js';
import {
  currentBuild,
  downloadJSON,
  importBuildFile,
  encodeBuild,
  decodeBuild,
} from '../builds/files.js';
import { saveSettings } from '../core/settings.js';
const names = {
  pistol: 'Pulse pistol',
  shotgun: 'Scatter blaster',
  rocket: 'Rocket launcher',
  crowbar: 'Crowbar',
  grenade: 'Grenade',
  flamethrower: 'Flamethrower',
  exploder: 'Prop exploder',
};
const options = (items, current) =>
  items
    .map(
      ([v, label]) => `<option value="${v}" ${v === current ? 'selected' : ''}>${label}</option>`,
    )
    .join('');
export class Workbench {
  constructor(game) {
    this.game = game;
    this.tab = 'builds';
    this.target = null;
    game.construction = { speed: 8, bind: 'KeyF', axis: 'y', travel: 4 };
  }
  open(tab = this.tab) {
    const g = this.game;
    this.target = g.props.aim(g.view.camera)?.id || this.target;
    this.tab = tab;
    g.menus.modal(
      'Workbench',
      `<nav class="workbench-tabs">${['builds', 'world', 'tools', 'capture'].map((id) => `<button data-worktab="${id}" class="${this.tab === id ? 'active' : ''}">${id[0].toUpperCase() + id.slice(1)}</button>`).join('')}</nav><div class="workbench-content"></div><footer class="workbench-footer"><span>Save, tune and build · B opens Workbench</span><button id="workbench-play">Back to playground ↗</button></footer>`,
    );
    const panel = g.menus.panel;
    panel
      .querySelectorAll('[data-worktab]')
      .forEach((b) => (b.onclick = () => this.open(b.dataset.worktab)));
    panel.querySelector('#workbench-play').onclick = () => g.resume();
    this.render(panel.querySelector('.workbench-content'));
  }
  safely(fn) {
    return async () => {
      try {
        await fn();
      } catch (e) {
        this.game.toast(e.message);
      }
    };
  }
  render(root) {
    const g = this.game,
      on = (id, fn) => (root.querySelector('#' + id).onclick = this.safely(fn));
    if (this.tab === 'builds') {
      root.innerHTML =
        '<div class="workbench-grid"><section><h3>Keep your creations.</h3><p class="muted">Save selected props, or the whole solo world. Multiplayer saves your props and starter props; imports use your 60-body allowance. Loading adds a build to the current map.</p><button id="save-build">Save build file</button><label class="file-button">Load build file<input id="load-build" type="file" accept=".json,application/json"></label><p class="muted">Includes colors, sizes, frozen poses, vehicles and constraints. Z undoes an import.</p><button id="select-group">Box-select props (G)</button><button id="clear-build">Clear props · undo with Z</button></section><section><h3>Copy. Paste. Share.</h3><textarea id="share-code" aria-label="Build share code" placeholder="Paste an XMOD1 share code here" rows="7" spellcheck="false"></textarea><div class="button-row"><button id="make-code">Generate code</button><button id="copy-code">Copy code</button><button id="paste-build">Load code</button></div><p class="muted">Share codes contain build data only. Switch maps in World before loading if needed.</p></section></div>';
      on('save-build', () => downloadJSON(currentBuild(g), 'xmod-build.json'));
      root.querySelector('#load-build').onchange = this.safely(() =>
        importBuildFile(g, root.querySelector('#load-build').files[0]),
      );
      on('make-code', () => {
        root.querySelector('#share-code').value = encodeBuild(currentBuild(g));
        g.toast('Share code generated');
      });
      on('copy-code', async () => {
        const el = root.querySelector('#share-code');
        if (!el.value) el.value = encodeBuild(currentBuild(g));
        try {
          await navigator.clipboard.writeText(el.value);
          g.toast('Share code copied');
        } catch {
          el.select();
          g.toast('Code selected · press Ctrl+C to copy');
        }
      });
      on('paste-build', () =>
        g.action({
          kind: 'loadBuild',
          build: decodeBuild(root.querySelector('#share-code').value.trim()),
        }),
      );
      on('select-group', () => {
        g.menus.hide();
        g.selection.open();
      });
      on('clear-build', () => g.action({ kind: 'clear' }));
    } else if (this.tab === 'world') {
      root.innerHTML = `<div class="workbench-grid"><section><h3>Somewhere new.</h3><label>Map<select id="world-map" aria-label="Map">${options(
        Object.values(MAPS).map((m) => [m.id, m.name]),
        g.sim.world.map.id,
      )}</select></label><p class="muted">Switching maps clears the world. Save your build first. Online, the room owner controls maps, gravity and time.</p><button id="apply-map">Load map</button><label>Gravity<select id="gravity-preset" aria-label="Gravity preset">${options(
        [
          ['20', 'Earth'],
          ['3.3', 'Moon'],
          ['0', 'Zero-g'],
          ['40', 'Heavy'],
        ],
        String(-g.sim.world.gravity.y),
      )}</select></label><button id="apply-gravity">Apply gravity</button><label>Time<select id="time-preset" aria-label="Time scale">${options(
        [
          ['1', 'Normal'],
          ['0.25', 'Slow motion'],
          ['0', 'Freeze time'],
        ],
        String(g.sim.timeScale),
      )}</select></label><button id="apply-time">Apply time</button><p class="muted">H toggles slow motion · P freezes / resumes</p></section><section><h3>Set the atmosphere.</h3><label>Sky<select id="sky-preset" aria-label="Sky">${options(
        [
          ['day', 'Day'],
          ['sunset', 'Sunset'],
          ['night', 'Night'],
          ['void', 'Deep space'],
        ],
        g.sky || 'day',
      )}</select></label><label>Weather<select id="weather-preset" aria-label="Weather">${options(
        [
          ['clear', 'Clear'],
          ['rain', 'Rain'],
          ['snow', 'Snow'],
        ],
        g.weather.kind,
      )}</select></label><label>Quality<select id="quality-preset" aria-label="Quality">${options(
        ['auto', 'low', 'medium', 'high'].map((x) => [x, x]),
        g.quality.mode,
      )}</select></label><p class="muted">Auto detects your hardware and adjusts after sustained low FPS. Far sleeping props use simple instanced shapes. F3 shows rendering and physics stats.</p><button id="debug-toggle">Toggle F3 overlay</button></section></div>`;
      on('apply-map', () => {
        g.action({ kind: 'map', map: root.querySelector('#world-map').value });
        g.toast('Map requested');
      });
      on('apply-gravity', () =>
        g.action({ kind: 'gravity', value: Number(root.querySelector('#gravity-preset').value) }),
      );
      on('apply-time', () =>
        g.action({ kind: 'time', value: Number(root.querySelector('#time-preset').value) }),
      );
      root.querySelector('#sky-preset').onchange = (e) => {
        g.sky = e.target.value;
        g.view.setSky(g.sky);
      };
      root.querySelector('#weather-preset').onchange = (e) => g.weather.set(e.target.value);
      root.querySelector('#quality-preset').onchange = (e) => {
        g.quality.apply(e.target.value);
        saveSettings(g.settings);
      };
      on('debug-toggle', () => g.quality.toggle());
    } else if (this.tab === 'tools') {
      root.innerHTML = `<div class="workbench-grid"><section><h3>Build a mechanism.</h3><label>Tool mode<select id="construction-mode" aria-label="Tool mode">${options(
        TOOL_MODES.map((x, i) => [String(i), x]),
        String(g.toolMode),
      )}</select></label><label>Rotation / slide axis<select id="construction-axis">${options(
        ['x', 'y', 'z'].map((x) => [x, x.toUpperCase()]),
        g.construction.axis,
      )}</select></label><label>Motor speed (rad/s)<input id="motor-speed" aria-label="Motor speed" type="number" min="-30" max="30" step="1" value="${g.construction.speed}"></label><label>Motor bind<select id="motor-bind" aria-label="Motor bind">${options(
        BIND_KEYS.map((x) => [x, x.slice(3)]),
        g.construction.bind,
      )}</select></label><label>Slider travel<input id="slider-travel" type="number" min=".25" max="12" step=".25" value="${g.construction.travel}"></label><button id="equip-tool">Equip tool</button><button id="configure-motor">Apply speed / bind to aimed motor</button><p class="muted">Weld, rope, motor, hinge and slider: select two props. Motor/hinge use the first click as the pivot. Freeze the base for a door or crane. Duplicator copies the entire connected contraption in one click.</p></section><section><h3>Try something different.</h3><label>Weapon<select id="weapon-choice" aria-label="Weapon">${options(
        Object.keys(WEAPONS).map((x) => [x, names[x]]),
        g.weaponChoice || 'pistol',
      )}</select></label><button id="equip-weapon">Equip weapon (slot 5)</button><label>Vehicle<select id="vehicle-choice" aria-label="Vehicle">${options(
        Object.entries(PROPS)
          .filter(([, d]) => d.vehicle)
          .map(([id, d]) => [id, d.name]),
        g.vehicleChoice || 'car',
      )}</select></label><button id="equip-vehicle">Equip vehicle (slot 9)</button><h3>Pose a dummy.</h3><p class="muted">Aim at a limb before opening B, or use the Pose tool. Each apply rotates that joint by the entered angles, moves its child limbs, and freezes the dummy. Z restores the previous pose.</p><div class="pose-angles">${['X', 'Y', 'Z'].map((x) => `<label>${x}°<input data-pose="${x}" type="number" min="-180" max="180" value="0"></label>`).join('')}</div><button id="apply-pose">Rotate joint & freeze</button><button id="release-pose">Release dummy</button></section></div>`;
      const settings = () => {
        g.construction = {
          speed: Number(root.querySelector('#motor-speed').value),
          bind: root.querySelector('#motor-bind').value,
          axis: root.querySelector('#construction-axis').value,
          travel: Number(root.querySelector('#slider-travel').value),
        };
      };
      on('equip-tool', () => {
        settings();
        g.toolMode = Number(root.querySelector('#construction-mode').value);
        g.tools.toolgun.first = null;
        g.selectTool(1);
        g.resume();
      });
      on('configure-motor', () => {
        settings();
        g.action({ kind: 'motorConfig', id: this.target, ...g.construction });
      });
      on('equip-weapon', () => {
        g.weaponChoice = root.querySelector('#weapon-choice').value;
        g.selectTool(4);
        g.resume();
      });
      on('equip-vehicle', () => {
        g.vehicleChoice = root.querySelector('#vehicle-choice').value;
        g.selectTool(8);
        g.resume();
      });
      on('apply-pose', () =>
        g.action({
          kind: 'pose',
          id: this.target,
          angles: [...root.querySelectorAll('[data-pose]')].map((el) => Number(el.value)),
        }),
      );
      on('release-pose', () => g.action({ kind: 'poseFreeze', id: this.target, value: false }));
    } else {
      root.innerHTML = `<div class="workbench-grid"><section><h3>Find your angle.</h3><label>Camera<select id="camera-mode" aria-label="Camera mode">${options(
        CAMERA_MODES.map((x) => [x, x === 'chase' ? 'Vehicle chase' : x]),
        g.cameraRig.mode,
      )}</select></label><p class="muted">F5 cycles cameras. Free camera: WASD, Space / C up/down, Shift faster. Free camera leaves your player in place. Use time-freeze for a still scene.</p><button id="screenshot">Save screenshot (F2)</button><button id="video">Start / stop WebM video</button><p class="muted">Video records the canvas for up to 30 seconds, where supported by your browser.</p></section><section><h3>Watch the chaos again.</h3><button id="record-replay">${g.recorder.recording ? 'Stop replay recording' : 'Record 30-second replay'}</button><button id="play-replay">Play replay</button><button id="stop-replay">Stop playback</button><button id="save-replay">Save replay file</button><label class="file-button">Load replay file<input id="load-replay" type="file" accept=".json,application/json"></label><p class="muted">Replays record prop transforms and camera movement at 10 Hz. Playback is visual, in the same map, and does not rewind the shared multiplayer world.</p></section></div>`;
      root.querySelector('#camera-mode').onchange = (e) => g.cameraRig.set(e.target.value);
      on('screenshot', () => g.recorder.screenshot());
      on('video', () => g.recorder.video());
      on('record-replay', () => {
        g.recorder.toggle();
        root.querySelector('#record-replay').textContent = g.recorder.recording
          ? 'Stop replay recording'
          : 'Record 30-second replay';
      });
      on('play-replay', () => {
        g.recorder.play();
        g.resume();
      });
      on('stop-replay', () => g.recorder.stopPlayback());
      on('save-replay', () => g.recorder.export());
      root.querySelector('#load-replay').onchange = this.safely(() =>
        g.recorder.import(root.querySelector('#load-replay').files[0]),
      );
    }
  }
}
export { names as WEAPON_NAMES };
