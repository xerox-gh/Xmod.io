import * as T from 'three';
// Original handheld silhouettes, built entirely from primitive geometry.
export function makeExtraWeaponModels() {
  const steel = new T.MeshStandardMaterial({ color: '#748b91', metalness: 0.6, roughness: 0.35 }),
    red = new T.MeshStandardMaterial({ color: '#d1785c', flatShading: true }),
    dark = new T.MeshStandardMaterial({ color: '#344d42', flatShading: true });
  const crowbar = new T.Group(),
    grenade = new T.Group();
  const part = (root, geo, material, p, rotation = [0, 0, 0]) => {
    const mesh = new T.Mesh(geo, material);
    mesh.position.set(...p);
    mesh.rotation.set(...rotation);
    root.add(mesh);
    return mesh;
  };
  part(crowbar, new T.CylinderGeometry(0.035, 0.035, 0.9, 6), red, [0, 0.05, -0.1], [0.35, 0, 0]);
  part(crowbar, new T.CylinderGeometry(0.035, 0.035, 0.2, 6), steel, [0, 0.48, -0.2], [0.35, 0, 0]);
  part(crowbar, new T.BoxGeometry(0.07, 0.07, 0.17), steel, [0, 0.55, -0.27]);
  part(crowbar, new T.BoxGeometry(0.065, 0.05, 0.2), steel, [0, -0.4, 0.1]);
  part(grenade, new T.IcosahedronGeometry(0.17, 1), dark, [0, -0.04, -0.1]);
  part(grenade, new T.BoxGeometry(0.12, 0.08, 0.1), steel, [0, 0.13, -0.1]);
  part(grenade, new T.BoxGeometry(0.045, 0.22, 0.04), steel, [0.13, 0.03, -0.1], [0, 0, -0.3]);
  part(grenade, new T.TorusGeometry(0.055, 0.012, 4, 8), steel, [-0.05, 0.2, -0.1]);
  return { crowbar, grenade };
}
