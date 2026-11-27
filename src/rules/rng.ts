/**
 * Seedable random number generator (mulberry32).
 *
 * The rules never call Math.random directly. They take an Rng instead, so
 * unit tests can pass a fixed seed and get the same board every run.
 */

/** Returns a float in the range [0, 1), like Math.random. */
export type Rng = () => number;

/** Create a repeatable Rng from a whole-number seed. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a whole number in the range [0, max). */
export function randomInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}
