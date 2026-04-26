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
import type { ChurrascoSessionState } from '../domain/session';
import { ChurrascoSessionService } from './ChurrascoSessionService';

const FROZEN_NOW = Date.parse('2026-04-26T00:00:00Z');

function createService(
  overrides: Partial<{
    intervalMinutes: number;
    intervalGetter: () => number;
    rng: () => number;
    tickIntervalMs: number;
  }> = {},
): {
  service: ChurrascoSessionService;
  events: ChurrascoSessionState[];
} {
  const intervalMinutes = overrides.intervalMinutes ?? 10;
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: overrides.intervalGetter ?? (() => intervalMinutes),
    tickIntervalMs: overrides.tickIntervalMs ?? 1000,
    ...(overrides.rng ? { rng: overrides.rng } : {}),
  });
  const events: ChurrascoSessionState[] = [];
  service.onStateChange((state) => events.push({ ...state }));
  return { service, events };
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
});
