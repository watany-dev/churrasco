type MeatCategory = 'beef' | 'pork' | 'chicken' | 'lamb' | 'side' | 'rare';

type MeatRarity = 'common' | 'uncommon' | 'rare';

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
