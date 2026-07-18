import { formatNumber } from './journalEntryDisplay';
import type { SpeckClarificationChoicePreview } from '../../../features/nutrition/domain/catalog/SpeckAmbiguity';

/**
 * RESOLVER-V2-010: pure presentation helpers for the „Welche Art von Speck meinst du?"
 * clarification. Never touches the resolver — consumes only the already-resolved preview
 * calories carried on each `SpeckClarificationChoicePreview` (see `SpeckAmbiguity.ts`), so the
 * screen never reconstructs candidate queries or nutrition facts itself (requirement 59).
 */

/**
 * „ca. 304 kcal für 100 g" (explicit quantity) or „ca. 304 kcal für 100 g" (no explicit quantity
 * — a per-100g reading, since that is exactly what an unresolved preview calorie value already
 * is). Returns `undefined` when the preview failed to resolve (never fabricates a value).
 */
export function formatSpeckChoicePreview(
  previewCalories: number | null,
  hasExplicitQuantity: boolean,
  quantityGrams: number,
): string | undefined {
  if (previewCalories === null) return undefined;

  const effectiveGrams = hasExplicitQuantity && quantityGrams > 0 ? quantityGrams : 100;
  return `ca. ${Math.round(previewCalories)} kcal für ${formatNumber(effectiveGrams)} g`;
}

/**
 * One accessible announcement per choice: label, description, calorie preview, and the
 * available action — mirrors the J-012 canonical-group-header pattern (title + quantity +
 * calories + action in a single label, no BLS codes/raw identifiers).
 */
export function buildSpeckChoiceAccessibilityLabel(
  choice: Pick<SpeckClarificationChoicePreview, 'label' | 'description'>,
  previewText: string | undefined,
): string {
  const previewPart = previewText ? `${previewText}. ` : '';
  return `${choice.label}, ${choice.description}. ${previewPart}Auswählen.`;
}

export const SPECK_NOT_SURE_ACCESSIBILITY_LABEL =
  'Nicht sicher. Speichert nichts und lässt dich die Eingabe genauer formulieren.';
