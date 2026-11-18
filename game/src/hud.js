// The HUD: health, money, wanted stars, weapon and speed, the mission
// objective, the waypoint arrow and the minimap. All of it is drawn on the
// game canvas so the screenshots show exactly what the player sees.

import { FONT, PALETTE, PLACES, VIEW, WANTED, WEAPONS, WORLD } from './config.js';
import { currentStage, missionMarker } from './missions.js';

const MINIMAP = { x: 18, y: VIEW.height - 178, size: 160 };

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

// One five-pointed star, filled.
function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStars(ctx, stars) {
  const x0 = VIEW.width - 210;
  const y0 = 30;
  panel(ctx, x0 - 12, 12, 210, 44);
  text(ctx, 'WANTED', x0, y0 + 6, 13, PALETTE.hudText, 'left', true);
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.hudDanger : 'rgba(255,255,255,0.22)';
    drawStar(ctx, x0 + 74 + i * 24, y0 + 6, 10);
  }
}

function drawMinimap(ctx, state) {
  const { x, y, size } = MINIMAP;
  const scale = size / WORLD.size;
  panel(ctx, x - 6, y - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = PALETTE.minimapBlock;
  ctx.fillRect(x, y, size, size);
  // Water along the south shore.
  ctx.fillStyle = PALETTE.minimapWater;
  ctx.fillRect(x, y + WORLD.waterY * scale, size, size - WORLD.waterY * scale);
  // Roads.
  ctx.fillStyle = PALETTE.minimapRoad;
  for (const c of state.city.lines) {
    ctx.fillRect(x, y + c * scale - 2, size, 4);
    ctx.fillRect(x + c * scale - 2, y, 4, size);
  }
  // Named places.
  ctx.fillStyle = PALETTE.hudAccent;
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    ctx.fillRect(x + p.x * scale - 2, y + p.y * scale - 2, 4, 4);
  }
  // Mission marker.
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = PALETTE.minimapMission;
    ctx.beginPath();
    ctx.arc(x + marker.x * scale, y + marker.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = PALETTE.minimapPolice;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x + state.player.x * scale;
  const py = y + state.player.y * scale;
  ctx.fillStyle = PALETTE.minimapPlayer;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10131c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(state.player.angle) * 9, py + Math.sin(state.player.angle) * 9);
  ctx.lineTo(px - Math.cos(state.player.angle + 0.5) * 6, py - Math.sin(state.player.angle + 0.5) * 6);
  ctx.lineTo(px - Math.cos(state.player.angle - 0.5) * 6, py - Math.sin(state.player.angle - 0.5) * 6);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  text(ctx, 'VELMORA', x + size / 2, y - 12, 12, PALETTE.hudText, 'center', true);
}

function drawObjective(ctx, state) {
  const stage = currentStage(state);
  if (!stage) return;
  ctx.font = `600 17px ${FONT}`;
  const w = Math.min(620, ctx.measureText(stage.text).width + 30);
  const x = (VIEW.width - w) / 2;
  const y = 14;
  panel(ctx, x, y, w, 34);
  ctx.fillStyle = PALETTE.minimapMission;
  ctx.beginPath();
  ctx.arc(x + 18, y + 17, 5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, stage.text, x + 32, y + 23, 16, PALETTE.hudText, 'left');
  if (state.mission && state.mission.def) {
    text(ctx, state.mission.def.title, VIEW.width / 2, y + 52, 13, 'rgba(242,234,216,0.75)', 'center');
  }
}

function drawWaypoint(ctx, state) {
  const marker = missionMarker(state);
  if (!marker) return;
  const dx = marker.x - state.player.x;
  const dy = marker.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 90) return;
  const angle = Math.atan2(dy, dx);
  const ax = VIEW.width / 2 + Math.cos(angle) * 150;
  const ay = VIEW.height / 2 + Math.sin(angle) * 150;
  ctx.fillStyle = PALETTE.minimapMission;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -9);
  ctx.lineTo(-10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, `${Math.round(dist)}m`, ax, ay + 26, 13, PALETTE.hudText, 'center', true);
}

// Split a banner into lines that fit maxWidth.
function wrapLines(ctx, value, maxWidth, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = value.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawHud(ctx, state) {
  const player = state.player;
  // Top-left: health and money.
  panel(ctx, 18, 14, 240, 78);
  text(ctx, 'DAX MARLOWE', 30, 38, 14, PALETTE.hudText, 'left', true);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(30, 46, 216, 10);
  ctx.fillStyle = player.hp > 35 ? '#7dd069' : PALETTE.hudDanger;
  ctx.fillRect(30, 46, 216 * Math.max(0, player.hp / 100), 10);
  text(ctx, `$${player.money.toLocaleString('en-US')}`, 30, 82, 20, PALETTE.hudAccent, 'left', true);

  drawStars(ctx, state.wanted.stars);
  drawObjective(ctx, state);
  drawWaypoint(ctx, state);
  drawMinimap(ctx, state);

  // Bottom-right: weapon and speed.
  const weapon = WEAPONS[player.weapon];
  const ammo = player.weapon === 'fists' ? '∞' : `${player.ammo}`;
  panel(ctx, VIEW.width - 218, VIEW.height - 62, 200, 48);
  text(ctx, weapon.name, VIEW.width - 206, VIEW.height - 38, 16, PALETTE.hudText, 'left', true);
  text(ctx, ammo, VIEW.width - 30, VIEW.height - 38, 16, PALETTE.hudAccent, 'right', true);
  if (player.inCar && player.car) {
    text(ctx, `${Math.round(Math.abs(player.car.speed) * 0.24)} km/h`, VIEW.width - 206, VIEW.height - 18, 13, 'rgba(242,234,216,0.75)', 'left');
    if (player.car.hp < 100) {
      text(ctx, `CAR ${Math.max(0, Math.round(player.car.hp))}%`, VIEW.width - 30, VIEW.height - 18, 13, PALETTE.hudDanger, 'right', true);
    }
  } else {
    text(ctx, 'on foot — E to steal a car', VIEW.width - 206, VIEW.height - 18, 12, 'rgba(242,234,216,0.6)', 'left');
  }

  // Banner (mission brief or completion).
  const mission = state.mission;
  if (mission && mission.banner && state.time < mission.bannerUntil) {
    const lines = wrapLines(ctx, mission.banner, 560, 18);
    const h = 20 + lines.length * 24 + 16;
    const w = 600;
    const bx = (VIEW.width - w) / 2;
    const by = 110;
    panel(ctx, bx, by, w, h);
    lines.forEach((line, i) => text(ctx, line, VIEW.width / 2, by + 28 + i * 24, 17, PALETTE.hudText, 'center'));
  }
}
