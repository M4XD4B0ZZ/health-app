import { MetabolismProfile } from '../../domain/models/MetabolismTypes';
import { EffectiveGoals } from '../../domain/models/GoalsTypes';

/**
 * Port for persistence of MetabolismProfile
 */
export interface MetabolismProfileRepository {
  get(): Promise<MetabolismProfile | null>;
  upsert(profile: MetabolismProfile): Promise<void>;
}

/**
 * Port for persistence of EffectiveGoals
 */
export interface EffectiveGoalsRepository {
  get(): Promise<EffectiveGoals | null>;
  upsert(goals: EffectiveGoals): Promise<void>;
}

/**
 * Port for accessing current time
 */
export interface Clock {
  nowISO(): string;
}

/**
 * Port for generating unique identifiers
 */
export interface IdGenerator {
  newId(): string;
}
