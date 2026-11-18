// NEON TIDE — cars: the player's ride, parked cars to steal, and the traffic
// flowing through Calder Bay. Every car gets a unique id from a counter that is
// incremented on every creation, so identity checks (one cop per car, one
// mission per car) never collide.

import { CAR, COLORS, HORIZONTAL_ROADS, ROAD_W, TRAFFIC, VERTICAL_ROADS, WATER_Y, WORLD_H, WORLD_W } from './config.js';

let nextCarId = 1;

export class Car {
  constructor(x, y, angle, color, kind = 'traffic') {
    this.id = nextCarId;
    nextCarId += 1;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.color = color;
    this.kind = kind; // 'traffic' | 'parked' | 'player' | 'cop'
    this.steer = 0;
    this.dead = false;
    this.flash = 0;
  }

  get radius() {
    return CAR.radius;
  }

  // Arcade driving: accelerate along the heading, steer harder at speed, and
  // roll to a stop when no pedal is pressed. The speed is the scalar along the
  // heading, so acceleration always moves the car — it can never be discarded
  // by rebuilding the velocity from the previous frame's speed.
  drive(dt, throttle, steerInput, handbrake) {
    if (throttle > 0) this.speed += CAR.accel * dt;
    else if (throttle < 0) this.speed -= (this.speed > 0 ? CAR.brake : CAR.accel * 0.55) * dt;
    else this.speed -= Math.sign(this.speed) * 240 * dt;
    if (handbrake) this.speed -= Math.sign(this.speed) * 700 * dt;
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 4 && throttle === 0) this.speed = 0;
    const turn = CAR.turnRate * steerInput * Math.min(1, Math.abs(this.speed) / 140);
    this.angle += turn * dt * (this.speed >= 0 ? 1 : -1);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }
}

export class Traffic {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.spawnAll();
  }

  spawnAll() {
    for (let i = 0; i < TRAFFIC.count; i += 1) this.spawnTrafficCar();
    // Parked cars to steal: tucked against curbs, engines off, doors unlocked.
    for (let i = 0; i < 10; i += 1) {
      const p = this.world.randomRoadPoint(this.rng);
      const vertical = this.rng.chance(0.5);
      const angle = vertical ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
      const off = (ROAD_W / 2 - 14) * this.rng.pick([-1, 1]);
      const x = vertical ? p.x + off : p.x;
      const y = vertical ? p.y : p.y + off;
      if (this.world.isWater(x, y)) continue;
      this.cars.push(new Car(x, y, angle, this.rng.pick(COLORS.carBody), 'parked'));
    }
  }

  spawnTrafficCar() {
    const p = this.world.randomRoadPoint(this.rng);
    const vertical = Math.abs(p.x - this.nearestRoadX(p.x)) < Math.abs(p.y - this.nearestRoadY(p.y));
    const angle = vertical
      ? this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2
      : this.rng.chance(0.5) ? 0 : Math.PI;
    const car = new Car(p.x, p.y, angle, this.rng.pick(COLORS.carBody), 'traffic');
    car.cruise = this.rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.vertical = vertical;
    this.cars.push(car);
  }

  nearestRoadX(x) {
    return VERTICAL_ROADS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  }

  nearestRoadY(y) {
    return HORIZONTAL_ROADS.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      // Cruise along its road. A car on a vertical street turns around at the
      // harbour instead of driving into the sea; a car on a horizontal street
      // wraps around the far edge so traffic never ends.
      const speed = car.cruise;
      car.x += Math.cos(car.angle) * speed * dt;
      car.y += Math.sin(car.angle) * speed * dt;
      if (car.vertical) {
        if (car.y > WATER_Y - 60 || car.y < 40) {
          car.angle += Math.PI;
          car.y = Math.max(40, Math.min(WATER_Y - 60, car.y));
        }
      } else {
        if (car.x < -60) car.x = WORLD_W + 50;
        if (car.x > WORLD_W + 60) car.x = -50;
      }
      if (car.y < -60) car.y = WORLD_H + 50;
      if (car.y > WORLD_H + 60) car.y = -50;
      // Ease off when a car is right ahead on the same lane.
      for (const other of this.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 26) {
          car.x -= Math.cos(car.angle) * speed * dt * 0.9;
          car.y -= Math.sin(car.angle) * speed * dt * 0.9;
        }
      }
      const fixed = this.world.collideCircle(car.x, car.y, car.radius);
      car.x = fixed.x;
      car.y = fixed.y;
    }
    // Gentle push-apart so cars never overlap each other or the player's car.
    const all = this.cars.filter((c) => !c.dead);
    if (playerCar) all.push(playerCar);
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius - 4;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }

  nearestParked(x, y, maxDist = 60) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.kind !== 'parked' || car.dead) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  remove(car) {
    car.dead = true;
    this.cars = this.cars.filter((c) => c !== car);
  }
}
