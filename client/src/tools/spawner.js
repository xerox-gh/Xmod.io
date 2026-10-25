import { makePropMesh, disposeProp } from '../props/meshes.js';
import * as C from 'cannon-es';
export class Spawner {
  constructor(game) {
    this.game = game;
    this.selected = 'crate';
    this.angle = 0;
    this.preview = null;
  }
  position() {
    const g = this.game,
      p = g.player.camera.position.clone().addScaledVector(g.direction(), 6);
    p.y = Math.max(1.4, p.y);
    return p.toArray();
  }
  spawn(type = this.selected) {
    this.game.action({ kind: 'spawn', prop: type, p: this.positionFor(type), yaw: this.angle });
    this.game.spawnMenu?.recent(type);
  }
  positionFor(type) {
    const p = this.position();
    if (type === 'telepad') {
      const hit = new C.RaycastResult();
      this.game.sim.world.raycastClosest(
        new C.Vec3(p[0], p[1] + 8, p[2]),
        new C.Vec3(p[0], p[1] - 16, p[2]),
        { collisionFilterMask: 1 },
        hit,
      );
      if (hit.hasHit) p[1] = hit.hitPointWorld.y + 0.13;
    }
    return p;
  }
  click(button) {
    if (button === 0) this.spawn();
    else this.angle += Math.PI / 4;
  }
  update() {
    const visible = this.game.toolId === 'spawner' && this.game.input.locked;
    if (this.preview?.userData.type !== this.selected) {
      if (this.preview) {
        this.game.view.scene.remove(this.preview);
        disposeProp(this.preview);
      }
      this.preview = makePropMesh(this.selected);
      this.preview.userData.type = this.selected;
      this.preview.traverse((m) => {
        if (m.isLight) m.visible = false;
        if (m.isMesh) {
          m.material.transparent = true;
          m.material.opacity = 0.3;
          m.material.depthWrite = false;
          m.castShadow = false;
        }
      });
      this.game.view.scene.add(this.preview);
    }
    this.preview.visible = visible;
    if (visible) {
      this.preview.position.fromArray(this.position());
      this.preview.rotation.y = this.angle;
    }
  }
}
