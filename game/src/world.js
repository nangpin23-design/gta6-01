// SUNSET RUN — Port Aurelia itself: roads, blocks, buildings, harbor.
//
// The city is a road grid over a sun-baked ground plane, with the harbor water
// along the south edge. Everything is generated from the world's seed, so the
// same seed always builds the same streets, and a screenshot staged with a
// fixed seed always shows the same corner of town.

import { WORLD, PALETTE } from './config.js';
import { int, pick, range } from './random.js';

// The road centrelines: verticals every 300 px from x=150, horizontals the same.
export function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = 150; x < WORLD.width; x += WORLD.roadSpacing) vertical.push(x);
  for (let y = 150; y < WORLD.height; y += WORLD.roadSpacing) horizontal.push(y);
  return { vertical, horizontal };
}

function nearestLine(lines, v) {
  let best = lines[0];
  let bestD = Math.abs(v - lines[0]);
  for (const l of lines) {
    const d = Math.abs(v - l);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// Build the whole city from a seeded stream: blocks, buildings, trees, pier.
export function generateCity(rng) {
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const half = WORLD.roadWidth / 2;

  // One block sits between two neighbouring roads. A building never touches a
  // road: it keeps a margin inside its block.
  for (let i = 0; i < lines.vertical.length - 1; i += 1) {
    for (let j = 0; j < lines.horizontal.length - 1; j += 1) {
      const bx = lines.vertical[i] + half;
      const by = lines.horizontal[j] + half;
      const bw = WORLD.roadSpacing - WORLD.roadWidth;
      const bh = WORLD.roadSpacing - WORLD.roadWidth;
      // The row of blocks along the water stays open: beach, not buildings.
      if (by + bh > WORLD.waterY - 30) continue;
      const count = rng() < 0.55 ? 1 : 2;
      for (let k = 0; k < count; k += 1) {
        const w = range(rng, 70, 150);
        const h = range(rng, 70, 150);
        const x = bx + range(rng, 14, Math.max(15, bw - w - 14));
        const y = by + range(rng, 14, Math.max(15, bh - h - 14));
        buildings.push({
          x,
          y,
          w,
          h,
          color: pick(rng, PALETTE.building),
          roof: rng() < 0.5,
        });
      }
      // A tree or two on the block's corners, clear of the buildings.
      for (let t = 0; t < int(rng, 0, 2); t += 1) {
        trees.push({
          x: bx + range(rng, 10, bw - 10),
          y: by + range(rng, 10, bh - 10),
          r: range(rng, 9, 14),
        });
      }
    }
  }

  return {
    width: WORLD.width,
    height: WORLD.height,
    lines,
    buildings,
    trees,
    waterY: WORLD.waterY,
    // The wooden pier reaching into the harbor from the marina road.
    pier: { x: 1560, y: 1650, w: 180, h: 30 },
    spawn: { x: 450, y: 450 },
  };
}

// The nearest point on a road centreline to (x, y).
export function nearestRoadPoint(city, x, y) {
  const vx = nearestLine(city.lines.vertical, x);
  const hy = nearestLine(city.lines.horizontal, y);
  const dv = Math.abs(x - vx);
  const dh = Math.abs(y - hy);
  if (dv <= dh) return { x: vx, y };
  return { x, y: hy };
}

// A random road intersection, with a little jitter so cars do not stack.
export function randomRoadPoint(rng, city) {
  const vx = pick(rng, city.lines.vertical);
  const hy = pick(rng, city.lines.horizontal);
  return { x: vx + range(rng, -20, 20), y: hy + range(rng, -20, 20) };
}

export function pointInWater(city, x, y) {
  return y >= city.waterY;
}

export function onRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  for (const vx of city.lines.vertical) {
    if (Math.abs(x - vx) <= half) return true;
  }
  for (const hy of city.lines.horizontal) {
    if (Math.abs(y - hy) <= half) return true;
  }
  return false;
}

// Push a circle ({x, y, radius}) out of every building and out of the water,
// and clamp it inside the map. Buildings win over water: a circle wedged
// between the two is pushed out of the building first.
export function resolveCircle(city, body) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.radius * body.radius) continue;
    if (d2 === 0) {
      body.y = b.y - body.radius;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (body.radius - d) / d;
    body.x += dx * push;
    body.y += dy * push;
  }
  if (body.y + body.radius > city.waterY) body.y = city.waterY - body.radius;
  body.x = Math.max(body.radius, Math.min(city.width - body.radius, body.x));
  body.y = Math.max(body.radius, Math.min(city.height - body.radius, body.y));
}
