# Meat Data

## Meat entity

```ts
export type MeatCategory = 'beef' | 'pork' | 'chicken' | 'lamb' | 'side' | 'rare';

export type MeatRarity = 'common' | 'uncommon' | 'rare';

export interface Meat {
  id: string;
  nameJa: string;
  nameEn: string;
  category: MeatCategory;
  rarity: MeatRarity;
  satiety: number;
  flavorText: string;
  effectLabel: string;
}
```

## Default meat list

```ts
export const DEFAULT_MEATS: Meat[] = [
  {
    id: 'picanha',
    nameJa: 'ピッカーニャ（イチボ）',
    nameEn: 'Picanha',
    category: 'beef',
    rarity: 'common',
    satiety: 12,
    flavorText: 'The sweetness of the fat moves your refactor along.',
    effectLabel: 'Focus +1'
  },
  {
    id: 'alcatra',
    nameJa: 'アルカトラ（ランプ）',
    nameEn: 'Alcatra',
    category: 'beef',
    rarity: 'common',
    satiety: 10,
    flavorText: 'Lean strength tightens up your type definitions.',
    effectLabel: 'Design +1'
  },
  {
    id: 'fraldinha',
    nameJa: 'フラウジーニャ（カイノミ）',
    nameEn: 'Fraldinha',
    category: 'beef',
    rarity: 'common',
    satiety: 10,
    flavorText: 'A balanced bite that helps you take review comments in stride.',
    effectLabel: 'Review resistance +1'
  },
  {
    id: 'costela',
    nameJa: 'コステーラ（骨付きバラ）',
    nameEn: 'Costela',
    category: 'beef',
    rarity: 'uncommon',
    satiety: 15,
    flavorText: 'A bone-deep flavor that supports your architecture.',
    effectLabel: 'Structure +2'
  },
  {
    id: 'cupim',
    nameJa: 'クッピン（こぶ肉）',
    nameEn: 'Cupim',
    category: 'beef',
    rarity: 'uncommon',
    satiety: 14,
    flavorText: 'A rich aftertaste lets you face down legacy code.',
    effectLabel: 'Persistence +2'
  },
  {
    id: 'linguica',
    nameJa: 'リングイッサ（ブラジル風ソーセージ）',
    nameEn: 'Linguica',
    category: 'pork',
    rarity: 'common',
    satiety: 8,
    flavorText: 'Lively spice burns through afternoon drowsiness.',
    effectLabel: 'Refresh +2'
  },
  {
    id: 'coracao',
    nameJa: 'コラソン（鶏ハツ）',
    nameEn: 'Coracao',
    category: 'chicken',
    rarity: 'uncommon',
    satiety: 7,
    flavorText: 'Small but brave — strong against bugs, too.',
    effectLabel: 'Courage +1'
  },
  {
    id: 'frango',
    nameJa: 'フランゴ（鶏もも肉）',
    nameEn: 'Frango',
    category: 'chicken',
    rarity: 'common',
    satiety: 9,
    flavorText: 'A light chicken bite reboots your afternoon.',
    effectLabel: 'Reboot +1'
  },
  {
    id: 'porco',
    nameJa: 'ポルコ（豚肩ロース）',
    nameEn: 'Porco',
    category: 'pork',
    rarity: 'common',
    satiety: 11,
    flavorText: 'A fragrant bite lets you cross off another TODO.',
    effectLabel: 'Throughput +1'
  },
  {
    id: 'cordeiro',
    nameJa: 'カルネイロ（ラム）',
    nameEn: 'Lamb',
    category: 'lamb',
    rarity: 'uncommon',
    satiety: 13,
    flavorText: 'A habit-forming aroma — your design ideas get habit-forming too.',
    effectLabel: 'Inspiration +2'
  },
  {
    id: 'queijo',
    nameJa: 'ケイジョ（焼きチーズ）',
    nameEn: 'Grilled Cheese',
    category: 'side',
    rarity: 'rare',
    satiety: 6,
    flavorText: 'Happiness up. Error messages a little more forgivable.',
    effectLabel: 'Happiness +3'
  },
  {
    id: 'abacaxi',
    nameJa: 'アバカシ（焼きパイナップル）',
    nameEn: 'Grilled Pineapple',
    category: 'side',
    rarity: 'rare',
    satiety: 5,
    flavorText: 'Sweetness makes that stack trace easier to forgive.',
    effectLabel: 'Debug resistance +2'
  }
];
```

## Draw rules

```text
1. Build a meatDeck at the start of each session.
2. meatDeck is DEFAULT_MEATS shuffled.
3. Every 10 minutes, draw one meat from meatDeck.
4. When meatDeck is empty, refill it by reshuffling DEFAULT_MEATS.
5. The meat that was just served must not be the first card of a refilled deck.
6. A "passed" meat still counts as encountered.
7. Only "eaten" meats add to satiety and to the eaten count.
```
