import { type ExtensionContext, commands, workspace } from 'vscode';
import { COMMAND_IDS } from './constants/commands';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_SECTION,
  DEFAULT_ENABLE_NOTIFICATIONS,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_SATIETY,
  sanitizeBoolean,
  sanitizeInterval,
  sanitizeMaxSatiety,
} from './constants/configuration';
import { DEFAULT_MEATS } from './constants/meats';
import { ChurrascoSessionService } from './services/ChurrascoSessionService';
import { NotificationController } from './ui/NotificationController';
import { QuickPickController } from './ui/QuickPickController';
import { StatusBarController } from './ui/StatusBarController';

export function activate(context: ExtensionContext): void {
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
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
  });
  const statusBar = new StatusBarController({ service, meats: DEFAULT_MEATS });
  const quickPick = new QuickPickController({ service });
  const notifications = new NotificationController({
    service,
    meats: DEFAULT_MEATS,
    getEnableNotifications: () =>
      sanitizeBoolean(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<boolean>(CONFIGURATION_KEYS.enableNotifications, DEFAULT_ENABLE_NOTIFICATIONS),
        DEFAULT_ENABLE_NOTIFICATIONS,
      ),
  });

  context.subscriptions.push(
    service,
    statusBar,
    quickPick,
    notifications,
    commands.registerCommand(COMMAND_IDS.startSession, () => service.start()),
    commands.registerCommand(COMMAND_IDS.stopSession, () => service.stop()),
    commands.registerCommand(COMMAND_IDS.pauseSession, () => service.pause()),
    commands.registerCommand(COMMAND_IDS.openMenu, () => quickPick.open()),
    commands.registerCommand(COMMAND_IDS.eatCurrentMeat, () => service.eat()),
    commands.registerCommand(COMMAND_IDS.passCurrentMeat, () => service.pass()),
  );
}

export function deactivate(): void {}
