export type PortionHintSource = 'seed' | 'bls' | 'off' | 'usda' | 'user_confirmed' | 'research';

export type PortionHintVisibility = 'user_private' | 'global_candidate' | 'global_verified';

export type PortionHintReviewStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type PortionHintUnit = 'piece' | 'slice';

export interface PortionHint {
  foodIdentityKey: string;
  unit: PortionHintUnit;
  gramsPerUnit: number;
  source: PortionHintSource;
  visibility: PortionHintVisibility;
  reviewStatus: PortionHintReviewStatus;
  confidence: number;
  evidenceCount: number;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortionHintLookup {
  foodIdentityKey: string;
  unit: PortionHintUnit;
  userId?: string;
}
