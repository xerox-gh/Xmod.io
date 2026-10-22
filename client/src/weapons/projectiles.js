import * as T from 'three';
export class ProjectileView {
  constructor(game) {
    this.game = game;
    this.rockets = new Map();
    this.geometry = new T.ConeGeometry(0.12, 0.55, 5);
    this.material = new T.MeshBasicMaterial({ color: '#ffb570' });
  }
  event(e) {
    if (e.type === 'projectile') {
      const mesh = new T.Mesh(this.geometry, this.material);
      mesh.position.fromArray(e.p);
      const velocity = new T.Vector3(...e.v);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), velocity.clone().normalize());
      this.game.view.scene.add(mesh);
      this.rockets.set(e.id, { mesh, velocity });
    }
    if (e.type === 'projectileRemove') {
      const r = this.rockets.get(e.id);
      if (r) {
        this.game.view.scene.remove(r.mesh);
        this.rockets.delete(e.id);
      }
    }
  }
  update(dt) {
    for (const [id, r] of this.rockets) {
      const authority = this.game.sim.projectiles.get(id);
      if (authority) r.mesh.position.copy(authority.p);
      else {
        r.mesh.position.addScaledVector(r.velocity, dt);
        r.velocity.y -= 2 * dt;
      }
    }
  }
}
