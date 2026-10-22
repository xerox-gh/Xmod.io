import * as T from 'three';
import { PROPS } from '../../../shared/props.js';
import { makePropMesh, disposeProp } from './meshes.js';
export class PropRegistry {
  constructor(scene, sim) {
    this.scene = scene;
    this.sim = sim;
    this.meshes = new Map();
    this.raycaster = new T.Raycaster();
    this.proxy = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      200,
    );
    this.proxy.count = 0;
    this.proxy.frustumCulled = false;
    this.proxy.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.proxy);
    this.dummy = new T.Object3D();
    this.color = new T.Color();
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
  update(camera) {
    let far = 0,
      lights = 0;
    for (const [id, mesh] of this.meshes) {
      const e = this.sim.entities.get(id);
      if (!e) continue;
      mesh.position.copy(e.body.position);
      mesh.quaternion.copy(e.body.quaternion);
      const distance = camera ? camera.position.distanceToSquared(mesh.position) : 0,
        distant = distance > 4900 && (e.frozen || e.body.sleepState === 2);
      mesh.visible = !distant;
      mesh.traverse((child) => {
        if (child.userData.lamp) {
          child.color.set(e.color);
          child.visible = !!e.behavior.lit && distance < 1225 && lights < 8;
          if (child.visible) lights++;
        }
        if (child.userData.paint && ['lamp', 'neon'].includes(e.type)) {
          child.material.emissive.set(e.color);
          child.material.emissiveIntensity = e.behavior.lit ? (e.type === 'neon' ? 2 : 0.5) : 0;
        }
        if (child.userData.paint && e.type === 'button')
          child.material.color.set(e.behavior.pressed ? '#d7fa94' : e.color);
      });
      if (distant) {
        const d = PROPS[e.type],
          s = d.size.map((n) => n * e.scale);
        if (d.shape === 'sphere') s.splice(0, s.length, ...Array(3).fill(s[0] * 2));
        else if (['cylinder', 'pipe', 'cone'].includes(d.shape)) {
          s[0] *= 2;
          s[2] *= 2;
        }
        this.dummy.position.copy(e.body.position);
        this.dummy.quaternion.copy(e.body.quaternion);
        this.dummy.scale.set(...s);
        this.dummy.updateMatrix();
        this.proxy.setMatrixAt(far, this.dummy.matrix);
        this.proxy.setColorAt(far, this.color.set(e.color));
        far++;
      }
    }
    this.proxy.count = far;
    this.proxy.instanceMatrix.needsUpdate = true;
    if (this.proxy.instanceColor) this.proxy.instanceColor.needsUpdate = true;
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
