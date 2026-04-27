import { describe, expect, it } from 'vitest';
import { DEFAULT_MEATS } from '../constants/meats';
import type { MeatLogEntry } from '../domain/log';
import { formatTodayLog } from './formatTodayLog';

function entry(
  action: MeatLogEntry['action'],
  meatId: string,
  createdAt: string,
  id: string,
): MeatLogEntry {
  return {
    id,
    meatId,
    action,
    createdAt,
    satietyDelta: action === 'eaten' ? 10 : 0,
  };
}

describe('formatTodayLog', () => {
  it('renders header counters and satiety percent', () => {
    const text = formatTodayLog({
      todayLog: [
        entry('eaten', 'picanha', '2026-04-27T01:00:00.000Z', 'l1'),
        entry('passed', 'alcatra', '2026-04-27T01:10:00.000Z', 'l2'),
        entry('cooled', 'fraldinha', '2026-04-27T01:20:00.000Z', 'l3'),
      ],
      satiety: 50,
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(text).toContain("🍖 Today's churrasco log");
    expect(text).toContain('Eaten: 1');
    expect(text).toContain('Passed: 1');
    expect(text).toContain('Cooled: 1');
    expect(text).toContain('Satiety: 50%');
  });

  it('renders a per-entry line with HH:mm time, action emoji, and meat name', () => {
    const text = formatTodayLog({
      todayLog: [entry('eaten', 'picanha', '2026-04-27T01:00:00.000Z', 'l1')],
      satiety: 10,
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(text).toContain('01:00 ✅ Picanha');
  });

  it('uses ⏭ for passed and 🥶 for cooled actions', () => {
    const text = formatTodayLog({
      todayLog: [
        entry('passed', 'picanha', '2026-04-27T02:00:00.000Z', 'l1'),
        entry('cooled', 'picanha', '2026-04-27T03:00:00.000Z', 'l2'),
      ],
      satiety: 0,
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(text).toContain('02:00 ⏭ Picanha');
    expect(text).toContain('03:00 🥶 Picanha');
  });

  it('falls back to "Unknown meat" for an unknown meatId', () => {
    const text = formatTodayLog({
      todayLog: [entry('eaten', 'gone', '2026-04-27T05:00:00.000Z', 'l1')],
      satiety: 0,
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(text).toContain('05:00 ✅ Unknown meat');
  });

  it('shows the empty-log placeholder when there are no entries', () => {
    const text = formatTodayLog({
      todayLog: [],
      satiety: 0,
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(text).toContain("🍖 Today's churrasco log");
    expect(text).toContain('No meats logged yet.');
  });
});
