// SUNSET RUN — the people of Port Aurelia.
//
// Pedestrians stroll the sidewalks, each with their own pace and colour.
// They are not set dressing: a gunshot nearby or a car bearing down on them
// sends them running, and a player who drives through a crowd — or shoots one
// — earns heat for it. A pedestrian who is hit falls and fades away.

import { PALETTE, PEDS, WANTED } from './config.js';
import { nearestRoadPoint, resolveCircle } from './world.js';
import { pick, range } from './random.js';
import { addHeat } from './police.js';

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) {
    // Pedestrians walk the sidewalks, not the asphalt: offset from the road
    // centreline by a lane-width, so traffic passes them by instead of
    // mowing them down.
    const spot = sidewalkPoint(
      state.city,
      range(state.rng, 0, 2400),
      range(state.rng, 0, 1800),
      state.rng,
    );
    state.peds.push({
      x: spot.x,
      y: spot.y,
      angle: state.rng() * Math.PI * 2,
      speed: range(state.rng, PEDS.walkMin, PEDS.walkMax),
      color: pick(state.rng, PALETTE.ped),
      hp: 25,
      // A body radius, so resolveCircle can push a pedestrian out of a
      // building instead of poisoning its position with NaN (an undefined
      // radius makes every distance test fail and the push NaN).
      radius: 11,
      fleeing: false,
      target: null,
      pause: 0,
    });
  }
}

// A point on the sidewalk nearest to (x, y): the road it belongs to, the
// side of the road, and a jitter along it.
function sidewalkPoint(city, x, y, rng) {
  const road = nearestRoadPoint(city, x, y);
  const vertical = city.lines.vertical.includes(road.x);
  const lane = (rng() < 0.5 ? -1 : 1) * range(rng, 38, 46);
  if (vertical) return { x: road.x + lane, y: road.y + range(rng, -40, 40) };
  return { x: road.x + range(rng, -40, 40), y: road.y + lane };
}

function pickStrollTarget(state, ped) {
  const road = nearestRoadPoint(state.city, ped.x, ped.y);
  const vertical = state.city.lines.vertical.includes(road.x);
  // Keep the pedestrian's side of the road, so it strolls along its own
  // sidewalk instead of wandering into traffic. A pedestrian that drifted
  // onto the asphalt steps back onto the nearer sidewalk.
  let lane = vertical ? ped.x - road.x : ped.y - road.y;
  if (Math.abs(lane) < 36) lane = (lane < 0 ? -1 : 1) * 42;
  const along = range(state.rng, 120, 420) * (state.rng() < 0.5 ? -1 : 1);
  ped.target = vertical
    ? { x: road.x + lane, y: ped.y + along }
    : { x: ped.x + along, y: road.y + lane };
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    // Danger: a gunshot nearby, or a fast car closing in.
    let danger = null;
    if (state.lastShotAt && state.time - state.lastShotAt < 1.2) {
      const d = Math.hypot(p.x - ped.x, p.y - ped.y);
      if (d < 300) danger = { x: p.x, y: p.y };
    }
    if (!danger) {
      for (const car of state.cars) {
        if (Math.abs(car.speed) < 150) continue;
        const d = Math.hypot(car.x - ped.x, car.y - ped.y);
        if (d < 90) {
          danger = { x: car.x, y: car.y };
          break;
        }
      }
    }
    ped.fleeing = !!danger;
    if (danger) {
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      ped.x += Math.cos(away) * PEDS.fleeSpeed * dt;
      ped.y += Math.sin(away) * PEDS.fleeSpeed * dt;
      ped.angle = away;
      resolveCircle(state.city, ped);
      continue;
    }
    if (ped.pause > 0) {
      ped.pause -= dt;
      continue;
    }
    if (!ped.target) pickStrollTarget(state, ped);
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.target = null;
      ped.pause = range(state.rng, 0.5, 2.5);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    resolveCircle(state.city, ped);
  }

  // A fast car through a pedestrian is a crime — but only the player's car
  // can commit it. Traffic and police just shove a pedestrian aside; if
  // every car on the road were lethal, the sidewalks would empty in seconds.
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    for (const car of state.cars) {
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d >= car.radius + 8) continue;
      if (car.driver === 'player' && Math.abs(car.speed) > 150) {
        ped.hp = 0;
        addHeat(state, WANTED.heat.hitPed);
        state.effects.floater(ped.x, ped.y - 20, 'HIT', '#ff5a4e');
        state.effects.sparks(ped.x, ped.y);
      } else {
        const push = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(push) * 40 * dt;
        ped.y += Math.sin(push) * 40 * dt;
      }
    }
  }

  // The fallen fade away and are replaced by fresh faces, so the streets stay alive.
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.hp > 0) continue;
    if (ped.fellAt === undefined) ped.fellAt = state.time;
    if (state.time - ped.fellAt > 6) state.peds.splice(i, 1);
  }
  while (state.peds.length < PEDS.count) {
    spawnPeds(state, 1);
  }
}
