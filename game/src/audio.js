// SUNSET RUN — procedural sound, no audio files.
//
// Every sound is synthesized with WebAudio: a two-oscillator engine hum that
// follows the car's speed, a two-tone police siren whose volume follows the
// nearest interceptor, a noise-burst gunshot, and little sine-note jingles
// for pickups and mission paydays. The context starts on the first user
// gesture, since browsers forbid sound before one.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };
}

function ensureCtx(audio) {
  if (audio.ctx) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    return true;
  } catch {
    return false;
  }
}

function noiseBuffer(audio, seconds) {
  const len = Math.floor(audio.ctx.sampleRate * seconds);
  const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(audio, freq, dur, type, vol, when) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + (when || 0);
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function makeAudioApi(audio) {
  return {
    // Call on the first click or keypress: browsers need a gesture.
    unlock() {
      if (ensureCtx(audio) && audio.ctx.state === 'suspended') audio.ctx.resume();
    },
    setMuted(muted) {
      audio.muted = muted;
      if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
    },
    shot() {
      if (!ensureCtx(audio) || audio.muted) return;
      const src = audio.ctx.createBufferSource();
      src.buffer = noiseBuffer(audio, 0.12);
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    },
    crash() {
      if (!ensureCtx(audio) || audio.muted) return;
      const src = audio.ctx.createBufferSource();
      src.buffer = noiseBuffer(audio, 0.25);
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(0.6, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    },
    pickup() {
      blip(audio, 660, 0.12, 'sine', 0.25);
      blip(audio, 990, 0.18, 'sine', 0.25, 0.09);
    },
    mission() {
      blip(audio, 523, 0.14, 'triangle', 0.3);
      blip(audio, 659, 0.14, 'triangle', 0.3, 0.11);
      blip(audio, 784, 0.22, 'triangle', 0.3, 0.22);
    },
    missionFail() {
      blip(audio, 330, 0.2, 'sawtooth', 0.18);
      blip(audio, 220, 0.3, 'sawtooth', 0.18, 0.16);
    },
    sirenBlip() {
      blip(audio, 880, 0.15, 'square', 0.12);
      blip(audio, 660, 0.15, 'square', 0.12, 0.14);
    },
    // The engine hum follows the player's car; call every frame with speed.
    engine(speed, maxSpeed) {
      if (!ensureCtx(audio)) return;
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc2 = audio.ctx.createOscillator();
        audio.engineGain = audio.ctx.createGain();
        audio.engineOsc.type = 'sawtooth';
        audio.engineOsc2.type = 'square';
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(audio.engineGain);
        audio.engineOsc2.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
        audio.engineOsc2.start();
      }
      const ratio = Math.min(1, Math.abs(speed) / Math.max(1, maxSpeed));
      const target = audio.muted ? 0 : 0.03 + ratio * 0.06;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
      audio.engineOsc.frequency.setTargetAtTime(55 + ratio * 130, audio.ctx.currentTime, 0.08);
      audio.engineOsc2.frequency.setTargetAtTime(28 + ratio * 65, audio.ctx.currentTime, 0.08);
    },
    // The siren wails while any interceptor is near; call every frame.
    siren(nearestDist) {
      if (!ensureCtx(audio)) return;
      if (!audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenOsc.type = 'square';
        audio.sirenOsc.frequency.value = 750;
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
      }
      const near = nearestDist !== null && nearestDist < 800;
      const vol = audio.muted || !near ? 0 : Math.max(0, 0.09 * (1 - nearestDist / 800));
      audio.sirenGain.gain.setTargetAtTime(vol, audio.ctx.currentTime, 0.15);
      audio.sirenTimer += 1 / 60;
      if (audio.sirenTimer > 0.42) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.setTargetAtTime(audio.sirenHigh ? 950 : 700, audio.ctx.currentTime, 0.05);
      }
    },
  };
}
