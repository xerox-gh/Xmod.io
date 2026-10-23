import * as T from 'three';
import { createPlayer } from '../../../shared/movement.js';
import { stepBehaviors } from '../../../shared/behaviors.js';
import { Workbench } from '../ui/workbench.js';
import { Selection } from '../tools/selection.js';
import { CameraRig } from '../player/camera-rig.js';
import { Recorder } from './recorder.js';
import { Weather } from './weather.js';
import { Quality } from './quality.js';
import { createRenderer } from './renderer.js';
import { loadSettings } from './settings.js';
import { Input } from './input.js';
import { runLoop } from './loop.js';
import { Simulation } from '../../../shared/simulation.js';
import { PlayerController } from '../player/controller.js';
import { PropRegistry } from '../props/registry.js';
import { loadMap } from '../maps/index.js';
import { Spawner } from '../tools/spawner.js';
import { SpawnMenu } from '../ui/spawn-menu.js';
import { Menus } from '../ui/menus.js';
import { HUD } from '../ui/hud.js';
import { WEAPONS } from '../../../shared/weapons.js';
import { HOTBAR } from '../../../shared/constants.js';
import { Tools } from '../tools/index.js';
import { executeAction } from '../../../shared/actions.js';
import { updateGrabs } from '../../../shared/grabbing.js';
import { stepAttachments } from '../../../shared/constraints.js';
import { ConstraintView } from '../physics/constraints.js';
import { Weapons } from '../weapons/index.js';
import { ProjectileView } from '../weapons/projectiles.js';
import { VehicleView } from '../vehicles/car.js';
import { stepCars } from '../../../shared/vehicles.js';
import { Effects } from './effects.js';
import { GameConsole } from '../ui/console.js';
import { NetworkClient } from '../net/client.js';
import { Chat } from '../ui/chat.js';
import { openMultiplayer } from '../ui/multiplayer.js';
export class Game {
  constructor() {
    this.settings = loadSettings();
    this.canvas = document.querySelector('#game');
    this.root = document.querySelector('#ui');
    this.view = createRenderer(this.canvas, this.settings);
    this.sim = new Simulation();
    this.map = loadMap('flatgrass', this.view.scene);
    this.slot = 0;
    this.toolMode = 0;
    this.overlay = 'menu';
    this.started = false;
    this.night = false;
    this.owner = 'local';
    this.input = new Input(
      this.canvas,
      () => {
        if (this.overlay === null) {
          this.overlay = 'pause';
          this.menus?.show();
        }
        this.onUnlock?.();
      },
      () => {
        this.overlay = null;
        this.menus?.hide();
      },
    );
    this.player = new PlayerController(this.sim.world, this.view.camera, this.input, this.settings);
    this.props = new PropRegistry(this.view.scene, this.sim);
    this.sim.onEvent = (event) => this.onSimEvent(event);
    this.spawner = new Spawner(this);
    this.menus = new Menus(this, this.root);
    this.spawnMenu = new SpawnMenu(this, this.root);
    this.hud = new HUD(this, this.root);
    this.actor = { id: this.owner, state: this.player.state, admin: true };
    this.actors = new Map([[this.owner, this.actor]]);
    this.tools = new Tools(this);
    this.onUnlock = () => this.tools.deactivate();
    this.constraintView = new ConstraintView(this);
    this.weapons = new Weapons(this);
    this.projectiles = new ProjectileView(this);
    this.vehicles = new VehicleView(this);
    this.effects = new Effects(this);
    this.console = new GameConsole(this, this.root);
    this.net = new NetworkClient(this);
    this.chat = new Chat(this, this.root);
    this.openMultiplayer = (panel) => openMultiplayer(this, panel);
    this.workbench = new Workbench(this);
    this.selection = new Selection(this);
    this.cameraRig = new CameraRig(this);
    this.recorder = new Recorder(this);
    this.weather = new Weather(this);
    this.quality = new Quality(this);
    this.weaponChoice = 'pistol';
    this.vehicleChoice = 'car';
    this.sky = 'day';
    // A live diorama becomes an immediate physics playground after Play.
    for (const [type, p] of [
      ['crate', [-5, 1, -4]],
      ['crate', [-5, 2.8, -4]],
      ['barrel', [5, 1, -5]],
      ['ball', [3, 1, -1]],
      ['plank', [-4, 0.8, 0]],
      ['sofa', [8, 1, -9]],
    ])
      this.sim.spawn(type, p, 'world');
  }
  get toolId() {
    return this.slot === 4 ? this.weaponChoice || 'pistol' : HOTBAR[this.slot].id;
  }
  direction() {
    return this.view.camera.getWorldDirection(new T.Vector3());
  }
  toast(text) {
    const el = this.root.querySelector('#toast');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
  }
  resume() {
    this.started = true;
    this.overlay = null;
    this.menus.hide();
    this.spawnMenu.el.hidden = true;
    this.console.el.hidden = true;
    if (this.selection) this.selection.el.hidden = true;
    this.effects.audio.unlock().catch(() => {});
    this.input.clear();
    Promise.resolve(this.input.lock()).catch(() => {
      this.overlay = 'pause';
      this.menus.show();
      this.toast('Click Enter playground to capture your mouse.');
    });
  }
  selectTool(slot) {
    this.tools?.deactivate();
    this.slot = (slot + HOTBAR.length) % HOTBAR.length;
  }
  resetMap() {
    this.map.dispose();
    this.map = loadMap(this.sim.world.map.id, this.view.scene);
    this.player.world = this.sim.world;
    this.player.state = createPlayer(this.sim.world, this.owner);
    this.player.yaw = 0;
    this.player.pitch = -0.08;
    this.player.packet = { yaw: 0, pitch: 0 };
    this.actor.state = this.player.state;
    this.actor.loadout = {};
    this.weapons?.states.clear();
    this.selection?.ids.clear();
    this.recorder?.stopPlayback();
    if (this.recorder) this.recorder.recording = false;
    this.vehicleId = null;
    const name = this.sim.world.map.name;
    this.menus.el.querySelector('.map-caption h2').textContent = name;
    this.menus.el.querySelector('.map-caption>span').textContent = 'YOUR NEXT PLAYGROUND';
    if (this.sim.world.map.id === 'void') {
      this.sky = 'void';
      this.view.setSky('void');
    } else if (this.sky === 'void') {
      this.sky = 'day';
      this.view.setSky('day');
    }
  }
  onSimEvent(event) {
    if (event.type === 'map') this.resetMap();
    if (this.sim.remote && event.type === 'constraint')
      this.sim.constraints.set(event.constraint.id, { ...event.constraint, joint: null });
    if (this.sim.remote && event.type === 'unconstraint') this.sim.constraints.delete(event.id);
    if (this.sim.remote && event.type === 'motor')
      Object.assign(this.sim.constraints.get(event.id) || {}, {
        speed: event.speed,
        bind: event.bind,
      });
    this.props.event(event);
    this.effects?.event(event);
    this.constraintView?.event(event);
    this.projectiles?.event(event);
  }
  action(action) {
    try {
      if (this.net?.connected) return this.net.action(action);
      return executeAction(this.sim, this.actor, action);
    } catch (error) {
      this.toast(error.message);
      this.console?.print(error.message);
      console.warn('Sandbox action failed:', error);
      return false;
    }
  }
  frame(dt, time) {
    const input = this.input;
    if (input.pressed('F3')) this.quality.toggle();
    if (input.locked && (input.pressed('Backquote') || input.pressed('Enter'))) this.console.open();
    if (input.locked && input.pressed('KeyT')) this.chat.open();
    if (input.locked && input.pressed('KeyB')) this.workbench.open();
    if (input.locked && !this.recorder.playing) {
      if (input.pressed('KeyG')) this.selection.open();
      if (input.pressed('KeyH'))
        this.action({ kind: 'time', value: this.sim.timeScale === 0.25 ? 1 : 0.25 });
      if (input.pressed('KeyP'))
        this.action({ kind: 'time', value: this.sim.timeScale === 0 ? 1 : 0 });
      if (input.pressed('F5')) this.cameraRig.cycle();
      if (input.pressed('F2')) this.recorder.screenshot();
      if (input.pressed('KeyQ')) this.spawnMenu.open();
      if (input.pressed('KeyV')) this.action({ kind: 'noclip' });
      if (input.pressed('KeyE') && !this.tools.physgun.held) this.vehicles.interact();
      if (input.pressed('KeyZ')) this.action({ kind: 'undo' });
      if (input.pressed('KeyN')) {
        this.night = !this.night;
        this.view.setNight(this.night);
      }
      for (let i = 0; i < 9; i++) if (input.pressed(`Digit${i + 1}`)) this.selectTool(i);
      this.tools?.update(dt);
      this.player.aimScale = this.weapons.aiming
        ? Math.min(1, WEAPONS[this.toolId].aimFov / this.settings.fov)
        : 1;
      this.player.sample();
    }
    if (!input.locked) {
      input.clear();
      this.player.packet = { yaw: this.player.yaw, pitch: this.player.pitch };
    }
    this.player.zoomFov = this.weapons.aiming ? WEAPONS[this.toolId].aimFov : null;
    this.player.updateCamera(dt);
    if (!this.started) {
      this.view.camera.position.set(18, 14, 26);
      this.view.camera.lookAt(-3, 0, -8);
    }
    this.spawner.update();
    this.props.update(this.view.camera);
    this.selection.update();
    this.constraintView.update();
    this.vehicles.update();
    if (this.started) this.cameraRig.update(dt);
    this.tools.viewmodel.update(dt);
    this.projectiles.update(dt);
    this.map.update(time);
    this.hud.update(dt);
    this.effects?.update(dt);
    this.weapons?.update(dt * this.sim.timeScale);
    this.weather.update(dt);
    this.quality.update(dt);
    this.net?.update(dt);
    this.recorder.update(dt);
    this.props.proxy.visible = !this.recorder.playing;
    if (this.recorder.playing) {
      this.tools.viewmodel.root.visible = false;
      this.cameraRig.avatar.visible = false;
    }
    for (const { line } of this.constraintView.lines.values())
      if (this.recorder.playing) line.visible = false;
    for (const { mesh } of this.projectiles.rockets.values()) mesh.visible = !this.recorder.playing;
    this.view.renderer.render(this.view.scene, this.view.camera);
  }
  fixed(dt) {
    dt *= this.sim.timeScale;
    this.actor.input = {
      ...(this.player.packet || {}),
      activate: this.input.locked && this.input.down('KeyF'),
    };
    if (this.cameraRig?.mode === 'free') {
      Object.assign(this.actor.input, { forward: 0, right: 0, jump: false, crouch: false });
    }
    if (!dt) return;
    if (!this.player.state.vehicleId && this.cameraRig?.mode !== 'free') this.player.step(dt);
    if (!this.sim.remote) {
      updateGrabs(this.sim, this.actors, dt);
      stepBehaviors(this.sim, this.actors, dt);
      stepAttachments(this.sim, this.actors);
      stepCars(this.sim, this.actors);
    }
    this.sim.step(dt);
  }
  start() {
    runLoop(
      (dt, time) => this.frame(dt, time),
      (dt) => this.fixed(dt),
    );
  }
}
