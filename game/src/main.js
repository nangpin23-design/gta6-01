// NEON TIDE — the game itself: the loop, the states (title, playing, paused,
// busted, wasted), combat, mission events, saving, and the wiring between every
// module. One Game owns the world, the player, the police, the missions, the
// effects and the sound, and draws them sixty times a second.

import { Sfx } from './audio.js';
import { COLORS, LANDMARKS, PLAYER, VIEW_H, VIEW_W, WANTED } from './config.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Missions } from './missions.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Pedestrians } from './pedestrians.js';
import { Camera, Renderer } from './render.js';
import { stageShot } from './shots.js';
import { Traffic } from './vehicles.js';
import { World } from './world.js';
import { makeRng } from './random.js';

const SAVE_KEY = 'neontide-save-v1';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed') || 1);
    this.world = new World(this.seed);
    this.rng = makeRng(this.seed * 7919 + 13);
    this.traffic = new Traffic(this.world, this.rng);
    this.pedestrians = new Pedestrians(this.world, this.rng);
    this.player = new Player(LANDMARKS.garage.x + 60, LANDMARKS.garage.y + 40);
    this.police = new Police(this.world, this.rng);
    this.missions = new Missions();
    this.effects = new Effects();
    this.sfx = new Sfx();
    this.hud = new Hud();
    this.renderer = new Renderer(this.ctx);
    this.camera = new Camera();
    this.input = new Input(canvas);
    this.state = 'title';
    this.time = 0;
    this.lastRam = 0;
    this.message = '';
    this.messageUntil = 0;
    this.hasSave = false;
    try {
      this.hasSave = !!window.localStorage.getItem(SAVE_KEY);
    } catch {
      this.hasSave = false;
    }
    this.shot = params.get('shot') || null;
    this.frames = 0;
    if (this.shot) stageShot(this, this.shot);
    this.camera.follow(this.player.x, this.player.y);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  showMessage(text, seconds = 3.5) {
    this.message = text;
    this.messageUntil = this.time + seconds;
  }

  save() {
    const data = {
      cash: this.player.cash,
      missionIndex: this.missions.index,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Private mode or no storage: the game still plays.
    }
  }

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.player.cash = data.cash || 0;
      this.player.x = data.x ?? LANDMARKS.garage.x;
      this.player.y = data.y ?? LANDMARKS.garage.y;
      this.player.hp = data.hp || PLAYER.maxHp;
      this.missions.start(Math.min(data.missionIndex || 0, 4));
      return true;
    } catch {
      return false;
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.frames += 1;
    if (this.state === 'paused' && this.input.wasPressed('KeyP', 'Escape')) {
      this.state = 'playing';
      // Swallow this keypress: without it, update() would see the same P and
      // pause again in the very same frame.
      this.input.endFrame();
    }
    if (this.state === 'playing') this.update(dt, now);
    this.render();
    if (this.shot && this.frames === 45) window.__shotReady = true;
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt, now) {
    const input = this.input;
    const player = this.player;
    if (input.wasPressed('KeyP', 'Escape')) {
      this.state = 'paused';
      return;
    }
    if (input.wasPressed('KeyM')) this.sfx.setMuted(!this.sfx.muted);
    if (input.wasPressed('KeyS') && !player.inCar) {
      this.save();
      this.showMessage('Progress saved', 2);
    }
    if (input.wasPressed('KeyR')) player.startReload(now);
    player.finishReload(now);
    // Enter or exit a car.
    if (input.wasPressed('KeyE')) {
      if (player.inCar) {
        player.exitCar();
      } else {
        const car = this.traffic.nearestParked(player.x, player.y, 70);
        if (car) {
          player.tryEnterCar(car, () => {
            this.police.addHeat(WANTED.heatSteal);
            this.sfx.blip(220, 0.15, 'square', 0.07);
            const res = this.missions.onSteal();
            if (res === 'step') this.showMessage('Nice wheels. Now move.');
          });
        }
      }
    }
    // Shooting: click aims at the mouse.
    if (input.clicked && !player.inCar) {
      const worldMouse = this.camera.toWorld(input.mouseX, input.mouseY);
      const shot = player.shoot(now, worldMouse.x, worldMouse.y);
      if (shot) {
        this.sfx.shot();
        this.effects.muzzle(shot.x, shot.y, shot.angle);
        this.effects.addShake(2);
        this.police.addHeat(WANTED.heatShot);
        this.resolveShot(shot);
      }
    }
    if (input.wasPressed('KeyF')) {
      const hit = player.punch([...this.police.footCops, ...this.pedestrians.peds]);
      if (hit) {
        hit.dead = true;
        this.effects.burst(hit.x, hit.y, '#ffd23b', 10, 180);
        this.sfx.noiseBurst(0.08, 900, 0.1);
        if (this.police.footCops.includes(hit)) {
          this.police.addHeat(WANTED.heatCopDown);
        } else {
          this.police.addHeat(WANTED.heatHitPed);
        }
      }
    }
    player.update(dt, input, this.world, this.camera);
    // A fast player car on the kerb can hit a pedestrian.
    if (player.inCar && Math.abs(player.inCar.speed) > 220) {
      const hit = this.pedestrians.hitByCar(player.inCar, Math.abs(player.inCar.speed));
      if (hit) {
        this.police.addHeat(WANTED.heatHitPed);
        this.effects.burst(hit.x, hit.y, '#d64545', 16, 300);
        this.effects.addShake(5);
        this.sfx.crash();
        this.showMessage('You hit a pedestrian! The heat is on.', 3);
      }
    }
    if (player.crashed) {
      player.crashed = false;
      this.effects.addShake(6);
      this.effects.burst(player.x, player.y, '#ffb347', 12, 240);
      this.sfx.crash();
    }
    const danger = player.inCar && Math.abs(player.inCar.speed) > 200 ? player.inCar : null;
    this.pedestrians.update(dt, danger);
    this.traffic.update(dt, player.inCar);
    this.police.update(dt, player, (cop) => {
      // An interceptor ramming the player's car. Cooled down so a long shove
      // is one crash, not a machine-gun of shake and sparks every frame.
      if (now - this.lastRam < 600) return;
      this.lastRam = now;
      if (player.inCar) {
        player.inCar.speed *= 0.6;
        this.effects.addShake(7);
        this.effects.burst(player.x, player.y, '#8fb7ff', 14, 280);
        this.sfx.crash();
      }
    });
    // Arrest: a foot cop close enough grabs Rook.
    const cop = this.police.arrestCheck(player);
    if (cop) {
      this.busted();
      return;
    }
    // Missions.
    const result = this.missions.update(dt, this);
    if (result === 'step') {
      this.sfx.pickup();
      this.showMessage('Step done — keep going.');
    } else if (result === 'complete') {
      const reward = this.missions.reward;
      player.cash += reward;
      this.effects.floatText(player.x, player.y - 30, `+$${reward}`, '#7be07b');
      this.sfx.sting();
      this.showMessage(`Job complete! +$${reward}`, 4);
      // Advance to the next job FIRST, then save: the save must hold the new
      // job, or Continue would restart the one just finished.
      this.missions.nextJob();
      this.save();
    } else if (result === 'failed') {
      this.showMessage('Too slow — Iris gives you another shot.', 4);
      this.missions.start(this.missions.index);
    }
    if (player.isDown()) {
      this.wasted();
      return;
    }
    // Sound follows the drive and the heat.
    this.sfx.resume();
    this.sfx.setEngine(player.inCar ? Math.abs(player.inCar.speed) / 520 : 0);
    this.sfx.setSiren(this.police.stars > 0, dt);
    this.effects.update(dt);
    this.camera.follow(player.x, player.y);
  }

  resolveShot(shot) {
    const dx = Math.cos(shot.angle);
    const dy = Math.sin(shot.angle);
    let best = null;
    let bestAlong = shot.range;
    const targets = [
      ...this.police.footCops.map((c) => ({ e: c, kind: 'cop' })),
      ...this.pedestrians.peds.map((p) => ({ e: p, kind: 'ped' })),
    ];
    for (const { e, kind } of targets) {
      if (e.dead) continue;
      const rx = e.x - shot.x;
      const ry = e.y - shot.y;
      const along = rx * dx + ry * dy;
      if (along < 0 || along > shot.range) continue;
      const perp = Math.abs(-rx * dy + ry * dx);
      if (perp < (e.radius || 11) + 8 && along < bestAlong) {
        bestAlong = along;
        best = { e, kind };
      }
    }
    if (!best) return;
    const hitX = shot.x + dx * bestAlong;
    const hitY = shot.y + dy * bestAlong;
    this.effects.burst(hitX, hitY, '#d64545', 12, 240);
    best.e.dead = true;
    if (best.kind === 'cop') {
      this.police.addHeat(WANTED.heatCopDown);
      this.showMessage('You dropped a cop. That will cost you.', 3);
    } else {
      this.police.addHeat(WANTED.heatHitPed);
      this.showMessage('You hit a pedestrian! The heat is on.', 3);
    }
  }

  busted() {
    const cut = Math.round(this.player.cash * WANTED.bustCut);
    this.player.cash -= cut;
    this.player.hp = PLAYER.maxHp;
    this.player.inCar = null;
    this.police.clearHeat();
    this.player.x = LANDMARKS.policeStation.x + 40;
    this.player.y = LANDMARKS.policeStation.y;
    this.sfx.busted();
    this.state = 'busted';
    this.showMessage(`BUSTED — Calder PD took $${cut}`, 4);
    this.save();
  }

  wasted() {
    const cut = Math.round(this.player.cash * WANTED.wastedCut);
    this.player.cash -= cut;
    this.player.hp = PLAYER.maxHp;
    this.player.inCar = null;
    this.police.clearHeat();
    this.player.x = LANDMARKS.hospital.x + 40;
    this.player.y = LANDMARKS.hospital.y;
    this.sfx.busted();
    this.state = 'wasted';
    this.showMessage(`WASTED — the hospital took $${cut}`, 4);
    this.save();
  }

  render() {
    const ctx = this.ctx;
    if (this.state === 'title') {
      this.drawTitle(ctx);
      return;
    }
    this.renderer.draw(this);
    this.hud.draw(ctx, this);
    if (this.time < this.messageUntil && this.message) {
      ctx.save();
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.message).width + 32;
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.roundRect((VIEW_W - w) / 2, VIEW_H - 116, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(this.message, VIEW_W / 2, VIEW_H - 99);
      ctx.restore();
    }
    if (this.state === 'paused') this.drawOverlay(ctx, 'PAUSED', 'Press P to keep playing');
    if (this.state === 'busted') this.drawOverlay(ctx, 'BUSTED', 'Press Enter to walk out of Calder PD');
    if (this.state === 'wasted') this.drawOverlay(ctx, 'WASTED', 'Press Enter to leave St. Sol Hospital');
    if ((this.state === 'busted' || this.state === 'wasted') && this.input.wasPressed('Enter')) {
      this.state = 'playing';
    }
  }

  drawTitle(ctx) {
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.fillText('NEON TIDE', VIEW_W / 2, 260);
    ctx.fillStyle = COLORS.neonCyan;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('C A L D E R   B A Y', VIEW_W / 2, 316);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Rook Delgado drives for fixer Iris Vane. Five jobs. One city. No way out but through.', VIEW_W / 2, 380);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#b9b9c9';
    ctx.fillText('WASD move / drive · E steal & enter car · Click shoot · F punch · R reload · S save · P pause', VIEW_W / 2, 440);
    ctx.fillText('Steal cars, dodge the law, run the jobs — and watch the stars.', VIEW_W / 2, 470);
    ctx.fillStyle = COLORS.neonAmber;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(this.hasSave ? 'Press Enter to play — or C to Continue your last run' : 'Press Enter to play', VIEW_W / 2, 540);
    ctx.restore();
    if (this.input.wasPressed('Enter')) {
      this.state = 'playing';
      this.sfx.resume();
      this.showMessage(`Job 1/5 · ${this.missions.name}: ${this.missions.brief}`, 5);
    }
    if (this.hasSave && this.input.wasPressed('KeyC')) {
      if (this.load()) {
        this.state = 'playing';
        this.sfx.resume();
        this.showMessage('Welcome back, Rook.', 3);
      }
    }
  }

  drawOverlay(ctx, big, small) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.neonPink;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(big, VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(small, VIEW_W / 2, VIEW_H / 2 + 36);
    ctx.restore();
  }
}

const canvas = document.getElementById('game');
if (canvas) {
  const game = new Game(canvas);
  window.__neonTide = game;
}
