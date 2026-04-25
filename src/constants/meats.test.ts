import { describe, expect, it } from 'vitest';
import { DEFAULT_MEATS } from './meats';

describe('DEFAULT_MEATS', () => {
  it('contains exactly 12 meats', () => {
    expect(DEFAULT_MEATS).toHaveLength(12);
  });

  it('has unique ids', () => {
    const ids = DEFAULT_MEATS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has positive satiety for every meat', () => {
    for (const meat of DEFAULT_MEATS) {
      expect(meat.satiety).toBeGreaterThan(0);
    }
  });
});
