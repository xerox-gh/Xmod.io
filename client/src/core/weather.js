import * as T from 'three';
export class Weather {
  constructor(game) {
    this.game = game;
    this.kind = 'clear';
    this.particles = new T.InstancedMesh(
      new T.BoxGeometry(0.035, 0.65, 0.035),
      new T.MeshBasicMaterial({ color: '#b8e6f0', transparent: true, opacity: 0.65 }),
      400,
    );
    this.particles.frustumCulled = false;
    this.particles.visible = false;
    this.particles.instanceMatrix.setUsage(T.DynamicDrawUsage);
    game.view.scene.add(this.particles);
    this.positions = Array.from(
      { length: 400 },
      () =>
        new T.Vector3((Math.random() - 0.5) * 60, Math.random() * 30, (Math.random() - 0.5) * 60),
    );
    this.dummy = new T.Object3D();
  }
  set(kind) {
    if (!['clear', 'rain', 'snow'].includes(kind)) return;
    this.kind = kind;
    this.particles.visible = kind !== 'clear';
    this.particles.material.color.set(kind === 'snow' ? '#ffffff' : '#b8e6f0');
  }
  update(dt) {
    if (this.kind === 'clear') return;
    const center = this.game.view.camera.position;
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      p.y -= dt * (this.kind === 'rain' ? 24 : 3);
      p.x += dt * (this.kind === 'rain' ? 2 : 0.5);
      p.x += dt * this.game.sim.lab.environment.windX * 0.3;
      p.z += dt * this.game.sim.lab.environment.windZ * 0.3;
      if (p.y < 0) {
        p.y = 30;
        p.x = (Math.random() - 0.5) * 60;
        p.z = (Math.random() - 0.5) * 60;
      }
      this.dummy.position.set(center.x + p.x, center.y + p.y - 10, center.z + p.z);
      this.dummy.scale.set(
        this.kind === 'snow' ? 2 : 1,
        this.kind === 'snow' ? 0.1 : 1,
        this.kind === 'snow' ? 2 : 1,
      );
      this.dummy.updateMatrix();
      this.particles.setMatrixAt(i, this.dummy.matrix);
    }
    this.particles.instanceMatrix.needsUpdate = true;
  }
}
