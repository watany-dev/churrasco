import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposable, ExtensionContext } from 'vscode';

const { registerCommandMock, getConfigurationMock } = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  getConfigurationMock: vi.fn(),
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
    commands: {
      registerCommand: registerCommandMock,
    },
    workspace: {
      getConfiguration: getConfigurationMock,
    },
    EventEmitter: FakeEventEmitter,
  };
});

import { COMMAND_IDS } from './constants/commands';
import { activate, deactivate } from './extension';

function createContext(): ExtensionContext {
  return { subscriptions: [] as Disposable[] } as unknown as ExtensionContext;
}

describe('activate', () => {
  beforeEach(() => {
    registerCommandMock.mockReset();
    registerCommandMock.mockReturnValue({ dispose: vi.fn() });
    getConfigurationMock.mockReset();
    getConfigurationMock.mockReturnValue({
      get: vi.fn().mockReturnValue(10),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers startSession, stopSession, and pauseSession on activation', () => {
    const context = createContext();

    activate(context);

    expect(registerCommandMock).toHaveBeenCalledTimes(3);
    expect(registerCommandMock).toHaveBeenCalledWith(
      COMMAND_IDS.startSession,
      expect.any(Function),
    );
    expect(registerCommandMock).toHaveBeenCalledWith(COMMAND_IDS.stopSession, expect.any(Function));
    expect(registerCommandMock).toHaveBeenCalledWith(
      COMMAND_IDS.pauseSession,
      expect.any(Function),
    );
  });

  it('pushes the session service plus the three command disposables into subscriptions', () => {
    const context = createContext();

    activate(context);

    expect(context.subscriptions).toHaveLength(4);
  });
});

describe('deactivate', () => {
  it('returns without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
