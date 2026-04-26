import { InputConfidenceClassification } from '../models/ResolverDecision';

export interface MatchMetadata {
  usedHeuristic?: string;
  exact?: boolean;
  fromAlias?: boolean;
  fromCache?: boolean;
}

export interface InputConfidenceClassifier {
  classify(
    rawInput: string,
    normalizedInput: string,
    matchMetadata?: MatchMetadata,
  ): InputConfidenceClassification;
}
