import { type Disposable, type Event, EventEmitter, type TreeDataProvider } from 'vscode';
import type { Meat } from '../domain/meat';
import type { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import type { TodayLogService } from '../services/TodayLogService';
import { ChurrascoTreeItem } from './ChurrascoTreeItem';
import { buildSidebarSections } from './buildSidebarSections';

interface ChurrascoTreeDataProviderOptions {
  service: ChurrascoSessionService;
  todayLog: TodayLogService;
  meats: readonly Meat[];
  getMaxSatiety: () => number;
  refreshIntervalMs?: number;
  now?: () => number;
}

const DEFAULT_REFRESH_INTERVAL_MS = 1000;

export class ChurrascoTreeDataProvider implements TreeDataProvider<ChurrascoTreeItem>, Disposable {
  private readonly emitter = new EventEmitter<ChurrascoTreeItem | undefined>();
  private readonly service: ChurrascoSessionService;
  private readonly todayLog: TodayLogService;
  private readonly meats: readonly Meat[];
  private readonly getMaxSatiety: () => number;
  private readonly refreshIntervalMs: number;
  private readonly now: () => number;
  private readonly subscriptions: Disposable[] = [];
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChurrascoTreeDataProviderOptions) {
    this.service = options.service;
    this.todayLog = options.todayLog;
    this.meats = options.meats;
    this.getMaxSatiety = options.getMaxSatiety;
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.now = options.now ?? Date.now;

    this.subscriptions.push(this.service.onStateChange(() => this.onSourceChanged()));
    this.subscriptions.push(this.todayLog.onChange(() => this.onSourceChanged()));
    this.syncRefresh();
  }

  get onDidChangeTreeData(): Event<ChurrascoTreeItem | undefined> {
    return this.emitter.event;
  }

  getTreeItem(item: ChurrascoTreeItem): ChurrascoTreeItem {
    return item;
  }

  getChildren(parent?: ChurrascoTreeItem): ChurrascoTreeItem[] {
    if (parent === undefined) {
      const nodes = buildSidebarSections({
        state: this.service.state,
        now: this.now(),
        todayLog: this.todayLog.todayLog,
        lifetime: this.todayLog.lifetime,
        maxSatiety: this.getMaxSatiety(),
        meats: this.meats,
      });
      return nodes.map((node) => new ChurrascoTreeItem(node));
    }
    return parent.children.map((node) => new ChurrascoTreeItem(node));
  }

  dispose(): void {
    this.clearRefresh();
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.subscriptions.length = 0;
    this.emitter.dispose();
  }

  private onSourceChanged(): void {
    this.emitter.fire(undefined);
    this.syncRefresh();
  }

  private syncRefresh(): void {
    if (this.service.state.status === 'running') {
      this.ensureRefresh();
    } else {
      this.clearRefresh();
    }
  }

  private ensureRefresh(): void {
    this.refreshHandle ??= setInterval(() => {
      this.emitter.fire(undefined);
    }, this.refreshIntervalMs);
  }

  private clearRefresh(): void {
    if (this.refreshHandle !== null) {
      clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}
