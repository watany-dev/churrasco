import { type Disposable, commands, window } from 'vscode';
import { COMMAND_IDS } from '../constants/commands';
import type { Meat } from '../domain/meat';
import type { ChurrascoSessionState, SessionStatus } from '../domain/session';
import type { ChurrascoSessionService } from '../services/ChurrascoSessionService';

interface NotificationControllerOptions {
  service: ChurrascoSessionService;
  meats: Meat[];
  getEnableNotifications: () => boolean;
}

const BUTTON_EAT = '食べる';
const BUTTON_PASS = 'パス';
const BUTTON_STOP = '今日は終了';

const BUTTON_TO_COMMAND: Record<string, string> = {
  [BUTTON_EAT]: COMMAND_IDS.eatCurrentMeat,
  [BUTTON_PASS]: COMMAND_IDS.passCurrentMeat,
  [BUTTON_STOP]: COMMAND_IDS.stopSession,
};

export class NotificationController implements Disposable {
  private readonly service: ChurrascoSessionService;
  private readonly meats: Meat[];
  private readonly getEnableNotifications: () => boolean;
  private readonly subscriptions: Disposable[] = [];
  private previousStatus: SessionStatus;

  constructor(options: NotificationControllerOptions) {
    this.service = options.service;
    this.meats = options.meats;
    this.getEnableNotifications = options.getEnableNotifications;
    this.previousStatus = this.service.state.status;
    this.subscriptions.push(this.service.onStateChange((state) => this.onStateChanged(state)));
  }

  dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.subscriptions.length = 0;
  }

  private onStateChanged(state: ChurrascoSessionState): void {
    const previous = this.previousStatus;
    this.previousStatus = state.status;
    if (previous === 'meatArrived' || state.status !== 'meatArrived') {
      return;
    }
    if (!this.getEnableNotifications()) {
      return;
    }
    const meat = this.meats.find((candidate) => candidate.id === state.currentMeatId);
    if (meat === undefined) {
      return;
    }
    void this.notify(meat);
  }

  private async notify(meat: Meat): Promise<void> {
    const title = `🍖 ${meat.nameJa} が焼き上がりました`;
    const choice = await window.showInformationMessage(title, BUTTON_EAT, BUTTON_PASS, BUTTON_STOP);
    if (choice === undefined) {
      return;
    }
    const command = BUTTON_TO_COMMAND[choice];
    if (command !== undefined) {
      await commands.executeCommand(command);
    }
  }
}
