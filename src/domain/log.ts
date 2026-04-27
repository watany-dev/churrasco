export type MeatLogAction = 'eaten' | 'passed' | 'cooled';

export interface MeatLogEntry {
  id: string;
  meatId: string;
  action: MeatLogAction;
  createdAt: string;
  satietyDelta: number;
}
