// SUNSET RUN — cars: creation, arcade driving, traffic.
//
// A car is a circle with a heading and a speed. Driving is deliberately
// arcadey: throttle builds speed, steering turns harder the faster the car
// goes, the handbrake slides the tail out. Traffic cars are the same cars
// with a simple brain: follow the road grid toward a waypoint, and when they
// arrive, pick another one.

import { CAR_MODELS } from './config.js';
import { nearestRoadPoint, randomRoadPoint, resolveCircle } from './world.js';
import { pick } from './random.js';

let nextCarId = 1;

export function createCar(model, x, y, angle, color) {
  const spec = CAR_MODELS[model];
  const id = nextCarId;
  nextCarId += 1;
  return {
    id,
    kind: model === 'interceptor' ? 'police' : 'traffic',
    model,
    name: spec.name,
    x,
    y,
    angle,
    speed: 0,
    color: color ?? spec.color,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    turn: spec.turn,
    hp: spec.hp,
    maxHp: spec.hp,
    driver: 'none',
    siren: false,
    target: null,
    stuck: 0,
    length: 34,
    width: 18,
    radius: 16,
  };
}

// One step of arcade driving. controls: {throttle -1..1, steer -1..1, brake 0..1}.
export function applyCarControls(state, car, controls, dt) {
  const maxReverse = 130;
  if (controls.throttle > 0) {
    car.speed += car.accel * controls.throttle * dt;
  } else if (controls.throttle < 0) {
    car.speed += car.accel * controls.throttle * dt * 0.6;
  }
  if (controls.brake > 0) {
    car.speed -= 720 * controls.brake * dt;
    if (car.speed < 0) car.speed = 0;
  }
  if (controls.throttle === 0 && controls.brake === 0) {
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > car.topSpeed) car.speed = car.topSpeed;
  if (car.speed < -maxReverse) car.speed = -maxReverse;

  const direction = car.speed >= 0 ? 1 : -1;
  const grip = Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  car.angle += controls.steer * car.turn * grip * direction * dt;
  // The handbrake (brake while moving) slides the tail: extra turn, less grip.
  if (controls.brake > 0 && Math.abs(car.speed) > 120) {
    car.angle += controls.steer * 1.1 * direction * dt;
    car.speed *= 1 - 0.35 * dt;
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  resolveCircle(state.city, car);
}

// Steering that follows the road grid toward (tx, ty): drive along the
// nearest road first, then turn onto the road that leads to the target, so a
// car never cuts across a block into a building.
export function gridDriveControls(state, car, tx, ty) {
  const road = nearestRoadPoint(state.city, tx, ty);
  const dx = road.x - car.x;
  const dy = road.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) return { throttle: 0.4, steer: 0, brake: 0 };
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const throttle = Math.abs(car.speed) < car.topSpeed * 0.75 ? 1 : 0.3;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.2)), brake: 0 };
}

// Fill the streets with traffic: cars parked on roads, each with a waypoint.
export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.rng, state.city);
    const model = pick(state.rng, ['cometa', 'falco', 'vela', 'toro', 'bisonte']);
    const car = createCar(model, p.x, p.y, state.rng() * Math.PI * 2);
    car.driver = 'traffic';
    car.target = randomRoadPoint(state.rng, state.city);
    state.cars.push(car);
  }
}

// Traffic brains: drive to the waypoint, then pick a new one. A car that has
// not moved in a while backs out and re-aims, so a jam never lasts.
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.hp <= 0) continue;
    if (!car.target) car.target = randomRoadPoint(state.rng, state.city);
    const dx = car.target.x - car.x;
    const dy = car.target.y - car.y;
    if (Math.hypot(dx, dy) < 30) {
      car.target = randomRoadPoint(state.rng, state.city);
      continue;
    }
    if (Math.abs(car.speed) < 25) {
      car.stuck += dt;
      if (car.stuck > 1.2) {
        car.stuck = -0.5;
        car.speed = -120;
      }
    } else {
      car.stuck = Math.max(0, car.stuck - dt);
    }
    if (car.stuck < 0) {
      car.stuck += dt;
      applyCarControls(state, car, { throttle: 0, steer: 1, brake: 0 }, dt);
      continue;
    }
    const controls = gridDriveControls(state, car, car.target.x, car.target.y);
    applyCarControls(state, car, controls, dt);
  }
  // Push overlapping cars apart so traffic never fuses into one blob.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius - 4;
      if (d > 0 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}
