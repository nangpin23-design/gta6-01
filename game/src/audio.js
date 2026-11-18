// All sound is synthesized with WebAudio at run time — engine hum, sirens,
// gunshots, impacts, pickups and a small music loop. No audio files, no
// network. The context is created on the first user gesture; shot scenes
// never start it.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, seconds, type, volume, slideTo) {
    if (!started || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + seconds);
      }
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + seconds + 0.02);
    } catch {
      // Sound is garnish: a failed blip never stops the game.
    }
  }

  function noiseBurst(seconds, volume, filterFreq) {
    if (!started || muted) return;
    try {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer(seconds);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Sound is garnish.
    }
  }

  const api = {
    /** Call from a click or key press: browsers only allow audio after a gesture. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    engine(speedRatio, inCar) {
      if (!started) return;
      try {
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 900;
          engineGain = context.createGain();
          engineGain.gain.value = 0;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const target = inCar && !muted ? 0.05 + speedRatio * 0.09 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(70 + speedRatio * 160, context.currentTime, 0.08);
      } catch {
        // Sound is garnish.
      }
    },
    siren(on) {
      if (!started) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = context.createGain();
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenOsc.frequency.setValueAtTime(700, context.currentTime);
          sirenOsc.frequency.linearRampToValueAtTime(950, context.currentTime + 0.4);
          sirenOsc.frequency.setValueAtTime(950, context.currentTime + 0.4);
          sirenOsc.frequency.linearRampToValueAtTime(700, context.currentTime + 0.8);
        } else if (!on && sirenOsc) {
          sirenOsc.stop();
          sirenOsc = null;
          sirenGain = null;
        } else if (on && sirenOsc) {
          const now = context.currentTime;
          const phase = (now % 0.8) < 0.4;
          sirenOsc.frequency.setTargetAtTime(phase ? 950 : 700, now, 0.05);
        }
      } catch {
        // Sound is garnish.
      }
    },
    gunshot() {
      noiseBurst(0.12, 0.5, 2600);
      blip(160, 0.08, 'square', 0.25, 60);
    },
    punch() {
      noiseBurst(0.07, 0.3, 500);
    },
    crash(intensity) {
      noiseBurst(0.25, Math.min(0.6, 0.2 + intensity * 0.4), 900);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      setTimeout(() => blip(880, 0.12, 'sine', 0.3), 70);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.22, 'triangle', 0.3), i * 110);
      });
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.3, 'sawtooth', 0.25), i * 160);
      });
    },
    click() {
      blip(440, 0.05, 'square', 0.15);
    },
    /** A quiet bass-and-hat loop, one bar scheduled at a time. */
    startMusic() {
      if (!started || musicTimer) return;
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 49];
      let step = 0;
      musicTimer = setInterval(() => {
        if (muted || !started) return;
        const freq = bass[step % bass.length];
        if (freq) blip(freq, 0.22, 'triangle', 0.16);
        if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
        step += 1;
      }, 190);
    },
  };
  return api;
}
