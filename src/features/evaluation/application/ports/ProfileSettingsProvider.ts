/**
 * DI-001: builds the `profileSettings` bag for one specific `EvaluationProfile` from real
 * repositories. Each Profile owns its own provider instead of a generic assembler needing
 * to know every profile's settings shape (Evidence-based Standard needs `{ goals }`,
 * Weight Loss needs `{ tdee }`, future profiles will need their own).
 */
export interface ProfileSettingsProvider {
  profileId: string;
  build(dateISO: string): Promise<Record<string, unknown>>;
}
