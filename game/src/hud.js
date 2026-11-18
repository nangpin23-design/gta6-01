// SUNSET RUN — the HUD: cash, wanted stars, objective, vitals, minimap.
//
// The HUD is drawn on the same canvas as the world, in screen space. The
// minimap is a shrunken Port Aurelia: water, roads, the player in gold, the
// police in red, and the mission target as a pulsing ring.

import { PALETTE, WORLD } from './config.js';
import { missionObjectiveText, missionTarget } from './missions.js';

const MINI_W = 190;
const MINI_H = 142;

function drawMinimap(state) {
  const { ctx, canvas } = state;
  const ox = canvas.width - MINI_W - 16;
  const oy = 16;
  const sx = MINI_W / WORLD.width;
  const sy = MINI_H / WORLD.height;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 10, 18, 0.72)';
  ctx.fillRect(ox - 4, oy - 4, MINI_W + 8, MINI_H + 8);
  // Water along the bottom.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(ox, oy + WORLD.waterY * sy, MINI_W, MINI_H - WORLD.waterY * sy);
  // Roads.
  ctx.strokeStyle = '#8a8378';
  ctx.lineWidth = 1;
  for (const vx of state.city.lines.vertical) {
    ctx.beginPath();
    ctx.moveTo(ox + vx * sx, oy);
    ctx.lineTo(ox + vx * sx, oy + MINI_H);
    ctx.stroke();
  }
  for (const hy of state.city.lines.horizontal) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + hy * sy);
    ctx.lineTo(ox + MINI_W, oy + hy * sy);
    ctx.stroke();
  }
  // Mission target.
  const target = missionTarget(state);
  if (target) {
    const pulse = 4 + Math.sin(state.time * 4) * 1.5;
    ctx.strokeStyle = PALETTE.beacon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + target.x * sx, oy + target.y * sy, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police in red, the player in gold.
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.hp <= 0) continue;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(ox + car.x * sx, oy + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(ox + state.player.x * sx, oy + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ox + state.player.x * sx, oy + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHud(state) {
  const { ctx, canvas } = state;
  const p = state.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Cash and wanted stars, top left.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#7ee081';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 18, 40);
  const stars = '★'.repeat(state.wanted.stars) + '☆'.repeat(5 - state.wanted.stars);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = state.wanted.stars > 0 ? '#ff5a4e' : '#e8e0d0';
  ctx.fillText(stars, 18, 72);

  // Objective, under the stars.
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(missionObjectiveText(state), 18, 100);

  // Health bar and ammo, bottom left.
  const barW = 190;
  ctx.fillStyle = 'rgba(12, 10, 18, 0.7)';
  ctx.fillRect(16, canvas.height - 52, barW + 4, 18);
  ctx.fillStyle = p.hp > 40 ? '#7ee081' : '#ff5a4e';
  ctx.fillRect(18, canvas.height - 50, barW * (p.hp / 100), 14);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 18, canvas.height - 56);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = p.ammo > 0 ? '#ffffff' : '#ff5a4e';
  ctx.fillText(`Ammo ${p.ammo}`, 18, canvas.height - 24);

  // Speed, bottom right, when driving.
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${kmh} km/h`, canvas.width - 20, canvas.height - 26);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#e8e0d0';
    ctx.fillText(p.car.name, canvas.width - 20, canvas.height - 52);
    ctx.textAlign = 'left';
  } else {
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#d8d0c0';
    ctx.fillText('WASD move · Click shoot · E enter car · P pause · M sound', 18, canvas.height - 70);
  }

  // A timed message across the top centre (briefings, paydays).
  if (state.message && state.time - state.messageAt < 5) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf3d';
    ctx.fillText(state.message, canvas.width / 2, 34);
    ctx.textAlign = 'left';
  }

  drawMinimap(state);
  ctx.restore();
}
