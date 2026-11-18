// NEON TIDE — Rook Delgado, on foot and behind the wheel. On foot he walks,
// runs, punches and shoots his pistol at the mouse; in a car he drives it, and
// stepping out leaves the car where it stands.

import { CAR, KEYS, PLAYER } from './config.js';
import { Car } from './vehicles.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.hp = PLAYER.maxHp;
    this.cash = 0;
    this.ammo = PLAYER.pistolAmmo;
    this.reloadUntil = 0;
    this.inCar = null;
    this.shotsFired = 0;
    this.punchCooldown = 0;
    this.hurtFlash = 0;
  }

  get radius() {
    return PLAYER.radius;
  }

  get speed() {
    return this.inCar ? Math.abs(this.inCar.speed) : 0;
  }

  update(dt, input, world, camera) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.inCar) {
      this.updateDriving(dt, input, world);
    } else {
      this.updateOnFoot(dt, input, world, camera);
    }
  }

  updateOnFoot(dt, input, world, camera) {
    let mx = 0;
    let my = 0;
    if (input.down(...KEYS.up)) my -= 1;
    if (input.down(...KEYS.down)) my += 1;
    if (input.down(...KEYS.left)) mx -= 1;
    if (input.down(...KEYS.right)) mx += 1;
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      const len = Math.hypot(mx, my);
      const running = input.down('ShiftLeft', 'ShiftRight');
      const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = this.x + (mx / len) * speed * dt;
      const ny = this.y + (my / len) * speed * dt;
      const fixed = world.collideCircle(nx, ny, this.radius);
      this.x = fixed.x;
      this.y = fixed.y;
      this.angle = Math.atan2(my, mx);
    }
    // Aim at the mouse.
    const worldMouse = camera.toWorld(input.mouseX, input.mouseY);
    this.aimAngle = Math.atan2(worldMouse.y - this.y, worldMouse.x - this.x);
  }

  updateDriving(dt, input, world) {
    const car = this.inCar;
    if (car.cruiseSpeed !== undefined) {
      // Staged cars (screenshots) hold a steady cruising speed instead of
      // answering the pedals, so the scene stays composed while the loop runs.
      car.speed += (car.cruiseSpeed - car.speed) * Math.min(1, 3 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = world.collideCircle(car.x, car.y, car.radius);
      car.x = fixed.x;
      car.y = fixed.y;
    } else {
      const throttle = input.down(...KEYS.up) ? 1 : input.down(...KEYS.down) ? -1 : 0;
      const steer = input.down(...KEYS.left) ? -1 : input.down(...KEYS.right) ? 1 : 0;
      const handbrake = input.down(...KEYS.handbrake);
      car.drive(dt, throttle, steer, handbrake);
      const fixed = world.collideCircle(car.x, car.y, car.radius);
      if (fixed.x !== car.x || fixed.y !== car.y) {
        // A hard hit on a building: scrape off speed instead of sticking.
        if (Math.abs(car.speed) > 260) {
          car.speed *= 0.55;
          this.crashed = true;
        }
        car.x = fixed.x;
        car.y = fixed.y;
      }
    }
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
  }

  tryEnterCar(nearbyCar, onSteal) {
    if (!nearbyCar || this.inCar) return false;
    if (nearbyCar.kind === 'parked') {
      nearbyCar.kind = 'player';
      onSteal();
    }
    if (nearbyCar.kind === 'traffic') return false;
    this.inCar = nearbyCar;
    this.x = nearbyCar.x;
    this.y = nearbyCar.y;
    return true;
  }

  exitCar() {
    if (!this.inCar) return null;
    const car = this.inCar;
    this.inCar = null;
    const sideX = Math.cos(this.angle + Math.PI / 2);
    const sideY = Math.sin(this.angle + Math.PI / 2);
    this.x = car.x + sideX * 34;
    this.y = car.y + sideY * 34;
    car.speed = 0;
    return car;
  }

  shoot(now, targetX, targetY) {
    if (this.inCar) return null;
    if (this.ammo <= 0) return null;
    if (now < this.reloadUntil) return null;
    this.ammo -= 1;
    this.shotsFired += 1;
    return {
      x: this.x,
      y: this.y,
      angle: Math.atan2(targetY - this.y, targetX - this.x),
      range: PLAYER.shotRange,
      damage: PLAYER.shotDamage,
    };
  }

  punch(targets) {
    if (this.inCar || this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    const px = this.x + Math.cos(this.aimAngle) * PLAYER.punchRange;
    const py = this.y + Math.sin(this.aimAngle) * PLAYER.punchRange;
    for (const t of targets) {
      if (t.dead) continue;
      if (Math.hypot(t.x - px, t.y - py) < (t.radius || 12) + 16) {
        return t;
      }
    }
    return null;
  }

  startReload(now) {
    if (this.ammo >= PLAYER.pistolAmmo || now < this.reloadUntil) return;
    this.reloadUntil = now + PLAYER.reloadMs;
  }

  finishReload(now) {
    if (this.reloadUntil > 0 && now >= this.reloadUntil) {
      this.ammo = PLAYER.pistolAmmo;
      this.reloadUntil = 0;
    }
  }

  hurt(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 0.25;
  }

  heal(amount) {
    this.hp = Math.min(PLAYER.maxHp, this.hp + amount);
  }

  isDown() {
    return this.hp <= 0;
  }
}
