// VELMORA HEAT — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between title, play, paused, busted, wasted and ending screens.
//
// ?seed=N fixes the city's random layout. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot. window.__game exposes
// the state and a few debug helpers the play-test uses; it changes nothing
// about normal play.

import { CAR, MISSIONS, PLACES, PLAYER, SAVE_KEY, TRAFFIC, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildCity } from './world.js';
import { spawnParked, spawnTraffic, updateCars } from './vehicles.js';
import { spawnPedestrians, updatePeds } from './pedestrians.js';
import { addHeat, decayWanted, updatePolice } from './police.js';
import { updatePlayer } from './player.js';
import { startMission, updateEnemies, updateMissions } from './missions.js';
import { drawHud } from './hud.js';
import { createRenderer } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const effects = createEffects();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.money !== 'number' || typeof save.missionsDone !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function freshPlayer() {
  return {
    x: PLACES.garage.x, y: PLACES.garage.y + 120,
    angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: PLAYER.hp, money: 150,
    weapon: 'fists', ammo: 24,
    inCar: false, car: null,
    invulnerable: 0, lastAttack: -10, attackAngle: 0,
  };
}

const state = {
  time: 0,
  seed,
  rng: createRandom(seed),
  city: null,
  player: freshPlayer(),
  cars: [],
  peds: [],
  cops: [],
  enemies: [],
  wanted: { stars: 0, heat: 0 },
  lastCrimeAt: -100,
  mission: null,
  camera: { x: 1180, y: 1180 },
  effects,
  audio,
  stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0 },
  screen: 'title',
  pendingBust: false,
  bustLoss: 0,
  trafficCount: TRAFFIC.cars,
  parkedCount: TRAFFIC.parked,
  pedCount: TRAFFIC.peds,
  save: readSave(),
};

state.addHeat = (amount) => addHeat(state, amount);

state.saveGame = () => {
  const save = {
    money: state.player.money,
    missionsDone: state.stats.missionsDone,
    weapon: state.player.weapon,
    ammo: state.player.ammo,
  };
  state.save = save;
  writeSave(save);
};

state.screenToWorld = (sx, sy) => {
  const view = renderer.toView(sx, sy);
  return {
    x: state.camera.x + (view.x - 640),
    y: state.camera.y + (view.y - 400),
  };
};

function buildWorld() {
  state.rng = createRandom(state.seed);
  state.city = buildCity(state.rng);
  state.cars = [];
  state.peds = [];
  state.cops = [];
  state.enemies = [];
  state.wanted = { stars: 0, heat: 0 };
  state.lastCrimeAt = -100;
  state.pendingBust = false;
  spawnTraffic(state);
  spawnParked(state);
  spawnPedestrians(state);
}

state.reset = () => {
  state.time = 0;
  state.player = freshPlayer();
  state.stats = { carsStolen: 0, missionsDone: 0, shotsFired: 0 };
  state.mission = null;
  state.camera = { x: 1180, y: 1180 };
  buildWorld();
};

function updateCamera(dt) {
  let tx = state.player.x + state.player.vx * 0.22;
  let ty = state.player.y + state.player.vy * 0.22;
  if (state.screen === 'title') {
    tx = 1180 + Math.cos(state.time * 0.08) * 420;
    ty = 1180 + Math.sin(state.time * 0.08) * 300;
  }
  const k = Math.min(1, dt * 4.5);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
  state.camera.x = Math.max(640, Math.min(WORLD.size - 640, state.camera.x));
  state.camera.y = Math.max(400, Math.min(WORLD.size - 400, state.camera.y));
}

/** One fixed simulation step. input/actions are absent on the title screen and in shots. */
state.step = (dt, input, actions) => {
  state.time += dt;
  // The player rides the car even when no input is read (title backdrop,
  // shots): keep their position, angle and velocity on the car they drive.
  if (state.player.inCar && state.player.car) {
    const car = state.player.car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    state.player.vx = Math.cos(car.angle) * car.speed;
    state.player.vy = Math.sin(car.angle) * car.speed;
  }
  if (input) updatePlayer(state, dt, input, actions || 0);
  updateCars(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  decayWanted(state, dt);
  updateMissions(state, dt);
  updateEnemies(state, dt);
  effects.update(dt);
  updateCamera(dt);
  if (state.pendingBust) {
    state.pendingBust = false;
    bustPlayer();
  }
  if (state.player.hp <= 0 && state.screen === 'play') wastePlayer();
};

// Leave the car where it stands, parked and driverless.
function leaveCar() {
  if (state.player.inCar && state.player.car) {
    state.player.car.driver = null;
    state.player.car.kind = 'parked';
    state.player.inCar = false;
    state.player.car = null;
  }
}

// Take 15% of the player's money and reset them for a fresh start.
function takeBustLoss() {
  const loss = Math.max(0, Math.floor(state.player.money * 0.15));
  state.player.money -= loss;
  state.bustLoss = loss;
  state.player.hp = PLAYER.hp;
  state.wanted = { stars: 0, heat: 0 };
  state.cops.length = 0;
}

function bustPlayer() {
  takeBustLoss();
  leaveCar();
  state.player.x = PLACES.police.x;
  state.player.y = PLACES.police.y + 130;
  state.player.vx = 0;
  state.player.vy = 0;
  state.screen = 'busted';
  audio.busted();
  announce('Busted. The Velmora PD has you.');
}

function wastePlayer() {
  takeBustLoss();
  leaveCar();
  state.player.x = PLACES.hospital.x;
  state.player.y = PLACES.hospital.y + 140;
  state.player.vx = 0;
  state.player.vy = 0;
  state.screen = 'wasted';
  audio.busted();
  announce('Wasted. St. Anselm patches you up.');
}

function announce(message) {
  status.textContent = message;
}

function startGame(continueSave) {
  state.reset();
  if (continueSave && state.save) {
    state.player.money = state.save.money;
    state.stats.missionsDone = state.save.missionsDone;
    state.player.weapon = state.save.weapon || 'fists';
    state.player.ammo = state.save.ammo ?? 24;
    startMission(state, Math.min(state.save.missionsDone, MISSIONS.length - 1));
  } else {
    state.save = null;
    startMission(state, 0);
  }
  audio.unlock();
  audio.startMusic();
  state.screen = 'play';
  announce('Playing. Follow the yellow marker.');
}

function restartJob() {
  const index = state.mission ? state.mission.index : 0;
  state.player.hp = PLAYER.hp;
  state.wanted = { stars: 0, heat: 0 };
  state.cops.length = 0;
  state.enemies.length = 0;
  leaveCar();
  state.player.x = PLACES.garage.x;
  state.player.y = PLACES.garage.y + 120;
  state.player.vx = 0;
  state.player.vy = 0;
  startMission(state, index);
  state.screen = 'play';
}

function runShot(name) {
  const scene = stageShot(name, state);
  state.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, state.save, drawHud);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleClick() {
    if (!input.takeClick()) return;
    const mouse = input.mouse();
    const view = renderer.toView(mouse.x, mouse.y);
    if (state.screen === 'title') {
      const id = renderer.hitButton(view.x, view.y, 'title', state.save);
      if (id === 'continue') startGame(true);
      else if (id === 'new') startGame(false);
      return;
    }
    if (state.screen === 'paused') {
      const id = renderer.hitButton(view.x, view.y, 'paused', null);
      if (id === 'resume') state.screen = 'play';
      else if (id === 'save') {
        state.saveGame();
        effects.floater(state.player.x, state.player.y - 30, 'Saved', '#7dd069');
      } else if (id === 'restart') restartJob();
      else if (id === 'quit') {
        state.screen = 'title';
        state.save = readSave();
      }
      return;
    }
    if (state.screen === 'ending') {
      const id = renderer.hitButton(view.x, view.y, 'ending', null);
      if (id === 'again') startGame(false);
      return;
    }
    if (state.screen === 'busted' || state.screen === 'wasted') {
      state.screen = 'play';
      announce('Playing. Follow the yellow marker.');
    }
  }

  function handleScreenActions(actions) {
    if (input.takeMute()) {
      audio.setMuted(!audio.isMuted());
    }
    if (state.screen === 'title' && (actions & ACTION_CONFIRM)) startGame(false);
    else if (state.screen === 'play' && (actions & ACTION_PAUSE)) {
      state.screen = 'paused';
      announce('Paused.');
    } else if (state.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      state.screen = 'play';
      announce('Playing.');
    } else if ((state.screen === 'busted' || state.screen === 'wasted') && (actions & ACTION_CONFIRM)) {
      state.screen = 'play';
      announce('Playing. Follow the yellow marker.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const screenBefore = state.screen;
    handleClick();
    // Take the one-shot presses once per frame: the screen handler reads
    // them, and the first simulation step of this frame carries them to the
    // player.
    const actions = input.takeActions();
    handleScreenActions(actions);
    // A press that changed screens (Start, Resume, Continue, pause) must not
    // also act inside the world on the same frame — the click that starts the
    // game must not fire a shot.
    const worldActions = state.screen === screenBefore ? actions : 0;
    if (state.screen === 'title' || state.screen === 'play') {
      let stepActions = worldActions;
      while (accumulator >= STEP && (state.screen === 'title' || state.screen === 'play')) {
        state.step(STEP, state.screen === 'play' ? input : null, stepActions);
        stepActions = 0;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (state.screen === 'paused') effects.update(0);
    renderer.draw(state, state.screen, state.save, drawHud);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('VELMORA HEAT. Click to start.');
  requestAnimationFrame(frame);
}

// Debug hooks for the play-test: they change nothing about normal play.
window.__game = {
  state,
  startMission: (index) => startMission(state, index),
  setWanted: (stars) => {
    state.wanted.stars = Math.max(0, Math.min(5, stars));
    state.wanted.heat = 0.5;
    state.lastCrimeAt = state.time;
  },
  teleport: (x, y) => {
    state.player.x = x;
    state.player.y = y;
    state.player.vx = 0;
    state.player.vy = 0;
  },
  completeStage: () => {
    const mission = state.mission;
    if (mission && mission.active) {
      mission.stage += 1;
      if (mission.stage >= mission.def.stages.length) {
        state.player.money += mission.def.reward;
        mission.active = false;
        state.stats.missionsDone += 1;
      }
    }
  },
};

buildWorld();
if (shot) runShot(shot);
else runGame();
