import { captureBuild, connectedEntities, restoreBuild } from '../../../shared/builds.js';
import * as C from 'cannon-es';
export class Puppets {
  constructor(lab) {
    this.lab = lab;
    this.recording = false;
    this.data = null;
    this.loops = [];
  }
  record() {
    const g = this.lab.game;
    if (g.net.connected) throw new Error('Puppeteer recording is a local feature');
    const target = this.lab.target || g.props.aim(g.view.camera)?.id,
      ids = g.selection.ids.size
        ? [...g.selection.ids]
        : target
          ? connectedEntities(g.sim, target)
          : [];
    if (!ids.length) throw new Error('Aim at a dummy or select props first');
    this.data = { format: 'xmod-puppet', build: captureBuild(g.sim, ids), frames: [], duration: 5 };
    this.ids = ids;
    this.time = this.clock = 0;
    this.recording = true;
    g.resume();
    g.toast('Recording five seconds · move the assembly with the physics gun');
  }
  update(dt) {
    if (!this.recording) return;
    this.time += dt;
    this.clock += dt;
    if (this.clock + 1e-6 >= 0.1) {
      this.clock = Math.max(0, this.clock - 0.1);
      this.data.frames.push({
        t: this.time,
        props: this.ids
          .map((id) => this.lab.game.sim.entities.get(id))
          .filter(Boolean)
          .map((e) => ({ id: e.id, p: e.body.position.toArray(), q: e.body.quaternion.toArray() })),
      });
    }
    if (this.time >= 5) {
      this.recording = false;
      this.lab.game.toast('Puppet clip ready · B → Toybox → Actors → Loop');
    }
  }
  play(data = this.data, clone = false) {
    if (!data?.frames?.length || data.frames.length > 55 || data.format !== 'xmod-puppet')
      throw new Error('Record or load a puppet clip first');
    const g = this.lab.game,
      map = new Map();
    const frames = data.frames.map((f) => {
      if (
        !Number.isFinite(f.t) ||
        f.t < 0 ||
        f.t > 6 ||
        !Array.isArray(f.props) ||
        f.props.length > 200
      )
        throw new Error('Invalid puppet frame');
      return {
        t: f.t,
        props: f.props.map((p) => {
          if (
            !Array.isArray(p.p) ||
            p.p.length !== 3 ||
            !p.p.every((n) => Number.isFinite(n) && Math.abs(n) < 170) ||
            !Array.isArray(p.q) ||
            p.q.length !== 4 ||
            !p.q.every(Number.isFinite) ||
            Math.hypot(...p.q) < 0.5 ||
            Math.hypot(...p.q) > 1.5
          )
            throw new Error('Invalid puppet transform');
          return { ...p, id: map.get(p.id) || p.id };
        }),
      };
    });
    if (clone) {
      const ids = new Set(data.build?.entities?.map((e) => e.id));
      for (const frame of frames)
        for (const p of frame.props)
          if (!ids.has(p.id)) throw new Error('Puppet frame references an unsaved prop');
      const created = restoreBuild(g.sim, data.build, 'local');
      data.build.entities.forEach((e, i) => map.set(e.id, created[i]));
      for (const f of frames)
        for (const p of f.props) {
          if (!map.has(p.id)) throw new Error('Puppet frame references an unsaved prop');
          p.id = map.get(p.id);
        }
    }
    for (const p of frames[0].props) {
      const e = g.sim.entities.get(p.id);
      if (e) {
        e.frozen = true;
        e.behavior.pose = true;
        e.body.type = C.Body.KINEMATIC;
        e.body.mass = 0;
        e.body.updateMassProperties();
      }
    }
    this.loops.push({ frames, time: 0, duration: Math.max(0.1, frames.at(-1).t) });
    if (this.loops.length > 8) this.loops.shift();
    g.toast('Puppet loop playing');
  }
  fixed(dt) {
    for (const loop of this.loops) {
      loop.time = (loop.time + dt) % loop.duration;
      let index = loop.frames.findIndex((f) => f.t >= loop.time);
      if (index < 0) index = loop.frames.length - 1;
      const a = loop.frames[Math.max(0, index - 1)],
        b = loop.frames[index],
        t = Math.max(0, Math.min(1, (loop.time - a.t) / (b.t - a.t || 1)));
      for (const p of a.props) {
        const e = this.lab.game.sim.entities.get(p.id),
          next = b.props.find((n) => n.id === p.id) || p;
        if (e) {
          e.body.position.set(...p.p);
          e.body.position.lerp(new C.Vec3(...next.p), t, e.body.position);
          e.body.quaternion.set(...p.q);
          e.body.quaternion.slerp(new C.Quaternion(...next.q), t, e.body.quaternion);
          e.body.velocity.setZero();
          e.body.angularVelocity.setZero();
          e.body.aabbNeedsUpdate = true;
        }
      }
    }
  }
  stop() {
    for (const loop of this.loops)
      for (const p of loop.frames[0].props) {
        const e = this.lab.game.sim.entities.get(p.id);
        if (e) {
          e.frozen = false;
          e.behavior.pose = false;
          e.body.type = C.Body.DYNAMIC;
          this.lab.game.sim.lab.configure(e);
          e.body.wakeUp();
        }
      }
    this.loops = [];
  }
}
