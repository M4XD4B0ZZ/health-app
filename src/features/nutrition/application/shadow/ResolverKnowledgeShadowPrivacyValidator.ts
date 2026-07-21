import {
  RESOLVER_KNOWLEDGE_SHADOW_INPUT_TYPES,
  type ResolverKnowledgeShadowCandidateSnapshot,
} from '../../domain/models/ResolverKnowledgeShadowEvaluation';
import {
  RESOLVER_PRODUCTION_DECISION_INPUT_CONFIDENCE_LEVELS,
  RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION,
  RESOLVER_PRODUCTION_DECISION_PROVENANCE_CLASSIFICATIONS,
  RESOLVER_PRODUCTION_DECISION_SAFE_REASON_CODES,
  RESOLVER_PRODUCTION_DECISION_SOURCE_TYPES,
  type ResolverProductionDecisionProjectionV1,
} from '../../domain/models/ResolverProductionDecisionProjection';
import {
  RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION,
  type ResolverKnowledgeShadowGroundTruth,
} from '../../domain/models/ResolverKnowledgeShadowGroundTruth';

/**
 * Minimal, allowlist-based, recursive schema validator (RESOLVER-V3-029 §3). Every permitted object
 * shape declares a closed set of allowed keys; unknown keys fail closed; nested objects/arrays are
 * validated recursively; discriminated payloads must match their exact variant schema. This is the
 * *primary* privacy guarantee — it does not rely on recognizing private key names.
 */
type ShadowValidationSchema =
  | { kind: 'literal'; value: string }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'opaqueId' }
  | { kind: 'number' }
  | { kind: 'object'; fields: Record<string, ShadowValidationSchema> }
  | { kind: 'array'; items: ShadowValidationSchema }
  | {
      kind: 'discriminatedUnion';
      discriminantKey: string;
      variants: Record<string, ShadowValidationSchema>;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validate(value: unknown, schema: ShadowValidationSchema, path: string): string[] {
  switch (schema.kind) {
    case 'literal':
      return value === schema.value ? [] : [`${path}: expected literal "${schema.value}"`];
    case 'enum':
      return typeof value === 'string' && schema.values.includes(value)
        ? []
        : [`${path}: expected one of [${schema.values.join(', ')}]`];
    case 'opaqueId':
      return typeof value === 'string' && value.length > 0
        ? []
        : [`${path}: expected a non-empty opaque identifier string`];
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? []
        : [`${path}: expected a finite number`];
    case 'object': {
      if (!isPlainObject(value)) return [`${path}: expected an object`];
      const violations: string[] = [];
      const allowedKeys = new Set(Object.keys(schema.fields));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) violations.push(`${path}.${key}: unknown key is not allowed`);
      }
      for (const key of allowedKeys) {
        violations.push(...validate(value[key], schema.fields[key], `${path}.${key}`));
      }
      return violations;
    }
    case 'array': {
      if (!Array.isArray(value)) return [`${path}: expected an array`];
      return value.flatMap((item, index) => validate(item, schema.items, `${path}[${index}]`));
    }
    case 'discriminatedUnion': {
      if (!isPlainObject(value)) return [`${path}: expected an object`];
      const discriminant = value[schema.discriminantKey];
      if (typeof discriminant !== 'string' || !(discriminant in schema.variants)) {
        return [`${path}.${schema.discriminantKey}: unknown or unsupported discriminant value`];
      }
      return validate(value, schema.variants[discriminant], path);
    }
  }
}

const localeSchema: ShadowValidationSchema = { kind: 'enum', values: ['de', 'en'] };
const inputTypeSchema: ShadowValidationSchema = {
  kind: 'enum',
  values: RESOLVER_KNOWLEDGE_SHADOW_INPUT_TYPES,
};
const candidateSourceTypeSchema: ShadowValidationSchema = {
  kind: 'enum',
  values: ['bls', 'off', 'usda'],
};

const candidatePayloadSchema: ShadowValidationSchema = {
  kind: 'discriminatedUnion',
  discriminantKey: 'type',
  variants: {
    'source-routing-pattern': {
      kind: 'object',
      fields: {
        type: { kind: 'literal', value: 'source-routing-pattern' },
        locale: localeSchema,
        inputType: inputTypeSchema,
        sourceType: candidateSourceTypeSchema,
      },
    },
    'abstention-policy-signal': {
      kind: 'object',
      fields: {
        type: { kind: 'literal', value: 'abstention-policy-signal' },
        locale: localeSchema,
        inputType: inputTypeSchema,
        reasonCode: { kind: 'enum', values: ['NO_CANDIDATES', 'LOW_SCORE'] },
      },
    },
    'clarification-policy-signal': {
      kind: 'object',
      fields: {
        type: { kind: 'literal', value: 'clarification-policy-signal' },
        locale: localeSchema,
        inputType: inputTypeSchema,
        reasonCode: { kind: 'enum', values: ['MULTIPLE_CLOSE_MATCHES'] },
      },
    },
    'provenance-gap': {
      kind: 'object',
      fields: {
        type: { kind: 'literal', value: 'provenance-gap' },
        locale: localeSchema,
        inputType: inputTypeSchema,
      },
    },
    'negative-source-routing-rule': {
      kind: 'object',
      fields: {
        type: { kind: 'literal', value: 'negative-source-routing-rule' },
        locale: localeSchema,
        inputType: inputTypeSchema,
        sourceType: candidateSourceTypeSchema,
        reasonCode: { kind: 'enum', values: ['NO_CANDIDATES', 'LOW_SCORE'] },
      },
    },
  },
};

/**
 * `candidateType`/`candidateVersion` are deliberately left as opaque-id checks here (not enum/literal
 * gated) even though they are logically closed sets: the dedicated evaluator checks
 * (`supported.has(...)`, contract-version equality) already fail those closed with the more specific
 * `not_evaluable`/`invalid_candidate` delta categories, which are more informative than folding every
 * mismatch into a generic `privacy_blocked`. The privacy-relevant part — the nested `payload` shape —
 * is still strictly discriminated-union validated below.
 */
const candidateSnapshotSchema: ShadowValidationSchema = {
  kind: 'object',
  fields: {
    candidateId: { kind: 'opaqueId' },
    fingerprint: { kind: 'opaqueId' },
    candidateType: { kind: 'opaqueId' },
    candidateVersion: { kind: 'opaqueId' },
    payload: candidatePayloadSchema,
  },
};

const productionDecisionProjectionSchema: ShadowValidationSchema = {
  kind: 'object',
  fields: {
    projectionVersion: { kind: 'literal', value: RESOLVER_PRODUCTION_DECISION_PROJECTION_VERSION },
    status: { kind: 'enum', values: ['accepted', 'ambiguous', 'rejected'] },
    reasonCodes: {
      kind: 'array',
      items: { kind: 'enum', values: RESOLVER_PRODUCTION_DECISION_SAFE_REASON_CODES },
    },
    candidateCount: { kind: 'number' },
    selectedSourceType: { kind: 'enum', values: RESOLVER_PRODUCTION_DECISION_SOURCE_TYPES },
    provenanceClassification: {
      kind: 'enum',
      values: RESOLVER_PRODUCTION_DECISION_PROVENANCE_CLASSIFICATIONS,
    },
    inputConfidenceLevel: {
      kind: 'enum',
      values: RESOLVER_PRODUCTION_DECISION_INPUT_CONFIDENCE_LEVELS,
    },
  },
};

const groundTruthFixtureOrMeasuredFields = (evidenceClass: 'fixture-derived' | 'measured') => ({
  evidenceVersion: { kind: 'literal', value: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION },
  evidenceClass: { kind: 'literal', value: evidenceClass },
  expectedStatus: { kind: 'enum', values: ['accepted', 'ambiguous', 'rejected'] },
  corpusRegistryVersion: { kind: 'opaqueId' },
  corpusCaseId: { kind: 'opaqueId' },
});

const groundTruthSchema: ShadowValidationSchema = {
  kind: 'discriminatedUnion',
  discriminantKey: 'evidenceClass',
  variants: {
    'fixture-derived': {
      kind: 'object',
      fields: groundTruthFixtureOrMeasuredFields('fixture-derived') as Record<
        string,
        ShadowValidationSchema
      >,
    },
    measured: {
      kind: 'object',
      fields: groundTruthFixtureOrMeasuredFields('measured') as Record<
        string,
        ShadowValidationSchema
      >,
    },
    unknown: {
      kind: 'object',
      fields: {
        evidenceVersion: { kind: 'literal', value: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION },
        evidenceClass: { kind: 'literal', value: 'unknown' },
      },
    },
    not_evaluable: {
      kind: 'object',
      fields: {
        evidenceVersion: { kind: 'literal', value: RESOLVER_KNOWLEDGE_SHADOW_GROUND_TRUTH_VERSION },
        evidenceClass: { kind: 'literal', value: 'not_evaluable' },
        reasonCode: { kind: 'literal', value: 'GROUND_TRUTH_NOT_SUPPORTED_BY_CONTRACT' },
      },
    },
  },
};

/** Defense-in-depth only (RESOLVER-V3-029 §3) — never the primary guarantee. */
const denylistedKeyNames = [
  'ownerId',
  'owner_id',
  'observationId',
  'observation_id',
  'runId',
  'run_id',
  'rowId',
  'row_id',
  'rawInput',
  'raw_input',
  'normalizedInput',
  'normalized_input',
  'normalizedQuery',
  'normalized_query',
  'sourceId',
  'source_id',
  'personalSourceId',
  'personal_source_id',
  'journal',
  'correction',
  'prompt',
  'secret',
  'notes',
  'assumptions',
];

export function containsDenylistedField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsDenylistedField(item));
  if (isPlainObject(value)) {
    return Object.entries(value).some(
      ([key, nested]) => denylistedKeyNames.includes(key) || containsDenylistedField(nested),
    );
  }
  return false;
}

export function validateResolverKnowledgeShadowCandidateSnapshot(
  snapshot: ResolverKnowledgeShadowCandidateSnapshot,
): readonly string[] {
  return validate(snapshot, candidateSnapshotSchema, '$.candidate');
}

export function validateResolverProductionDecisionProjection(
  projection: ResolverProductionDecisionProjectionV1,
): readonly string[] {
  return validate(projection, productionDecisionProjectionSchema, '$.productionDecisionProjection');
}

export function validateResolverKnowledgeShadowGroundTruth(
  groundTruth: ResolverKnowledgeShadowGroundTruth,
): readonly string[] {
  return validate(groundTruth, groundTruthSchema, '$.groundTruth');
}
