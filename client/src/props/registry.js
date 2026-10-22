import * as T from 'three';
import { makePropMesh, disposeProp } from './meshes.js';
export class PropRegistry {
  constructor(scene, sim) {
    this.scene = scene;
    this.sim = sim;
    this.meshes = new Map();
    this.raycaster = new T.Raycaster();
  }
  event(event) {
    if (event.type === 'spawn') this.add(event.entity);
    if (event.type === 'remove') this.remove(event.id);
    if (event.type === 'change') {
      const mesh = this.meshes.get(event.entity.id);
      if (mesh) {
        mesh.scale.setScalar(event.entity.scale);
        mesh.traverse((c) => {
          if (c.userData.paint) c.material.color.set(event.entity.color);
        });
      }
    }
  }
  add(e) {
    if (this.meshes.has(e.id)) this.remove(e.id);
    const mesh = makePropMesh(e.type, e.color);
    mesh.userData.id = e.id;
    mesh.scale.setScalar(e.scale);
    mesh.position.fromArray(e.p);
    mesh.quaternion.fromArray(e.q);
    mesh.traverse((m) => {
      if (m.isMesh) m.castShadow = this.meshes.size < 64;
    });
    this.meshes.set(e.id, mesh);
    this.scene.add(mesh);
  }
  remove(id) {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    this.scene.remove(mesh);
    disposeProp(mesh);
    this.meshes.delete(id);
  }
  update() {
    for (const [id, mesh] of this.meshes) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      mesh.position.copy(e.body.position);
      mesh.quaternion.copy(e.body.quaternion);
    }
  }
  aim(camera, max = 30) {
    this.raycaster.setFromCamera(new T.Vector2(0, 0), camera);
    this.raycaster.far = max;
    const hit = this.raycaster.intersectObjects([...this.meshes.values()], true)[0];
    if (!hit) return null;
    let root = hit.object;
    while (!root.userData.id && root.parent) root = root.parent;
    return {
      id: root.userData.id,
      point: hit.point,
      normal: hit.face?.normal
        .clone()
        .applyQuaternion(hit.object.getWorldQuaternion(new T.Quaternion()))
        .normalize(),
    };
  }
}
