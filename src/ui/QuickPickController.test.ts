import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { showQuickPickMock, executeCommandMock } = vi.hoisted(() => ({
  showQuickPickMock: vi.fn(),
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
      showQuickPick: showQuickPickMock,
    },
    commands: {
      executeCommand: executeCommandMock,
    },
  };
});

import { COMMAND_IDS } from '../constants/commands';
import { DEFAULT_MEATS } from '../constants/meats';
import type { ChurrascoSessionState } from '../domain/session';
import { initialSessionState } from '../domain/session';
import { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { QuickPickController } from './QuickPickController';

function withState(overrides: Partial<ChurrascoSessionState>): ChurrascoSessionState {
  return { ...initialSessionState, ...overrides };
}

function createController(): {
  controller: QuickPickController;
  service: ChurrascoSessionService;
} {
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: () => 10,
    getMaxSatiety: () => 100,
  });
  const controller = new QuickPickController({ service });
  return { controller, service };
}

describe('QuickPickController', () => {
  beforeEach(() => {
    showQuickPickMock.mockReset();
    executeCommandMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildItems', () => {
    it('shows Show today log + Start service when stopped', () => {
      const { controller, service } = createController();
      const items = controller.buildItems(withState({ status: 'stopped' }));
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.startSession,
      ]);
      service.dispose();
      controller.dispose();
    });

    it('shows Show today log + Pause + End for the day when running', () => {
      const { controller, service } = createController();
      const items = controller.buildItems(withState({ status: 'running' }));
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.pauseSession,
        COMMAND_IDS.stopSession,
      ]);
      service.dispose();
      controller.dispose();
    });

    it('shows Show today log + Start service + End for the day when paused', () => {
      const { controller, service } = createController();
      const items = controller.buildItems(withState({ status: 'paused' }));
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.startSession,
        COMMAND_IDS.stopSession,
      ]);
      service.dispose();
      controller.dispose();
    });

    it('shows Eat / Pass / Show today log / End for the day when meat has arrived', () => {
      const { controller, service } = createController();
      const items = controller.buildItems(
        withState({ status: 'meatArrived', currentMeatId: 'picanha' }),
      );
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.eatCurrentMeat,
        COMMAND_IDS.passCurrentMeat,
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.stopSession,
      ]);
      service.dispose();
      controller.dispose();
    });

    it('shows Show today log + End for the day when full', () => {
      const { controller, service } = createController();
      const items = controller.buildItems(withState({ status: 'full' }));
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.stopSession,
      ]);
      service.dispose();
      controller.dispose();
    });

    it('uses spec emoji prefixes in labels', () => {
      const { controller, service } = createController();
      const stopped = controller.buildItems(withState({ status: 'stopped' }));
      const running = controller.buildItems(withState({ status: 'running' }));
      const arrived = controller.buildItems(
        withState({ status: 'meatArrived', currentMeatId: 'picanha' }),
      );
      const firstChar = (label: string): string => [...label][0] ?? '';
      expect(stopped.map((i) => firstChar(i.label))).toEqual(['📋', '🔥']);
      expect(running.map((i) => firstChar(i.label))).toEqual(['📋', '⏸', '🛑']);
      expect(arrived.map((i) => firstChar(i.label))).toEqual(['🍖', '🙅', '📋', '🛑']);
      service.dispose();
      controller.dispose();
    });
  });

  describe('open', () => {
    it('passes state-filtered items to showQuickPick with the placeholder', async () => {
      const { controller, service } = createController();
      showQuickPickMock.mockResolvedValueOnce(undefined);

      await controller.open();

      expect(showQuickPickMock).toHaveBeenCalledTimes(1);
      const call = showQuickPickMock.mock.calls[0] ?? [];
      const items = (call[0] ?? []) as { command: string }[];
      const options = call[1] as { placeHolder: string } | undefined;
      expect(items.map((i) => i.command)).toEqual([
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.startSession,
      ]);
      expect(options).toEqual({ placeHolder: 'Churrasco Break' });

      service.dispose();
      controller.dispose();
    });

    it('forwards the chosen command to executeCommand', async () => {
      const { controller, service } = createController();
      service.start();
      showQuickPickMock.mockImplementationOnce(async (items: { command: string }[]) =>
        items.find((i) => i.command === COMMAND_IDS.pauseSession),
      );

      await controller.open();

      expect(executeCommandMock).toHaveBeenCalledTimes(1);
      expect(executeCommandMock).toHaveBeenCalledWith(COMMAND_IDS.pauseSession);

      service.dispose();
      controller.dispose();
    });

    it('does not execute any command when the user dismisses the picker', async () => {
      const { controller, service } = createController();
      showQuickPickMock.mockResolvedValueOnce(undefined);

      await controller.open();

      expect(executeCommandMock).not.toHaveBeenCalled();

      service.dispose();
      controller.dispose();
    });

    it('selecting Eat from a meat-arrived state forwards eatCurrentMeat', async () => {
      const { controller, service } = createController();
      service.start();
      // Force meatArrived without waiting for the timer
      Object.defineProperty(service, 'state', {
        get: () =>
          withState({
            status: 'meatArrived',
            currentMeatId: 'picanha',
          }),
      });
      showQuickPickMock.mockImplementationOnce(async (items: { command: string }[]) =>
        items.find((i) => i.command === COMMAND_IDS.eatCurrentMeat),
      );

      await controller.open();

      expect(executeCommandMock).toHaveBeenCalledWith(COMMAND_IDS.eatCurrentMeat);

      service.dispose();
      controller.dispose();
    });
  });
});
