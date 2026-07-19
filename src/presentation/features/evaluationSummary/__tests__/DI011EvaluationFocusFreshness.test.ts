import { PersistedFoodEntryRepository } from '../../../../features/nutrition/infrastructure/repositories/PersistedFoodEntryRepository';
import { FakeKeyValueStore } from '../../../../features/nutrition/infrastructure/storage/FakeKeyValueStore';
import { DeleteFoodEntryUseCase } from '../../../../features/nutrition/application/usecases/DeleteFoodEntryUseCase';
import { FoodEntryRepository } from '../../../../features/nutrition/application/ports/FoodEntryRepository';
import {
  FoodEntry,
  CorrectionLogEntry,
} from '../../../../features/nutrition/domain/models/NutritionTypes';
import { Clock } from '../../../../features/nutrition/application/ports/Clock';
import { BuildEvaluationInputForDateUseCase } from '../../../../features/evaluation/application/usecases/BuildEvaluationInputForDateUseCase';
import { GetActiveEvaluationOutputUseCase } from '../../../../features/evaluation/application/usecases/GetActiveEvaluationOutputUseCase';
import { EvidenceBasedStandardSettingsProvider } from '../../../../features/evaluation/application/settingsProviders/EvidenceBasedStandardSettingsProvider';
import { EvidenceBasedStandardProfile } from '../../../../features/evaluation/application/profiles/EvidenceBasedStandardProfile';
import { CalorieMacroCorridorRule } from '../../../../features/evaluation/application/rules/CalorieMacroCorridorRule';
import { PersistedActiveProfileRepository } from '../../../../features/evaluation/infrastructure/PersistedActiveProfileRepository';
import { EvaluationProfileRegistry } from '../../../../features/evaluation/application/ports/EvaluationProfileRegistry';
import { EvaluationOutput, EvaluationProfile } from '../../../../features/evaluation/domain/models';
import { InMemoryEffectiveGoalsRepository } from '../../../../features/goals/infrastructure/InMemoryEffectiveGoalsRepository';
import { GoalsNotFoundError, ProfileNotFoundError } from '../../../../features/goals';

/**
 * DI-011: automated reproduction harness for the confirmed native "Evaluation shows a
 * stale pre-delete snapshot after a delete-inclusive Journal mutation, until app restart"
 * defect (see ROADMAP.md DI-011 for the full native repro).
 *
 * Why this file does NOT render `EvaluationSummaryScreen.tsx`/`JournalScreen.tsx` or a real
 * `@react-navigation` `NavigationContainer`/bottom-tab navigator, despite the task's
 * instruction to prefer one: importing either screen file, or `@react-navigation/native`
 * itself, fails immediately under this repo's Jest config —
 *
 *   SyntaxError: Unexpected token 'export'
 *   node_modules/@react-navigation/native/lib/module/index.js:3
 *
 * — because `jest.config.js` uses `ts-jest` with `testEnvironment: 'node'` and no
 * `transformIgnorePatterns`/babel transform for node_modules ESM output (react-native's own
 * jest-preset, which would fix this, is not adopted anywhere in this repo — confirmed by
 * every prior DI-002/DI-007/DI-008/DI-009/DI-010/GE-010/GE-011 ROADMAP entry, all of which
 * independently record "no RN render-test harness" as a standing, pre-existing constraint,
 * not something introduced by this task). There is also no `react-test-renderer` or
 * `@testing-library/react-native` dependency present, and installing one would still not be
 * sufficient by itself (react-native's own source would still fail to parse under ts-jest
 * without also adopting its full jest-preset — a disproportionate, high-blast-radius
 * infrastructure change well beyond this task's scope, and explicitly not "the dependencies
 * already present").
 *
 * Instead, this harness exercises the REAL production repository/use-case/rule layer
 * (`PersistedFoodEntryRepository`, `DeleteFoodEntryUseCase`, `BuildEvaluationInputForDateUseCase`,
 * `GetActiveEvaluationOutputUseCase`, `CalorieMacroCorridorRule`, `PersistedActiveProfileRepository`)
 * — none of which import `react`/`react-native`/`@react-navigation/*`, so all of it is real,
 * unmocked, production code — driven through a `FocusEffectDriver` that is a verified,
 * line-for-line-equivalent mirror of `@react-navigation/core`'s actual `useFocusEffect`
 * runtime semantics (read from
 * `node_modules/@react-navigation/core/lib/module/useFocusEffect.js`, quoted in the comment
 * above `FocusEffectDriver` below), plus an `EvaluationSummaryLoadMirror` that is a verified,
 * line-for-line mirror of `EvaluationSummaryScreen.tsx`'s current `load()` function (React
 * `setState` calls replaced with plain field writes + an event log, since there is no React
 * renderer available; the request-generation-counter guard logic itself is reproduced
 * exactly, unchanged).
 *
 * What this DOES prove: whether the request-ordering/guard algorithm itself (as currently
 * written) is correct for concurrent/overlapping/out-of-order loads, and whether the
 * underlying data layer (the same singleton `PersistedFoodEntryRepository` pattern the real
 * app uses) is read-consistent immediately after a delete+create mutation sequence.
 *
 * What this CANNOT prove or disprove: whether React Navigation's `focus` event actually
 * fires on a real native bottom-tab return in the exact way it does on web/in this mirror
 * (diagnostic hypothesis 1/5 in the DI-011 task) — that requires an actual native runtime
 * (real `react-native-screens` native view attach/detach, real JS-thread/native-bridge
 * timing), which cannot exist in a headless Jest process. See ROADMAP.md DI-011's
 * "Implementation notes" for how this file's results were used to select (or explicitly not
 * select) a production fix, and the proposed native diagnostic instrumentation.
 */

// ---------------------------------------------------------------------------------------
// Test doubles: a Clock fixed to one date (mirrors the `TestClock` pattern already used in
// `src/test-setup.ts` and `MockResolverBuilder`-adjacent test helpers throughout this repo).
// ---------------------------------------------------------------------------------------
class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
  todayISO(): string {
    return this.fixed.toISOString().slice(0, 10);
  }
}

/**
 * Wraps a real `FoodEntryRepository` so a single, specific *future* call to
 * `listEntriesForDate` can be held open until the test explicitly releases it — used only by
 * the out-of-order-completion test to force an older in-flight load's data read to resolve
 * strictly after a newer load has already completed and committed. Every other method (and
 * every other call to `listEntriesForDate`) delegates straight through, unmodified — this is
 * purely a timing knob on the real repository, not a reimplementation of it.
 */
class OrderControlledFoodEntryRepository implements FoodEntryRepository {
  private callCount = 0;
  private gate: { forCall: number; promise: Promise<void>; release: () => void } | null = null;

  constructor(private readonly inner: FoodEntryRepository) {}

  /** Delays the Nth (1-indexed) call to `listEntriesForDate`. Returns the release function. */
  delayCall(callNumber: number): () => void {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.gate = { forCall: callNumber, promise, release };
    return release;
  }

  async listEntriesForDate(dateISO: string): Promise<FoodEntry[]> {
    this.callCount += 1;
    if (this.gate && this.gate.forCall === this.callCount) {
      await this.gate.promise;
    }
    return this.inner.listEntriesForDate(dateISO);
  }

  addEntry(entry: FoodEntry): Promise<void> {
    return this.inner.addEntry(entry);
  }
  listByDateRange(startDateISO: string, endDateISO: string): Promise<FoodEntry[]> {
    return this.inner.listByDateRange(startDateISO, endDateISO);
  }
  updateEntry(dateISO: string, entry: FoodEntry): Promise<void> {
    return this.inner.updateEntry(dateISO, entry);
  }
  getEntryById(id: string): Promise<FoodEntry | null> {
    return this.inner.getEntryById(id);
  }
  updateEntryById(entry: FoodEntry): Promise<void> {
    return this.inner.updateEntryById(entry);
  }
  deleteEntry(id: string, deletedAt: Date): Promise<void> {
    return this.inner.deleteEntry(id, deletedAt);
  }
  clearAll(): Promise<void> {
    return this.inner.clearAll();
  }
  appendCorrectionLogEntry(entryId: string, logEntry: CorrectionLogEntry): Promise<void> {
    return this.inner.appendCorrectionLogEntry(entryId, logEntry);
  }
  getCorrectionLog(entryId: string): Promise<CorrectionLogEntry[]> {
    return this.inner.getCorrectionLog(entryId);
  }
}

// ---------------------------------------------------------------------------------------
// FocusEffectDriver — verified mirror of @react-navigation/core's real useFocusEffect.
//
// Quoted verbatim from node_modules/@react-navigation/core/lib/module/useFocusEffect.js
// (v7, the version pinned in package.json) at the time this harness was written:
//
//   if (navigation.isFocused()) {
//     cleanup = callback();
//     isFocused = true;
//   }
//   const unsubscribeFocus = navigation.addListener('focus', () => {
//     if (isFocused) return;             // guards a double-fire on initial mount
//     if (cleanup !== undefined) cleanup();
//     cleanup = callback();
//     isFocused = true;
//   });
//   const unsubscribeBlur = navigation.addListener('blur', () => {
//     if (cleanup !== undefined) cleanup();
//     cleanup = undefined;
//     isFocused = false;
//   });
//
// EvaluationSummaryScreen.tsx wraps `load` with `useFocusEffect(useCallback(() => {
// load(); }, [load]))` — a callback with no cleanup return — so `cleanup` is always
// `undefined` for its usage; this driver keeps the general cleanup mechanics anyway so the
// mirror stays faithful to the real hook rather than a simplification of it.
// ---------------------------------------------------------------------------------------
class FocusEffectDriver {
  private isFocused = false;
  private cleanup: (() => void) | undefined;

  constructor(private readonly effect: () => void | (() => void)) {}

  /** Mirrors: `if (navigation.isFocused()) { cleanup = callback(); isFocused = true; }` */
  mountFocused(): void {
    this.cleanup = this.effect() ?? undefined;
    this.isFocused = true;
  }

  /** Mirrors the `addListener('focus', ...)` handler. */
  focus(): void {
    if (this.isFocused) return;
    if (this.cleanup !== undefined) this.cleanup();
    this.cleanup = this.effect() ?? undefined;
    this.isFocused = true;
  }

  /** Mirrors the `addListener('blur', ...)` handler. */
  blur(): void {
    if (this.cleanup !== undefined) this.cleanup();
    this.cleanup = undefined;
    this.isFocused = false;
  }
}

type LoadEventKind =
  | 'start'
  | 'bail-after-active-profile'
  | 'bail-after-output'
  | 'commit-success'
  | 'bail-in-catch'
  | 'commit-error';

interface LoadEvent {
  requestId: number;
  kind: LoadEventKind;
}

/**
 * Verified line-for-line mirror of `EvaluationSummaryScreen.tsx`'s current `load()` (see
 * that file for the source being mirrored). React `useState` setters are replaced with plain
 * field writes (no renderer available — see file header); the `loadRequestIdRef`
 * generation-counter guard, the exact await/guard ordering, and the exact
 * GoalsNotFoundError/ProfileNotFoundError/generic-error branching are reproduced unchanged.
 */
class EvaluationSummaryLoadMirror {
  loadState: 'loading' | 'success' | 'error' = 'loading';
  profiles: EvaluationProfile[] = [];
  activeProfileId: string | null = null;
  output: EvaluationOutput | null = null;
  errorMessage = '';
  readonly events: LoadEvent[] = [];

  private loadRequestIdRef = { current: 0 };

  constructor(
    private readonly registry: EvaluationProfileRegistry,
    private readonly buildEvaluationInputForDateUseCase: BuildEvaluationInputForDateUseCase,
    private readonly getActiveEvaluationOutputUseCase: GetActiveEvaluationOutputUseCase,
    private readonly today: string,
  ) {}

  async load(): Promise<void> {
    const requestId = ++this.loadRequestIdRef.current;
    this.events.push({ requestId, kind: 'start' });
    this.loadState = 'loading';

    const profileList = this.registry.list();
    this.profiles = profileList;

    const currentActiveId = await this.registry.getActiveProfileId();
    if (this.loadRequestIdRef.current !== requestId) {
      this.events.push({ requestId, kind: 'bail-after-active-profile' });
      return;
    }
    this.activeProfileId = currentActiveId;

    try {
      const input = await this.buildEvaluationInputForDateUseCase.execute(
        this.today,
        currentActiveId,
      );
      const result = await this.getActiveEvaluationOutputUseCase.execute(input);
      if (this.loadRequestIdRef.current !== requestId) {
        this.events.push({ requestId, kind: 'bail-after-output' });
        return;
      }
      this.output = result;
      this.errorMessage = '';
      this.loadState = 'success';
      this.events.push({ requestId, kind: 'commit-success' });
    } catch (err) {
      if (this.loadRequestIdRef.current !== requestId) {
        this.events.push({ requestId, kind: 'bail-in-catch' });
        return;
      }
      this.output = null;
      if (err instanceof GoalsNotFoundError) {
        this.errorMessage = 'Bitte zuerst im Ziele-Tab Ziele festlegen.';
      } else if (err instanceof ProfileNotFoundError) {
        this.errorMessage = 'Bitte zuerst im Ziele-Tab ein Metabolismus-Profil anlegen.';
      } else {
        this.errorMessage = 'Auswertung konnte nicht geladen werden.';
      }
      this.loadState = 'error';
      this.events.push({ requestId, kind: 'commit-error' });
    }
  }
}

function caloriesConsumed(output: EvaluationOutput | null): number | null {
  return output?.goalProgress.find((p) => p.label === 'calories')?.consumed ?? null;
}
function proteinConsumed(output: EvaluationOutput | null): number | null {
  return output?.goalProgress.find((p) => p.label === 'protein')?.consumed ?? null;
}
function carbsConsumed(output: EvaluationOutput | null): number | null {
  return output?.goalProgress.find((p) => p.label === 'carbs')?.consumed ?? null;
}
function fatConsumed(output: EvaluationOutput | null): number | null {
  return output?.goalProgress.find((p) => p.label === 'fat')?.consumed ?? null;
}

const TODAY_ISO = '2026-07-19';
const NOW = new Date(`${TODAY_ISO}T12:00:00.000Z`);

const GENEROUS_GOALS = { calories: 5000, protein: 500, carbs: 500, fat: 500 };

function buildEntry(overrides: Partial<FoodEntry> & Pick<FoodEntry, 'id'>): FoodEntry {
  return {
    rawInput: overrides.rawInput ?? overrides.id,
    parsedName: overrides.parsedName ?? overrides.id,
    quantityGrams: 100,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    confidenceScore: 0.9,
    sourceType: 'generic',
    createdAt: new Date(`${TODAY_ISO}T08:00:00.000Z`),
    ...overrides,
  } as FoodEntry;
}

// The exact confirmed native reproduction (see ROADMAP.md DI-011): a "Speck" entry existed,
// Evaluation had already loaded totals for it (386 kcal / 24 g protein / 1 g carbs / 32 g
// fat); it is then deleted and replaced by "100 g Haferflocken" (348 kcal / 13 g protein /
// 53 g carbs / 7 g fat).
const SPECK_ENTRY = buildEntry({
  id: 'speck-1',
  rawInput: '100g Speck',
  parsedName: 'Speck',
  calories: 386,
  protein: 24,
  carbs: 1,
  fat: 32,
});
const HAFERFLOCKEN_ENTRY = buildEntry({
  id: 'haferflocken-1',
  rawInput: '100g Haferflocken',
  parsedName: 'Haferflocken',
  calories: 348,
  protein: 13,
  carbs: 53,
  fat: 7,
  createdAt: new Date(`${TODAY_ISO}T09:00:00.000Z`),
});

interface Harness {
  foodEntryRepository: FoodEntryRepository;
  realFoodEntryRepository: PersistedFoodEntryRepository;
  deleteFoodEntryUseCase: DeleteFoodEntryUseCase;
  registry: EvaluationProfileRegistry;
  effectiveGoalsRepository: InMemoryEffectiveGoalsRepository;
  screen: EvaluationSummaryLoadMirror;
  driver: FocusEffectDriver;
  pendingLoads: Promise<void>[];
}

/**
 * Builds one full harness wired exactly like the DI container wires
 * `EvaluationSummaryScreen`/`JournalScreen` in production: ONE shared
 * `PersistedFoodEntryRepository` instance backs both the mutation side (delete/create) and
 * the Evaluation read side (`BuildEvaluationInputForDateUseCase`), matching this repo's
 * established "Journal and Evaluation use the same singleton PersistedFoodEntryRepository"
 * fact.
 */
function buildHarness(options?: { orderControlled?: boolean }): Harness {
  const clock = new FixedClock(NOW);
  const keyValueStore = new FakeKeyValueStore();
  const realFoodEntryRepository = new PersistedFoodEntryRepository(keyValueStore);
  const foodEntryRepository: FoodEntryRepository = options?.orderControlled
    ? new OrderControlledFoodEntryRepository(realFoodEntryRepository)
    : realFoodEntryRepository;

  const deleteFoodEntryUseCase = new DeleteFoodEntryUseCase(realFoodEntryRepository, clock);

  const registry = new PersistedActiveProfileRepository(new FakeKeyValueStore(), [
    EvidenceBasedStandardProfile,
  ]);
  const effectiveGoalsRepository = new InMemoryEffectiveGoalsRepository();

  const buildEvaluationInputForDateUseCase = new BuildEvaluationInputForDateUseCase(
    foodEntryRepository,
    [new EvidenceBasedStandardSettingsProvider(effectiveGoalsRepository)],
  );
  const getActiveEvaluationOutputUseCase = new GetActiveEvaluationOutputUseCase(registry, [
    CalorieMacroCorridorRule,
  ]);

  const screen = new EvaluationSummaryLoadMirror(
    registry,
    buildEvaluationInputForDateUseCase,
    getActiveEvaluationOutputUseCase,
    TODAY_ISO,
  );

  const pendingLoads: Promise<void>[] = [];
  const driver = new FocusEffectDriver(() => {
    pendingLoads.push(screen.load());
  });

  return {
    foodEntryRepository,
    realFoodEntryRepository,
    deleteFoodEntryUseCase,
    registry,
    effectiveGoalsRepository,
    screen,
    driver,
    pendingLoads,
  };
}

async function flush(pendingLoads: Promise<void>[]): Promise<void> {
  await Promise.all(pendingLoads.splice(0, pendingLoads.length));
}

describe('DI-011: EvaluationSummaryScreen focus-reload freshness after delete-inclusive Journal mutations', () => {
  it('required coverage 1: exact delete-inclusive sequence — Speck deleted, Haferflocken added while blurred, only replacement totals appear on refocus', async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    // Evaluation loads an initial entry.
    h.driver.mountFocused();
    await flush(h.pendingLoads);
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386);
    expect(proteinConsumed(h.screen.output)).toBe(24);
    expect(carbsConsumed(h.screen.output)).toBe(1);
    expect(fatConsumed(h.screen.output)).toBe(32);

    // Navigate away from Evaluation.
    h.driver.blur();

    // Delete the initial entry.
    await h.deleteFoodEntryUseCase.execute(SPECK_ENTRY.id);
    // Add a replacement entry.
    await h.realFoodEntryRepository.addEntry(HAFERFLOCKEN_ENTRY);

    // Refocus Evaluation.
    h.driver.focus();
    await flush(h.pendingLoads);

    // Visible totals must come only from the replacement entry.
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(348);
    expect(proteinConsumed(h.screen.output)).toBe(13);
    expect(carbsConsumed(h.screen.output)).toBe(53);
    expect(fatConsumed(h.screen.output)).toBe(7);

    // Exactly two loads ran (mount + one refocus), both committed in order.
    const commits = h.screen.events.filter((e) => e.kind === 'commit-success');
    expect(commits.map((e) => e.requestId)).toEqual([1, 2]);
  });

  it('required coverage 2: create-only refresh — a new entry logged while blurred appears on refocus', async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    h.driver.mountFocused();
    await flush(h.pendingLoads);
    expect(caloriesConsumed(h.screen.output)).toBe(386);

    h.driver.blur();
    await h.realFoodEntryRepository.addEntry(HAFERFLOCKEN_ENTRY);
    h.driver.focus();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386 + 348);
  });

  it('required coverage 3: edit refresh — an edited entry’s new values appear on refocus', async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    h.driver.mountFocused();
    await flush(h.pendingLoads);
    expect(caloriesConsumed(h.screen.output)).toBe(386);

    h.driver.blur();
    // Mirrors what EditFoodEntryFromNaturalLanguageUseCase ultimately persists: the same
    // entry id, corrected macro values.
    await h.realFoodEntryRepository.updateEntryById({
      ...SPECK_ENTRY,
      calories: 200,
      protein: 12,
      carbs: 0,
      fat: 16,
    });
    h.driver.focus();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(200);
    expect(proteinConsumed(h.screen.output)).toBe(12);
    expect(fatConsumed(h.screen.output)).toBe(16);
  });

  it('required coverage 4: delete to legitimate completed-empty state — deleting the only entry shows zero totals, not stuck/stale', async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    h.driver.mountFocused();
    await flush(h.pendingLoads);
    expect(caloriesConsumed(h.screen.output)).toBe(386);

    h.driver.blur();
    await h.deleteFoodEntryUseCase.execute(SPECK_ENTRY.id);
    h.driver.focus();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(0);
    expect(proteinConsumed(h.screen.output)).toBe(0);
  });

  it('required coverage 5: rapid blur/focus transitions settle on the last-triggered load with no corruption', async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    h.driver.mountFocused();
    h.driver.blur();
    h.driver.focus();
    h.driver.blur();
    h.driver.focus();
    h.driver.blur();
    h.driver.focus();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386);
    // Four focus events (mount + 3 refocuses) fired four loads, all started before any of
    // them had resolved (no `await` between the driver calls above). Only the last-started
    // request (4) is still the "current" one by the time each of the earlier ones reaches
    // its post-await guard check, so 1-3 correctly bail out (never commit) and only 4
    // commits — proving the guard neither drops the final, authoritative load nor lets a
    // superseded one slip through.
    const commits = h.screen.events.filter((e) => e.kind === 'commit-success');
    expect(commits.map((e) => e.requestId)).toEqual([4]);
    const bails = h.screen.events.filter((e) => e.kind.startsWith('bail'));
    expect(bails.map((e) => e.requestId).sort()).toEqual([1, 2, 3]);
  });

  it('required coverage 6: out-of-order async completion — an older load resolving after a newer one must not overwrite the newer result', async () => {
    const h = buildHarness({ orderControlled: true });
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    const orderControlled = h.foodEntryRepository as OrderControlledFoodEntryRepository;
    // Delay the FIRST listEntriesForDate call (the older, mount-triggered load) so it
    // resolves strictly after the second (refocus-triggered) load has already committed.
    const releaseOlderLoad = orderControlled.delayCall(1);

    h.driver.mountFocused(); // older load: request id 1, now blocked inside buildInput.execute
    h.driver.blur();
    await h.realFoodEntryRepository.addEntry(HAFERFLOCKEN_ENTRY);
    h.driver.focus(); // newer load: request id 2, unblocked, resolves immediately

    // Let the newer load run to completion first.
    await h.pendingLoads[1];
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386 + 348);

    // Now let the stale older load resolve.
    releaseOlderLoad();
    await flush(h.pendingLoads);

    // The newer result must still be visible — the older, later-resolving load must not
    // have overwritten it.
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386 + 348);

    const events = h.screen.events;
    expect(events.filter((e) => e.requestId === 2 && e.kind === 'commit-success')).toHaveLength(1);
    // The older request must have bailed out after its data resolved, not committed.
    expect(events.filter((e) => e.requestId === 1 && e.kind === 'bail-after-output')).toHaveLength(
      1,
    );
    expect(events.filter((e) => e.requestId === 1 && e.kind === 'commit-success')).toHaveLength(0);
  });

  it('required coverage 7: error state, then successful recovery on a later refocus', async () => {
    const h = buildHarness();
    // No goals set yet -> EvidenceBasedStandardSettingsProvider throws GoalsNotFoundError.
    h.driver.mountFocused();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('error');
    expect(h.screen.errorMessage).toBe('Bitte zuerst im Ziele-Tab Ziele festlegen.');
    expect(h.screen.output).toBeNull();

    h.driver.blur();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(HAFERFLOCKEN_ENTRY);
    h.driver.focus();
    await flush(h.pendingLoads);

    expect(h.screen.loadState).toBe('success');
    expect(h.screen.errorMessage).toBe('');
    expect(caloriesConsumed(h.screen.output)).toBe(348);
  });

  it("required coverage 8 (DI-008): loadState flips to 'loading' synchronously, before any awaited data resolves, so stale totals are never exposed mid-refresh", async () => {
    const h = buildHarness();
    await h.effectiveGoalsRepository.upsert({ mode: 'manual', goals: GENEROUS_GOALS });
    await h.realFoodEntryRepository.addEntry(SPECK_ENTRY);

    h.driver.mountFocused();
    await flush(h.pendingLoads);
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(386);

    h.driver.blur();
    await h.deleteFoodEntryUseCase.execute(SPECK_ENTRY.id);
    await h.realFoodEntryRepository.addEntry(HAFERFLOCKEN_ENTRY);

    // focus() synchronously calls load(), which synchronously sets loadState = 'loading'
    // before its first `await` — assert this happened BEFORE flushing any pending promises,
    // i.e. the previous ('success', 386 kcal) state is not observable even transiently.
    h.driver.focus();
    expect(h.screen.loadState).toBe('loading');
    expect(caloriesConsumed(h.screen.output)).toBe(386); // old field value; screen must not render it while loadState is 'loading'

    await flush(h.pendingLoads);
    expect(h.screen.loadState).toBe('success');
    expect(caloriesConsumed(h.screen.output)).toBe(348);
  });
});
