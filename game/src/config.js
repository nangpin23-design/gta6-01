// NEON TIDE — shared constants: world size, palette, tuning, key bindings.
// Everything the other modules need to agree on lives here, so a balance tweak
// touches one file.

export const GAME_TITLE = 'NEON TIDE';
export const CITY_NAME = 'Calder Bay';
export const HERO_NAME = 'Rook Delgado';
export const FIXER_NAME = 'Iris Vane';

export const WORLD_W = 2400;
export const WORLD_H = 1800;
export const VIEW_W = 1280;
export const VIEW_H = 800;

// Road grid: the city is a lattice of streets. Sidewalks hug each street.
export const ROAD_W = 96;
export const SIDEWALK_W = 26;
export const VERTICAL_ROADS = [280, 680, 1080, 1480, 1880, 2200];
export const HORIZONTAL_ROADS = [280, 580, 880, 1180, 1480];
export const WATER_Y = 1620; // harbour water south of this line
export const PIER_X = 1080; // the pier runs out from the marina road

// Palette: dusk neon over dark asphalt.
export const COLORS = {
  grass: '#1d3327',
  block: '#24382e',
  road: '#2e2e38',
  roadEdge: '#454554',
  sidewalk: '#3d3d4a',
  lane: '#c9c96a',
  water: '#123a52',
  waterDeep: '#0d2c40',
  buildingRoof: '#4a3b52',
  buildingEdge: '#6b5578',
  neonPink: '#ff4d8d',
  neonCyan: '#37d6e0',
  neonAmber: '#ffb347',
  carBody: ['#c23b3b', '#3b7ec2', '#c2a13b', '#4fae5f', '#8a5fc2', '#c2c2c2'],
  copBlue: '#2f6fd6',
  copRed: '#d62f2f',
  playerJacket: '#e0a437',
  pedShirt: ['#7fb069', '#e07a5f', '#81b29a', '#f2cc8f', '#a68ad6'],
  hudBg: 'rgba(8, 10, 18, 0.72)',
  hudText: '#f2f2e8',
  starOn: '#ffd23b',
  starOff: '#4a4a58',
};

export const PLAYER = {
  walkSpeed: 235,
  runSpeed: 320,
  radius: 13,
  maxHp: 100,
  pistolAmmo: 12,
  reloadMs: 1400,
  punchRange: 34,
  punchDamage: 12,
  shotDamage: 34,
  shotRange: 420,
};

export const CAR = {
  accel: 620,
  brake: 900,
  maxSpeed: 520,
  maxReverse: 170,
  turnRate: 2.6,
  grip: 3.2,
  radius: 17,
  length: 46,
  width: 24,
  stealHeat: 12,
  ramDamage: 26,
};

export const TRAFFIC = {
  count: 16,
  speedMin: 130,
  speedMax: 210,
};

export const PEDS = {
  count: 26,
  speedMin: 34,
  speedMax: 62,
};

export const WANTED = {
  // heat thresholds per star
  starAt: [0, 12, 30, 50, 70, 90],
  decayPerSec: 3,
  cleanSeconds: 5,
  heatShot: 8,
  heatHitPed: 25,
  heatCopDown: 30,
  heatSteal: 12,
  maxInterceptors: 5,
  bustCut: 0.15,
  wastedCut: 0.1,
};

export const MISSION_REWARDS = [150, 250, 300, 400, 600];

// Landmarks, in world coordinates.
export const LANDMARKS = {
  garage: { x: 280, y: 280, label: 'Garage' },
  market: { x: 1480, y: 580, label: 'Market' },
  marina: { x: 1080, y: 1560, label: 'Marina' },
  hospital: { x: 1880, y: 1180, label: 'St. Sol Hospital' },
  policeStation: { x: 680, y: 1180, label: 'Calder PD' },
  hideout: { x: 2200, y: 280, label: 'Hideout' },
  harborCrates: [
    { x: 700, y: 1560 },
    { x: 1080, y: 1560 },
    { x: 1480, y: 1560 },
  ],
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enterCar: ['KeyE'],
  handbrake: ['Space'],
  reload: ['KeyR'],
  save: ['KeyS'],
  pause: ['KeyP', 'Escape'],
  start: ['Enter'],
  mute: ['KeyM'],
};
