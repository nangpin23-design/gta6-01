// SUNSET RUN — the five story jobs for Dahlia Moreau.
//
// Each mission is a small state machine: a stage, a target point on the map,
// and a timer where the job demands one. Finishing a job pays cash, saves the
// game and opens the next one. The last job ends the story; the city stays
// open for free roam afterwards.

import { MISSIONS, PLACES } from './config.js';

function freshMission(index) {
  return {
    index,
    stage: 'go',
    timer: 0,
    target: null,
    crates: [],
    checkpoints: [],
    done: false,
  };
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  const m = freshMission(index);
  if (index === 0) {
    m.stage = 'go';
    m.target = { ...PLACES.garage, label: "Dahlia's Garage" };
  } else if (index === 1) {
    m.stage = 'pickup';
    m.target = { ...PLACES.market, label: 'Mercato Aurelia' };
    m.timer = def.timer;
  } else if (index === 2) {
    m.stage = 'evade';
    m.timer = def.timer;
    m.target = null;
  } else if (index === 3) {
    m.stage = 'collect';
    m.crates = PLACES.harborCrates.map((c) => ({ ...c, taken: false }));
    m.target = { ...m.crates[0], label: 'Harbor crate' };
  } else if (index === 4) {
    m.stage = 'checkpoints';
    m.checkpoints = PLACES.checkpoints.map((c) => ({ ...c, done: false }));
    m.target = { ...m.checkpoints[0], label: 'Checkpoint 1' };
  }
  state.mission = m;
  state.message = `${def.name}: ${def.briefing}`;
  state.messageAt = state.time;
}

// Restart the current job from its beginning (after a bust, a waste, or a
// blown timer), keeping the story where it was.
export function resetMission(state) {
  if (state.mission.index < MISSIONS.length) startMission(state, state.mission.index);
}

function completeMission(state) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  state.player.cash += def.reward;
  state.effects.floater(state.player.x, state.player.y - 40, `+$${def.reward}`, '#7ee081');
  state.audio.mission();
  state.message = `${def.name} complete — $${def.reward} earned.`;
  state.messageAt = state.time;
  m.done = true;
  // Save AFTER the next job opens, so a continued game resumes the job
  // Nico still has to do — not the one he just finished.
  if (m.index + 1 >= MISSIONS.length) {
    state.storyComplete = true;
    state.message = 'Story complete — Port Aurelia is yours. Free roam!';
    state.messageAt = state.time;
    state.save();
    return;
  }
  startMission(state, m.index + 1);
  state.save();
}

function near(state, x, y, r) {
  return Math.hypot(state.player.x - x, state.player.y - y) < r;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return;
  const p = state.player;

  if (m.index === 0) {
    if (p.inCar && near(state, PLACES.garage.x, PLACES.garage.y, 70)) completeMission(state);
  } else if (m.index === 1) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.message = 'Too slow — the package moved on. Try again.';
      state.messageAt = state.time;
      startMission(state, 1);
      return;
    }
    if (m.stage === 'pickup' && near(state, PLACES.market.x, PLACES.market.y, 55)) {
      m.stage = 'deliver';
      m.target = { ...PLACES.marina, label: 'Marina Aurelia' };
      state.message = 'Package picked up — run it to the marina!';
      state.messageAt = state.time;
      state.audio.pickup();
    } else if (m.stage === 'deliver' && near(state, PLACES.marina.x, PLACES.marina.y, 60)) {
      completeMission(state);
    }
  } else if (m.index === 2) {
    // The clock only runs while Nico is actually hot: 3 stars or more.
    if (state.wanted.stars >= 3) {
      m.timer -= dt;
      if (m.timer <= 0) completeMission(state);
    }
  } else if (m.index === 3) {
    if (m.stage === 'collect') {
      for (const crate of m.crates) {
        if (!crate.taken && near(state, crate.x, crate.y, 55)) {
          crate.taken = true;
          state.audio.pickup();
          state.effects.floater(crate.x, crate.y - 24, 'CRATE', '#7ee081');
        }
      }
      const next = m.crates.find((c) => !c.taken);
      if (!next) {
        m.stage = 'deliver';
        m.target = { ...PLACES.garage, label: "Dahlia's Garage" };
        state.message = 'All three crates — back to the garage!';
        state.messageAt = state.time;
      } else {
        m.target = { ...next, label: 'Harbor crate' };
      }
    } else if (near(state, PLACES.garage.x, PLACES.garage.y, 70)) {
      completeMission(state);
    }
  } else if (m.index === 4) {
    if (m.stage === 'checkpoints') {
      const next = m.checkpoints.find((c) => !c.done);
      if (next && near(state, next.x, next.y, 65)) {
        next.done = true;
        state.audio.pickup();
        state.effects.floater(next.x, next.y - 24, 'CHECKPOINT', '#7ee081');
      }
      const following = m.checkpoints.find((c) => !c.done);
      if (!following) {
        m.stage = 'deliver';
        m.target = { ...PLACES.hideout, label: 'Sunset Hideout' };
        state.message = 'All checkpoints hit — vanish at the hideout!';
        state.messageAt = state.time;
      } else {
        m.target = { ...following, label: `Checkpoint ${m.checkpoints.indexOf(following) + 1}` };
      }
    } else if (near(state, PLACES.hideout.x, PLACES.hideout.y, 70)) {
      completeMission(state);
    }
  }
}

// The one-line objective the HUD shows.
export function missionObjectiveText(state) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return 'Free roam — Port Aurelia is yours.';
  const def = MISSIONS[m.index];
  if (m.index === 0) return `${def.name}: steal a car, bring it to the garage`;
  if (m.index === 1) {
    return m.stage === 'pickup'
      ? `${def.name}: pick up the package at the market`
      : `${def.name}: deliver to the marina (${Math.ceil(m.timer)}s)`;
  }
  if (m.index === 2) {
    return state.wanted.stars >= 3
      ? `${def.name}: stay free — ${Math.ceil(m.timer)}s left`
      : `${def.name}: get to 3 stars first`;
  }
  if (m.index === 3) {
    const left = m.crates.filter((c) => !c.taken).length;
    return m.stage === 'collect'
      ? `${def.name}: collect harbor crates (${3 - left}/3)`
      : `${def.name}: return to the garage`;
  }
  if (m.stage === 'checkpoints') {
    const done = m.checkpoints.filter((c) => c.done).length;
    return `${def.name}: checkpoints (${done}/3)`;
  }
  return `${def.name}: escape to the hideout`;
}

// The map point the waypoint arrow and minimap should point at, or null.
export function missionTarget(state) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return null;
  return m.target;
}
