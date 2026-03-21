# HealthApp Context Map

## Project Purpose

HealthApp is a modular health and nutrition application focused on:

- nutrition logging
- recovery / sleep / steps
- dashboard and goals
- deterministic-first calculations
- AI only when needed

The project prioritizes:

- trust
- low AI cost
- deterministic logic
- clean architecture
- modular growth

---

## Architecture Principles

- Follow clean architecture.
- Keep domain logic independent from UI and infrastructure.
- Prefer feature-first organization inside the clean architecture.
- Do not move logic across layers without good reason.
- Deterministic calculations should stay deterministic and must not be replaced by LLM logic.

---

## Important Product Rules

- Dashboard should remain AI-free.
- AI should only be used on uncertainty, parsing, or natural-language assistance.
- Nutrition calculations must be deterministic whenever possible.
- User trust is more important than cleverness.
- Favor editability, transparency, and confidence over automation magic.

---

## Main Areas

Typical project areas may include:

- `src/domain/` for business entities and pure logic
- `src/application/` or `src/usecases/` for use cases
- `src/infrastructure/` for external services, adapters, APIs, storage
- `src/presentation/` or `src/ui/` for screens, components, view models
- `src/features/` for feature-first organization where applicable

If the real repo differs, always follow the actual repo structure over this document.

---

## High-Priority Domains

The most important conceptual areas in this project are:

- nutrition logging
- journal / daily overview
- goals and metabolism
- saved meals
- reminders
- health integrations
- settings
- trust / confidence / editability layer
- food catalog / resolver / ranking

---

## Editing Rules

- Prefer focused edits over broad refactors.
- Read surrounding files before changing architecture-sensitive code.
- Reuse existing patterns before introducing new ones.
- Do not create parallel patterns if one already exists.
- Do not introduce new dependencies unless clearly necessary.

---

## AI / Cost Rules

- Use deterministic logic first.
- Do not call AI for pure calculations.
- Keep prompts and context compact.
- Avoid adding verbose explanations in code or responses unless requested.
- Prefer reusable structures and caches over repeated expensive work.

---

## Trust / Data Handling

- Never expose secrets.
- Never include `.env` content in responses.
- Avoid touching sensitive local data, exports, backups, or databases.
- Health-related user data should be treated conservatively.

---

## How to Work in This Repo

When working on tasks:

1. First identify the feature/module involved.
2. Read only the minimal relevant files.
3. Respect architecture boundaries.
4. Make the smallest viable change.
5. Avoid unrelated cleanup unless requested.
6. Summarize changes briefly and concretely.

---

## If Unsure

If architecture is ambiguous:

- inspect existing nearby files
- infer the dominant pattern from the repository
- follow existing conventions
- avoid speculative redesign
