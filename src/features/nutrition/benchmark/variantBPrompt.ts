import { VariantBRequest } from './VariantBTypes';

/**
 * RESOLVER-V3-004: Variant B's versioned benchmark prompt + response schema.
 *
 * This is benchmark infrastructure, not a product decision (ROADMAP.md: "Der Prompt ist
 * Benchmark-Infrastruktur, keine Produktentscheidung"). It must not change during a run
 * (`PROMPT_VERSION` is bumped, never edited in place, whenever the wording changes) and must not
 * leak ground truth, case categories, or tolerances to the model -- nothing here references
 * `BenchmarkCase` fields beyond `rawInput`/`locale`/`regionalContext`, which is exactly what a
 * real food-log input would carry.
 */

export const VARIANT_B_PROMPT_VERSION = 'variant-b-prompt-v1';
// Provider-facing schema compatibility change only: the prompt wording remains v1.
export const VARIANT_B_SCHEMA_VERSION = 'variant-b-schema-v2';
export const VARIANT_B_ESTIMATOR_VERSION = 'variant-b-ai-only-v1';

/** The instructions given to the model, independent of the per-request input. Kept as a single
 * exported constant so a run can log/pin exactly which wording produced its results. */
export const VARIANT_B_SYSTEM_PROMPT = `Du bist ein Ernaehrungs-Schaetzsystem fuer ein Food-Logging-Produkt (DACH-Fokus: Deutschland, Oesterreich, Schweiz).

Aufgabe: Ein Nutzer beschreibt in natuerlicher Sprache, was er/sie gegessen hat. Du interpretierst die Eingabe direkt und lieferst eine eigene Naehrwertschaetzung -- OHNE Zugriff auf eine externe Datenbank. Du bist die einzige Quelle dieser Zahlen; sie sind eine Schaetzung, keine belegte Tatsache.

Regeln:
1. Zerlege die Eingabe in einzelne Lebensmittel-/Mahlzeitenbestandteile, falls mehrere genannt werden.
2. Mache Mengenannahmen explizit (z. B. "1 Portion Nudeln = 200 g roh, angenommen"), wenn keine Menge genannt wurde.
3. Schaetze kcal, Protein, Fett und Kohlenhydrate direkt -- gib nur Werte an, bei denen du eine begruendete Schaetzung abgeben kannst. Wenn du einen Wert nicht sinnvoll schaetzen kannst, lass das Feld weg (null) -- erfinde niemals eine Zahl nur um das Feld zu befuellen.
4. Mache Unsicherheit explizit sichtbar (assumptions/uncertainties), statt sie zu verschweigen.
5. Wenn die Eingabe zu vage ist, um verantwortungsvoll zu schaetzen, aber eine gezielte Rueckfrage das Problem loesen wuerde: verwende outcome="clarification_required".
6. Wenn die Eingabe ein reales Gericht/Lebensmittel beschreibt, du aber keine verlaessliche Schaetzgrundlage hast (z. B. ein komplexes Regionalgericht ohne bekannte Standardrezeptur): verwende outcome="abstained" -- gib KEINE Zahl an, nur einen Grund.
7. Wenn die Eingabe ueberhaupt nicht als Lebensmittel-/Mahlzeitenbeschreibung erkennbar ist: verwende outcome="not_interpretable".
8. Erfinde NIEMALS eine Marke, ein Restaurant, eine Produktvariante oder eine Quelle, die nicht in der Eingabe genannt wurde. Gib keine Quelle an -- du hast keine.
9. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, das exakt dem vorgegebenen Schema entspricht. Kein Freitext, keine Markdown-Formatierung, kein Codeblock drumherum.`;

/** Builds the per-request user-turn text. Deliberately minimal -- no few-shot examples that could
 * leak fixture/ground-truth values (ROADMAP.md: "Verwende keine Ground-Truth-Werte aus den
 * Fixtures im Prompt"). */
export function buildVariantBPrompt(request: VariantBRequest): string {
  const contextLine = request.regionalContext
    ? `Regionaler Kontext: ${request.regionalContext}\n`
    : '';
  return (
    `Nutzereingabe (Locale: ${request.locale}):\n"${request.rawInput}"\n${contextLine}` +
    `Antworte ausschliesslich mit dem JSON-Objekt gemaess Schema.`
  );
}

/** JSON-schema-shaped description of the required response, used both as documentation and to
 * request structured output from providers that support it (mirrors
 * `scripts/lib/ai-reranking-benchmark-providers.mjs`'s `RERANK_SCHEMA` pattern). Validation itself
 * stays hand-written in `validateVariantBResponse.ts` (no new validation dependency, matching
 * RESOLVER-V3-003's `validateBenchmarkCase.ts` precedent). */
export const VARIANT_B_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    outcome: {
      type: 'string',
      enum: ['estimated', 'clarification_required', 'abstained', 'not_interpretable'],
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          componentId: { type: 'string' },
          name: { type: 'string' },
          brand: { type: ['string', 'null'] },
          preparation: { type: ['string', 'null'] },
          quantity: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value: { type: ['number', 'null'] },
              unit: { type: ['string', 'null'], enum: ['g', 'ml', 'piece', 'portion', null] },
              householdMeasure: { type: ['string', 'null'] },
              portionDescription: { type: ['string', 'null'] },
            },
          },
          kcal: { type: ['number', 'null'] },
          protein_g: { type: ['number', 'null'] },
          fat_g: { type: ['number', 'null'] },
          carbs_g: { type: ['number', 'null'] },
          assumptions: { type: 'array', items: { type: 'string' } },
          uncertainties: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
        required: ['componentId', 'name', 'quantity', 'confidence'],
      },
    },
    totals: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        kcal: { type: ['number', 'null'] },
        protein_g: { type: ['number', 'null'] },
        fat_g: { type: ['number', 'null'] },
        carbs_g: { type: ['number', 'null'] },
      },
    },
    overallConfidence: { type: ['number', 'null'] },
    assumptions: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
    clarification: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        componentId: { type: ['string', 'null'] },
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
    reason: { type: ['string', 'null'] },
  },
  required: ['outcome', 'components', 'assumptions', 'uncertainties'],
  additionalProperties: false,
} as const;
