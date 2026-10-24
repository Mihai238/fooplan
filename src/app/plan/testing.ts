import { MealRef, Random } from './plan';

export const LUNCH: MealRef = { day: 0, kind: 'lunch' };
export const DINNER: MealRef = { day: 0, kind: 'dinner' };

// A linear congruential generator, so every run draws the same numbers
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}
