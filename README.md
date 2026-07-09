# HealthApp

React Native (Expo) MVP for nutrition and recovery tracking, backed by Supabase Edge Functions.

---

## Architecture

- **Feature-First + Clean Architecture:** `src/features/nutrition`, `src/features/goals`, `src/features/auth`
- **Layers:** domain / application / infrastructure / presentation
- **Hybrid Input System:**
  - Natural Language First (user input layer)
  - Deterministic Processing (core nutrition pipeline)

- **Backend:** Supabase Edge Functions (`food-off-search`, `food-usda-search`)
- **UI:** React Native with Expo, Warm-Neutral design system (`src/ui/theme.ts`)

---

## Input Philosophy

- Users can log food using natural language (no structured input required)
- System prioritizes low friction over perfect accuracy
- Inputs are parsed and mapped to deterministic nutrition data sources
- Users can quickly correct entries after logging

---

## Prerequisites

- Node.js v20+
- npm
- Android Emulator (Android Studio) or iOS Simulator (Xcode, macOS only)
- `.env` file with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## MCP Servers

This repo defines a project-scoped Supabase MCP server in [`.mcp.json`](.mcp.json) (read-only by
default, consistent with this repo's DB-safety governance in `.governance/SAFETY.md`). To use it:

1. Create a personal access token at https://supabase.com/dashboard/account/tokens
2. Find the project ref under Project Settings > General ("Reference ID")
3. Export both before starting your Claude Code session (`.mcp.json` reads process env vars, not `.env`):
   ```bash
   export SUPABASE_ACCESS_TOKEN=...
   export SUPABASE_PROJECT_REF=...
   ```

Remove `--read-only` from `.mcp.json` only with explicit approval — it exists to keep the MCP server
from performing writes/migrations outside the governance gates in `.governance/SAFETY.md`.

---

## Quick Start

```bash
npm install
npx expo start
```

Press `a` for Android, `i` for iOS, `w` for web.

---

## Android Development Build

Android development uses an Expo Dev Client build instead of Expo Go.

First-time native install/build:

```bash
npx expo run:android
```

Daily dev-client Metro:

```bash
npx expo start --dev-client
```

Clear dev app data:

```bash
adb shell pm clear com.nutritiondev.local
```

Clear Metro cache:

```bash
npx expo start --dev-client --clear
```

Once the dev client is installed, Expo Go is no longer the recommended Android test path.

---

## Key Commands

| Command               | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `npm run lint`        | ESLint check                                   |
| `npm run typecheck`   | TypeScript type check                          |
| `npm run test`        | Run Jest tests                                 |
| `npm run verify`      | Full local verification (lint + types + tests) |
| `npm run verify:edge` | Smoke test remote Supabase Edge Functions      |
| `npm run doctor`      | Environment health check                       |
| `npm run deploy:edge` | Deploy Edge Functions to Supabase              |

---

## Governance

| File         | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `ROADMAP.md` | Single Source of Knowledge — all tasks and epics       |
| `VERIFY.md`  | Canonical verification commands and Definition of Done |
| `AGENTS.md`  | Agent and contributor governance rules                 |

All contributors and agents must read `ROADMAP.md` and `VERIFY.md` before starting work.
