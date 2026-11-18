// NEON TIDE — juice: sparks, smoke, muzzle flashes, floating cash text, and
// screen shake. The shake strength lives in a field called shakeAmount, and the
// method that adds to it is addShake: a field and a method must never share one
// name, or the first shake overwrites the method and the loop dies.

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.shakeAmount = 0;
  }

  addShake(amount) {
    this.shakeAmount = Math.min(16, this.shakeAmount + amount);
  }

  burst(x, y, color, count = 14, speed = 260) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  smoke(x, y) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: -30 - Math.random() * 30,
      life: 0.9,
      maxLife: 0.9,
      size: 6 + Math.random() * 6,
      color: 'rgba(120, 120, 130, 0.5)',
    });
  }

  muzzle(x, y, angle) {
    this.particles.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 320,
      vy: Math.sin(angle) * 320,
      life: 0.12,
      maxLife: 0.12,
      size: 4,
      color: '#ffe066',
    });
  }

  floatText(x, y, text, color = '#ffd23b') {
    this.texts.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.y -= 34 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shakeAmount = Math.max(0, this.shakeAmount - 26 * dt);
  }

  shakeOffset() {
    if (this.shakeAmount <= 0.2) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeAmount,
      y: (Math.random() - 0.5) * this.shakeAmount,
    };
  }
}
