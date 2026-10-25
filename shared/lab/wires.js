import * as C from 'cannon-es';
// A wire carries a number from OUT to A/B/X/Y/Z. Gates use the previous tick's
// outputs: feedback loops stay bounded and never block a render frame.
export function stepWires(lab, dt) {
  const sim = lab.sim,
    incoming = new Map();
  for (const c of sim.constraints.values())
    if (c.type === 'wire') {
      const ports = incoming.get(c.b) || {};
      ports[c.input || 'a'] = lab.values.get(c.a)?.out || 0;
      incoming.set(c.b, ports);
    }
  for (const e of sim.entities.values()) {
    const s = e.behavior,
      b = e.body,
      state = lab.state(e.id),
      ports = incoming.get(e.id) || {},
      a = ports.a || 0,
      z = ports.b || 0;
    let out = 0;
    if (e.type === 'laser_sensor') {
      const start = b.position.vadd(b.vectorToWorldFrame(new C.Vec3(0, 0, -0.5))),
        range = s.range || 20,
        end = start.vadd(b.vectorToWorldFrame(new C.Vec3(0, 0, -range)));
      out = range;
      sim.world.raycastAll(start, end, { collisionFilterMask: 3, skipBackfaces: true }, (hit) => {
        if (hit.body !== b) out = Math.min(out, hit.distance);
      });
      state.laser = [
        start.toArray(),
        start.vadd(b.vectorToWorldFrame(new C.Vec3(0, 0, -out))).toArray(),
      ];
    } else if (e.type === 'proximity_sensor') {
      const bodies = [...lab.actors.values()]
        .map((a) => a.state.body)
        .concat(
          [...sim.entities.values()]
            .filter((p) => p.behavior.npc || p.behavior.nextbot)
            .map((p) => p.body),
        );
      out = Number(bodies.some((body) => body.position.distanceTo(b.position) < (s.range || 8)));
    } else if (e.type === 'speed_sensor') out = b.velocity.length();
    else if (e.type === 'altimeter') out = b.position.y;
    else if (e.type === 'button') out = Number(!!s.pressed);
    else if (e.type === 'logic_and') out = Number(a > 0 && z > 0);
    else if (e.type === 'logic_or') out = Number(a > 0 || z > 0);
    else if (e.type === 'logic_not') out = Number(a <= 0);
    else if (e.type === 'logic_xor') out = Number(a > 0 !== z > 0);
    else if (e.type === 'logic_clock')
      out = Number(sim.time % (s.period || 1) < (s.period || 1) / 2);
    else if (e.type === 'logic_latch') {
      if (a > 0 && !state.lastA) state.latched = !state.latched;
      state.lastA = a > 0;
      out = Number(!!state.latched);
    } else out = a;
    lab.values.set(e.id, { ...ports, out });
    if (e.type === 'sound_emitter' && a > 0 && (state.nextTone || 0) < sim.time) {
      state.nextTone = sim.time + 0.18;
      sim.emit('wireTone', {
        p: b.position.toArray(),
        frequency: Math.max(40, Math.min(2000, a > 1 ? a : s.frequency || 220)),
        waveform: s.waveform || 'sine',
      });
    }
    if (e.type === 'door' && incoming.has(e.id)) s.open = a > 0;
    if ((e.type === 'lamp' || e.type === 'neon') && incoming.has(e.id)) s.lit = a > 0;
    if (e.type === 'turret') {
      const actor = lab.actors.values().next().value;
      const target = new C.Vec3(
        ports.x ?? s.targetX ?? actor?.state.body.position.x ?? 0,
        ports.y ?? s.targetY ?? 2,
        ports.z ?? s.targetZ ?? actor?.state.body.position.z ?? 0,
      );
      const d = b.vectorToLocalFrame(target.vsub(b.position)),
        yaw = Math.atan2(-d.x, -d.z);
      state.turretYaw = yaw;
      state.turretPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
  }
}
