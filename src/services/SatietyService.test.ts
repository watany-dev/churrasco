import { describe, expect, it } from 'vitest';
import type { Meat } from '../domain/meat';
import { applyEat } from './SatietyService';

const meat = (id: string, satiety: number): Meat => ({
  id,
  nameJa: id,
  nameEn: id,
  category: 'beef',
  rarity: 'common',
  satiety,
  flavorText: '',
  effectLabel: '',
});

describe('applyEat', () => {
  it('adds meat satiety to currentSatiety and returns isFull=false when below max', () => {
    const result = applyEat(0, meat('picanha', 12), 100);
    expect(result.nextSatiety).toBe(12);
    expect(result.isFull).toBe(false);
  });

  it('returns isFull=true when nextSatiety equals maxSatiety', () => {
    const result = applyEat(88, meat('picanha', 12), 100);
    expect(result.nextSatiety).toBe(100);
    expect(result.isFull).toBe(true);
  });

  it('returns isFull=true when nextSatiety exceeds maxSatiety (overshoot)', () => {
    const result = applyEat(95, meat('picanha', 12), 100);
    expect(result.nextSatiety).toBe(107);
    expect(result.isFull).toBe(true);
  });

  it('preserves currentSatiety when meat satiety is zero', () => {
    const result = applyEat(50, meat('picanha', 0), 100);
    expect(result.nextSatiety).toBe(50);
    expect(result.isFull).toBe(false);
  });
});
