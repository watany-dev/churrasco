export const CONFIGURATION_SECTION = 'churrasco';

export const CONFIGURATION_KEYS = {
  intervalMinutes: 'intervalMinutes',
  showStatusBar: 'showStatusBar',
} as const;

export const DEFAULT_INTERVAL_MINUTES = 10;

export function sanitizeInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_INTERVAL_MINUTES;
}
