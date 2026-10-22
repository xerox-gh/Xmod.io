// Conservative initial hardware detection, followed by a single sustained-FPS downgrade.
export class Quality {
  constructor(game) {
    this.game = game;
    this.mode = game.settings.quality || 'auto';
    this.level =
      (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4
        ? 'low'
        : 'medium';
    this.clock = 0;
    this.frames = 0;
    this.fps = 60;
    this.debug = false;
    this.elapsed = 0;
    this.apply(this.mode);
    this.el = document.createElement('pre');
    this.el.className = 'debug-overlay';
    this.el.hidden = true;
    game.root.append(this.el);
  }
  apply(mode) {
    if (!['auto', 'low', 'medium', 'high'].includes(mode)) return;
    this.mode = mode;
    if (mode !== 'auto') this.level = mode;
    this.game.settings.quality = mode;
    const g = this.game,
      levels = { low: [1, false], medium: [1.5, true], high: [2, true] },
      [ratio, shadows] = levels[this.level];
    g.view.renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
    g.view.renderer.shadowMap.enabled = shadows && g.settings.shadows;
  }
  update(dt) {
    this.clock += dt;
    this.elapsed += dt;
    this.frames++;
    if (this.clock < 1) return;
    this.fps = Math.round(this.frames / this.clock);
    this.clock = this.frames = 0;
    if (
      this.mode === 'auto' &&
      this.elapsed > 8 &&
      this.elapsed < 12 &&
      this.fps < 42 &&
      this.level !== 'low'
    ) {
      this.level = 'low';
      this.apply('auto');
      this.game.toast('Quality adjusted for smoother play');
    }
    this.el.hidden = !this.debug;
    if (this.debug) {
      const g = this.game,
        bodies = [...g.sim.entities.values()],
        sleep = bodies.filter((e) => e.body.sleepState === 2).length;
      this.el.textContent = `${this.fps} FPS · ${this.mode} / ${this.level}\n${bodies.length}/200 bodies · ${bodies.length - sleep} awake · ${sleep} sleeping\n${g.sim.constraints.size} constraints · ${g.sim.world.contacts.length} contacts\nPhysics ${g.sim.physicsMs.toFixed(2)} ms · ${g.view.renderer.info.render.calls} draw calls\nMap ${g.sim.world.map.id} · time ×${g.sim.timeScale}\n${g.net.connected ? 'Server physics · ' + g.net.latency + ' ms' : 'Local physics'} · F3 close`;
    }
  }
  toggle() {
    this.debug = !this.debug;
    this.el.hidden = !this.debug;
    this.clock = 1;
  }
}
