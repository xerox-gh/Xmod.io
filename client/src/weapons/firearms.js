import * as T from 'three';
import { WEAPONS } from '../../../shared/weapons.js';
// Shared primitive geometry, original low-poly silhouettes. Only the equipped
// weapon is visible; these meshes never add rigid bodies to the sandbox.
export function makeFirearmModels() {
  const box = new T.BoxGeometry(1, 1, 1),
    tube = new T.CylinderGeometry(1, 1, 1, 8),
    models = {};
  const steel = new T.MeshStandardMaterial({
      color: '#32484e',
      metalness: 0.35,
      roughness: 0.55,
      flatShading: true,
    }),
    black = new T.MeshStandardMaterial({ color: '#182b30', roughness: 0.8, flatShading: true }),
    silver = new T.MeshStandardMaterial({
      color: '#bccdca',
      metalness: 0.55,
      roughness: 0.4,
      flatShading: true,
    });
  for (const id of ['pistol', 'smg', 'rifle', 'sniper', 'revolver', 'lmg', 'shotgun', 'rocket']) {
    const root = new T.Group(),
      accent = new T.MeshStandardMaterial({
        color: WEAPONS[id].accent || '#b7ceae',
        roughness: 0.7,
        flatShading: true,
      });
    root.userData.weapon = id;
    const part = (geo, scale, p, material = steel, rotation = [0, 0, 0]) => {
      const mesh = new T.Mesh(geo, material);
      mesh.scale.set(...scale);
      mesh.position.set(...p);
      mesh.rotation.set(...rotation);
      root.add(mesh);
      return mesh;
    };
    const b = (s, p, m = steel, r) => part(box, s, p, m, r),
      barrel = (radius, length, z, y = 0, m = black) =>
        part(tube, [radius, length, radius], [0, y, z], m, [Math.PI / 2, 0, 0]);
    if (id === 'rocket') {
      barrel(0.15, 1, -0.26, 0, accent);
      barrel(0.17, 0.08, -0.8, 0, steel);
      barrel(0.095, 0.025, -0.85, 0, black);
      b([0.08, 0.24, 0.14], [0, -0.2, 0.05], black);
      b([0.13, 0.1, 0.15], [0.1, 0.14, -0.17], silver);
    } else if (id === 'pistol' || id === 'revolver') {
      b([0.14, 0.15, 0.36], [0, 0.025, -0.06], id === 'revolver' ? silver : steel);
      b([0.12, 0.25, 0.14], [0, -0.16, 0.09], accent, [0.15, 0, 0]);
      barrel(
        0.045,
        id === 'revolver' ? 0.45 : 0.21,
        id === 'revolver' ? -0.36 : -0.31,
        0.035,
        silver,
      );
      barrel(0.027, 0.03, id === 'revolver' ? -0.6 : -0.43, 0.035);
      if (id === 'revolver')
        part(tube, [0.105, 0.18, 0.105], [0, 0.01, -0.035], steel, [Math.PI / 2, 0, 0]);
      b([0.025, 0.045, 0.035], [0, 0.12, -0.24], black);
    } else {
      const long = id === 'sniper',
        heavy = id === 'lmg',
        small = id === 'smg',
        length = long ? 0.65 : small ? 0.38 : 0.52;
      b([heavy ? 0.24 : 0.17, 0.19, length], [0, 0, -0.12], steel);
      b([0.13, 0.27, 0.14], [0, -0.2, 0.04], black, [0.2, 0, 0]);
      b([0.12, 0.18, small ? 0.15 : 0.32], [0, 0.005, 0.25], accent);
      b([0.18, 0.24, 0.065], [0, -0.025, 0.41], black);
      b(
        [0.16, 0.13, long ? 0.5 : small ? 0.25 : 0.4],
        [0, 0, long ? -0.65 : small ? -0.43 : -0.5],
        accent,
      );
      const muzzle = long ? -1.25 : small ? -0.75 : id === 'shotgun' ? -1.05 : -1;
      barrel(
        id === 'shotgun' ? 0.052 : 0.035,
        Math.abs(muzzle + 0.25),
        (muzzle - 0.25) / 2,
        0.025,
        silver,
      );
      barrel(0.046, 0.045, muzzle, 0.025);
      if (heavy) {
        b([0.26, 0.32, 0.25], [0, -0.25, -0.2], accent);
        for (const x of [-0.15, 0.15])
          b([0.025, 0.26, 0.03], [x, -0.16, -0.79], silver, [0, 0, x > 0 ? -0.45 : 0.45]);
      } else if (id === 'shotgun') barrel(0.035, 0.65, -0.52, -0.08, black);
      else
        b([0.1, 0.26, small ? 0.12 : 0.18], [0, -0.22, -0.18], accent, [small ? 0 : -0.15, 0, 0]);
      if (long) {
        barrel(0.075, 0.34, -0.25, 0.2);
        barrel(0.085, 0.035, -0.43, 0.2, silver);
        barrel(0.055, 0.018, -0.45, 0.2, accent);
        b([0.055, 0.15, 0.1], [0, 0.11, -0.22], black);
      } else {
        b([0.035, 0.06, 0.025], [0, 0.14, -0.51], black);
        b([0.08, 0.05, 0.05], [0, 0.14, 0.06], silver);
      }
    }
    models[id] = root;
  }
  return models;
}
