import { COMMAND_IDS } from '../constants/commands';
import type { Meat } from '../domain/meat';
import type { ChurrascoSessionState } from '../domain/session';

interface StatusBarRender {
  text: string;
  tooltip: string;
  command: string;
}

export function formatStatusBarText(
  state: ChurrascoSessionState,
  now: number,
  meats: Meat[],
): StatusBarRender {
  const command = COMMAND_IDS.openMenu;
  const tooltipFooter = 'Click to open the menu';
  const remaining = formatRemaining(state.nextArrivalAt, now);

  switch (state.status) {
    case 'stopped':
      return {
        text: '🥩 Churrasco: stopped',
        tooltip: ['Churrasco Break', 'Status: stopped', tooltipFooter].join('\n'),
        command,
      };
    case 'running':
      return {
        text: `🥩 Next meat in ${remaining}`,
        tooltip: [
          'Churrasco Break',
          'Status: running',
          `Next meat: in ${remaining}`,
          tooltipFooter,
        ].join('\n'),
        command,
      };
    case 'paused':
      return {
        text: '⏸ Churrasco: paused',
        tooltip: [
          'Churrasco Break',
          'Status: paused',
          `Next meat: in ${remaining} (paused)`,
          tooltipFooter,
        ].join('\n'),
        command,
      };
    case 'meatArrived': {
      const name = lookupMeatName(state.currentMeatId, meats);
      return {
        text: `🍖 ${name} has arrived`,
        tooltip: ['Churrasco Break', 'Status: meat arrived', `Meat: ${name}`, tooltipFooter].join(
          '\n',
        ),
        command,
      };
    }
    case 'full':
      return {
        text: '🍖 Churrasco: full',
        tooltip: ['Churrasco Break', 'Status: full', tooltipFooter].join('\n'),
        command,
      };
  }
}

function formatRemaining(nextArrivalAt: string | null, now: number): string {
  if (nextArrivalAt === null) {
    return '00:00';
  }
  const remainingSec = Math.max(0, Math.ceil((Date.parse(nextArrivalAt) - now) / 1000));
  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function lookupMeatName(currentMeatId: string | null, meats: Meat[]): string {
  if (currentMeatId === null) {
    return 'unknown meat';
  }
  return meats.find((m) => m.id === currentMeatId)?.nameEn ?? 'unknown meat';
}
