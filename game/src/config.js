// VELMORA HEAT — every number, name and place the game is built from.
//
// Velmora is a sun-soaked bay city: a road grid, a beach and a marina along the
// south shore, a casino, docks, a market, a garage, a safehouse and an airfield.
// The layout values below are the whole map; the modules that build the city,
// drive the traffic and run the story all read from here.

export const GAME_NAME = 'VELMORA HEAT';
export const GAME_TAGLINE = 'Steal it. Drive it. Lose the heat.';
export const CITY_NAME = 'Velmora';

// The map is a square crossed by a road grid; the beach and the water run
// along the south edge.
export const WORLD = {
  size: 2600, // the square's side, in world units
  block: 260, // a city block's side
  road: 52, // a road's width
  beachY: 2320, // sand starts here
  waterY: 2440, // open water starts here
};

// The logical view the renderer scales to fit the window.
export const VIEW = { width: 1280, height: 800 };

// Dax Marlowe on foot.
export const PLAYER = {
  radius: 13,
  walkSpeed: 205, // unhurried
  runSpeed: 315, // holding Shift
  hp: 100,
  punchDamage: 14,
  punchRange: 32,
  punchArc: 1.2,
};

// How every car in Velmora drives.
export const CAR = {
  length: 46,
  width: 22,
  accel: 340,
  brake: 520,
  reverseAccel: 200,
  maxSpeed: 560,
  maxReverse: 170,
  steer: 2.6,
  grip: 4.2,
  driftGrip: 1.4, // while the handbrake is down
  hp: 100,
};

// The wanted level: stars 0..5. Heat is 0..1 inside the current star; crimes
// add heat, and a full bar earns another star.
export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.045, // while clean and out of sight
  heatPerTheft: 0.55,
  heatPerShot: 0.22,
  heatPerKill: 0.8,
  heatPerCopRam: 0.35,
  policePerStar: [0, 2, 3, 4, 6, 8],
  policeSpeed: [0, 300, 330, 365, 400, 440],
};

// Traffic and pedestrians on the streets.
export const TRAFFIC = { cars: 14, parked: 10, peds: 26 };
export const POLICE_STATION = { x: 494, y: 1118 };
export const HOSPITAL = { x: 1430, y: 2054 };

// Named places (x, y in world units). Each sits at a block centre — the middle
// of a city block, clear of the roads — so its building never blocks a street
// and the player can always reach it. Missions and the minimap use these.
const PLACE_ROWS = [
  ['garage', 2054, 806, 'Voss Garage'],
  ['market', 1118, 1118, 'Marlin Market'],
  ['docks', 2366, 2054, 'Velmora Docks'],
  ['safehouse', 494, 494, 'Safehouse'],
  ['casino', 1430, 806, 'Meridian Casino'],
  ['airfield', 2260, 494, 'Velmora Airfield'],
  ['police', 494, 1118, 'Velmora PD'],
  ['hospital', 1430, 2054, 'St. Anselm Hospital'],
  ['pier', 806, 2400, 'Sunset Pier'],
  ['plaza', 1118, 806, 'Sol Plaza'],
];
export const PLACES = Object.fromEntries(
  PLACE_ROWS.map(([key, x, y, label]) => [key, { x, y, label }]),
);

// The story: five jobs for Selma Voss, the fixer. Each job is a chain of
// stages; a stage is a place to reach, an action to do there, or a tail to lose.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Job 1 — First Wheels',
    brief: 'Selma Voss needs a car, no questions. Steal any ride and bring it to the garage.',
    reward: 400,
    stages: [
      {
        kind: 'steal',
        text: 'Steal any car (walk up and press E)',
      },
      {
        kind: 'goto',
        place: 'garage',
        text: 'Deliver the car to Voss Garage',
      },
    ],
  },
  {
    id: 'the-courier',
    title: 'Job 2 — The Courier',
    brief: 'A package is waiting at Marlin Market. Collect it on foot, then run it to the docks. The Marlins will not wave you through.',
    reward: 700,
    stages: [
      {
        kind: 'goto',
        place: 'market',
        onFoot: true,
        text: 'Pick up the package at Marlin Market',
      },
      {
        kind: 'goto',
        place: 'docks',
        ambush: true,
        text: 'Deliver the package to Velmora Docks',
      },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Job 3 — Heat Wave',
    brief: 'The whole department is on your tail. Lose the heat and reach the safehouse in one piece.',
    reward: 1000,
    stages: [
      {
        kind: 'heat',
        stars: 3,
        text: 'You are at 3 stars — lose the cops!',
      },
      {
        kind: 'goto',
        place: 'safehouse',
        needClear: true,
        text: 'Reach the Safehouse with no heat',
      },
    ],
  },
  {
    id: 'dockside-deal',
    title: 'Job 4 — Dockside Deal',
    brief: 'Drive the crew to the docks and watch Selma’s back while the deal goes down. The Marlins bring guns.',
    reward: 1500,
    stages: [
      {
        kind: 'goto',
        place: 'docks',
        text: 'Drive the crew to Velmora Docks',
      },
      {
        kind: 'defend',
        seconds: 45,
        text: 'Defend the deal — hold the docks for 45 seconds',
      },
      {
        kind: 'goto',
        place: 'garage',
        text: 'Get the crew back to Voss Garage',
      },
    ],
  },
  {
    id: 'the-velmora-job',
    title: 'Job 5 — The Velmora Job',
    brief: 'The Meridian Casino vault. One night, one crew, one clean getaway to the airfield. This is the one they will sing about.',
    reward: 5000,
    stages: [
      {
        kind: 'goto',
        place: 'casino',
        text: 'Reach the Meridian Casino',
      },
      {
        kind: 'defend',
        seconds: 30,
        text: 'Crack the vault — hold the casino for 30 seconds',
      },
      {
        kind: 'goto',
        place: 'airfield',
        text: 'Escape to Velmora Airfield',
      },
    ],
  },
];

// Palette: a sun-soaked modern bay city at golden hour.
const PALETTE_ROWS = [
  ['grass', '#7fae5a'],
  ['grassDark', '#74a24f'],
  ['sand', '#e8d29a'],
  ['water', '#2e7fa8'],
  ['waterDeep', '#256b8f'],
  ['asphalt', '#3d3f46'],
  ['asphaltDark', '#35373e'],
  ['sidewalk', '#9a9a92'],
  ['curb', '#c9c9bd'],
  ['line', '#e8e4c8'],
  ['crosswalk', '#d8d8cc'],
  ['policeCar', '#e8e8e8'],
  ['policeTrim', '#1c3a6e'],
  ['hudBg', 'rgba(12, 16, 26, 0.72)'],
  ['hudText', '#f2ead8'],
  ['hudAccent', '#ffc23d'],
  ['hudDanger', '#ff5a4e'],
  ['minimapWater', '#2e7fa8'],
  ['minimapRoad', '#c9c9bd'],
  ['minimapBlock', '#5d7a48'],
  ['minimapPlayer', '#ffc23d'],
  ['minimapPolice', '#ff5a4e'],
  ['minimapMission', '#ffe14d'],
];
export const PALETTE = {
  ...Object.fromEntries(PALETTE_ROWS),
  buildingRoof: ['#c96f4a', '#b8563f', '#d9a05b', '#7d9bb5', '#a8709e', '#5f8f6a', '#8a6f4d'],
  carColors: ['#c0392b', '#2e6fb0', '#e0a030', '#e8e8e8', '#3a3a3a', '#7d4a9e', '#2e8b6a', '#d35400'],
};

// Weapons.
export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, rate: 0.45, range: 34, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 26, rate: 0.28, range: 420, ammo: 24, pickupAmmo: 12 },
};

// Save key in localStorage.
export const SAVE_KEY = 'velmora-heat-save-v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
