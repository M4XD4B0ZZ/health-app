# RESOLVER-V2-005 Discovery: Knowledge-Layer Schema Drift (2026-07-10)

## Goal

RESOLVER-V2-005 asks for new Supabase tables (`canonical_foods`, `food_source_items`,
`food_aliases`, `query_logs`, `corrections`) to persist resolver knowledge long-term.

## Finding: the knowledge layer is largely already live, undocumented

The remote project (`kbplfcqluqqowmvchvhc`) has 6 tables in `public`, but
`supabase/migrations/` only accounts for 2 of them:

| Live table                 | Migration file?         | Referenced by app/edge code?       |
| -------------------------- | ----------------------- | ---------------------------------- |
| `food_catalog_items`       | yes (20260215)          | yes                                |
| `food_query_cache`         | yes (20260215/20260322) | yes                                |
| `user_food_aliases`        | **no**                  | yes (`SupabaseUserAliasSource.ts`) |
| `food_sources`             | **no**                  | no                                 |
| `food_query_cache_results` | **no**                  | no                                 |
| `food_resolver_runs`       | **no**                  | no                                 |

The 4 undocumented tables (verified via the Supabase MCP connector: table/column definitions,
RLS policies, indexes) were created directly against the database at some point after the
20260215 migration — most likely through the Supabase Dashboard SQL editor, per the manual
fallback documented in `supabase/functions/README.md` — and never committed as a migration.

Additionally, `food_catalog_items.source` was originally a `CHECK (source IN (...))`
constraint (20260215 migration) but is now, live, a foreign key to `food_sources.id`. That
change is also undocumented drift, on a table that's already correct and in active use — not
touched by this task to avoid risking the working table.

## Mapping to RESOLVER-V2-005's requested schema

| DoD asks for        | Already exists as (different name)                                                                | Gap                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `canonical_foods`   | `food_catalog_items`                                                                              | none — already live, migrated, in use                           |
| `food_source_items` | folded into `food_catalog_items.source` + `.external_id` (per-item, not a separate mapping table) | design choice already made differently; not a gap per se        |
| `food_aliases`      | `user_food_aliases`                                                                               | none — already live, in use, just undocumented                  |
| `query_logs`        | `food_resolver_runs`                                                                              | table exists but **no code writes to it** (see RESOLVER-V2-006) |
| `corrections`       | —                                                                                                 | **genuinely missing**, live or otherwise                        |

## Action taken (human-approved scope)

Per explicit direction: document the drift, do not design a new/parallel schema under the
DoD's literal table names. Added
[`supabase/migrations/20260710_document_existing_knowledge_layer_tables.sql`](../supabase/migrations/20260710_document_existing_knowledge_layer_tables.sql)
— an idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`) migration that reconstructs
exactly what's live for the 4 undocumented tables (columns, constraints, indexes, RLS
policies), verified column-by-column and policy-by-policy against the live project via the
Supabase MCP connector. It is a no-op against the current remote project and a correct
from-scratch script for a fresh/local database. **Not applied to the remote project by this
task** — the tables already exist there; applying the migration (`supabase db push` or the
Supabase MCP's `apply_migration`) is left as a deliberate follow-up, since running DDL against
production is out of scope for a "document what exists" task.

## Still open (not done by this task)

- No `corrections` table (user feedback on resolver decisions) — needs its own scoped
  design + migration task.
- `food_resolver_runs` is not written to by any app or edge function code — RESOLVER-V2-006
  ("every resolution creates DB entries") is a real, separate implementation task, not just
  documentation.
- Whether to keep `food_catalog_items`/`user_food_aliases`/`food_resolver_runs` as the
  permanent names (recommended — they're live and working) vs. renaming to the DoD's literal
  names is a decision worth reflecting explicitly in `ROADMAP.md`'s task text at some point,
  so future readers don't re-discover this same drift.
