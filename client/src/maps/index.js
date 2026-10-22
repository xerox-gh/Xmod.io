import * as T from 'three';
import { buildFlatgrass } from './flatgrass.js';
import { MAPS } from '../../../shared/maps.js';
export const mapFactories = Object.fromEntries(
  Object.keys(MAPS).map((id) => [id, (scene) => buildFlatgrass(scene, MAPS[id])]),
);
export function loadMap(id, scene) {
  if (!mapFactories[id]) throw new Error('Unknown map');
  const root = new T.Group();
  scene.add(root);
  const map = mapFactories[id](root);
  return {
    ...map,
    dispose() {
      scene.remove(root);
      const materials = new Set();
      root.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      });
      for (const m of materials) {
        m.map?.dispose();
        m.dispose();
      }
    },
  };
}
