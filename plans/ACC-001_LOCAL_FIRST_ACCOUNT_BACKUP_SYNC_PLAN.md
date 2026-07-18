# ACC-001 — Local-First Account, Backup & Synchronization Boundary

Status: **planning complete, review-only** — no product code, migrations, dependencies, or
configuration changed by this task. See `ROADMAP.md` → EPIC "Account, Backup & Sync
(Architecture)" → ACC-001 for the task contract this document satisfies.

Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 10.

Confirmed, non-negotiable product principles this plan operates under (given, not re-derived):
Zera is local-first; the app must provide full value with zero account; account creation is
never required before first log/goals/Saved Meals/evaluations; login is optional and only for
backup/restore/multi-device continuity; providers are Google (Android) / Apple (iOS) via
Supabase Auth; authentication ≠ synchronization.

---

## 1. Current-state inventory (code-verified)

This section replaces assumption with what the repository actually does today. Every claim
below was verified by reading the named file during this task.

### 1.1 Persistence mechanism

- All app domain data lives in `AsyncStorage`, wrapped by a single `KeyValueStore` port
  (`src/features/nutrition/application/ports/KeyValueStore.ts`), implemented by
  `AsyncStorageKeyValueStore` (`src/features/nutrition/infrastructure/storage/AsyncStorageKeyValueStore.ts`),
  which prefixes every key with `nutrition:`. Notably, the **Goals** feature's persisted
  repositories (`PersistedMetabolismProfileRepository`, `PersistedEffectiveGoalsRepository`)
  import this same `nutrition`-owned `KeyValueStore` port — there is one physical local
  key-value store for the whole app, not one per feature.
- There is exactly **one local installation**, single-user, single-workspace. Nothing in the
  storage layer is namespaced by user, device, or workspace ID today.
- Each domain repository owns one (or two) fixed storage keys and does full-blob JSON
  read/parse/write on every mutation (lazy-load once, write-through on every change):

  | Domain | Repository | Storage key(s) | Shape |
  | --- | --- | --- | --- |
  | Journal entries | `PersistedFoodEntryRepository` | `nutrition:entries` | flat JSON array of `FoodEntry`, grouped in-memory by date |
  | Correction Log | `PersistedFoodEntryRepository` | `nutrition:correctionLog` | JSON map `entryId -> CorrectionLogEntry[]` |
  | Saved Meals | `PersistedSavedMealRepository` | `nutrition:savedMeals` | flat JSON array of `SavedMealTemplate` |
  | Metabolism profile | `PersistedMetabolismProfileRepository` | `goals:metabolismProfile` | single JSON object (singleton) |
  | Effective goals / macro targets | `PersistedEffectiveGoalsRepository` | `goals:effectiveGoals` | single JSON object (singleton) |
  | Active evaluation profile | `PersistedActiveProfileRepository` | (own key, `evaluation` feature) | singleton |
  | Food aliases (user corrections to resolver) | `PersistedFoodAliasRepository` | local key + `SupabaseUserAliasSource` (cloud-only, resolver concern) | mixed |
  | Portion hints | `PersistedPortionHintRepository` | own key | JSON |
  | Reminder settings | `PersistedReminderSettingsRepository` | own key | JSON singleton |

### 1.2 Domain model — IDs, timestamps, soft-delete, revisions

- **`FoodEntry`** (`src/features/nutrition/domain/models/NutritionTypes.ts:8-68`): `id: string`,
  `createdAt: Date`, optional `lastModifiedAt?: Date`, optional `deletedAt?: Date`
  (**soft-delete tombstone**, added for J-003; repositories filter it out of
  `listEntriesForDate`/`listByDateRange`/`getEntryById`). **No revision/version field, no
  `userId`, no device ID.**
- **`CorrectionLogEntry`** (same file, :74-78): `{ timestamp: Date, previousValues: FoodEntry,
  triggeredBy: 'user' | 'system' }` — explicitly documented as "append-only audit record
  written on every edit and delete… never exposed in any UI-facing read path." This is
  already the right shape for a sync-safe append-only log (full pre-image snapshot + cause).
- **`SavedMealTemplate`** (`src/features/nutrition/domain/models/SavedMealTypes.ts`, via
  `PersistedSavedMealRepository`): `id`, `name`, `items[]`, `createdAt`, `updatedAt`. **No
  soft-delete** — `delete(id)` physically removes the template from the map before
  persisting. No revision field.
- **`MetabolismProfile` / `EffectiveGoals`**: singleton objects, no `id`, no array, no
  history. `upsert()` is a full overwrite of the single storage key. There is no local record
  of "what the goal was before" — only the Correction Log domain models this.
- **ID generation**: `RandomIdGenerator.newId()` (`src/features/nutrition/infrastructure/RandomIdGenerator.ts`)
  returns `` `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,11)}` `` — a
  timestamp+random string, **not a UUID/ULID**. It is unique enough for one local device today
  (collision probability is low, and it's never compared across devices), but it is not a
  standards-based globally-unique identifier and was never designed for multi-device merge.
  This is a concrete Phase-0 finding (see §17, Phase 0).

### 1.3 Existing Supabase surface

- `src/infrastructure/supabase/supabaseClient.ts`: one client, configured with
  `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }` — i.e.
  Supabase's **default AsyncStorage-backed session persistence** is already active, even
  though no login UI exists yet. `validateSupabaseConfig` fails fast (visible error screen)
  if `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing at build time —
  the client is only ever reachable with a real anon key + URL.
- Today this client is used **only** for resolver/catalog concerns: `food-off-search` /
  `food-usda-search` edge functions, `SupabaseEdgeOffSource`/`SupabaseEdgeUsdaSource`,
  `SupabaseUserAliasSource` (per-user food alias corrections — already user-scoped!),
  `SupabaseResolverRunLogger`. **None of these are app-data sync** — they are shared
  reference/knowledge-layer concerns, and `SupabaseUserAliasSource` is the only one that is
  already per-`user_id`-scoped in the schema today (see §1.5).
- **Auth is already partially scaffolded, but not implemented, wired to UI, or usable** —
  ROADMAP `P2-008` (`status: todo`) added, deliberately as an application-layer scaffold
  only:
  - `src/features/auth/application/ports/AuthRepository.ts` — `getAccessToken()`,
    `getCurrentSession()`, `signInWithOAuth(provider)`, `signOut()`;
    `OAuthProvider = 'apple' | 'google'`.
  - `src/features/auth/infrastructure/SupabaseAuthRepository.ts` — implements the port via
    `supabase.auth.*`, `signInWithOAuth` uses `skipBrowserRedirect: true` (returns the
    authorization URL rather than opening it).
  - `src/features/auth/application/usecases/SignInWithOAuthUseCase.ts` — thin pass-through,
    wired into `container.ts` as `signInWithOAuthUseCase`.
  - **P2-008 explicitly lists what's still missing**: registered Apple/Google OAuth apps +
    Supabase Auth dashboard config (external, non-code); a URL scheme in `app.json`
    (protected file); `expo-web-browser` / `expo-apple-authentication` (new dependencies,
    protected `package.json`); the actual presentation-layer login screen; and a decision on
    session storage hardening (`expo-secure-store`) beyond Supabase's own default.
  - **Implication for this plan**: ACC-001 must not re-propose "add an auth port/use case" as
    a new task — that scaffold exists. The phased roadmap in §17 sequences *around* P2-008
    (Phase 1 = finish P2-008's external/native/UI prerequisites), not duplicate it.

### 1.4 Existing RLS/ownership precedent (reusable template)

Two tables already implement exactly the ownership pattern ACC-001 needs for new tables —
useful as a concrete template rather than an abstract proposal:

- `user_food_aliases` (`supabase/migrations/20260201000000_create_user_food_aliases.sql`,
  hardened in `20260613145404_harden_food_catalog_and_resolver_schema.sql`): full CRUD,
  RLS via `(select auth.uid()) = user_id` on every policy (SELECT/INSERT/UPDATE/DELETE).
- `user_entitlements` (`supabase/migrations/20260712_add_user_entitlements_table.sql`):
  **read-only** for the owning user (`SELECT` policy only); all writes happen via a
  service-role webhook that bypasses RLS by design — no client-side INSERT/UPDATE policy
  exists on purpose. This is the right template for any future *server-computed* field.

Both patterns are directly reusable for the schema in §14/§15.

### 1.5 Governance constraints that bound this plan

- `.governance/SAFETY.md`: `supabase/migrations/**` is **Absolute Protection** — never
  modified without an explicit migration task. Consistent with the user's instruction; this
  plan proposes schema **intentions**, no SQL.
- `.governance/SAFETY.md`: `package.json`/`app.json`-class changes are **Conditional
  Protection** — explicit approval required. Every dependency this plan anticipates
  (`expo-web-browser`, `expo-apple-authentication`, possibly `expo-secure-store`, possibly a
  UUID/ULID library) is therefore an explicit line item of its own future task, never bundled.
- VERIFY.md Category 1 (documentation-only) applies to this task's own verification (see
  §25 "Verification" at the end of this document).

---

## 2. Product decision matrix

| Option | Description | Assessment |
| --- | --- | --- |
| **No account (ever)** | Rejected outright by given principles — user explicitly wants optional backup/multi-device later. | Rejected |
| **Optional backup (recommended baseline)** | Account is entirely optional, offered after value delivery, purely as "Daten sichern"; app is 100% functional without it. | **Recommended direction** (see §3 for MVP-boundary sub-decision) |
| **Full bidirectional multi-device sync from day one** | Same optional-offer entry point, but ships live bidirectional sync as the first authenticated capability. | Evaluated in §12; recommended as **Phase 3+**, not the first shippable slice — see reasoning there |
| **Mandatory account** | Rejected — directly contradicts given principle 3 (no blocking account walls before core value). | Rejected |

This matrix answers deliverable #3. The live open question is not *whether* accounts are
optional (settled) but *which capability ships first* once an account exists — see §12.

---

## 3. Recommended release boundary (MVP scope)

**Recommendation: ship backup/restore first; design the data model so full sync is possible
later without a rewrite; do not ship a "sync" claim until it is reliable.**

Rationale, weighed against the given "product recommendation criteria":

- Backup/restore (one authenticated device uploads, a second/reinstalled device restores) is
  the overwhelming majority of the real user value in "I don't want to lose my data" and
  "I got a new phone." It requires only one-directional conflict handling (adoption at first
  login — see §9), which is a strictly smaller problem than live bidirectional merge (§8).
- Bidirectional live sync introduces an entire category of correctness problems this
  repository has never had to solve: concurrent edits, tombstone propagation, clock skew,
  partial-batch failure, idempotent retries across two writers. Shipping this first, before
  the simpler backup path is validated in production, maximizes the risk of exactly the
  outcome the given principles warn against — "an unreliable sync claim."
- The identity model in §7 and schema in §14 are designed so that backup/restore and full
  sync share the **same** local outbox/tombstone/revision model (§8, Option F). Nothing in
  Phase 2 (backup) needs to be thrown away to reach Phase 3 (sync) — the incremental step is
  additive (turn on background pull + conflict rules), not a rewrite.
- This is exactly what the user's trailing note asks to review next ("zuerst verlässliches
  Backup/Restore oder direkt bidirektionale Mehrgeräte-Synchronisation") — this plan states
  the recommendation and the evidence, but treats final sign-off as **open** (see §24).

**Recommended MVP boundary:** Phase 0 (prerequisites) + Phase 1 (finish P2-008's auth shell)
+ Phase 2 (authenticated backup/restore, one-directional). Phase 3 (incremental bidirectional
sync) and beyond follow only after Phase 2 has run in production and the release-boundary
decision in §24 is explicitly approved.

---

## 4. Account-offer UX / value moment

**Principle:** never gate value behind an account; offer it as a benefit after value has
already been received, never as a wall or a fear appeal.

- **Where offered:** Settings/Account area (always available, low-pressure) **and** one soft,
  dismissible contextual moment the first time a user has accumulated data worth protecting
  (e.g. after N journal entries or the first Saved Meal) — a single non-blocking banner/card,
  not a modal, not repeated nagging once dismissed.
- **Never offered:** during onboarding, before first log, before using goals, before creating
  a Saved Meal, before viewing an evaluation. (Matches given principle 3 verbatim — this is a
  hard constraint, not a recommendation.)
- **Copy direction (example, not final):** "Daten sichern — Speichere deine Zera-Daten und
  nutze sie auf mehreren Geräten." Must not promise: permanent/guaranteed storage, medical-
  record-grade storage, end-to-end encryption (not implemented), or sync capabilities not yet
  shipped (e.g. don't say "sync" during a backup-only MVP — say "sichern"/"speichern").
  Exact microcopy is a Phase-2 UI task, not decided here.
- **If the user never creates an account:** app remains fully usable indefinitely; no
  degraded functionality; no fear-based re-prompting ("you could lose everything!"). UI
  should be able to distinguish "local-only" vs "backed-up" state (see §16 sync-status UX)
  but must not turn this into a nagging indicator throughout the Journal.

---

## 5. First-login / logout / reinstall behavior (product-level, ties to §9–§11 state machines)

- **First login (existing local data):** never silently upload-and-forget or silently
  discard. The user is asked what to do only when genuinely ambiguous (see §9's precise state
  machine — most common case, "local data + empty cloud," can proceed automatically with a
  single confirmatory "Lokale Daten mit diesem Konto sichern" action, no interrogation UI).
- **Logout:** the product decision is to offer **"Auf diesem Gerät behalten"** (keep the
  last-synced snapshot cached locally, read-only/local-only afterwards) vs. **"Von diesem
  Gerät entfernen"** (wipe local data, return to a fresh anonymous local workspace) — see §10
  for the exact state machine and the cross-account-contamination guard this requires.
- **Reinstall/new device:** login → initial pull → local DB init → explicit progress/empty/
  error states → resumable/retryable, idempotent restore (never a duplicate-import risk) —
  see §11.

---

## 6. Data classification matrix

Classification legend: **A** = user-owned, synchronized; **B** = local-only device state,
never uploaded; **C** = reconstructable/reference data, must not upload; **D** = deferred,
not decided in this task.

| Domain | Class | Rationale |
| --- | --- | --- |
| Journal entries (`FoodEntry`, active) | **A** | User-created, durable, the core product value; must survive reinstall. |
| Journal entries, soft-deleted (`deletedAt` set) | **A** (as tombstone) | Deletion must propagate to other devices — see §11; tombstone itself is the synced artifact, not the full content forever (see §11 retention). |
| `nutritionSnapshot` (frozen macro snapshot on a `FoodEntry`) | **A** | Part of the entry it's embedded in; not separately classified. |
| `foodCatalogRef` (pointer to a Food Catalog row: source/sourceId/displayName/confidence) | **A** (as a reference field only) | The *reference* syncs with the entry; the catalog row it points to is **C** and must never be re-uploaded or duplicated per user. |
| Raw user input (`rawInput` on `FoodEntry`) | **A** | Part of the entry; already stored today, needed for provenance/re-parse. |
| Correction Log (`CorrectionLogEntry`) | **A** | Append-only audit trail; already documented as never-overwrite; must sync as an immutable log, not a mutable row (see §8). |
| Saved Meals + items | **A** | User-created, explicitly named for reuse; per given expected direction. |
| Body data (weight, height, age, sex, activity level — whatever `MetabolismProfile` inputs are) | **A** | Sensitive personal data (see §15) but user-owned and meant to persist/restore. |
| Metabolism profile (computed BMR/TDEE + inputs) | **A** | Same table as body data inputs; computed fields travel with it for restore continuity, recomputed locally when formulas change (do not treat computed fields as authoritative history). |
| Evaluation goal (active profile selection) | **A** | Small, durable user preference. |
| Macro-distribution mode + manual macro targets (`EffectiveGoals`) | **A** | Durable user preference/setting. |
| Templates (Saved Meals) | **A** | Same as Saved Meals above (this is the same domain, listed once for clarity). |
| UI disclosure state (e.g. "formulas expanded/collapsed" from GE-011) | **B** | Ephemeral UI preference, no product value synced across devices, not worth a schema. |
| Transient confirmations (J-008/J-014 last-submit banner state) | **B** | Explicitly transient/session-local by design; never persisted beyond the current screen session today. |
| Resolver caches / per-request candidate sets | **C** | Reconstructable from the Food Catalog + resolver logic; already server-side cached (`food_query_cache`) independent of any user. |
| BLS catalog/artifacts | **C** | Shared reference data, not user data; already shared across all users via `food_catalog_items`/BLS static source. |
| Provenance/source metadata on catalog matches | **A** (as part of the entry's `foodCatalogRef`/`resolverDecisionSummary`) | Needed to explain *this user's* logged entry; the catalog row itself remains **C**. |
| Onboarding completion state | **B** | Device-local gate flag; not meaningful to sync (a second device should show its own onboarding once, if at all — open question, see §24). |
| App preferences (theme, notification/reminder settings) | **D** | Plausibly **A** later (nice continuity) but not required for MVP value; explicitly deferred rather than assumed. |
| Analytics/diagnostic consent | **D** | No such consent flag currently exists in the codebase (not found in this task's inspection); if introduced later, must be decided against §15's logging/diagnostics boundary at that time — not invented here. |

This matches the "expected direction" given in the task brief and the verification did not
surface evidence to the contrary: sync Journal/Correction Log/Saved Meals/body data/goals;
do not sync transient UI state, generated catalog artifacts, or resolver caches.

---

## 7. Identity / ownership model

**Current state (see §1.2):** local record IDs (`RandomIdGenerator`) are not UUIDs; there is
no `userId` anywhere in the local domain models; there is exactly one local
"workspace" (the AsyncStorage instance itself acts as the implicit single workspace).

**Decisions:**

1. **Are current record IDs globally unique enough for multi-device sync?** No — not because
   of a demonstrated collision, but because they are not a standards-based identifier
   (`timestamp-random`, ~46 bits of entropy in the random part, no machine/device component).
   For a single device this is fine; for cross-device merge where two devices might legally
   generate an entry at the exact same millisecond, the collision risk, while low, is
   avoidable at zero cost by switching the generator.
2. **Must IDs be migrated before sync?** Recommend switching new-record ID generation to
   UUIDv4 (or ULID, which additionally sorts lexicographically by creation time — a genuine
   plus for a `created_at`-adjacent sort key) **before Phase 2** ships. Existing records keep
   their current IDs unchanged — this is additive (new format for new records), not a
   backfill/rewrite of history. No destructive ID replacement is proposed, per the given
   preferred principle.
3. **Should records be created locally with stable IDs before any account exists?** Yes —
   this is already true today (`RandomIdGenerator.newId()` runs at creation time regardless
   of auth state) and must remain true: local-first requires that IDs never wait on a network
   round-trip or an authenticated session.
4. **How are existing local records assigned to the authenticated user at first login?** The
   client, once authenticated, tags every currently-unsynced local record with the
   authenticated `user_id` as part of the outbox entry it creates for that record (see §8) —
   ownership is asserted client-side but **enforced** server-side by RLS `WITH CHECK
   (auth.uid() = user_id)` (see §15), so a client cannot claim another user's data even if it
   tried. The stable record ID itself never changes — only a `user_id` column gets populated.
5. **Is `user_id` stored locally, remotely, or both?** Both: remotely as the table's owner
   column (authoritative, RLS-enforced); locally as an optional field only once a record has
   been associated with an account (needed so the client can tell, per-record, "mine and
   backed-up" vs "local-only" for the sync-status UX in §16, and to guard against
   cross-account contamination on logout/re-login as someone else, per #6 below).
6. **How is cross-account contamination prevented after logout/login as another user?**
   Local records that are still purely local-only (never uploaded, no `user_id` yet) are safe
   by construction — they don't carry any account's identity. Local records that **were**
   synced under account A must not be silently presented to, or re-uploaded under, account B
   after a switch. The logout state machine (§10) makes this an explicit branch: switching
   accounts on the same device requires either (a) clearing the previously-synced local
   cache before the new account's initial pull, or (b) tagging cached records with the
   `user_id` they were synced under and filtering any UI/read path by "current session's
   user_id or no user_id at all" — recommend (a) for simplicity in the MVP (Phase 2), revisit
   (b) only if "switch accounts without losing offline access to the first account's cache"
   becomes a real requirement (currently out of scope).
7. **Is a separate workspace/profile identifier needed?** Not for MVP — one local device,
   one active account (or none) at a time is sufficient for the stated scope (no family
   accounts, no multi-profile-per-device requirement given). If ever needed, it would be an
   additive local-only concept layered on top of this model, not a redesign.

**Preserved principle:** every user-created record keeps the *same* stable ID across local
and cloud, from the moment it is created — sync never replaces IDs, only adds a `user_id`
association and revision/tombstone metadata (§8, §14).

---

## 8. Sync architecture

Comparing the six options given in the brief:

| Option | Description | Assessment |
| --- | --- | --- |
| A. Full snapshot upload/download | Reupload/redownload everything each time. | Rejected — does not scale past a handful of entries, no partial-failure safety, no real conflict handling; wrong even for backup-only beyond a trivial dataset size. |
| B. Timestamp-based bidirectional sync | "Whatever changed since last sync timestamp." | Rejected as sole mechanism — vulnerable to clock skew (see §11.5) and doesn't give a clean way to represent deletions or idempotent retries without additional metadata anyway (at which point it becomes a weaker version of D). |
| C. Revision-based record sync | Per-record monotonic revision counter, incremental pull by revision. | Good primitive, but insufficient alone — needs an explicit outbox for the write path and explicit tombstones for deletion; C is a *component* of the recommended answer, not a complete architecture by itself. |
| D. Outbox/inbox with per-record revisions and tombstones | Local durable write → outbox entry → async push; incremental pull keyed by revision; explicit tombstone rows for deletion. | **Recommended core.** |
| E. Supabase Realtime-driven | Realtime channel as the source of truth for sync state. | Rejected as sole mechanism per the given constraint ("must not recommend Realtime as sole source of truth") — also means the app would have a hard runtime dependency on a live socket for ordinary logging, contradicting local-first. |
| F. Hybrid (local durable write → outbox → background push → incremental pull → optional Realtime hints) | D, plus Realtime used only as an optional low-latency *hint* to trigger an incremental pull sooner — never as the data path itself. | **Recommended.** |

**Recommendation: Option F**, i.e. D as the durable core, with Realtime demoted to an
optional "wake up and pull now" nudge for a later phase (Phase 4+, multi-device), never load-
bearing. Concretely:

- **Local write path is always synchronous and local-only for the user-visible result** (see
  §10 in the write-path breakdown below) — Supabase is never a hard dependency for an
  ordinary log/edit/delete.
- **Outbox**: a local, durable queue of pending mutations (create/update/soft-delete), each
  keyed by a client-generated idempotency key (see §11 for exact fields). Processed
  asynchronously, in order, with retry-with-backoff on failure; entries are only removed from
  the outbox once the server acknowledges (not merely "request sent").
- **Push**: authenticated upload of outbox entries; server assigns/validates ownership via
  RLS; server increments/returns the authoritative revision for the record.
- **Pull**: incremental, keyed by "server revision greater than last-seen revision for this
  device," not by wall-clock timestamp — avoids clock-skew correctness bugs entirely for the
  pull path (see §11.5).
- **Realtime** (Phase 4+ only): a lightweight event ("something changed for this user") used
  purely to trigger an incremental pull sooner than the next scheduled/foregrounded pull —
  the app must behave correctly (eventually consistent) even if every Realtime event is
  dropped.

This directly satisfies the given preferred direction: local repository stays the immediate
source for UI/writes; sync happens asynchronously after local persistence; Supabase never
becomes a hard runtime dependency for ordinary logging.

### Write path

```
UI / use case
   -> local transaction (existing repository .addEntry/.update/.delete)
   -> durable local record written (existing AsyncStorage write-through)
   -> sync outbox entry appended (NEW, local-only, same transaction/best-effort atomicity)
   -> immediate local UI success returned to the user (unchanged from today)
   -> [async, out of band] authenticated upload of the outbox entry
   -> server acknowledgement (revision assigned/confirmed)
   -> outbox entry marked complete / removed
```

A successful local log must never be lost because the network is unavailable — the outbox
entry simply waits; the user-visible write already succeeded before the network step even
starts.

### Read path

```
App launch / screen focus
   -> render from local storage immediately (never blocks on network)
   -> [async, background] incremental cloud pull (revision-keyed)
   -> merge/apply into local storage (see §8 conflict rules per domain)
   -> screen refresh only if the local read model actually changed
   -> sync-state visibility available (§16) but never blocking
   -> on pull error: keep showing local data, surface a non-blocking sync-status state only
```

The app must never block launch waiting for Supabase — this is a hard requirement, not a
preference, consistent with local-first.

---

## 9. Domain-specific conflict matrix

Per-domain, not one blanket rule, as required:

| Domain | Conflict key | Revision/version field | Timestamp authority | Device identifier used? | Winning rule | User intervention ever required? | Edit-vs-delete behavior | Tie-breaking |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Journal entries** | record `id` | server-assigned monotonic `revision` (new field) | server `updated_at` is authoritative; client timestamp is informational only | not required for correctness, useful for diagnostics | Entries are event-oriented and near-immutable; genuine field-level edits go through the *existing* correction/edit model (`EditFoodEntryFromNaturalLanguageUseCase`), which already produces a new `lastModifiedAt` + Correction Log entry — sync treats each such edit as a new revision, last server-accepted revision wins, no field-level merge. | No — deterministic by revision | Simultaneous edit+delete: soft-delete (tombstone) wins over a concurrent edit — losing the edit is the safer default for health/food-log data (never silently resurrect a user-deleted entry with stale edited content); the edit is preserved in the Correction Log for recovery/audit even though it "lost." | Highest revision wins; if revisions are equal (should not happen with a monotonic per-record counter, treated as a defensive-only case), tombstone (delete) beats a plain field edit. |
| **Correction Log** | append-only, no update/delete ever | monotonic sequence, implicit via insertion order | server `created_at` on insert | not required | Append-only — there is no "conflict" to resolve, only ordering; two devices appending entries for the same `entryId` simply both get inserted, ordered by server timestamp/insertion order. Never overwritten. | No | N/A (never edited or deleted) | Insertion order (server-assigned) |
| **Saved Meals + items** | template `id` | `revision` (new field, mirrors Journal) | server `updated_at` | not required | Last-write-wins is acceptable here — Saved Meals are a convenience/reuse feature, not an event log; a concurrent rename and a concurrent content change on the same template both resolve by highest revision, no field-level merge attempted. | No | Deletion beats a concurrent edit of the same template, matching the Journal rule for the same underlying reason (don't resurrect stale content the user meant to remove); recommend also **soft-deleting** Saved Meals server-side (today's local `delete()` is a hard delete — see §17 Phase 0 gap) so the delete itself can propagate as a tombstone rather than "silently reappearing" if a stale device re-pushes an older un-deleted copy. | Highest revision wins; equal-revision defensive case: delete beats edit. |
| **Body data / metabolism profile inputs** | singleton per user (one row) | `revision` | server `updated_at`, treated as authoritative | not required for MVP, but recording `last_written_device_id` is cheap and useful for the sync-status UX ("last updated on this device" vs "another device") | Latest explicit user edit wins (last-write-wins by revision/timestamp) — do **not** attempt to merge individual fields (e.g. weight from device A + activity level from device B) from two contradictory profile edits without evidence that's ever a real scenario; this avoids inventing a fabricated hybrid profile from unrelated edits on two devices. | No, for MVP — flagged as a place a future "are you sure?" prompt could be added if user testing shows silent overwrite surprises users, but not proposed now without evidence. | N/A (no delete concept for a singleton profile beyond account deletion, see §13) | Highest revision/latest `updated_at` wins. |
| **Goals / macro-distribution settings** | singleton per user (one row) | `revision` | server `updated_at` | not required | Same as body data: LWW is acceptable — these are simple preference-like settings, not collaborative documents. | No | N/A | Highest revision wins. |

**Why this per-domain split matters:** Journal/Saved-Meals need delete-beats-edit and
revision-based LWW because they are user-facing durable records where "the delete was real
and it should stick" is the safer default; the Correction Log needs *no* conflict rule at all
because it's append-only by construction; singleton profile/goals data needs plain LWW
because there is no meaningful "merge" of a body-metrics profile.

---

## 10. Clock reliability

Client wall-clock timestamps alone are insufficient because: device clocks can be wrong,
skewed, or manually changed by the user; two devices can both believe they are "later" than
the other; using client timestamps as the sync tie-breaker would let a device with a fast
clock silently win every conflict regardless of actual causal order.

**Recommended minimum, no more:**

- **Server-assigned monotonic `revision`** per record (an integer or a `bigserial`-backed
  counter, incremented by the server on every accepted write) — this is the actual conflict
  tie-breaker (§9), not any timestamp.
- **Server `updated_at`** (`timestamptz`, server-generated, `now()` at write time) — used only
  for user-facing display ("last changed 2 hours ago") and for the incremental-pull filter's
  secondary ordering, never as the authority for who "won" a conflict.
- **Client-generated idempotency key** per mutation (e.g. a UUID generated when the outbox
  entry is created) — lets the server safely deduplicate a retried push (see failure
  scenarios §11: "duplicate retry," "server accepts mutation but ack lost").
- **Explicitly not proposed** (over-engineering beyond MVP needs): vector clocks, CRDTs,
  Lamport/hybrid-logical clocks, or a distributed consensus protocol — none of the domains in
  §9 need field-level automatic merge, so the complexity these would buy is not needed.

---

## 11. Deletion model

- **Soft-delete/tombstones**: Journal already has this locally (`deletedAt`); Saved Meals do
  not (hard-delete today — a genuine gap, see §17 Phase 0). Recommend both use the same
  server-side pattern: a `deleted_at timestamptz NULL` column acts as the tombstone; a
  deleted row's revision is still bumped on delete so the tombstone itself propagates via the
  same incremental-pull-by-revision mechanism as any other change — no separate "deletions
  feed" is needed.
- **Propagation to other devices**: a device's incremental pull naturally includes rows whose
  `deleted_at` became non-null since its last-seen revision; the client applies this as a
  local soft-delete (Journal) or removal (Saved Meals, once soft-delete is added there too).
- **Retention before hard deletion**: recommend retaining server-side tombstones for a fixed
  window (e.g. 30–90 days — exact number is a product decision, not fixed here) before any
  hard physical deletion, so a device that reconnects after being offline for a while still
  observes the tombstone rather than the record simply vanishing without explanation.
  Exception: an explicit user-requested **permanent** deletion (of one entry, or full account
  deletion) is not required to wait out this window — see §13.
- **Preventing deleted-record resurrection**: because the tombstone itself carries a revision
  number higher than any prior edit, a stale device that pushes an old, pre-deletion cached
  copy of the record is rejected/overwritten by the tombstone on next pull (the tombstone's
  revision is higher) — the record cannot be silently resurrected by a late push from a
  stale device, consistent with the delete-beats-edit rule in §9.
- **Relationship to the Correction Log**: a delete already appends a Correction Log entry
  locally (per J-003's documented behavior) — this is preserved and becomes part of what
  syncs; the Correction Log is the durable "why/when was this deleted" audit trail, while the
  tombstone (`deleted_at`) is the sync-propagation mechanism. They serve different purposes
  and both are needed.
- **User-requested permanent deletion vs. account deletion**: deleting one entry is a
  per-record tombstone as above. Account deletion (§13) is a different, larger operation —
  full removal/anonymization of all of a user's owned rows plus the auth identity itself, not
  a per-record tombstone that other devices "learn about" over time.

---

## 12. Backup vs. sync — explicit MVP recommendation

Restating and expanding §3's conclusion with the explicit backup-vs-sync framing requested:

- **Backup** (one-directional protection/restore): a device uploads its local data under an
  authenticated account; a device (the same one after reinstall, or a new one) can download
  and restore it. No concurrent-write conflict handling is needed beyond "did this record
  already get restored" (idempotency), because there is exactly one writer at a time from the
  user's perspective in the common case this targets (lost phone, new phone, reinstall).
- **Sync** (bidirectional multi-device): two or more devices can be actively logging at
  overlapping times and must reconcile via the conflict rules in §9.
- **MVP decision (recommended, pending final approval per §24):** **(C) Backup first, sync
  later, using a data model already compatible with both** — Phase 2 ships backup/restore
  using the exact same outbox/revision/tombstone model that Phase 3 needs for full sync; the
  only thing Phase 3 adds is *turning on* background incremental pull + the conflict rules
  for genuinely concurrent multi-device writes. Nothing built in Phase 2 needs to be
  rewritten to reach Phase 3.
- Product value / risk / migration-cost weighing: Option A (backup/restore only, forever)
  under-delivers on the stated long-term goal ("optional... for backup/restore/multi-device/
  continuity" — multi-device is explicitly wanted eventually). Option B (full sync
  immediately) over-delivers relative to what's validated and carries the highest risk of
  shipping an "unreliable sync claim," which the given criteria explicitly warn against.
  Option C is the only one that satisfies both the near-term risk profile and the long-term
  product intent without a rewrite in between.

---

## 13. First-login adoption — deterministic state machine

States, keyed by **(local data present?, cloud data present for this account?)**:

1. **Local data + empty cloud** (expected common case: first-ever login on the device that's
   been used all along). Action: single confirmatory UI — "Lokale Daten mit diesem Konto
   sichern" — on confirmation, every local record without a `user_id` gets one outbox entry
   created (tagged with the authenticated `user_id`) and pushed. No destructive step, no
   interrogation beyond the one confirmation. If the upload is interrupted (case 3 below
   applies retroactively), it resumes from the outbox on next launch/foreground — the outbox
   is idempotent (client-generated idempotency keys, §10), so a partially-completed upload
   never double-inserts on retry.
2. **No local data + populated cloud** (expected common case: fresh install, existing
   account, e.g. after reinstall or a genuinely new device). Action: "Cloud-Daten auf dieses
   Gerät laden" — full incremental pull from revision 0, applied to the (empty) local store.
   See §14 for the exact progress/empty/error/retry states.
3. **Local data + populated cloud** (device had been used locally before ever logging in,
   *and* the account already has data from another device). This is the only genuinely
   ambiguous case. Action: explicit choice, never automatic/silent:
   - **"Lokale und gespeicherte Daten zusammenführen"** (merge) — recommended default and
     the only one to prefer automating, because record identity + idempotency make it
     provably safe: local-only records (no `user_id` yet) are, by definition, records the
     cloud has never seen, so uploading them cannot collide with or overwrite anything —
     the merge is a straightforward union, not a destructive choice. This satisfies "prefer
     automatic safe merge only where record identity + idempotency make it provably safe."
   - Explicitly **not** automated: any option that would discard either side (e.g. "only keep
     cloud" / "only keep local") — those remain manual, opt-in choices in the same UI for the
     rare case a user genuinely wants to discard one side, but they are never the default and
     never silent.
4. **Interrupted adoption** (app closed mid-upload/mid-pull): the outbox/pull-cursor state is
   itself durable local state (not in-memory only), so resuming on next launch continues from
   where it left off — no special-case "recovery" logic needed beyond "the sync engine always
   resumes from persisted state," which is also required for ordinary offline operation.
5. **Retry after failure**: identical mechanism to #4 — failure is not a distinct state from
   "not yet complete," it's just outbox/pull-cursor state that hasn't advanced yet; the UI
   surfaces "Synchronisierung fehlgeschlagen" (§16) with a retry action, but the underlying
   state machine doesn't need a separate failure branch.
6. **Login to a different account after previous sync**: must not silently mix the two
   accounts' data. Per §7 item 6, recommend clearing the previously-synced local cache
   (records that carry the *previous* account's `user_id`) before starting the new account's
   initial pull (case 2 above) — this is a deliberate, explained step ("Konto gewechselt —
   lokale Daten des vorherigen Kontos werden entfernt"), not a silent wipe.

**No silent data replacement in any of the above** — every branch that could lose data is an
explicit user choice; every branch that cannot lose data (local-only-upload, empty-device
pull) proceeds without friction.

---

## 14. Restore / new-device flow

This is state 2 of §13, detailed as its own flow since the brief calls it out separately:

1. User installs the app fresh (or reinstalls) → local store is empty → app is immediately
   usable local-first (per the non-negotiable principle) with zero blocking on any network
   call.
2. User signs in (Google/Apple via Supabase Auth, per P2-008 once complete).
3. App detects "no local data, this account has cloud data" (§13 case 2) and offers "Cloud-
   Daten auf dieses Gerät laden."
4. **Progress state**: visible, non-blocking indicator while the incremental pull (from
   revision 0) runs; the app remains usable for *new* local logging concurrently — a restore
   in progress must never block the user from logging food right now.
5. **Empty state**: if the account genuinely has no cloud data yet (e.g. it was created but
   never backed up from another device), show that plainly rather than implying a restore is
   "in progress" forever.
6. **Error state**: network/server failure during restore surfaces "Synchronisierung
   fehlgeschlagen" with a retry action (§16); partially-pulled data already applied locally is
   not rolled back (each pulled record is independently valid — see idempotency below) —
   only the remaining, not-yet-pulled records need to retry.
7. **Interrupted restore / retry**: identical mechanism to §13 case 4/5 — the pull cursor
   (last-seen revision) is durable local state; resuming re-issues the pull from that cursor,
   never from zero, so already-restored records are never re-applied.
8. **Preventing duplicate imports**: because pull is keyed by server revision (not by
   re-scanning "everything"), and applying a pulled record is an idempotent
   upsert-by-stable-id locally, running the same pull twice (e.g. due to a retry racing a
   just-completed pull) cannot create duplicate local records — this is the direct payoff of
   preserving stable record IDs (§7) end to end.

---

## 15. Logical Supabase schema proposal (no SQL)

Every table below extends the existing `user_food_aliases`/`user_entitlements` ownership
pattern (§1.4). "Local-model counterpart" names the existing local domain model it mirrors.

| Table | Purpose | Primary key | Owner relationship | Revision field | `created_at` | `updated_at` | `deleted_at`/tombstone | Source/provenance fields | RLS intent | Local-model counterpart |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `journal_entries` | Synced copy of a user's food log entries | client-generated UUID (same ID as local record, §7) | `user_id uuid references auth.users(id)` | `revision bigint` | yes | yes | `deleted_at timestamptz null` | `raw_input`, `resolver decision summary`/`food_catalog_ref` fields mirrored from the local model | owner-only SELECT/INSERT/UPDATE/soft-delete (`auth.uid() = user_id`), matching `user_food_aliases`'s full-CRUD template | `FoodEntry` |
| `journal_corrections` | Synced Correction Log — append-only | server-generated (e.g. `bigserial` or UUID) | `user_id`, `entry_id` (FK to `journal_entries.id`) | none needed (append-only; insertion order is the "revision") | yes | not applicable (never updated) | not applicable (never deleted) | `previous_values` (JSON snapshot), `triggered_by` | owner-only SELECT/INSERT; **no UPDATE/DELETE policy at all** (mirrors `user_entitlements`'s "no client mutation path" pattern, but here by domain necessity — append-only) | `CorrectionLogEntry` |
| `saved_meals` | Synced Saved Meal templates | client-generated UUID | `user_id` | `revision bigint` | yes | yes | `deleted_at timestamptz null` (**new** — local model has no soft-delete today, see §17 Phase 0 gap) | — | owner-only full CRUD (soft-delete via UPDATE, not DELETE) | `SavedMealTemplate` |
| `saved_meal_items` | Line items of a Saved Meal | server-generated or composite | `user_id` (denormalized for direct RLS) + FK to `saved_meals.id` | inherits parent's `revision` (no independent revision needed — item changes always accompany a parent template revision bump) | yes | yes | not applicable (items are replaced as a set when a template is edited, not individually tombstoned) | `food_catalog_ref` fields | owner-only, scoped through the parent template's ownership | `SavedMealItem` |
| `user_body_profile` | Body/metabolism profile inputs | `user_id` (also PK, one row per user — singleton, mirrors `user_entitlements`'s `user_id PRIMARY KEY` shape) | `user_id references auth.users(id)` | `revision bigint` | yes | yes | not applicable (no delete concept short of account deletion, §13) | `last_written_device_id` (optional, diagnostics only) | owner-only SELECT/INSERT/UPDATE | `MetabolismProfile` |
| `user_goal_settings` | Active evaluation goal + macro-distribution mode + manual macro targets | `user_id` (PK, singleton) | `user_id references auth.users(id)` | `revision bigint` | yes | yes | not applicable | — | owner-only SELECT/INSERT/UPDATE | `EffectiveGoals` + active-profile selection |
| `sync_devices` | Registered devices for a user (diagnostics + future multi-device UX, e.g. "last synced from iPhone") | `id` (UUID) | `user_id` | not applicable | yes | yes (last-seen) | not applicable (or `revoked_at` if a "remove this device" UX is ever built) | `device_label`, `platform` | owner-only SELECT/INSERT/UPDATE | none today (new local concept: a stable local device ID, if not already implied by the OS) |
| `sync_mutations` (mutation receipts) | Server-side idempotency ledger for outbox pushes — "have I already applied this idempotency key" | idempotency key (client-generated UUID) | `user_id` | not applicable | yes | not applicable | not applicable | `target_table`, `target_id`, `applied_revision` | owner-only SELECT (diagnostics); INSERT only via the same transaction that applies the mutation (effectively service-role/RPC-mediated, not a raw client INSERT policy) | none today (new) |

**Separation of concerns** (as required): product domain data = `journal_entries`,
`journal_corrections`, `saved_meals`, `saved_meal_items`, `user_body_profile`,
`user_goal_settings`; sync metadata = `sync_devices`, `sync_mutations`; auth identity =
`auth.users` (Supabase-managed, not proposed here). No table is proposed without a concrete
local counterpart or a proven sync-mechanics need (`sync_mutations` exists purely to make
retries/duplicate-push idempotent, per §10/§11's failure-mode requirements — not spec'd
speculatively).

---

## 16. RLS policy intentions

Intentions only, mirroring the two existing precedents in §1.4 — no SQL:

- **Insert ownership**: every INSERT policy requires `WITH CHECK (auth.uid() = user_id)` —
  a client can only ever create rows it owns; it cannot forge another user's `user_id` at
  insert time (same shape as `user_food_aliases`'s existing INSERT policy).
- **Select own rows**: every table's SELECT policy is `USING (auth.uid() = user_id)` (or,
  for `saved_meal_items`, scoped via its denormalized `user_id` or a join to the parent
  template) — a user can never read another user's rows, full stop.
- **Update own rows**: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` for
  every mutable table — prevents a client from reassigning a row's ownership to someone else
  via UPDATE, and prevents updating a row that isn't already theirs.
- **Delete / soft-delete own rows**: for domains using soft-delete (`journal_entries`,
  `saved_meals`), "deletion" is an UPDATE setting `deleted_at`, governed by the same
  owner-only UPDATE policy above — no separate DELETE policy is needed for those tables. For
  any table where hard delete is ever exposed, it would need its own owner-only DELETE
  policy, but none is proposed here since every synced domain in §6 uses tombstones.
- **`journal_corrections` is deliberately insert-only for clients** (§15) — this enforces
  "never overwrite history" at the database level, not just by application convention.
- **Server-controlled fields cannot be arbitrarily reassigned by clients**: `revision` and
  `updated_at` should be set by a database trigger/default (`now()`, an incrementing
  sequence) rather than trusted from client-submitted values — the client's role is only to
  submit the *content* change; the server is the sole authority for revision/ownership
  bookkeeping, exactly like `user_entitlements`'s `updated_at NOT NULL DEFAULT now()` pattern
  extended with a similar trigger-owned `revision`.
- **Storage objects**: none are currently required by any domain in §6 (no image/file sync
  in scope — explicitly out of scope, see §22) — if ever introduced, the same owner-only
  pattern (object path prefixed by `user_id`, RLS-equivalent storage policy) would apply, not
  specified further here since nothing in this task's scope needs it.
- **Auditability without exposing private health data**: `sync_mutations` (idempotency
  ledger) gives an audit trail of *what was attempted and when* without needing to expose
  the health-data content itself in any shared/admin-visible location — diagnostics can stay
  at the metadata level (which table, which id, which revision) rather than logging body-
  data or food-log content (ties directly into §19's privacy/logging boundary).
- **The anon key is not a secret** — it is a publishable client identifier (already
  documented behavior via `EXPO_PUBLIC_SUPABASE_ANON_KEY`); RLS, not key secrecy, is what
  protects user data, consistent with how the existing `user_food_aliases`/`user_entitlements`
  tables already operate.

---

## 17. Security / session-storage boundary

- **Supabase Auth with Google (Android) / Apple (iOS)**: this plan does not re-verify
  provider-specific technical claims beyond what P2-008 already scoped, since no new
  provider-specific technical claim is being made here that P2-008 didn't already surface;
  if a future implementation task needs to confirm current OAuth redirect/deep-link
  requirements, EAS/native build requirements, or Apple private-relay-email handling, that
  task should consult Supabase's own Auth documentation, Google Identity documentation, Apple
  Developer documentation, and Expo's own documentation directly at that time (primary
  sources only, no blog posts as architecture authority) — restated as a requirement for
  whichever future task implements it, not answered speculatively here.
- **What P2-008 already identified as still needed** (restated from §1.3, not re-derived):
  registered OAuth apps with real client credentials; a URL scheme / deep-link config in
  `app.json`; `expo-web-browser` (open the auth URL, capture the redirect) and
  `expo-apple-authentication` (native Apple flow); the actual login screen; and a decision on
  whether Supabase's default AsyncStorage-backed session persistence is sufficient or whether
  `expo-secure-store`-backed storage is required.
- **Recommended default-storage decision (flagged, not finally decided)**: Supabase's default
  session persistence already uses AsyncStorage (confirmed in `supabaseClient.ts`), which is
  unencrypted at rest on the device. Given this app handles health data, recommend evaluating
  `expo-secure-store` (OS-level secure storage) for the session/refresh token specifically
  as part of Phase 1 (finishing P2-008), rather than accepting the default silently — this is
  listed as an **open decision requiring approval** in §24, not decided here, since it's a
  new dependency (protected `package.json`).
- **Refresh tokens / sign-out / revoked sessions**: handled by `supabase-js`'s
  `autoRefreshToken: true` (already configured) and `signOut()` (already implemented in
  `SupabaseAuthRepository`); a revoked-session/expired-token failure mode is covered in §18's
  failure matrix (rows "access token expires," "user revokes Google/Apple access," "account
  deleted from another device").
- **Account linking / same email through different providers / Apple private relay email**:
  not addressed by any code in this repository today (P2-008's scaffold does not touch
  account linking); flagged as an **open product/technical decision** for whichever task
  implements the real login screen (§24) rather than assumed here.
- **Dev/preview environments and local testing limitations**: this environment cannot
  register or test real OAuth credentials (already stated in P2-008's own notes) — this
  remains true for ACC-001 and any future implementation task; testing strategy (§20)
  reflects this by scoping native-OAuth testing to manual/device-based verification, not
  automated CI.

---

## 18. Privacy / health-data boundary

Body data, food logs, and goals are treated as sensitive personal data throughout this plan
(§6 classification, §15 RLS). Specific points:

- **Data minimization / purpose limitation**: only the domains classified **A** in §6 are
  proposed for sync; reconstructable/reference data (**C**) is explicitly excluded from
  upload (§6), and transient UI state (**B**) is never persisted server-side at all.
- **Retention**: tombstone retention window per §11; account-deletion retention is addressed
  in §19 (final server-side deletion, not indefinite retention "just in case").
- **Export**: see §19.
- **Consent/notice**: the account-offer UX (§4) is itself the notice moment — a user
  explicitly opts in to backup before any of their local data leaves the device; no data
  leaves the device before that explicit action, for any user who never creates an account.
- **Logging/diagnostics boundary**: per §16, sync diagnostics (`sync_mutations`) are scoped
  to metadata (table/id/revision), not content — this plan explicitly prohibits writing
  food/body-data content into analytics or crash logs; no code in this repository currently
  does so for these domains (not found during inspection), and this boundary should be
  treated as a constraint on any future sync-engine implementation task, not merely a
  suggestion.
- **Legal/regulatory boundary**: this plan does not provide legal conclusions about GDPR,
  health-data-specific regulation (e.g. any special-category-data treatment under GDPR
  Art. 9), or platform store requirements (Apple/Google health-data policies) — these require
  final legal review before Phase 2 ships to real users with real accounts. Where a technical
  recommendation above (e.g. retention windows, RLS ownership) touches a likely legal
  requirement, it is presented as a technical starting point **only**, explicitly separated
  from any legal determination, per the given constraint.

---

## 19. Export and account deletion

**Export (future boundary, not implemented here):**

- Machine-readable export (e.g. JSON) covering the same **A**-classified domains as sync
  (§6); a human-readable option (e.g. a simple formatted summary) as a secondary format.
- Provenance included (Correction Log, `foodCatalogRef`/`resolverDecisionSummary` fields) —
  an export that silently drops provenance would be less trustworthy than the in-app data.
- Deleted/tombstoned records: excluded from a normal "my current data" export by default;
  could be offered as a separate "full history including deleted items" option later — not
  decided here, flagged as an open product question if it ever becomes a real request (§24).
- Generated catalog data (**C**-classified, §6) excluded from export — only referenced (e.g.
  by displaying the food's name at export time), never duplicated wholesale.
- Offline export before account creation should be possible in principle (it's just "export
  my local data," no network needed) even though this plan's phasing (§17) sequences backup
  before a dedicated export UI — this is noted as a real, low-cost opportunity for a Phase 5
  task, not assumed to require an account.
- Authenticated export after sync would export the server-side canonical copy instead of (or
  in addition to) the local copy — functionally equivalent once sync is reliable, since the
  two are meant to converge.

**Account deletion (expected behavior, not implemented):**

1. User requests deletion (from Settings/account area).
2. Reauthentication where required (platform/Supabase Auth convention — not decided further
   here, a detail for the implementing task).
3. Server-side deletion (or anonymization, if a legal retention requirement is later
   identified — a legal question, not decided here) of all rows owned by that `user_id`
   across every table in §15.
4. Deletion of the Supabase Auth identity itself (`auth.users` row), via Supabase's own
   account-deletion mechanism.
5. **Local-device choice**, explicit, not silent: "delete all local data on this device" vs.
   "detach and keep a local-only copy" — the latter is only offered if it is legally and
   technically safe to do so (an open question flagged for legal review, not assumed either
   way here); if that safety cannot be confirmed at implementation time, only the "delete
   all local data" option should ship.
6. **Other devices**: once the auth identity is gone, other devices' sessions are revoked by
   Supabase Auth itself; those devices' next network operation fails with an
   auth/session-revoked error (already covered as a failure scenario in §18's matrix, item
   "account deleted from another device") and should be surfaced with a clear, non-alarming
   message rather than a generic error.
7. **Clear user-facing confirmation**: a final explicit confirmation step before step 1
   proceeds irreversibly — exact copy is an implementation-time UI detail, not decided here.

**How account deletion differs from deleting individual entries**: a single entry's deletion
is a per-record tombstone that other devices *learn about* over time via the normal pull
mechanism (§11) — the account/user itself, and its right to log in, continue to exist.
Account deletion is the reverse: the owning identity itself is destroyed, taking all owned
rows with it (or anonymizing them, pending legal review), and is not something other devices
"pull" — it is enforced by session revocation, which is immediate and out-of-band from the
normal sync mechanism.

---

## 20. Sync-status UX

Smallest clear set of states, exactly as given, no additions invented:

- **„Nur auf diesem Gerät"** — no account, or account exists but this record hasn't been
  pushed yet.
- **„Gesichert"** — successfully synced/backed up.
- **„Synchronisierung läuft"** — outbox/pull actively in progress.
- **„Änderungen ausstehend"** — local changes exist that haven't been pushed yet (e.g.
  offline).
- **„Synchronisierung fehlgeschlagen"** — last push/pull attempt failed; retry available.
- **„Kontoaktion erforderlich"** — e.g. token expired/revoked, needs re-login.

**Placement**: Settings/account-data section as the primary home for this status; a
contextual error banner only when a failure genuinely needs the user's attention (e.g.
"Kontoaktion erforderlich" because a background push has been failing for a while) — **not**
a persistent cloud icon on every Journal row or every screen, per the explicit constraint.

---

## 21. Failure-mode matrix

For each scenario: local user-visible behavior; data-loss risk; retry/idempotency
requirement; whether the user must act; telemetry allowed (metadata only, never content —
per §16/§18).

| # | Scenario | Local user-visible behavior | Data-loss risk | Retry/idempotency requirement | User must act? | Telemetry allowed |
| - | --- | --- | --- | --- | --- | --- |
| 1 | Offline first use (no account) | Fully normal — app never knows or cares about network state for local-only use | None | N/A | No | N/A (no sync attempted) |
| 2 | Account creation while offline | Sign-in fails with a clear network error; app remains fully usable local-only in the meantime | None (nothing was uploaded yet) | Retry sign-in when back online | Yes (retry when connectivity returns) | Auth error code only |
| 3 | Login succeeds but initial upload fails | „Änderungen ausstehend" / „Synchronisierung fehlgeschlagen"; local data untouched | None locally; cloud simply doesn't have the data yet | Outbox retries with backoff; resumes automatically | No (automatic retry); can manually retry | Failure reason (network/5xx/etc.), no content |
| 4 | App closes during upload | Outbox state persisted; resumes on next launch | None — durable outbox survives process death | Must resume from persisted outbox state, not restart from scratch | No | Resume event, count of pending items |
| 5 | Duplicate retry (same mutation pushed twice) | No visible effect — idempotent | None | Server dedupes via `sync_mutations` idempotency key (§15) | No | Duplicate-detected count (diagnostic) |
| 6 | Server accepts mutation but ack lost | Outbox entry appears to not have completed; next retry re-sends the same idempotency key | None — server recognizes the key as already applied and returns the existing result rather than double-applying | Same idempotency-key mechanism as #5 | No | N/A |
| 7 | Access token expires | Background push/pull pauses; „Kontoaktion erforderlich" once retried refresh also fails | None (local data safe; only sync paused) | `autoRefreshToken` handles the common case silently; only surfaced to the user if refresh itself fails | Only if silent refresh fails | Auth error code |
| 8 | User revokes Google/Apple access | Next token refresh fails → „Kontoaktion erforderlich" → re-login required | None locally | N/A (requires new login, not a retry) | Yes | Auth error code |
| 9 | Supabase unavailable | „Synchronisierung fehlgeschlagen"; app fully usable local-only in the meantime | None | Standard outbox/pull retry with backoff | No | Outage duration (diagnostic) |
| 10 | Local DB unavailable/corrupt | Existing `try/catch` + fallback-to-empty-map pattern already present in every `Persisted*Repository` (§1.1) — app degrades to "no local data" rather than crashing, already logs via `console.error` | Potentially real (pre-existing local-storage-layer risk, not introduced by sync) | Cloud restore (§14) becomes the recovery path if this ever happens post-Phase-2 | Possibly (may need to trigger a restore) | Parse-failure event (already logged today, no content) |
| 11 | App reinstalled | §14 restore flow | None if backed up before reinstall; local-only (never-backed-up) data is genuinely lost on reinstall — this is exactly why the account-offer UX (§4) exists | Pull is idempotent (§14) | Yes (sign in, choose to restore) | N/A |
| 12 | Two devices edit the same Saved Meal | §9 conflict rule (revision-based LWW, delete beats edit) | Whichever edit didn't "win" is not merged, by design (LWW is the accepted tradeoff for this domain, §9) | Idempotent per revision | No | Conflict-resolved event (which side won, no content) |
| 13 | One device edits while another deletes | §9: delete wins | The edit's content doesn't survive, by design; the edit exists in the Correction Log for audit | Idempotent | No | Conflict-resolved event |
| 14 | Wrong-account login (e.g. typo'd into someone else's test account) | Standard first-login flow (§13) applies exactly as for any other account — RLS guarantees no cross-account data leakage regardless | None to the *other* account's data (RLS-enforced); the user's own local data follows §13's normal state-machine branches | N/A | User realizes and logs out/into the correct account | N/A |
| 15 | Logout with unsynced changes | §10: offered explicit "keep on this device" vs "remove from this device"; unsynced changes are not silently discarded by the logout action itself | Only if the user explicitly chooses "remove from this device" while changes are still unsynced — the UI must surface „Änderungen ausstehend" *before* offering that choice so the user isn't discarding data unknowingly | N/A | Yes (explicit choice) | N/A |
| 16 | Account deleted from another device | This device's session is revoked; next operation fails with an auth error, surfaced as „Kontoaktion erforderlich" rather than a generic crash | The account's cloud data is gone (that was the point); this device's local cache is unaffected until the user acts | N/A | Yes (acknowledge, decide what to do locally) | Auth error code |
| 17 | Schema version changes while one device is old | Additive-only server schema changes (§20) mean an older client simply ignores new optional fields it doesn't understand; no hard failure | None, if the additive-backward-compatibility rule (§20) is followed | N/A | No | Schema-version mismatch (diagnostic), if ever tracked |
| 18 | Large Journal history initial upload | Progress indicator (§14-style); app remains usable for new logging concurrently | None — batched, resumable | Must be batched with per-batch idempotency keys, not one giant all-or-nothing request | No | Batch progress (count only) |
| 19 | Partial batch failure | Only the failed batch retries; already-applied batches are not re-sent (idempotency) | None beyond a delay | Per-batch idempotency key (§10) | No | Batch failure reason |
| 20 | Clock skew (device clock wrong) | No correctness impact on conflict resolution, because §9/§10 use server-assigned revision, not client timestamp, as the tie-breaker; only *display* of "last changed X ago" could look odd | None | N/A | No | N/A |

(20 scenarios, meeting the "at least 20" requirement; several additional ones — e.g. token
refresh races, storage quota exhaustion — are implicitly covered by the same general
mechanisms above rather than being enumerated as separate rows, to avoid inventing distinct
handling where the same rule already applies.)

---

## 22. Migration and compatibility

- **Are current local records migration-ready?** Mostly — `FoodEntry` already has a stable
  `id`, `createdAt`, and (for J-003-era records) `deletedAt`. Gaps: no `revision` field
  anywhere (new, server-assigned, doesn't require a local migration — only new records/edits
  going forward need to carry it once Phase 2 ships); `SavedMealTemplate` has no soft-delete
  (a real local gap, see Phase 0 in §23).
- **Do all durable records have stable IDs?** Yes, today, for every domain in §6 classified
  **A**. The ID *format* (§7) is recommended to change for new records only, not backfilled.
- **Are timestamps sufficient?** `createdAt`/`lastModifiedAt`/`updatedAt` already exist where
  needed; what's missing is a **server-authoritative** revision, which is new server-side
  state, not a local migration.
- **Are deleted records represented durably enough?** For Journal, yes (`deletedAt`). For
  Saved Meals, no — recommend adding local soft-delete to `PersistedSavedMealRepository`
  as a Phase 0 prerequisite (small, local-only change, testable without any network/auth
  involvement).
- **Is schema versioning already present?** Not in any explicit form (no version field found
  on any stored blob during this inspection). Recommend a lightweight local storage schema
  version marker as part of Phase 0 if any of the Phase 0 changes alter the serialized shape,
  so future local migrations have a documented starting point — flagged as a
  Phase-0-adjacent decision for whichever task implements the ID/soft-delete changes, not
  specified further here.
- **Which local migrations are prerequisites before auth?** None, strictly — auth (Phase 1)
  doesn't require any local data-shape change. The ID-format and Saved-Meal-soft-delete
  changes are prerequisites **before Phase 2 (backup)**, not before Phase 1 (auth shell).
- **Can account UI ship safely before sync?** Yes — this is exactly Phase 1's point: an
  account can exist and a user can be signed in with zero app-data sync implemented yet, as
  long as the UI never implies data is being backed up before Phase 2 actually ships that
  (ties back to §4's copy-accuracy constraint).
- **What happens when an older app version accesses newer cloud data?** Server schema must
  be additive-only (new nullable columns, never repurposed/removed columns) so an older
  client simply ignores fields it doesn't recognize — this is a hard constraint on how any
  future migration task is written, not merely a suggestion (see §21 scenario 17).
- **Is a sync protocol version required?** Not for MVP (Phase 2/3) given the additive-only
  schema constraint above makes it unnecessary in the near term; flagged as a future
  consideration only if a genuinely breaking protocol change is ever needed (not anticipated
  by anything in this plan).

---

## 23. Phased implementation roadmap

Each phase lists genuinely new, unused task IDs in a new `ACC-0xx` domain (continuing after
this task, `ACC-001`), small and independently reviewable, per the given constraint. No task
below is implemented by this plan — these are stubs for future Act tasks, subject to the
open release-boundary approval in §24 before Phase 2+ is greenlit.

### Phase 0 — Prerequisites (local-only, no auth/network needed, can start any time)

- **ACC-002 — Saved Meal soft-delete.** Add `deletedAt`/tombstone semantics to
  `SavedMealTemplate`/`PersistedSavedMealRepository`, mirroring the existing `FoodEntry`
  pattern. *Expected files:* `src/features/nutrition/domain/models/SavedMealTypes.ts`,
  `src/features/nutrition/infrastructure/repositories/PersistedSavedMealRepository.ts`,
  `src/features/nutrition/application/ports/SavedMealRepository.ts`, associated tests.
  Depends on: none.
- **ACC-003 — UUID/ULID record identity for new records.** Introduce a standards-based ID
  generator (UUIDv4 or ULID) for newly created records across Journal/Saved-Meals; existing
  record IDs are left untouched (additive, no backfill/rewrite). *Expected files:*
  `src/features/nutrition/infrastructure/RandomIdGenerator.ts` (or a new adjacent
  implementation selected by ID format), `src/features/goals/infrastructure/RandomIdGenerator.ts`,
  wiring in `container.ts`, associated tests. **Requires an explicit dependency decision**
  (a UUID/ULID library vs. a dependency-free implementation) — `package.json` is a protected
  file, so this task must either justify a new dependency explicitly or implement a
  dependency-free ULID/UUIDv4 generator. Depends on: none.
- **ACC-004 — Local sync-readiness fields (schema-only, no sync engine yet).** Add optional
  `revision`/`userId`/`syncStatus`-shaped fields to the local domain models (populated only
  once Phase 2 exists; harmless no-ops until then) so Phase 2 doesn't need a second local
  migration on top of Phase 0. *Expected files:* domain model files for
  `FoodEntry`/`SavedMealTemplate`/`MetabolismProfile`/`EffectiveGoals`, their
  `Persisted*Repository` serialize/deserialize methods, associated tests. Depends on:
  ACC-002, ACC-003 (so the new fields are added alongside, not as a third separate
  migration).

### Phase 1 — Optional authentication shell (completes P2-008, not a new port/use case)

- **ACC-005 — OAuth native wiring (app.json + dependencies).** Registers Apple/Google OAuth
  apps (external, non-code prerequisite carried over from P2-008), adds the deep-link
  scheme to `app.json`, adds `expo-web-browser`/`expo-apple-authentication`. *Expected
  files:* `app.json`, `package.json`/`package-lock.json` (both protected — explicit approval
  required), Supabase Auth dashboard config (external, not a repo file). Depends on: none
  (independent of Phase 0).
- **ACC-006 — Settings login/logout screen.** Presentation-layer screen using the existing
  `container.signInWithOAuthUseCase`/`AuthRepository.signOut()`, opens the OAuth URL via
  `expo-web-browser`, handles the redirect. *Expected files:* a new
  `src/presentation/features/account/` screen, navigation wiring, `docs/MANUAL_TESTING_GAPS.md`
  entry (UI change, headless environment). Depends on: ACC-005.
- **ACC-007 — Session-storage hardening decision.** Evaluate and, if approved, implement
  `expo-secure-store`-backed session persistence in place of Supabase's default AsyncStorage
  persistence. *Expected files:* `src/infrastructure/supabase/supabaseClient.ts`,
  `package.json` (protected — new dependency). Depends on: ACC-005. **Open decision — see
  §24** (whether this is required before Phase 2 ships to real users).

### Phase 2 — Authenticated backup/adoption (one-directional; the recommended MVP boundary, §3)

- **ACC-008 — Local outbox + idempotency key infrastructure.** New local-only durable outbox
  (no server calls yet) that records pending mutations with idempotency keys, per §8/§10.
  *Expected files:* a new port (e.g. `SyncOutboxRepository`) + `AsyncStorage`-backed
  implementation, wiring into the existing Journal/Saved-Meal use cases. Depends on: ACC-004.
- **ACC-009 — Server schema: `journal_entries`, `journal_corrections`, `saved_meals`,
  `saved_meal_items`, `user_body_profile`, `user_goal_settings`, `sync_mutations` (per §15),
  with RLS per §16.** *Expected files:* new `supabase/migrations/*.sql` (protected — explicit
  migration task authorization required, per SAFETY.md). Depends on: none (schema can be
  authored independent of client code, though it should land before ACC-010 needs it).
- **ACC-010 — Push path (outbox → authenticated upload → ack).** Wires ACC-008's outbox to
  ACC-009's schema via authenticated Supabase calls. *Expected files:* new infrastructure
  repository/service under `src/features/sync/` (new feature folder), tests. Depends on:
  ACC-006, ACC-008, ACC-009.
- **ACC-011 — First-login adoption flow (§13's state machine) + restore flow (§14).**
  *Expected files:* new use case(s) under `src/features/sync/application/`, presentation
  wiring in the account screen from ACC-006, `docs/MANUAL_TESTING_GAPS.md` entry. Depends on:
  ACC-010.
- **ACC-012 — Sync-status UX (§20 states).** *Expected files:* small presentation-layer
  additions to the account/settings area only (not the Journal, per the explicit
  no-noisy-icons constraint). Depends on: ACC-010.

### Phase 3 — Incremental synchronization (bidirectional; only after Phase 2 validated + §24 approved)

- **ACC-013 — Incremental pull (revision-keyed) + local merge/apply.** Depends on: ACC-009,
  ACC-010.
- **ACC-014 — Deletion propagation (tombstone pull + local soft-delete apply).** Depends on:
  ACC-013.

### Phase 4 — Multi-device conflict handling

- **ACC-015 — Domain-specific conflict rules (§9) implemented in the sync engine.** Depends
  on: ACC-013.
- **ACC-016 — `sync_devices` + device management UX.** Depends on: ACC-013.
- **ACC-017 — Optional Realtime hint integration (§8 Option F's optional layer).** Depends
  on: ACC-013.

### Phase 5 — Export and account deletion

- **ACC-018 — Local (offline-capable) export.** Depends on: none (can ship even before
  Phase 2, per §19's note that export doesn't strictly require an account).
- **ACC-019 — Authenticated export (server-side canonical copy).** Depends on: ACC-010.
- **ACC-020 — Account deletion flow (§19).** Depends on: ACC-009, ACC-010.

**Recommended smallest first release**: Phase 0 + Phase 1 + Phase 2 (ACC-002 through
ACC-012) constitutes the smallest product release that provides real, honestly-described
value ("Daten sichern") without claiming live multi-device sync before it's built and
validated — matching §3's recommendation.

---

## 24. Testing plan

- **Unit tests**: ID/revision generation and comparison; mutation/outbox entry
  serialization; per-domain conflict rules (§9) as pure functions; tombstone
  creation/application; retry/idempotency-key behavior; first-login adoption state machine
  (§13) as a pure state-transition function, independent of any real network call — matching
  this repository's existing pattern of testing pure decision/display logic without a render
  harness (e.g. `journalSubmitFeedback.ts`'s `deriveSubmitOutcome`, `SpeckAmbiguity.ts`'s pure
  helpers).
- **Repository/integration tests**: local transaction + outbox entry created together; push
  success and push failure paths against a fake Supabase client; pull/merge into local
  storage; duplicate mutation (same idempotency key) handling; edit/delete conflict
  resolution; logout/account-switch local-cache clearing (§7 item 6).
- **Supabase tests**: RLS isolation between two distinct authenticated users (cannot read/
  write each other's rows); ownership enforcement on INSERT (cannot forge another user's
  `user_id`); unauthenticated access denial; account deletion removing all owned rows.
  Following this repository's existing `mcp__Supabase__*`/`npm run verify:schema`-style
  tooling rather than inventing a new test harness.
- **End-to-end scenarios** (manual/device, given this environment's headless constraint):
  local-only use with no account; first login with pre-existing local data (§13 case 3);
  restore after reinstall (§14); two-device edits of the same Saved Meal (§9); offline-then-
  reconnect; logout with pending changes (§21 scenario 15); token expiration (§21 scenario
  7); account deletion (§19). Each should be logged in `docs/MANUAL_TESTING_GAPS.md` when the
  implementing task ships, per this repository's existing binding convention for
  UI-touching, headless-unverifiable changes.
- **Native tests** (device/simulator only, cannot run in this environment, same limitation
  P2-008 already documented): Google sign-in on Android; Apple sign-in on iOS; deep-link
  return handling; secure session persistence (if ACC-007 ships); EAS preview build OAuth
  behavior.
- No test in this plan requires exposure of real production credentials — RLS/ownership
  tests use test accounts created for that purpose, consistent with how Supabase-backed
  tests already work in this repository (e.g. `SupabaseUserAliasSource.test.ts`,
  `SupabaseResolverRunLogger.test.ts`).

---

## 25. ADR recommendations

Per this repository's convention (plan docs under `plans/`, no separate `adr/` directory
found — "ADR" in the existing ACC-001 ROADMAP entry means exactly this kind of focused plan
document), recommend the following as **separate, focused** future plan/ADR documents rather
than folding everything into one document, matching the repo's stated preference for
focused documents:

1. **Optional accounts / value-before-account** — codifying §3/§4 as a standing product
   decision record, referenced by every future ACC task instead of re-litigated per task.
2. **Local-first source of truth** — codifying §8's write/read path as the binding
   architecture rule for any future feature, not just sync.
3. **Backup-first vs. full-sync MVP boundary** — the single most consequential decision in
   this plan (§3/§12); deserves its own short decision record once §24's approval lands, so
   the "why" is preserved independent of this longer planning document.
4. **Stable record identity (UUID/ULID migration)** — §7/ACC-003's decision, small and
   self-contained enough to be its own record.
5. **Conflict-resolution model (per-domain, not blanket)** — §9, referenced by every future
   Phase 3/4 task.
6. **Tombstone/deletion strategy** — §11, shared by Journal and (newly) Saved Meals.
7. **Supabase Auth provider boundary (Google/Apple via Supabase)** — §17, once Phase 1
   ships, documenting what was actually verified against primary sources at that time (not
   speculated now).
8. **RLS ownership model** — §15/§16, once ACC-009's migration exists, documenting the
   actual shipped policies.

None of these are created by this task — they are recommended topics for the teams
implementing the corresponding phases in §23.

---

## 26. Risks and explicit out-of-scope

**Risks:**

- Shipping Phase 2 before the release-boundary decision (§24 open item) is formally approved
  risks building the wrong first slice — this plan treats the recommendation as advisory,
  not authorization to start Phase 2.
- The ID-format migration (ACC-003) and Saved-Meal soft-delete (ACC-002), while small, touch
  domain models used throughout the app — must be implemented with the same "minimal,
  additive, no behavior change for existing records" discipline demonstrated in this
  session's prior tasks (e.g. J-003's original soft-delete addition), not a broader refactor.
- Session-storage hardening (ACC-007) is a genuine security/UX tradeoff (native secure
  storage has its own platform quirks) that needs explicit approval before adding the
  dependency, per SAFETY.md's protected-file rules — flagged, not assumed.
- Legal/regulatory requirements around health data (§18) are not resolved by this plan and
  could constrain retention/export/deletion design in ways not yet known — Phase 5 in
  particular should not proceed without the legal review flagged in §18/§19.

**Out of scope** (restated from the task brief, confirmed not touched by this plan):
implementing authentication; configuring Google/Apple providers; creating Supabase tables;
writing RLS SQL; local DB migrations; building sync/outbox code; subscriptions/monetization;
social features; family accounts; clinician access; sharing health data with third parties;
image/file sync; analytics redesign; unrelated cleanup. Nothing in this document performs
any of the above — every schema/RLS/migration item above is explicitly a **future task
stub** (§23), not work done here.

---

## 27. Open decisions still requiring product approval

1. **The central release-boundary decision** (§3/§12/§24's trailing note): backup/restore
   first (recommended here) vs. proceeding directly to full bidirectional sync. This plan
   recommends backup-first but treats it as pending the user's explicit review, exactly as
   the user's own trailing note requests.
2. **Session-storage hardening** (§17/ACC-007): whether `expo-secure-store` is required
   before Phase 2 ships to real users, or whether Supabase's default AsyncStorage-backed
   session persistence is acceptable for the MVP.
3. **UUID vs. ULID vs. dependency-free implementation** for ACC-003 — a small technical
   choice, but one that adds or avoids a new dependency (protected file).
4. **Tombstone retention window** (§11) — exact number of days before server-side hard
   deletion of tombstoned records; not fixed in this plan.
5. **"Detach and keep a local-only copy" on account deletion** (§19 step 5) — pending legal/
   technical confirmation of whether this is safe to offer at all.
6. **Whether onboarding-completion state and app preferences (theme, reminders) ever become
   synced (class D in §6)** — explicitly deferred, not assumed either way.
7. **Whether "switch accounts without losing offline access to the cached first account's
   data" is ever a real requirement** (§7 item 6's alternative (b)) — the recommended MVP
   behavior (clear the cache on account switch) is simpler and is what this plan proposes
   absent evidence otherwise.
8. **Export of deleted/tombstoned records** (§19) — whether a "full history" export option is
   ever offered, versus only exporting current, non-deleted data.

---

## Summary for handoff

- **Recommended product boundary**: optional account, offered only after value is already
  delivered, never blocking any core flow (§3, §4).
- **Recommended sync architecture**: outbox + server-assigned revision + tombstones (Option
  D/F), with Realtime demoted to an optional later-phase hint, never the source of truth
  (§8).
- **Recommended first implementation task**: Phase 0's **ACC-002** (Saved Meal soft-delete)
  and **ACC-003** (UUID/ULID identity) — small, local-only, no auth/network dependency, and
  genuine prerequisites for everything after them.
- **All new task IDs and order**: ACC-002 → ACC-003 → ACC-004 (Phase 0) → ACC-005 → ACC-006 →
  ACC-007 (Phase 1, completes P2-008) → ACC-008 → ACC-009 → ACC-010 → ACC-011 → ACC-012
  (Phase 2, recommended MVP boundary) → ACC-013 → ACC-014 (Phase 3) → ACC-015 → ACC-016 →
  ACC-017 (Phase 4) → ACC-018 → ACC-019 → ACC-020 (Phase 5). Full detail and dependencies in
  §23.
- **Product decisions still requiring approval**: see §27, most notably the backup-first-vs-
  full-sync release-boundary decision the user has already flagged for a dedicated follow-up
  review.
