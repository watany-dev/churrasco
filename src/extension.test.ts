import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposable, ExtensionContext, Memento } from 'vscode';

const {
  registerCommandMock,
  getConfigurationMock,
  createStatusBarItemMock,
  onDidChangeConfigurationMock,
  showInformationMessageMock,
  showWarningMessageMock,
  showQuickPickMock,
} = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  getConfigurationMock: vi.fn(),
  createStatusBarItemMock: vi.fn(),
  onDidChangeConfigurationMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
  showWarningMessageMock: vi.fn(),
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
      showWarningMessage: showWarningMessageMock,
      showQuickPick: showQuickPickMock,
    },
  };
});

import { COMMAND_IDS } from './constants/commands';
import { activate, deactivate } from './extension';

class FakeMemento implements Memento {
  private store = new Map<string, unknown>();
  keys(): readonly string[] {
    return [...this.store.keys()];
  }
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.store.has(key) ? (this.store.get(key) as T) : defaultValue) as T | undefined;
  }
  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
    return Promise.resolve();
  }
}

function createContext(): ExtensionContext {
  return {
    subscriptions: [] as Disposable[],
    globalState: new FakeMemento(),
  } as unknown as ExtensionContext;
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
    showWarningMessageMock.mockReset();
    showQuickPickMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers every command on activation including M5 showTodayLog and resetToday', () => {
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
        COMMAND_IDS.showTodayLog,
        COMMAND_IDS.resetToday,
      ]),
    );
    expect(registerCommandMock).toHaveBeenCalledTimes(8);
  });

  it('shows the today log via window.showInformationMessage when showTodayLog is invoked', () => {
    const context = createContext();
    activate(context);
    const call = registerCommandMock.mock.calls.find((c) => c[0] === COMMAND_IDS.showTodayLog);
    const handler = call?.[1] as (() => void) | undefined;
    handler?.();
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    const message = showInformationMessageMock.mock.calls[0]?.[0];
    expect(typeof message).toBe('string');
    expect(message as string).toContain("🍖 Today's churrasco log");
  });

  it('pushes services, controllers, wiring, and command disposables into subscriptions', () => {
    const context = createContext();
    activate(context);
    // 6 services/controllers + 4 wiring listeners + 8 commands = 18
    expect(context.subscriptions).toHaveLength(18);
  });

  it('asks for modal confirmation before resetToday and skips reset when the user dismisses', async () => {
    const context = createContext();
    activate(context);
    const call = registerCommandMock.mock.calls.find((c) => c[0] === COMMAND_IDS.resetToday);
    const handler = call?.[1] as (() => Promise<void>) | undefined;
    showWarningMessageMock.mockResolvedValueOnce(undefined);
    await handler?.();
    expect(showWarningMessageMock).toHaveBeenCalledTimes(1);
    const args = showWarningMessageMock.mock.calls[0] ?? [];
    expect(args[1]).toEqual({ modal: true });
  });

  it('wires the eatCurrentMeat handler to a non-throwing service call instead of the M3 placeholder', () => {
    const context = createContext();

    activate(context);

    const eatCall = registerCommandMock.mock.calls.find(
      (call) => call[0] === COMMAND_IDS.eatCurrentMeat,
    );
    const eatHandler = eatCall?.[1] as (() => void) | undefined;
    expect(() => eatHandler?.()).not.toThrow();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });

  it('wires the passCurrentMeat handler to a non-throwing service call instead of the M3 placeholder', () => {
    const context = createContext();

    activate(context);

    const passCall = registerCommandMock.mock.calls.find(
      (call) => call[0] === COMMAND_IDS.passCurrentMeat,
    );
    const passHandler = passCall?.[1] as (() => void) | undefined;
    expect(() => passHandler?.()).not.toThrow();
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });
});

describe('deactivate', () => {
  it('returns without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
