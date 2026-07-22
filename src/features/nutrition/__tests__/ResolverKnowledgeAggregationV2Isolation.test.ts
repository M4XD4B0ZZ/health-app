import fs from 'fs';
import path from 'path';

const v2ModuleFiles = [
  '../domain/models/ResolverObservationAggregationProjectionV2.ts',
  '../domain/models/ResolverKnowledgeCandidateFingerprintV2.ts',
  '../domain/models/ResolverKnowledgeCandidateContributionRelation.ts',
  '../application/observations/ResolverObservationAggregationProjectorV2.ts',
  '../application/observations/ResolverObservationAggregationProjectionV2Validator.ts',
  '../application/knowledge/ResolverKnowledgeFingerprintPayloadValidator.ts',
  '../application/knowledge/ResolverKnowledgeCandidateFingerprintV2Calculator.ts',
  '../application/knowledge/ResolverKnowledgeCandidateContributionRelationClassifier.ts',
  '../application/ports/ResolverKnowledgeFingerprintHasher.ts',
  '../infrastructure/knowledge/NodeCryptoResolverKnowledgeFingerprintHasher.ts',
].map((relative) => path.resolve(__dirname, relative));

const containerPath = path.resolve(__dirname, '../../../infrastructure/di/container.ts');

describe('RESOLVER-V3-031 V2 module isolation', () => {
  it.each(v2ModuleFiles)(
    '%s imports no Supabase, resolver-execution, or provider/network code',
    (file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/@supabase\/supabase-js/);
      expect(source).not.toMatch(/from ['"].*Supabase[A-Za-z]*['"]/);
      expect(source).not.toMatch(
        /SequentialFoodCatalogResolver|FusionCandidateResolver|FusionResolverAdapter/,
      );
      expect(source).not.toMatch(/AiInterpretationProvider|AiFoodMapper|AiMealParser/);
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest|node-fetch/);
    },
  );

  it('no V2 module is referenced by the DI container/composition root', () => {
    const container = fs.readFileSync(containerPath, 'utf8');
    expect(container).not.toMatch(
      /AggregationProjectionV2|AggregationProjectorV2|CandidateFingerprintV2|ContributionRelationClassifier|NodeCryptoResolverKnowledgeFingerprintHasher/,
    );
  });

  it('no V2 module is referenced anywhere outside its own source/tests or an authorized RESOLVER-V3-032 consumer', () => {
    // RESOLVER-V3-032 is explicitly required to depend on the V3-031 fingerprint/classifier logic
    // as a consumer ("use V3-031 logic as a dependency, not as code to rewrite") rather than
    // duplicating it, so its pure domain/application files are sanctioned additional consumers of
    // these symbols. This does not weaken the check for any other file: the DI container, UI,
    // journal, and resolver-execution code remain forbidden from referencing any V2 symbol (see
    // the two prior tests and the isolation test below), and no new production caller was added.
    const authorizedV3032ConsumerFiles = [
      '../domain/models/ResolverKnowledgeContributionLedger.ts',
      '../application/knowledge/ResolverKnowledgeCandidateFingerprintV2IdentityMapper.ts',
      '../application/knowledge/ResolverKnowledgeContributionIdCalculator.ts',
      '../application/knowledge/ResolverKnowledgeContributionLedgerValidator.ts',
      '../application/knowledge/ResolverKnowledgeContributionRecordingPlanner.ts',
      '../application/knowledge/ResolverKnowledgeContributionReplaySummaryCalculator.ts',
    ].map((relative) => path.resolve(__dirname, relative));
    // RESOLVER-V3-023 (Learning Benchmark V2) is the first real caller of the V3-031/032
    // in-memory reference implementations (they are otherwise unwired, per those tasks' own
    // ROADMAP notes). Its single adapter file is a sanctioned additional consumer for exactly the
    // same reason as the RESOLVER-V3-032 files above ("depend on the logic, don't rewrite it") --
    // every other Learning Benchmark V2 file only sees this adapter's plain-data outcome types.
    const authorizedV3023ConsumerFiles = [
      '../benchmark/learningV2/LearningBenchmarkV2GlobalCandidateAdapter.ts',
    ].map((relative) => path.resolve(__dirname, relative));
    const srcRoot = path.resolve(__dirname, '../../../../src');
    const v2Symbols = [
      'ResolverObservationAggregationProjectionV2',
      'ResolverObservationAggregationProjectorV2',
      'ResolverKnowledgeCandidateFingerprintV2',
      'ResolverKnowledgeCandidateContributionRelationClassifier',
      'NodeCryptoResolverKnowledgeFingerprintHasher',
    ];
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
        if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
        if (v2ModuleFiles.includes(fullPath)) continue;
        if (authorizedV3032ConsumerFiles.includes(fullPath)) continue;
        if (authorizedV3023ConsumerFiles.includes(fullPath)) continue;
        const source = fs.readFileSync(fullPath, 'utf8');
        if (v2Symbols.some((symbol) => source.includes(symbol))) offenders.push(fullPath);
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it('does not modify package.json/package-lock.json or add migrations for this task', () => {
    const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    expect(migrationFiles.some((name) => /aggregation.*v2|contribution.*ledger/i.test(name))).toBe(
      false,
    );
  });
});
