import { describe, expect, it } from 'vitest';
import { createInitialSnapshot } from './PersistedSnapshot';
import { applyDateRollover } from './dateRollover';

describe('applyDateRollover', () => {
  it('returns the snapshot unchanged when lastLaunchDate matches today', () => {
    const today = '2026-04-27';
    const snap = createInitialSnapshot(today);
    snap.todayLog.push({
      id: 'l1',
      meatId: 'picanha',
      action: 'eaten',
      createdAt: '2026-04-27T08:00:00.000Z',
      satietyDelta: 12,
    });
    snap.session.satiety = 20;
    snap.lifetime.eaten = 1;
    snap.lifetime.perMeatEncounter.picanha = 1;
    const result = applyDateRollover(snap, today);
    expect(result).toEqual(snap);
  });

  it('clears todayLog, resets session.satiety/today on rollover, and preserves lifetime', () => {
    const yesterday = '2026-04-26';
    const today = '2026-04-27';
    const snap = createInitialSnapshot(yesterday);
    snap.todayLog.push({
      id: 'l1',
      meatId: 'picanha',
      action: 'eaten',
      createdAt: '2026-04-26T08:00:00.000Z',
      satietyDelta: 12,
    });
    snap.session.satiety = 30;
    snap.lifetime.eaten = 7;
    snap.lifetime.perMeatEncounter.picanha = 4;
    const result = applyDateRollover(snap, today);
    expect(result.todayLog).toEqual([]);
    expect(result.session.satiety).toBe(0);
    expect(result.session.today).toBe(today);
    expect(result.lastLaunchDate).toBe(today);
    expect(result.lifetime.eaten).toBe(7);
    expect(result.lifetime.perMeatEncounter).toEqual({ picanha: 4 });
  });

  it('keeps meatDeck and lastServedMeatId across rollovers (deck cycle is preserved)', () => {
    const yesterday = '2026-04-26';
    const today = '2026-04-27';
    const snap = createInitialSnapshot(yesterday);
    snap.session.meatDeck = ['alcatra', 'fraldinha'];
    snap.session.lastServedMeatId = 'picanha';
    const result = applyDateRollover(snap, today);
    expect(result.session.meatDeck).toEqual(['alcatra', 'fraldinha']);
    expect(result.session.lastServedMeatId).toBe('picanha');
  });
});
