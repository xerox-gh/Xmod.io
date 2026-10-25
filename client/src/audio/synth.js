import { GUN_SOUNDS } from './weapon-sounds.js';
// Tiny WebAudio synthesizer. Buffers and voices are bounded; no downloaded sounds.
export class AudioSynth {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.voices = 0;
    this.lastImpact = 0;
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  output(gain) {
    const c = this.context;
    if (!this.position) {
      gain.connect(c.destination);
      return null;
    }
    const panner = c.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 5;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;
    panner.positionX.value = this.position[0];
    panner.positionY.value = this.position[1];
    panner.positionZ.value = this.position[2];
    gain.connect(panner);
    panner.connect(c.destination);
    return panner;
  }
  listener(position, forward, up) {
    const l = this.context?.listener;
    if (!l) return;
    for (const [prefix, v] of [
      ['position', position],
      ['forward', forward],
      ['up', up],
    ])
      for (const [i, axis] of ['X', 'Y', 'Z'].entries())
        if (l[prefix + axis]) l[prefix + axis].value = v[i];
  }
  tone(freq, duration = 0.1, type = 'sine', volume = 0.1, end = 40) {
    const c = this.context;
    if (!c || c.state !== 'running' || this.voices >= 24 || !this.settings.volume) return;
    this.voices++;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, c.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), c.currentTime + duration);
    gain.gain.setValueAtTime(volume * this.settings.volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    oscillator.connect(gain);
    const panner = this.output(gain);
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
    oscillator.onended = () => {
      this.voices--;
      oscillator.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }
  hiss(duration, volume, cutoff) {
    const c = this.context;
    if (!c || c.state !== 'running' || this.voices >= 24 || !this.settings.volume) return;
    this.voices++;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume * this.settings.volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    const panner = this.output(gain);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      this.voices--;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
  }
  impact(speed, position, material = 'box') {
    this.position = Array.isArray(position) ? position : null;
    const now = performance.now();
    if (now - this.lastImpact < 65 || speed < 2) return;
    this.lastImpact = now;
    const volume = Math.min(0.32, speed * 0.018);
    const metal = ['barrel', 'explosive_barrel', 'pipe', 'tank', 'car', 'wheel'].includes(material);
    this.tone(
      (metal ? 420 : 110) + Math.random() * 100,
      metal ? 0.18 : 0.1,
      metal ? 'sine' : 'triangle',
      volume,
      metal ? 180 : 40,
    );
    this.hiss(0.08, volume * 0.8, 1300);
  }
  event(e) {
    if (e.type === 'impact') {
      this.impact(e.speed, e.p, e.material);
      return;
    }
    this.position = e.p || e.entity?.p || null;
    if (e.type === 'wireTone') this.tone(e.frequency, 0.17, e.waveform, 0.04, e.frequency);
    const attenuation = 1;
    if (e.type === 'targetHit') this.tone(950, 0.16, 'sine', 0.12, 480);
    if (e.type === 'dummyHit') this.hiss(0.06, 0.12, 700);
    if (e.type === 'bounce') this.tone(180, 0.24, 'triangle', 0.14, 700);
    if (e.type === 'flame') this.hiss(0.16, 0.08, 1600);
    if (e.type === 'shot') {
      const [pitch, tail, cutoff, volume] = GUN_SOUNDS[e.weapon] || GUN_SOUNDS.pistol;
      this.tone(pitch, Math.min(0.22, tail), 'sawtooth', volume * 0.45, 35);
      this.hiss(tail, volume, cutoff);
    }
    if (e.type === 'explosion') {
      this.tone(85, 0.6, 'sine', 0.4 * attenuation, 15);
      this.hiss(0.7, 0.5 * attenuation, 800);
    }
    if (e.type === 'spawn') this.tone(300, 0.12, 'sine', 0.05 * attenuation, 750);
    if (e.type === 'reload') this.tone(700, 0.05, 'square', 0.025, 400);
  }
}
