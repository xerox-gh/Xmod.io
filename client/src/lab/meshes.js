import * as T from 'three';
import { LAB_PROPS } from '../../../shared/lab/definitions.js';
export function labMesh(type, d, add, shape, root, material, dark, light) {
  if (!Object.hasOwn(LAB_PROPS, type)) return false;
  const box = (s, p = [0, 0, 0], m = material) => add(shape.box(), s, p, m);
  if (type === 'glass' || type === 'glass_shard') {
    material.transparent = true;
    material.opacity = 0.35;
    material.roughness = 0.08;
    material.metalness = 0.25;
    material.side = T.DoubleSide;
    box(d.size);
  } else if (type === 'gravity_zone') {
    material.transparent = true;
    material.opacity = 0.045;
    material.depthWrite = false;
    box(d.size);
    const outline = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(...d.size)),
      new T.LineBasicMaterial({ color: d.color, transparent: true, opacity: 0.5 }),
    );
    root.add(outline);
    root.userData.disposables = [outline.geometry, outline.material];
  } else if (type === 'hoverball') {
    material.emissive.set('#337866');
    material.emissiveIntensity = 0.6;
    add(shape.sphere(), [0.45, 0.45, 0.45]);
    for (const x of [-0.55, 0.55]) box([0.15, 0.13, 0.6], [x, 0, 0], dark);
  } else if (type === 'telepad') {
    box(d.size, [0, 0, 0], dark);
    material.emissive.set(d.color);
    material.emissiveIntensity = 0.8;
    for (const x of [-1.3, 1.3]) box([0.18, 0.12, 2.8], [x, 0.14, 0]);
    for (const z of [-1.3, 1.3]) box([2.8, 0.12, 0.18], [0, 0.14, z]);
  } else if (['digital_screen', 'monitor', 'mirror'].includes(type)) {
    box(d.size, [0, 0, 0], dark);
    box([d.size[0] - 0.15, d.size[1] - 0.15, 0.025], [0, 0, 0.14], material);
    box([0.15, 0.55, 0.15], [0, -d.size[1] / 2 - 0.15, 0], light);
  } else if (type === 'cctv') {
    box([0.65, 0.55, 0.9]);
    box([0.45, 0.35, 0.12], [0, 0, -0.5], dark);
    box([0.18, 0.5, 0.18], [0, -0.45, 0], light);
  } else if (type === 'turret') {
    box([1.2, 0.3, 1.2], [0, -0.4, 0], dark);
    const head = new T.Group();
    head.userData.gimbal = true;
    root.add(head);
    const barrel = box([0.24, 0.2, 1.7], [0, 0.1, -0.5]);
    root.remove(barrel);
    head.add(barrel);
    const body = box([0.7, 0.6, 0.7]);
    root.remove(body);
    head.add(body);
  } else if (type === 'nextbot') {
    material.transparent = true;
    material.opacity = 0;
    box(d.size);
  } else if (type === 'checkpoint') {
    material.transparent = true;
    material.opacity = 0.17;
    material.depthWrite = false;
    box(d.size);
    box([5, 0.22, 0.3], [0, 1.9, 0], light);
    for (const x of [-2.4, 2.4]) box([0.22, 4, 0.3], [x, 0, 0], light);
  } else if (d.category === 'Wire') {
    box(d.size, [0, 0, 0], dark);
    box([d.size[0] * 0.8, 0.12, d.size[2] * 0.8], [0, d.size[1] / 2 + 0.03, 0]);
    for (const x of [-1, 1]) box([0.1, 0.1, 0.12], [(x * d.size[0]) / 2, 0.05, 0], light);
  } else if (type === 'core') {
    material.emissive.set(d.color);
    material.emissiveIntensity = 0.7;
    box([1.5, 0.3, 1.5], [0, -1.1, 0], dark);
    add(shape.sphere(), [0.65, 0.9, 0.65], [0, 0.2, 0]);
  } else if (type === 'pot') {
    add(shape.cylinder(), d.size);
    add(shape.cylinder(), [0.7, 0.12, 0.7], [0, 0.65, 0], light);
  } else if (type === 'ceramic_shard') add(shape.sphere(), [0.24, 0.24, 0.24]);
  else box(d.size);
  return true;
}
