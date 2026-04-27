import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createStatusBarItemMock,
  getConfigurationMock,
  onDidChangeConfigurationMock,
  fakeConfigurationListeners,
  fakeStatusBarItem,
} = vi.hoisted(() => {
  const fakeStatusBarItem = {
    text: '',
    tooltip: '' as string | undefined,
    command: undefined as string | undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };
  const fakeConfigurationListeners = new Set<
    (event: { affectsConfiguration: (key: string) => boolean }) => void
  >();
  return {
    createStatusBarItemMock: vi.fn(() => fakeStatusBarItem),
    getConfigurationMock: vi.fn(),
    onDidChangeConfigurationMock: vi.fn(
      (listener: (event: { affectsConfiguration: (key: string) => boolean }) => void) => {
        fakeConfigurationListeners.add(listener);
        return {
          dispose: () => {
            fakeConfigurationListeners.delete(listener);
          },
        };
      },
    ),
    fakeConfigurationListeners,
    fakeStatusBarItem,
  };
});

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
    window: {
      createStatusBarItem: createStatusBarItemMock,
    },
    workspace: {
      getConfiguration: getConfigurationMock,
      onDidChangeConfiguration: onDidChangeConfigurationMock,
    },
  };
});

import { COMMAND_IDS } from '../constants/commands';
import { CONFIGURATION_KEYS, CONFIGURATION_SECTION } from '../constants/configuration';
import { DEFAULT_MEATS } from '../constants/meats';
import { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { StatusBarController } from './StatusBarController';

const FROZEN_NOW = Date.parse('2026-04-26T00:00:00Z');

function setShowStatusBar(value: boolean): void {
  getConfigurationMock.mockImplementation((section: string) => ({
    get: vi.fn((key: string, fallback: unknown) => {
      if (section === CONFIGURATION_SECTION && key === CONFIGURATION_KEYS.showStatusBar) {
        return value;
      }
      return fallback;
    }),
  }));
}

function fireConfigurationChange(affected: string): void {
  for (const listener of fakeConfigurationListeners) {
    listener({ affectsConfiguration: (key: string) => key === affected });
  }
}

function createService(intervalMinutes = 10): ChurrascoSessionService {
  return new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: () => intervalMinutes,
    getMaxSatiety: () => 100,
    tickIntervalMs: 1000,
  });
}

describe('StatusBarController', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
    fakeStatusBarItem.text = '';
    fakeStatusBarItem.tooltip = '';
    fakeStatusBarItem.command = undefined;
    fakeStatusBarItem.show.mockReset();
    fakeStatusBarItem.hide.mockReset();
    fakeStatusBarItem.dispose.mockReset();
    createStatusBarItemMock.mockClear();
    onDidChangeConfigurationMock.mockClear();
    fakeConfigurationListeners.clear();
    setShowStatusBar(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a right-aligned status bar item with the openMenu command on construction', () => {
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    expect(createStatusBarItemMock).toHaveBeenCalledTimes(1);
    expect(createStatusBarItemMock).toHaveBeenCalledWith(2, 100);
    expect(fakeStatusBarItem.command).toBe(COMMAND_IDS.openMenu);

    controller.dispose();
    service.dispose();
  });

  it('renders the stopped text on construction', () => {
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    expect(fakeStatusBarItem.text).toBe('🥩 Churrasco: stopped');

    controller.dispose();
    service.dispose();
  });

  it('renders the running countdown when the session starts', () => {
    const service = createService(10);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();

    expect(fakeStatusBarItem.text).toBe('🥩 Next meat in 10:00');

    controller.dispose();
    service.dispose();
  });

  it('refreshes the countdown every refreshIntervalMs while running', () => {
    const service = createService(10);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();
    expect(fakeStatusBarItem.text).toBe('🥩 Next meat in 10:00');

    vi.advanceTimersByTime(1000);
    expect(fakeStatusBarItem.text).toBe('🥩 Next meat in 09:59');

    vi.advanceTimersByTime(59_000);
    expect(fakeStatusBarItem.text).toBe('🥩 Next meat in 09:00');

    controller.dispose();
    service.dispose();
  });

  it('stops refreshing after the session is paused', () => {
    const service = createService(10);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();
    vi.advanceTimersByTime(1000);
    service.pause();

    const pausedText = fakeStatusBarItem.text;
    expect(pausedText).toBe('⏸ Churrasco: paused');

    vi.advanceTimersByTime(5000);
    expect(fakeStatusBarItem.text).toBe(pausedText);

    controller.dispose();
    service.dispose();
  });

  it('switches to the meat-arrived text when a meat is delivered', () => {
    const service = createService(0.1);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();
    vi.advanceTimersByTime(7000);

    expect(fakeStatusBarItem.text).toMatch(/^🍖 .+ has arrived$/);

    controller.dispose();
    service.dispose();
  });

  it('renders the stopped text after the session is stopped', () => {
    const service = createService(10);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();
    service.stop();

    expect(fakeStatusBarItem.text).toBe('🥩 Churrasco: stopped');

    vi.advanceTimersByTime(5000);
    expect(fakeStatusBarItem.text).toBe('🥩 Churrasco: stopped');

    controller.dispose();
    service.dispose();
  });

  it('hides the status bar when showStatusBar is false', () => {
    setShowStatusBar(false);
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    expect(fakeStatusBarItem.hide).toHaveBeenCalled();
    expect(fakeStatusBarItem.show).not.toHaveBeenCalled();

    controller.dispose();
    service.dispose();
  });

  it('toggles visibility in response to showStatusBar configuration changes', () => {
    setShowStatusBar(true);
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    expect(fakeStatusBarItem.show).toHaveBeenCalledTimes(1);

    setShowStatusBar(false);
    fireConfigurationChange(`${CONFIGURATION_SECTION}.${CONFIGURATION_KEYS.showStatusBar}`);

    expect(fakeStatusBarItem.hide).toHaveBeenCalledTimes(1);

    setShowStatusBar(true);
    fireConfigurationChange(`${CONFIGURATION_SECTION}.${CONFIGURATION_KEYS.showStatusBar}`);

    expect(fakeStatusBarItem.show).toHaveBeenCalledTimes(2);

    controller.dispose();
    service.dispose();
  });

  it('ignores configuration changes that do not affect showStatusBar', () => {
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    fakeStatusBarItem.show.mockClear();
    fakeStatusBarItem.hide.mockClear();

    fireConfigurationChange(`${CONFIGURATION_SECTION}.${CONFIGURATION_KEYS.intervalMinutes}`);

    expect(fakeStatusBarItem.show).not.toHaveBeenCalled();
    expect(fakeStatusBarItem.hide).not.toHaveBeenCalled();

    controller.dispose();
    service.dispose();
  });

  it('disposes the status bar item, subscriptions, and refresh interval', () => {
    const service = createService(10);
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    service.start();
    expect(fakeConfigurationListeners.size).toBe(1);

    controller.dispose();

    expect(fakeStatusBarItem.dispose).toHaveBeenCalledTimes(1);
    expect(fakeConfigurationListeners.size).toBe(0);

    const beforeAdvance = fakeStatusBarItem.text;
    vi.advanceTimersByTime(5000);
    expect(fakeStatusBarItem.text).toBe(beforeAdvance);

    service.dispose();
  });

  it('dispose can be called twice without throwing', () => {
    const service = createService();
    const controller = new StatusBarController({ service, meats: DEFAULT_MEATS });

    expect(() => {
      controller.dispose();
      controller.dispose();
    }).not.toThrow();

    service.dispose();
  });
});
