import { type Disposable, commands, window } from 'vscode';
import { COMMAND_IDS } from '../constants/commands';
import type { ChurrascoSessionState, SessionStatus } from '../domain/session';
import type { ChurrascoSessionService } from '../services/ChurrascoSessionService';

interface QuickPickControllerOptions {
  service: ChurrascoSessionService;
}

interface ChurrascoQuickPickItem {
  label: string;
  command: string;
}

const PLACEHOLDER = 'Churrasco Break';

const ITEM_LABELS: Record<keyof typeof COMMAND_IDS, string> = {
  startSession: '🔥 Start service',
  pauseSession: '⏸ Pause',
  stopSession: '🛑 End for the day',
  eatCurrentMeat: '🍖 Eat the current meat',
  passCurrentMeat: '🙅 Pass the current meat',
  openMenu: '',
};

export class QuickPickController implements Disposable {
  private readonly service: ChurrascoSessionService;

  constructor(options: QuickPickControllerOptions) {
    this.service = options.service;
  }

  async open(): Promise<void> {
    const items = this.buildItems(this.service.state);
    const picked = await window.showQuickPick(items, { placeHolder: PLACEHOLDER });
    if (picked) {
      await commands.executeCommand(picked.command);
    }
  }

  buildItems(state: ChurrascoSessionState): ChurrascoQuickPickItem[] {
    const items: ChurrascoQuickPickItem[] = [];
    if (state.currentMeatId !== null) {
      items.push(this.item('eatCurrentMeat'), this.item('passCurrentMeat'));
    }
    if (canStart(state.status)) {
      items.push(this.item('startSession'));
    }
    if (state.status === 'running') {
      items.push(this.item('pauseSession'));
    }
    if (state.status !== 'stopped') {
      items.push(this.item('stopSession'));
    }
    return items;
  }

  dispose(): void {}

  private item(key: keyof typeof COMMAND_IDS): ChurrascoQuickPickItem {
    return { label: ITEM_LABELS[key], command: COMMAND_IDS[key] };
  }
}

function canStart(status: SessionStatus): boolean {
  return status === 'stopped' || status === 'paused';
}
