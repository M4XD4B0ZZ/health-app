# HealthApp

React Native (Expo) MVP for nutrition and recovery tracking, backed by Supabase Edge Functions.

---

## Architecture

- **Feature-First + Clean Architecture:** `src/features/nutrition`, `src/features/goals`, `src/features/auth`
- **Layers:** domain / application / infrastructure / presentation
- **Deterministic-first:** core logging pipeline uses no AI/LLM calls
- **Backend:** Supabase Edge Functions (`food-off-search`, `food-usda-search`)
- **UI:** React Native with Expo, Warm-Neutral design system (`src/ui/theme.ts`)

---

## Prerequisites

- Node.js v20+
- npm
- Android Emulator (Android Studio) or iOS Simulator (Xcode, macOS only)
- `.env` file with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Quick Start

```bash
npm install
npx expo start
```

Press `a` for Android, `i` for iOS, `w` for web.

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
