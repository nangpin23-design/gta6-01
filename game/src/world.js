// The city of Velmora: a road grid over a square map, blocks holding
// buildings, a beach and water along the south shore, a pier, and the named
// places the story visits. No drawing here — only the layout, the collision
// tests and the spawn points the other modules ask for.

import { PALETTE, PLACES, WORLD } from './config.js';

const ROAD_HALF = WORLD.road / 2;
// Road centrelines sit on the grid lines of the block pitch.
const PITCH = WORLD.block + WORLD.road;

// All road centrelines, from the north edge to the south.
function roadCentres() {
  const lines = [];
  for (let c = ROAD_HALF; c <= WORLD.size; c += PITCH) lines.push(c);
  return lines;
}

function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD.size || y > WORLD.size) return false;
  for (const c of roadCentres()) {
    if (Math.abs(x - c) <= ROAD_HALF || Math.abs(y - c) <= ROAD_HALF) return true;
  }
  return false;
}

// True when a rectangle reaches onto a road (with a little clearance).
function rectOverlapsRoad(rect) {
  const pad = ROAD_HALF + 6;
  for (const c of roadCentres()) {
    if (rect.x < c + pad && rect.x + rect.w > c - pad) return true;
    if (rect.y < c + pad && rect.y + rect.h > c - pad) return true;
  }
  return false;
}

// True when two rectangles overlap with the given clearance between them.
function overlapsPadded(a, b, pad) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x
    && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/** Build the city from a seeded random: blocks, buildings, palms, landmarks. */
export function buildCity(random) {
  const lines = roadCentres();
  const buildings = [];
  const palms = [];
  const blocks = [];

  // Each block between four roads gets one to three buildings.
  for (let bx = 0; bx < lines.length - 1; bx += 1) {
    for (let by = 0; by < lines.length - 1; by += 1) {
      const x0 = lines[bx] + ROAD_HALF + 10;
      const y0 = lines[by] + ROAD_HALF + 10;
      const x1 = lines[bx + 1] - ROAD_HALF - 10;
      const y1 = lines[by + 1] - ROAD_HALF - 10;
      if (y0 > WORLD.beachY) continue; // the beach strip holds no buildings
      blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      const count = random.int(1, 4);
      for (let n = 0; n < count; n += 1) {
        const w = random.range(70, 150);
        const h = random.range(60, 130);
        const x = random.range(x0, Math.max(x0 + 1, x1 - w));
        const y = random.range(y0, Math.max(y0 + 1, y1 - h));
        const rect = { x, y, w, h };
        if (buildings.some((b) => overlapsPadded(rect, b, 14))) continue;
        buildings.push({
          ...rect,
          roof: random.pick(PALETTE.buildingRoof),
          height: random.int(1, 4),
          landmark: null,
        });
      }
      // Palms along the block's edges.
      const palmsHere = random.int(0, 3);
      for (let n = 0; n < palmsHere; n += 1) {
        palms.push({ x: random.range(x0, x1), y: random.range(y0, y1) });
      }
    }
  }

  // Landmarks: big buildings at the named places, drawn over the small ones.
  const landmarks = [
    { place: 'casino', w: 190, h: 130, roof: '#d9a05b' },
    { place: 'market', w: 170, h: 110, roof: '#5f8f6a' },
    { place: 'garage', w: 150, h: 100, roof: '#7d9bb5' },
    { place: 'safehouse', w: 110, h: 90, roof: '#a8709e' },
    { place: 'police', w: 150, h: 110, roof: '#1c3a6e' },
    { place: 'hospital', w: 170, h: 120, roof: '#e8e8e8' },
  ];
  for (const mark of landmarks) {
    const at = PLACES[mark.place];
    let rect = { x: at.x - mark.w / 2, y: at.y - mark.h / 2, w: mark.w, h: mark.h };
    if (rectOverlapsRoad(rect)) {
      // A landmark must never sit on a street: move it to its block's centre.
      let cx = at.x;
      let cy = at.y;
      for (let i = 0; i < lines.length - 1; i += 1) {
        if (at.x > lines[i] && at.x < lines[i + 1]) cx = (lines[i] + lines[i + 1]) / 2;
        if (at.y > lines[i] && at.y < lines[i + 1]) cy = (lines[i] + lines[i + 1]) / 2;
      }
      rect = { x: cx - mark.w / 2, y: cy - mark.h / 2, w: mark.w, h: mark.h };
    }
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (rect.x < b.x + b.w && rect.x + rect.w > b.x && rect.y < b.y + b.h && rect.y + rect.h > b.y) {
        buildings.splice(i, 1);
      }
    }
    buildings.push({ ...rect, roof: mark.roof, height: 2, landmark: mark.place });
  }

  // The airfield: a runway strip in the north-east corner, no buildings on it.
  const runway = { x: 2100, y: 330, w: 420, h: 90 };
  for (let i = buildings.length - 1; i >= 0; i -= 1) {
    const b = buildings[i];
    if (runway.x < b.x + b.w && runway.x + runway.w > b.x && runway.y < b.y + b.h && runway.y + runway.h > b.y) {
      buildings.splice(i, 1);
    }
  }

  return { lines, buildings, palms, blocks, runway };
}

/** True when the point is inside a building, in the water, or outside the map. */
export function solidAt(city, x, y) {
  if (x < 8 || y < 8 || x > WORLD.size - 8 || y > WORLD.size - 8) return true;
  if (y > WORLD.waterY) return true;
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of whatever solid it overlaps; returns true when it moved. */
export function resolveCircle(city, body) {
  let moved = false;
  const r = body.radius;
  if (body.y > WORLD.waterY - r) {
    body.y = WORLD.waterY - r;
    moved = true;
  }
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
      moved = true;
    } else if (d2 <= 0.0001 && body.x >= b.x && body.x <= b.x + b.w && body.y >= b.y && body.y <= b.y + b.h) {
      body.y = b.y - r;
      moved = true;
    }
  }
  if (body.x < r) {
    body.x = r;
    moved = true;
  }
  if (body.x > WORLD.size - r) {
    body.x = WORLD.size - r;
    moved = true;
  }
  if (body.y < r) {
    body.y = r;
    moved = true;
  }
  return moved;
}

// The road centreline nearest a coordinate.
function nearestLine(value) {
  const lines = roadCentres();
  let best = lines[0];
  let bestD = Infinity;
  for (const c of lines) {
    const d = Math.abs(value - c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** The nearest point on a road to (x, y): where a car or a pedestrian walks to. */
export function nearestRoadPoint(x, y) {
  const nx = nearestLine(x);
  const ny = nearestLine(y);
  // Prefer the closer axis: drive along the road that is nearer.
  return Math.abs(x - nx) < Math.abs(y - ny) ? { x: nx, y } : { x, y: ny };
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  const lines = roadCentres();
  if (random.chance(0.5)) {
    return {
      x: random.pick(lines) + random.range(-ROAD_HALF + 12, ROAD_HALF - 12),
      y: random.range(60, WORLD.beachY - 60),
    };
  }
  return {
    x: random.range(60, WORLD.size - 60),
    y: random.pick(lines) + random.range(-ROAD_HALF + 12, ROAD_HALF - 12),
  };
}

/** A random sidewalk point near a road, for spawning pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = ROAD_HALF + 8;
  if (random.chance(0.5)) {
    return { x: p.x, y: p.y + (random.chance(0.5) ? off : -off) };
  }
  return { x: p.x + (random.chance(0.5) ? off : -off), y: p.y };
}

export { isOnRoad, rectOverlapsRoad, roadCentres };
