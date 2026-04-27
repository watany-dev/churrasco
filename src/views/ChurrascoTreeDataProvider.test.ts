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
  class FakeTreeItem {
    label: string;
    description: string | undefined;
    collapsibleState: number;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }
  return {
    EventEmitter: FakeEventEmitter,
    TreeItem: FakeTreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  };
});

import { DEFAULT_MEATS } from '../constants/meats';
import { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { TodayLogService } from '../services/TodayLogService';
import { ChurrascoTreeDataProvider } from './ChurrascoTreeDataProvider';
import { ChurrascoTreeItem } from './ChurrascoTreeItem';

const FROZEN_NOW = Date.parse('2026-04-27T01:00:00.000Z');

function createServices(): { service: ChurrascoSessionService; todayLog: TodayLogService } {
  return {
    service: new ChurrascoSessionService({
      meats: DEFAULT_MEATS,
      getIntervalMinutes: () => 10,
      getMaxSatiety: () => 100,
      tickIntervalMs: 1000,
    }),
    todayLog: new TodayLogService(),
  };
}

function createProvider(refreshIntervalMs = 1000): {
  provider: ChurrascoTreeDataProvider;
  service: ChurrascoSessionService;
  todayLog: TodayLogService;
} {
  const { service, todayLog } = createServices();
  const provider = new ChurrascoTreeDataProvider({
    service,
    todayLog,
    meats: DEFAULT_MEATS,
    getMaxSatiety: () => 100,
    refreshIntervalMs,
    now: () => Date.now(),
  });
  return { provider, service, todayLog };
}

describe('ChurrascoTreeDataProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FROZEN_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns three section ChurrascoTreeItems for the root', () => {
    const { provider, service, todayLog } = createProvider();
    const roots = provider.getChildren();
    expect(roots).toHaveLength(3);
    for (const root of roots) {
      expect(root).toBeInstanceOf(ChurrascoTreeItem);
    }
    expect(roots.map((r) => r.label)).toEqual([
      'Service status',
      "Today's meats",
      'Meat collection',
    ]);
    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });

  it('returns leaf items for a given section parent', () => {
    const { provider, service, todayLog } = createProvider();
    const [statusSection] = provider.getChildren();
    if (!statusSection) throw new Error('status section missing');
    const leaves = provider.getChildren(statusSection);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf).toBeInstanceOf(ChurrascoTreeItem);
      expect(leaf.collapsibleState).toBe(0);
    }
    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });

  it('fires onDidChangeTreeData when the session state changes', () => {
    const { provider, service, todayLog } = createProvider();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    service.start();
    expect(listener).toHaveBeenCalled();
    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });

  it('fires onDidChangeTreeData when todayLog changes', () => {
    const { provider, service, todayLog } = createProvider();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    todayLog.recordEncounter('picanha');
    expect(listener).toHaveBeenCalled();
    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });

  it('refreshes on the interval while running and stops when not running', () => {
    const { provider, service, todayLog } = createProvider(500);
    service.start();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    const runningCalls = listener.mock.calls.length;
    expect(runningCalls).toBeGreaterThanOrEqual(2);

    service.pause();
    listener.mockClear();
    vi.advanceTimersByTime(2000);
    expect(listener).not.toHaveBeenCalled();

    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });

  it('clears the refresh timer and listeners on dispose', () => {
    const { provider, service, todayLog } = createProvider(500);
    service.start();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    provider.dispose();

    vi.advanceTimersByTime(2000);
    expect(listener).not.toHaveBeenCalled();

    service.dispose();
    todayLog.dispose();
  });

  it('returns the same item from getTreeItem', () => {
    const { provider, service, todayLog } = createProvider();
    const [first] = provider.getChildren();
    if (!first) throw new Error('expected at least one item');
    expect(provider.getTreeItem(first)).toBe(first);
    provider.dispose();
    service.dispose();
    todayLog.dispose();
  });
});
