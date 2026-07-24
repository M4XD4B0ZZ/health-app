import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../RepresentativeHybridV1SourceSnapshotManifest';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
} from './RepresentativeHybridV1LiveVersions';

/**
 * RESOLVER-V3-039 protocol-v3 remediation: the protocol-version/hash/provider/pricing gate,
 * extracted out of `runRepresentativeHybridV1Live.harness.ts` (protocol v1/v2) into its own,
 * directly unit-testable module. Previously this logic only ran inside the Jest "harness" entry
 * point invoked via the CLI subprocess, so it could not be exercised by a normal `it()` test without
 * spawning a live-shaped process -- exactly why no test ever asserted "protocol v1/v2 is rejected,
 * v3 is accepted" or "a real execution-tree mismatch is refused" directly. This module has no
 * side effects and performs no I/O; it only compares already-computed values and throws.
 */
export class RepresentativeHybridV1LiveProtocolVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepresentativeHybridV1LiveProtocolVerificationError';
  }
}

export interface RepresentativeHybridV1LiveProtocolV3Document {
  protocolVersion: string;
  planHash: string;
  corpusHash: string;
  sourceManifestHash: string;
  executionTreeHash: string;
  provider: { providerId: string; modelId: string; modelSnapshotId: string };
  pricing: { currency: string; inputPerMillion: number; outputPerMillion: number };
}

/**
 * Refuses to proceed (throws before any provider/budget-gate construction) unless every frozen
 * field in `protocol` matches the current, live-computed state exactly. Rejects protocol v1 and v2
 * documents by construction: their `protocolVersion` literal is never equal to
 * `REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3`.
 */
export function verifyRepresentativeHybridV1LiveProtocolV3(
  protocol: RepresentativeHybridV1LiveProtocolV3Document,
  currentPlanHash: string,
  currentExecutionTreeHash: string,
): void {
  if (protocol.protocolVersion !== REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      `RESOLVER-V3-039 refuses to execute: protocol version "${protocol.protocolVersion}" is not "${REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3}". Protocols v1 and v2 are preserved as invalidated pre-execution history and must never be used for live execution -- see reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md.`,
    );
  }
  if (protocol.planHash !== currentPlanHash) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      `RESOLVER-V3-039 plan hash mismatch: frozen protocol has "${protocol.planHash}", current computation has "${currentPlanHash}". Refusing to execute.`,
    );
  }
  if (protocol.corpusHash !== REPRESENTATIVE_HYBRID_V1_CORPUS_HASH) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      'RESOLVER-V3-039 corpus hash mismatch against frozen protocol. Refusing to execute.',
    );
  }
  if (protocol.sourceManifestHash !== REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      'RESOLVER-V3-039 source-manifest hash mismatch against frozen protocol. Refusing to execute.',
    );
  }
  if (protocol.executionTreeHash !== currentExecutionTreeHash) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      `RESOLVER-V3-039 execution-tree hash mismatch: frozen protocol has "${protocol.executionTreeHash}", current computation has "${currentExecutionTreeHash}". This means execution-relevant code (prompts/schemas/provider/pricing/route-classification/execution-plan/metrics/harness logic) has changed since the protocol was frozen. Refusing to execute (drift protection).`,
    );
  }
  if (
    protocol.provider.providerId !== REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId ||
    protocol.provider.modelId !== REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId ||
    protocol.provider.modelSnapshotId !==
      REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId
  ) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      'RESOLVER-V3-039 provider/model mismatch against frozen protocol. Refusing to execute.',
    );
  }
  if (
    protocol.pricing.currency !== REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.currency ||
    protocol.pricing.inputPerMillion !==
      REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.inputPerMillion ||
    protocol.pricing.outputPerMillion !==
      REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.outputPerMillion
  ) {
    throw new RepresentativeHybridV1LiveProtocolVerificationError(
      'RESOLVER-V3-039 pricing mismatch against frozen protocol. Refusing to execute.',
    );
  }
}
