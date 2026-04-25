import { type ExtensionContext, commands, window } from 'vscode';
import { COMMAND_IDS } from './constants/commands';

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand(COMMAND_IDS.startSession, () => {
      window.showInformationMessage('Churrasco started (stub)');
    }),
  );
}

export function deactivate(): void {}
