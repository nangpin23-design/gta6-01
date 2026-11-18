// NEON TIDE — pedestrians strolling Calder Bay. They walk the sidewalks, never
// the asphalt: a car can only hit one if the player drives fast onto the kerb.
// Every pedestrian carries a radius from birth, so distance checks can never
// meet an undefined value and poison a position with NaN.

import { COLORS, PEDS } from './config.js';

let nextPedId = 1;

export class Ped {
  constructor(x, y, angle, speed, color) {
    this.id = nextPedId;
    nextPedId += 1;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.color = color;
    this.radius = 11;
    this.dead = false;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.fleeing = false;
  }
}

export class Pedestrians {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < PEDS.count; i += 1) this.spawnPed();
  }

  spawnPed() {
    const p = this.world.randomSidewalkPoint(this.rng);
    const vertical = this.rng.chance(0.5);
    const angle = vertical ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
    this.peds.push(new Ped(p.x, p.y, angle, this.rng.range(PEDS.speedMin, PEDS.speedMax), this.rng.pick(COLORS.pedShirt)));
  }

  update(dt, danger) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      ped.walkPhase += dt * 8;
      let angle = ped.angle;
      let speed = ped.speed;
      if (danger) {
        const dx = ped.x - danger.x;
        const dy = ped.y - danger.y;
        const d = Math.hypot(dx, dy);
        if (d < 180) {
          angle = Math.atan2(dy, dx);
          speed = ped.speed * 2.4;
          ped.fleeing = true;
        } else {
          ped.fleeing = false;
        }
      }
      const nx = ped.x + Math.cos(angle) * speed * dt;
      const ny = ped.y + Math.sin(angle) * speed * dt;
      // Stay on the sidewalk: if the next step leaves it, turn around.
      if (this.world.isOnSidewalk(nx, ny) && !this.world.isWater(nx, ny)) {
        ped.x = nx;
        ped.y = ny;
        ped.angle = angle;
      } else {
        ped.angle = angle + Math.PI;
      }
    }
    this.peds = this.peds.filter((p) => !p.dead);
    while (this.peds.length < PEDS.count) this.spawnPed();
  }

  // A fast player car clipping a pedestrian on the kerb. Traffic never kills:
  // only the player's speed can do it, and it is always the player's fault.
  hitByCar(car, speed) {
    if (speed < 220) return null;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < car.radius + ped.radius) {
        ped.dead = true;
        return ped;
      }
    }
    return null;
  }
}
