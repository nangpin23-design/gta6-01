// Dax Marlowe on foot and behind the wheel: walking and running, aiming with
// the mouse, fists and pistol, stealing cars, and the damage the player takes.
// The player object also carries the money, the weapon and the car they drive.

import { ACTION_PUNCH, ACTION_SHOOT } from './input.js';
import { CAR, PLAYER, WANTED, WEAPONS } from './config.js';
import { resolveCircle } from './world.js';
import { applyCarControls, damageCar, nearestCar } from './vehicles.js';
import { addHeat } from './police.js';
import { nearestPed, scarePeds } from './pedestrians.js';

const ENTER_RANGE = 62;
const STEAL_SEEN_RANGE = 280;

// Hurt a person or a car. A kill drops ammo and raises the heat.
function damageTarget(state, target, amount, isCar) {
  if (isCar) {
    damageCar(state, target, amount);
    return;
  }
  target.hp -= amount;
  if (target.hp > 0) return;
  state.effects.sparks(target.x, target.y);
  if (target.alive !== undefined) {
    // A pedestrian: they go down and drop ammo.
    target.alive = false;
    if (target.shirt) state.effects.floater(target.x, target.y - 16, '+6 ammo', '#ffc23d');
  }
  // A foot cop goes down the same way, without the floater.
  state.player.ammo += 6;
  addHeat(state, WANTED.heatPerKill);
  scarePeds(state, target.x, target.y, 300);
}

/** Shoot or punch along the aim angle; returns true when something was hit. */
function attack(state, angle) {
  const player = state.player;
  const weapon = WEAPONS[player.weapon];
  const now = state.time;
  if (now - player.lastAttack < weapon.rate) return false;
  player.lastAttack = now;
  player.attackAngle = angle;
  state.audio.gunshot();
  state.effects.muzzle(player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, angle);

  if (player.weapon === 'fists') {
    state.audio.punch();
    const ped = nearestPed(state, player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, PLAYER.punchRange);
    if (ped) {
      damageTarget(state, ped, weapon.damage, false);
      return true;
    }
    for (const cop of state.cops) {
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < PLAYER.punchRange + 12) {
        damageTarget(state, cop, weapon.damage, false);
        return true;
      }
    }
    return false;
  }

  if (player.ammo <= 0) {
    player.weapon = 'fists';
    return false;
  }
  player.ammo -= 1;
  state.stats.shotsFired += 1;
  addHeat(state, WANTED.heatPerShot);
  scarePeds(state, player.x, player.y, 340);

  // Raycast: the nearest thing the bullet meets along the aim line.
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = null;
  let bestAlong = weapon.range;
  function consider(x, y, radius, target, isCar) {
    const rx = x - player.x;
    const ry = y - player.y;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestAlong) return;
    if (Math.abs(-rx * dy + ry * dx) < radius + 4) {
      best = { target, isCar, along };
      bestAlong = along;
    }
  }
  for (const ped of state.peds) if (ped.alive) consider(ped.x, ped.y, 11, ped, false);
  for (const cop of state.cops) consider(cop.x, cop.y, 12, cop, false);
  for (const car of state.cars) {
    if (car.hp <= 0 || car.driver === 'player') continue;
    consider(car.x, car.y, 22, car, true);
  }
  if (!best) return false;
  state.effects.sparks(player.x + dx * bestAlong, player.y + dy * bestAlong);
  damageTarget(state, best.target, weapon.damage, best.isCar);
  return true;
}

function enterCar(state) {
  const player = state.player;
  const car = nearestCar(state, player.x, player.y, ENTER_RANGE);
  if (!car) return;
  if (car.driver === 'traffic') {
    // The driver bails and runs.
    state.peds.push({
      x: car.x + 24, y: car.y + 24,
      angle: Math.atan2(player.y - car.y, player.x - car.x),
      speed: 230, target: { x: car.x - 260, y: car.y - 260 },
      shirt: '#e84a5f', mood: 'flee', fear: 1, alive: true, hp: 30,
    });
  }
  car.driver = 'player';
  player.inCar = true;
  player.car = car;
  state.audio.pickup();
  state.effects.floater(car.x, car.y - 30, 'Nice ride', '#ffc23d');
  // A theft in front of a cop or a crowd is a crime.
  let seen = false;
  for (const copCar of state.cars) {
    if (copCar.kind === 'police' && Math.hypot(copCar.x - player.x, copCar.y - player.y) < STEAL_SEEN_RANGE) seen = true;
  }
  for (const cop of state.cops) {
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < STEAL_SEEN_RANGE) seen = true;
  }
  for (const ped of state.peds) {
    if (ped.alive && Math.hypot(ped.x - player.x, ped.y - player.y) < 200) seen = true;
  }
  if (seen) addHeat(state, WANTED.heatPerTheft);
  state.stats.carsStolen += 1;
}

function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.vx = 0;
  player.vy = 0;
  car.driver = null;
  car.kind = 'parked';
  car.speed = 0;
  player.inCar = false;
  player.car = null;
}

export function updatePlayer(state, dt, input, actions) {
  const player = state.player;
  if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

  if (player.inCar && player.car) {
    const car = player.car;
    if (car.hp <= 0) {
      // The ride blew up under them (damageCar already played the explosion).
      player.inCar = false;
      player.car = null;
      player.x = car.x + 40;
      player.y = car.y + 40;
      player.hp -= 25;
      return;
    }
    const axes = input.axes();
    const controls = {
      throttle: axes.y < 0 ? 1 : axes.y > 0 ? -0.6 : 0,
      steer: axes.x,
      brake: input.handbrake() ? 1 : 0,
    };
    if (axes.y > 0 && car.speed > 30) controls.brake = 1;
    applyCarControls(state, car, controls, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.vx = Math.cos(car.angle) * car.speed;
    player.vy = Math.sin(car.angle) * car.speed;
    state.audio.engine(Math.abs(car.speed) / CAR.maxSpeed, true);
    if (actions & 4) exitCar(state);
    return;
  }

  state.audio.engine(0, false);
  const axes = input.axes();
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.vx += (axes.x * speed - player.vx) * Math.min(1, dt * 10);
  player.vy += (axes.y * speed - player.vy) * Math.min(1, dt * 10);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const body = { x: player.x, y: player.y, radius: PLAYER.radius };
  resolveCircle(state.city, body);
  player.x = body.x;
  player.y = body.y;

  // Face the mouse.
  const mouse = input.mouse();
  const worldMouse = state.screenToWorld(mouse.x, mouse.y);
  player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);

  if (actions & 4) enterCar(state);
  // F punches (or shoots, with the pistol); a mouse click shoots too.
  if (actions & (ACTION_PUNCH | ACTION_SHOOT)) attack(state, player.angle);
  if (mouse.down) attack(state, player.angle);
  if (actions & 16) {
    player.weapon = player.weapon === 'fists' ? 'pistol' : 'fists';
    if (player.weapon === 'pistol' && player.ammo <= 0) player.weapon = 'fists';
  }

  // Cars hurt when they hit the player on foot.
  for (const car of state.cars) {
    if (car.hp <= 0 || Math.abs(car.speed) < 60) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d >= 30 || player.invulnerable !== 0) continue;
    player.hp -= 12;
    player.invulnerable = 0.9;
    state.effects.addShake(6);
    state.effects.sparks(player.x, player.y);
    player.x += (player.x - car.x) / (d || 1) * 26;
    player.y += (player.y - car.y) / (d || 1) * 26;
    if (car.driver === 'player') break;
  }
}
