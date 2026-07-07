export interface BlsCompactRuntimeArtifact {
  schemaVersion: 'bls-runtime-compact.object.v1';
  artifact: {
    kind: 'runtime-compact';
    recordCount: number;
    contentSha256: string;
  };
  source: {
    kind: 'BLS';
    version: '4.0';
    locale: 'de-DE';
    dataWorkbookPath: string;
    sourceWorkbookSha256: string | null;
    validRecordCount: number;
  };
  records: BlsCompactRuntimeRecord[];
}

export interface BlsCompactRuntimeRecord {
  id: string;
  sourceId: string;
  displayName: string;
  macrosPer100g: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  nutrientsPer100g: BlsCompactTier2Nutrients;
}

export interface BlsCompactTier2Nutrients {
  energyKj: number;
  waterG: number;
  fiberG: number;
  sugarG: number;
  starchG: number;
  alcoholG: number;
  saltG: number;
  sodiumMg: number;
  saturatedFatG: number;
  monounsaturatedFatG: number;
  polyunsaturatedFatG: number;
  omega3G: number;
  omega6G: number;
  cholesterolMg: number;
}
