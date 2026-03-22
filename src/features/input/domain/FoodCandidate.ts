export interface FoodCandidate {
  name: string;
  normalizedName: string;
  confidence: number;
  source: 'alias' | 'deterministic' | 'resolver';
}
