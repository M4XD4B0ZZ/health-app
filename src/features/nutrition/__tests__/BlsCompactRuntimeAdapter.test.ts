import {
  adaptBlsCompactRuntimeRecord,
  adaptBlsCompactRuntimeRecords,
  buildBlsRuntimeAliases,
  normalizeBlsRuntimeText,
  tokenizeBlsRuntimeText,
} from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter';
import {
  BlsCompactRuntimeArtifact,
  BlsCompactRuntimeRecord,
} from '../infrastructure/catalog/sources/bls/BlsCompactRuntimeTypes';

const tier2 = {
  energyKj: 282,
  waterG: 81.6,
  fiberG: 0,
  sugarG: 3.68,
  starchG: 0,
  alcoholG: 0,
  saltG: 0.084,
  sodiumMg: 33.6,
  saturatedFatG: 0.114,
  monounsaturatedFatG: 0.043,
  polyunsaturatedFatG: 0.013,
  omega3G: 0.001,
  omega6G: 0.013,
  cholesterolMg: 4.1,
};

const magerquarkRecord: BlsCompactRuntimeRecord = {
  id: 'bls:M713100',
  sourceId: 'M713100',
  displayName: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
  macrosPer100g: { kcal: 66, protein: 11.85, fat: 0.18, carbs: 3.68 },
  nutrientsPer100g: tier2,
};

describe('BlsCompactRuntimeAdapter', () => {
  it('maps compact identity, display, and macro fields to BlsFoodRecord', () => {
    const adapted = adaptBlsCompactRuntimeRecord(magerquarkRecord);

    expect(adapted.id).toBe('bls:M713100');
    expect(adapted.sourceId).toBe('M713100');
    expect(adapted.displayName).toBe('Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.');
    expect(adapted.macrosPer100g).toEqual({ kcal: 66, protein: 11.85, fat: 0.18, carbs: 3.68 });
  });

  it('keeps Tier2 nutrients at the compact boundary and out of BlsFoodRecord output', () => {
    const adapted = adaptBlsCompactRuntimeRecord(magerquarkRecord);

    expect('nutrientsPer100g' in adapted).toBe(false);
  });

  it('generates normalized names from displayName', () => {
    const adapted = adaptBlsCompactRuntimeRecord({
      ...magerquarkRecord,
      displayName: 'Körniger Frischkäse < 10 % Fett i. Tr.',
    });

    expect(adapted.normalizedName).toBe('koerniger frischkaese 10 fett i tr');
  });

  it('generates deterministic slash, punctuation, and umlaut-normalized aliases', () => {
    const record: BlsCompactRuntimeRecord = {
      ...magerquarkRecord,
      sourceId: 'G620100',
      id: 'bls:G620100',
      displayName: 'Karotte/Möhre, roh',
    };

    expect(buildBlsRuntimeAliases(record)).toEqual([
      'karotte',
      'möhre',
      'moehre',
      'roh',
      'karotte moehre roh',
    ]);
  });

  it('applies compatibility aliases only for proven mini-source canonical cases', () => {
    const magerquark = adaptBlsCompactRuntimeRecord(magerquarkRecord);
    const toast = adaptBlsCompactRuntimeRecord({
      ...magerquarkRecord,
      id: 'bls:B314000',
      sourceId: 'B314000',
      displayName: 'Weizentoastbrot/Buttertoastbrot',
      macrosPer100g: { kcal: 261, protein: 8.29, fat: 3.59, carbs: 46.8 },
    });
    const unrelated = adaptBlsCompactRuntimeRecord({
      ...magerquarkRecord,
      id: 'bls:M710100',
      sourceId: 'M710100',
      displayName: 'Skyr, Frischkäse < 10 % Fett i. Tr.',
    });

    expect(magerquark.aliases).toEqual(
      expect.arrayContaining(['magerquark', 'quark', 'speisequark', 'magerstufe']),
    );
    expect(toast.aliases).toEqual(
      expect.arrayContaining(['toast', 'toastbrot', 'weizentoastbrot', 'buttertoast']),
    );
    expect(unrelated.aliases).not.toContain('quark');
    expect(unrelated.aliases).not.toContain('toast');
  });

  it('builds deterministic unique tokens', () => {
    expect(tokenizeBlsRuntimeText('Weizentoastbrot/Buttertoastbrot')).toEqual([
      'weizentoastbrot',
      'buttertoastbrot',
    ]);

    const adapted = adaptBlsCompactRuntimeRecord(magerquarkRecord);

    expect(adapted.tokens).toEqual(
      expect.arrayContaining(['speisequark', 'magerstufe', 'magerquark', 'quark']),
    );
    expect(adapted.tokens).toEqual([...new Set(adapted.tokens)]);
  });

  it('adapts artifact records without mutating the input artifact or records', () => {
    const artifact: BlsCompactRuntimeArtifact = {
      schemaVersion: 'bls-runtime-compact.object.v1',
      artifact: { kind: 'runtime-compact', recordCount: 1, contentSha256: 'test' },
      source: {
        kind: 'BLS',
        version: '4.0',
        locale: 'de-DE',
        dataWorkbookPath: 'BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx',
        sourceWorkbookSha256: null,
        validRecordCount: 1,
      },
      records: [magerquarkRecord],
    };
    const before = JSON.stringify(artifact);

    const adapted = adaptBlsCompactRuntimeRecords(artifact);

    expect(adapted).toHaveLength(1);
    expect(JSON.stringify(artifact)).toBe(before);
  });

  it('normalizes standalone runtime text deterministically', () => {
    expect(normalizeBlsRuntimeText('  Süßmolke/Käse (Test), < 10 % Fett  ')).toBe(
      'suessmolke kaese 10 fett',
    );
  });
});
