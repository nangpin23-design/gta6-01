// NEON TIDE — the story: five jobs from fixer Iris Vane, each a small state
// machine of steps. A step is a place to reach, a car to steal, crates to lift,
// a wanted level to hold, or a clock to beat. Finish a job, take the cash, and
// the next one opens; finish all five and Calder Bay is yours to roam.

import { LANDMARKS, MISSION_REWARDS } from './config.js';

export const MISSION_NAMES = [
  'First Keys',
  'The Drop',
  'Heat Check',
  'Dockside',
  'Neon Tide',
];

export const MISSION_BRIEFS = [
  'Steal a car and bring it to the garage. Iris is waiting.',
  'Pick up the package at the market, then run it to the marina. 100 seconds.',
  'The crew needs a distraction: get to 3 stars and stay free for 45 seconds.',
  'Three crates on the harbour. Lift them all, then bring them to the garage.',
  'The big one: three checkpoints across the city, then the hideout. $600.',
];

function missionSteps(index) {
  switch (index) {
    case 0:
      return [
        { type: 'steal', label: 'Steal a car (walk up and press E)' },
        { type: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: 'Drive to the Garage', radius: 90 },
      ];
    case 1:
      return [
        { type: 'goto', x: LANDMARKS.market.x, y: LANDMARKS.market.y, label: 'Pick up the package at the Market', radius: 80 },
        { type: 'goto', x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, label: 'Deliver to the Marina', radius: 90, timer: 100 },
      ];
    case 2:
      return [
        { type: 'stars', count: 3, label: 'Raise your wanted level to 3 stars' },
        { type: 'survive', seconds: 45, label: 'Stay free for 45 seconds' },
      ];
    case 3:
      return [
        { type: 'collect', items: LANDMARKS.harborCrates.map((c) => ({ ...c, taken: false })), label: 'Lift the 3 harbour crates (walk over them)' },
        { type: 'goto', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: 'Bring the crates to the Garage', radius: 90 },
      ];
    case 4:
      return [
        { type: 'goto', x: 680, y: 880, label: 'Checkpoint 1 — Old Town', radius: 80 },
        { type: 'goto', x: 1880, y: 580, label: 'Checkpoint 2 — North Docks', radius: 80 },
        { type: 'goto', x: 1080, y: 1180, label: 'Checkpoint 3 — Midtown', radius: 80 },
        { type: 'goto', x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, label: 'Reach the Hideout', radius: 90 },
      ];
    default:
      return [];
  }
}

export class Missions {
  constructor() {
    this.index = 0;
    this.stepIndex = 0;
    this.steps = missionSteps(0);
    this.timer = 0;
    this.surviveTimer = 0;
    this.done = false;
    this.failed = false;
    this.message = '';
  }

  get current() {
    return this.steps[this.stepIndex] || null;
  }

  get name() {
    return MISSION_NAMES[this.index] || 'Free Roam';
  }

  get brief() {
    return MISSION_BRIEFS[this.index] || 'All jobs done. Calder Bay is yours.';
  }

  get reward() {
    return MISSION_REWARDS[this.index] || 0;
  }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.steps = missionSteps(index);
    this.timer = 0;
    this.surviveTimer = 0;
    this.done = false;
    this.failed = false;
    this.message = `New job: ${MISSION_NAMES[index]} — $${MISSION_REWARDS[index]}`;
  }

  objectiveText() {
    if (this.done) return 'All jobs done — free roam';
    const step = this.current;
    if (!step) return 'No active job';
    let text = `Job ${this.index + 1}/5 · ${this.name}: ${step.label}`;
    if (step.timer) text += ` — ${Math.max(0, Math.ceil(step.timer - this.timer))}s left`;
    if (step.type === 'survive') text += ` — ${Math.max(0, Math.ceil(step.seconds - this.surviveTimer))}s left`;
    if (step.type === 'collect') {
      const left = step.items.filter((i) => !i.taken).length;
      text += ` — ${left} left`;
    }
    return text;
  }

  marker() {
    if (this.done) return null;
    const step = this.current;
    if (!step) return null;
    if (step.type === 'goto') return { x: step.x, y: step.y };
    if (step.type === 'collect') {
      const next = step.items.find((i) => !i.taken);
      return next ? { x: next.x, y: next.y } : null;
    }
    return null;
  }

  // Returns 'step' | 'complete' | 'failed' | null.
  update(dt, game) {
    if (this.done) return null;
    const step = this.current;
    if (!step) return null;
    if (step.type === 'goto' && step.timer) {
      this.timer += dt;
      if (this.timer > step.timer) {
        this.failed = true;
        return 'failed';
      }
    }
    if (step.type === 'stars') {
      if (game.police.stars >= step.count) return this.advance();
      return null;
    }
    if (step.type === 'survive') {
      if (game.police.stars >= 1) {
        this.surviveTimer += dt;
        if (this.surviveTimer >= step.seconds) return this.advance();
      }
      return null;
    }
    if (step.type === 'goto') {
      const d = Math.hypot(game.player.x - step.x, game.player.y - step.y);
      if (d < step.radius) return this.advance();
      return null;
    }
    if (step.type === 'collect') {
      let took = false;
      for (const item of step.items) {
        if (item.taken) continue;
        if (Math.hypot(game.player.x - item.x, game.player.y - item.y) < 55) {
          item.taken = true;
          took = true;
        }
      }
      if (took && step.items.every((i) => i.taken)) return this.advance();
      return took ? 'step' : null;
    }
    return null;
  }

  // Called by the game when the player steals a car.
  onSteal() {
    const step = this.current;
    if (step && step.type === 'steal') return this.advance();
    return null;
  }

  advance() {
    this.stepIndex += 1;
    this.timer = 0;
    this.surviveTimer = 0;
    if (this.stepIndex >= this.steps.length) {
      this.done = true;
      return 'complete';
    }
    return 'step';
  }

  // After a job completes, open the next one. Returns false when the story is over.
  nextJob() {
    if (this.index + 1 >= MISSION_NAMES.length) {
      this.done = true;
      return false;
    }
    this.start(this.index + 1);
    return true;
  }
}
