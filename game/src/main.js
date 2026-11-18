// SUNSET RUN — boot, the game loop, and the state machine.
//
// One state object holds the whole game: the city, Nico, the cars, the cops,
// the pedestrians, the wanted level, the current job, the effects and the
// audio. The loop steps the simulation, then draws it. The mode decides what
// runs: the title screen drifts over the city, playing runs everything,
// paused freezes it, and busted / wasted wait for Enter before the story
// resumes from the start of the current job.

import { WORLD, TRAFFIC, PEDS, PLACES, SAVE_KEY } from './config.js';
import { makeRng } from './random.js';
import { generateCity } from './world.js';
import { createCar, spawnTraffic, updateTraffic } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { decayWanted, updatePolice } from './police.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { startMission, updateMissions, resetMission } from './missions.js';
import { createEffects, makeEffectsApi, updateEffects } from './effects.js';
import { createAudio, makeAudioApi } from './audio.js';
import { createInput } from './input.js';
import { drawGame, drawTitle, drawPause, drawBusted, drawWasted } from './render.js';
import { readShotQuery, stageShot } from './shots.js';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function createState(canvas) {
  const rng = makeRng(WORLD.seed);
  const city = generateCity(rng);
  const effectsData = createEffects();
  const audioData = createAudio();
  const state = {
    canvas,
    ctx: canvas.getContext('2d'),
    time: 0,
    rng,
    city,
    player: createPlayer(city.spawn.x, city.spawn.y),
    cars: [],
    cops: [],
    peds: [],
    wanted: { stars: 0, heat: 0 },
    lastCrimeAt: -100,
    lastShotAt: -100,
    mission: null,
    storyComplete: false,
    effects: effectsData,
    audio: audioData,
    input: null,
    camera: { x: city.spawn.x, y: city.spawn.y },
    mode: 'title',
    message: '',
    messageAt: -100,
    saveData: loadSave(),
    exhaustTimer: 0,
    frames: 0,
    shot: null,
  };
  Object.assign(state.effects, makeEffectsApi(effectsData));
  Object.assign(state.audio, makeAudioApi(audioData));
  state.save = () => saveGame(state);
  return state;
}

function saveGame(state) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: state.player.cash,
        missionIndex: state.mission ? state.mission.index : 0,
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        hp: Math.ceil(state.player.hp),
        ammo: state.player.ammo,
      }),
    );
    state.saveData = loadSave();
  } catch {
    // Storage unavailable: the game still plays, it just does not persist.
  }
}

function applySave(state) {
  const s = state.saveData;
  if (!s) return false;
  state.player.cash = s.cash || 0;
  state.player.x = s.x;
  state.player.y = s.y;
  state.player.hp = s.hp || 100;
  state.player.ammo = s.ammo ?? 24;
  startMission(state, Math.min(s.missionIndex || 0, 4));
  return true;
}

function startGame(state, continued) {
  state.audio.unlock();
  if (continued && state.saveData) {
    applySave(state);
  } else {
    state.player = createPlayer(state.city.spawn.x, state.city.spawn.y);
    startMission(state, 0);
  }
  state.mode = 'playing';
  state.input.clearPressed();
}

function updateCamera(state, dt) {
  const p = state.player;
  const tx = Math.max(640, Math.min(state.city.width - 640, p.x));
  const ty = Math.max(400, Math.min(state.city.height - 400, p.y));
  const k = 1 - Math.pow(0.001, dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

function update(state, dt) {
  const input = state.input;
  // The mouse aims in world coordinates: screen point plus camera offset.
  input.mouse.worldX = state.camera.x + (input.mouse.x - state.canvas.width / 2);
  input.mouse.worldY = state.camera.y + (input.mouse.y - state.canvas.height / 2);

  if (state.mode === 'title') {
    // A slow drift over the harbour city behind the title panel.
    state.time += dt;
    state.camera.x = 1200 + Math.cos(state.time * 0.07) * 420;
    state.camera.y = 900 + Math.sin(state.time * 0.05) * 260;
    updateEffects(state.effects, dt);
    if (input.mouse.clicked) {
      input.mouse.clicked = false;
      startGame(state, false);
    } else if (input.pressed('KeyC') && state.saveData) {
      startGame(state, true);
    } else if (input.pressed('Enter') || input.pressed('Space')) {
      startGame(state, false);
    }
    return;
  }

  if (state.mode === 'paused') {
    if (input.pressed('KeyP') || input.mouse.clicked) {
      input.mouse.clicked = false;
      state.mode = 'playing';
      input.clearPressed();
    } else if (input.pressed('KeyS')) {
      saveGame(state);
      state.message = 'Game saved.';
      state.messageAt = state.time;
    } else if (input.pressed('KeyM')) {
      state.audio.setMuted(!state.audio.muted);
    }
    return;
  }

  if (state.mode === 'busted' || state.mode === 'wasted') {
    if (input.pressed('Enter') || input.mouse.clicked) {
      input.mouse.clicked = false;
      resetMission(state);
      state.mode = 'playing';
      input.clearPressed();
    }
    return;
  }

  // Playing.
  state.time += dt;
  if (input.pressed('KeyP')) {
    state.mode = 'paused';
    input.clearPressed();
    return;
  }
  if (input.pressed('KeyM')) state.audio.setMuted(!state.audio.muted);
  if (input.pressed('KeyS')) {
    saveGame(state);
    state.message = 'Game saved.';
    state.messageAt = state.time;
  }

  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePolice(state, dt);
  decayWanted(state, dt);
  updatePeds(state, dt);
  updateMissions(state, dt);
  updateEffects(state.effects, dt);

  // A destroyed player car goes up in smoke and throws Nico out on foot.
  const p = state.player;
  if (p.inCar && p.car && p.car.hp <= 0) {
    const car = p.car;
    state.effects.explosion(car.x, car.y);
    state.audio.crash();
    state.cars.splice(state.cars.indexOf(car), 1);
    p.inCar = false;
    p.car = null;
    p.hp = Math.max(1, p.hp - 20);
  }

  // Exhaust puffs behind a fast car.
  if (p.inCar && p.car && Math.abs(p.car.speed) > 130) {
    state.exhaustTimer -= dt;
    if (state.exhaustTimer <= 0) {
      state.exhaustTimer = 0.12;
      const back = p.car.angle + Math.PI;
      state.effects.exhaust(
        p.car.x + Math.cos(back) * 20,
        p.car.y + Math.sin(back) * 20,
      );
    }
  }

  // Sound follows the drive: engine by speed, siren by the nearest cop car.
  if (p.inCar && p.car) {
    state.audio.engine(p.car.speed, p.car.topSpeed);
  } else {
    state.audio.engine(0, 1);
  }
  let nearestCop = null;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.hp <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (nearestCop === null || d < nearestCop) nearestCop = d;
  }
  state.audio.siren(nearestCop);

  updateCamera(state, dt);
}

function render(state) {
  state.frames += 1;
  if (state.mode === 'title') drawTitle(state);
  else if (state.mode === 'paused') drawPause(state);
  else if (state.mode === 'busted') drawBusted(state);
  else if (state.mode === 'wasted') drawWasted(state);
  else drawGame(state);

  // Staged screenshots: the frame is ready once the scene has settled.
  if (state.shot && !window.__shotReady && state.time > 1.5 && state.frames > 5) {
    window.__shotReady = true;
  }
}

const canvas = document.getElementById('game');
const state = createState(canvas);
state.input = createInput(canvas);
spawnTraffic(state, TRAFFIC.count);
spawnPeds(state, PEDS.count);
startMission(state, 0);

// A staged screenshot sets the scene up before the first frame.
const { shot } = readShotQuery();
if (shot) {
  state.shot = shot;
  stageShot(state, shot);
}

// For debugging in the browser console: window.__game.
window.__game = state;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(state, dt);
  render(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
