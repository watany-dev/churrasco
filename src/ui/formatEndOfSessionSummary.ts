import type { MeatLogEntry } from '../domain/log';

interface FormatEndOfSessionSummaryInput {
  todayLog: readonly MeatLogEntry[];
  satiety: number;
  maxSatiety: number;
}

export function formatEndOfSessionSummary(input: FormatEndOfSessionSummaryInput): string {
  const eaten = input.todayLog.filter((entry) => entry.action === 'eaten').length;
  const passed = input.todayLog.filter((entry) => entry.action === 'passed').length;
  const percent = Math.min(100, Math.round((input.satiety / input.maxSatiety) * 100));
  return [
    "🏁 Today's churrasco has ended.",
    `Eaten: ${eaten} / Passed: ${passed} / Satiety: ${percent}%`,
  ].join('\n');
}
