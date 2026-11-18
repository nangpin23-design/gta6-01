// Juice: tire smoke, sparks, muzzle flashes, skid marks, floating text and
// the camera shake. Everything here is visual; the simulation never reads it
// back.

export function createEffects() {
  const particles = [];
  const skids = [];
  const floaters = [];
  let shake = 0;

  function addShake(amount) {
    shake = Math.min(18, shake + amount);
  }

  function burst(x, y, count, color, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.6),
        color,
      });
    }
  }

  return {
    particles,
    skids,
    floaters,
    addShake,
    smoke(x, y) {
      burst(x, y, 2, 'rgba(200,200,200,0.5)', 26, 0.7, 7);
    },
    sparks(x, y) {
      burst(x, y, 8, '#ffd34d', 190, 0.35, 3);
    },
    muzzle(x, y, angle) {
      burst(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 4, '#ffe14d', 260, 0.12, 4);
    },
    explosion(x, y) {
      burst(x, y, 26, '#ff7a2e', 260, 0.8, 9);
      burst(x, y, 18, '#3a3a3a', 90, 1.4, 12);
      burst(x, y, 10, '#ffe14d', 320, 0.4, 5);
      addShake(14);
    },
    skidMark(x, y, angle) {
      skids.push({ x, y, angle, life: 6 });
      if (skids.length > 220) skids.splice(0, skids.length - 220);
    },
    floater(x, y, text, color) {
      floaters.push({ x, y, text, color: color || '#f2ead8', life: 1.4 });
    },
    update(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.2 * dt;
        p.vy *= 1 - 2.2 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        const f = floaters[i];
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }
    },
    shakeOffset() {
      if (shake <= 0.2) return { x: 0, y: 0 };
      return {
        x: (Math.random() - 0.5) * shake,
        y: (Math.random() - 0.5) * shake,
      };
    },
  };
}
