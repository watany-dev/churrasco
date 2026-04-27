import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
  class FakeEventEmitter<T> {
    private readonly listeners = new Set<(event: T) => void>();
    readonly event = (listener: (event: T) => void): { dispose: () => void } => {
      this.listeners.add(listener);
      return {
        dispose: () => {
          this.listeners.delete(listener);
        },
      };
    };
    fire(event: T): void {
      for (const listener of this.listeners) {
        listener(event);
      }
    }
    dispose(): void {
      this.listeners.clear();
    }
  }
  return { EventEmitter: FakeEventEmitter };
});

import { DEFAULT_MEATS } from '../constants/meats';
import type { MeatLogEntry } from '../domain/log';
import type { ChurrascoSessionState } from '../domain/session';
import { ChurrascoSessionService } from './ChurrascoSessionService';

const FROZEN_NOW = Date.parse('2026-04-26T00:00:00Z');
const HUGE_MAX_SATIETY = 10_000;

function createService(
  overrides: Partial<{
    intervalMinutes: number;
    intervalGetter: () => number;
    maxSatiety: number;
    maxSatietyGetter: () => number;
    rng: () => number;
    tickIntervalMs: number;
    generateLogId: () => string;
  }> = {},
): {
  service: ChurrascoSessionService;
  events: ChurrascoSessionState[];
  logs: MeatLogEntry[];
} {
  const intervalMinutes = overrides.intervalMinutes ?? 10;
  const maxSatiety = overrides.maxSatiety ?? HUGE_MAX_SATIETY;
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: overrides.intervalGetter ?? (() => intervalMinutes),
    getMaxSatiety: overrides.maxSatietyGetter ?? (() => maxSatiety),
    tickIntervalMs: overrides.tickIntervalMs ?? 1000,
    ...(overrides.rng ? { rng: overrides.rng } : {}),
    ...(overrides.generateLogId ? { generateLogId: overrides.generateLogId } : {}),
  });
  const events: ChurrascoSessionState[] = [];
  service.onStateChange((state) => events.push({ ...state }));
  const logs: MeatLogEntry[] = [];
  service.onMeatLogged((entry) => logs.push({ ...entry }));
  return { service, events, logs };
}

describe('ChurrascoSessionService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts in stopped status with all timestamp fields null', () => {
      const { service } = createService();
      expect(service.state.status).toBe('stopped');
      expect(service.state.startedAt).toBeNull();
      expect(service.state.lastTickAt).toBeNull();
      expect(service.state.nextArrivalAt).toBeNull();
      expect(service.state.currentMeatId).toBeNull();
      expect(service.state.today).toBe('');
    });
  });

  describe('start', () => {
    it('transitions stopped to running with nextArrivalAt = now + intervalMs and snapshots today', () => {
      const { service } = createService({ intervalMinutes: 10 });
      service.start();
      expect(service.state.status).toBe('running');
      expect(service.state.nextArrivalAt).toBe(new Date(FROZEN_NOW + 10 * 60_000).toISOString());
      expect(service.state.today).toBe('2026-04-26');
      service.dispose();
    });

    it('is a no-op when already running', () => {
      const { service, events } = createService();
      service.start();
      const eventsAfterFirstStart = events.length;
      const startedAt = service.state.startedAt;
      vi.advanceTimersByTime(5_000);
      service.start();
      expect(events.length).toBe(eventsAfterFirstStart);
      expect(service.state.startedAt).toBe(startedAt);
      service.dispose();
    });

    it('resumes from paused without changing nextArrivalAt', () => {
      const { service } = createService();
      service.start();
      const nextArrivalAtAtStart = service.state.nextArrivalAt;
      service.pause();
      expect(service.state.status).toBe('paused');
      service.start();
      expect(service.state.status).toBe('running');
      expect(service.state.nextArrivalAt).toBe(nextArrivalAtAtStart);
      service.dispose();
    });

    it('is a no-op when in meatArrived', () => {
      const { service, events } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      expect(service.state.status).toBe('meatArrived');
      const eventsBefore = events.length;
      service.start();
      expect(events.length).toBe(eventsBefore);
      expect(service.state.status).toBe('meatArrived');
      service.dispose();
    });
  });

  describe('stop', () => {
    it('transitions any state to stopped and clears arrival fields', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      expect(service.state.status).toBe('meatArrived');
      service.stop();
      expect(service.state.status).toBe('stopped');
      expect(service.state.currentMeatId).toBeNull();
      expect(service.state.nextArrivalAt).toBeNull();
      service.dispose();
    });

    it('does not fire onStateChange when already stopped', () => {
      const { service, events } = createService();
      const eventsBefore = events.length;
      service.stop();
      expect(events.length).toBe(eventsBefore);
      service.dispose();
    });

    it('prevents further tick fires after stop', () => {
      const { service, events } = createService({ intervalMinutes: 0.1 });
      service.start();
      service.stop();
      const eventsBefore = events.length;
      vi.advanceTimersByTime(60_000);
      expect(events.length).toBe(eventsBefore);
      service.dispose();
    });
  });

  describe('pause', () => {
    it('transitions running to paused while keeping nextArrivalAt', () => {
      const { service } = createService();
      service.start();
      const nextArrivalAtAtStart = service.state.nextArrivalAt;
      service.pause();
      expect(service.state.status).toBe('paused');
      expect(service.state.nextArrivalAt).toBe(nextArrivalAtAtStart);
      service.dispose();
    });

    it('does not transition to meatArrived while paused even past nextArrivalAt', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      service.pause();
      vi.advanceTimersByTime(60_000);
      expect(service.state.status).toBe('paused');
      service.dispose();
    });

    it('is a no-op when not running', () => {
      const { service, events } = createService();
      const eventsBefore = events.length;
      service.pause();
      expect(events.length).toBe(eventsBefore);
      expect(service.state.status).toBe('stopped');
      service.dispose();
    });
  });

  describe('tick and meatArrived', () => {
    it('transitions to meatArrived once intervalMs has elapsed', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      expect(service.state.status).toBe('meatArrived');
      expect(service.state.currentMeatId).not.toBeNull();
      expect(DEFAULT_MEATS.some((meat) => meat.id === service.state.currentMeatId)).toBe(true);
      service.dispose();
    });

    it('updates meatDeck and lastServedMeatId on arrival', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      expect(service.state.meatDeck.length).toBe(DEFAULT_MEATS.length - 1);
      expect(service.state.lastServedMeatId).toBe(service.state.currentMeatId);
      service.dispose();
    });

    it('does not re-arrive once already in meatArrived', () => {
      const { service, events } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      const eventsAfterArrival = events.length;
      vi.advanceTimersByTime(60_000);
      expect(events.length).toBe(eventsAfterArrival);
      service.dispose();
    });
  });

  describe('dispose', () => {
    it('prevents tick fires after dispose', () => {
      const { service, events } = createService({ intervalMinutes: 0.1 });
      service.start();
      service.dispose();
      const eventsBefore = events.length;
      vi.advanceTimersByTime(60_000);
      expect(events.length).toBe(eventsBefore);
    });

    it('does not throw when called twice', () => {
      const { service } = createService();
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });

  describe('configuration snapshot', () => {
    it('re-evaluates getIntervalMinutes on each start', () => {
      let interval = 1;
      const { service } = createService({ intervalGetter: () => interval });
      service.start();
      expect(service.state.nextArrivalAt).toBe(new Date(FROZEN_NOW + 60_000).toISOString());
      service.stop();
      interval = 5;
      service.start();
      expect(service.state.nextArrivalAt).toBe(new Date(FROZEN_NOW + 5 * 60_000).toISOString());
      service.dispose();
    });
  });

  describe('eat', () => {
    it('is a no-op when there is no current meat', () => {
      const { service, events, logs } = createService();
      const eventsBefore = events.length;
      service.eat();
      expect(events.length).toBe(eventsBefore);
      expect(logs).toHaveLength(0);
      service.dispose();
    });

    it('emits an eaten log entry with the served meat satiety after meatArrived', () => {
      const { service, logs } = createService({
        intervalMinutes: 0.1,
        generateLogId: () => 'log-1',
      });
      service.start();
      vi.advanceTimersByTime(7_000);
      expect(service.state.status).toBe('meatArrived');
      const meatId = service.state.currentMeatId;
      service.eat();

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: 'log-1',
        meatId,
        action: 'eaten',
      });
      expect(logs[0]?.satietyDelta).toBeGreaterThan(0);
      expect(logs[0]?.createdAt).toBe(new Date(FROZEN_NOW + 7_000).toISOString());
      service.dispose();
    });

    it('adds the meat satiety to the running satiety total', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      const meatId = service.state.currentMeatId;
      const meat = DEFAULT_MEATS.find((m) => m.id === meatId);
      service.eat();
      expect(service.state.satiety).toBe(meat?.satiety);
      service.dispose();
    });

    it('returns to running with a fresh nextArrivalAt when below maxSatiety', () => {
      const { service } = createService({ intervalMinutes: 0.1, maxSatiety: HUGE_MAX_SATIETY });
      service.start();
      vi.advanceTimersByTime(7_000);
      service.eat();
      expect(service.state.status).toBe('running');
      expect(service.state.currentMeatId).toBeNull();
      expect(service.state.nextArrivalAt).toBe(new Date(FROZEN_NOW + 7_000 + 6_000).toISOString());
      service.dispose();
    });

    it('transitions to full and clears nextArrivalAt when satiety reaches max', () => {
      const { service } = createService({ intervalMinutes: 0.1, maxSatiety: 1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      service.eat();
      expect(service.state.status).toBe('full');
      expect(service.state.currentMeatId).toBeNull();
      expect(service.state.nextArrivalAt).toBeNull();
      service.dispose();
    });

    it('fires onStateChange before onMeatLogged', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      const order: string[] = [];
      service.onStateChange(() => order.push('state'));
      service.onMeatLogged(() => order.push('log'));
      service.start();
      vi.advanceTimersByTime(7_000);
      order.length = 0;
      service.eat();
      expect(order).toEqual(['state', 'log']);
      service.dispose();
    });

    it('re-evaluates getMaxSatiety on each eat call', () => {
      let max = HUGE_MAX_SATIETY;
      const { service } = createService({
        intervalMinutes: 0.1,
        maxSatietyGetter: () => max,
      });
      service.start();
      vi.advanceTimersByTime(7_000);
      service.eat();
      expect(service.state.status).toBe('running');
      max = 1;
      vi.advanceTimersByTime(7_000);
      service.eat();
      expect(service.state.status).toBe('full');
      service.dispose();
    });
  });

  describe('pass', () => {
    it('is a no-op when there is no current meat', () => {
      const { service, events, logs } = createService();
      const eventsBefore = events.length;
      service.pass();
      expect(events.length).toBe(eventsBefore);
      expect(logs).toHaveLength(0);
      service.dispose();
    });

    it('emits a passed log entry with zero satietyDelta', () => {
      const { service, logs } = createService({
        intervalMinutes: 0.1,
        generateLogId: () => 'log-pass-1',
      });
      service.start();
      vi.advanceTimersByTime(7_000);
      const meatId = service.state.currentMeatId;
      service.pass();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: 'log-pass-1',
        meatId,
        action: 'passed',
        satietyDelta: 0,
      });
      service.dispose();
    });

    it('keeps satiety unchanged and returns to running with a fresh nextArrivalAt', () => {
      const { service } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      const satietyBefore = service.state.satiety;
      service.pass();
      expect(service.state.satiety).toBe(satietyBefore);
      expect(service.state.status).toBe('running');
      expect(service.state.currentMeatId).toBeNull();
      expect(service.state.nextArrivalAt).toBe(new Date(FROZEN_NOW + 7_000 + 6_000).toISOString());
      service.dispose();
    });
  });

  describe('dispose with log emitter', () => {
    it('does not fire onMeatLogged after dispose', () => {
      const { service, logs } = createService({ intervalMinutes: 0.1 });
      service.start();
      vi.advanceTimersByTime(7_000);
      service.dispose();
      service.eat();
      expect(logs).toHaveLength(0);
    });
  });
});
