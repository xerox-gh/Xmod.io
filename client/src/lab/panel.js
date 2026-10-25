import { LAB_TOOLS, LAB_DEFAULTS } from '../../../shared/lab/definitions.js';
import { TOOL_IDS } from '../../../shared/constants.js';
import { MODE_NAMES } from '../../../shared/lab/modes.js';
import { GADGETS } from '../../../shared/lab/gadgets.js';
import { FILTERS } from './filters.js';
import { currentBuild, downloadBlob, downloadJSON } from '../builds/files.js';
import { buildURL, saveCard } from './codec.js';
export const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const definitions = {
  height: ['Altitude', 'number', -20, 100, 0.5],
  speed: ['Device speed', 'number', -25, 25, 0.5],
  bind: ['Raise / extend bind', ['KeyJ', 'KeyK', 'KeyL', 'KeyF', 'KeyU', 'KeyI', 'KeyO']],
  downBind: ['Lower / retract bind', ['KeyK', 'KeyJ', 'KeyL', 'KeyF', 'KeyU', 'KeyI', 'KeyO']],
  axis: ['Axle axis', ['x', 'y', 'z']],
  material: ['Physics material', ['normal', 'rubber', 'ice', 'foam', 'lead']],
  strength: ['Magnet strength (+ attract / − repel)', 'number', -30, 30, 1],
  radius: ['Magnet radius', 'number', 1, 25, 1],
  buoyancy: ['Buoyancy factor', 'number', 0, 5, 0.1],
  trail: ['Trail style', ['rainbow', 'light', 'smoke', 'off']],
  input: ['Wire destination port', ['a', 'b', 'x', 'y', 'z']],
  range: ['Sensor range / radius', 'number', 1, 60, 1],
  frequency: ['Synth frequency (Hz)', 'number', 40, 2000, 10],
  waveform: ['Oscillator waveform', ['sine', 'square', 'sawtooth']],
  period: ['Clock period (seconds)', 'number', 0.1, 10, 0.1],
  text: ['Screen text', 'text'],
  display: ['Screen display', ['number', 'text', 'graph']],
  turret: ['Automatic defense turret', 'checkbox'],
  targetX: ['Target X', 'number', -170, 170, 1],
  targetY: ['Target Y', 'number', -30, 100, 1],
  targetZ: ['Target Z', 'number', -170, 170, 1],
  gx: ['Zone gravity X', 'number', -40, 40, 1],
  gy: ['Zone gravity Y', 'number', -40, 40, 1],
  gz: ['Zone gravity Z', 'number', -40, 40, 1],
  zoneSize: ['Gravity volume size', 'number', 2, 30, 1],
  lift: ['Airfoil lift', 'number', 0, 8, 0.1],
  faction: ['Faction', ['friendly', 'red', 'blue', 'green', 'hostile']],
  command: ['NPC command', ['wander', 'follow', 'guard']],
  npcWeapon: ['NPC weapon', ['melee', 'ranged']],
};
const fields = (lab, keys) =>
  keys
    .map((key) => {
      const [label, type, min, max, step] = definitions[key],
        value = lab.settings[key] ?? LAB_DEFAULTS[key] ?? (type === 'number' ? 0 : '');
      return `<label>${label}${Array.isArray(type) ? `<select data-labfield="${key}" aria-label="${label}">${type.map((v) => `<option value="${v}" ${v === value ? 'selected' : ''}>${v.startsWith('Key') ? v.slice(3) : v}</option>`).join('')}</select>` : `<input data-labfield="${key}" aria-label="${label}" type="${type}" ${type === 'checkbox' ? (value ? 'checked' : '') : `value="${escapeHTML(value)}"`} ${type === 'number' ? `min="${min}" max="${max}" step="${step}"` : ''}>`}</label>`;
    })
    .join('');
const read = (lab, root) => {
  const patch = {};
  root
    .querySelectorAll('[data-labfield]')
    .forEach(
      (el) =>
        (patch[el.dataset.labfield] =
          el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value),
    );
  Object.assign(lab.settings, patch);
  return patch;
};
const apply = (lab, patch) => {
  if (!lab.target) throw new Error('Aim at a prop before opening the Toybox');
  return lab.game.action({ kind: 'labConfig', id: lab.target, settings: patch });
};
const section = (title, body) => `<section><h3>${title}</h3>${body}</section>`;
const button = (id, text) => `<button id="${id}">${text}</button>`;
export function openLab(lab, tab = lab.tab || 'engineering') {
  const g = lab.game;
  lab.target = g.props.aim(g.view.camera)?.id || lab.target;
  lab.tab = tab;
  const tabs = [
    'engineering',
    'wiring',
    'environment',
    'garage',
    'gadgets',
    'modes',
    'actors',
    'camera',
    'peers',
  ];
  g.menus.modal(
    'The Toybox',
    `<nav class="lab-tabs">${tabs.map((id) => `<button data-labtab="${id}" class="${id === tab ? 'active' : ''}">${id[0].toUpperCase() + id.slice(1)}</button>`).join('')}</nav><p class="lab-target muted"></p><div class="lab-content"></div><footer class="workbench-footer"><span>Browser tools · local saves · original toys</span>${button('lab-back', 'Back to playground ↗')}</footer>`,
  );
  const panel = g.menus.panel,
    root = panel.querySelector('.lab-content'),
    on = (id, fn) => {
      const el = root.querySelector('#' + id);
      if (el)
        el.onclick = async () => {
          try {
            await fn();
          } catch (error) {
            g.toast(error.message);
          }
        };
    };
  panel
    .querySelectorAll('[data-labtab]')
    .forEach((b) => (b.onclick = () => openLab(lab, b.dataset.labtab)));
  panel.querySelector('#lab-back').onclick = () => g.resume();
  const target = g.sim.entities.get(lab.target);
  panel.querySelector('.lab-target').textContent = target
    ? `Aimed prop: ${target.type} · ${target.id}`
    : 'Aim at a prop before opening to configure it.';
  if (tab === 'engineering') {
    lab.tool ??= 'hover';
    const toolKeys = {
      hover: ['height', 'bind', 'downBind'],
      winch: ['speed', 'bind', 'downBind'],
      hydraulic: ['speed', 'bind', 'downBind'],
      pulley: [],
      upright: [],
      axis: ['axis'],
      ballsocket: [],
      nocollide: [],
      properties: ['material'],
      magnet: ['strength', 'radius'],
      buoyancy: ['buoyancy'],
      trail: ['trail'],
      wire: ['input'],
      portalLink: [],
      cameraLink: [],
    };
    root.innerHTML = `<div class="workbench-grid">${section('Build a mechanism.', `<label>Advanced tool<select id="lab-tool" aria-label="Advanced tool">${LAB_TOOLS.map(([id, name]) => `<option value="${id}" ${id === lab.tool ? 'selected' : ''}>${name}</option>`).join('')}</select></label>${fields(lab, toolKeys[lab.tool])}${button('lab-equip', 'Equip advanced tool')}${button('lab-configure', 'Apply these settings to aimed prop')}<p class="muted">Two-object tools: LMB selects each end. Pulley: RMB adds up to four fixed map anchors first; without anchors it uses an overhead route. J/K adjust hover height and rope length. R cycles modes. No-Collide affects just the selected pair.</p>`)}${section('Device shelf.', `<div class="lab-spawn-grid">${['hoverball', 'wing', 'glass', 'pot', 'telepad', 'gravity_zone', 'mirror', 'cctv', 'monitor'].map((id) => button('spawn-' + id, id.replaceAll('_', ' '))).join('')}</div><p class="muted">Hoverballs attach to a prop with the tool. Keep Upright removes pitch/roll while preserving yaw. Wire outputs can control motors, winches, lamps, doors and thrusters.</p>`)}</div>`;
    root.querySelector('#lab-tool').onchange = (e) => {
      read(lab, root);
      lab.tool = e.target.value;
      openLab(lab, tab);
    };
    on('lab-equip', () => {
      read(lab, root);
      g.toolMode = TOOL_IDS.indexOf(lab.tool);
      g.tools.toolgun.first = null;
      g.tools.toolgun.anchors = [];
      g.selectTool(1);
      g.resume();
      g.toast(LAB_TOOLS.find(([id]) => id === lab.tool)[1] + ' equipped');
    });
    on('lab-configure', () =>
      lab.tool === 'upright'
        ? g.action({ kind: 'tool', mode: 'upright', id: lab.target })
        : apply(lab, read(lab, root)),
    );
  } else if (tab === 'wiring') {
    root.innerHTML = `<div class="workbench-grid">${section('Connect output to input.', `${fields(lab, ['input', 'range', 'frequency', 'waveform', 'period', 'text', 'display', 'turret', 'targetX', 'targetY', 'targetZ'])}${button('lab-wire', 'Equip visual wire tool')}${button('wire-configure', 'Apply device settings')}<p class="muted">LMB output prop, then input prop. A/B feed gates, A drives actuators; X/Y/Z set gimbal coordinates. A digital screen graphs its A signal. Sound pitch follows A (1 uses the base frequency). Gates use the previous physics tick, so feedback stays bounded.</p>`)}${section('Wire components.', `<div class="lab-spawn-grid">${['laser_sensor', 'proximity_sensor', 'speed_sensor', 'altimeter', 'logic_and', 'logic_or', 'logic_not', 'logic_xor', 'logic_clock', 'logic_latch', 'sound_emitter', 'digital_screen', 'turret', 'button', 'lamp', 'door'].map((id) => button('spawn-' + id, id.replaceAll('_', ' '))).join('')}</div>`)}</div>`;
    on('lab-wire', () => {
      read(lab, root);
      lab.tool = 'wire';
      g.toolMode = TOOL_IDS.indexOf('wire');
      g.selectTool(1);
      g.resume();
    });
    on('wire-configure', () => apply(lab, read(lab, root)));
  } else if (tab === 'environment') {
    const env = g.sim.lab.environment;
    root.innerHTML = `<div class="workbench-grid">${section('Local gravity and lift.', `${fields(lab, ['gx', 'gy', 'gz', 'zoneSize', 'lift'])}${button('zone-configure', 'Apply to aimed volume / airfoil')}${button('spawn-gravity_zone', 'Spawn gravity volume')}${button('spawn-wing', 'Spawn airfoil')}<p class="muted">Volumes override gravity inside their cube. Zero all axes for zero-G; positive Y reverses gravity. Airfoils use their local up direction and forward airspeed.</p>`)}${section('Wind and water.', `${['windX', 'windZ', 'currentX', 'currentZ', 'whirlpool'].map((key) => `<label>${key}<input data-env="${key}" aria-label="${key}" type="range" min="-20" max="20" value="${env[key]}"><output>${env[key]}</output></label>`).join('')}${button('apply-environment', 'Apply wind / currents')}<p class="muted">Water flow and whirlpools apply inside Flatgrass’s water pit. Buoyancy tools tune individual hulls. Wood ignited by flames chars, spreads fire nearby and breaks into temporary debris.</p>`)}</div>`;
    root
      .querySelectorAll('[data-env]')
      .forEach((el) => (el.oninput = () => (el.nextElementSibling.textContent = el.value)));
    on('apply-environment', () =>
      g.action({
        kind: 'environment',
        ...Object.fromEntries(
          [...root.querySelectorAll('[data-env]')].map((el) => [el.dataset.env, Number(el.value)]),
        ),
      }),
    );
    on('zone-configure', () => apply(lab, read(lab, root)));
  } else if (tab === 'garage') renderGarage(lab, root, on);
  else if (tab === 'gadgets') {
    root.innerHTML = `<div class="lab-gadget-grid">${Object.entries(GADGETS)
      .map(
        ([id, d]) =>
          `<button data-gadget="${id}"><strong>${d.name}</strong><small>${d.hint}</small><span>Equip ↗</span></button>`,
      )
      .join(
        '',
      )}</div><p class="muted">R releases dual tethers. The RC controller leaves your body in place while WASD drives the linked vehicle. Scale rays disconnect old joints while the collider changes.</p>`;
    root.querySelectorAll('[data-gadget]').forEach(
      (b) =>
        (b.onclick = () => {
          g.weapons.equip(b.dataset.gadget);
          g.resume();
        }),
    );
  } else if (tab === 'modes') {
    const state = g.sim.lab.modes.state;
    root.innerHTML = `<div class="workbench-grid">${section(
      'A different kind of chaos.',
      `<label>Mini-gamemode<select id="mini-mode" aria-label="Mini-gamemode">${Object.entries(
        MODE_NAMES,
      )
        .map(
          ([id, name]) =>
            `<option value="${id}" ${id === state.id ? 'selected' : ''}>${name}</option>`,
        )
        .join(
          '',
        )}</select></label><label>Prop Hunt role<select id="hunt-role" aria-label="Prop Hunt role"><option value="hunter">Hunter</option><option value="hider">Hider</option></select></label>${button('start-mode', 'Start mode')}${button('stop-mode', 'Return to sandbox')}${button('disguise', 'Disguise as aimed prop')}${button('save-ghost', 'Save best lap ghost')}<p class="muted">Modes run locally or on the direct peer host. Starting another mode removes mode-spawned objects. Save your build first.</p>`,
    )}${section('Rules.', `<p><b>Prop Hunt:</b> solo hunters find four disguised props; wrong shots cost health. Solo hiders evade dummy hunters. Aim at a prop, open this panel and disguise. Direct peers can take opposite roles.</p><p><b>Derby:</b> drive through checkpoints in order, with millisecond lap times and a best-lap ghost.</p><p><b>Beacon Defense:</b> protect the core against stronger waves. Build barricades and enable defense turrets.</p><p><b>Rising Lava:</b> build upward or fly before the floor reaches you.</p><p><b>Build & Destroy:</b> 180 seconds building, then 120 seconds of rockets and grenades.</p>`)}</div>`;
    on('start-mode', () => {
      g.action({
        kind: 'mode',
        mode: root.querySelector('#mini-mode').value,
        role: root.querySelector('#hunt-role').value,
      });
      g.resume();
    });
    on('stop-mode', () => {
      g.action({ kind: 'mode', mode: 'sandbox' });
      g.resume();
    });
    on('disguise', () => {
      g.action({ kind: 'modeAction', op: 'disguise', id: lab.target });
      g.resume();
    });
    on('save-ghost', async () => {
      const ghost = g.sim.lab.modes.ghosts.get(g.owner);
      if (!ghost) throw new Error('Finish a lap first');
      await lab.garage.save('ghost', 'Best lap', ghost, await lab.thumbnail());
      g.toast('Lap ghost saved to local garage');
    });
  } else if (tab === 'actors') {
    root.innerHTML = `<div class="workbench-grid">${section('Pick a side.', `${fields(lab, ['faction', 'command', 'npcWeapon', 'speed'])}${button('configure-npc', 'Apply to aimed dummy')}${button('spawn-npc', 'Spawn jointed NPC')}${button('spawn-nextbot', 'Spawn billboard chaser')}<label class="file-button">Upload a chaser image<input id="chaser-image" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="muted">E on a friendly dummy cycles Wander → Follow → Guard. Red, blue and green factions fight opposing colors. Hostile dummies and billboard chasers pursue players. Chasers steer around obstacles and jump.</p>`)}${section('Make an animatronic.', `${button('record-puppet', 'Record five seconds')}${button('loop-puppet', 'Loop recorded movement')}${button('stop-puppet', 'Stop loops and release')}${button('save-puppet', 'Save puppet clip to garage')}<p class="muted">Aim at a ragdoll/contraption or box-select props first. Move it with the physics gun while recording. Loop playback drives kinematic poses, with up to eight simultaneous clips.</p>`)}</div>`;
    on('configure-npc', () => apply(lab, read(lab, root)));
    on('record-puppet', () => lab.puppets.record());
    on('loop-puppet', () => {
      lab.puppets.play();
      g.resume();
    });
    on('stop-puppet', () => lab.puppets.stop());
    on('save-puppet', async () => {
      if (!lab.puppets.data) throw new Error('Record a puppet first');
      await lab.garage.save('puppet', 'Puppet clip', lab.puppets.data, await lab.thumbnail());
      g.toast('Puppet clip saved');
    });
    root.querySelector('#chaser-image').onchange = (e) =>
      lab.assets.import([...e.target.files], 'nextbot').catch((error) => g.toast(error.message));
  } else if (tab === 'camera') {
    root.innerHTML = `<div class="workbench-grid">${section('Change the picture.', `<label>Camera filter<select id="camera-filter" aria-label="Camera filter">${FILTERS.map((id) => `<option value="${id}" ${id === lab.filters.kind ? 'selected' : ''}>${{ none: 'Clean', crt: 'CRT scanlines', vhs: 'VHS glitch', night: 'Night vision', pixel: 'Pixel art', comic: 'Comic outlines' }[id]}</option>`).join('')}</select></label>${button('lab-screenshot', 'Save filtered screenshot')}${button('lab-video', 'Start / stop filtered WebM')}${button('save-card', 'Save build as PNG card')}<p class="muted">Filters render into the canvas, so screenshots and video include them. PNG cards hold compressed build metadata and can be dropped back into Xmod.io.</p>`)}${section('Put a camera in the world.', `${button('spawn-cctv', 'Spawn CCTV camera')}${button('spawn-monitor', 'Spawn monitor')}${button('spawn-mirror', 'Spawn mirror')}${button('link-cctv', 'Equip camera link tool')}<p class="muted">Link one camera and one monitor with two clicks. The camera looks down its local −Z axis; rotate it with the physics gun. Two monitors update at about 7 FPS, and two mirrors use 256-pixel reflections.</p>`)}</div>`;
    root.querySelector('#camera-filter').onchange = (e) => lab.filters.set(e.target.value);
    on('lab-screenshot', () => g.recorder.screenshot());
    on('lab-video', () => g.recorder.video());
    on('save-card', async () =>
      downloadBlob(await saveCard(await lab.png(), currentBuild(g)), 'xmod-save-card.png'),
    );
    on('link-cctv', () => {
      g.toolMode = TOOL_IDS.indexOf('cameraLink');
      g.selectTool(1);
      g.resume();
    });
  } else if (tab === 'peers') renderPeers(lab, root, on);
  for (const b of root.querySelectorAll('[id^="spawn-"]'))
    b.onclick = () => {
      try {
        read(lab, root);
        lab.spawn(b.id.slice(6));
      } catch (error) {
        g.toast(error.message);
      }
    };
}
function renderGarage(lab, root, on) {
  const g = lab.game;
  root.innerHTML = `<div class="workbench-grid">${section('Your local garage.', `<label>Save name<input id="garage-name" aria-label="Garage save name" value="My creation" maxlength="80"></label><div class="button-row">${button('garage-save', 'Save build')}${button('garage-map', 'Save as custom map')}${button('garage-replay', 'Save replay')}</div><label class="file-button">Import files or assets<input id="asset-files" type="file" multiple accept=".json,.png,.glb,.gltf,.bin,.jpg,.jpeg,.webp,.mp3,.wav,.ogg"></label><p class="muted">Builds, map layouts, replays, ghosts and puppet clips stay in this browser’s IndexedDB. Every save includes a thumbnail. Drop PNG cards, models, textures or audio directly into the game. Drop glTF dependency files together.</p>${button('garage-refresh', 'Refresh garage')}`)}${section('Share a clickable build.', `${button('build-link', 'Create build link')}<textarea id="build-url" aria-label="Build link" rows="4" placeholder="Generate a link, then copy it"></textarea>${button('copy-build-link', 'Copy link')}${button('garage-card', 'Save PNG build card')}<p class="muted">Links contain compressed build data in the URL fragment. Larger builds use PNG cards or JSON files. Images must be sent as original files to retain build metadata. Imported media stays in the current session.</p>`)}</div><div id="garage-list" class="garage-list"></div>`;
  const save = async (kind) => {
    let data;
    if (kind === 'replay') {
      data = g.recorder.data;
      if (!data?.frames.length) throw new Error('Record a replay first');
    } else {
      data = currentBuild(g);
      if (kind === 'map') data.entities.forEach((e) => (e.frozen = true));
    }
    await lab.garage.save(
      kind,
      root.querySelector('#garage-name').value,
      data,
      await lab.thumbnail(),
    );
    g.toast('Saved in this browser');
    await list();
  };
  on('garage-save', () => save('build'));
  on('garage-map', () => save('map'));
  on('garage-replay', () => save('replay'));
  on('garage-refresh', () => list());
  on(
    'build-link',
    async () => (root.querySelector('#build-url').value = await buildURL(currentBuild(g))),
  );
  on('copy-build-link', async () => {
    const el = root.querySelector('#build-url');
    if (!el.value) el.value = await buildURL(currentBuild(g));
    try {
      await navigator.clipboard.writeText(el.value);
      g.toast('Build link copied');
    } catch {
      el.select();
      g.toast('Link selected · copy it');
    }
  });
  on('garage-card', async () =>
    downloadBlob(await saveCard(await lab.png(), currentBuild(g)), 'xmod-save-card.png'),
  );
  root.querySelector('#asset-files').onchange = (e) =>
    lab.assets.import([...e.target.files]).catch((error) => g.toast(error.message));
  async function list() {
    const items = await lab.garage.list(),
      container = root.querySelector('#garage-list');
    if (!container?.isConnected) return;
    for (const url of lab.thumbnailURLs) URL.revokeObjectURL(url);
    lab.thumbnailURLs = [];
    container.replaceChildren();
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'garage-card';
      if (item.thumbnail) {
        const img = document.createElement('img'),
          url = URL.createObjectURL(item.thumbnail);
        lab.thumbnailURLs.push(url);
        img.src = url;
        img.alt = 'Saved creation thumbnail';
        card.append(img);
      }
      const name = document.createElement('strong');
      name.textContent = item.name;
      const info = document.createElement('small');
      info.textContent = item.kind + ' · ' + new Date(item.created).toLocaleDateString();
      card.append(name, info);
      for (const [label, fn] of [
        [
          'Load',
          async () => {
            const saved = await lab.garage.get(item.id);
            if (!saved) throw new Error('This save was removed in another tab');
            if (item.kind === 'build' || item.kind === 'map') {
              if (item.kind === 'map') g.action({ kind: 'clear' });
              lab.loadBuild(saved.data);
            } else if (item.kind === 'replay') {
              await g.recorder.import(new File([JSON.stringify(saved.data)], 'replay.json'));
            } else if (item.kind === 'puppet') lab.puppets.play(saved.data, true);
            else if (item.kind === 'ghost') lab.loadedGhost = saved.data;
            g.toast('Garage item loaded');
          },
        ],
        [
          'Export',
          async () =>
            downloadJSON((await lab.garage.get(item.id)).data, 'xmod-' + item.kind + '.json'),
        ],
        [
          'Delete',
          async () => {
            await lab.garage.remove(item.id);
            await list();
          },
        ],
      ]) {
        const b = document.createElement('button');
        b.textContent = label;
        b.onclick = () => Promise.resolve(fn()).catch((e) => g.toast(e.message));
        card.append(b);
      }
      container.append(card);
    }
    if (!items.length)
      container.textContent = 'Your garage is empty. Save a build to keep it here.';
  }
  list().catch((e) => g.toast(e.message));
}
function renderPeers(lab, root, on) {
  root.innerHTML = `<div class="workbench-grid">${section('Direct browser connection.', `<label>Your name<input id="peer-name" aria-label="Peer name" value="Builder" maxlength="20"></label>${button('peer-offer', 'Host: create offer')}<label>Your outgoing code<textarea id="peer-out" aria-label="Outgoing peer code" rows="5" readonly></textarea></label>${button('peer-copy', 'Copy outgoing code')}<p id="peer-state" class="muted"></p>${button('peer-close', 'Disconnect')}`)}${section('Exchange codes once.', `<label>Paste their code<textarea id="peer-in" aria-label="Incoming peer code" rows="5"></textarea></label>${button('peer-answer', 'Guest: answer an offer')}${button('peer-finish', 'Host: accept the answer')}<p class="muted">Host sends an offer. Guest pastes it and sends the answer back. Host accepts the answer. The host browser runs physics and modes. This uses no signaling, STUN, TURN, database or paid host; both browsers need a reachable LAN/direct network route. Internet networks that block direct candidates will not connect.</p>`)}</div>`;
  const status = () => (root.querySelector('#peer-state').textContent = lab.peers.status);
  status();
  on('peer-offer', async () => {
    root.querySelector('#peer-out').value = await lab.peers.offer(
      root.querySelector('#peer-name').value,
    );
    status();
  });
  on('peer-answer', async () => {
    root.querySelector('#peer-out').value = await lab.peers.answer(
      root.querySelector('#peer-in').value.trim(),
      root.querySelector('#peer-name').value,
    );
    status();
  });
  on('peer-finish', async () => {
    await lab.peers.finish(root.querySelector('#peer-in').value.trim());
    status();
  });
  on('peer-copy', async () => {
    const el = root.querySelector('#peer-out');
    try {
      await navigator.clipboard.writeText(el.value);
    } catch {
      el.select();
    }
  });
  on('peer-close', () => {
    lab.peers.close();
    status();
  });
}
