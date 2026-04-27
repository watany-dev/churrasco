import type { Meat } from '../domain/meat';

export function applyEat(
  currentSatiety: number,
  meat: Meat,
  maxSatiety: number,
): { nextSatiety: number; isFull: boolean } {
  const nextSatiety = currentSatiety + meat.satiety;
  return { nextSatiety, isFull: nextSatiety >= maxSatiety };
}
