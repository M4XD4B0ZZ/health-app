import {
  isGenericSpeckQuery,
  SPECK_CLARIFICATION_CHOICES,
  SPECK_CLARIFICATION_HEADING,
  SPECK_CLARIFICATION_EXPLANATION,
  SPECK_NOT_SURE_LABEL,
  SPECK_NOT_SURE_SUGGESTION,
  buildSpeckClarificationItem,
  buildSpeckChoiceResubmissionText,
} from '../SpeckAmbiguity';

describe('RESOLVER-V2-010 isGenericSpeckQuery', () => {
  it.each(['Speck', 'speck', ' Speck ', 'SPECK', 'Speck.', 'speck!'])(
    'detects the bare generic term "%s"',
    (input) => {
      expect(isGenericSpeckQuery(input)).toBe(true);
    },
  );

  it.each([
    'Bauchspeck',
    'bauchspeck',
    'Frühstücksspeck',
    'fruehstuecksspeck',
    'Bacon',
    'bacon',
    'Schinkenspeck',
    'schinkenspeck',
    'Rückenspeck',
    'rueckenspeck',
    'geräucherter Speck',
    'roher Speck',
    'magerer Speck',
    'gebratener Speck',
    'durchwachsener Speck',
    'Speckknödel',
    '',
    'Ei',
  ])('never intercepts the qualified/unrelated term "%s"', (input) => {
    expect(isGenericSpeckQuery(input)).toBe(false);
  });
});

describe('RESOLVER-V2-010 SPECK_CLARIFICATION_CHOICES', () => {
  it('has exactly the three approved choices with proven deterministic queries', () => {
    expect(SPECK_CLARIFICATION_CHOICES).toHaveLength(3);
    expect(SPECK_CLARIFICATION_CHOICES.map((c) => c.query)).toEqual([
      'bauchspeck',
      'rueckenspeck',
      'schinkenspeck',
    ]);
  });

  it('uses the approved German labels and descriptions', () => {
    expect(SPECK_CLARIFICATION_CHOICES).toEqual([
      {
        id: 'bacon_bauchspeck',
        label: 'Bacon / Bauchspeck',
        description: 'Durchwachsen, typischerweise zum Braten',
        query: 'bauchspeck',
      },
      {
        id: 'fettspeck_rueckenspeck',
        label: 'Fettspeck / Rückenspeck',
        description: 'Sehr fettreich, häufig zum Auslassen',
        query: 'rueckenspeck',
      },
      {
        id: 'schinkenspeck',
        label: 'Schinkenspeck',
        description: 'Magerer, aufschnittartiger Speck',
        query: 'schinkenspeck',
      },
    ]);
  });

  it('never exposes a BLS code or raw catalog identifier in a label/description', () => {
    for (const choice of SPECK_CLARIFICATION_CHOICES) {
      expect(choice.label).not.toMatch(/^[A-Z]\d{6}$/);
      expect(choice.description).not.toMatch(/^[A-Z]\d{6}$/);
    }
  });
});

describe('RESOLVER-V2-010 approved clarification copy', () => {
  it('uses the exact approved heading, explanation, and "Nicht sicher" strings', () => {
    expect(SPECK_CLARIFICATION_HEADING).toBe('Welche Art von Speck meinst du?');
    expect(SPECK_CLARIFICATION_EXPLANATION).toBe(
      'Speck kann je nach Art sehr unterschiedliche Nährwerte haben. Wähle die Variante, die am besten passt.',
    );
    expect(SPECK_NOT_SURE_LABEL).toBe('Nicht sicher');
    expect(SPECK_NOT_SURE_SUGGESTION).toContain('Bacon');
    expect(SPECK_NOT_SURE_SUGGESTION).toContain('Rückenspeck');
    expect(SPECK_NOT_SURE_SUGGESTION).toContain('Schinkenspeck');
  });
});

describe('RESOLVER-V2-010 buildSpeckClarificationItem', () => {
  it('builds the structured clarification item from the original input and resolved previews', () => {
    const choices = SPECK_CLARIFICATION_CHOICES.map((choice) => ({
      ...choice,
      previewCalories: 304,
    }));

    const item = buildSpeckClarificationItem({
      rawInput: '100 g Speck',
      quantityGrams: 100,
      hasExplicitQuantity: true,
      choices,
    });

    expect(item).toEqual({
      type: 'speck_clarification',
      rawInput: '100 g Speck',
      quantityGrams: 100,
      hasExplicitQuantity: true,
      heading: SPECK_CLARIFICATION_HEADING,
      explanation: SPECK_CLARIFICATION_EXPLANATION,
      choices,
      notSureLabel: SPECK_NOT_SURE_LABEL,
      notSureSuggestion: SPECK_NOT_SURE_SUGGESTION,
    });
  });

  it('preserves a null preview calorie without fabricating a value', () => {
    const choices = SPECK_CLARIFICATION_CHOICES.map((choice) => ({
      ...choice,
      previewCalories: null,
    }));

    const item = buildSpeckClarificationItem({
      rawInput: 'Speck',
      quantityGrams: 0,
      hasExplicitQuantity: false,
      choices,
    });

    expect(item.choices.every((c) => c.previewCalories === null)).toBe(true);
  });
});

describe('RESOLVER-V2-010 buildSpeckChoiceResubmissionText', () => {
  const choice = { query: 'bauchspeck' };

  it('preserves explicit grams from the original text', () => {
    expect(buildSpeckChoiceResubmissionText('100 g Speck', choice)).toBe('100 g bauchspeck');
    expect(buildSpeckChoiceResubmissionText('50g Speck', choice)).toBe('50g bauchspeck');
  });

  it('preserves a count/unit quantity that has no explicit grams', () => {
    expect(buildSpeckChoiceResubmissionText('3 Scheiben Speck', choice)).toBe(
      '3 Scheiben bauchspeck',
    );
    expect(buildSpeckChoiceResubmissionText('zwei Speck', choice)).toBe('zwei bauchspeck');
  });

  it('re-submits the bare qualified term when there was no quantity at all', () => {
    expect(buildSpeckChoiceResubmissionText('Speck', choice)).toBe('bauchspeck');
  });

  it('is case-insensitive and preserves surrounding casing/whitespace', () => {
    expect(buildSpeckChoiceResubmissionText('100 g SPECK', choice)).toBe('100 g bauchspeck');
    expect(buildSpeckChoiceResubmissionText(' Speck ', choice)).toBe(' bauchspeck ');
  });

  it('never matches "Speck" as part of a compound word (word-boundary safe)', () => {
    // Detection (isGenericSpeckQuery) already guarantees this function is only ever called for
    // the bare word, but the replacement itself stays word-boundary safe defensively.
    expect(buildSpeckChoiceResubmissionText('Speckknödel', choice)).toBe('Speckknödel');
  });
});
