import {
  type Disposable,
  type ExtensionContext,
  type MessageItem,
  commands,
  window,
  workspace,
} from 'vscode';
import { COMMAND_IDS } from './constants/commands';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_SECTION,
  DEFAULT_AUTO_STOP_WHEN_FULL,
  DEFAULT_ENABLE_NOTIFICATIONS,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_SATIETY,
  sanitizeBoolean,
  sanitizeInterval,
  sanitizeMaxSatiety,
} from './constants/configuration';
import { DEFAULT_MEATS } from './constants/meats';
import { ChurrascoSessionService } from './services/ChurrascoSessionService';
import { TodayLogService } from './services/TodayLogService';
import { ChurrascoStateRepository } from './storage/ChurrascoStateRepository';
import type { PersistedSnapshot } from './storage/PersistedSnapshot';
import { applyDateRollover } from './storage/dateRollover';
import { EndOfSessionSummaryController } from './ui/EndOfSessionSummaryController';
import { NotificationController } from './ui/NotificationController';
import { QuickPickController } from './ui/QuickPickController';
import { StatusBarController } from './ui/StatusBarController';
import { formatTodayLog } from './ui/formatTodayLog';

const RESET_CONFIRM: MessageItem = { title: 'Reset' };

export function activate(context: ExtensionContext): void {
  const knownMeatIds = DEFAULT_MEATS.map((m) => m.id);
  const repository = new ChurrascoStateRepository(
    context.globalState,
    () => new Date().toISOString().slice(0, 10),
    knownMeatIds,
  );
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = applyDateRollover(repository.load(), today);

  const session = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    initialState: {
      satiety: snapshot.session.satiety,
      today: snapshot.session.today,
      meatDeck: snapshot.session.meatDeck,
      lastServedMeatId: snapshot.session.lastServedMeatId,
    },
    getIntervalMinutes: () =>
      sanitizeInterval(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<number>(CONFIGURATION_KEYS.intervalMinutes, DEFAULT_INTERVAL_MINUTES),
      ),
    getMaxSatiety: () =>
      sanitizeMaxSatiety(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<number>(CONFIGURATION_KEYS.maxSatiety, DEFAULT_MAX_SATIETY),
      ),
    getAutoStopWhenFull: () =>
      sanitizeBoolean(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<boolean>(CONFIGURATION_KEYS.autoStopWhenFull, DEFAULT_AUTO_STOP_WHEN_FULL),
        DEFAULT_AUTO_STOP_WHEN_FULL,
      ),
  });

  const todayLog = new TodayLogService({
    initialState: {
      todayLog: [...snapshot.todayLog],
      lifetime: {
        perMeatEncounter: { ...snapshot.lifetime.perMeatEncounter },
        eaten: snapshot.lifetime.eaten,
      },
    },
  });

  const statusBar = new StatusBarController({ service: session, meats: DEFAULT_MEATS });
  const quickPick = new QuickPickController({ service: session });
  const notifications = new NotificationController({
    service: session,
    meats: DEFAULT_MEATS,
    getEnableNotifications: () =>
      sanitizeBoolean(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<boolean>(CONFIGURATION_KEYS.enableNotifications, DEFAULT_ENABLE_NOTIFICATIONS),
        DEFAULT_ENABLE_NOTIFICATIONS,
      ),
  });
  const summary = new EndOfSessionSummaryController({
    session,
    todayLog,
    getMaxSatiety: () =>
      sanitizeMaxSatiety(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<number>(CONFIGURATION_KEYS.maxSatiety, DEFAULT_MAX_SATIETY),
      ),
  });

  const wiring: Disposable[] = [];
  wiring.push(session.onMeatLogged((entry) => todayLog.recordEntry(entry)));
  wiring.push(session.onMeatServed((event) => todayLog.recordEncounter(event.meatId)));

  const persist = (): void => {
    const next: PersistedSnapshot = {
      schemaVersion: 1,
      session: {
        today: session.state.today,
        satiety: session.state.satiety,
        meatDeck: session.state.meatDeck,
        lastServedMeatId: session.state.lastServedMeatId,
      },
      todayLog: [...todayLog.todayLog],
      lifetime: {
        perMeatEncounter: { ...todayLog.lifetime.perMeatEncounter },
        eaten: todayLog.lifetime.eaten,
      },
      lastLaunchDate: today,
    };
    repository.save(next);
  };
  wiring.push(session.onStateChange(persist));
  wiring.push(todayLog.onChange(persist));

  context.subscriptions.push(
    session,
    todayLog,
    statusBar,
    quickPick,
    notifications,
    summary,
    ...wiring,
    commands.registerCommand(COMMAND_IDS.startSession, () => session.start()),
    commands.registerCommand(COMMAND_IDS.stopSession, () => session.stop()),
    commands.registerCommand(COMMAND_IDS.pauseSession, () => session.pause()),
    commands.registerCommand(COMMAND_IDS.openMenu, () => quickPick.open()),
    commands.registerCommand(COMMAND_IDS.eatCurrentMeat, () => session.eat()),
    commands.registerCommand(COMMAND_IDS.passCurrentMeat, () => session.pass()),
    commands.registerCommand(COMMAND_IDS.showTodayLog, () => {
      const text = formatTodayLog({
        todayLog: todayLog.todayLog,
        satiety: session.state.satiety,
        maxSatiety: sanitizeMaxSatiety(
          workspace
            .getConfiguration(CONFIGURATION_SECTION)
            .get<number>(CONFIGURATION_KEYS.maxSatiety, DEFAULT_MAX_SATIETY),
        ),
        meats: DEFAULT_MEATS,
      });
      void window.showInformationMessage(text);
    }),
    commands.registerCommand(COMMAND_IDS.resetToday, async () => {
      const choice = await window.showWarningMessage(
        "Reset today's log?",
        { modal: true },
        RESET_CONFIRM,
      );
      if (choice?.title === RESET_CONFIRM.title) {
        todayLog.resetToday();
      }
    }),
  );
}

export function deactivate(): void {}
