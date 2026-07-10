# Supabase

This directory holds the project's Supabase configuration, Edge Functions, and
SQL migrations.

- **`config.toml`** — Edge Function config. Each function that the app calls
  anonymously (no user JWT) has `verify_jwt = false`:
  [`food-off-search`](functions/food-off-search), [`food-usda-search`](functions/food-usda-search).
  Both entries must match a real subdirectory under `functions/` — the CLI
  reads this file when deploying/serving functions and applies the
  `verify_jwt` setting per function.
- **`functions/`** — Edge Function source + **[deployment guide](functions/README.md)**
  (linking the CLI, verifying remote schema, deploying with `--no-verify-jwt`,
  local guardrail/rate-limit testing).
- **`migrations/`** — SQL migrations, applied in filename (timestamp) order.

## Local Supabase CLI

Deploying and linking use the `supabase` CLI (`npx supabase ...`, see
[`functions/README.md`](functions/README.md)). In network-restricted sandboxes
the CLI's own binary download (`node_modules/supabase`'s postinstall, which
fetches a release tarball from GitHub) can be blocked, in which case
`npm install --ignore-scripts` gets the JS dependency graph without the CLI
binary; `npx supabase` (and thus `supabase start`) won't work until it's
installed with a non-restricted network path.
