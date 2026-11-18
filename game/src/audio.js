// NEON TIDE — all sound is synthesized with WebAudio: no audio files, no
// network. Engine hum follows speed, the siren wails in two tones, gunshots and
// crashes are filtered noise, mission events get a little arpeggio.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const engineGain = this.ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(this.ctx.destination);
    const engineOsc = this.ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc.connect(engineGain);
    engineOsc.start();
    this.engineOsc = engineOsc;
    this.engineGain = engineGain;
    const sirenGain = this.ctx.createGain();
    sirenGain.gain.value = 0;
    sirenGain.connect(this.ctx.destination);
    const sirenOsc = this.ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenOsc.connect(sirenGain);
    sirenOsc.start();
    this.sirenOsc = sirenOsc;
    this.sirenGain = sirenGain;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  setEngine(speedRatio) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.02 + speedRatio * 0.05, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.1);
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    if (!on || this.muted) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this.sirenTimer += dt;
    const high = Math.floor(this.sirenTimer / 0.42) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(high ? 760 : 540, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.028, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur, type = 'sine', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, cutoff, vol = 0.16) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
  }

  shot() {
    this.noiseBurst(0.09, 2400, 0.2);
    this.blip(180, 0.07, 'square', 0.05);
  }

  crash() {
    this.noiseBurst(0.25, 500, 0.22);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.09);
    setTimeout(() => this.blip(990, 0.12, 'sine', 0.09), 70);
  }

  sting() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.1), i * 90));
  }

  busted() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.3, 'triangle', 0.1), i * 140));
  }
}
