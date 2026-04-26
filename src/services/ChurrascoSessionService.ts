import { type Disposable, type Event, EventEmitter } from 'vscode';
import type { Meat } from '../domain/meat';
import { type ChurrascoSessionState, initialSessionState } from '../domain/session';
import { drawNext } from './MeatDeckService';

interface ChurrascoSessionServiceOptions {
  meats: Meat[];
  getIntervalMinutes: () => number;
  tickIntervalMs?: number;
  rng?: () => number;
}

const DEFAULT_TICK_INTERVAL_MS = 1000;

export class ChurrascoSessionService implements Disposable {
  private readonly meats: Meat[];
  private readonly getIntervalMinutes: () => number;
  private readonly tickIntervalMs: number;
  private readonly rng: (() => number) | undefined;
  private readonly stateEmitter = new EventEmitter<ChurrascoSessionState>();
  private currentState: ChurrascoSessionState = initialSessionState;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChurrascoSessionServiceOptions) {
    this.meats = options.meats;
    this.getIntervalMinutes = options.getIntervalMinutes;
    this.tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
    this.rng = options.rng;
  }

  get state(): Readonly<ChurrascoSessionState> {
    return this.currentState;
  }

  get onStateChange(): Event<ChurrascoSessionState> {
    return this.stateEmitter.event;
  }

  start(): void {
    const { status } = this.currentState;
    if (status === 'stopped') {
      const now = Date.now();
      const intervalMs = this.getIntervalMinutes() * 60_000;
      const nowDate = new Date(now);
      this.setState({
        ...this.currentState,
        status: 'running',
        startedAt: nowDate.toISOString(),
        nextArrivalAt: new Date(now + intervalMs).toISOString(),
        today: nowDate.toISOString().slice(0, 10),
      });
      this.ensureTimer();
      return;
    }
    if (status === 'paused') {
      this.setState({ ...this.currentState, status: 'running' });
      this.ensureTimer();
    }
  }

  stop(): void {
    this.setState({
      ...this.currentState,
      status: 'stopped',
      currentMeatId: null,
      nextArrivalAt: null,
    });
    this.clearTimer();
  }

  pause(): void {
    if (this.currentState.status !== 'running') {
      return;
    }
    this.setState({ ...this.currentState, status: 'paused' });
  }

  dispose(): void {
    this.clearTimer();
    this.stateEmitter.dispose();
  }

  private ensureTimer(): void {
    if (this.tickHandle !== null) {
      return;
    }
    this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  private clearTimer(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const { status, nextArrivalAt } = this.currentState;
    if (status !== 'running' || nextArrivalAt === null) {
      return;
    }
    if (Date.parse(nextArrivalAt) > now) {
      return;
    }
    const result = drawNext(
      {
        meatDeck: this.currentState.meatDeck,
        lastServedMeatId: this.currentState.lastServedMeatId,
      },
      this.meats,
      this.rng,
    );
    this.setState({
      ...this.currentState,
      status: 'meatArrived',
      currentMeatId: result.meat.id,
      meatDeck: result.state.meatDeck,
      lastServedMeatId: result.state.lastServedMeatId,
      nextArrivalAt: null,
      lastTickAt: new Date(now).toISOString(),
    });
  }

  private setState(next: ChurrascoSessionState): void {
    if (isShallowEqual(this.currentState, next)) {
      return;
    }
    this.currentState = next;
    this.stateEmitter.fire(next);
  }
}

function isShallowEqual(a: ChurrascoSessionState, b: ChurrascoSessionState): boolean {
  return (
    a.status === b.status &&
    a.startedAt === b.startedAt &&
    a.lastTickAt === b.lastTickAt &&
    a.nextArrivalAt === b.nextArrivalAt &&
    a.currentMeatId === b.currentMeatId &&
    a.satiety === b.satiety &&
    a.today === b.today &&
    a.meatDeck === b.meatDeck &&
    a.lastServedMeatId === b.lastServedMeatId
  );
}
