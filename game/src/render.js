// NEON TIDE — everything the player sees: the dusk city, its roads and harbour,
// buildings with neon signs, cars, pedestrians, the player, the mission marker,
// and the particles floating over it all. The camera follows the player.

import {
  COLORS,
  HORIZONTAL_ROADS,
  LANDMARKS,
  PIER_X,
  ROAD_W,
  SIDEWALK_W,
  VERTICAL_ROADS,
  VIEW_H,
  VIEW_W,
  WATER_Y,
  WORLD_H,
  WORLD_W,
} from './config.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(tx, ty) {
    this.x = Math.max(0, Math.min(WORLD_W - VIEW_W, tx - VIEW_W / 2));
    this.y = Math.max(0, Math.min(WORLD_H - VIEW_H, ty - VIEW_H / 2));
  }

  toWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(game) {
    const ctx = this.ctx;
    const cam = game.camera;
    const shake = game.effects.shakeOffset();
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.translate(-cam.x + shake.x, -cam.y + shake.y);
    this.drawGround(ctx, game.world);
    this.drawMarkers(ctx, game);
    this.drawCars(ctx, game);
    this.drawPeds(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawCops(ctx, game);
    this.drawEffects(ctx, game);
    ctx.restore();
    if (game.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(214, 47, 47, ${game.player.hurtFlash * 0.9})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawGround(ctx, world) {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // City blocks.
    ctx.fillStyle = COLORS.block;
    const half = ROAD_W / 2 + SIDEWALK_W;
    for (let i = 0; i < VERTICAL_ROADS.length - 1; i += 1) {
      for (let j = 0; j < HORIZONTAL_ROADS.length - 1; j += 1) {
        const x0 = VERTICAL_ROADS[i] + half;
        const x1 = VERTICAL_ROADS[i + 1] - half;
        const y0 = HORIZONTAL_ROADS[j] + half;
        const y1 = HORIZONTAL_ROADS[j + 1] - half;
        if (y0 < WATER_Y) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    // Sidewalks.
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of VERTICAL_ROADS) {
      ctx.fillRect(rx - ROAD_W / 2 - SIDEWALK_W, 0, ROAD_W + SIDEWALK_W * 2, WATER_Y);
    }
    for (const ry of HORIZONTAL_ROADS) {
      ctx.fillRect(0, ry - ROAD_W / 2 - SIDEWALK_W, WORLD_W, ROAD_W + SIDEWALK_W * 2);
    }
    // Asphalt.
    ctx.fillStyle = COLORS.road;
    for (const rx of VERTICAL_ROADS) {
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
    }
    for (const ry of HORIZONTAL_ROADS) {
      ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    }
    // Lane dashes.
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (const rx of VERTICAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, WATER_Y);
      ctx.stroke();
    }
    for (const ry of HORIZONTAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(WORLD_W, ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Harbour water + pier.
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
    ctx.fillStyle = COLORS.waterDeep;
    for (let i = 0; i < 40; i += 1) {
      const wx = ((i * 173) % WORLD_W) + 30;
      const wy = WATER_Y + 24 + ((i * 61) % 130);
      ctx.fillRect(wx, wy, 46, 3);
    }
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(PIER_X - 30, HORIZONTAL_ROADS[HORIZONTAL_ROADS.length - 1], 60, 1760 - HORIZONTAL_ROADS[HORIZONTAL_ROADS.length - 1]);
    ctx.fillStyle = COLORS.neonCyan;
    ctx.fillRect(PIER_X - 30, 1748, 60, 4);
    // Buildings with neon signs.
    for (const b of world.buildings) {
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = COLORS.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255, 230, 150, 0.5)';
      for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 10; wy < b.y + b.h - 12; wy += 22) {
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x + 6, b.y - 4, Math.min(52, b.w - 12), 5);
      }
    }
    // Landmark labels.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      if (!lm.label) continue;
      ctx.fillStyle = 'rgba(8, 10, 18, 0.6)';
      const w = ctx.measureText(lm.label).width + 16;
      ctx.fillRect(lm.x - w / 2, lm.y - 34, w, 20);
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(lm.label, lm.x, lm.y - 24);
    }
  }

  drawMarkers(ctx, game) {
    const marker = game.missions.marker();
    if (marker) {
      const pulse = 1 + Math.sin(game.time * 4) * 0.15;
      ctx.save();
      ctx.strokeStyle = COLORS.neonPink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.neonPink;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const step = game.missions.current;
    if (step && step.type === 'collect') {
      for (const item of step.items) {
        if (item.taken) continue;
        ctx.fillStyle = '#c98a3b';
        ctx.fillRect(item.x - 12, item.y - 12, 24, 24);
        ctx.strokeStyle = '#7a5220';
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x - 12, item.y - 12, 24, 24);
        ctx.strokeStyle = '#e8b96a';
        ctx.beginPath();
        ctx.moveTo(item.x - 12, item.y);
        ctx.lineTo(item.x + 12, item.y);
        ctx.stroke();
      }
    }
  }

  drawCarShape(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#101018';
    ctx.fillRect(-24, -13, 48, 26);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-23, -12, 46, 24, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.55)';
    ctx.fillRect(2, -10, 12, 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(20, -10, 3, 5);
    ctx.fillRect(20, 5, 3, 5);
    ctx.fillStyle = '#d64545';
    ctx.fillRect(-23, -10, 3, 5);
    ctx.fillRect(-23, 5, 3, 5);
    if (car.kind === 'cop') {
      ctx.fillStyle = COLORS.copRed;
      ctx.fillRect(-6, -12, 10, 5);
      ctx.fillStyle = COLORS.copBlue;
      ctx.fillRect(-6, 7, 10, 5);
    }
    ctx.restore();
  }

  drawCars(ctx, game) {
    for (const car of game.traffic.cars) {
      if (car.dead) continue;
      this.drawCarShape(ctx, car);
    }
    for (const car of game.police.interceptors) {
      if (car.dead) continue;
      this.drawCarShape(ctx, car);
    }
    if (game.player.inCar) this.drawCarShape(ctx, game.player.inCar);
  }

  drawPeds(ctx, game) {
    for (const ped of game.pedestrians.peds) {
      if (ped.dead) continue;
      const bob = Math.sin(ped.walkPhase) * 1.5;
      ctx.save();
      ctx.translate(ped.x, ped.y + bob * 0.4);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, ped.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlayer(ctx, game) {
    const player = game.player;
    if (player.inCar) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerJacket;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(Math.cos(player.aimAngle || player.angle) * 5, Math.sin(player.aimAngle || player.angle) * 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCops(ctx, game) {
    for (const cop of game.police.footCops) {
      if (cop.dead) continue;
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.fillStyle = '#1c2f55';
      ctx.beginPath();
      ctx.arc(0, 0, cop.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.copBlue;
      ctx.beginPath();
      ctx.arc(0, 0, cop.radius - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d1526';
      ctx.fillRect(-7, -4, 14, 5);
      ctx.restore();
    }
  }

  drawEffects(ctx, game) {
    for (const p of game.effects.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of game.effects.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
