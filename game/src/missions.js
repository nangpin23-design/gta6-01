// The story: five jobs for Selma Voss, the fixer. Each job is a chain of
// stages — steal a car, reach a place, lose a tail, hold a spot against armed
// rivals. A stage completes when its condition is met; the last stage pays
// out, saves the game and starts the next job. Enemies are armed rivals who
// shoot at the player.

import { MISSIONS, PLACES } from './config.js';
import { addHeat } from './police.js';

const ENEMY_SHOOT_RANGE = 380;
const ENEMY_SHOOT_INTERVAL = 1.15;
const ENEMY_HP = 60;
const DEFEND_RADIUS = 280;

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.mission = {
    index,
    def,
    stage: 0,
    timer: 0,
    active: true,
    banner: `${def.title} — ${def.brief}`,
    bannerUntil: state.time + 6,
    ambushed: false,
    spawned: 0,
  };
  state.effects.floater(state.player.x, state.player.y - 40, def.title, '#ffc23d');
  return true;
}

export function currentStage(state) {
  if (!state.mission || !state.mission.active) return null;
  return state.mission.def.stages[state.mission.stage] || null;
}

export function missionMarker(state) {
  const stage = currentStage(state);
  if (!stage || !stage.place) return null;
  return PLACES[stage.place];
}

function spawnEnemy(state, x, y) {
  state.enemies.push({
    x, y,
    angle: 0,
    hp: ENEMY_HP,
    shootAt: state.time + 0.8 + state.rng.next() * 0.8,
    speed: 150,
  });
}

function spawnAmbush(state, place, count) {
  for (let i = 0; i < count; i += 1) {
    spawnEnemy(state, place.x + state.rng.range(-120, 120), place.y + state.rng.range(-120, 120));
  }
}

function completeStage(state) {
  const mission = state.mission;
  mission.stage += 1;
  state.audio.pickup();
  if (mission.stage >= mission.def.stages.length) completeMission(state);
}

function completeMission(state) {
  const mission = state.mission;
  state.player.money += mission.def.reward;
  state.effects.floater(state.player.x, state.player.y - 40, `+$${mission.def.reward}`, '#ffc23d');
  state.audio.missionDone();
  mission.active = false;
  mission.banner = `Job complete — $${mission.def.reward} banked`;
  mission.bannerUntil = state.time + 4;
  state.stats.missionsDone += 1;
  state.saveGame();
  if (mission.index + 1 >= MISSIONS.length) {
    state.screen = 'ending';
    return;
  }
  mission.nextAt = state.time + 4;
}

export function updateMissions(state, dt) {
  const mission = state.mission;
  if (!mission) return;
  if (!mission.active && mission.nextAt && state.time >= mission.nextAt) {
    mission.nextAt = 0;
    startMission(state, mission.index + 1);
    return;
  }
  if (!mission.active) return;
  const stage = currentStage(state);
  if (!stage) return;

  if (stage.kind === 'steal') {
    if (state.player.inCar) completeStage(state);
    return;
  }
  if (stage.kind === 'heat') {
    if (mission.stageStarted !== mission.stage) {
      mission.stageStarted = mission.stage;
      state.wanted.stars = stage.stars;
      state.wanted.heat = 0.5;
      state.lastCrimeAt = state.time;
    }
    if (state.wanted.stars < stage.stars) completeStage(state);
    return;
  }
  if (stage.kind === 'goto') {
    const place = PLACES[stage.place];
    const d = Math.hypot(state.player.x - place.x, state.player.y - place.y);
    if (stage.ambush && !mission.ambushed && d < 260) {
      mission.ambushed = true;
      spawnAmbush(state, place, 3);
      state.effects.floater(place.x, place.y - 40, 'Ambush!', '#ff5a4e');
    }
    if (stage.onFoot && state.player.inCar) return;
    if (stage.needClear && state.wanted.stars > 0) return;
    // Places sit at block centres, a short walk from the street: arriving by
    // car counts from the road, arriving on foot counts from closer in.
    if (d < (state.player.inCar ? 150 : 78)) completeStage(state);
    return;
  }
  if (stage.kind === 'defend') {
    const place = PLACES[stage.place];
    const d = Math.hypot(state.player.x - place.x, state.player.y - place.y);
    if (mission.spawned < 3 && state.enemies.length < 4) {
      mission.spawned += 1;
      spawnEnemy(state, place.x + state.rng.range(-160, 160), place.y + state.rng.range(-160, 160));
    }
    if (d < DEFEND_RADIUS) {
      mission.timer += dt;
      if (mission.timer >= stage.seconds) completeStage(state);
    }
    return;
  }
}

/** Rivals move toward the player and shoot when close enough. */
export function updateEnemies(state, dt) {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.hp <= 0) {
      state.effects.sparks(enemy.x, enemy.y);
      state.effects.floater(enemy.x, enemy.y - 16, '+6 ammo', '#ffc23d');
      state.player.ammo += 6;
      addHeat(state, 0.35);
      state.enemies.splice(i, 1);
      continue;
    }
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const d = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    if (d > 300) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    } else if (state.time >= enemy.shootAt) {
      enemy.shootAt = state.time + ENEMY_SHOOT_INTERVAL;
      state.effects.muzzle(enemy.x + Math.cos(enemy.angle) * 18, enemy.y + Math.sin(enemy.angle) * 18, enemy.angle);
      state.audio.gunshot();
      if (state.rng.next() < 0.55 && d < ENEMY_SHOOT_RANGE) {
        state.player.hp -= 7;
        state.player.invulnerable = Math.max(state.player.invulnerable, 0.3);
        state.effects.sparks(state.player.x, state.player.y);
        state.effects.addShake(2);
      }
    }
  }
}
