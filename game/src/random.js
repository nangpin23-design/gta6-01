// A small seeded random number generator (mulberry32) with the helpers the
// city builder and the traffic use. The same seed always builds the same
// Velmora, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let state = seed | 0;

  // One uniform draw in [0, 1).
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    // A float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // An integer in [min, max).
    int(min, max) {
      return Math.floor(min + next() * (max - min));
    },
    // One element of an array.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with the given probability.
    chance(p) {
      return next() < p;
    },
  };
}
