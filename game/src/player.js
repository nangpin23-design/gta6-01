// SUNSET RUN — Nico Ferrante on foot and behind the wheel.
//
// On foot Nico walks where the keys point, aims with the mouse and shoots with
// a click. Near a car, E slides him into the driver's seat; E again steps him
// back out onto the road. Getting into a traffic car is a crime: the city
// notices, and the wanted level climbs.

import { PLAYER, PLACES, WANTED } from './config.js';
import { resolveCircle } from './world.js';
import { addHeat } from './police.js';
import { applyCarControls } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    vx: 0,
    vy: 0,
    hp: PLAYER.maxHp,
    cash: 0,
    inCar: false,
    car: null,
    ammo: PLAYER.startAmmo,
    fireCooldown: 0,
    radius: PLAYER.radius,
  };
}

// The nearest car the player could steal, within reach and not police-driven.
export function nearestStealableCar(state) {
  let best = null;
  let bestD = PLAYER.enterRange;
  for (const car of state.cars) {
    if (car.hp <= 0) continue;
    if (car.driver === 'police') continue;
    if (state.player.car === car) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function stepOut(state) {
  const p = state.player;
  const car = p.car;
  // Step out to the car's left, clear of the road's traffic.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  p.angle = car.angle;
  p.inCar = false;
  p.car = null;
  car.driver = 'none';
  car.speed = 0;
  resolveCircle(state.city, p);
}

function stepIn(state, car) {
  const p = state.player;
  p.inCar = true;
  p.car = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (car.kind !== 'police') {
    addHeat(state, WANTED.heat.steal);
    state.effects.floater(p.x, p.y - 34, 'CAR STOLEN', '#ffcf3d');
    state.audio.crash();
  }
}

// A pistol shot toward the mouse: the first thing in the line of fire within
// range takes the hit — a pedestrian, a police car, or a traffic car.
function shoot(state) {
  const p = state.player;
  if (p.ammo <= 0 || p.fireCooldown > 0) return;
  p.ammo -= 1;
  p.fireCooldown = PLAYER.fireRate;
  state.lastShotAt = state.time;
  state.audio.shot();
  addHeat(state, WANTED.heat.shoot);
  const mx = state.input.mouse.worldX;
  const my = state.input.mouse.worldY;
  const aim = Math.atan2(my - p.y, mx - p.x);
  p.angle = aim;
  const ex = p.x + Math.cos(aim) * PLAYER.bulletRange;
  const ey = p.y + Math.sin(aim) * PLAYER.bulletRange;
  state.effects.muzzle(p.x + Math.cos(aim) * 18, p.y + Math.sin(aim) * 18, aim);
  state.effects.tracer(p.x, p.y, ex, ey);

  let bestD = PLAYER.bulletRange;
  let bestHit = null;
  const consider = (x, y, radius, target) => {
    const dx = x - p.x;
    const dy = y - p.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along <= 0 || along > bestD) return;
    const across = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (across < radius + 6) {
      bestD = along;
      bestHit = target;
    }
  };
  for (const ped of state.peds) {
    if (ped.hp > 0) consider(ped.x, ped.y, 11, { type: 'ped', ped });
  }
  for (const cop of state.cops) {
    if (cop.hp > 0) consider(cop.x, cop.y, 11, { type: 'cop', cop });
  }
  for (const car of state.cars) {
    if (car.hp > 0 && car !== p.car) consider(car.x, car.y, car.radius, { type: 'car', car });
  }
  if (!bestHit) return;
  const hx = p.x + Math.cos(aim) * bestD;
  const hy = p.y + Math.sin(aim) * bestD;
  state.effects.sparks(hx, hy);
  if (bestHit.type === 'ped') {
    bestHit.ped.hp = 0;
    addHeat(state, WANTED.heat.killPed);
    state.effects.floater(hx, hy - 20, 'DOWN', '#ff5a4e');
  } else if (bestHit.type === 'cop') {
    bestHit.cop.hp -= PLAYER.bulletDamage;
    addHeat(state, WANTED.heat.killCop);
  } else {
    bestHit.car.hp -= PLAYER.bulletDamage;
    if (bestHit.car.hp <= 0) {
      state.effects.explosion(bestHit.car.x, bestHit.car.y);
      state.audio.crash();
    }
  }
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.hp <= 0) return;
  p.hp -= amount;
  state.effects.shake(6);
  if (p.hp <= 0) wastePlayer(state);
}

// Nico goes down: the hospital patches him up for a fee, and the heat is
// gone — a fresh start, minus a tenth of his cash.
function wastePlayer(state) {
  const p = state.player;
  p.hp = PLAYER.maxHp;
  const cut = Math.floor(p.cash * WANTED.wastedCut);
  p.cash -= cut;
  if (p.inCar && p.car) {
    p.car.driver = 'none';
    p.car.speed = 0;
    p.car = null;
    p.inCar = false;
  }
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  state.wanted.stars = 0;
  state.wanted.heat = 0;
  for (const car of state.cars) {
    if (car.kind === 'police') car.hp = 0;
  }
  state.cops.length = 0;
  state.mode = 'wasted';
  state.audio.missionFail();
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;

  if (p.inCar && p.car) {
    const car = p.car;
    const up = input.down('KeyW') || input.down('ArrowUp');
    const down = input.down('KeyS') || input.down('ArrowDown');
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const brake = input.down('Space') ? 1 : 0;
    const controls = {
      throttle: up ? 1 : down ? -1 : 0,
      steer: left ? -1 : right ? 1 : 0,
      brake,
    };
    // Driving is the same arcade step traffic uses, from vehicles.js.
    applyCarControls(state, car, controls, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (brake && Math.abs(car.speed) > 140) {
      state.effects.skid(car.x, car.y, car.angle);
    }
    if (input.pressed('KeyE')) stepOut(state);
    return;
  }

  // On foot: walk where the keys point, face the mouse.
  let mx = 0;
  let my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    p.x += (mx / len) * PLAYER.walkSpeed * dt;
    p.y += (my / len) * PLAYER.walkSpeed * dt;
  }
  p.angle = Math.atan2(
    input.mouse.worldY - p.y,
    input.mouse.worldX - p.x,
  );
  resolveCircle(state.city, p);

  if (input.pressed('KeyE')) {
    const car = nearestStealableCar(state);
    if (car) stepIn(state, car);
  }
  if (input.mouse.clicked) {
    input.mouse.clicked = false;
    shoot(state);
  }
}
