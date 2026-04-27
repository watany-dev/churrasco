import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposable, ExtensionContext } from 'vscode';

const {
  registerCommandMock,
  getConfigurationMock,
  createStatusBarItemMock,
  onDidChangeConfigurationMock,
  showInformationMessageMock,
  showQuickPickMock,
} = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  getConfigurationMock: vi.fn(),
  createStatusBarItemMock: vi.fn(),
  onDidChangeConfigurationMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
  showQuickPickMock: vi.fn(),
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
    StatusBarAlignment: { Left: 1, Right: 2 },
    commands: {
      registerCommand: registerCommandMock,
    },
    workspace: {
      getConfiguration: getConfigurationMock,
      onDidChangeConfiguration: onDidChangeConfigurationMock,
    },
    window: {
      createStatusBarItem: createStatusBarItemMock,
      showInformationMessage: showInformationMessageMock,
      showQuickPick: showQuickPickMock,
    },
  };
});

import { COMMAND_IDS } from './constants/commands';
import { activate, deactivate } from './extension';

function createContext(): ExtensionContext {
  return { subscriptions: [] as Disposable[] } as unknown as ExtensionContext;
}

function createFakeStatusBarItem(): {
  text: string;
  tooltip: string | undefined;
  command: string | undefined;
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
} {
  return {
    text: '',
    tooltip: undefined,
    command: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('activate', () => {
  beforeEach(() => {
    registerCommandMock.mockReset();
    registerCommandMock.mockReturnValue({ dispose: vi.fn() });
    getConfigurationMock.mockReset();
    getConfigurationMock.mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    });
    createStatusBarItemMock.mockReset();
    createStatusBarItemMock.mockReturnValue(createFakeStatusBarItem());
    onDidChangeConfigurationMock.mockReset();
    onDidChangeConfigurationMock.mockReturnValue({ dispose: vi.fn() });
    showInformationMessageMock.mockReset();
    showQuickPickMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers every M3 command on activation', () => {
    const context = createContext();

    activate(context);

    const registeredIds = registerCommandMock.mock.calls.map((call) => call[0]);
    expect(registeredIds).toEqual(
      expect.arrayContaining([
        COMMAND_IDS.startSession,
        COMMAND_IDS.stopSession,
        COMMAND_IDS.pauseSession,
        COMMAND_IDS.openMenu,
        COMMAND_IDS.eatCurrentMeat,
        COMMAND_IDS.passCurrentMeat,
      ]),
    );
    expect(registerCommandMock).toHaveBeenCalledTimes(6);
  });

  it('pushes the session service, both UI controllers, and every command disposable into subscriptions', () => {
    const context = createContext();

    activate(context);

    expect(context.subscriptions).toHaveLength(9);
  });

  it('eatCurrentMeat handler shows the M4 placeholder notification', () => {
    const context = createContext();

    activate(context);

    const eatCall = registerCommandMock.mock.calls.find(
      (call) => call[0] === COMMAND_IDS.eatCurrentMeat,
    );
    const eatHandler = eatCall?.[1] as (() => void) | undefined;
    eatHandler?.();

    expect(showInformationMessageMock).toHaveBeenCalledWith(
      'Eat will be implemented in Milestone 4',
    );
  });

  it('passCurrentMeat handler shows the M4 placeholder notification', () => {
    const context = createContext();

    activate(context);

    const passCall = registerCommandMock.mock.calls.find(
      (call) => call[0] === COMMAND_IDS.passCurrentMeat,
    );
    const passHandler = passCall?.[1] as (() => void) | undefined;
    passHandler?.();

    expect(showInformationMessageMock).toHaveBeenCalledWith(
      'Pass will be implemented in Milestone 4',
    );
  });
});

describe('deactivate', () => {
  it('returns without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
