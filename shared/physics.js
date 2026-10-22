import * as C from 'cannon-es';
import { MAPS } from './maps.js';
export function createWorld(mapId = 'flatgrass') {
  if (!Object.hasOwn(MAPS, mapId)) throw new Error(`Unknown map: ${mapId}`);
  const world = new C.World({ gravity: new C.Vec3(0, -20, 0), allowSleep: true });
  world.map = MAPS[mapId];
  world.broadphase = new C.SAPBroadphase(world);
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.45;
  world.defaultContactMaterial.restitution = 0.12;
  world.playerMaterial = new C.Material('player');
  world.skidMaterial = new C.Material('skids');
  world.addContactMaterial(
    new C.ContactMaterial(world.skidMaterial, world.defaultMaterial, {
      friction: 0,
      restitution: 0.02,
    }),
  );
  world.addContactMaterial(
    new C.ContactMaterial(world.playerMaterial, world.defaultMaterial, {
      friction: 0,
      restitution: 0,
    }),
  );
  if (world.map.terrain) {
    const t = world.map.terrain;
    const terrain = new C.Body({
      mass: 0,
      material: world.defaultMaterial,
      shape: (() => {
        const n = Math.sqrt(t.vertices.length / 3),
          heights = Array.from({ length: n }, (_, x) =>
            Array.from({ length: n }, (_, j) => t.vertices[((n - 1 - j) * n + x) * 3 + 1]),
          );
        return new C.Heightfield(heights, { elementSize: 6 });
      })(),
    });
    terrain.position.set(-120, 0, 120);
    terrain.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    terrain.collisionFilterGroup = 1;
    terrain.aabbNeedsUpdate = true;
    world.addBody(terrain);
  }
  for (const box of world.map.boxes) {
    const body = new C.Body({
      mass: 0,
      material: world.defaultMaterial,
      shape: new C.Box(new C.Vec3(...box.s.map((v) => v / 2))),
    });
    body.position.set(...box.p);
    body.quaternion.setFromEuler(box.rx || 0, 0, 0);
    body.collisionFilterGroup = 1;
    body.aabbNeedsUpdate = true;
    world.addBody(body);
  }
  return world;
}
