export type SessionStatus = 'stopped' | 'running' | 'paused' | 'meatArrived' | 'full';

export interface ChurrascoSessionState {
  status: SessionStatus;
  startedAt: string | null;
  lastTickAt: string | null;
  nextArrivalAt: string | null;
  currentMeatId: string | null;
  satiety: number;
  today: string;
  meatDeck: string[];
  lastServedMeatId: string | null;
}

export const initialSessionState: ChurrascoSessionState = {
  status: 'stopped',
  startedAt: null,
  lastTickAt: null,
  nextArrivalAt: null,
  currentMeatId: null,
  satiety: 0,
  today: '',
  meatDeck: [],
  lastServedMeatId: null,
};
