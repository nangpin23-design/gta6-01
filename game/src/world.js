// NEON TIDE — Calder Bay itself: the road lattice, the harbour, the blocks and
// their buildings, and the geometry every other module asks about (is this point
// on a road, on a sidewalk, in the water, inside a building?).

import {
  COLORS,
  HORIZONTAL_ROADS,
  LANDMARKS,
  PIER_X,
  ROAD_W,
  SIDEWALK_W,
  VERTICAL_ROADS,
  WATER_Y,
  WORLD_H,
  WORLD_W,
} from './config.js';
import { makeRng } from './random.js';

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.buildings = [];
    this.buildCity();
  }

  buildCity() {
    const half = ROAD_W / 2 + SIDEWALK_W + 10;
    for (let i = 0; i < VERTICAL_ROADS.length - 1; i += 1) {
      for (let j = 0; j < HORIZONTAL_ROADS.length - 1; j += 1) {
        const x0 = VERTICAL_ROADS[i] + half;
        const x1 = VERTICAL_ROADS[i + 1] - half;
        const y0 = HORIZONTAL_ROADS[j] + half;
        const y1 = HORIZONTAL_ROADS[j + 1] - half;
        if (y0 >= WATER_Y - 40 || x1 - x0 < 90 || y1 - y0 < 90) continue;
        this.placeBlockBuildings(x0, y0, x1, y1);
      }
    }
    // The strip between the last horizontal road and the water holds the marina.
    this.placeBlockBuildings(
      VERTICAL_ROADS[1] + half,
      HORIZONTAL_ROADS[HORIZONTAL_ROADS.length - 1] + half,
      VERTICAL_ROADS[3] - half,
      WATER_Y - 60,
    );
  }

  placeBlockBuildings(x0, y0, x1, y1) {
    const rng = this.rng;
    const count = rng.int(1, 3);
    const w = x1 - x0;
    const h = y1 - y0;
    for (let k = 0; k < count; k += 1) {
      const bw = rng.range(70, Math.max(80, w * 0.42));
      const bh = rng.range(60, Math.max(70, h * 0.42));
      const bx = x0 + rng.range(6, Math.max(7, w - bw - 6));
      const by = y0 + rng.range(6, Math.max(7, h - bh - 6));
      const roof = rng.pick(['#4a3b52', '#3b4a52', '#52423b', '#3b5240', '#4d3b4d']);
      const neon = rng.pick([COLORS.neonPink, COLORS.neonCyan, COLORS.neonAmber, null, null]);
      this.buildings.push({ x: bx, y: by, w: bw, h: bh, roof, neon });
    }
  }

  isOnRoad(x, y) {
    const half = ROAD_W / 2;
    for (const rx of VERTICAL_ROADS) {
      if (Math.abs(x - rx) <= half && y >= 0 && y <= WORLD_H) return true;
    }
    for (const ry of HORIZONTAL_ROADS) {
      if (Math.abs(y - ry) <= half && x >= 0 && x <= WORLD_W) return true;
    }
    return false;
  }

  isOnSidewalk(x, y) {
    if (this.isOnRoad(x, y)) return false;
    const band = ROAD_W / 2 + SIDEWALK_W;
    for (const rx of VERTICAL_ROADS) {
      if (Math.abs(x - rx) <= band) return true;
    }
    for (const ry of HORIZONTAL_ROADS) {
      if (Math.abs(y - ry) <= band) return true;
    }
    return false;
  }

  isOnPier(x, y) {
    return Math.abs(x - PIER_X) <= 30 && y >= HORIZONTAL_ROADS[HORIZONTAL_ROADS.length - 1] && y <= 1760;
  }

  isWater(x, y) {
    return y > WATER_Y && !this.isOnPier(x, y);
  }

  isWalkable(x, y) {
    return !this.isWater(x, y) && !this.insideBuilding(x, y);
  }

  insideBuilding(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }

  // Push a circle out of buildings, water and the world edge. Returns a fresh
  // {x, y}; never NaN: a centre inside a rectangle is pushed out along the
  // smallest penetration axis.
  collideCircle(x, y, r) {
    let nx = Math.max(r, Math.min(WORLD_W - r, x));
    let ny = Math.max(r, Math.min(WORLD_H - r, y));
    for (const b of this.buildings) {
      const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        // Centre inside the rectangle: push out along the smallest overlap.
        const left = nx - b.x + r;
        const right = b.x + b.w - nx + r;
        const top = ny - b.y + r;
        const bottom = b.y + b.h - ny + r;
        const min = Math.min(left, right, top, bottom);
        if (min === left) nx = b.x - r;
        else if (min === right) nx = b.x + b.w + r;
        else if (min === top) ny = b.y - r;
        else ny = b.y + b.h + r;
      }
    }
    if (this.isWater(nx, ny)) ny = WATER_Y - r;
    return { x: nx, y: ny };
  }

  randomRoadPoint(rng) {
    if (rng.chance(0.5)) {
      const rx = rng.pick(VERTICAL_ROADS);
      return { x: rx + rng.range(-ROAD_W / 4, ROAD_W / 4), y: rng.range(80, WATER_Y - 80) };
    }
    const ry = rng.pick(HORIZONTAL_ROADS);
    return { x: rng.range(80, WORLD_W - 80), y: ry + rng.range(-ROAD_W / 4, ROAD_W / 4) };
  }

  randomSidewalkPoint(rng) {
    for (let tries = 0; tries < 40; tries += 1) {
      const p = this.randomRoadPoint(rng);
      const side = rng.pick([-1, 1]);
      const px = p.x + side * (ROAD_W / 2 + SIDEWALK_W / 2);
      const py = p.y + side * (ROAD_W / 2 + SIDEWALK_W / 2);
      if (this.isOnSidewalk(px, p.y) || this.isOnSidewalk(p.x, py)) {
        const cand = this.isOnSidewalk(px, p.y) ? { x: px, y: p.y } : { x: p.x, y: py };
        if (!this.insideBuilding(cand.x, cand.y) && !this.isWater(cand.x, cand.y)) return cand;
      }
    }
    return { x: LANDMARKS.garage.x + 120, y: LANDMARKS.garage.y };
  }
}
