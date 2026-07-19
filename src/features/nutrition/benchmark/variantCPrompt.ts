import { AiInterpretationRequest } from '../domain/models/AiInterpretationTypes';

/**
 * RESOLVER-V3-005: prompt/schema/version constants for the (optional) live Variant C
 * interpretation provider. Deliberately a SEPARATE prompt and schema from Variant B's
 * (`variantBPrompt.ts`) -- Variant B's prompt asks for direct nutrient estimates, which this
 * contract must never produce (Decision Record §4/§5.2). This prompt asks ONLY for interpretation
 * + source-native search planning, matching `AiInterpretationResult`
 * (RESOLVER-V3-002) field-for-field. No ground-truth values, case categories, or tolerances are
 * embedded (leakage rule, spec §9).
 */

export const VARIANT_C_PROMPT_VERSION = 'variant-c-prompt-v1';
export const VARIANT_C_SCHEMA_VERSION = 'variant-c-schema-v1';
/** Provider-neutral interpreter identifier for `AiInterpretationMetadata.interpreterVersion` --
 * never a model/provider name (AGENTS.md "Prohibited"). */
export const VARIANT_C_INTERPRETER_VERSION = 'variant-c-live-interpreter-v1';

export const VARIANT_C_SYSTEM_PROMPT = `Du bist ein Interpretations- und Suchplanungssystem fuer ein Food-Logging-Produkt (DACH-Fokus: Deutschland, Oesterreich, Schweiz).

Deine Aufgabe ist ausschliesslich:
- Bestandteile einer Eingabe zu erkennen (ein oder mehrere Lebensmittel),
- Mengen, Einheiten, Marken und Zubereitungsform zu erkennen, soweit vorhanden,
- Annahmen und Unsicherheiten explizit zu benennen,
- fuer jeden Bestandteil eine Suchstrategie vorzuschlagen: geeignete Quelltypen ('bls' fuer generische DACH-Lebensmittel, 'off' fuer Markenprodukte, 'usda' fuer Lebensmittel ohne DACH-Entsprechung) und eine quellen-native Suchanfrage je Quelltyp,
- bei Bedarf eine gezielte Rueckfrage zu stellen.

Du darfst NIEMALS:
- Kalorien, Makronaehrstoffe oder sonstige Naehrwerte angeben oder schaetzen,
- eine Quellen-ID (BLS/OFF/USDA) erfinden,
- Hersteller- oder Datenbankdaten vortaeuschen.

Antworte ausschliesslich im vorgegebenen JSON-Schema.`;

export function buildVariantCPrompt(request: AiInterpretationRequest): string {
  const contextLines = (request.knownUserContext ?? [])
    .map((hint) => `- ${hint.type}: ${hint.value}`)
    .join('\n');
  return [
    `Eingabe (locale=${request.locale}): "${request.rawInput}"`,
    contextLines ? `Bekannter Kontext:\n${contextLines}` : null,
    'Gib die Interpretation und den Suchplan gemaess Schema zurueck.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');
}

/** JSON-schema-shaped response description for the live provider's structured-output request --
 * mirrors `AiInterpretationResult`'s discriminated union field-for-field. Does not itself
 * validate anything (that is `validateVariantCInterpretationResponse.ts`'s job); this is only the
 * schema handed to the provider so it constrains its own output shape. */
export const VARIANT_C_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome'],
  properties: {
    outcome: {
      type: 'string',
      enum: [
        'interpreted',
        'interpreted_with_assumptions',
        'clarification_required',
        'not_interpretable',
      ],
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'originalSegment', 'interpretedName', 'quantity', 'confidence'],
        properties: {
          id: { type: 'string' },
          originalSegment: { type: 'string' },
          interpretedName: { type: 'string' },
          brand: { type: 'string' },
          preparation: { type: 'string' },
          quantity: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value: { type: 'number' },
              unit: { type: 'string', enum: ['g', 'ml', 'piece', 'portion'] },
              householdMeasure: { type: 'string' },
              portionDescription: { type: 'string' },
            },
          },
          modifiers: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          assumptions: { type: 'array', items: { type: 'string' } },
          uncertainties: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    searchPlan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['componentId', 'suitableSourceTypes', 'nativeQueries', 'expectedResolutionKind'],
        properties: {
          componentId: { type: 'string' },
          suitableSourceTypes: {
            type: 'array',
            items: { type: 'string', enum: ['bls', 'off', 'usda'] },
          },
          nativeQueries: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sourceType', 'query'],
              properties: {
                sourceType: { type: 'string', enum: ['bls', 'off', 'usda'] },
                query: { type: 'string' },
              },
            },
          },
          excludedSourceTypes: { type: 'array', items: { type: 'string' } },
          expectedResolutionKind: {
            type: 'string',
            enum: [
              'generic_food',
              'branded_product',
              'restaurant_product',
              'recipe_or_dish',
              'reusable_personal_meal',
              'unknown',
            ],
          },
        },
      },
    },
    clarification: {
      type: 'object',
      additionalProperties: false,
      properties: {
        componentId: { type: 'string' },
        missingInformation: { type: 'string' },
        clarificationKind: {
          type: 'string',
          enum: [
            'missing_quantity',
            'ambiguous_food_identity',
            'ambiguous_preparation',
            'missing_brand',
            'other',
          ],
        },
      },
    },
    reason: { type: 'string' },
  },
} as const;
