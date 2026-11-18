// SUNSET RUN — everything the eye sees, on one canvas.
//
// The camera follows Nico (or his car) and the world is drawn in layers:
// ground and grass, harbor water and pier, roads with their sidewalks and
// centre dashes, buildings with roofs and windows, trees, mission beacons,
// cars, pedestrians, officers, Nico himself, and the effects on top. The HUD
// and minimap are drawn by hud.js; the title and pause screens are overlays
// this module draws over a frozen frame of the city.

import { PALETTE, WORLD } from './config.js';
import { drawHud } from './hud.js';
import { missionTarget } from './missions.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWorld(state) {
  const { ctx, city, camera } = state;
  const shakeX = state.effects.shakeAmount ? (Math.random() - 0.5) * state.effects.shakeAmount : 0;
  const shakeY = state.effects.shakeAmount ? (Math.random() - 0.5) * state.effects.shakeAmount : 0;
  ctx.save();
  ctx.translate(state.canvas.width / 2 - camera.x + shakeX, state.canvas.height / 2 - camera.y + shakeY);

  // Ground and grass blocks.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, city.width, city.height);
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = PALETTE.grass;
  for (let i = 0; i < city.lines.vertical.length - 1; i += 1) {
    for (let j = 0; j < city.lines.horizontal.length - 1; j += 1) {
      const bx = city.lines.vertical[i] + half;
      const by = city.lines.horizontal[j] + half;
      const bw = WORLD.roadSpacing - WORLD.roadWidth;
      const bh = WORLD.roadSpacing - WORLD.roadWidth;
      if (by + bh > city.waterY - 30) continue;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Harbor water, with slow travelling wave lines.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, city.waterY, city.width, city.height - city.waterY);
  ctx.strokeStyle = PALETTE.waterDeep;
  ctx.lineWidth = 2;
  for (let x = 0; x < city.width; x += 90) {
    const wave = Math.sin((x + state.time * 40) / 90) * 4;
    ctx.beginPath();
    ctx.moveTo(x, city.waterY + 24 + wave);
    ctx.lineTo(x + 46, city.waterY + 24 + wave);
    ctx.stroke();
  }
  // The pier.
  ctx.fillStyle = PALETTE.pier;
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);

  // Roads: a pale sidewalk underlay, then asphalt, then centre dashes.
  for (const vx of city.lines.vertical) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx - half - 8, 0, WORLD.roadWidth + 16, city.waterY);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(vx - half, 0, WORLD.roadWidth, city.waterY);
  }
  for (const hy of city.lines.horizontal) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, hy - half - 8, city.width, WORLD.roadWidth + 16);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, hy - half, city.width, WORLD.roadWidth);
  }
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const vx of city.lines.vertical) {
    ctx.beginPath();
    ctx.moveTo(vx, 0);
    ctx.lineTo(vx, city.waterY);
    ctx.stroke();
  }
  for (const hy of city.lines.horizontal) {
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(city.width, hy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Skid marks, under the cars.
  for (const skid of state.effects.skids) {
    ctx.save();
    ctx.globalAlpha = (skid.life / skid.maxLife) * 0.5;
    ctx.strokeStyle = '#1d1a18';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(skid.x - Math.cos(skid.angle) * 14, skid.y - Math.sin(skid.angle) * 14);
    ctx.lineTo(skid.x + Math.cos(skid.angle) * 14, skid.y + Math.sin(skid.angle) * 14);
    ctx.stroke();
    ctx.restore();
  }

  // Buildings: coloured walls, a darker roof when the seed says so, and glass.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.roof) {
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    }
    ctx.fillStyle = PALETTE.glass;
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        ctx.fillRect(b.x + 10 + cx * 26, b.y + 10 + cy * 26, 12, 9);
      }
    }
  }

  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d5c2e';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Harbor crates waiting to be collected (mission 4).
  if (state.mission && state.mission.index === 3 && state.mission.stage === 'collect') {
    for (const crate of state.mission.crates) {
      if (crate.taken) continue;
      const pulse = 1 + Math.sin(state.time * 5) * 0.12;
      ctx.fillStyle = '#c98a2e';
      ctx.fillRect(crate.x - 14, crate.y - 14, 28, 28);
      ctx.strokeStyle = PALETTE.beacon;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(crate.x, crate.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The mission beacon: a pulsing ring where the job points.
  const target = missionTarget(state);
  if (target) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = PALETTE.beacon;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.beacon;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCars(state);
  drawPeds(state);
  drawCops(state);
  drawPlayer(state);
  drawEffects(state);

  ctx.restore();

  // Waypoint arrow at the screen edge, pointing at the mission target.
  if (target) drawWaypoint(state, target);
}

function drawCars(state) {
  const { ctx } = state;
  for (const car of state.cars) {
    if (car.hp <= 0) continue;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -car.length / 2 + 2, -car.width / 2 + 3, car.length, car.width, 6);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#151312';
    ctx.fillRect(-car.length / 2 + 3, -car.width / 2 - 3, 9, 5);
    ctx.fillRect(-car.length / 2 + 3, car.width / 2 - 2, 9, 5);
    ctx.fillRect(car.length / 2 - 12, -car.width / 2 - 3, 9, 5);
    ctx.fillRect(car.length / 2 - 12, car.width / 2 - 2, 9, 5);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = PALETTE.glass;
    ctx.fillRect(car.length / 2 - 12, -car.width / 2 + 3, 6, car.width - 6);
    ctx.fillRect(-car.length / 2 + 5, -car.width / 2 + 3, 5, car.width - 6);
    if (car.kind === 'police') {
      // White doors and the flashing light bar.
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-4, -car.width / 2, 8, car.width);
      const flashing = Math.floor(state.time * 6) % 2 === 0;
      ctx.fillStyle = flashing ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-3, -car.width / 2 - 4, 6, 5);
      ctx.fillStyle = flashing ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-3, car.width / 2 - 1, 6, 5);
    }
    if (car.driver === 'player') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(ctx, -car.length / 2 - 2, -car.width / 2 - 2, car.length + 4, car.width + 4, 8);
      ctx.stroke();
    }
    ctx.restore();
    // Damage smoke from a burning car.
    if (car.hp < car.maxHp * 0.45 && Math.random() < 0.3) {
      state.effects.exhaust(car.x, car.y - 8);
    }
  }
}

function drawPeds(state) {
  const { ctx } = state;
  for (const ped of state.peds) {
    if (ped.hp <= 0) {
      // Fallen: a fading ellipse on the ground.
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ped.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ped.x, ped.y);
    ctx.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
    ctx.stroke();
  }
}

function drawCops(state) {
  const { ctx } = state;
  for (const cop of state.cops) {
    if (cop.hp <= 0) continue;
    ctx.fillStyle = PALETTE.cop;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.cop;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cop.x, cop.y);
    ctx.lineTo(cop.x + Math.cos(cop.angle) * 13, cop.y + Math.sin(cop.angle) * 13);
    ctx.stroke();
  }
}

function drawPlayer(state) {
  const { ctx } = state;
  const p = state.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow and body.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // The pistol points where the mouse points.
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
  ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
  ctx.stroke();
  ctx.restore();
}

function drawEffects(state) {
  const { ctx } = state;
  for (const pt of state.effects.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.tracer) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x2, pt.y2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.effects.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawWaypoint(state, target) {
  const { ctx, canvas, camera } = state;
  const sx = target.x - camera.x + canvas.width / 2;
  const sy = target.y - camera.y + canvas.height / 2;
  if (sx > 40 && sx < canvas.width - 40 && sy > 40 && sy < canvas.height - 40) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(angle) * 320;
  const ey = cy + Math.sin(angle) * 220;
  const dist = Math.hypot(target.x - state.player.x, target.y - state.player.y);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.beacon;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.beacon;
  ctx.fillText(`${target.label || 'Target'} · ${Math.round(dist)}m`, ex, ey + 28);
}

// The playing frame: world, then HUD.
export function drawGame(state) {
  drawWorld(state);
  drawHud(state);
}

function overlayPanel(state, title, lines, hint) {
  const { ctx, canvas } = state;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 8, 20, 0.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 10 + i * 30);
  });
  if (hint) {
    ctx.fillStyle = '#ffcf3d';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(hint, canvas.width / 2, canvas.height / 2 + 130);
  }
  ctx.restore();
}

export function drawTitle(state) {
  drawWorld(state);
  overlayPanel(
    state,
    'SUNSET RUN',
    ['Port Aurelia — a sun-soaked harbor city, and one wheelman who owes', 'Dahlia Moreau five jobs. Steal a car. Run the jobs. Stay free.'],
    state.saveData ? 'Click to Start — or press C to Continue' : 'Click to Start',
  );
}

export function drawPause(state) {
  drawWorld(state);
  drawHud(state);
  overlayPanel(
    state,
    'PAUSED',
    ['P — resume', 'M — sound on/off', 'S — save the game'],
    'Click to resume',
  );
}

export function drawBusted(state) {
  drawWorld(state);
  overlayPanel(
    state,
    'BUSTED',
    ['Aurelia PD caught up with you.', 'They took their cut. The jobs are still waiting.'],
    'Press Enter to walk free',
  );
}

export function drawWasted(state) {
  drawWorld(state);
  overlayPanel(
    state,
    'WASTED',
    ['Nico went down in Port Aurelia.', 'The hospital patched him up — for a fee.'],
    'Press Enter to get back out there',
  );
}
