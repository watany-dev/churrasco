import { type Disposable, window } from 'vscode';
import type { ChurrascoSessionService } from '../services/ChurrascoSessionService';
import type { TodayLogService } from '../services/TodayLogService';
import { formatEndOfSessionSummary } from './formatEndOfSessionSummary';

interface EndOfSessionSummaryControllerOptions {
  session: ChurrascoSessionService;
  todayLog: TodayLogService;
  getMaxSatiety?: () => number;
}

const DEFAULT_MAX_SATIETY = 100;

export class EndOfSessionSummaryController implements Disposable {
  private readonly session: ChurrascoSessionService;
  private readonly todayLog: TodayLogService;
  private readonly getMaxSatiety: () => number;
  private readonly subscription: Disposable;
  private previousStatus: string;

  constructor(options: EndOfSessionSummaryControllerOptions) {
    this.session = options.session;
    this.todayLog = options.todayLog;
    this.getMaxSatiety = options.getMaxSatiety ?? (() => DEFAULT_MAX_SATIETY);
    this.previousStatus = this.session.state.status;
    this.subscription = this.session.onStateChange(() => this.onStateChanged());
  }

  dispose(): void {
    this.subscription.dispose();
  }

  private onStateChanged(): void {
    const previous = this.previousStatus;
    const current = this.session.state.status;
    this.previousStatus = current;
    if (current !== 'stopped' || previous === 'stopped') {
      return;
    }
    const text = formatEndOfSessionSummary({
      todayLog: this.todayLog.todayLog,
      satiety: this.session.state.satiety,
      maxSatiety: this.getMaxSatiety(),
    });
    void window.showInformationMessage(text);
  }
}
