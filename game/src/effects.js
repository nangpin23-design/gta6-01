// SUNSET RUN — juice: particles, floating text, shake and skid marks.
//
// Every effect is a short-lived record in the state's effects object. The
// update step ages them out; the render step draws them. Nothing here touches
// the simulation — effects only show what already happened.

export function createEffects() {
  return {
    particles: [],
    floaters: [],
    skids: [],
    // The current camera-shake magnitude, in pixels. (Named shakeAmount, not
    // shake: the API method is called shake, and sharing the key would let
    // the method overwrite the number — or the number overwrite the method.)
    shakeAmount: 0,
  };
}

function addParticle(fx, x, y, vx, vy, life, color, size) {
  fx.particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
}

export function makeEffectsApi(fx) {
  return {
    // A burst of sparks, e.g. a bullet hit or a hard crash.
    sparks(x, y) {
      for (let i = 0; i < 10; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 160;
        addParticle(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35, '#ffd76b', 3);
      }
    },
    // A muzzle flash: a few bright flecks along the shot's direction.
    muzzle(x, y, angle) {
      for (let i = 0; i < 5; i += 1) {
        const a = angle + (Math.random() - 0.5) * 0.5;
        const s = 260 + Math.random() * 160;
        addParticle(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.12, '#fff2b0', 2);
      }
    },
    // The bullet's path, drawn as a fading line for one frame's worth of time.
    tracer(x1, y1, x2, y2) {
      fx.particles.push({ x: x1, y: y1, x2, y2, life: 0.08, maxLife: 0.08, tracer: true });
    },
    // A car going up: orange fire and grey smoke.
    explosion(x, y) {
      for (let i = 0; i < 22; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 220;
        addParticle(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.7, i % 2 ? '#ff7a3c' : '#5a5a5a', 4);
      }
      fx.shakeAmount = Math.max(fx.shakeAmount, 12);
    },
    // Exhaust puffs behind a moving car.
    exhaust(x, y) {
      addParticle(fx, x, y, (Math.random() - 0.5) * 20, 30 + Math.random() * 20, 0.5, '#9a9a9a', 3);
    },
    // A word that rises and fades above an event: +$150, WANTED 3★, CRATE.
    floater(x, y, text, color) {
      fx.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4, maxLife: 1.4 });
    },
    // A jolt to the camera, in pixels; decays on its own.
    shake(amount) {
      fx.shakeAmount = Math.max(fx.shakeAmount, amount);
    },
    // A dark skid segment under a handbraking car.
    skid(x, y, angle) {
      fx.skids.push({ x, y, angle, life: 2.5, maxLife: 2.5 });
      if (fx.skids.length > 120) fx.skids.shift();
    },
  };
}

export function updateEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const pt = fx.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    if (!pt.tracer) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2.2 * dt;
      pt.vy *= 1 - 2.2 * dt;
    }
  }
  for (let i = fx.floaters.length - 1; i >= 0; i -= 1) {
    const f = fx.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) fx.floaters.splice(i, 1);
  }
  for (let i = fx.skids.length - 1; i >= 0; i -= 1) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
  fx.shakeAmount = Math.max(0, fx.shakeAmount - 26 * dt);
}
