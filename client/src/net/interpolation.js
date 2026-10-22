import * as T from 'three';
// Display remote objects 100 ms behind the authority to absorb network jitter.
export class Track {
  constructor() {
    this.samples = [];
  }
  push(sample, now = performance.now()) {
    this.samples.push({ ...sample, t: now });
    if (this.samples.length > 8) this.samples.shift();
  }
  sample(now = performance.now(), delay = 100) {
    if (!this.samples.length) return null;
    const time = now - delay;
    while (this.samples.length > 2 && this.samples[1].t < time) this.samples.shift();
    const a = this.samples[0],
      b = this.samples[1] || a;
    const t = Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t || 1)));
    return {
      p: new T.Vector3(...a.p).lerp(new T.Vector3(...b.p), t),
      q: a.q ? new T.Quaternion(...a.q).slerp(new T.Quaternion(...b.q), t) : null,
      yaw:
        a.yaw === undefined
          ? 0
          : a.yaw + Math.atan2(Math.sin((b.yaw || 0) - a.yaw), Math.cos((b.yaw || 0) - a.yaw)) * t,
    };
  }
}
