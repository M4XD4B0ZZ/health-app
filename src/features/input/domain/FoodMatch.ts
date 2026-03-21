export type FoodMatchStatus = 'matched' | 'unmatched';

export interface FoodMatch {
  rawName: string;
  canonicalName: string | null;
  status: FoodMatchStatus;
}
