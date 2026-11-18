// NEON TIDE — the HUD, drawn on the canvas so it rides along in screenshots:
// cash and wanted stars, the current objective, health and ammo, speed, and a
// live minimap of Calder Bay with the player, the target marker and the cops.

import { COLORS, HORIZONTAL_ROADS, VERTICAL_ROADS, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';

export class Hud {
  draw(ctx, game) {
    const player = game.player;
    const police = game.police;
    const missions = game.missions;
    ctx.save();
    // Top-left: cash + stars.
    this.panel(ctx, 14, 12, 250, 64);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${player.cash}`, 28, 32);
    ctx.font = '20px system-ui, sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < police.stars ? '★' : '☆';
    ctx.fillStyle = police.stars > 0 ? COLORS.starOn : COLORS.starOff;
    ctx.fillText(stars, 28, 60);
    // Top-center: objective.
    const objective = missions.objectiveText();
    ctx.font = '15px system-ui, sans-serif';
    const ow = ctx.measureText(objective).width + 28;
    this.panel(ctx, (VIEW_W - ow) / 2, 12, ow, 34);
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(objective, VIEW_W / 2, 30);
    // Bottom-left: health + ammo.
    this.panel(ctx, 14, VIEW_H - 66, 250, 52);
    ctx.fillStyle = '#333';
    ctx.fillRect(28, VIEW_H - 52, 150, 12);
    ctx.fillStyle = player.hp > 30 ? '#58c96b' : '#d64545';
    ctx.fillRect(28, VIEW_H - 52, 150 * (player.hp / 100), 12);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(player.hp)}`, 186, VIEW_H - 45);
    const reload = player.reloadUntil > 0;
    ctx.fillText(reload ? 'RELOADING…' : `AMMO ${player.ammo}`, 28, VIEW_H - 24);
    // Bottom-right: speed.
    if (player.inCar) {
      this.panel(ctx, VIEW_W - 164, VIEW_H - 66, 150, 52);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(player.inCar.speed) * 0.36)}`, VIEW_W - 56, VIEW_H - 40);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('km/h', VIEW_W - 28, VIEW_H - 40);
    }
    this.drawMinimap(ctx, game);
    ctx.restore();
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = COLORS.hudBg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  drawMinimap(ctx, game) {
    const mw = 220;
    const mh = Math.round((mw * WORLD_H) / WORLD_W);
    const mx = VIEW_W - mw - 14;
    const my = 14;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#16261c';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#123a52';
    ctx.fillRect(mx, my + (1620 / WORLD_H) * mh, mw, mh - (1620 / WORLD_H) * mh);
    ctx.strokeStyle = '#3a3a48';
    ctx.lineWidth = 3;
    for (const rx of VERTICAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of HORIZONTAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    ctx.restore();
    const marker = game.missions.marker();
    if (marker) {
      ctx.fillStyle = COLORS.neonPink;
      ctx.beginPath();
      ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.police.interceptors) {
      ctx.fillStyle = '#5b8cff';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = COLORS.neonAmber;
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudText;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
