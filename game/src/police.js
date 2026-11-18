// NEON TIDE — the wanted system and Calder PD. Heat rises with every crime and
// cools only after a clean stretch; stars follow heat, and each star puts one
// more interceptor on the road. Interceptors ram the player's car, and when the
// player is on foot they drop a foot cop who arrests on touch.

import { CAR, COLORS, WANTED } from './config.js';
import { Car } from './vehicles.js';

export class FootCop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.speed = 265;
    this.dead = false;
    this.angle = 0;
  }
}

export class Police {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.heat = 0;
    this.cleanTimer = 0;
    this.interceptors = [];
    this.footCops = [];
    this.spawnTimer = 0;
  }

  get stars() {
    const t = WANTED.starAt;
    if (this.heat >= t[5]) return 5;
    if (this.heat >= t[4]) return 4;
    if (this.heat >= t[3]) return 3;
    if (this.heat >= t[2]) return 2;
    if (this.heat >= t[1]) return 1;
    return 0;
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    this.cleanTimer = 0;
  }

  clearHeat() {
    this.heat = 0;
    this.interceptors = [];
    this.footCops = [];
  }

  update(dt, player, onRam) {
    // Heat cools only after a clean stretch with no new crime: a fresh crime
    // always counts, even at zero stars, so the first star can be earned.
    this.cleanTimer += dt;
    if (this.cleanTimer >= WANTED.cleanSeconds && this.heat > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
    }
    const want = Math.min(this.stars, WANTED.maxInterceptors);
    this.spawnTimer -= dt;
    if (this.interceptors.length < want && this.spawnTimer <= 0) {
      this.spawnInterceptor(player);
      this.spawnTimer = 2.2;
    }
    if (this.interceptors.length > want) {
      this.interceptors.splice(want).forEach((c) => {
        c.dead = true;
      });
    }
    this.updateInterceptors(dt, player, onRam);
    this.updateFootCops(dt, player);
  }

  spawnInterceptor(player) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = 620;
    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;
    x = Math.max(60, Math.min(2340, x));
    y = Math.max(60, Math.min(1740, y));
    const car = new Car(x, y, Math.atan2(player.y - y, player.x - x), COLORS.copBlue, 'cop');
    car.deployedFoot = false;
    this.interceptors.push(car);
  }

  updateInterceptors(dt, player, onRam) {
    for (const car of this.interceptors) {
      if (car.dead) continue;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const dist = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 420 ? CAR.maxSpeed * 0.94 : CAR.maxSpeed * 0.72;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 1.6 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = this.world.collideCircle(car.x, car.y, car.radius);
      car.x = fixed.x;
      car.y = fixed.y;
      // Ram the player's car, or drop a foot cop when the player is on foot.
      if (player.inCar) {
        if (dist < car.radius + player.inCar.radius + 6 && Math.abs(car.speed) > 200) {
          if (onRam) onRam(car);
        }
      } else if (dist < 150 && !car.deployedFoot) {
        car.deployedFoot = true;
        this.footCops.push(new FootCop(car.x + 20, car.y + 10));
      }
    }
    this.interceptors = this.interceptors.filter((c) => !c.dead);
  }

  updateFootCops(dt, player) {
    for (const cop of this.footCops) {
      if (cop.dead) continue;
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const dist = Math.hypot(dx, dy) || 1;
      cop.angle = Math.atan2(dy, dx);
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
      const fixed = this.world.collideCircle(cop.x, cop.y, cop.radius);
      cop.x = fixed.x;
      cop.y = fixed.y;
    }
    this.footCops = this.footCops.filter((c) => !c.dead);
  }

  // A foot cop close enough to grab the player. Returns the cop, or null.
  arrestCheck(player) {
    if (player.inCar) return null;
    for (const cop of this.footCops) {
      if (cop.dead) continue;
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < cop.radius + player.radius + 2) {
        return cop;
      }
    }
    return null;
  }

  // Bullets and punches can drop a foot cop; it costs heat.
  hitFootCop(x, y, radius, damage) {
    for (const cop of this.footCops) {
      if (cop.dead) continue;
      if (Math.hypot(cop.x - x, cop.y - y) < cop.radius + radius) {
        cop.dead = true;
        this.addHeat(WANTED.heatCopDown);
        return cop;
      }
    }
    return null;
  }
}
