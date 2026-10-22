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
      const mesh = new T.Mesh(
        e.kind === 'grenade' ? new T.IcosahedronGeometry(0.18, 0) : this.geometry,
        this.material,
      );
      mesh.userData.grenade = e.kind === 'grenade';
      mesh.position.fromArray(e.p);
      const velocity = new T.Vector3(...e.v);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), velocity.clone().normalize());
      this.game.view.scene.add(mesh);
      this.rockets.set(e.id, { mesh, velocity });
    }
    if (e.type === 'projectileBounce') {
      const r = this.rockets.get(e.id);
      if (r) {
        r.mesh.position.fromArray(e.p);
        r.velocity.fromArray(e.v);
      }
    }
    if (e.type === 'projectileRemove') {
      const r = this.rockets.get(e.id);
      if (r) {
        this.game.view.scene.remove(r.mesh);
        if (r.mesh.userData.grenade) r.mesh.geometry.dispose();
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
        r.velocity.y -= (r.mesh.userData.grenade ? 20 : 2) * dt;
      }
    }
  }
}
