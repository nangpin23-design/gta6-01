// SUNSET RUN — the wanted level and Aurelia PD.
//
// Crimes fill a heat bar; a full bar earns another star, up to five. Heat
// cools off only when Nico has been clean for a while and no police car can
// see him. Each star puts more interceptors on the road, and they get faster.
// When Nico is on foot and close, an officer gets out and runs him down: one
// touch is an arrest.

import { PALETTE, PLACES, WANTED } from './config.js';
import { nearestRoadPoint, randomRoadPoint, resolveCircle } from './world.js';
import { applyCarControls, createCar, gridDriveControls } from './vehicles.js';
import { damagePlayer } from './player.js';

const FOOT_COP_SPEED = 255;
const FOOT_COP_HP = 50;

/** Add heat from a crime; a full bar of heat earns another star. */
export function addHeat(state, amount) {
  const w = state.wanted;
  if (w.stars >= WANTED.maxStars) return;
  w.heat += amount;
  state.lastCrimeAt = state.time;
  while (w.heat >= 1 && w.stars < WANTED.maxStars) {
    w.heat -= 1;
    w.stars += 1;
    state.effects.floater(
      state.player.x,
      state.player.y - 32,
      `WANTED ${w.stars}★`,
      '#ff5a4e',
    );
    state.audio.sirenBlip();
  }
}

/** Cool the heat down when the player has been clean for a while. */
export function decayWanted(state, dt) {
  const w = state.wanted;
  // No cooling during a spree: heat only decays once Nico has been clean for
  // a while, at zero stars just as at five — otherwise a few quick crimes
  // could never add up to the first star.
  if (state.time - state.lastCrimeAt < WANTED.cleanDelay) return;
  // Heat only cools while no police car can see the player.
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.hp <= 0) continue;
    if (Math.hypot(car.x - state.player.x, car.y - state.player.y) < WANTED.seeRange) return;
  }
  w.heat -= WANTED.decayPerSecond * dt;
  if (w.heat <= 0) {
    w.heat = 0;
    if (w.stars > 0) {
      w.stars -= 1;
      w.heat = w.stars > 0 ? 0.6 : 0;
    }
  }
}

function policeTarget(state) {
  return WANTED.policePerStar[state.wanted.stars] || 0;
}

function spawnPoliceCar(state) {
  // Appear on a road a few blocks away from the player, never on top of them.
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(state.rng, state.city);
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d < 380 || d > 700) continue;
    const car = createCar('interceptor', p.x, p.y, 0, PALETTE.policeCar);
    car.driver = 'police';
    car.siren = true;
    state.cars.push(car);
    return car;
  }
  return null;
}

// One interceptor for a staged scene (the chase screenshot): same spawn rule,
// exported so shots.js can place the pursuit before the frame is taken.
export function spawnPoliceCarForShot(state) {
  return spawnPoliceCar(state);
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

/** Steer a police car at the player: on the road grid from far away, so it
 * never cuts across a block into a building, straight at them once close. */
function pursuitControls(state, car) {
  const px = state.player.x;
  const py = state.player.y;
  const dist = Math.hypot(px - car.x, py - car.y);
  if (dist > 260) {
    const road = nearestRoadPoint(state.city, px, py);
    return gridDriveControls(state, car, road.x, road.y);
  }
  car.target = null;
  // Lead the target a little, so a fast player cannot just out-turn the chase.
  const lead = 0.35;
  const tx = px + (state.player.vx || 0) * lead;
  const ty = py + (state.player.vy || 0) * lead;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxSpeed = WANTED.policeSpeed[state.wanted.stars] || 300;
  const throttle = Math.abs(car.speed) < maxSpeed ? 1 : 0.25;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.4)), brake: 0 };
}

function bustPlayer(state) {
  const p = state.player;
  const cut = Math.floor(p.cash * WANTED.bustCut);
  p.cash -= cut;
  p.hp = 100;
  if (p.inCar && p.car) {
    p.car.driver = 'none';
    p.car.speed = 0;
    p.car = null;
    p.inCar = false;
  }
  p.x = PLACES.policeStation.x;
  p.y = PLACES.policeStation.y;
  state.wanted.stars = 0;
  state.wanted.heat = 0;
  for (const car of state.cars) {
    if (car.kind === 'police') car.hp = 0;
  }
  state.cops.length = 0;
  state.mode = 'busted';
  state.audio.missionFail();
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
      for (let tries = 0; tries < 12; tries += 1) {
        const p = randomRoadPoint(state.rng, state.city);
        const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
        if (d < 380 || d > 700) continue;
        car.x = p.x;
        car.y = p.y;
        break;
      }
      car.speed = 0;
      car.stuck = 0;
      continue;
    }
    // Ramming the player hurts: a fast police car is a weapon.
    if (dist < car.radius + state.player.radius + 4 && Math.abs(car.speed) > 180) {
      if (state.player.inCar) {
        state.player.car.hp -= 12;
      } else {
        damagePlayer(state, 18);
        state.effects.sparks(state.player.x, state.player.y);
      }
      car.speed *= 0.4;
    }
    // Stuck against a building while chasing: back out and try another angle
    // instead of pushing the same wall forever.
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
    if (!state.player.inCar && dist < 160) {
      // On foot and close: an officer gets out and chases on foot.
      car.speed = Math.max(0, car.speed - 400 * dt);
      if (!state.cops.some((c) => c.carId === car.id)) spawnFootCop(state, car);
    } else {
      const controls = pursuitControls(state, car);
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
    if (d < 20) {
      bustPlayer(state);
      return;
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
