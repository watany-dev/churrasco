import { type Disposable, type Event, EventEmitter } from 'vscode';
import type { MeatLogEntry } from '../domain/log';

interface TodayLogServiceOptions {
  initialState?: {
    todayLog: MeatLogEntry[];
    lifetime: {
      perMeatEncounter: Record<string, number>;
      eaten: number;
    };
  };
}

export class TodayLogService implements Disposable {
  private readonly emitter = new EventEmitter<void>();
  private todayLogEntries: MeatLogEntry[];
  private lifetimeEaten: number;
  private perMeatEncounter: Record<string, number>;

  constructor(options: TodayLogServiceOptions = {}) {
    const seed = options.initialState;
    this.todayLogEntries = seed ? [...seed.todayLog] : [];
    this.lifetimeEaten = seed ? seed.lifetime.eaten : 0;
    this.perMeatEncounter = seed ? { ...seed.lifetime.perMeatEncounter } : {};
  }

  get todayLog(): readonly MeatLogEntry[] {
    return this.todayLogEntries;
  }

  get lifetime(): Readonly<{
    perMeatEncounter: Readonly<Record<string, number>>;
    eaten: number;
  }> {
    return { perMeatEncounter: this.perMeatEncounter, eaten: this.lifetimeEaten };
  }

  get onChange(): Event<void> {
    return this.emitter.event;
  }

  recordEntry(entry: MeatLogEntry): void {
    this.todayLogEntries.push(entry);
    if (entry.action === 'eaten') {
      this.lifetimeEaten += 1;
    }
    this.emitter.fire();
  }

  recordEncounter(meatId: string): void {
    this.perMeatEncounter[meatId] = (this.perMeatEncounter[meatId] ?? 0) + 1;
    this.emitter.fire();
  }

  resetToday(): void {
    this.todayLogEntries = [];
    this.emitter.fire();
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
