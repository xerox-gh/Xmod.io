import * as T from 'three';
import { PROPS } from '../../../shared/props.js';
// Geometry is cached. Only each prop's materials need disposal.
const cache = new Map();
const geometry = (key, factory) => {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
};
const box = () => geometry('box', () => new T.BoxGeometry(1, 1, 1));
const cylinder = () => geometry('cylinder', () => new T.CylinderGeometry(1, 1, 1, 12));
const sphere = () => geometry('sphere', () => new T.IcosahedronGeometry(1, 1));
export function makePropMesh(type, color = PROPS[type].color) {
  const d = PROPS[type],
    root = new T.Group();
  const material = new T.MeshStandardMaterial({ color, roughness: 0.78, flatShading: true });
  const dark = new T.MeshStandardMaterial({ color: '#354647', roughness: 0.8, flatShading: true });
  const light = new T.MeshStandardMaterial({ color: '#e5e8d4', roughness: 0.6, flatShading: true });
  const add = (geo, scale, p = [0, 0, 0], m = material) => {
    const mesh = new T.Mesh(geo, m);
    mesh.scale.set(...scale);
    mesh.position.set(...p);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.paint = m === material;
    root.add(mesh);
    return mesh;
  };
  if (d.shape === 'sphere') {
    add(sphere(), [d.size[0], d.size[0], d.size[0]]);
    if (type === 'ball')
      for (let i = 0; i < 3; i++) {
        const band = add(cylinder(), [0.73, 0.035, 0.73], [0, 0, 0], light);
        band.rotation.z = (i * Math.PI) / 3;
      }
  } else if (type === 'chair') {
    add(box(), [1, 0.18, 1], [0, -0.05, 0]);
    add(box(), [1, 0.95, 0.15], [0, 0.4, 0.42]);
    for (const x of [-0.4, 0.4])
      for (const z of [-0.4, 0.4]) add(box(), [0.12, 0.75, 0.12], [x, -0.5, z], dark);
  } else if (type === 'table') {
    add(box(), [2.8, 0.18, 1.6], [0, 0.65, 0]);
    for (const x of [-1.2, 1.2])
      for (const z of [-0.6, 0.6]) add(box(), [0.17, 1.4, 0.17], [x, -0.05, z], dark);
  } else if (type === 'sofa') {
    add(box(), [3, 0.65, 1.3], [0, -0.25, 0]);
    add(box(), [3, 0.8, 0.27], [0, 0.35, 0.5]);
    for (const x of [-1.32, 1.32]) add(box(), [0.35, 0.6, 1.3], [x, 0.3, 0]);
  } else if (type === 'car') {
    add(box(), d.size);
    add(box(), [1.65, 0.35, 1.5], [0, 0.5, 0.4]);
    add(box(), [1.6, 0.55, 0.12], [0, 0.85, -0.5], dark);
    for (const x of [-1.17, 1.17])
      for (const z of [-1.2, 1.2]) {
        const w = add(cylinder(), [0.56, 0.32, 0.56], [x, -0.5, z], dark);
        w.rotation.z = Math.PI / 2;
        const hub = new T.Group();
        hub.position.copy(w.position);
        w.position.set(0, 0, 0);
        root.remove(w);
        hub.add(w);
        hub.userData.wheel = true;
        root.add(hub);
      }
    for (const x of [-0.75, 0.75]) add(box(), [0.4, 0.18, 0.08], [x, 0.05, -1.88], light);
  } else if (d.shape === 'cylinder') {
    add(cylinder(), [d.size[0], d.size[1], d.size[0]]);
    for (const y of [-0.34, 0.34])
      add(cylinder(), [d.size[0] * 1.025, 0.1, d.size[0] * 1.025], [0, y * d.size[1], 0], dark);
    if (type === 'thruster') add(cylinder(), [0.22, 0.15, 0.22], [0, -0.55, 0], light);
    if (type === 'wheel') add(cylinder(), [0.25, 0.4, 0.25], [0, 0, 0], light);
  } else {
    add(box(), d.size);
    if (type === 'crate') {
      for (const x of [-0.65, 0.65]) add(box(), [0.15, 1.65, 1.65], [x, 0, 0], dark);
      for (const y of [-0.65, 0.65]) add(box(), [1.65, 0.15, 1.65], [0, y, 0], dark);
    }
  }
  if (type === 'head')
    for (const x of [-0.1, 0.1]) add(box(), [0.05, 0.06, 0.04], [x, 0.03, -0.28], dark);
  root.userData.materials = [material, dark, light];
  return root;
}
export function disposeProp(root) {
  for (const m of root.userData.materials || []) m.dispose();
}
