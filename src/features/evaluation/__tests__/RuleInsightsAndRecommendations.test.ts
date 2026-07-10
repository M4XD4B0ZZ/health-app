import { CalorieMacroCorridorRule } from '../application/rules/CalorieMacroCorridorRule';
import {
  ProteinPreservingDeficitRule,
  WEIGHT_LOSS_DEFICIT_MULTIPLIER,
} from '../application/rules/ProteinPreservingDeficitRule';
import { EvaluationInput } from '../domain/models';
import { FoodEntry } from '../../nutrition/domain/models/NutritionTypes';

/**
 * DI-003: both rules previously always returned empty `insights`/`recommendations`
 * arrays — only `warnings` had real content. This proves each rule now produces genuine,
 * distinct content (protein-remaining framing vs. deficit-pace framing), so "Dashboard &
 * Insights" has actual insight content to show.
 */
describe('Rule-Level Insights & Recommendations (DI-003)', () => {
  const entry = (calories: number, protein: number, carbs: number, fat: number): FoodEntry => ({
    id: 'e1',
    rawInput: 'fixture',
    parsedName: 'fixture',
    quantityGrams: 100,
    calories,
    protein,
    carbs,
    fat,
    confidenceScore: 0.9,
    sourceType: 'generic',
    createdAt: new Date('2026-08-01T08:00:00Z'),
  });

  describe('CalorieMacroCorridorRule', () => {
    it('adds a protein-remaining insight when protein is under target', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(1000, 40, 100, 20)],
        profileSettings: { goals: { calories: 2200, protein: 140, carbs: 220, fat: 70 } },
      };

      const output = CalorieMacroCorridorRule.evaluate(input);

      expect(output.insights).toEqual(['Noch 100 g Protein übrig, um das Tagesziel zu erreichen.']);
    });

    it('recommends a calorie-richer meal when calories are under but protein is met', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(1000, 150, 100, 20)],
        profileSettings: { goals: { calories: 2200, protein: 140, carbs: 220, fat: 70 } },
      };

      const output = CalorieMacroCorridorRule.evaluate(input);

      expect(output.insights).toEqual([]);
      expect(output.recommendations).toEqual([
        'Kalorienziel ist noch nicht erreicht, Proteinziel aber schon — eine ausgewogene, kalorienreichere Mahlzeit ist möglich.',
      ]);
    });

    it('adds neither insight nor recommendation once both calories and protein are on-track/over', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(2200, 150, 220, 70)],
        profileSettings: { goals: { calories: 2200, protein: 140, carbs: 220, fat: 70 } },
      };

      const output = CalorieMacroCorridorRule.evaluate(input);

      expect(output.insights).toEqual([]);
      expect(output.recommendations).toEqual([]);
    });
  });

  describe('ProteinPreservingDeficitRule', () => {
    const tdee = 2000;
    const deficitCalories = tdee * WEIGHT_LOSS_DEFICIT_MULTIPLIER;

    it('adds a deficit-pace insight when not over the deficit target', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(1000, 150, 100, 20)],
        profileSettings: { tdee },
      };

      const output = ProteinPreservingDeficitRule.evaluate(input);

      expect(output.insights).toEqual([
        `Kaloriendefizit von ca. ${Math.round(tdee - deficitCalories)} kcal gegenüber dem geschätzten Erhaltungsbedarf (TDEE) — ein moderates, nachhaltiges Tempo für die Gewichtsabnahme.`,
      ]);
    });

    it('does not add the deficit-pace insight when over the deficit target', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(3000, 150, 300, 100)],
        profileSettings: { tdee },
      };

      const output = ProteinPreservingDeficitRule.evaluate(input);

      expect(output.insights).toEqual([]);
    });

    it('recommends prioritizing protein when the protein target is not met', () => {
      const input: EvaluationInput = {
        foodCatalogReads: [],
        journalReadsForPeriod: [entry(1000, 10, 100, 20)],
        profileSettings: { tdee },
      };

      const output = ProteinPreservingDeficitRule.evaluate(input);

      expect(output.recommendations).toEqual([
        'Proteinziel noch nicht erreicht — proteinreiche Lebensmittel priorisieren, um Muskelmasse während des Kaloriendefizits zu erhalten.',
      ]);
    });

    it('produces different insight text than CalorieMacroCorridorRule for the same underlying facts', () => {
      const sharedEntries: FoodEntry[] = [entry(1000, 40, 100, 20)];
      const standardOutput = CalorieMacroCorridorRule.evaluate({
        foodCatalogReads: [],
        journalReadsForPeriod: sharedEntries,
        profileSettings: { goals: { calories: 2200, protein: 140, carbs: 220, fat: 70 } },
      });
      const weightLossOutput = ProteinPreservingDeficitRule.evaluate({
        foodCatalogReads: [],
        journalReadsForPeriod: sharedEntries,
        profileSettings: { tdee },
      });

      expect(standardOutput.insights).not.toEqual(weightLossOutput.insights);
    });
  });
});
