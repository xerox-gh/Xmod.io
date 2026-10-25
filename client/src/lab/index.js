import * as T from 'three';
import { LAB_DEFAULTS } from '../../../shared/lab/definitions.js';
import { validateBuild } from '../../../shared/builds.js';
import { openLab } from './panel.js';
import { Garage } from './garage.js';
import { LocalAssets } from './assets.js';
import { Puppets } from './puppets.js';
import { PeerLink } from './peers.js';
import { CameraFilters } from './filters.js';
import { LabVisuals } from './visuals.js';
import { ModeView } from './mode-view.js';
import { unpackBuild } from './codec.js';
export class Toybox {
  constructor(game) {
    this.game = game;
    this.settings = { ...LAB_DEFAULTS, axis: 'y', lift: 2 };
    this.target = null;
    this.thumbnailURLs = [];
    this.garage = new Garage();
    this.assets = new LocalAssets(this);
    this.puppets = new Puppets(this);
    this.peers = new PeerLink(this);
    this.filters = new CameraFilters(game);
    this.visuals = new LabVisuals(game);
    this.modeView = new ModeView(this);
    game.sim.lab.actors = game.actors;
    queueMicrotask(() => this.loadHash().catch((e) => game.toast(e.message)));
  }
  open(tab) {
    openLab(this, tab);
  }
  spawn(type) {
    this.ensurePlayground();
    const g = this.game,
      e = g.action({
        kind: 'spawn',
        prop: type,
        p: g.spawner.positionFor(type),
        yaw: g.spawner.angle,
      });
    g.spawnMenu.recent(type);
    if (!e) return;
    this.target = e.id;
    const label = g.menus.panel.querySelector('.lab-target');
    if (label) label.textContent = `Selected prop: ${e.type} · ${e.id}`;
    const keys =
      type === 'npc'
        ? ['faction', 'command', 'npcWeapon', 'speed']
        : type === 'gravity_zone'
          ? ['gx', 'gy', 'gz', 'zoneSize']
          : type === 'hoverball'
            ? ['height', 'bind', 'downBind']
            : type === 'wing'
              ? ['lift']
              : type === 'nextbot'
                ? ['speed']
                : ['range', 'period', 'text', 'display', 'frequency', 'waveform', 'turret'];
    g.action({
      kind: 'labConfig',
      id: e.id,
      settings: Object.fromEntries(keys.map((k) => [k, this.settings[k]])),
    });
    g.toast(type.replaceAll('_', ' ') + ' spawned');
    return e;
  }
  loadBuild(raw) {
    const build = validateBuild(raw),
      g = this.game;
    if (build.map !== g.sim.world.map.id) {
      if (g.action({ kind: 'map', map: build.map }) === false) return;
    }
    const result = g.action({ kind: 'loadBuild', build });
    if (build.environment && g.actor.admin) g.action({ kind: 'environment', ...build.environment });
    return result;
  }
  ensurePlayground() {
    const g = this.game;
    if (!g.started) {
      g.started = true;
      g.player.updateCamera(0);
      g.view.camera.updateMatrixWorld(true);
    }
  }
  async loadHash() {
    const code =
      new URLSearchParams(location.hash.slice(1)).get('build') ||
      new URLSearchParams(location.search).get('build');
    if (!code) return;
    this.loadBuild(await unpackBuild(code));
    this.game.toast('Shared contraption loaded from link');
  }
  async png() {
    this.game.render();
    return new Promise((resolve, reject) =>
      this.game.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Screenshot could not be created'))),
        'image/png',
      ),
    );
  }
  async thumbnail() {
    this.game.render();
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 135;
    canvas.getContext('2d').drawImage(this.game.canvas, 0, 0, 240, 135);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.7));
  }
  event(e) {
    this.visuals.event(e);
    this.peers.event(e);
    if (e.type === 'map') {
      this.puppets.loops = [];
      this.target = null;
    }
    if (e.type === 'gadgetHint' && e.owner === this.game.owner) this.game.toast(e.text);
  }
  snapshot(data) {
    if (!data) return;
    this.remoteMode = data.mode;
    this.game.sim.lab.values = new Map(data.signals || []);
    if (data.environment) this.game.sim.lab.environment = data.environment;
  }
  fixed(dt) {
    this.peers.fixed(dt);
    this.puppets.fixed(dt);
  }
  update(dt) {
    this.assets.update();
    this.puppets.update(dt);
    this.visuals.update(dt);
    this.peers.update(dt);
    this.modeView.update();
    const g = this.game,
      remote = g.sim.entities.get(g.actor.rc);
    if (remote) {
      if (this.rcLast !== remote.id) {
        this.rcLast = remote.id;
        this.rcYaw = g.player.yaw;
      }
      g.view.camera.position.copy(remote.body.position).add(new T.Vector3(0, 1.7, 0));
      g.view.camera.quaternion
        .copy(remote.body.quaternion)
        .multiply(
          new T.Quaternion().setFromEuler(
            new T.Euler(g.player.pitch, g.player.yaw - this.rcYaw, 0, 'YXZ'),
          ),
        );
      g.tools.viewmodel.root.visible = false;
    } else this.rcLast = null;
    const status = g.menus.panel.querySelector('#peer-state');
    if (status) status.textContent = this.peers.status;
  }
}
