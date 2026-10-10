/** Small seedable randomness helpers, so generation and option order are reproducible. */

export type Random = () => number;

/** FNV-1a: a stable 32-bit hash for seeding from strings. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a tiny deterministic PRNG returning values in [0, 1). */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive on both ends. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** `count` distinct integers from [min, max], in random order. */
export function distinctInts(
  random: Random,
  count: number,
  min: number,
  max: number,
): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  if (count > pool.length) {
    throw new Error(`Cannot pick ${count} distinct values from ${min}..${max}.`);
  }
  return shuffle(pool, random).slice(0, count);
}
