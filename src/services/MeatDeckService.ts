import type { Meat } from '../domain/meat';

export interface MeatDeckState {
  deck: string[];
  lastServedMeatId: string | null;
}

function shuffle(ids: string[], rng: () => number): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as string, result[i] as string];
  }
  return result;
}

/**
 * Draw the next meat from the deck. Refills by reshuffling allMeats when
 * the deck is empty.
 *
 * @param state - Current deck state.
 * @param allMeats - The full meat catalog. Must be non-empty.
 * @param rng - Random source in [0, 1). Defaults to Math.random.
 */
export function drawNext(
  state: MeatDeckState,
  allMeats: Meat[],
  rng: () => number = Math.random,
): { meat: Meat; state: MeatDeckState } {
  const deck =
    state.deck.length > 0
      ? [...state.deck]
      : shuffle(
          allMeats.map((m) => m.id),
          rng,
        );
  const nextId = deck.shift() as string;
  const meat = allMeats.find((m) => m.id === nextId) as Meat;
  return {
    meat,
    state: { deck, lastServedMeatId: meat.id },
  };
}
