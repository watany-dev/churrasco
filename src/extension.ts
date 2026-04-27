import { type ExtensionContext, commands, window, workspace } from 'vscode';
import { COMMAND_IDS } from './constants/commands';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_SECTION,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_SATIETY,
  sanitizeInterval,
  sanitizeMaxSatiety,
} from './constants/configuration';
import { DEFAULT_MEATS } from './constants/meats';
import { ChurrascoSessionService } from './services/ChurrascoSessionService';
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

  context.subscriptions.push(
    service,
    statusBar,
    quickPick,
    commands.registerCommand(COMMAND_IDS.startSession, () => service.start()),
    commands.registerCommand(COMMAND_IDS.stopSession, () => service.stop()),
    commands.registerCommand(COMMAND_IDS.pauseSession, () => service.pause()),
    commands.registerCommand(COMMAND_IDS.openMenu, () => quickPick.open()),
    commands.registerCommand(COMMAND_IDS.eatCurrentMeat, () =>
      window.showInformationMessage('Eat will be implemented in Milestone 4'),
    ),
    commands.registerCommand(COMMAND_IDS.passCurrentMeat, () =>
      window.showInformationMessage('Pass will be implemented in Milestone 4'),
    ),
  );
}

export function deactivate(): void {}
