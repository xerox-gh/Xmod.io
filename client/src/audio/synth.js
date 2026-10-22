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
    gain.connect(c.destination);
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
    oscillator.onended = () => {
      this.voices--;
      oscillator.disconnect();
      gain.disconnect();
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
    gain.connect(c.destination);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      this.voices--;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  impact(speed, distance = 0) {
    const now = performance.now();
    if (now - this.lastImpact < 65 || speed < 2) return;
    this.lastImpact = now;
    const volume = Math.min(0.32, speed * 0.018) / (1 + distance * 0.15);
    this.tone(140 + Math.random() * 100, 0.1, 'triangle', volume, 40);
    this.hiss(0.08, volume * 0.8, 1300);
  }
  event(e, distance) {
    const attenuation = 1 / (1 + distance * 0.1);
    if (e.type === 'shot') {
      this.tone(e.weapon === 'shotgun' ? 75 : 210, 0.13, 'sawtooth', 0.11 * attenuation, 35);
      this.hiss(e.weapon === 'shotgun' ? 0.25 : 0.12, 0.25 * attenuation, 2200);
    }
    if (e.type === 'explosion') {
      this.tone(85, 0.6, 'sine', 0.4 * attenuation, 15);
      this.hiss(0.7, 0.5 * attenuation, 800);
    }
    if (e.type === 'spawn') this.tone(300, 0.12, 'sine', 0.05 * attenuation, 750);
    if (e.type === 'reload') this.tone(700, 0.05, 'square', 0.025, 400);
  }
}
