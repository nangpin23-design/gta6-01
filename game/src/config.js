// SUNSET RUN — tuning, palette and mission definitions.
//
// Every number in this file is a design choice for Port Aurelia: a sun-soaked
// harbor city that fits on one screen of streets at a time. Nothing here comes
// from another game; the names, places and values are this entry's own.

export const WORLD = {
  width: 2400,
  height: 1800,
  roadSpacing: 300,
  roadWidth: 64,
  // The harbor water starts here and runs to the south edge of the map.
  waterY: 1680,
  // Seeded city layout: the same seed always builds the same Port Aurelia.
  seed: 20261118,
};

export const PALETTE = {
  ground: '#d9b380',
  grass: '#8aa860',
  asphalt: '#413c39',
  roadEdge: '#c9b18a',
  roadLine: '#f2d06b',
  sidewalk: '#b8a888',
  water: '#2f7d9c',
  waterDeep: '#256a86',
  pier: '#8a6b4f',
  building: ['#c96f4a', '#d9a05b', '#7d8aa0', '#a8677a', '#5f8a6d', '#b5b0a0'],
  roof: '#6b5a48',
  glass: '#9fc4d4',
  tree: '#4f7a3d',
  player: '#e8b13c',
  playerDark: '#8a5a1d',
  policeCar: '#20242c',
  policeLight: '#e84a4a',
  cop: '#2c4a7a',
  ped: ['#c94f4f', '#4f7ac9', '#6aa84f', '#c9a44f', '#8a5fa8', '#4fb3a9'],
  beacon: '#ffcf3d',
  danger: '#ff5a4e',
  money: '#7ee081',
};

// Named places the missions and the HUD point at.
export const PLACES = {
  garage: { name: "Dahlia's Garage", x: 450, y: 1050 },
  market: { name: 'Mercato Aurelia', x: 1350, y: 450 },
  marina: { name: 'Marina Aurelia', x: 1650, y: 1650 },
  policeStation: { name: 'Aurelia PD', x: 1050, y: 450 },
  hospital: { name: 'St. Sol Hospital', x: 1950, y: 450 },
  hideout: { name: 'Sunset Hideout', x: 2250, y: 1650 },
  harborCrates: [
    { x: 750, y: 1650 },
    { x: 1350, y: 1650 },
    { x: 1950, y: 1650 },
  ],
  checkpoints: [
    { x: 2250, y: 150 },
    { x: 150, y: 1650 },
    { x: 2250, y: 1650 },
  ],
};

export const PLAYER = {
  walkSpeed: 235,
  radius: 13,
  maxHp: 100,
  maxAmmo: 48,
  startAmmo: 24,
  fireRate: 0.25,
  bulletRange: 430,
  bulletDamage: 25,
  arrestRange: 20,
  enterRange: 46,
};

// Car models: name, top speed, acceleration, turning and toughness.
export const CAR_MODELS = {
  cometa: { name: 'Cometa', color: '#e8c93c', topSpeed: 430, accel: 380, turn: 2.7, hp: 100 },
  falco: { name: 'Falco', color: '#4f7ac9', topSpeed: 470, accel: 420, turn: 2.8, hp: 100 },
  vela: { name: 'Vela', color: '#c94f6d', topSpeed: 560, accel: 520, turn: 3.0, hp: 80 },
  toro: { name: 'Toro', color: '#5f8a3d', topSpeed: 520, accel: 560, turn: 2.6, hp: 130 },
  bisonte: { name: 'Bisonte', color: '#8a7a5f', topSpeed: 360, accel: 300, turn: 2.2, hp: 180 },
  interceptor: { name: 'PD Interceptor', color: '#20242c', topSpeed: 540, accel: 560, turn: 3.1, hp: 140 },
};

export const WANTED = {
  maxStars: 5,
  policePerStar: [0, 1, 2, 3, 4, 6],
  policeSpeed: [0, 300, 325, 350, 380, 410],
  decayPerSecond: 0.05,
  cleanDelay: 5,
  seeRange: 350,
  heat: { steal: 0.3, shoot: 0.08, killPed: 0.5, hitPed: 0.4, killCop: 0.6 },
  bustCut: 0.15,
  wastedCut: 0.1,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 120,
  speedMax: 185,
};

export const PEDS = {
  count: 24,
  walkMin: 42,
  walkMax: 72,
  fleeSpeed: 150,
};

// The five story jobs. Each pays cash; the last one ends the story, and the
// city stays open for free roam afterwards.
export const MISSIONS = [
  {
    id: 'first-keys',
    name: 'First Keys',
    briefing: "Dahlia needs a car. Steal any ride and bring it to the garage.",
    reward: 150,
  },
  {
    id: 'the-package',
    name: 'The Package',
    briefing: 'Pick up the package at Mercato Aurelia, then run it to the marina. 100 seconds.',
    reward: 250,
    timer: 100,
  },
  {
    id: 'hot-pursuit',
    name: 'Hot Pursuit',
    briefing: 'Get to 3 stars, then stay free for 45 seconds. Do not get busted.',
    reward: 300,
    timer: 45,
  },
  {
    id: 'harbor-lights',
    name: 'Harbor Lights',
    briefing: 'Three crates are waiting on the harbor. Collect them all, then return to the garage.',
    reward: 400,
  },
  {
    id: 'sunset-run',
    name: 'The Sunset Run',
    briefing: 'Three checkpoints, one sunset. Hit them all, then vanish at the hideout.',
    reward: 600,
  },
];

export const SAVE_KEY = 'sunset-run-save-v1';
