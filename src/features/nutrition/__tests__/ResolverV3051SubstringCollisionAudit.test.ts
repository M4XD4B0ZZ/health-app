import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import {
  runResolverV3051SubstringCollisionAudit,
  SubstringAuditReport,
  classifyBlsSubstringMatch,
} from '../resolverV3051SubstringCollisionAudit';
import { BLS_GENERIC_FOODS } from '../infrastructure/catalog/sources/blsGenericFoods';

/**
 * RESOLVER-V3-051 §Phase 3/6: full deterministic substring-collision audit over the real BLS
 * runtime population (unique display names, aliases, single tokens) plus the frozen 104-case
 * representative corpus, before/after the resolver-level `hasBlsGenericSubstringOnlyIdentity` fix.
 * Zero provider calls. Writes the full per-query report to
 * `logs/resolver-v3-051-substring-collision-audit.json` (gitignored, same convention as
 * `logs/resolver-v3-050-offline-impact-analysis.json`) -- the source data for the committed,
 * versioned summary in `reports/resolver-v3-051-generic-bls-substring-collision-safety.json`.
 */
describe('RESOLVER-V3-051: substring-collision audit', () => {
  let report: SubstringAuditReport;

  beforeAll(async () => {
    report = await runResolverV3051SubstringCollisionAudit();

    const outputDir = path.resolve(__dirname, '../../../../logs');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, 'resolver-v3-051-substring-collision-audit.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }, 300_000);

  it('covers a large, real, deterministic population derived from the full BLS record set', () => {
    expect(report.totals.totalQueries).toBeGreaterThan(5000);
    expect(BLS_GENERIC_FOODS.length).toBeGreaterThan(1000);
  });

  it('the target case: bare "snack" is recorded as a substring-only query that changed accepted -> ambiguous', () => {
    const target = report.results.find((r) => r.query === 'snack');
    expect(target).toBeDefined();
    expect(target!.winnerSourceIdBefore).toBe('X5A1030');
    expect(target!.statusBefore).toBe('accepted');
    expect(target!.statusAfter).not.toBe('accepted');
    expect(target!.queryLessSpecificThanWinner).toBe(true);
    expect(target!.classification).toBe('sub_token_substring_record_specific');
    expect(target!.transition).toBe('accepted_to_ambiguous');
  });

  it('every changed outcome is accounted for by the four mutually exclusive transitions', () => {
    for (const r of report.results) {
      const flags = [
        r.transition === 'accepted_to_ambiguous',
        r.transition === 'accepted_to_no_match',
        r.transition === 'ambiguous_to_accepted',
        r.transition === 'no_match_to_accepted',
      ].filter(Boolean).length;
      if (r.statusBefore !== r.statusAfter) {
        expect(flags).toBe(1);
      } else {
        expect(flags).toBe(0);
        expect(r.transition).toBe('unchanged');
      }
    }
  });

  it('totals are internally consistent with the per-query results', () => {
    expect(report.totals.changedOutcomes).toBe(
      report.results.filter((r) => r.statusBefore !== r.statusAfter).length,
    );
    expect(report.totals.acceptedToAmbiguous).toBe(
      report.results.filter((r) => r.transition === 'accepted_to_ambiguous').length,
    );
    expect(report.totals.acceptedBefore).toBe(
      report.results.filter((r) => r.statusBefore === 'accepted').length,
    );
    expect(report.totals.acceptedAfter).toBe(
      report.results.filter((r) => r.statusAfter === 'accepted').length,
    );
  });

  it('this task never converts ambiguous/no_match into accepted, and never touches rejected/no-match winners (fail-safe only, no new acceptances)', () => {
    expect(report.totals.ambiguousToAccepted).toBe(0);
    expect(report.totals.noMatchToAccepted).toBe(0);
  });

  it('no query with a genuine exact/whole-alias identity ever transitions accepted -> ambiguous', () => {
    // One documented, deliberate exception: query "ka" against U403100 ("Kalb, Fleisch, ...
    // max. 5%, (KA II), roh"). "ka" is a whole word within one of the record's generated aliases
    // (the alias-splitting process keeps parenthetical content as literal words, so the "(KA II)"
    // commercial grading-code qualifier survives as bare "ka"/"ii"), which the audit's classifier
    // treats as `whole_token` (the same "genuine documented synonym" shape as e.g. "mezcal" within
    // "Agavenbrand (Mezcal/Tequila)"). Unlike a real synonym, "ka" is a 2-character abbreviation
    // fragment, not a word a user would type meaning "veal" -- `hasBlsGenericSubstringOnlyIdentity`
    // correctly does NOT exempt it (its own whole-token check only consults `normalizedName`, which
    // strips the parenthetical entirely, never the generated aliases), so production conservatively
    // downgrades it to `ambiguous`. This is the safer of the two possible outcomes for a bare
    // 2-character query and is retained deliberately, not treated as a bug to fix.
    const knownWholeAliasWordButStillConservativelyFlagged = new Set(['ka']);
    for (const r of report.results) {
      if (r.transition === 'accepted_to_ambiguous') {
        expect(r.classification).not.toBe('exact_identity');
        if (r.classification === 'whole_token') {
          expect(knownWholeAliasWordButStillConservativelyFlagged.has(r.query)).toBe(true);
        }
      }
    }
  });

  it('every accepted-before substring-only-relation query is resolved by the fix (no longer accepted after)', () => {
    for (const r of report.results) {
      if (r.queryLessSpecificThanWinner && r.statusBefore === 'accepted') {
        expect(r.statusAfter).not.toBe('accepted');
      }
    }
  });

  describe('classifyBlsSubstringMatch direct coverage', () => {
    it('classifies the target defect record correctly', () => {
      const record = BLS_GENERIC_FOODS.find((r) => r.sourceId === 'X5A1030')!;
      expect(classifyBlsSubstringMatch('snack', record)).toBe(
        'sub_token_substring_record_specific',
      );
    });
  });
});
