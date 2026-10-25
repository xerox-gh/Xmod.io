import * as C from 'cannon-es';
// Clip a rectangle by pairwise seed bisectors: bounded 2D Voronoi shards,
// extruded into actual convex collision prisms rather than a particle-only break.
export function voronoiCells(width, height, count = 7) {
  const seeds = Array.from({ length: count }, () => [
    (Math.random() - 0.5) * width,
    (Math.random() - 0.5) * height,
  ]);
  return seeds
    .map((seed, index) => {
      let polygon = [
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [-width / 2, height / 2],
      ];
      for (let j = 0; j < seeds.length; j++)
        if (j !== index) {
          const other = seeds[j],
            nx = other[0] - seed[0],
            ny = other[1] - seed[1],
            limit = (other[0] ** 2 + other[1] ** 2 - seed[0] ** 2 - seed[1] ** 2) / 2,
            next = [];
          for (let k = 0; k < polygon.length; k++) {
            const a = polygon[k],
              b = polygon[(k + 1) % polygon.length],
              da = a[0] * nx + a[1] * ny - limit,
              db = b[0] * nx + b[1] * ny - limit;
            if (da <= 0) next.push(a);
            if (da < 0 !== db < 0) {
              const t = da / (da - db);
              next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
          }
          polygon = next;
        }
      return polygon;
    })
    .filter((p) => p.length >= 3 && p.length <= 12);
}
export function shardShape(polygon, scale = 1) {
  const n = polygon.length,
    vertices = [-0.06, 0.06].flatMap((z) =>
      polygon.map(([x, y]) => new C.Vec3(x * scale, y * scale, z * scale)),
    );
  const faces = [
    Array.from({ length: n }, (_, i) => n - 1 - i),
    Array.from({ length: n }, (_, i) => n + i),
  ];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, ((i + 1) % n) + n, i + n]);
  return new C.ConvexPolyhedron({ vertices, faces });
}
const wood = (e) => /crate|plank|chair|table|sofa|shelf|cabinet|desk/.test(e.type);
export function ignite(lab, e) {
  if (e && wood(e) && !e.behavior.burning) {
    e.behavior.burning = true;
    e.behavior.burnTime = lab.sim.time;
    lab.sim.emit('change', { entity: lab.sim.serialize(e) });
  }
}
export function fracture(lab, e) {
  const sim = lab.sim,
    p = e.body.position.clone(),
    q = e.body.quaternion.clone(),
    velocity = e.body.velocity.clone(),
    owner = e.owner,
    scale = e.scale,
    color = e.color;
  const kind = e.type === 'glass' ? 'glass_shard' : e.type === 'pot' ? 'ceramic_shard' : 'plank';
  const cells =
    e.type === 'glass'
      ? voronoiCells(3 * scale, 2.5 * scale)
      : Array.from({ length: 5 }, () => null);
  sim.remove(e.id);
  if (sim.entities.size + cells.length > 200) return; // Breaking never evicts an unrelated construction.
  const group = sim.id('debris');
  for (let i = 0; i < cells.length; i++) {
    let polygon = cells[i],
      offset = new C.Vec3(
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
      );
    if (polygon) {
      const center = polygon.reduce(
        (a, v) => [a[0] + v[0] / polygon.length, a[1] + v[1] / polygon.length],
        [0, 0],
      );
      polygon = polygon.map((v) => [v[0] - center[0], v[1] - center[1]]);
      offset = new C.Vec3(...center, 0);
    }
    q.vmult(offset, offset);
    const shard = sim.spawn(kind, p.vadd(offset).toArray(), owner, {
      group,
      color,
      q: q.toArray(),
      scale: polygon ? 1 : Math.max(0.35, Math.min(1, scale * 0.4)),
      behavior: polygon ? { polygon } : {},
    });
    shard.body.velocity.copy(velocity.vadd(offset.scale(2)));
    shard.body.angularVelocity.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    lab.state(shard.id).expires = sim.time + 18;
  }
  sim.emit('fracture', { p: p.toArray(), color });
}
export function stepFire(lab, dt) {
  const sim = lab.sim;
  for (const id of [...lab.breakQueue]) {
    const e = sim.entities.get(id);
    if (e) fracture(lab, e);
  }
  lab.breakQueue.clear();
  for (const e of [...sim.entities.values()]) {
    const s = e.behavior,
      state = lab.state(e.id);
    if (state.expires && sim.time > state.expires) {
      sim.remove(e.id);
      continue;
    }
    if (!s.burning) continue;
    s.char = Math.min(1, (s.char || 0) + dt * 0.13);
    if ((state.nextSmoke || 0) < sim.time) {
      state.nextSmoke = sim.time + 0.3;
      sim.emit('burn', { p: e.body.position.toArray() });
      sim.emit('change', { entity: sim.serialize(e) });
      e.body.updateAABB();
      for (const other of sim.entities.values())
        if (other !== e && wood(other) && !other.behavior.burning) {
          other.body.updateAABB();
          const a = e.body.aabb,
            b = other.body.aabb;
          const gap = Math.max(
            a.lowerBound.x - b.upperBound.x,
            b.lowerBound.x - a.upperBound.x,
            a.lowerBound.y - b.upperBound.y,
            b.lowerBound.y - a.upperBound.y,
            a.lowerBound.z - b.upperBound.z,
            b.lowerBound.z - a.upperBound.z,
          );
          if (gap < 0.25) ignite(lab, other);
        }
    }
    if (s.char >= 1) lab.breakQueue.add(e.id);
  }
}
