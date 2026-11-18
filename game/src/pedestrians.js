// Pedestrians: Velmora's people. They stroll the sidewalks, cross at corners,
// and run from gunfire, speeding cars and police chases. A pedestrian is a
// small circle with a walk target, a mood and a shirt colour.

import { PALETTE } from './config.js';
import { randomSidewalkPoint, resolveCircle } from './world.js';

const SHIRTS = ['#e84a5f', '#f2c94c', '#4fc3f7', '#9b59b6', '#e8e8e8', '#ff8c42', '#2ecc71', '#fd79a8'];
const SPEEDS = { stroll: 55, hurry: 110, flee: 230 };

export function spawnPedestrians(state) {
  for (let i = 0; i < state.pedCount; i += 1) {
    const p = randomSidewalkPoint(state.rng);
    state.peds.push({
      x: p.x, y: p.y,
      angle: state.rng.range(0, Math.PI * 2),
      speed: SPEEDS.stroll,
      target: randomSidewalkPoint(state.rng),
      shirt: state.rng.pick(SHIRTS),
      mood: 'stroll',
      fear: 0,
      alive: true,
      hp: 30,
    });
  }
}

/** The nearest living pedestrian to a point, within maxDist. */
export function nearestPed(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  return best;
}

/** Scare every pedestrian near (x, y): they run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (Math.hypot(ped.x - x, ped.y - y) >= radius) continue;
    ped.mood = 'flee';
    ped.fear = 1;
    const away = Math.atan2(ped.y - y, ped.x - x);
    ped.target = {
      x: ped.x + Math.cos(away) * 260,
      y: ped.y + Math.sin(away) * 260,
    };
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (ped.fear > 0) ped.fear = Math.max(0, ped.fear - dt * 0.25);
    else if (ped.mood === 'flee') ped.mood = 'stroll';

    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      ped.target = randomSidewalkPoint(state.rng);
      continue;
    }
    const speed = ped.mood === 'flee' ? SPEEDS.flee : SPEEDS.stroll;
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    const body = { x: ped.x, y: ped.y, radius: 9 };
    resolveCircle(state.city, body);
    ped.x = body.x;
    ped.y = body.y;

    // A fast car through a crowd is a crime the whole street sees.
    for (const car of state.cars) {
      if (car.hp <= 0 || Math.abs(car.speed) < 120) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) >= 30) continue;
      ped.alive = false;
      ped.hp = 0;
      state.effects.sparks(ped.x, ped.y);
      state.effects.floater(ped.x, ped.y - 14, '!', '#ff5a4e');
      if (car.driver === 'player') state.addHeat(0.8, 'pedestrian down');
      scarePeds(state, ped.x, ped.y, 320);
      break;
    }
  }
}
