# HealthApp Verification Guide

## Governance Hinweis

Die hier definierten Verify-Regeln folgen der übergeordneten Governance-Definition in `SSOK.md`.

## Verification Authority

`VERIFY.md` ist die **kanonische Entscheidungsquelle** für:

- required checks
- optional checks
- blocking checks
- Definition of Done (verification-bezogen)

Andere Governance-Dokumente sollen Verify-Verhalten referenzieren (auf `VERIFY.md` verweisen), nicht parallel neu definieren.

---

## DACH Data Strategy Verification Note

- Plausibility-basierte Bewertung statt Mittelwertbildung bei mehreren Quellen.
- Fokus auf einzelne Quellenbewertung und best match.

## 1 Verification Philosophy

HealthApp uses deterministic verification to ensure the repository remains stable and reproducible.

Every change must pass verification before being considered complete.

For **documentation-only / governance-only** tasks (for example edits limited to `*.md`, `docs/`, `reports/`, `handoffs/`), use task-relevant readback checks instead of full product/runtime verification.

Verification must be:

- deterministic
- script-based
- runnable locally
- CI compatible

### Canonical Verification Decision Table

> Ziel: **keine Verhaltensänderung**, sondern eindeutige Autorität und reproduzierbare Entscheidungslogik.

| Category | Scope/Trigger | Required checks | Optional checks | Blocking checks |
| --- | --- | --- | --- | --- |
| 1) Documentation-only | Änderungen nur an Doku-Dateien (z. B. `*.md`, `docs/`, `reports/`, `handoffs/`) ohne Runtime-/Test-/Infra-Code | `git --no-pager status --short`<br>`git --no-pager diff --stat`<br>`git --no-pager diff --name-only` | `npm run verify` (nur wenn zusätzlicher Sicherheits-/Vertrauensbedarf besteht) | Alle required readback checks müssen erfolgreich und vollständig dokumentiert sein |
| 2) Governance-only | Änderungen nur an Governance-/Policy-Texten (z. B. `AGENTS.md`, `SSOK.md`, `.governance/*.md`, `VERIFY.md`) ohne Runtime-/Test-/Infra-Code | `git --no-pager status --short`<br>`git --no-pager diff --stat`<br>`git --no-pager diff --name-only` | `npm run verify` (nur falls im Task explizit gefordert) | Alle required readback checks müssen erfolgreich und vollständig dokumentiert sein |
| 3) Test-only | Änderungen nur in Testdateien/-fixtures (keine Produkt-/Infra-Logik) | Task-relevante Tests (z. B. `npm run test -- --runTestsByPath <path>`)<br>`git --no-pager status --short`<br>`git --no-pager diff --stat`<br>`git --no-pager diff --name-only` | `npm run test` (gesamte Suite)<br>`npm run verify` | Alle ausgeführten required Tests müssen pass sein; bei gefordertem `npm run verify` ist dieses ebenfalls blocking |
| 4) Product/runtime code | Änderungen an App-/Domain-/Application-/UI-/Infra-Runtime-Code | `npm run verify` | `npm run lint`<br>`npm run typecheck`<br>`npm run test`<br>`npm run doctor` | `npm run verify` muss pass sein |
| 5) Edge/Supabase | Änderungen an Supabase Edge Functions / edge-relevanter Integration | `npm run verify:supabase:link`<br>`npm run verify:schema`<br>`npm run verify:edge`<br>zusätzlich `npm run verify` bei Runtime-Code-Änderungen | `npm run typecheck:functions`<br>`npm run doctor` | Alle required edge checks müssen pass sein; falls Runtime-Code mitgeändert wurde, zusätzlich `npm run verify` pass |
| 6) Dependency changes | Änderungen an `package.json` / `package-lock.json` (nur wenn Task explizit erlaubt) | `npm run verify`<br>zusätzlich task-spezifische Regressionstests in betroffenen Bereichen | `npm run doctor`<br>`npm audit` (read-only) | `npm run verify` muss pass sein; alle task-spezifisch required Regressionstests müssen pass sein |

### Category Resolution Rule

- Wenn mehrere Kategorien gleichzeitig zutreffen, gilt die **strengste Kombination** der required/blocking checks.
- Bei Konflikten mit Sekundärdokumenten gilt immer dieses Dokument (`VERIFY.md`) als Entscheidungsautorität.
- Sekundärdokumente dürfen zusätzliche Hinweise geben, aber keine widersprüchlichen Verify-Entscheidungen definieren.

---

## 2 Verification Commands

Run verification commands in this order **when full runtime verification is required by the decision table above**. All blocking checks must pass before marking a task done.

```bash
npm run lint
npm run typecheck
npm run verify
npm run verify:edge
```

### Command reference

| Command                        | Purpose                                              | Blocking | When to run                  |
| ------------------------------ | ---------------------------------------------------- | -------- | ---------------------------- |
| `npm run lint`                 | ESLint — code style and static error checks          | yes      | every change                 |
| `npm run typecheck`            | TypeScript — no-emit type safety check               | yes      | every change                 |
| `npm run test`                 | Jest — unit and integration tests                    | yes      | every change                 |
| `npm run verify`               | Runs lint + typecheck + format:check + test combined | yes      | before marking task done     |
| `npm run verify:edge`          | Remote Supabase Edge Function smoke tests            | yes      | after edge deploys           |
| `npm run verify:supabase:link` | Confirms CLI is linked to correct Supabase project   | yes      | before edge deploys          |
| `npm run verify:schema`        | Confirms required DB tables exist on remote          | yes      | before edge deploys          |
| `npm run typecheck:functions`  | Deno typecheck for Supabase Edge Functions           | yes      | when editing edge functions  |
| `npm run format:check`         | Prettier format check (included in verify)           | yes      | included in `npm run verify` |
| `npm run doctor`               | Environment and dependency health check              | no       | on setup / debugging         |

> `npm run build` — **TODO:** No standalone build script exists yet. Expo build is handled via `expo build` / EAS. Add a `build` script to `package.json` when CI build pipeline is introduced.

### Dependency Command Safety (CLINE-OPS-003)

- `npm install` is allowed only when explicitly required to restore missing local dependencies.
- `npm audit` is read-only and allowed for inspection only.
- `npm audit fix` requires explicit approval.
- `npm audit fix --force` is forbidden during scoped tasks unless a dedicated dependency-migration task is approved.
- Any `package.json` / `package-lock.json` change is out of scope unless the task explicitly allows dependency changes.

#### Incident rationale

- `npm audit fix --force` can perform SemVer-major upgrades and large lockfile rewrites.
- It must not be mixed into feature/test/governance tasks.

#### Recovery rule for accidental dependency drift

If package files drift accidentally:

1. stop,
2. restore `package.json`,
3. restore `package-lock.json`,
4. rerun `npm install`,
5. rerun the narrow relevant test,
6. document the incident.

---

## 3 Local vs. CI Verification

**Local (before every commit):**

```bash
npm run lint
npm run typecheck
npm run verify
```

For documentation-only tasks, minimum required checks are (Category 1 in the decision table):

```bash
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

Use full product verification (`npm run verify`) when product/runtime code changes (Category 4). If edge/supabase functions change, run edge-specific verification per Category 5.

Run `npm run verify:edge` only when Supabase Edge Functions were changed and `.env` is available with valid credentials.

**CI:**

CI must run at minimum:

```bash
npm run verify
```

Edge verification (`verify:edge`) requires environment secrets and should run as a separate CI job with protected env vars.

---

## 4 Edge Function Verification

Requires `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

```bash
npm run verify:supabase:link
npm run verify:schema
npm run verify:edge
```

`verify:edge` confirms:

- `food-off-search` endpoint returns 200 for valid query, 400 for invalid query
- `food-usda-search` endpoint returns 200 for valid query, 400 for invalid query

---

## 5 Definition of Done

A task is complete only when:

- all **required checks** from the canonical decision table pass
- if Category 4 applies: `npm run verify` passes (lint + typecheck + format:check + tests)
- no type errors exist
- no lint errors exist
- edge verification passes if edge functions were changed

If any verification step fails:

- the change must not be committed
- the failure must be fixed first
- verification must pass completely before marking the task as done in ROADMAP.md

Handoff requirement (always):

- final handoff must explicitly state which checks were run and why (including when a docs-only check set is used)

## Input Parsing Verification

- Input parsing layer may be non-deterministic

- Verification applies ONLY to:
  - final structured output
  - API responses
  - database integrity

- Parsing correctness is evaluated by:
  - test cases (expected mappings)
  - confidence scoring behavior

- Non-deterministic parsing MUST NOT break:
  - type safety
  - API contracts
  - database schema

---

## Resolver V2 Verification

### Multi-Source Fusion Verification

Spezifische Verifikation für die neue Resolver V2 Multi-Source Fusion Architecture:

```bash
# Resolver-spezifische Tests
npm run test -- --testPathPattern="resolver|Resolver"
npm run test -- --testPathPattern="SequentialFoodCatalogResolver"
npm run test -- --testPathPattern="MultiSource|Fusion"
```

### Resolver V2 Compliance Checks

Vor dem Abschluss von Resolver V2 Tasks:

- [ ] **No Early Translation**: Input erreicht alle Quellen unübersetzt
- [ ] **Source-Native Queries**: Verschiedene Queries pro Quelle in Logs sichtbar
- [ ] **Multi-Source Candidates**: Kandidaten von mehreren Quellen gesammelt
- [ ] **Fusion Layer**: Cross-Source Ranking funktioniert
- [ ] **Knowledge Persistence**: Supabase speichert Entscheidungen
- [ ] **AI Rate Limiting**: AI-Nutzung ist begrenzt und geloggt

### Resolver Debug Verification

```bash
# Debug-Logs für Resolver-Verhalten
npm run test -- --testPathPattern="resolver.*debug" --verbose
```

### Performance Verification

```bash
# Resolver-Performance innerhalb Budget
npm run test -- --testPathPattern="resolver.*performance"
```

**Resolver V2 Definition of Done:**

Ein Resolver V2 Task ist nur dann abgeschlossen, wenn:

- Standard-Verifikation (`npm run verify`) erfolgreich
- Resolver-spezifische Tests bestehen
- Debug-Logs zeigen erwartetes Multi-Source-Verhalten
- Performance bleibt innerhalb definierter Budgets
- Keine Regression in bestehenden Resolver-Tests
