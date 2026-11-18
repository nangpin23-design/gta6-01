// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh seeded world for a fixed number of
// steps. The car the player rides is driven by the traffic AI for the scene,
// so it stays on the roads and keeps moving; the same seed always stages the
// same scene.

import { applyCarControls, nearestCar } from './vehicles.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';

const STEP = 1 / 60;
const START_SECONDS = 6;
const DRIVE_SECONDS = 5;
const CHASE_SECONDS = 4;
const MISSION_SECONDS = 4;
// The chase runs straight east along the 1274 road, so the car is always mid-flight.
const CHASE_ROAD_Y = 1274;

/** Put the player in a car placed on a road centreline, facing along it. */
function putPlayerInCar(state, car, x, y, dir) {
  car.x = x;
  car.y = y;
  car.dir = dir;
  car.angle = dir * Math.PI / 2;
  car.speed = 300;
  car.target = null;
  car.driver = 'player';
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/**
 * Step the world while the player's car is driven by the traffic AI: it
 * follows the road grid and turns at intersections, so the shot shows a real
 * drive. A drive function overrides the traffic AI for that car (the chase
 * runs straight, so the car is mid-flight at capture instead of mid-turn).
 */
function stepWorld(state, seconds, driveCar, driveFn) {
  if (driveCar && !driveFn) driveCar.driver = 'traffic';
  for (let i = 0; i < seconds / STEP; i += 1) {
    if (driveCar && driveFn) driveFn(state, driveCar, STEP);
    state.step(STEP);
  }
  if (driveCar) {
    driveCar.driver = 'player';
    driveCar.target = null;
  }
}

/** Hold a car on the chase road at speed: aim 300 ahead along the same road. */
function driveChaseStraight(state, car, dt) {
  const want = Math.atan2(CHASE_ROAD_Y - car.y, 300);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  applyCarControls(state, car, {
    throttle: Math.abs(car.speed) < 380 ? 1 : 0.3,
    steer: Math.max(-1, Math.min(1, diff * 2.5)),
    brake: 0,
  }, dt);
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Any other name stages the title screen.
 */
export function stageShot(name, state) {
  // The camera follows the player only on the play screen: set it before the
  // simulation runs, or the title pan steers the camera instead.
  state.screen = (name === 'drive' || name === 'chase' || name === 'mission') ? 'play' : 'title';
  state.reset();
  const player = state.player;

  if (name === 'drive') {
    startMission(state, 0);
    const car = nearestCar(state, player.x, player.y, 1200) || state.cars[0];
    // East along the 650 road, through the middle of town.
    putPlayerInCar(state, car, 338, 650, 0);
    stepWorld(state, DRIVE_SECONDS, car);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    startMission(state, 0);
    const car = nearestCar(state, player.x, player.y, 1200) || state.cars[0];
    // East along the 1274 road, straight and fast: the chase stays near the
    // centre of the map and the car is mid-flight at capture, with the whole
    // department closing in behind it. Three stars.
    putPlayerInCar(state, car, 338, CHASE_ROAD_Y, 0);
    addHeat(state, 3.2);
    stepWorld(state, CHASE_SECONDS, car, driveChaseStraight);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Job 2, the courier run: the package is waiting at Marlin Market and the
    // player is driving across town to collect it. The pickup is on foot, so
    // the stage cannot finish while the player is driving — the shot always
    // shows the job in progress.
    startMission(state, 1);
    const car = nearestCar(state, 650, 650, 1200) || state.cars[0];
    // East along the 650 road, toward the market.
    putPlayerInCar(state, car, 650, 650, 0);
    stepWorld(state, MISSION_SECONDS, car);
    return { screen: 'play' };
  }

  // Title: let the city live behind the panel for a few seconds.
  stepWorld(state, START_SECONDS, null);
  return { screen: 'title' };
}
