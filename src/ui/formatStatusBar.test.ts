import { describe, expect, it } from 'vitest';
import { COMMAND_IDS } from '../constants/commands';
import { DEFAULT_MEATS } from '../constants/meats';
import type { ChurrascoSessionState } from '../domain/session';
import { initialSessionState } from '../domain/session';
import { formatStatusBarText } from './formatStatusBar';

const FROZEN_NOW = Date.parse('2026-04-26T00:00:00Z');

function withState(overrides: Partial<ChurrascoSessionState>): ChurrascoSessionState {
  return { ...initialSessionState, ...overrides };
}

function isoFromNow(seconds: number): string {
  return new Date(FROZEN_NOW + seconds * 1000).toISOString();
}

describe('formatStatusBarText', () => {
  describe('stopped', () => {
    it('renders the stopped text and tooltip', () => {
      const result = formatStatusBarText(
        withState({ status: 'stopped' }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Churrasco: stopped');
      expect(result.tooltip).toContain('Status: stopped');
      expect(result.tooltip).toContain('Click to open the menu');
    });
  });

  describe('running', () => {
    it('formats nextArrivalAt 222s in the future as 03:42', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: isoFromNow(222) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 03:42');
      expect(result.tooltip).toContain('Next meat: in 03:42');
    });

    it('renders 00:00 when nextArrivalAt is exactly now', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: isoFromNow(0) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 00:00');
    });

    it('clamps a past nextArrivalAt to 00:00 instead of going negative', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: isoFromNow(-30) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 00:00');
    });

    it('formats 59 seconds as 00:59', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: isoFromNow(59) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 00:59');
    });

    it('formats 60 seconds as 01:00', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: isoFromNow(60) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 01:00');
    });

    it('renders 00:00 when nextArrivalAt is null', () => {
      const result = formatStatusBarText(
        withState({ status: 'running', nextArrivalAt: null }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🥩 Next meat in 00:00');
    });
  });

  describe('meatArrived', () => {
    it('renders the English meat name from currentMeatId', () => {
      const result = formatStatusBarText(
        withState({ status: 'meatArrived', currentMeatId: 'picanha' }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🍖 Picanha has arrived');
      expect(result.tooltip).toContain('Meat: Picanha');
    });

    it('falls back to "unknown meat" when currentMeatId is not in meats', () => {
      const result = formatStatusBarText(
        withState({ status: 'meatArrived', currentMeatId: 'mystery' }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🍖 unknown meat has arrived');
    });

    it('falls back to "unknown meat" when currentMeatId is null', () => {
      const result = formatStatusBarText(
        withState({ status: 'meatArrived', currentMeatId: null }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('🍖 unknown meat has arrived');
    });
  });

  describe('paused', () => {
    it('renders the paused text and tooltip with frozen remaining time', () => {
      const result = formatStatusBarText(
        withState({ status: 'paused', nextArrivalAt: isoFromNow(222) }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.text).toBe('⏸ Churrasco: paused');
      expect(result.tooltip).toContain('Next meat: in 03:42 (paused)');
    });
  });

  describe('full', () => {
    it('renders the full text and tooltip', () => {
      const result = formatStatusBarText(withState({ status: 'full' }), FROZEN_NOW, DEFAULT_MEATS);
      expect(result.text).toBe('🍖 Churrasco: full');
      expect(result.tooltip).toContain('Status: full');
    });
  });

  describe('common contract', () => {
    const cases: SessionStatus[] = ['stopped', 'running', 'paused', 'meatArrived', 'full'];

    it.each(cases)('exposes openMenu command for %s', (status) => {
      const result = formatStatusBarText(
        withState({ status, currentMeatId: status === 'meatArrived' ? 'picanha' : null }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.command).toBe(COMMAND_IDS.openMenu);
    });

    it.each(cases)('tooltip ends with the click-to-open hint for %s', (status) => {
      const result = formatStatusBarText(
        withState({ status, currentMeatId: status === 'meatArrived' ? 'picanha' : null }),
        FROZEN_NOW,
        DEFAULT_MEATS,
      );
      expect(result.tooltip.endsWith('Click to open the menu')).toBe(true);
    });
  });
});

type SessionStatus = ChurrascoSessionState['status'];
