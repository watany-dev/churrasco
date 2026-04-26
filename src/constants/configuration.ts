export const DEFAULT_INTERVAL_MINUTES = 10;

export function sanitizeInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_INTERVAL_MINUTES;
}
