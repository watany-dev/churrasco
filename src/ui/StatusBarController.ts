import {
  type ConfigurationChangeEvent,
  type Disposable,
  StatusBarAlignment,
  type StatusBarItem,
  window,
  workspace,
} from 'vscode';
import { COMMAND_IDS } from '../constants/commands';
import { CONFIGURATION_KEYS, CONFIGURATION_SECTION } from '../constants/configuration';
import type { Meat } from '../domain/meat';
import type { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import { formatStatusBarText } from './formatStatusBar';

interface StatusBarControllerOptions {
  service: ChurrascoSessionService;
  meats: Meat[];
  refreshIntervalMs?: number;
  now?: () => number;
}

const DEFAULT_REFRESH_INTERVAL_MS = 1000;

export class StatusBarController implements Disposable {
  private readonly service: ChurrascoSessionService;
  private readonly meats: Meat[];
  private readonly refreshIntervalMs: number;
  private readonly now: () => number;
  private readonly item: StatusBarItem;
  private readonly subscriptions: Disposable[] = [];
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  constructor(options: StatusBarControllerOptions) {
    this.service = options.service;
    this.meats = options.meats;
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.now = options.now ?? Date.now;

    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.item.command = COMMAND_IDS.openMenu;

    this.subscriptions.push(this.service.onStateChange(() => this.onStateChanged()));
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((event) => this.onConfigurationChanged(event)),
    );

    this.applyVisibility();
    this.render();
    this.syncRefresh();
  }

  dispose(): void {
    this.clearRefresh();
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.subscriptions.length = 0;
    this.item.dispose();
  }

  private onStateChanged(): void {
    this.render();
    this.syncRefresh();
  }

  private onConfigurationChanged(event: ConfigurationChangeEvent): void {
    if (
      event.affectsConfiguration(`${CONFIGURATION_SECTION}.${CONFIGURATION_KEYS.showStatusBar}`)
    ) {
      this.applyVisibility();
    }
  }

  private applyVisibility(): void {
    const visible = workspace
      .getConfiguration(CONFIGURATION_SECTION)
      .get<boolean>(CONFIGURATION_KEYS.showStatusBar, true);
    if (visible) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  private render(): void {
    const render = formatStatusBarText(this.service.state, this.now(), this.meats);
    this.item.text = render.text;
    this.item.tooltip = render.tooltip;
    this.item.command = render.command;
  }

  private syncRefresh(): void {
    if (this.service.state.status === 'running') {
      this.ensureRefresh();
    } else {
      this.clearRefresh();
    }
  }

  private ensureRefresh(): void {
    this.refreshHandle ??= setInterval(() => this.render(), this.refreshIntervalMs);
  }

  private clearRefresh(): void {
    if (this.refreshHandle !== null) {
      clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}
