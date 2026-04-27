import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { showInformationMessageMock, executeCommandMock } = vi.hoisted(() => ({
  showInformationMessageMock: vi.fn(),
  executeCommandMock: vi.fn(),
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
    commands: {
      executeCommand: executeCommandMock,
    },
  };
});

import { COMMAND_IDS } from '../constants/commands';
import { DEFAULT_MEATS } from '../constants/meats';
import { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { NotificationController } from './NotificationController';

const FROZEN_NOW = Date.parse('2026-04-26T00:00:00Z');

function setup(overrides: { enableNotifications?: boolean } = {}): {
  controller: NotificationController;
  service: ChurrascoSessionService;
  enableNotificationsRef: { current: boolean };
} {
  const enableNotificationsRef = { current: overrides.enableNotifications ?? true };
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: () => 0.1,
    getMaxSatiety: () => 10_000,
  });
  const controller = new NotificationController({
    service,
    meats: DEFAULT_MEATS,
    getEnableNotifications: () => enableNotificationsRef.current,
  });
  return { controller, service, enableNotificationsRef };
}

describe('NotificationController', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
    showInformationMessageMock.mockReset();
    executeCommandMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows a single notification on the running -> meatArrived transition', () => {
    const { controller, service } = setup();
    showInformationMessageMock.mockResolvedValueOnce(undefined);

    service.start();
    vi.advanceTimersByTime(7_000);

    expect(service.state.status).toBe('meatArrived');
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    const [title, ...buttons] = showInformationMessageMock.mock.calls[0] ?? [];
    const meat = DEFAULT_MEATS.find((m) => m.id === service.state.currentMeatId);
    expect(title).toBe(`🍖 ${meat?.nameJa} が焼き上がりました`);
    expect(buttons).toEqual(['食べる', 'パス', '今日は終了']);

    controller.dispose();
    service.dispose();
  });

  it('does not re-notify on the cooled meatArrived -> meatArrived transition', () => {
    const { controller, service } = setup();
    showInformationMessageMock.mockResolvedValue(undefined);

    service.start();
    vi.advanceTimersByTime(7_000);
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(7_000);

    expect(service.state.status).toBe('meatArrived');
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);

    controller.dispose();
    service.dispose();
  });

  it('skips the notification when getEnableNotifications returns false', () => {
    const { controller, service } = setup({ enableNotifications: false });

    service.start();
    vi.advanceTimersByTime(7_000);

    expect(service.state.status).toBe('meatArrived');
    expect(showInformationMessageMock).not.toHaveBeenCalled();

    controller.dispose();
    service.dispose();
  });

  it('re-evaluates getEnableNotifications on each meatArrived edge', () => {
    const { controller, service, enableNotificationsRef } = setup({ enableNotifications: false });
    showInformationMessageMock.mockResolvedValue(undefined);

    service.start();
    vi.advanceTimersByTime(7_000);
    expect(showInformationMessageMock).not.toHaveBeenCalled();

    // Restart so the next meatArrived re-crosses the running -> meatArrived edge.
    service.stop();
    enableNotificationsRef.current = true;
    service.start();
    vi.advanceTimersByTime(7_000);

    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);

    controller.dispose();
    service.dispose();
  });

  it.each([
    ['食べる', COMMAND_IDS.eatCurrentMeat],
    ['パス', COMMAND_IDS.passCurrentMeat],
    ['今日は終了', COMMAND_IDS.stopSession],
  ])('forwards "%s" to %s via executeCommand', async (label, command) => {
    const { controller, service } = setup();
    showInformationMessageMock.mockResolvedValueOnce(label);

    service.start();
    vi.advanceTimersByTime(7_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(executeCommandMock).toHaveBeenCalledTimes(1);
    expect(executeCommandMock).toHaveBeenCalledWith(command);

    controller.dispose();
    service.dispose();
  });

  it('does not call executeCommand when the user dismisses the notification', async () => {
    const { controller, service } = setup();
    showInformationMessageMock.mockResolvedValueOnce(undefined);

    service.start();
    vi.advanceTimersByTime(7_000);
    await vi.advanceTimersByTimeAsync(0);

    expect(executeCommandMock).not.toHaveBeenCalled();

    controller.dispose();
    service.dispose();
  });

  it('routes a delayed button choice to the current command id even after a cooled draw', async () => {
    const { controller, service } = setup();
    let resolveChoice: (value: string | undefined) => void = () => {};
    showInformationMessageMock.mockImplementationOnce(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveChoice = resolve;
        }),
    );

    service.start();
    vi.advanceTimersByTime(7_000);
    expect(service.state.status).toBe('meatArrived');

    // The user keeps the notification open while the cooled tick swaps in a new meat.
    vi.advanceTimersByTime(7_000);
    expect(service.state.status).toBe('meatArrived');

    resolveChoice('食べる');
    await vi.advanceTimersByTimeAsync(0);

    expect(executeCommandMock).toHaveBeenCalledTimes(1);
    expect(executeCommandMock).toHaveBeenCalledWith(COMMAND_IDS.eatCurrentMeat);

    controller.dispose();
    service.dispose();
  });

  it('stops handling state changes after dispose', () => {
    const { controller, service } = setup();
    showInformationMessageMock.mockResolvedValue(undefined);

    controller.dispose();
    service.start();
    vi.advanceTimersByTime(7_000);

    expect(showInformationMessageMock).not.toHaveBeenCalled();

    service.dispose();
  });
});
