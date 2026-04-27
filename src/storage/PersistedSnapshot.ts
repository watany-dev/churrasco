import type { MeatLogEntry } from '../domain/log';

export interface PersistedSnapshot {
  schemaVersion: 1;
  session: {
    today: string;
    satiety: number;
    meatDeck: string[];
    lastServedMeatId: string | null;
  };
  todayLog: MeatLogEntry[];
  lifetime: {
    perMeatEncounter: Record<string, number>;
    eaten: number;
  };
  lastLaunchDate: string;
}

export const STORAGE_KEY = 'churrasco.state.v1';

export const SCHEMA_VERSION = 1 as const;

export function createInitialSnapshot(today: string): PersistedSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    session: {
      today,
      satiety: 0,
      meatDeck: [],
      lastServedMeatId: null,
    },
    todayLog: [],
    lifetime: {
      perMeatEncounter: {},
      eaten: 0,
    },
    lastLaunchDate: today,
  };
}
