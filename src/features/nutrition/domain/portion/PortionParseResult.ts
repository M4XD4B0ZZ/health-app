export type PortionParseStatus = 'resolved' | 'ambiguous' | 'unresolved';

export interface PortionParseResult {
  status: PortionParseStatus;
  grams?: number;
  multiplier?: number;
  notes: string[];
  confidence: number;
}
