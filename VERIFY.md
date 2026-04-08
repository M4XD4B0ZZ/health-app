# HealthApp Verification Guide

## Governance Hinweis

Die hier definierten Verify-Regeln folgen der übergeordneten Governance-Definition in `SSOK.md`.

---

## DACH Data Strategy Verification Note

- Plausibility-basierte Bewertung statt Mittelwertbildung bei mehreren Quellen.
- Fokus auf einzelne Quellenbewertung und best match.

## 1 Verification Philosophy

HealthApp uses deterministic verification to ensure the repository remains stable and reproducible.

Every change must pass verification before being considered complete.

Verification must be:

- deterministic
- script-based
- runnable locally
- CI compatible

---

## 2 Verification Commands

Run verification commands in this order. All blocking checks must pass before marking a task done.

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

---

## 3 Local vs. CI Verification

**Local (before every commit):**

```bash
npm run lint
npm run typecheck
npm run verify
```

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

- `npm run verify` passes (lint + typecheck + format:check + tests)
- no type errors exist
- no lint errors exist
- edge verification passes if edge functions were changed

If any verification step fails:

- the change must not be committed
- the failure must be fixed first
- verification must pass completely before marking the task as done in ROADMAP.md

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
