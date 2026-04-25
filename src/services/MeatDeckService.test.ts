import { describe, expect, it } from 'vitest';
import { DEFAULT_MEATS } from '../constants/meats';
import { type MeatDeckState, drawNext } from './MeatDeckService';

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('drawNext', () => {
  it('serves all 12 meats in a single cycle without repeats', () => {
    const rng = createSeededRng(1);
    let state: MeatDeckState = { deck: [], lastServedMeatId: null };
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const result = drawNext(state, DEFAULT_MEATS, rng);
      seen.push(result.meat.id);
      state = result.state;
    }
    expect(new Set(seen).size).toBe(12);
    expect(state.deck).toHaveLength(0);
  });

  it('updates lastServedMeatId to the drawn meat', () => {
    const rng = createSeededRng(42);
    const state: MeatDeckState = { deck: [], lastServedMeatId: null };
    const result = drawNext(state, DEFAULT_MEATS, rng);
    expect(result.state.lastServedMeatId).toBe(result.meat.id);
  });

  it('uses Math.random when no rng is supplied', () => {
    const state: MeatDeckState = { deck: [], lastServedMeatId: null };
    const result = drawNext(state, DEFAULT_MEATS);
    expect(DEFAULT_MEATS.some((m) => m.id === result.meat.id)).toBe(true);
    expect(result.state.deck).toHaveLength(11);
  });

  // Seed 30 puts 'picanha' at the head of the freshly shuffled deck;
  // the swap moves it to position 1 and serves 'abacaxi' instead.
  it('swaps deck[0] with deck[1] when refilled head equals lastServedMeatId', () => {
    const rng = createSeededRng(30);
    const state: MeatDeckState = { deck: [], lastServedMeatId: 'picanha' };
    const result = drawNext(state, DEFAULT_MEATS, rng);
    expect(result.meat.id).toBe('abacaxi');
    expect(result.state.deck[0]).toBe('picanha');
  });

  // Seed 1 produces 'cupim' at the head, so no swap is needed.
  it('does not swap when refilled head differs from lastServedMeatId', () => {
    const rng = createSeededRng(1);
    const state: MeatDeckState = { deck: [], lastServedMeatId: 'picanha' };
    const result = drawNext(state, DEFAULT_MEATS, rng);
    expect(result.meat.id).toBe('cupim');
  });
});
