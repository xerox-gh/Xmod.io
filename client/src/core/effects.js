import * as T from 'three';
import { AudioSynth } from '../audio/synth.js';
// A fixed pool keeps explosions from allocating unbounded objects or draw calls.
export class Effects {
  constructor(game) {
    this.game = game;
    this.audio = new AudioSynth(game.settings);
    this.pool = [];
    this.cursor = 0;
    this.tracers = [];
    this.particles = new T.InstancedMesh(
      new T.BoxGeometry(0.11, 0.11, 0.11),
      new T.MeshBasicMaterial({ color: '#ffffff' }),
      256,
    );
    this.particles.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.particles.frustumCulled = false;
    game.view.scene.add(this.particles);
    this.dummy = new T.Object3D();
    for (let i = 0; i < 256; i++) {
      this.pool.push({ p: new T.Vector3(), v: new T.Vector3(), life: 0 });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.particles.setMatrixAt(i, this.dummy.matrix);
    }
    this.flash = new T.PointLight('#ffeeb8', 0, 5);
    game.view.camera.add(this.flash);
    this.flash.position.set(0.3, -0.2, -1);
    this.flashTimer = 0;
  }
  burst(position, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const index = this.cursor++ % 256,
        p = this.pool[index];
      p.p.copy(position);
      p.v.set((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7);
      p.life = 0.3 + Math.random() * 0.7;
      p.initial = p.life;
      this.particles.setColorAt(index, new T.Color(color));
    }
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }
  muzzle(color) {
    this.flash.color.set(color);
    this.flash.intensity = 8;
    this.flashTimer = 0.055;
    this.burst(
      this.game.view.camera.position.clone().addScaledVector(this.game.direction(), 1),
      color,
      3,
    );
  }
  event(e) {
    this.audio.event(e);
    if (e.type === 'spawn') {
      this.burst(new T.Vector3(...e.entity.p), '#d7fa94', 10);
    }
    if (e.type === 'flame') this.burst(new T.Vector3(...e.p), '#ff983e', 12);
    if (e.type === 'targetHit') this.burst(new T.Vector3(...e.p), '#d7fa94', 14);
    if (e.type === 'bounce') this.burst(new T.Vector3(...e.p), '#9ce4e3', 8);
    if (e.type === 'explosion') this.burst(new T.Vector3(...e.p), '#f5b468', 60);
    if (e.type === 'tracer') {
      if (this.tracers.length >= 40) this.removeTracer(this.tracers.shift());
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([new T.Vector3(...e.from), new T.Vector3(...e.to)]),
        new T.LineBasicMaterial({ color: '#fff5bd', transparent: true, opacity: 0.7 }),
      );
      this.game.view.scene.add(line);
      this.tracers.push({ line, life: 0.07 });
      if (e.hit) this.burst(new T.Vector3(...e.to), '#e9e5bd', 3);
    }
  }
  removeTracer(t) {
    this.game.view.scene.remove(t.line);
    t.line.geometry.dispose();
    t.line.material.dispose();
  }
  update(dt) {
    const camera = this.game.view.camera;
    this.audio.listener(
      camera.position.toArray(),
      camera.getWorldDirection(new T.Vector3()).toArray(),
      new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).toArray(),
    );
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life > 0) {
        const wind = this.game.sim.lab.environment;
        p.v.x += wind.windX * dt * 0.3;
        p.v.z += wind.windZ * dt * 0.3;
        p.v.y -= 9 * dt;
        p.p.addScaledVector(p.v, dt);
        this.dummy.position.copy(p.p);
        this.dummy.scale.setScalar(Math.min(1, p.life * 4));
        this.dummy.rotation.set(p.life * 4, p.life * 3, 0);
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.particles.setMatrixAt(i, this.dummy.matrix);
    }
    this.particles.instanceMatrix.needsUpdate = true;
    this.flashTimer -= dt;
    if (this.flashTimer <= 0) this.flash.intensity = 0;
    for (const t of [...this.tracers]) {
      t.life -= dt;
      if (t.life <= 0) {
        this.removeTracer(t);
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }
  }
}
