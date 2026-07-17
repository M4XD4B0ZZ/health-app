export type PortionParseStatus = 'resolved' | 'ambiguous' | 'unresolved';

export interface PortionParseResult {
  status: PortionParseStatus;
  grams?: number;
  multiplier?: number;
  /**
   * J-013: an absolute count intent ("2 Stück", "3 Scheiben"). Unlike `multiplier`, this is a
   * target quantity, never applied relative to an already-edited value. Resolved to grams via
   * identity-based portion knowledge by the caller.
   */
  count?: number;
  countUnit?: 'piece' | 'slice';
  notes: string[];
  confidence: number;
}
