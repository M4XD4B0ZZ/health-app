# Global Development Rules

*Hinweis: Diese Regeln sind Teil der operativen Roo-SSOK. Die übergeordnete Governance-Definition befindet sich in `SSOK.md`.*

## General Behavior
- Work in small, focused changes.
- Do not refactor unrelated code.
- Prefer modifying existing files over creating new ones.
- Avoid unnecessary abstractions.

## Code Style
- Follow existing project structure and conventions.
- Keep functions small and readable.
- Do not introduce new dependencies unless necessary.

## Safety
- Never expose secrets or environment variables.
- Never modify `.env` files.
- Never change configuration without explanation.

## Editing Discipline
- Read relevant files before editing.
- Avoid speculative changes.
- Only change what is required to solve the task.

## Architecture Awareness
- Respect the existing architecture.
- Do not break module boundaries.
- Keep separation between domain, infrastructure and UI layers.

## Performance
- Avoid expensive operations unless required.
- Prefer simple deterministic solutions over complex ones.

## Communication
- Explain reasoning briefly before making changes.
- Keep responses concise.