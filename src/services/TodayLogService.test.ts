import { describe, expect, it, vi } from 'vitest';

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

import type { MeatLogEntry } from '../domain/log';
import { TodayLogService } from './TodayLogService';

function entry(overrides: Partial<MeatLogEntry> = {}): MeatLogEntry {
  return {
    id: overrides.id ?? 'log-1',
    meatId: overrides.meatId ?? 'picanha',
    action: overrides.action ?? 'eaten',
    createdAt: overrides.createdAt ?? '2026-04-27T08:00:00.000Z',
    satietyDelta: overrides.satietyDelta ?? 12,
  };
}

describe('TodayLogService', () => {
  describe('initial state', () => {
    it('seeds from initialState', () => {
      const service = new TodayLogService({
        initialState: {
          todayLog: [entry({ id: 'l0' })],
          lifetime: { perMeatEncounter: { picanha: 2 }, eaten: 1 },
        },
      });
      expect(service.todayLog).toHaveLength(1);
      expect(service.lifetime.eaten).toBe(1);
      expect(service.lifetime.perMeatEncounter.picanha).toBe(2);
      service.dispose();
    });

    it('starts empty when initialState is omitted', () => {
      const service = new TodayLogService();
      expect(service.todayLog).toHaveLength(0);
      expect(service.lifetime.eaten).toBe(0);
      expect(service.lifetime.perMeatEncounter).toEqual({});
      service.dispose();
    });
  });

  describe('recordEntry', () => {
    it('appends to todayLog and increments lifetime.eaten on eaten', () => {
      const service = new TodayLogService();
      service.recordEntry(entry({ id: 'l1', action: 'eaten' }));
      expect(service.todayLog).toHaveLength(1);
      expect(service.lifetime.eaten).toBe(1);
      service.dispose();
    });

    it('appends to todayLog without incrementing lifetime.eaten on passed', () => {
      const service = new TodayLogService();
      service.recordEntry(entry({ id: 'l1', action: 'passed', satietyDelta: 0 }));
      expect(service.todayLog).toHaveLength(1);
      expect(service.lifetime.eaten).toBe(0);
      service.dispose();
    });

    it('appends to todayLog without incrementing lifetime.eaten on cooled', () => {
      const service = new TodayLogService();
      service.recordEntry(entry({ id: 'l1', action: 'cooled', satietyDelta: 0 }));
      expect(service.todayLog).toHaveLength(1);
      expect(service.lifetime.eaten).toBe(0);
      service.dispose();
    });

    it('fires onChange exactly once per recordEntry', () => {
      const service = new TodayLogService();
      const events: number[] = [];
      service.onChange(() => events.push(1));
      service.recordEntry(entry({ id: 'l1' }));
      service.recordEntry(entry({ id: 'l2', action: 'passed' }));
      expect(events).toHaveLength(2);
      service.dispose();
    });
  });

  describe('recordEncounter', () => {
    it('increments perMeatEncounter[meatId] from zero', () => {
      const service = new TodayLogService();
      service.recordEncounter('picanha');
      expect(service.lifetime.perMeatEncounter.picanha).toBe(1);
      service.dispose();
    });

    it('accumulates encounters across multiple calls per meat', () => {
      const service = new TodayLogService();
      service.recordEncounter('picanha');
      service.recordEncounter('picanha');
      service.recordEncounter('alcatra');
      expect(service.lifetime.perMeatEncounter.picanha).toBe(2);
      expect(service.lifetime.perMeatEncounter.alcatra).toBe(1);
      service.dispose();
    });

    it('fires onChange', () => {
      const service = new TodayLogService();
      let fired = 0;
      service.onChange(() => fired++);
      service.recordEncounter('picanha');
      expect(fired).toBe(1);
      service.dispose();
    });
  });

  describe('resetToday', () => {
    it('clears todayLog while preserving lifetime', () => {
      const service = new TodayLogService({
        initialState: {
          todayLog: [entry({ id: 'l0' })],
          lifetime: { perMeatEncounter: { picanha: 3 }, eaten: 5 },
        },
      });
      service.resetToday();
      expect(service.todayLog).toHaveLength(0);
      expect(service.lifetime.eaten).toBe(5);
      expect(service.lifetime.perMeatEncounter.picanha).toBe(3);
      service.dispose();
    });

    it('fires onChange', () => {
      const service = new TodayLogService({
        initialState: {
          todayLog: [entry()],
          lifetime: { perMeatEncounter: {}, eaten: 1 },
        },
      });
      let fired = 0;
      service.onChange(() => fired++);
      service.resetToday();
      expect(fired).toBe(1);
      service.dispose();
    });
  });

  describe('dispose', () => {
    it('does not throw when called twice', () => {
      const service = new TodayLogService();
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
