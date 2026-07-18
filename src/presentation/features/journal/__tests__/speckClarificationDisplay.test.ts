import {
  formatSpeckChoicePreview,
  buildSpeckChoiceAccessibilityLabel,
  SPECK_NOT_SURE_ACCESSIBILITY_LABEL,
} from '../speckClarificationDisplay';

describe('RESOLVER-V2-010 formatSpeckChoicePreview', () => {
  it('formats calories for an explicit quantity', () => {
    expect(formatSpeckChoicePreview(304, true, 100)).toBe('ca. 304 kcal für 100 g');
    expect(formatSpeckChoicePreview(152, true, 50)).toBe('ca. 152 kcal für 50 g');
  });

  it('formats a per-100g reading when no explicit quantity was present', () => {
    expect(formatSpeckChoicePreview(304, false, 0)).toBe('ca. 304 kcal für 100 g');
  });

  it('rounds fractional calories', () => {
    expect(formatSpeckChoicePreview(303.6, true, 100)).toBe('ca. 304 kcal für 100 g');
  });

  it('returns undefined instead of fabricating a value when the preview failed to resolve', () => {
    expect(formatSpeckChoicePreview(null, true, 100)).toBeUndefined();
  });
});

describe('RESOLVER-V2-010 buildSpeckChoiceAccessibilityLabel', () => {
  it('includes label, description, preview, and the selection action', () => {
    const label = buildSpeckChoiceAccessibilityLabel(
      { label: 'Bacon / Bauchspeck', description: 'Durchwachsen, typischerweise zum Braten' },
      'ca. 304 kcal für 100 g',
    );

    expect(label).toBe(
      'Bacon / Bauchspeck, Durchwachsen, typischerweise zum Braten. ca. 304 kcal für 100 g. Auswählen.',
    );
  });

  it('omits the preview clause gracefully when no preview text is available', () => {
    const label = buildSpeckChoiceAccessibilityLabel(
      { label: 'Schinkenspeck', description: 'Magerer, aufschnittartiger Speck' },
      undefined,
    );

    expect(label).toBe('Schinkenspeck, Magerer, aufschnittartiger Speck. Auswählen.');
  });
});

describe('RESOLVER-V2-010 SPECK_NOT_SURE_ACCESSIBILITY_LABEL', () => {
  it('communicates that nothing is saved and a more specific term is needed', () => {
    expect(SPECK_NOT_SURE_ACCESSIBILITY_LABEL).toContain('Speichert nichts');
  });
});
