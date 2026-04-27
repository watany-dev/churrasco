import { describe, expect, it } from 'vitest';
import type { MeatLogEntry } from '../domain/log';
import { formatEndOfSessionSummary } from './formatEndOfSessionSummary';

function entry(action: MeatLogEntry['action'], id: string): MeatLogEntry {
  return {
    id,
    meatId: 'picanha',
    action,
    createdAt: '2026-04-27T08:00:00.000Z',
    satietyDelta: action === 'eaten' ? 12 : 0,
  };
}

describe('formatEndOfSessionSummary', () => {
  it('reports eaten / passed counts and satiety percent', () => {
    const text = formatEndOfSessionSummary({
      todayLog: [entry('eaten', 'a'), entry('eaten', 'b'), entry('passed', 'c')],
      satiety: 80,
      maxSatiety: 100,
    });
    expect(text).toContain('Eaten: 2');
    expect(text).toContain('Passed: 1');
    expect(text).toContain('Satiety: 80%');
  });

  it('uses the closing emoji and message from the spec example', () => {
    const text = formatEndOfSessionSummary({ todayLog: [], satiety: 0, maxSatiety: 100 });
    expect(text).toContain("🏁 Today's churrasco has ended.");
  });

  it('handles zero counts (Eaten=0, Passed=0)', () => {
    const text = formatEndOfSessionSummary({ todayLog: [], satiety: 0, maxSatiety: 100 });
    expect(text).toContain('Eaten: 0');
    expect(text).toContain('Passed: 0');
    expect(text).toContain('Satiety: 0%');
  });

  it('caps satiety percent at 100 when satiety overshoots maxSatiety', () => {
    const text = formatEndOfSessionSummary({ todayLog: [], satiety: 150, maxSatiety: 100 });
    expect(text).toContain('Satiety: 100%');
  });

  it('does not include the v0.1-deferred Title row', () => {
    const text = formatEndOfSessionSummary({
      todayLog: [entry('eaten', 'a')],
      satiety: 50,
      maxSatiety: 100,
    });
    expect(text).not.toContain('Title:');
  });
});
