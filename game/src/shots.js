// SUNSET RUN — staged scenes for the screenshots.
//
// shots.json lists four shots, each with a query like ?shot=drive&seed=7.
// This module reads that query when the game boots and sets the scene up:
// where Nico stands, what he drives, how hot the city is, which job is open.
// A fixed seed makes the staged scene look the same on every run, so a
// screenshot retaken later still shows the same moment. When the scene is
// settled, __shotReady tells the screenshot tool the frame is good to take.

import { createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { spawnPoliceCarForShot } from './police.js';

// The four staged scenes, keyed by the shot query's name.
export function stageShot(state, shot) {
  const city = state.city;
  const p = state.player;

  if (shot === 'start') {
    // Title screen over the city centre: the camera drifts, the title sits on top.
    state.mode = 'title';
    state.camera.x = 1200;
    state.camera.y = 900;
    return;
  }

  if (shot === 'drive') {
    // Nico in a red Vela, mid-block on Sunset Blvd, job one open, HUD live.
    state.mode = 'playing';
    const car = createCar('vela', 760, 750, 0);
    car.driver = 'player';
    car.speed = 320;
    state.cars.push(car);
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    startMission(state, 0);
    state.message = '';
    return;
  }

  if (shot === 'chase') {
    // Three stars, interceptors closing in from the grid behind him.
    state.mode = 'playing';
    const car = createCar('toro', 1200, 1050, Math.PI);
    car.driver = 'player';
    car.speed = 380;
    state.cars.push(car);
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = Math.PI;
    state.wanted.stars = 3;
    state.wanted.heat = 0.4;
    state.lastCrimeAt = state.time;
    for (let i = 0; i < 3; i += 1) spawnPoliceCarForShot(state);
    startMission(state, 2);
    state.mission.timer = 32;
    state.message = '';
    return;
  }

  if (shot === 'mission') {
    // Job two in progress: package in hand, the marina ahead, waypoint lit.
    state.mode = 'playing';
    p.x = 1350;
    p.y = 470;
    p.angle = Math.PI / 2;
    startMission(state, 1);
    state.mission.stage = 'deliver';
    state.mission.target = { x: 1650, y: 1650, label: 'Marina Aurelia' };
    state.mission.timer = 64;
    state.message = '';
    return;
  }

  // Unknown shot: just play from the title screen.
  state.mode = 'title';
}

// Read the shot name and seed out of the page's URL, if there is one.
export function readShotQuery() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || '7');
  return { shot, seed: Number.isFinite(seed) ? seed : 7 };
}
