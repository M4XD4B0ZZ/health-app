import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  verifyRepresentativeHybridV1LiveProtocolV3,
  RepresentativeHybridV1LiveProtocolVerificationError,
  type RepresentativeHybridV1LiveProtocolV3Document,
} from '../RepresentativeHybridV1LiveProtocolVerification';
import { computeCurrentRepresentativeHybridV1LiveExecutionTreeHash } from '../RepresentativeHybridV1LiveExecutionTreeHash';
import { REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3 } from '../RepresentativeHybridV1LiveVersions';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../../RepresentativeHybridV1SourceSnapshotManifest';

const repoRoot = path.resolve(__dirname, '../../../../../../..');

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf-8')) as Record<
    string,
    unknown
  >;
}

const v1Json = readJson('reports/resolver-v3-039-controlled-live-protocol.json');
const v2Json = readJson('reports/resolver-v3-039-controlled-live-protocol-v2.json');
const v3Json = readJson('reports/resolver-v3-039-controlled-live-protocol-v3.json');

function validDocument(): RepresentativeHybridV1LiveProtocolV3Document {
  return {
    protocolVersion: v3Json.protocolVersion as string,
    planHash: v3Json.planHash as string,
    corpusHash: v3Json.corpusHash as string,
    sourceManifestHash: v3Json.sourceManifestHash as string,
    executionTreeHash: v3Json.executionTreeHash as string,
    provider: v3Json.provider as RepresentativeHybridV1LiveProtocolV3Document['provider'],
    pricing: v3Json.pricing as RepresentativeHybridV1LiveProtocolV3Document['pricing'],
  };
}

describe('RESOLVER-V3-039 protocol-v3 document and verification gate', () => {
  it('protocol v3 JSON declares the v3 protocol version and supersedes v2', () => {
    expect(v3Json.protocolVersion).toBe('resolver-representative-hybrid-live-protocol-v3');
    expect(v3Json.supersedes).toBe('resolver-representative-hybrid-live-protocol-v2');
    expect(REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3).toBe(
      'resolver-representative-hybrid-live-protocol-v3',
    );
  });

  it('corpus, source-manifest, and plan hashes are byte-identical between protocol v2 and protocol v3 (no drift)', () => {
    expect(v3Json.corpusHash).toBe(v2Json.corpusHash);
    expect(v3Json.sourceManifestHash).toBe(v2Json.sourceManifestHash);
    expect(v3Json.planHash).toBe(v2Json.planHash);
    expect(v3Json.corpusHash).toBe(REPRESENTATIVE_HYBRID_V1_CORPUS_HASH);
    expect(v3Json.sourceManifestHash).toBe(REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH);
  });

  it('protocol v3 execution-tree hash differs from the non-reproducible protocol v2 literal', () => {
    expect(v3Json.executionTreeHash).not.toBe(v2Json.executionTreeHash);
    expect(v3Json.executionTreeHash).toBe(
      '9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f',
    );
  });

  it('the execution-tree-hash computation is itself deterministic/reproducible (same repo state, same hash)', () => {
    // This is the exact check protocol v2's test suite (PR #137) never performed -- it only
    // asserted self-consistency across two calls and length===64, never comparing the computed
    // value to the frozen protocol literal (see the next test for that comparison). A
    // non-deterministic computation would fail this immediately instead of silently shipping.
    const first = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    const second = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('RESOLVER-V3-042: the frozen protocol-v3 executionTreeHash no longer equals a fresh computation, by design', () => {
    // RESOLVER-V3-042 (Gate Evaluator Fidelity Remediation) deliberately corrected real defects in
    // `RepresentativeHybridV1LiveMetrics.ts` and `RepresentativeHybridV1LiveReportBuilder.ts` --
    // both are on this execution-tree-hash's own tracked path list (see
    // `RepresentativeHybridV1LiveExecutionTreeHash.ts`), because they were always classified as
    // execution-relevant (the error message below literally names "metrics"). This is drift
    // protection working exactly as designed: it is proving that a real, deliberate evaluator fix
    // has occurred since the protocol was frozen, not exhibiting a new defect. The REAL, ALREADY-
    // EXECUTED live run (263/263 calls, `logs/resolver-v3-039-*`) ran under the ORIGINAL,
    // unmodified code at execution commit `a67a4d051fd1616cad3a59428b117a717d84f002` and is wholly
    // unaffected -- this task's own SHA-256 checks confirm those seven files are byte-identical
    // before/after. Protocol v3 is correctly retired for any FUTURE live execution attempt; a new
    // protocol would need to be frozen first, exactly like the v1->v2->v3 transitions before it
    // (see RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md).
    const fresh = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    expect(fresh).not.toBe(v3Json.executionTreeHash);
  });

  it('RESOLVER-V3-042: verification now correctly refuses the stale protocol-v3 document against current (fixed) code', () => {
    const doc = validDocument();
    const currentTreeHash = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, currentTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('rejects protocol v1 (protocolVersion literal never equals v3)', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      protocolVersion: v1Json.protocolVersion as string,
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('rejects protocol v2 (protocolVersion literal never equals v3)', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      protocolVersion: v2Json.protocolVersion as string,
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('rejects any protocolVersion other than the exact v3 literal, including a spoofed "v3"-looking string', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      protocolVersion: 'resolver-representative-hybrid-live-protocol-v3-draft',
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on a plan-hash mismatch', () => {
    const doc = validDocument();
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, 'different-plan-hash', doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on an execution-tree-hash mismatch (drift protection)', () => {
    const doc = validDocument();
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, 'different-tree-hash'),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on a corpus-hash mismatch', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      corpusHash: 'tampered-corpus-hash',
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on a source-manifest-hash mismatch', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      sourceManifestHash: 'tampered-source-manifest-hash',
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on a provider/model mismatch', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      provider: { providerId: 'anthropic', modelId: 'claude-opus-4-8', modelSnapshotId: 'x' },
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });

  it('refuses on a pricing mismatch', () => {
    const doc: RepresentativeHybridV1LiveProtocolV3Document = {
      ...validDocument(),
      pricing: { currency: 'USD', inputPerMillion: 999, outputPerMillion: 999 },
    };
    expect(() =>
      verifyRepresentativeHybridV1LiveProtocolV3(doc, doc.planHash, doc.executionTreeHash),
    ).toThrow(RepresentativeHybridV1LiveProtocolVerificationError);
  });
});
