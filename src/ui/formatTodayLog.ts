import type { MeatLogAction, MeatLogEntry } from '../domain/log';
import type { Meat } from '../domain/meat';

interface FormatTodayLogInput {
  todayLog: readonly MeatLogEntry[];
  satiety: number;
  maxSatiety: number;
  meats: readonly Meat[];
}

const ACTION_EMOJI: Record<MeatLogAction, string> = {
  eaten: '✅',
  passed: '⏭',
  cooled: '🥶',
};

export function formatTodayLog(input: FormatTodayLogInput): string {
  const eaten = countAction(input.todayLog, 'eaten');
  const passed = countAction(input.todayLog, 'passed');
  const cooled = countAction(input.todayLog, 'cooled');
  const percent = Math.min(100, Math.round((input.satiety / input.maxSatiety) * 100));

  const header = [
    "🍖 Today's churrasco log",
    '',
    `Eaten: ${eaten}`,
    `Passed: ${passed}`,
    `Cooled: ${cooled}`,
    `Satiety: ${percent}%`,
    '',
  ];

  if (input.todayLog.length === 0) {
    return [...header, 'No meats logged yet.'].join('\n');
  }

  const lines = input.todayLog.map((entry) => {
    const time = formatTime(entry.createdAt);
    const emoji = ACTION_EMOJI[entry.action];
    const name = lookupMeatName(entry.meatId, input.meats);
    return `${time} ${emoji} ${name}`;
  });
  return [...header, ...lines].join('\n');
}

function countAction(log: readonly MeatLogEntry[], action: MeatLogAction): number {
  return log.filter((entry) => entry.action === action).length;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function lookupMeatName(meatId: string, meats: readonly Meat[]): string {
  return meats.find((m) => m.id === meatId)?.nameEn ?? 'Unknown meat';
}
