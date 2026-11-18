// The Velmora PD: the wanted level, police pursuit cars and the foot officers
// who make the arrest. Stars 0..5; crimes add heat inside the current star,
// and heat cools off when the player stays clean and out of sight. Police cars
// chase on the roads; when the player is on foot, officers get out and run
// them down.

import { PALETTE, WANTED, WORLD } from './config.js';
import { nearestRoadPoint, randomRoadPoint, resolveCircle } from './world.js';
import { applyCarControls, createCar, gridDriveControls } from './vehicles.js';

const FOOT_COP_SPEED = 250;
const FOOT_COP_HP = 50;
const ARREST_RANGE = 20;

/** Add heat from a crime; a full bar of heat earns another star. */
export function addHeat(state, amount) {
  if (state.wanted.stars >= WANTED.maxStars) return;
  state.wanted.heat += amount;
  state.lastCrimeAt = state.time;
  while (state.wanted.heat >= 1 && state.wanted.stars < WANTED.maxStars) {
    state.wanted.heat -= 1;
    state.wanted.stars += 1;
    state.effects.floater(state.player.x, state.player.y - 30, `WANTED ${state.wanted.stars}★`, '#ff5a4e');
  }
}

/** Cool the heat down when the player has been clean for a while. Heat is the
 * bar inside the current star, and it builds toward the first star too: it
 * must only fall here, never be wiped, or a crime could never earn a star. */
export function decayWanted(state, dt) {
  const w = state.wanted;
  if (state.time - state.lastCrimeAt < 4) return;
  // Heat only cools while no police car can see the player.
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.hp <= 0) continue;
    if (Math.hypot(car.x - state.player.x, car.y - state.player.y) < 320) return;
  }
  w.heat -= WANTED.decayPerSecond * dt;
  if (w.heat > 0) return;
  // The bar emptied: lose a star (and start the next one part-full), or sit
  // clean at zero stars with no heat left to lose.
  if (w.stars > 0) {
    w.stars -= 1;
    w.heat = w.stars > 0 ? 0.6 : 0;
  } else {
    w.heat = 0;
  }
}

function policeTarget(state) {
  return WANTED.policePerStar[state.wanted.stars] || 0;
}

// A point on a road a few blocks from the player, never on top of them.
function roadPointAwayFromPlayer(state) {
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(state.rng);
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d >= 380 && d <= 700) return p;
  }
  return null;
}

function spawnPoliceCar(state) {
  const p = roadPointAwayFromPlayer(state);
  if (!p) return null;
  const car = createCar('police', p.x, p.y, 0, PALETTE.policeCar);
  car.driver = 'police';
  car.siren = true;
  state.cars.push(car);
  return car;
}

function spawnFootCop(state, car) {
  state.cops.push({
    x: car.x + 20,
    y: car.y + 20,
    angle: 0,
    hp: FOOT_COP_HP,
    carId: car.id,
    stuck: 0,
  });
}

/** Steer a police car at the player: on the road grid from far (so it never
 * cuts across a block into a building), straight at them once close. */
function pursuitControls(state, car, dt) {
  const px = state.player.x;
  const py = state.player.y;
  const dist = Math.hypot(px - car.x, py - car.y);
  if (dist > 240) {
    const road = nearestRoadPoint(px, py);
    return gridDriveControls(state, car, road.x, road.y);
  }
  // Close in: leave the grid behind and run the player down.
  car.target = null;
  // Lead the target a little.
  const lead = 0.35;
  const tx = px + (state.player.vx || 0) * lead;
  const ty = py + (state.player.vy || 0) * lead;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxSpeed = WANTED.policeSpeed[state.wanted.stars] || 300;
  return {
    throttle: Math.abs(car.speed) < maxSpeed ? 1 : 0.25,
    steer: Math.max(-1, Math.min(1, diff * 2.4)),
    brake: 0,
  };
}

export function updatePolice(state, dt) {
  const want = policeTarget(state);
  let have = 0;
  for (const car of state.cars) if (car.kind === 'police' && car.hp > 0) have += 1;
  while (have < want) {
    if (spawnPoliceCar(state)) have += 1;
    else break;
  }
  // Too many, or the heat is gone: the extra cars drive off and despawn.
  if (state.wanted.stars === 0) {
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].kind === 'police') state.cars.splice(i, 1);
    }
    state.cops.length = 0;
    return;
  }

  for (const car of state.cars) {
    if (car.kind !== 'police' || car.hp <= 0) continue;
    const dist = Math.hypot(state.player.x - car.x, state.player.y - car.y);
    if (dist > 1100) {
      // Lost the trail: reappear on a road a few blocks from the player.
      const p = roadPointAwayFromPlayer(state);
      if (p) {
        car.x = p.x;
        car.y = p.y;
      }
      car.speed = 0;
      car.stuck = 0;
      continue;
    }
    // Stuck against a building while chasing: back out and try another angle
    // instead of pushing the same wall forever. car.stuck is negative while
    // the car is backing up, positive while it is pinned.
    if (car.stuck < 0) {
      car.stuck += dt;
      applyCarControls(state, car, { throttle: 0, steer: 1, brake: 0 }, dt);
      continue;
    }
    if (Math.abs(car.speed) < 40 && dist > 200) {
      car.stuck += dt;
      if (car.stuck > 0.7) {
        car.stuck = -0.6;
        car.speed = -140;
      }
    } else {
      car.stuck = 0;
    }
    if (!state.player.inCar && dist < 150) {
      // On foot and close: an officer gets out and chases on foot.
      car.speed = Math.max(0, car.speed - 400 * dt);
      if (!state.cops.some((c) => c.carId === car.id)) spawnFootCop(state, car);
    } else {
      const controls = pursuitControls(state, car, dt);
      applyCarControls(state, car, controls, dt);
    }
  }
  // Burnt police cars leave the street.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.kind === 'police' && car.hp <= 0) state.cars.splice(i, 1);
  }

  // Foot officers run the player down; touching them is an arrest.
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    if (cop.hp <= 0) {
      state.cops.splice(i, 1);
      continue;
    }
    if (state.player.inCar) {
      // The player drove off: the officer heads back to the car and leaves.
      const car = state.cars.find((c) => c.id === cop.carId);
      if (!car || Math.hypot(state.player.x - cop.x, state.player.y - cop.y) > 420) {
        state.cops.splice(i, 1);
      }
      continue;
    }
    const dx = state.player.x - cop.x;
    const dy = state.player.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d < ARREST_RANGE) {
      state.pendingBust = true;
      continue;
    }
    cop.angle = Math.atan2(dy, dx);
    cop.x += Math.cos(cop.angle) * FOOT_COP_SPEED * dt;
    cop.y += Math.sin(cop.angle) * FOOT_COP_SPEED * dt;
    const body = { x: cop.x, y: cop.y, radius: 11 };
    resolveCircle(state.city, body);
    cop.x = body.x;
    cop.y = body.y;
  }
}
