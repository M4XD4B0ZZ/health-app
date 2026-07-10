# Dependency Hygiene Report (2026-07-10)

Read-only analysis per `VERIFY.md` §"Dependency Command Safety (CLINE-OPS-003)":
`npm audit` is read-only and allowed for inspection; `npm audit fix` / `npm audit
fix --force` require explicit approval and are **not** run here.
`package.json` / `package-lock.json` are unmodified by this task.

## 1. `npm audit` summary

```
27 vulnerabilities (1 low, 17 moderate, 7 high, 2 critical)
```

| Severity | Count | Packages |
| -------- | ----- | -------- |
| Critical | 2     | `handlebars`, `shell-quote` |
| High     | 7     | `@xmldom/xmldom`, `flatted`, `minimatch`, `picomatch`, `supabase`, `tar`, `ws` |
| Moderate | 17    | `@expo/*` family (cli, config, config-plugins, metro-config, prebuild-config), `brace-expansion`, `expo`, `expo-asset`, `expo-constants`, `expo-dev-client`, `expo-dev-launcher`, `expo-manifests`, `js-yaml`, `postcss`, `uuid`, `xcode`, `yaml` |
| Low      | 1     | `@babel/core` |

All 27 are **transitive** (none of our own source imports the vulnerable
package directly); they come in via two dependency trees:

### a) Non-major fixable (≈15 advisories, including both criticals)

`npm audit fix` (no `--force`) reports it can resolve: `handlebars`,
`shell-quote`, `@xmldom/xmldom`, `flatted`, `minimatch`, `picomatch`,
`supabase` (2.76.11 → 2.109.1, still 2.x), `tar`, `ws`, `js-yaml`, `yaml`,
`brace-expansion`, `@babel/core`, `@expo/prebuild-config`,
`expo-dev-launcher` — without bumping any package's major version.

### b) Requires major upgrade (`npm audit fix --force`)

The remaining ~12 advisories (the `@expo/*` family, `expo`, `expo-asset`,
`expo-constants`, `expo-dev-client`, `expo-manifests`, `postcss`, `uuid`,
`xcode`) only resolve via **`expo` 54.0.35 → 57.0.4** (and
`expo-dev-client` 6.0.21 → 57.0.5) — a two-major-version jump for the core
Expo SDK. This is exactly the kind of change CLINE-OPS-003 and
`.agent/config/protected-files.json` require a dedicated,
explicitly-approved dependency-migration task for (Expo major bumps
typically carry app-config/native-module breaking changes and need a real
device/simulator regression pass this headless environment cannot do).

## 2. Deprecated packages (from `npm install` warnings, independent of audit)

- **`eslint@8.57.1`** — end-of-life ("no longer supported"). Latest is
  `10.6.0`. A jump to ESLint 9/10 is a flat-config migration
  (`eslint.config.js` instead of `.eslintrc.*`), not a drop-in bump —
  needs its own task.
- **`glob@7.2.3`** and **`glob@9.3.5`** (both present transitively,
  pulled in by different dependency chains) — old major versions with
  publicized vulnerabilities per upstream's own deprecation notice.
  No direct dependency on `glob` in `package.json`; these come from
  transitive tooling deps and will move to current majors automatically
  once the packages requiring them (partly the `eslint`/`expo` chains
  above) are upgraded.
- **`inflight@1.0.6`** — deprecated, known memory leak; transitive via
  old `glob`.
- **`rimraf@3.0.2`** — deprecated (pre-v4).
- **`@humanwhocodes/config-array@0.13.0`**, **`@humanwhocodes/object-schema@2.0.3`**
  — deprecated, superseded by `@eslint/config-array` / `@eslint/object-schema`;
  resolves once ESLint is upgraded off 8.x.
- **`node-domexception@1.0.0`** — deprecated, suggests using the platform's
  native `DOMException`.

## 3. Non-npm-audit finding: `supabase` CLI postinstall breaks `npm install`

`npm install` (without `--ignore-scripts`) currently **fails** in this
environment: the `supabase` package's postinstall script tries to download
the `supabase` CLI binary from GitHub Releases and gets `403 Forbidden`
from the network proxy, then crashes with an unhandled gunzip error
instead of failing gracefully. This report was produced using
`npm install --ignore-scripts` to work around it. This is an environment
network-policy interaction, not something a dependency bump fixes, but the
crash-instead-of-clean-failure behavior is itself worth noting upstream
(or wrapping the postinstall in this repo if it becomes a recurring
friction point).

## 4. Recommendation (no action taken — approval required)

1. **Low-risk candidate:** run `npm audit fix` (non-force) in a dedicated,
   explicitly-approved dependency task, then run full `npm run verify` —
   this should clear both critical and most high-severity findings without
   touching Expo/ESLint majors.
2. **Separate, larger tasks (need explicit approval + real-device/simulator
   verification):**
   - Expo SDK 54 → 57 major upgrade (clears remaining moderate findings).
   - ESLint 8 → 10 major upgrade + flat-config migration.
3. Do not run `npm audit fix --force` inside a feature/governance/docs task
   — per CLINE-OPS-003 it must be its own scoped migration task with full
   verification.
