// Cars: traffic that drives the road grid, parked cars to steal, and the
// arcade driving physics every car shares — player, traffic and police alike.
// A car is driven by controls {throttle, steer, brake}; the traffic AI, the
// police AI and the player's keys each produce those controls, then one
// physics step moves it.

import { CAR, PALETTE, WORLD } from './config.js';
import { nearestRoadPoint, randomRoadPoint, resolveCircle, roadCentres } from './world.js';

let nextId = 1;

export function createCar(kind, x, y, angle, color) {
  return {
    id: nextId,
    kind, // 'traffic' | 'parked' | 'police'
    x, y,
    angle,
    speed: 0,
    color: color || '#c0392b',
    hp: CAR.hp,
    driver: null, // null | 'traffic' | 'player' | 'police'
    dir: 0, // traffic: 0 east, 1 south, 2 west, 3 north
    lane: 10,
    target: null,
    stuck: 0,
    siren: false,
    smoke: 0,
  };
}

// Right-hand traffic: offset the lane to the car's right.
function laneOffset(dir, lane) {
  if (dir === 0) return { x: 0, y: lane };
  if (dir === 1) return { x: -lane, y: 0 };
  if (dir === 2) return { x: 0, y: -lane };
  return { x: lane, y: 0 };
}

function dirAngle(dir) {
  return dir * Math.PI / 2;
}

/** A traffic car's next intersection target, one block ahead on its road. */
function nextIntersectionTarget(car, random) {
  const lines = roadCentres();
  const step = WORLD.block + WORLD.road;
  let nx = car.x;
  let ny = car.y;
  if (car.dir === 0) nx = Math.min(WORLD.size - 30, car.x + step);
  else if (car.dir === 1) ny = Math.min(WORLD.size - 30, car.y + step);
  else if (car.dir === 2) nx = Math.max(30, car.x - step);
  else ny = Math.max(30, car.y - step);
  // Snap the target onto the nearest road centreline.
  car.target = nearestRoadPoint(nx, ny);
  return car.target;
}

/** Spawn the moving traffic on the roads. */
export function spawnTraffic(state) {
  for (let i = 0; i < state.trafficCount; i += 1) {
    const p = randomRoadPoint(state.rng);
    const car = createCar('traffic', p.x, p.y, 0, state.rng.pick(PALETTE.carColors));
    car.dir = state.rng.int(0, 4);
    car.angle = dirAngle(car.dir);
    car.lane = state.rng.chance(0.5) ? 10 : -10;
    car.driver = 'traffic';
    car.speed = state.rng.range(110, 175);
    nextIntersectionTarget(car, state.rng);
    state.cars.push(car);
  }
}

/** Spawn parked cars along the curbs: the ones the player steals. */
export function spawnParked(state) {
  for (let i = 0; i < state.parkedCount; i += 1) {
    const p = randomRoadPoint(state.rng);
    const horizontal = state.rng.chance(0.5);
    const angle = horizontal
      ? (state.rng.chance(0.5) ? 0 : Math.PI)
      : (state.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    // Parked just off the asphalt, on the verge: the traffic lanes run at
    // +/-10 from the centreline, so a car at +/-13 would block a whole lane.
    const off = WORLD.road / 2 + 8;
    let x = p.x;
    let y = p.y;
    if (horizontal) y += state.rng.chance(0.5) ? off : -off;
    else x += state.rng.chance(0.5) ? off : -off;
    state.cars.push(createCar('parked', x, y, angle, state.rng.pick(PALETTE.carColors)));
  }
}

/** Damage a car; a car that dies blows up exactly once. */
export function damageCar(state, car, amount) {
  if (car.hp <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    state.effects.explosion(car.x, car.y);
    state.audio.crash(1);
  }
}

/** The car ahead of `car` in its lane, if one is close. Only cars going the
 * same way count — an oncoming car in the other lane is not an obstacle — and
 * parked cars sit off the road, so they never block a lane. */
function carAhead(state, car, distance) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  let bestD = distance;
  for (const other of state.cars) {
    if (other === car || other.hp <= 0 || other.kind === 'parked') continue;
    if (Math.cos(other.angle - car.angle) <= 0.5) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > bestD) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26) {
      best = other;
      bestD = along;
    }
  }
  return best;
}

/** Steer toward a point, clamped to -1..1. */
function steerToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 3));
}

/** Grid navigation toward a goal point: drive the road grid like traffic, but
 * turn at each intersection toward the goal instead of at random. The car
 * never cuts across a block, so it cannot get pinned against a building the
 * way a straight-line chase can. Used by the police when they are far away. */
export function gridDriveControls(state, car, goalX, goalY) {
  const step = WORLD.block + WORLD.road;
  if (!car.target) {
    // Join the grid: snap the direction to the car's heading, then aim at the
    // nearest point on a road. Once there, the turn logic takes over.
    const twoPi = Math.PI * 2;
    const norm = ((car.angle % twoPi) + twoPi) % twoPi;
    car.dir = Math.round(norm / (Math.PI / 2)) % 4;
    car.angle = dirAngle(car.dir);
    car.target = nearestRoadPoint(car.x, car.y);
  }
  const off = laneOffset(car.dir, car.lane);
  const tx = car.target.x + off.x;
  const ty = car.target.y + off.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    // At the intersection: snap onto it, then take the turn whose next
    // intersection is nearest the goal. No U-turns, unless the map edge
    // leaves no other way.
    car.x = tx;
    car.y = ty;
    let bestDir = -1;
    let bestD = Infinity;
    for (let d = 0; d < 4; d += 1) {
      if (d === (car.dir + 2) % 4) continue;
      const nx = car.x + Math.cos(dirAngle(d)) * step;
      const ny = car.y + Math.sin(dirAngle(d)) * step;
      if (nx < 0 || nx > WORLD.size || ny < 0 || ny > WORLD.size) continue;
      const dd = Math.hypot(goalX - nx, goalY - ny);
      if (dd < bestD) {
        bestD = dd;
        bestDir = d;
      }
    }
    if (bestDir < 0) bestDir = (car.dir + 2) % 4;
    car.dir = bestDir;
    car.angle = dirAngle(car.dir);
    car.target = {
      x: car.x + Math.cos(car.angle) * step,
      y: car.y + Math.sin(car.angle) * step,
    };
    return { throttle: 0.6, steer: 0, brake: 0 };
  }
  const ahead = carAhead(state, car, 85);
  return {
    throttle: ahead ? 0 : (dist < 130 ? 0.35 : 0.65),
    steer: steerToward(car, tx, ty),
    brake: ahead ? 1 : 0,
  };
}

/** Traffic controls: cruise the grid, turn at intersections, stop for the car ahead. */
function trafficControls(state, car, dt) {
  if (!car.target) nextIntersectionTarget(car, state.rng);
  const off = laneOffset(car.dir, car.lane);
  const tx = car.target.x + off.x;
  const ty = car.target.y + off.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    // At the intersection: snap onto it (so a wide turn never leaves the
    // road), turn or go straight, then pick the next one.
    car.x = tx;
    car.y = ty;
    const roll = state.rng.next();
    if (roll < 0.3) car.dir = (car.dir + 1) % 4;
    else if (roll < 0.55) car.dir = (car.dir + 3) % 4;
    car.angle = dirAngle(car.dir);
    nextIntersectionTarget(car, state.rng);
    return { throttle: 0.6, steer: 0, brake: 0 };
  }
  const ahead = carAhead(state, car, 85);
  // Ease off near the intersection so the turn stays tight and on the road.
  return {
    throttle: ahead ? 0 : (dist < 130 ? 0.35 : 0.65),
    steer: steerToward(car, tx, ty),
    brake: ahead ? 1 : 0,
  };
}

/**
 * One physics step for any car. Controls are {throttle 0..1, steer -1..1, brake 0..1}.
 * Returns true when the car hit something hard this step.
 */
export function applyCarControls(state, car, controls, dt) {
  const speedRatio = Math.abs(car.speed) / CAR.maxSpeed;
  const steerAmount = CAR.steer * controls.steer * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 220));
  car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * (1 - speedRatio * 0.35);
  if (controls.throttle > 0) car.speed += CAR.accel * controls.throttle * dt * (1 - speedRatio * 0.75);
  if (controls.brake > 0) car.speed -= CAR.brake * controls.brake * dt * Math.sign(car.speed || 1);
  if (controls.throttle === 0 && controls.brake === 0) car.speed -= car.speed * 0.9 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && controls.throttle === 0) car.speed = 0;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Buildings and the water stop a car cold.
  const body = { x: car.x, y: car.y, radius: 17 };
  if (resolveCircle(state.city, body)) {
    const hit = Math.abs(car.speed) > 120;
    car.x = body.x;
    car.y = body.y;
    car.speed *= -0.25;
    if (hit) {
      damageCar(state, car, 8);
      state.effects.sparks(car.x, car.y);
      state.effects.addShake(3);
      if (car.driver === 'player') state.audio.crash(Math.abs(car.speed) / CAR.maxSpeed);
    }
    return hit;
  }
  // Skid marks and smoke when drifting hard.
  if (Math.abs(controls.steer) > 0.7 && Math.abs(car.speed) > 260) {
    state.effects.skidMark(car.x, car.y, car.angle);
    if (state.rng.chance(0.3)) {
      state.effects.smoke(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18);
    }
  }
  if (car.hp < 35 && car.hp > 0) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      state.effects.smoke(car.x, car.y - 6);
    }
  }
  return false;
}

/** Push overlapping cars apart and trade damage on hard hits. */
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d === 0 || d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 140) {
        damageCar(state, a, 5);
        damageCar(state, b, 5);
        state.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (a.driver === 'player' || b.driver === 'player') {
          state.audio.crash(closing / CAR.maxSpeed);
          state.effects.addShake(4);
        }
        const swap = a.speed;
        a.speed = b.speed * 0.6;
        b.speed = swap * 0.6;
      }
    }
  }
}

/** Move every car one step: traffic by its AI, the player's by its driver. */
export function updateCars(state, dt) {
  for (const car of state.cars) {
    if (car.hp <= 0) continue;
    if (car.driver === 'traffic') {
      const controls = trafficControls(state, car, dt);
      applyCarControls(state, car, controls, dt);
    }
  }
  resolveCarCollisions(state);
  // Burnt-out cars stop and smoke.
  for (const car of state.cars) {
    if (car.hp <= 0 && car.speed !== 0) car.speed = 0;
  }
}

/** The nearest stealable car to a point, within maxDist. */
export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.hp <= 0 || car.driver === 'player' || car.driver === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}
