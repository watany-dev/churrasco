export const CONFIGURATION_SECTION = 'churrasco';

export const CONFIGURATION_KEYS = {
  intervalMinutes: 'intervalMinutes',
  showStatusBar: 'showStatusBar',
  enableNotifications: 'enableNotifications',
  maxSatiety: 'maxSatiety',
} as const;

export const DEFAULT_INTERVAL_MINUTES = 10;
export const DEFAULT_MAX_SATIETY = 100;
export const DEFAULT_ENABLE_NOTIFICATIONS = true;

const MIN_MAX_SATIETY = 10;

export function sanitizeInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_INTERVAL_MINUTES;
}

export function sanitizeMaxSatiety(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_MAX_SATIETY
    ? value
    : DEFAULT_MAX_SATIETY;
}

export function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
