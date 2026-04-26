import { type ExtensionContext, commands, workspace } from 'vscode';
import { COMMAND_IDS } from './constants/commands';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_SECTION,
  DEFAULT_INTERVAL_MINUTES,
  sanitizeInterval,
} from './constants/configuration';
import { DEFAULT_MEATS } from './constants/meats';
import { ChurrascoSessionService } from './services/ChurrascoSessionService';

export function activate(context: ExtensionContext): void {
  const service = new ChurrascoSessionService({
    meats: DEFAULT_MEATS,
    getIntervalMinutes: () =>
      sanitizeInterval(
        workspace
          .getConfiguration(CONFIGURATION_SECTION)
          .get<number>(CONFIGURATION_KEYS.intervalMinutes, DEFAULT_INTERVAL_MINUTES),
      ),
  });

  context.subscriptions.push(
    service,
    commands.registerCommand(COMMAND_IDS.startSession, () => service.start()),
    commands.registerCommand(COMMAND_IDS.stopSession, () => service.stop()),
    commands.registerCommand(COMMAND_IDS.pauseSession, () => service.pause()),
  );
}

export function deactivate(): void {}
