import * as T from 'three';
import { FLATGRASS } from '../../../shared/maps.js';
const mat = (color) => new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#a8c88a';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#93b675';
  x.lineWidth = 1.4;
  x.strokeRect(0, 0, 128, 128);
  x.fillStyle = '#9ec080';
  x.fillRect(63, 63, 2, 2);
  const texture = new T.CanvasTexture(c);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
function label(scene, text, position, width = 7) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#263f3c';
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#d5f689';
  x.font = 'bold 48px monospace';
  x.textAlign = 'center';
  x.fillText(text, 256, 82);
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, width / 4),
    new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.DoubleSide }),
  );
  mesh.position.set(...position);
  scene.add(mesh);
}
export function buildFlatgrass(scene) {
  for (const box of FLATGRASS.boxes) {
    const material = mat(box.color);
    if (box.ground) {
      const texture = gridTexture();
      texture.repeat.set(box.s[0] / 4, box.s[2] / 4);
      material.map = texture;
    }
    const mesh = new T.Mesh(new T.BoxGeometry(...box.s), material);
    mesh.position.set(...box.p);
    mesh.rotation.x = box.rx || 0;
    mesh.receiveShadow = true;
    mesh.castShadow = !box.ground;
    scene.add(mesh);
  }
  const water = new T.Mesh(
    new T.PlaneGeometry(...FLATGRASS.water.s),
    new T.MeshStandardMaterial({
      color: '#54bcc6',
      roughness: 0.2,
      transparent: true,
      opacity: 0.78,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(...FLATGRASS.water.p);
  scene.add(water);
  // Static scenery uses one instanced draw call for the distant polygon islands.
  const geo = new T.ConeGeometry(6, 18, 4),
    mountains = new T.InstancedMesh(geo, mat('#89a89c'), 48);
  const dummy = new T.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 145, 4 + Math.sin(i * 5) * 3, Math.sin(a) * 145);
    dummy.scale.set(2, 1 + (i % 4) * 0.3, 2);
    dummy.rotation.y = i;
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mountains);
  label(scene, 'XMOD / BUILD ANYTHING', [0, 5.2, -13], 12);
  label(scene, 'THE WORKSHOP', [30, 10.3, -18.8], 10);
  label(scene, 'WATER TEST', [10, 1.8, 16], 8);
  const pad = new T.Mesh(new T.CylinderGeometry(5, 5, 0.12, 6), mat('#e3e9c6'));
  pad.position.set(0, 0.04, 9);
  pad.receiveShadow = true;
  scene.add(pad);
  return {
    update(time) {
      water.position.y = FLATGRASS.water.p[1] + Math.sin(time * 1.2) * 0.08;
    },
  };
}
