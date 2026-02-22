export interface DecisionMeta {
  status: 'applied' | 'ambiguous' | 'rejected';
  confidence: number;
  reasonCodes: string[];
  explanation: string;
  details?: string[];
  createdAt: string;
}
