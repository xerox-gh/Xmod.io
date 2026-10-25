import * as T from 'three';
import { PROPS } from '../../../shared/props.js';
import { makePropMesh, disposeProp } from '../props/meshes.js';
import { downloadBlob, downloadJSON } from '../builds/files.js';
const finite = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const transform = (p, q) =>
  finite(p, 3) &&
  p.every((v) => Math.abs(v) <= 1000) &&
  finite(q, 4) &&
  Math.hypot(...q) > 0.5 &&
  Math.hypot(...q) < 1.5;
export class Recorder {
  constructor(game) {
    this.game = game;
    this.recording = false;
    this.playing = false;
    this.data = null;
    this.ghosts = new Map();
  }
  screenshot() {
    const g = this.game;
    g.render();
    g.canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `xmod-${Date.now()}.png`);
    }, 'image/png');
    g.toast('Screenshot saved');
  }
  toggle() {
    if (this.playing) this.stopPlayback();
    this.recording = !this.recording;
    if (this.recording) {
      this.data = {
        format: 'xmod-replay',
        version: 1,
        map: this.game.sim.world.map.id,
        entities: {},
        frames: [],
      };
      this.time = 0;
      this.clock = 1;
    }
    this.game.toast(
      this.recording
        ? 'Replay recording · up to 30 seconds'
        : 'Replay ready · save or play it from B',
    );
  }
  export() {
    if (!this.data?.frames.length) throw new Error('Record a replay first');
    downloadJSON(this.data, 'xmod-replay.json');
  }
  async import(file) {
    if (!file) return;
    if (file.size > 16e6) throw new Error('Replay file is too large');
    const d = JSON.parse(await file.text());
    if (
      d.format !== 'xmod-replay' ||
      d.version !== 1 ||
      d.map !== this.game.sim.world.map.id ||
      !Array.isArray(d.frames) ||
      d.frames.length > 302 ||
      !d.entities ||
      Object.keys(d.entities).length > 1024
    )
      throw new Error('Invalid replay, or switch to its map first');
    for (const [id, e] of Object.entries(d.entities))
      if (
        !/^[\w-]{1,64}$/.test(id) ||
        !Object.hasOwn(PROPS, e.type) ||
        !/^#[\da-f]{6}$/i.test(e.color) ||
        !Number.isFinite(e.scale) ||
        e.scale < 0.35 ||
        e.scale > 4
      )
        throw new Error('Invalid replay prop');
    let previous = -1;
    for (const f of d.frames) {
      if (
        !Number.isFinite(f.t) ||
        f.t < previous ||
        f.t > 31 ||
        !transform(f.camera?.p, f.camera?.q) ||
        !Array.isArray(f.props) ||
        f.props.length > 200 ||
        f.props.some(
          (p) =>
            !Object.hasOwn(d.entities, p.id) ||
            !transform(p.p, p.q) ||
            (p.scale !== undefined &&
              (!Number.isFinite(p.scale) || p.scale < 0.35 || p.scale > 4)) ||
            (p.color !== undefined && !/^#[\da-f]{6}$/i.test(p.color)),
        )
      )
        throw new Error('Invalid replay frame');
      previous = f.t;
    }
    this.stopPlayback();
    this.recording = false;
    this.data = d;
    this.game.toast('Replay loaded');
  }
  play() {
    if (!this.data?.frames.length) throw new Error('Record or load a replay first');
    if (this.data.map !== this.game.sim.world.map.id)
      throw new Error('Switch to the replay’s map first');
    this.stopPlayback();
    this.recording = false;
    this.playing = true;
    this.playTime = 0;
    let lights = 0;
    for (const [id, e] of Object.entries(this.data.entities)) {
      const mesh = makePropMesh(e.type, e.color);
      mesh.scale.setScalar(e.scale);
      mesh.traverse((c) => {
        if (c.userData.lamp) c.visible = lights++ < 8;
      });
      mesh.visible = false;
      this.game.view.scene.add(mesh);
      this.ghosts.set(id, mesh);
    }
    this.game.toast('Replay playing · B to stop');
  }
  stopPlayback() {
    this.playing = false;
    for (const mesh of this.ghosts.values()) {
      this.game.view.scene.remove(mesh);
      disposeProp(mesh);
    }
    this.ghosts.clear();
    for (const mesh of this.game.props.meshes.values()) mesh.visible = true;
  }
  video() {
    if (this.media?.state === 'recording') {
      this.media.stop();
      return;
    }
    if (!this.game.canvas.captureStream || typeof MediaRecorder === 'undefined')
      throw new Error('Video recording is unavailable in this browser');
    const stream = this.game.canvas.captureStream(30),
      chunks = [];
    let bytes = 0;
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    if (!type) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('This browser cannot record WebM; use replay recording');
    }
    this.media = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3e6 });
    this.media.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > 24e6 && this.media.state === 'recording') this.media.stop();
      }
    };
    this.media.onstop = () => {
      clearTimeout(this.videoTimer);
      downloadBlob(new Blob(chunks, { type }), 'xmod-video.webm');
      stream.getTracks().forEach((t) => t.stop());
      this.game.toast('Video saved');
    };
    this.media.start(1000);
    this.videoTimer = setTimeout(() => {
      if (this.media.state === 'recording') this.media.stop();
    }, 30000);
    this.game.toast('Video recording · press again to stop · 30s maximum');
  }
  update(dt) {
    const g = this.game;
    if (this.recording) {
      this.time += dt;
      this.clock += dt;
      if (this.clock >= 0.1) {
        this.clock = 0;
        const props = [];
        for (const e of g.sim.entities.values()) {
          this.data.entities[e.id] ??= { type: e.type, color: e.color, scale: e.scale };
          props.push({
            id: e.id,
            p: e.body.position.toArray(),
            q: e.body.quaternion.toArray(),
            color: e.color,
            scale: e.scale,
          });
        }
        this.data.frames.push({
          t: this.time,
          props,
          camera: { p: g.view.camera.position.toArray(), q: g.view.camera.quaternion.toArray() },
        });
      }
      if (this.time >= 30) {
        this.recording = false;
        g.toast('30-second replay ready');
      }
    }
    if (!this.playing) return;
    this.playTime += dt;
    const frames = this.data.frames;
    let index = frames.findIndex((f) => f.t >= this.playTime);
    if (index < 0) {
      this.stopPlayback();
      return;
    }
    const a = frames[Math.max(0, index - 1)],
      b = frames[index],
      blend = Math.max(0, Math.min(1, (this.playTime - a.t) / (b.t - a.t || 1))),
      next = new Map(b.props.map((p) => [p.id, p]));
    for (const mesh of g.props.meshes.values()) mesh.visible = false;
    for (const mesh of this.ghosts.values()) mesh.visible = false;
    for (const p of a.props) {
      const mesh = this.ghosts.get(p.id),
        n = next.get(p.id) || p;
      mesh.visible = true;
      mesh.scale.setScalar(p.scale || this.data.entities[p.id].scale);
      if (p.color)
        mesh.traverse((c) => {
          if (c.userData.paint) c.material.color.set(p.color);
        });
      mesh.position.fromArray(p.p).lerp(new T.Vector3(...n.p), blend);
      mesh.quaternion.fromArray(p.q).slerp(new T.Quaternion(...n.q), blend);
    }
    g.view.camera.position.fromArray(a.camera.p).lerp(new T.Vector3(...b.camera.p), blend);
    g.view.camera.quaternion.fromArray(a.camera.q).slerp(new T.Quaternion(...b.camera.q), blend);
  }
}
