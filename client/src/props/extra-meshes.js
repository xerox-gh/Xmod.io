import * as T from 'three';
// Small assemblies made from shared primitive geometry, including functional lights.
export function extraMesh(type, d, add, shape, root, material, dark, light) {
  const { box, cylinder, sphere, geometry } = shape;
  const b = (s, p = [0, 0, 0], m = material) => add(box(), s, p, m);
  const wheel = (x, z, r = 0.52) => {
    const w = add(cylinder(), [r, 0.28, r], [0, 0, 0], dark);
    w.rotation.z = Math.PI / 2;
    root.remove(w);
    const hub = new T.Group();
    hub.position.set(x, -0.5, z);
    hub.add(w);
    hub.userData.wheel = true;
    root.add(hub);
  };
  if (type === 'ramp') {
    const geo = geometry('ramp', () => {
      const g = new T.BufferGeometry(),
        v = [
          [-0.5, -0.5, -0.5],
          [0.5, -0.5, -0.5],
          [-0.5, -0.5, 0.5],
          [0.5, -0.5, 0.5],
          [-0.5, 0.5, -0.5],
          [0.5, 0.5, -0.5],
        ],
        faces = [
          [1, 3, 2, 0],
          [4, 5, 1, 0],
          [2, 4, 0],
          [5, 3, 1],
          [3, 5, 4, 2],
        ],
        p = [];
      for (const f of faces)
        for (let i = 1; i < f.length - 1; i++)
          for (const index of [f[0], f[i], f[i + 1]]) p.push(...v[index]);
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      g.computeVertexNormals();
      return g;
    });
    add(geo, d.size);
    return true;
  }
  if (type === 'pipe') {
    add(
      geometry(
        'pipe',
        () =>
          new T.LatheGeometry(
            [
              new T.Vector2(0.72, -0.5),
              new T.Vector2(1, -0.5),
              new T.Vector2(1, 0.5),
              new T.Vector2(0.72, 0.5),
              new T.Vector2(0.72, -0.5),
            ],
            12,
          ),
      ),
      [d.size[0], d.size[1], d.size[0]],
    );
    return true;
  }
  if (type === 'cone') {
    add(
      geometry('cone', () => new T.ConeGeometry(1, 1, 8)),
      [d.size[0], d.size[1], d.size[0]],
    );
    b([1.1, 0.12, 1.1], [0, -0.75, 0], dark);
    add(cylinder(), [0.31, 0.16, 0.31], [0, 0.05, 0], light);
    return true;
  }
  if (['cabinet', 'shelf'].includes(type)) {
    b([2.2, 2.8, 0.15], [0, 0, 0.55]);
    for (const x of [-1.05, 1.05]) b([0.14, 2.8, 1.1], [x, 0, 0]);
    for (const y of [-1.3, -0.45, 0.45, 1.3]) b([2.2, 0.13, 1.1], [0, y, 0], light);
    if (type === 'cabinet') {
      b([2, 2.6, 0.12], [0, 0, -0.55]);
      for (const x of [-0.12, 0.12]) b([0.06, 0.3, 0.06], [x, 0, -0.65], dark);
    }
    return true;
  }
  if (type === 'bed') {
    b([2.4, 0.35, 4], [0, -0.3, 0], dark);
    b([2.3, 0.45, 3.9], [0, 0.1, 0]);
    b([2.4, 1.3, 0.18], [0, 0.3, 1.9], dark);
    b([1.7, 0.2, 0.7], [0, 0.45, 1.1], light);
    return true;
  }
  if (type === 'desk') {
    b([3, 0.14, 1.6], [0, 0.8, 0]);
    for (const x of [-1.3, 1.3]) b([0.2, 1.6, 1.4], [x, 0, 0], dark);
    b([1, 0.7, 0.9], [0.7, 0.4, 0], light);
    return true;
  }
  if (type === 'trampoline') {
    b(d.size, [0, 0, 0], dark);
    b([3.6, 0.08, 2.6], [0, 0.3, 0]);
    for (const x of [-1.7, 1.7])
      for (const z of [-1.2, 1.2]) b([0.18, 0.65, 0.18], [x, -0.55, z], light);
    return true;
  }
  if (type === 'conveyor') {
    b(d.size, [0, 0, 0], dark);
    for (let z = -2.1; z <= 2.1; z += 0.6) b([2.8, 0.08, 0.42], [0, 0.34, z]);
    return true;
  }
  if (type === 'button') {
    b(d.size, [0, 0, 0], dark);
    b([0.7, 0.22, 0.7], [0, 0.25, 0]);
    return true;
  }
  if (type === 'door') {
    b(d.size);
    b([0.22, 0.16, 0.28], [0.6, 0, -0.16], light);
    for (const y of [-1, 1]) b([0.12, 0.3, 0.3], [-0.8, y, 0], dark);
    return true;
  }
  if (type === 'lamp' || type === 'neon') {
    material.emissive.set(d.color);
    material.emissiveIntensity = type === 'neon' ? 2 : 0;
    if (type === 'lamp') {
      b([0.6, 0.15, 0.6], [0, -1.3, 0], dark);
      b([0.1, 2.2, 0.1], [0, -0.15, 0], dark);
      add(cylinder(), [0.6, 0.45, 0.6], [0, 1.1, 0]);
    } else b(d.size);
    const lamp = new T.PointLight(d.color, type === 'neon' ? 5 : 12, 12, 2);
    lamp.position.set(0, type === 'lamp' ? 1 : 0, 0);
    lamp.userData.lamp = true;
    root.add(lamp);
    return true;
  }
  if (type === 'target') {
    b([0.15, 2.6, 0.15], [0, -0.1, 0], dark);
    b([1.5, 0.12, 0.6], [0, -1.3, 0], dark);
    for (let i = 0; i < 3; i++) {
      const disc = add(
        cylinder(),
        [0.72 - i * 0.23, 0.04, 0.72 - i * 0.23],
        [0, 0.5, -0.1 - i * 0.04],
        i === 1 ? light : material,
      );
      disc.rotation.x = Math.PI / 2;
    }
    return true;
  }
  if (['boat', 'plane', 'tank', 'bike'].includes(type)) {
    b(d.size);
    if (type === 'boat') {
      b([1.8, 0.45, 3.5], [0, 0.55, 0], dark);
      for (const x of [-1.08, 1.08]) b([0.25, 0.6, 4.7], [x, 0.35, 0]);
      b([1.5, 0.3, 0.8], [0, 0.8, 0.8], light);
      b([0.7, 0.6, 0.5], [0, 0.1, 2.4], dark);
    }
    if (type === 'plane') {
      b([9, 0.16, 1.5], [0, 0, 0], light);
      b([3, 0.12, 0.8], [0, 0.4, 2.3]);
      b([0.13, 1.5, 1.2], [0, 0.8, 2]);
      add(sphere(), [0.55, 0.55, 0.9], [0, 0.65, -0.8], dark);
      b([2, 0.15, 0.12], [0, 0, -2.9], dark);
      for (const x of [-0.7, 0.7]) {
        const w = add(cylinder(), [0.3, 0.2, 0.3], [x, -0.8, 0], dark);
        w.rotation.z = Math.PI / 2;
      }
    }
    if (type === 'tank') {
      b([2.2, 0.8, 2.5], [0, 0.85, 0], dark);
      b([0.28, 0.25, 3.5], [0, 0.9, -2]);
      for (const x of [-1.5, 1.5]) for (const z of [-1.5, 0, 1.5]) wheel(x, z);
    }
    if (type === 'bike') {
      b([0.7, 0.25, 1], [0, 0.6, 0.4], dark);
      b([1.3, 0.1, 0.15], [0, 0.8, -0.8], light);
      wheel(0, -0.9, 0.43);
      wheel(0, 0.9, 0.43);
    }
    return true;
  }
  return false;
}
