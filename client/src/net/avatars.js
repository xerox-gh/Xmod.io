import * as T from 'three';
import { Track } from './interpolation.js';
export class Avatars {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
  }
  add(id, name) {
    const root = new T.Group(),
      bodyMat = new T.MeshStandardMaterial({ color: '#8fc9c5', flatShading: true }),
      skin = new T.MeshStandardMaterial({ color: '#edc28f', flatShading: true });
    const body = new T.Mesh(new T.BoxGeometry(0.65, 0.8, 0.35), bodyMat);
    root.add(body);
    const head = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), skin);
    head.position.y = 0.65;
    root.add(head);
    for (const x of [-0.22, 0.22]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.2, 0.65, 0.25), bodyMat);
      leg.position.set(x, -0.65, 0);
      root.add(leg);
    }
    for (const x of [-0.45, 0.45]) {
      const arm = new T.Mesh(new T.BoxGeometry(0.18, 0.7, 0.23), skin);
      arm.position.set(x, 0, 0);
      root.add(arm);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b3434dd';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#e2fac4';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 42, 240);
    const texture = new T.CanvasTexture(canvas),
      tag = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false }));
    tag.position.y = 1.35;
    tag.scale.set(2, 0.5, 1);
    root.add(tag);
    this.scene.add(root);
    const record = { root, track: new Track(), name };
    this.players.set(id, record);
    return record;
  }
  snapshot(players, localId) {
    const ids = new Set();
    for (const p of players) {
      if (p.id === localId) continue;
      ids.add(p.id);
      const record = this.players.get(p.id) || this.add(p.id, p.name);
      record.track.push(p);
      record.root.visible = !p.vehicle;
    }
    for (const id of this.players.keys()) if (!ids.has(id)) this.remove(id);
  }
  update() {
    for (const p of this.players.values()) {
      const state = p.track.sample();
      if (state) {
        p.root.position.copy(state.p);
        p.root.rotation.y = state.yaw;
      }
    }
  }
  remove(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.scene.remove(p.root);
    const materials = new Set();
    p.root.traverse((c) => {
      if (c.isMesh) c.geometry.dispose();
      if (c.material) materials.add(c.material);
    });
    for (const m of materials) {
      m.map?.dispose();
      m.dispose();
    }
    this.players.delete(id);
  }
  clear() {
    for (const id of this.players.keys()) this.remove(id);
  }
}
