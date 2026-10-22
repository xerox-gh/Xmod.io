import * as C from 'cannon-es';
import { MAPS } from './maps.js';
export function createWorld(mapId = 'flatgrass') {
  if (!MAPS[mapId]) throw new Error(`Unknown map: ${mapId}`);
  const world = new C.World({ gravity: new C.Vec3(0, -20, 0), allowSleep: true });
  world.map = MAPS[mapId];
  world.broadphase = new C.SAPBroadphase(world);
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.45;
  world.defaultContactMaterial.restitution = 0.12;
  world.playerMaterial = new C.Material('player');
  world.addContactMaterial(
    new C.ContactMaterial(world.playerMaterial, world.defaultMaterial, {
      friction: 0,
      restitution: 0,
    }),
  );
  for (const box of world.map.boxes) {
    const body = new C.Body({
      mass: 0,
      material: world.defaultMaterial,
      shape: new C.Box(new C.Vec3(...box.s.map((v) => v / 2))),
    });
    body.position.set(...box.p);
    body.quaternion.setFromEuler(box.rx || 0, 0, 0);
    body.collisionFilterGroup = 1;
    world.addBody(body);
  }
  return world;
}
