export interface AiFoodMapper {
  mapToCanonicalFood(rawInput: string): Promise<{
    canonicalId: string;
    confidence: number;
    explanation: string;
  }>;
}
