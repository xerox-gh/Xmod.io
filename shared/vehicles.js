import * as C from 'cannon-es';
export function spawnCar(sim, p, owner, yaw = 0) {
  const chassis = sim.spawn('car', p, owner);
  chassis.body.quaternion.setFromEuler(0, yaw, 0);
  chassis.body.angularDamping = 0.4;
  const vehicle = new C.RaycastVehicle({
    chassisBody: chassis.body,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });
  const options = {
    radius: 0.56,
    directionLocal: new C.Vec3(0, -1, 0),
    axleLocal: new C.Vec3(-1, 0, 0),
    suspensionStiffness: 35,
    suspensionRestLength: 0.45,
    frictionSlip: 4.5,
    dampingRelaxation: 4,
    dampingCompression: 5,
    maxSuspensionForce: 12000,
    rollInfluence: 0.03,
    maxSuspensionTravel: 0.3,
    customSlidingRotationalSpeed: -25,
    useCustomSlidingRotationalSpeed: true,
  };
  for (const x of [-1.1, 1.1])
    for (const z of [-1.25, 1.25])
      vehicle.addWheel({ ...options, chassisConnectionPointLocal: new C.Vec3(x, -0.15, z) });
  vehicle.addToWorld(sim.world);
  sim.vehicles.set(chassis.id, { id: chassis.id, vehicle, driver: null });
  return chassis;
}
export function enterCar(sim, actor, id) {
  const current = actor.state.vehicleId;
  if (current) {
    exitCar(sim, actor);
    return;
  }
  const car = sim.vehicles.get(id),
    e = sim.entities.get(id);
  if (!car || !e) throw new Error('No vehicle nearby');
  if (car.driver) throw new Error('That vehicle already has a driver');
  if (e.body.position.distanceTo(actor.state.body.position) > 5)
    throw new Error('Move closer to the buggy');
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
  if (e) {
    const p = e.body.pointToWorldFrame(new C.Vec3(2.8, 1, 0));
    actor.state.body.position.copy(p);
  }
  actor.state.body.type = C.Body.DYNAMIC;
  actor.state.body.collisionResponse = true;
  actor.state.body.velocity.setZero();
  sim.emit('driver', { id: actor.state.vehicleId, driver: null });
  actor.state.vehicleId = null;
}
export function stepCars(sim, actors) {
  for (const [id, car] of sim.vehicles) {
    const actor = actors.get(car.driver),
      input = actor?.input || {};
    for (let i = 0; i < 4; i++) {
      car.vehicle.applyEngineForce((input.forward || 0) * -650, i);
      car.vehicle.setBrake(input.jump ? 18 : actor ? 0 : 4, i);
      if (i === 0 || i === 2) car.vehicle.setSteeringValue(-(input.right || 0) * 0.43, i);
    }
    if (actor) {
      const e = sim.entities.get(id);
      actor.state.body.position.copy(e.body.pointToWorldFrame(new C.Vec3(0, 1, 0.3)));
      actor.state.body.velocity.setZero();
    }
  }
}
export function vehicleSnapshot(sim) {
  return [...sim.vehicles].map(([id, car]) => ({
    id,
    driver: car.driver,
    wheels: car.vehicle.wheelInfos.map((_, i) => {
      car.vehicle.updateWheelTransform(i);
      const t = car.vehicle.getWheelTransformWorld(i);
      return { p: t.position.toArray(), q: t.quaternion.toArray() };
    }),
  }));
}
