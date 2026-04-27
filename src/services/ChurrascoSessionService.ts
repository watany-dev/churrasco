import { type Disposable, type Event, EventEmitter } from 'vscode';
import type { MeatLogEntry } from '../domain/log';
import type { Meat } from '../domain/meat';
import { type ChurrascoSessionState, initialSessionState } from '../domain/session';
import { drawNext } from './MeatDeckService';
import { applyEat } from './SatietyService';

interface ChurrascoSessionServiceOptions {
  meats: Meat[];
  getIntervalMinutes: () => number;
  getMaxSatiety: () => number;
  getAutoStopWhenFull?: () => boolean;
  initialState?: {
    satiety: number;
    today: string;
    meatDeck: string[];
    lastServedMeatId: string | null;
  };
  tickIntervalMs?: number;
  rng?: () => number;
  generateLogId?: () => string;
  now?: () => number;
}

interface MeatServedEvent {
  meatId: string;
  servedAt: string;
}

const DEFAULT_TICK_INTERVAL_MS = 1000;

export class ChurrascoSessionService implements Disposable {
  private readonly meats: Meat[];
  private readonly getIntervalMinutes: () => number;
  private readonly getMaxSatiety: () => number;
  private readonly getAutoStopWhenFull: () => boolean;
  private readonly tickIntervalMs: number;
  private readonly rng: (() => number) | undefined;
  private readonly generateLogId: () => string;
  private readonly now: () => number;
  private readonly stateEmitter = new EventEmitter<ChurrascoSessionState>();
  private readonly logEmitter = new EventEmitter<MeatLogEntry>();
  private readonly meatServedEmitter = new EventEmitter<MeatServedEvent>();
  private currentState: ChurrascoSessionState;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChurrascoSessionServiceOptions) {
    this.meats = options.meats;
    this.getIntervalMinutes = options.getIntervalMinutes;
    this.getMaxSatiety = options.getMaxSatiety;
    this.getAutoStopWhenFull = options.getAutoStopWhenFull ?? (() => true);
    this.tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
    this.rng = options.rng;
    this.generateLogId = options.generateLogId ?? (() => crypto.randomUUID());
    this.now = options.now ?? Date.now;
    this.currentState = options.initialState
      ? {
          ...initialSessionState,
          satiety: options.initialState.satiety,
          today: options.initialState.today,
          meatDeck: options.initialState.meatDeck,
          lastServedMeatId: options.initialState.lastServedMeatId,
        }
      : initialSessionState;
  }

  get state(): Readonly<ChurrascoSessionState> {
    return this.currentState;
  }

  get onStateChange(): Event<ChurrascoSessionState> {
    return this.stateEmitter.event;
  }

  get onMeatLogged(): Event<MeatLogEntry> {
    return this.logEmitter.event;
  }

  get onMeatServed(): Event<MeatServedEvent> {
    return this.meatServedEmitter.event;
  }

  start(): void {
    const { status } = this.currentState;
    if (status === 'stopped') {
      const now = this.now();
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

  eat(): void {
    const meat = this.lookupCurrentMeat();
    if (meat === null) {
      return;
    }
    const now = this.now();
    const { nextSatiety, isFull } = applyEat(this.currentState.satiety, meat, this.getMaxSatiety());
    const intervalMs = this.getIntervalMinutes() * 60_000;
    if (isFull) {
      const autoStop = this.getAutoStopWhenFull();
      this.setState({
        ...this.currentState,
        status: autoStop ? 'stopped' : 'full',
        currentMeatId: null,
        nextArrivalAt: null,
        satiety: nextSatiety,
      });
      this.clearTimer();
    } else {
      this.setState({
        ...this.currentState,
        status: 'running',
        currentMeatId: null,
        nextArrivalAt: new Date(now + intervalMs).toISOString(),
        satiety: nextSatiety,
      });
    }
    this.logEmitter.fire({
      id: this.generateLogId(),
      meatId: meat.id,
      action: 'eaten',
      createdAt: new Date(now).toISOString(),
      satietyDelta: meat.satiety,
    });
  }

  pass(): void {
    const meat = this.lookupCurrentMeat();
    if (meat === null) {
      return;
    }
    const now = this.now();
    const intervalMs = this.getIntervalMinutes() * 60_000;
    this.setState({
      ...this.currentState,
      status: 'running',
      currentMeatId: null,
      nextArrivalAt: new Date(now + intervalMs).toISOString(),
    });
    this.logEmitter.fire({
      id: this.generateLogId(),
      meatId: meat.id,
      action: 'passed',
      createdAt: new Date(now).toISOString(),
      satietyDelta: 0,
    });
  }

  dispose(): void {
    this.clearTimer();
    this.stateEmitter.dispose();
    this.logEmitter.dispose();
    this.meatServedEmitter.dispose();
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
    const now = this.now();
    const { status, nextArrivalAt } = this.currentState;
    if ((status !== 'running' && status !== 'meatArrived') || nextArrivalAt === null) {
      return;
    }
    if (Date.parse(nextArrivalAt) > now) {
      return;
    }
    const previousMeatId = this.currentState.currentMeatId;
    const result = drawNext(
      {
        meatDeck: this.currentState.meatDeck,
        lastServedMeatId: this.currentState.lastServedMeatId,
      },
      this.meats,
      this.rng,
    );
    const intervalMs = this.getIntervalMinutes() * 60_000;
    const servedAt = new Date(now).toISOString();
    this.setState({
      ...this.currentState,
      status: 'meatArrived',
      currentMeatId: result.meat.id,
      meatDeck: result.state.meatDeck,
      lastServedMeatId: result.state.lastServedMeatId,
      nextArrivalAt: new Date(now + intervalMs).toISOString(),
      lastTickAt: servedAt,
    });
    this.meatServedEmitter.fire({ meatId: result.meat.id, servedAt });
    if (status === 'meatArrived' && previousMeatId !== null) {
      this.logEmitter.fire({
        id: this.generateLogId(),
        meatId: previousMeatId,
        action: 'cooled',
        createdAt: servedAt,
        satietyDelta: 0,
      });
    }
  }

  private lookupCurrentMeat(): Meat | null {
    const { currentMeatId } = this.currentState;
    if (currentMeatId === null) {
      return null;
    }
    return this.meats.find((meat) => meat.id === currentMeatId) ?? null;
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
