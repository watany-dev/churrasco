import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_SATIETY,
  sanitizeBoolean,
  sanitizeInterval,
  sanitizeMaxSatiety,
} from './configuration';

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

describe('sanitizeMaxSatiety', () => {
  it('returns the value when given a finite number at or above the minimum', () => {
    expect(sanitizeMaxSatiety(50)).toBe(50);
    expect(sanitizeMaxSatiety(10)).toBe(10);
  });

  it('falls back to the default when given a value below the minimum', () => {
    expect(sanitizeMaxSatiety(9)).toBe(DEFAULT_MAX_SATIETY);
    expect(sanitizeMaxSatiety(0)).toBe(DEFAULT_MAX_SATIETY);
    expect(sanitizeMaxSatiety(-100)).toBe(DEFAULT_MAX_SATIETY);
  });

  it('falls back to the default when given non-finite numbers', () => {
    expect(sanitizeMaxSatiety(Number.NaN)).toBe(DEFAULT_MAX_SATIETY);
    expect(sanitizeMaxSatiety(Number.POSITIVE_INFINITY)).toBe(DEFAULT_MAX_SATIETY);
  });

  it('falls back to the default when given non-number values', () => {
    expect(sanitizeMaxSatiety('100')).toBe(DEFAULT_MAX_SATIETY);
    expect(sanitizeMaxSatiety(null)).toBe(DEFAULT_MAX_SATIETY);
    expect(sanitizeMaxSatiety(undefined)).toBe(DEFAULT_MAX_SATIETY);
  });
});

describe('sanitizeBoolean', () => {
  it('returns the value when given a boolean', () => {
    expect(sanitizeBoolean(true, false)).toBe(true);
    expect(sanitizeBoolean(false, true)).toBe(false);
  });

  it('falls back to the fallback when given non-boolean values', () => {
    expect(sanitizeBoolean('true', false)).toBe(false);
    expect(sanitizeBoolean(1, false)).toBe(false);
    expect(sanitizeBoolean(null, true)).toBe(true);
    expect(sanitizeBoolean(undefined, true)).toBe(true);
  });
});
