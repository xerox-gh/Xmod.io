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
export function buildFlatgrass(scene, data = FLATGRASS) {
  for (const box of data.boxes) {
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
  const water = data.water
    ? new T.Mesh(
        new T.PlaneGeometry(...data.water.s),
        new T.MeshStandardMaterial({
          color: '#54bcc6',
          roughness: 0.2,
          transparent: true,
          opacity: 0.78,
        }),
      )
    : null;
  if (water) {
    water.rotation.x = -Math.PI / 2;
    water.position.set(...data.water.p);
    scene.add(water);
  }
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
  mountains.visible = data.id !== 'void';
  scene.add(mountains);
  if (data.terrain) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.terrain.vertices, 3));
    geometry.setIndex(data.terrain.indices);
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, mat('#98b98a'));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (data.id === 'flatgrass') {
    label(scene, 'XMOD / BUILD ANYTHING', [0, 5.2, -13], 12);
    label(scene, 'THE WORKSHOP', [30, 10.3, -18.8], 10);
    label(scene, 'WATER TEST', [10, 1.8, 16], 8);
  }
  if (data.id === 'city') {
    for (let x of [-24, 24])
      for (let i = 0; i < 25; i++) {
        const window = new T.Mesh(new T.BoxGeometry(0.1, 1.5, 1.5), mat('#e2d89c'));
        window.position.set(x + 9.05, 3 + (i % 3) * 3, Math.floor(i / 3) * 12 - 70);
        scene.add(window);
      }
  }
  const pad = new T.Mesh(new T.CylinderGeometry(5, 5, 0.12, 6), mat('#e3e9c6'));
  pad.position.set(0, 0.04, 9);
  pad.receiveShadow = true;
  scene.add(pad);
  return {
    update(time) {
      if (water) water.position.y = data.water.p[1] + Math.sin(time * 1.2) * 0.08;
    },
  };
}
