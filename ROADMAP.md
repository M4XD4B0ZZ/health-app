# ROADMAP.md  
Health App – Master Roadmap (SSOK Controlled)

Status: Active  
Architecture: Clean Architecture + Deterministic-First Nutrition Engine  
UI State: Warm-Neutral Light-Only MVP Skin Implemented  
Default Mode: Action Mode (Protokoll / Natural Language Logging)

## SSOT Rules
- **ROADMAP.md is the Single Source of Truth (SSOT).**
- It contains the authoritative master plan with stable task IDs.
- Every task must have a Definition of Done and verify gates (typecheck/test/build).
- No background async work is permitted; all tasks must be explicit, ordered, and measurable.

## Current Status
- **Supabase Edge Functions 401 "Invalid JWT" Fix:** Complete.
  - Root cause: Supabase Edge Functions default to `verify_jwt=true`, but the app uses an anon key (not a user JWT).
  - Fix: Added debug logging for Supabase client, unified Edge Function calls to use the `supabase.functions.invoke` singleton instead of manual `fetch` with header injection, and added `supabase/config.toml` to set `verify_jwt=false` for `food-usda-search` and `food-off-search` to allow anon access.

## Decisions
- **Anon vs. Auth for Functions:** Food search functions are anon for the MVP (`verify_jwt=false`) but require strict guardrails.
- **AI Endpoints gating:** AI endpoints will *never* be anon. They must be strictly JWT + subscription/entitlement required.

---

# ROADMAP RESET — FUNCTIONAL CORE FIRST

Aktueller Zustand laut Screens:
- Parsing falsch
- Multi-Item Struktur kaputt
- Resolver greift nicht
- Makros = 0
- Review Flow erzwingt Confirm
- Debug-Texte sichtbar
- Default Tab falsch
- Core Logging nicht vertrauenswürdig

**Das ist kein Stabilisieren. Das ist: Core funktioniert noch nicht.**
Also hören wir auf mit „Sprint 2“, „Trust Layer“, „Premium Feel“.
Wir gehen zurück zu: **PHASE 0 — CORE MUSS ÜBERHAUPT FUNKTIONIEREN**

---

# PHASE 0 — LOGGING MUST WORK

## P0-001 Disable Multi-Item Structuring
Status: SOFORT

- Temporär Multi-Item AI-Strukturierung deaktivieren.
- Kein „AI structured multi-item meal“ Text mehr.
- Keine künstliche Aufteilung, solange deterministic parser nicht sauber ist.

**Ziel:** Ein einzelnes Item sauber durch Pipeline bekommen.

---

## P0-002 Single Item → Resolver → Makros Pipeline
Status: SOFORT

Minimal funktionierende Kette:
1. Input: "ei"
2. Pipeline:
   - Raw Input
   - Deterministic normalization
   - Resolver call
   - USDA/OFF match
   - Makros berechnen
   - Journal speichern
   - SummaryBar aktualisieren

- Kein Review Modal.
- Kein Confirm All.
- Kein Fancy Layer.

**Nur:** Input → echtes Essen → echte kcal.

**Gate:** 5 einzelne Lebensmittel liefern korrekte Makros.

---

## P0-003 Remove Review Modal Completely (Temporary)
Status: SOFORT

- Review Entries deaktivieren.
- Confirm All entfernen.
- Direkt speichern nach erfolgreichem Match.
- Falls kein Match → Fehlermeldung.

**Ziel:** Flow verkürzen. Fehlerquellen reduzieren.

---

## P0-004 Zero-Macro Blocker
Status: SOFORT

- Wenn: `kcal == 0`
- Dann:
  - Speichern blockieren.
  - Fehler anzeigen.
  - Kein Success-Status.

---

## P0-005 Hard Default to Protokoll Tab
Status: SOFORT

- Protokoll = Tab 1
- `initialRouteName` = Protokoll
- App startet im Input
- Kein Dashboard zuerst.

---

## P0-007 Proof-of-Call Tracing (Gate)
Status: ACTIVE

- Definition of Done:
  - PROOF UseCase entered
  - PROOF ABOUT_TO_RESOLVE
  - PROOF RESOLVER_CALLED with sourceCount>0
  - PROOF OFF_SOURCE_CALLED and USDA_SOURCE_CALLED
  - Either candidates>0 OR explicit HTTP status/error logged

---

# ERST WENN P0 STABIL IST:

Dann:

## PHASE 1 — Deterministic Multi-Item Parsing

- Split bei “und”, “mit”, “,”
- Zahlwörter normalisieren
- Pro Item Resolver erzwingen

## EPIC: Resolver & Normalization

### [x] P1-001 Deterministic DE->EN Localization Alias Layer
- **Description:** Implement a deterministic step mapping common DE foods directly to EN equivalents for USDA source only. OFF targets original text.
- **Acceptance Criteria:** Fast, small mapping table without LLM latency.
- **Verify Steps:** Unit test for DE mapping passes (`npm run test`), returning candidates for `ei` in manual app testing.

---

# PHASE 2 — GUARDRAILS, AUTH & SUBSCRIPTION

## EPIC: Supabase Foundation

### P2-001 Verify Environment Wiring
- **Description:** Ensure that `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are strictly verified.
- **Acceptance Criteria:** App throws a fatal error immediately on boot if variables are missing.
- **Verify Steps:** `npx tsc --noEmit` and run `npm run test` validating the environment checks.

### P2-002 Enforce Single Supabase Client
- **Description:** Prevent any creation of new `createClient` instances globally. Find and replace all manual fetches.
- **Acceptance Criteria:** `supabaseClient.ts` is the single source of truth. No manual `fetch` calls to `/functions/v1/` exist.
- **Verify Steps:** Run `npm run lint` and global search for `fetch(` targeting Supabase URLs (must yield 0 results).

### P2-003 Document Edge Functions Deploy Process
- **Description:** Ensure `supabase/config.toml` is respected in deployment and `verify_jwt=false` is safely applied.
- **Acceptance Criteria:** Provide a README section in `/supabase` on how to run `supabase functions deploy` with proper config.
- **Verify Steps:** Local `supabase start` properly parses the `config.toml` and allows anonymous invokes.

## EPIC: Edge Guardrails (Food Search)

### [x] P2-004 Query-length Guard and Sanitization
- **Description:** Implement a hard limit on food search query lengths and sanitize input.
- **Acceptance Criteria:** Queries > 64 chars or containing special exploits are blocked at the Deno Edge function level.
- **Verify Steps:** Local `README.md` curl examples verifying 400 Bad Request on invalid queries.

### [x] P2-005 Rate Limiting
- **Description:** Implement basic rate limiting (IP/device based for anonymous, user-based later).
- **Acceptance Criteria:** Unauthenticated users cannot span > 30 requests per minute to `food-search`.
- **Verify Steps:** Local `README.md` bash loop test asserting rate limit 429 Too Many Requests.

### [x] P2-006 Abuse Logging & Observability
- **Description:** Log blocked requests (rate limit / guardrails) with `traceId` and user context.
- **Acceptance Criteria:** Structured logging is implemented for edge functions allowing easy tracking in Supabase Log Explorer.
- **Verify Steps:** Check `npx supabase functions serve` logs for structured JSON output (`ABUSE_DETECTED`).

### [ ] P2-007 Deploy & Verify Guardrails
- **Description:** Ensure new guardrails are deployed with correct `verify_jwt=false` properties.
- **Acceptance Criteria:** App calls remote endpoints anonymously, hitting `food-off-search` and `food-usda-search` without 401s.
- **Verify Steps:** 
  1. `npm run verify:supabase:link` must pass to ensure CLI targets correct remote project.
  2. Tables must exist on remote Database. Pass `npm run verify:schema`. 
     *(Docker optional; Remote schema applied via SQL Editor Docker-free is accepted).*
  3. `npm run deploy:edge:verify` must pass, ensuring `--no-verify-jwt` was used and remote APIs return 200/400.

## EPIC: Auth & Subscription (Later)

### P2-007 Apple/Google Login via Supabase Auth
- **Description:** Introduce user authentication to replace anon-only access.
- **Acceptance Criteria:** User can login via OAuth. App retrieves a valid Supabase JWT and stores it securely.
- **Verify Steps:** Device tests for login flow; `npx tsc --noEmit`.

### P2-008 RevenueCat Entitlements
- **Description:** Integrate RevenueCat (or similar) to manage subscription states.
- **Acceptance Criteria:** `isPro` state is securely synced from RevenueCat to Supabase `public.users` via Webhooks.
- **Verify Steps:** Simulate RevenueCat webhook in Supabase and observe user tier updates.

### P2-009 Paid-only Gating for AI Endpoints
- **Description:** Map `isPro` tier to Edge Function authorization.
- **Acceptance Criteria:** AI structured log functions and premium insights return 403 Forbidden for non-Pro users.
- **Verify Steps:** Write Edge Function tests asserting 403 when JWT has no PRO claim.

---

# AKTUELLER FOKUS

**Nicht:**
- Confidence
- UX Polishing
- Warm Neutral Feinschliff
- Goals
- Insights
- Health Sync

**Nur:** Core Logging Pipeline.

### Definition von „funktioniert“

Wenn diese 5 Inputs korrekt funktionieren, ohne Review, ohne 0 kcal:
1. `ei`
2. `zwei eier`
3. `200g quark`
4. `buttertoast`
5. `zwei scheiben schinken`

Erst dann reden wir über Multi-Item.
