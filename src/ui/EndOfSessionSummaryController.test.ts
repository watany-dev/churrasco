import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { showInformationMessageMock } = vi.hoisted(() => ({
  showInformationMessageMock: vi.fn(),
}));

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
  return {
    EventEmitter: FakeEventEmitter,
    window: {
      showInformationMessage: showInformationMessageMock,
    },
  };
});

import { DEFAULT_MEATS } from '../constants/meats';
import { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { TodayLogService } from '../services/TodayLogService';
import { EndOfSessionSummaryController } from './EndOfSessionSummaryController';

const FROZEN_NOW = Date.parse('2026-04-27T00:00:00Z');

describe('EndOfSessionSummaryController', () => {
  beforeEach(() => {
    showInformationMessageMock.mockReset();
    vi.useFakeTimers({ now: FROZEN_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the summary on the running → stopped edge', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
      getAutoStopWhenFull: () => false,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    session.stop();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    const message = showInformationMessageMock.mock.calls[0]?.[0];
    expect(message).toContain("🏁 Today's churrasco has ended.");
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('does not show the summary when starting (stopped → running edge)', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('does not show the summary on stopped → stopped (no event fires)', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.stop();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('shows the summary on the meatArrived → stopped edge', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    vi.advanceTimersByTime(7_000);
    session.stop();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('shows the summary on the autoStop → stopped edge (eat with isFull=true)', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 1,
      getAutoStopWhenFull: () => true,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    vi.advanceTimersByTime(7_000);
    session.eat();
    expect(session.state.status).toBe('stopped');
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('passes accurate eaten/passed counts pulled from TodayLogService', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    todayLog.recordEntry({
      id: 'l1',
      meatId: 'picanha',
      action: 'eaten',
      createdAt: '2026-04-27T01:00:00.000Z',
      satietyDelta: 10,
    });
    todayLog.recordEntry({
      id: 'l2',
      meatId: 'alcatra',
      action: 'passed',
      createdAt: '2026-04-27T01:10:00.000Z',
      satietyDelta: 0,
    });
    session.stop();
    const message = showInformationMessageMock.mock.calls[0]?.[0];
    expect(message).toContain('Eaten: 1');
    expect(message).toContain('Passed: 1');
    controller.dispose();
    todayLog.dispose();
    session.dispose();
  });

  it('does not fire after dispose', () => {
    const session = new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 0.1,
      getMaxSatiety: () => 100,
    });
    const todayLog = new TodayLogService();
    const controller = new EndOfSessionSummaryController({ session, todayLog });
    session.start();
    controller.dispose();
    session.stop();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
    todayLog.dispose();
    session.dispose();
  });
});
