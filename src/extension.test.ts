import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposable, ExtensionContext } from 'vscode';

const { registerCommandMock, showInformationMessageMock } = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
}));

vi.mock('vscode', () => ({
  commands: {
    registerCommand: registerCommandMock,
  },
  window: {
    showInformationMessage: showInformationMessageMock,
  },
}));

import { COMMAND_IDS } from './constants/commands';
import { activate, deactivate } from './extension';

function createContext(): ExtensionContext {
  return { subscriptions: [] as Disposable[] } as unknown as ExtensionContext;
}

describe('activate', () => {
  beforeEach(() => {
    registerCommandMock.mockReset();
    showInformationMessageMock.mockReset();
    registerCommandMock.mockReturnValue({ dispose: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers churrasco.startSession on activation', () => {
    const context = createContext();

    activate(context);

    expect(registerCommandMock).toHaveBeenCalledTimes(1);
    expect(registerCommandMock).toHaveBeenCalledWith(
      COMMAND_IDS.startSession,
      expect.any(Function),
    );
    expect(context.subscriptions).toHaveLength(1);
  });

  it('shows an information message when the start command is invoked', () => {
    const context = createContext();

    activate(context);

    const handler = registerCommandMock.mock.calls[0]?.[1] as () => void;
    handler();

    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    expect(showInformationMessageMock).toHaveBeenCalledWith('Churrasco started (stub)');
  });
});

describe('deactivate', () => {
  it('returns without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
