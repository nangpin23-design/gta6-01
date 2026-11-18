// NEON TIDE — screenshot staging. The URL query ?shot=start|drive|chase|mission
// (with &seed=1) puts the game into a fixed, readable scene for the camera, so
// each of the four screenshots shows a different system at its best: the title,
// driving with the HUD and minimap, a police chase with wanted stars, and a
// mission in progress. The staged scenes are deterministic: same seed, same shot.

import { LANDMARKS } from './config.js';
import { Car } from './vehicles.js';

export function stageShot(game, shot) {
  const player = game.player;
  const world = game.world;
  if (shot === 'start') {
    game.state = 'title';
    return;
  }
  game.state = 'playing';
  game.startedAt = performance.now();
  if (shot === 'drive') {
    // Rook in a car on the midtown road, mission one open, no heat.
    const car = new Car(1080, 880, 0, '#c23b3b', 'player');
    game.traffic.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    car.cruiseSpeed = 300;
    game.missions.start(0);
    game.missions.onSteal();
    game.camera.follow(player.x, player.y);
    return;
  }
  if (shot === 'chase') {
    // Three stars, three interceptors closing in behind the car.
    const car = new Car(1080, 1180, 0, '#c23b3b', 'player');
    game.traffic.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    car.cruiseSpeed = 340;
    game.police.heat = 55;
    game.police.cleanTimer = 0;
    // Three interceptors closing in from behind, staggered so they are all in
    // frame but none has reached the player yet when the camera fires.
    for (let i = 0; i < 3; i += 1) {
      const cop = new Car(car.x - 300 - i * 150, car.y + (i - 1) * 46, 0, '#2f6fd6', 'cop');
      cop.speed = 360;
      cop.deployedFoot = true;
      game.police.interceptors.push(cop);
    }
    game.missions.start(1);
    game.camera.follow(player.x, player.y);
    return;
  }
  if (shot === 'mission') {
    // The Drop: package picked up at the market, racing the clock to the marina.
    // The car starts on the marina road, close enough that the pink marker is
    // in frame, rolling slowly toward the water — not so close that the delivery
    // completes before the camera fires.
    const car = new Car(1080, 1280, Math.PI / 2, '#3b7ec2', 'player');
    game.traffic.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    car.cruiseSpeed = 140;
    game.missions.start(1);
    game.missions.stepIndex = 1;
    game.missions.timer = 34;
    game.camera.follow(player.x, player.y);
  }
}
