import { FoodEntryRepository } from '../ports/FoodEntryRepository';
import { NutritionLookup } from '../ports/NutritionLookup';
import { Clock } from '../ports/Clock';
import { FoodEntry } from '../../domain/models/NutritionTypes';
import { PortionParser } from '../../domain/portion/PortionParser';
import { computeTotals } from '../../domain/portion/computeTotals';
import { buildEditDecisionMeta } from '../services/explainability/buildEditDecisionMeta';
import { AssumptionTag } from '../../domain/models/AssumptionTag';

export interface EditDecision {
  status: 'applied' | 'ambiguous' | 'rejected';
  reasonCodes: string[];
  confidence: number;
  notes: string[];
}

export interface EditFoodEntryResult {
  updatedEntry: FoodEntry;
  editDecision: EditDecision;
}

export class EditFoodEntryFromNaturalLanguageUseCase {
  private readonly parser: PortionParser;

  constructor(
    private readonly repository: FoodEntryRepository,
    private readonly nutritionLookup: NutritionLookup,
    private readonly clock: Clock,
  ) {
    this.parser = new PortionParser();
  }

  async execute(entryId: string, editText: string): Promise<EditFoodEntryResult> {
    const entry = await this.repository.getEntryById(entryId);
    if (!entry) {
      throw new Error(`Entry with id ${entryId} not found`);
    }

    const normalizedEditText = editText.trim().toLowerCase();
    const hasBaseGrams = (entry.grams ?? entry.quantityGrams) > 0;
    const parseResult = this.parser.parse(editText, { hasBaseGrams });

    let nextEntry: FoodEntry = {
      ...entry,
      servingMultiplier: entry.servingMultiplier ?? 1,
    };
    const reasonCodes = [...parseResult.notes];
    const notes = [...parseResult.notes];
    let decisionStatus: EditDecision['status'] = 'rejected';
    let decisionConfidence = parseResult.confidence;

    if (parseResult.grams !== undefined) {
      nextEntry.grams = parseResult.grams;
      nextEntry.quantityGrams = parseResult.grams;
      nextEntry.servingMultiplier = 1;
      nextEntry.rawInput = this.buildDisplayRawInput(parseResult.grams, nextEntry.parsedName);
      reasonCodes.push('GRAMS_SET');
      decisionStatus = 'applied';
    }

    if (parseResult.multiplier !== undefined) {
      const baseGrams = nextEntry.grams ?? nextEntry.quantityGrams;
      const effectiveGrams = baseGrams * parseResult.multiplier;
      nextEntry.grams = effectiveGrams;
      nextEntry.quantityGrams = effectiveGrams;
      nextEntry.servingMultiplier = 1;
      nextEntry.rawInput = this.buildDisplayRawInput(effectiveGrams, nextEntry.parsedName);
      reasonCodes.push('MULTIPLIER_SET');
      decisionStatus = 'applied';
    }

    const oilEditUnsupported =
      normalizedEditText.includes('ohne oel') ||
      normalizedEditText.includes('ohne öl') ||
      normalizedEditText.includes('without oil');

    if (oilEditUnsupported) {
      nextEntry.editNote = 'exclude: oil';
      reasonCodes.push('INGREDIENT_EDIT_UNSUPPORTED');
      notes.push('exclude: oil');
      decisionStatus = 'ambiguous';
      decisionConfidence = Math.min(decisionConfidence, 0.55);
    }

    const currentGrams = nextEntry.grams ?? nextEntry.quantityGrams;
    const currentMultiplier = nextEntry.servingMultiplier ?? 1;

    if (currentGrams > 0) {
      const per100g =
        nextEntry.calcBreakdown?.per100g ??
        (await this.nutritionLookup.getPer100gByName(nextEntry.parsedName));
      if (per100g) {
        const breakdown = computeTotals(per100g, currentGrams, currentMultiplier);
        nextEntry.calories = breakdown.totals.calories;
        nextEntry.protein = breakdown.totals.protein;
        nextEntry.carbs = breakdown.totals.carbs;
        nextEntry.fat = breakdown.totals.fat;
        nextEntry.calcBreakdown = {
          per100g: breakdown.per100g,
          gramsUsed: breakdown.gramsUsed,
          multiplier: breakdown.multiplier,
        };
        nextEntry.explanation = `Calculated from ${currentGrams}g x ${currentMultiplier.toFixed(2)}.`;
        nextEntry.lastEditDecision = buildEditDecisionMeta({
          editText,
          portionParseResult: parseResult,
          ingredientEditUnsupported: oilEditUnsupported,
          calcBreakdown: breakdown,
        });
      } else if (decisionStatus === 'applied') {
        reasonCodes.push('NUTRITION_UNKNOWN');
        nextEntry.lastEditDecision = buildEditDecisionMeta({
          editText,
          portionParseResult: parseResult,
          ingredientEditUnsupported: oilEditUnsupported,
        });
      }
    } else {
      nextEntry.lastEditDecision = buildEditDecisionMeta({
        editText,
        portionParseResult: parseResult,
        ingredientEditUnsupported: oilEditUnsupported,
      });
    }

    if (decisionStatus === 'rejected' && parseResult.status === 'ambiguous') {
      decisionStatus = 'ambiguous';
    }

    if (decisionStatus === 'rejected' && reasonCodes.length === 0) {
      reasonCodes.push('NO_CHANGES');
    }

    if (reasonCodes.includes('ML_UNSUPPORTED')) {
      decisionStatus = 'ambiguous';
      reasonCodes.push('ML_UNSUPPORTED');
    }

    const assumptions: AssumptionTag[] = [];
    if (parseResult.grams !== undefined) {
      assumptions.push('GRAMS_ASSUMED');
    }
    if (parseResult.multiplier !== undefined) {
      assumptions.push('MULTIPLIER_APPLIED');
    }
    if (reasonCodes.includes('ML_UNSUPPORTED')) {
      assumptions.push('ML_WITHOUT_DENSITY');
    }
    if (oilEditUnsupported) {
      assumptions.push('INGREDIENT_EDIT_UNSUPPORTED');
    }
    if (assumptions.length > 0) {
      nextEntry.assumptions = Array.from(
        new Set([...(nextEntry.assumptions ?? []), ...assumptions]),
      );
    }

    nextEntry.lastModifiedAt = this.clock.now();

    await this.repository.appendCorrectionLogEntry(entry.id, {
      timestamp: nextEntry.lastModifiedAt,
      previousValues: entry,
      triggeredBy: 'user',
    });
    await this.repository.updateEntryById(nextEntry);

    return {
      updatedEntry: nextEntry,
      editDecision: {
        status: decisionStatus,
        reasonCodes: Array.from(new Set(reasonCodes)),
        confidence: decisionConfidence,
        notes: Array.from(new Set(notes)),
      },
    };
  }

  private buildDisplayRawInput(grams: number, parsedName: string): string {
    const roundedGrams = Math.round(grams * 100) / 100;
    const formattedGrams = Number.isInteger(roundedGrams)
      ? roundedGrams.toString()
      : roundedGrams
          .toFixed(2)
          .replace(/\.0+$/, '')
          .replace(/(\.\d*[1-9])0+$/, '$1');

    return `${formattedGrams}g ${parsedName}`;
  }
}
