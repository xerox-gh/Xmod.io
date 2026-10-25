import * as C from 'cannon-es';
export function createPlayer(world, id = 'local') {
  const body = new C.Body({
    mass: 75,
    fixedRotation: true,
    linearDamping: 0,
    material: world.playerMaterial,
  });
  body.addShape(new C.Box(new C.Vec3(0.34, 0.85, 0.34)));
  body.collisionFilterGroup = 2;
  body.collisionFilterMask = 1;
  body.allowSleep = false;
  body.position.set(...world.map.spawn);
  body.aabbNeedsUpdate = true;
  body.updateMassProperties();
  world.addBody(body);
  return {
    id,
    body,
    yaw: 0,
    pitch: 0,
    grounded: false,
    fly: false,
    crouched: false,
    lastJump: -10,
    time: 0,
  };
}
const ray = new C.RaycastResult();
export function movePlayer(player, input, world, dt) {
  const b = player.body;
  player.time += dt;
  player.yaw = Number.isFinite(input.yaw) ? input.yaw : player.yaw;
  player.pitch = Number.isFinite(input.pitch)
    ? Math.max(-1.5, Math.min(1.5, input.pitch))
    : player.pitch;
  // Change the capsule proxy height while keeping its feet on the ground.
  const crouch = !!input.crouch && !player.fly;
  if (crouch !== player.crouched) {
    const half = crouch ? 0.45 : 0.85;
    const ceiling = new C.RaycastResult();
    world.raycastClosest(
      b.position,
      new C.Vec3(b.position.x, b.position.y + 1.25, b.position.z),
      { collisionFilterMask: 1, skipBackfaces: true },
      ceiling,
    );
    if (crouch || !ceiling.hasHit) {
      b.position.y += crouch ? -0.4 : 0.4;
      b.shapes[0].halfExtents.y = half;
      b.shapes[0].updateConvexPolyhedronRepresentation();
      b.updateBoundingRadius();
      b.updateMassProperties();
      b.aabbNeedsUpdate = true;
      player.crouched = crouch;
    }
  }
  const half = player.crouched ? 0.45 : 0.85;
  ray.reset();
  world.raycastClosest(
    b.position,
    new C.Vec3(b.position.x, b.position.y - half - 0.15, b.position.z),
    { collisionFilterMask: 1, skipBackfaces: true },
    ray,
  );
  player.grounded = ray.hasHit && ray.hitNormalWorld.y > 0.45 && b.velocity.y < 2;
  const f = Math.max(-1, Math.min(1, input.forward || 0)),
    r = Math.max(-1, Math.min(1, input.right || 0));
  let dx = r * Math.cos(player.yaw) - f * Math.sin(player.yaw);
  let dz = -r * Math.sin(player.yaw) - f * Math.cos(player.yaw);
  const n = Math.hypot(dx, dz);
  if (n > 1) {
    dx /= n;
    dz /= n;
  }
  if (player.fly) {
    b.collisionResponse = false;
    b.type = C.Body.KINEMATIC;
    b.velocity.set(dx * 24, ((input.jump ? 1 : 0) - (input.crouch ? 1 : 0)) * 18, dz * 24);
    b.force.setZero();
  } else {
    b.collisionResponse = true;
    b.type = C.Body.DYNAMIC;
    const slide = player.crouched && Math.hypot(b.velocity.x, b.velocity.z) > 7;
    const icy = world.iceZones?.some(
      (p) =>
        Math.hypot(b.position.x - p.p[0], b.position.z - p.p[2]) < 3 &&
        Math.abs(b.position.y - p.p[1]) < 2,
    );
    const friction = icy ? 0.01 : player.grounded ? (slide ? 0.4 : 5.5) : 0.05;
    b.velocity.x *= Math.max(0, 1 - friction * dt);
    b.velocity.z *= Math.max(0, 1 - friction * dt);
    const speed = player.crouched && !slide ? 4 : input.sprint ? 14 : 9;
    const projected = b.velocity.x * dx + b.velocity.z * dz;
    const add = Math.max(0, Math.min(speed - projected, (player.grounded ? 75 : 22) * dt));
    b.velocity.x += dx * add;
    b.velocity.z += dz * add;
    const max = slide ? 24 : 22,
      horizontal = Math.hypot(b.velocity.x, b.velocity.z);
    if (horizontal > max) {
      b.velocity.x *= max / horizontal;
      b.velocity.z *= max / horizontal;
    }
    if (input.jump && player.grounded && player.time - player.lastJump > 0.18) {
      b.velocity.y = 8.5;
      player.lastJump = player.time;
    }
  }
  if (b.position.y < -35 || Math.abs(b.position.x) > 175 || Math.abs(b.position.z) > 175) {
    b.position.set(...world.map.spawn);
    b.velocity.setZero();
  }
}
