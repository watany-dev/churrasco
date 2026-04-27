import type { PersistedSnapshot } from './PersistedSnapshot';

export function applyDateRollover(snapshot: PersistedSnapshot, today: string): PersistedSnapshot {
  if (snapshot.lastLaunchDate === today) {
    return snapshot;
  }
  return {
    ...snapshot,
    session: {
      ...snapshot.session,
      today,
      satiety: 0,
    },
    todayLog: [],
    lastLaunchDate: today,
  };
}
