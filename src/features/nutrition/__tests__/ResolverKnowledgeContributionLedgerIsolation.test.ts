import fs from 'fs';
import path from 'path';

const ledgerFiles = [
  '../domain/models/ResolverKnowledgeContributionLedger.ts',
  '../domain/models/ResolverKnowledgeContributionReplaySummary.ts',
  '../domain/models/ResolverKnowledgeCandidateTerminalChain.ts',
  '../application/knowledge/ResolverKnowledgeContributionIdCalculator.ts',
  '../application/knowledge/ResolverKnowledgeContributionLedgerValidator.ts',
  '../application/knowledge/ResolverKnowledgeContributionLedgerEquality.ts',
  '../application/knowledge/ResolverKnowledgeCandidateFingerprintV2IdentityMapper.ts',
  '../application/knowledge/ResolverKnowledgeCandidateTerminalChainResolver.ts',
  '../application/knowledge/ResolverKnowledgeContributionReplaySummaryCalculator.ts',
  '../application/knowledge/ResolverKnowledgeContributionRecordingPlanner.ts',
  '../application/knowledge/ResolverKnowledgeContributionRetractionPlanner.ts',
  '../application/ports/ResolverKnowledgeContributionLedgerRepository.ts',
  '../infrastructure/knowledge/InMemoryResolverKnowledgeContributionLedgerRepository.ts',
].map((relative) => path.resolve(__dirname, relative));

const containerPath = path.resolve(__dirname, '../../../infrastructure/di/container.ts');

describe('RESOLVER-V3-032 contribution-ledger isolation', () => {
  it.each(ledgerFiles)('%s imports no Supabase, AI/provider, or network code', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/@supabase\/supabase-js/);
    expect(source).not.toMatch(/from ['"].*Supabase[A-Za-z]*['"]/);
    expect(source).not.toMatch(/AiInterpretationProvider|AiFoodMapper|AiMealParser/);
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest|node-fetch/);
    expect(source).not.toMatch(
      /SequentialFoodCatalogResolver|FusionCandidateResolver|FusionResolverAdapter/,
    );
  });

  it('is not referenced by the DI container/composition root', () => {
    const container = fs.readFileSync(containerPath, 'utf8');
    expect(container).not.toMatch(
      /ContributionLedger|ContributionRecordingPlanner|ContributionRetractionPlanner|ContributionReplaySummary|CandidateTerminalChain/,
    );
  });

  it('is not referenced by any file outside its own source/tests or an authorized RESOLVER-V3-023 consumer', () => {
    // RESOLVER-V3-023 (Learning Benchmark V2) is the first real caller of this reference ledger
    // implementation (it is otherwise unwired -- see this task's own ROADMAP notes). Its single
    // adapter file is a sanctioned consumer, mirroring the `authorizedV3032ConsumerFiles` pattern
    // in `ResolverKnowledgeAggregationV2Isolation.test.ts`: it depends on this logic rather than
    // rewriting it, and every other Learning Benchmark V2 file only sees its plain-data outcomes.
    const authorizedV3023ConsumerFiles = [
      '../benchmark/learningV2/LearningBenchmarkV2GlobalCandidateAdapter.ts',
    ].map((relative) => path.resolve(__dirname, relative));
    const srcRoot = path.resolve(__dirname, '../../../../src');
    const ledgerSymbols = [
      'ResolverKnowledgeContribution',
      'ResolverKnowledgeContributionRecordingPlanner',
      'ResolverKnowledgeContributionRetractionPlanner',
      'ResolverKnowledgeCandidateTerminalChainResolver',
      'InMemoryResolverKnowledgeContributionLedgerRepository',
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
        if (ledgerFiles.includes(fullPath)) continue;
        if (authorizedV3023ConsumerFiles.includes(fullPath)) continue;
        const source = fs.readFileSync(fullPath, 'utf8');
        if (ledgerSymbols.some((symbol) => source.includes(symbol))) offenders.push(fullPath);
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it('does not add a Supabase migration, RPC, batch worker, or edge function for this task', () => {
    const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    expect(migrationFiles.some((name) => /contribution.*ledger|aggregation.*v2/i.test(name))).toBe(
      false,
    );

    const functionsDir = path.resolve(__dirname, '../../../../supabase/functions');
    const functionEntries = fs.readdirSync(functionsDir, { withFileTypes: true });
    expect(
      functionEntries.some(
        (entry) => entry.isDirectory() && /contribution|ledger|aggregation/i.test(entry.name),
      ),
    ).toBe(false);

    for (const migrationFile of migrationFiles) {
      if (!migrationFile.endsWith('.sql')) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
      expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    }
  });

  it('does not exist as a private-observation/resolver-run identifier anywhere in the global-facing candidate or review models', () => {
    const globalFacingFiles = [
      '../domain/models/ResolverKnowledgeCandidate.ts',
      '../domain/models/ResolverKnowledgeReview.ts',
    ].map((relative) => path.resolve(__dirname, relative));
    for (const file of globalFacingFiles) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/observationId|resolverRunId|contributionId|contributorToken/);
    }
  });
});
