// Drawing only: the city, the cars, the people, the effects and the menus,
// from the state in. The camera follows the player with a smooth lag and a
// look-ahead; the 1280x800 logical view is scaled to fit the window. Menus
// are canvas panels with buttons the loop hit-tests through hitButton().

import { FONT, GAME_NAME, GAME_TAGLINE, PALETTE, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_ENDING = 'ending';

const LANDMARK_LABELS = {
  casino: 'MERIDIAN',
  market: 'MARKET',
  garage: 'GARAGE',
  safehouse: 'SAFEHOUSE',
  police: 'POLICE',
  hospital: 'HOSPITAL',
};

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    view.dpr = dpr;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** Convert a canvas pixel into logical view coordinates (for click hit-tests). */
  function toView(px, py) {
    const rect = canvas.getBoundingClientRect();
    const cx = (px - rect.left) * view.dpr;
    const cy = (py - rect.top) * view.dpr;
    return { x: (cx - view.x) / view.scale, y: (cy - view.y) / view.scale };
  }

  function drawShore(state) {
    // Beach and water along the south shore.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, WORLD.beachY, WORLD.size, WORLD.waterY - WORLD.beachY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, WORLD.waterY, WORLD.size, WORLD.size - WORLD.waterY);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.size; x += 90) {
      const wave = Math.sin((x + state.time * 40) * 0.02) * 4;
      ctx.fillRect(x, WORLD.waterY + 26 + wave, 46, 3);
    }
    // Pier planks into the water.
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(860, WORLD.beachY - 30, 90, WORLD.size - WORLD.beachY + 30);
    ctx.fillStyle = '#6d5638';
    for (let y = WORLD.beachY - 20; y < WORLD.size; y += 26) ctx.fillRect(860, y, 90, 3);
  }

  function drawRoads(state) {
    const city = state.city;
    // Runway.
    ctx.fillStyle = '#2f3138';
    ctx.fillRect(city.runway.x, city.runway.y, city.runway.w, city.runway.h);
    ctx.fillStyle = '#e8e4c8';
    for (let x = city.runway.x + 20; x < city.runway.x + city.runway.w - 20; x += 60) {
      ctx.fillRect(x, city.runway.y + city.runway.h / 2 - 2, 30, 4);
    }
    // Roads: asphalt, centre dashes, crosswalks at intersections.
    ctx.fillStyle = PALETTE.asphalt;
    for (const c of city.lines) {
      ctx.fillRect(0, c - WORLD.road / 2, WORLD.size, WORLD.road);
      ctx.fillRect(c - WORLD.road / 2, 0, WORLD.road, WORLD.size);
    }
    ctx.fillStyle = PALETTE.line;
    for (const c of city.lines) {
      for (let p = 0; p < WORLD.size; p += 64) {
        ctx.fillRect(p, c - 2, 30, 4);
        ctx.fillRect(c - 2, p, 4, 30);
      }
    }
    ctx.fillStyle = PALETTE.crosswalk;
    for (const a of city.lines) {
      for (const b of city.lines) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(a + i * 10 - 3, b - WORLD.road / 2 + 4, 6, 12);
          ctx.fillRect(a + i * 10 - 3, b + WORLD.road / 2 - 16, 6, 12);
        }
      }
    }
    // Sidewalk edging around the blocks.
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 3;
    for (const block of city.blocks) {
      ctx.strokeRect(block.x - 6, block.y - 6, block.w + 12, block.h + 12);
    }
  }

  function drawGround(state) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.size, WORLD.size);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < WORLD.size; y += 130) ctx.fillRect(0, y, WORLD.size, 62);
    drawShore(state);
    drawRoads(state);
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // Drop shadow for a little height.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      // Rooftop clutter.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 10, b.y + 12, 16, 12);
      ctx.fillRect(b.x + b.w - 30, b.y + b.h - 26, 20, 14);
      if (b.landmark && LANDMARK_LABELS[b.landmark]) {
        text(LANDMARK_LABELS[b.landmark], b.x + b.w / 2, b.y + b.h / 2 + 5, 15, 'rgba(255,255,255,0.85)', 'center', true);
      }
    }
    // Palms.
    for (const palm of state.city.palms) {
      ctx.fillStyle = '#5d7a48';
      ctx.beginPath();
      ctx.arc(palm.x, palm.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f9a55';
      ctx.beginPath();
      ctx.arc(palm.x - 3, palm.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    const L = 46;
    const W = 22;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRectPath(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 7);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRectPath(ctx, -L / 2, -W / 2, L, W, 7);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = PALETTE.policeTrim;
      ctx.fillRect(-6, -W / 2, 12, W);
    }
    ctx.fillStyle = 'rgba(20,28,40,0.85)';
    ctx.fillRect(-8, -W / 2 + 4, 16, W - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(8, -W / 2 + 4, 8, W - 8);
    // Wheels.
    ctx.fillStyle = '#11141b';
    ctx.fillRect(-L / 2 - 1, -W / 2 - 2, 8, 5);
    ctx.fillRect(-L / 2 - 1, W / 2 - 3, 8, 5);
    ctx.fillRect(L / 2 - 7, -W / 2 - 2, 8, 5);
    ctx.fillRect(L / 2 - 7, W / 2 - 3, 8, 5);
    // Headlights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 4);
    ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 4);
    if (car.kind === 'police' && car.siren) {
      const phase = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath();
      ctx.arc(-2, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? 'rgba(255,46,46,0.25)' : 'rgba(46,107,255,0.25)';
      ctx.beginPath();
      ctx.arc(-2, 0, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (isPlayer) {
      // A gold marker over the player's car.
      ctx.fillStyle = '#ffc23d';
      ctx.beginPath();
      ctx.moveTo(car.x, car.y - 34);
      ctx.lineTo(car.x - 7, car.y - 46);
      ctx.lineTo(car.x + 7, car.y - 46);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, armed) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    if (armed) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);
      ctx.lineTo(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
      ctx.stroke();
    }
  }

  function drawWorld(state) {
    drawGround(state);
    // Skid marks under everything that drives.
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 5;
    for (const skid of state.effects.skids) {
      ctx.beginPath();
      ctx.moveTo(skid.x - Math.cos(skid.angle) * 12, skid.y - Math.sin(skid.angle) * 12);
      ctx.lineTo(skid.x + Math.cos(skid.angle) * 12, skid.y + Math.sin(skid.angle) * 12);
      ctx.stroke();
    }
    drawBuildings(state);
    for (const car of state.cars) {
      if (car.hp <= 0) {
        // A burnt-out shell.
        ctx.fillStyle = 'rgba(20,20,20,0.7)';
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        roundRectPath(ctx, -23, -11, 46, 22, 7);
        ctx.fill();
        ctx.restore();
        continue;
      }
      drawCarShape(car, car.driver === 'player');
    }
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, false);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1c3a6e', true);
    }
    for (const enemy of state.enemies) {
      drawPerson(enemy.x, enemy.y, enemy.angle, '#7a1f1f', true);
    }
    // The player on foot (blinking while invulnerable).
    const player = state.player;
    if (!player.inCar && (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1)) {
      drawPerson(player.x, player.y, player.angle, '#ffc23d', player.weapon !== 'fists');
    }
    // Particles.
    for (const p of state.effects.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    for (const f of state.effects.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / 1.4);
      text(f.text, f.x, f.y, 16, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
  }

  function menuButtons(screen, save) {
    if (screen === SCREEN_TITLE) {
      return save
        ? [{ id: 'continue', label: 'Continue' }, { id: 'new', label: 'New Game' }]
        : [{ id: 'new', label: 'Start Game' }];
    }
    if (screen === SCREEN_PAUSED) {
      return [
        { id: 'resume', label: 'Resume' },
        { id: 'save', label: 'Save Game' },
        { id: 'restart', label: 'Restart Job' },
        { id: 'quit', label: 'Quit to Title' },
      ];
    }
    if (screen === SCREEN_ENDING) return [{ id: 'again', label: 'Play Again' }];
    return [];
  }

  function buttonRects(screen, save) {
    const buttons = menuButtons(screen, save);
    const w = 260;
    const h = 46;
    const gap = 12;
    const total = buttons.length * h + (buttons.length - 1) * gap;
    const x = (VIEW.width - w) / 2;
    let y = VIEW.height / 2 + 96 - total / 2;
    return buttons.map((b) => {
      const rect = { ...b, x, y, w, h };
      y += h + gap;
      return rect;
    });
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(12, 16, 26, 0.82)';
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,194,61,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawButtons(screen, save) {
    for (const b of buttonRects(screen, save)) {
      ctx.fillStyle = '#ffc23d';
      roundRectPath(ctx, b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      text(b.label, b.x + b.w / 2, b.y + 30, 19, '#10131c', 'center', true);
    }
  }

  function drawTitle(state, save) {
    const w = 760;
    const h = 430;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 40;
    drawPanel(x, y, w, h);
    text(GAME_NAME, VIEW.width / 2, y + 92, 64, '#ffc23d', 'center', true);
    text(GAME_TAGLINE, VIEW.width / 2, y + 132, 22, '#f2ead8', 'center');
    text('Dax Marlowe, getaway driver. Five jobs for the fixer Selma Voss.', VIEW.width / 2, y + 176, 17, 'rgba(242,234,216,0.85)', 'center');
    text('One city, one heat. Steal it. Drive it. Lose the heat.', VIEW.width / 2, y + 202, 17, 'rgba(242,234,216,0.85)', 'center');
    text('WASD drive & walk · E steal car · Mouse aim, click shoot · F punch', VIEW.width / 2, y + 252, 16, 'rgba(242,234,216,0.7)', 'center');
    text('Shift run · Space handbrake · P pause · M mute', VIEW.width / 2, y + 278, 16, 'rgba(242,234,216,0.7)', 'center');
    if (save) {
      text(`Save: $${save.money.toLocaleString('en-US')} · ${save.missionsDone} of 5 jobs done`, VIEW.width / 2, y + 318, 15, '#7dd069', 'center', true);
    }
    drawButtons(SCREEN_TITLE, save);
  }

  function drawPause(state) {
    const w = 560;
    const h = 300;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 60;
    drawPanel(x, y, w, h);
    text('Paused', VIEW.width / 2, y + 78, 44, '#f2ead8', 'center', true);
    text('Velmora waits for no one. Well — right now it does.', VIEW.width / 2, y + 118, 16, 'rgba(242,234,216,0.75)', 'center');
    drawButtons(SCREEN_PAUSED, null);
  }

  function drawBusted(state) {
    const w = 560;
    const h = 280;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 40;
    drawPanel(x, y, w, h);
    text('BUSTED', VIEW.width / 2, y + 92, 56, '#ff5a4e', 'center', true);
    text('The Velmora PD has you. The fixer posts your bail.', VIEW.width / 2, y + 140, 17, '#f2ead8', 'center');
    text(`You lost $${state.bustLoss.toLocaleString('en-US')}.`, VIEW.width / 2, y + 170, 17, '#ffc23d', 'center', true);
    text('Click or press Enter to walk free', VIEW.width / 2, y + 224, 16, 'rgba(242,234,216,0.7)', 'center');
  }

  function drawWasted(state) {
    const w = 560;
    const h = 280;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 40;
    drawPanel(x, y, w, h);
    text('WASTED', VIEW.width / 2, y + 92, 56, '#ff5a4e', 'center', true);
    text('St. Anselm patches you up and sends the bill to Selma.', VIEW.width / 2, y + 140, 17, '#f2ead8', 'center');
    text(`You lost $${state.bustLoss.toLocaleString('en-US')}.`, VIEW.width / 2, y + 170, 17, '#ffc23d', 'center', true);
    text('Click or press Enter to get back out there', VIEW.width / 2, y + 224, 16, 'rgba(242,234,216,0.7)', 'center');
  }

  function drawEnding(state) {
    const w = 700;
    const h = 380;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2 - 40;
    drawPanel(x, y, w, h);
    text('LEGEND OF VELMORA', VIEW.width / 2, y + 88, 46, '#ffc23d', 'center', true);
    text('The Meridian job is done. The crew is gone before sunrise,', VIEW.width / 2, y + 140, 17, '#f2ead8', 'center');
    text('and Velmora will be telling this story for years.', VIEW.width / 2, y + 166, 17, '#f2ead8', 'center');
    text(`Final take: $${state.player.money.toLocaleString('en-US')}`, VIEW.width / 2, y + 216, 22, '#7dd069', 'center', true);
    text(`Cars stolen: ${state.stats.carsStolen} · Jobs done: ${state.stats.missionsDone} of 5`, VIEW.width / 2, y + 248, 16, 'rgba(242,234,216,0.8)', 'center');
    drawButtons(SCREEN_ENDING, null);
  }

  /** Paint one frame: the world through the camera, then the HUD or a menu. */
  function draw(state, screen, save, drawHudFn) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10131c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.effects.shakeOffset();
    const camX = state.camera.x + shake.x;
    const camY = state.camera.y + shake.y;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(VIEW.width / 2 - camX, VIEW.height / 2 - camY);
    drawWorld(state);
    ctx.restore();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHudFn(ctx, state);
    if (screen === SCREEN_TITLE) drawTitle(state, save);
    else if (screen === SCREEN_PAUSED) drawPause(state);
    else if (screen === SCREEN_BUSTED) drawBusted(state);
    else if (screen === SCREEN_WASTED) drawWasted(state);
    else if (screen === SCREEN_ENDING) drawEnding(state);
  }

  /** Which menu button, if any, sits under a click given in view coordinates. */
  function hitButton(vx, vy, screen, save) {
    for (const b of buttonRects(screen, save)) {
      if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) return b.id;
    }
    return null;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, hitButton, toView };
}
