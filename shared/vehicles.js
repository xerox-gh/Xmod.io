import * as C from 'cannon-es';
import { PROPS } from './props.js';
export function setupVehicle(sim, chassis) {
  const kind = PROPS[chassis.type].vehicle;
  if (!kind) return;
  chassis.body.angularDamping = 0.4;
  if (kind === 'plane') chassis.body.material = sim.world.skidMaterial;
  let vehicle = null;
  if (['car', 'tank', 'bike'].includes(kind)) {
    vehicle = new C.RaycastVehicle({
      chassisBody: chassis.body,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
    const radius = kind === 'tank' ? 0.52 : kind === 'bike' ? 0.43 : 0.56;
    const opts = {
      radius,
      directionLocal: new C.Vec3(0, -1, 0),
      axleLocal: new C.Vec3(-1, 0, 0),
      suspensionStiffness: 40,
      suspensionRestLength: 0.45,
      frictionSlip: 5,
      dampingRelaxation: 4,
      dampingCompression: 5,
      maxSuspensionForce: 16000,
      rollInfluence: 0.025,
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -25,
      useCustomSlidingRotationalSpeed: true,
    };
    const points =
      kind === 'bike'
        ? [
            [0, -0.9],
            [0, 0.9],
          ]
        : kind === 'tank'
          ? [-1.5, 1.5].flatMap((x) => [-1.5, 0, 1.5].map((z) => [x, z]))
          : [-1.1, 1.1].flatMap((x) => [-1.25, 1.25].map((z) => [x, z]));
    for (const [x, z] of points)
      vehicle.addWheel({ ...opts, chassisConnectionPointLocal: new C.Vec3(x, -0.15, z) });
    vehicle.addToWorld(sim.world);
  }
  sim.vehicles.set(chassis.id, { id: chassis.id, kind, vehicle, driver: null });
}
export function spawnVehicle(sim, type, p, owner, yaw = 0) {
  const e = sim.spawn(type, p, owner);
  e.body.quaternion.setFromEuler(0, yaw, 0);
  setupVehicle(sim, e);
  return e;
}
export const spawnCar = (sim, p, owner, yaw = 0) => spawnVehicle(sim, 'car', p, owner, yaw);
export function enterCar(sim, actor, id) {
  if (actor.state.vehicleId) {
    exitCar(sim, actor);
    return;
  }
  const car = sim.vehicles.get(id),
    e = sim.entities.get(id);
  if (!car || !e) throw new Error('No vehicle nearby');
  if (car.driver) throw new Error('Vehicle already has a driver');
  if (e.body.position.distanceTo(actor.state.body.position) > 6)
    throw new Error('Move closer to the vehicle');
  car.driver = actor.id;
  actor.state.vehicleId = id;
  actor.state.body.type = C.Body.KINEMATIC;
  actor.state.body.collisionResponse = false;
  sim.emit('driver', { id, driver: actor.id });
}
export function exitCar(sim, actor) {
  const car = sim.vehicles.get(actor.state.vehicleId),
    e = sim.entities.get(actor.state.vehicleId);
  if (car) car.driver = null;
  if (e) actor.state.body.position.copy(e.body.pointToWorldFrame(new C.Vec3(3.2, 2, 0)));
  actor.state.body.type = C.Body.DYNAMIC;
  actor.state.body.collisionResponse = true;
  actor.state.body.velocity.setZero();
  sim.emit('driver', { id: actor.state.vehicleId, driver: null });
  actor.state.vehicleId = null;
}
export function stepCars(sim, actors) {
  for (const [id, car] of sim.vehicles) {
    const e = sim.entities.get(id);
    if (!e) continue;
    const body = e.body,
      actor = actors.get(car.driver),
      input = actor?.input || {};
    if (car.vehicle) {
      const count = car.vehicle.wheelInfos.length;
      for (let i = 0; i < count; i++) {
        const steering =
          car.kind === 'tank' ? (i < count / 2 ? 1 : -1) * (input.right || 0) * 400 : 0;
        car.vehicle.applyEngineForce(
          (input.forward || 0) * (car.kind === 'tank' ? -950 : -650) + steering,
          i,
        );
        car.vehicle.setBrake(input.jump ? 24 : actor ? 0 : 4, i);
        if (car.kind === 'bike' ? i === 0 : i === 0 || i === count / 2)
          car.vehicle.setSteeringValue(car.kind === 'tank' ? 0 : -(input.right || 0) * 0.43, i);
      }
      if (car.kind === 'bike') upright(body, 180);
    } else if (car.kind === 'boat') {
      const water = sim.world.map.water;
      if (
        water &&
        Math.abs(body.position.x - water.p[0]) < water.s[0] / 2 &&
        Math.abs(body.position.z - water.p[2]) < water.s[1] / 2
      ) {
        const sub = water.p[1] + 0.35 - body.position.y;
        if (sub > -0.3) {
          body.applyForce(
            new C.Vec3(
              0,
              Math.max(
                0,
                body.mass * (Math.abs(sim.world.gravity.y) + sub * 16 - body.velocity.y * 5),
              ),
              0,
            ),
          );
          body.velocity.x *= 0.992;
          body.velocity.z *= 0.992;
          upright(body, 500);
          const f = body.vectorToWorldFrame(new C.Vec3(0, 0, -1));
          body.applyForce(f.scale((input.forward || 0) * 1100));
          body.torque.y -= (input.right || 0) * 480;
          body.wakeUp();
        }
      }
    } else if (car.kind === 'plane') {
      const forward = body.vectorToWorldFrame(new C.Vec3(0, 0, -1)),
        up = body.vectorToWorldFrame(new C.Vec3(0, 1, 0));
      const speed = Math.max(0, body.velocity.dot(forward));
      body.applyForce(
        forward.scale((input.forward > 0 ? 1700 : 0) - (input.forward < 0 ? 500 : 0)),
      );
      body.applyForce(up.scale(Math.min(body.mass * 30, speed * speed * 2.1)));
      body.applyForce(body.velocity.scale(-body.mass * 0.08));
      const localTorque = new C.Vec3(
        (input.jump ? 1 : input.crouch ? -1 : 0) * 450,
        -(input.right || 0) * 130,
        -(input.right || 0) * 220,
      );
      body.torque.vadd(body.vectorToWorldFrame(localTorque), body.torque);
      if (actor) body.wakeUp();
    }
    if (actor) {
      actor.state.body.position.copy(body.pointToWorldFrame(new C.Vec3(0, 1.2, 0.3)));
      actor.state.body.velocity.setZero();
    }
  }
}
function upright(body, force) {
  const up = body.vectorToWorldFrame(new C.Vec3(0, 1, 0)),
    correction = up.cross(new C.Vec3(0, 1, 0));
  body.torque.x += correction.x * force - body.angularVelocity.x * 40;
  body.torque.z += correction.z * force - body.angularVelocity.z * 40;
}
export function vehicleSnapshot(sim) {
  return [...sim.vehicles].map(([id, car]) => ({
    id,
    kind: car.kind,
    driver: car.driver,
    wheels: car.vehicle
      ? car.vehicle.wheelInfos.map((_, i) => {
          car.vehicle.updateWheelTransform(i);
          const t = car.vehicle.getWheelTransformWorld(i);
          return { p: t.position.toArray(), q: t.quaternion.toArray() };
        })
      : [],
  }));
}
