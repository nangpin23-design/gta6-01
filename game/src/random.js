// SUNSET RUN — a small seeded random source.
//
// The city, traffic and pedestrians all draw from one seeded stream, so the
// same seed always builds the same Port Aurelia. Gameplay randomness (a
// pedestrian's next turn, a police spawn point) uses the same stream, which is
// why a staged screenshot with a fixed seed looks the same every time.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max].
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// One element of an array, picked uniformly.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// True with probability p (0..1).
export function chance(rng, p) {
  return rng() < p;
}

// A random angle in radians.
export function angle(rng) {
  return rng() * Math.PI * 2;
}
