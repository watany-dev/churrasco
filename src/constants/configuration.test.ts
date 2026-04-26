import { describe, expect, it } from 'vitest';
import { DEFAULT_INTERVAL_MINUTES, sanitizeInterval } from './configuration';

describe('sanitizeInterval', () => {
  it('returns the value when given a positive finite number', () => {
    expect(sanitizeInterval(10)).toBe(10);
  });

  it('returns small positive values as-is', () => {
    expect(sanitizeInterval(0.0001)).toBe(0.0001);
  });

  it('falls back to the default when given zero', () => {
    expect(sanitizeInterval(0)).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it('falls back to the default when given a negative number', () => {
    expect(sanitizeInterval(-5)).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it('falls back to the default when given NaN', () => {
    expect(sanitizeInterval(Number.NaN)).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it('falls back to the default when given Infinity', () => {
    expect(sanitizeInterval(Number.POSITIVE_INFINITY)).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it('falls back to the default when given a string', () => {
    expect(sanitizeInterval('10')).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it('falls back to the default when given null or undefined', () => {
    expect(sanitizeInterval(null)).toBe(DEFAULT_INTERVAL_MINUTES);
    expect(sanitizeInterval(undefined)).toBe(DEFAULT_INTERVAL_MINUTES);
  });
});
