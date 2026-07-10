# RALPH-042B Sandbox Queue Entry Lifecycle Schema Probe Report

## Base Context

- Task: RALPH-042B Sandbox Queue Entry Lifecycle Schema Probe
- Base commit required by task: `7ef4dc3 chore(roadmap): register queue lifecycle schema probe`
- Scope: isolated sandbox lifecycle schema and validators for sandbox queue-entry artifacts only.
- Non-scope: no lifecycle engine, no lifecycle execution, no queue admission, no worker/task execution, and no canonical runtime/evidence/review/handoff mutation.

## Lifecycle States

Allowed sandbox lifecycle states:

- `draft`
- `admission_previewed`
- `write_planned`
- `sandbox_written`
- `readback_verified`
- `evidence_bundled`
- `awaiting_human_review`
- `blocked`

## Forbidden States

Forbidden lifecycle states rejected by the probe:

- `queued`
- `canonical_queued`
- `ready_to_execute`
- `executing`
- `worker_executing`
- `task_executing`
- `runtime_mutated`
- `evidence_mutated`
- `review_accepted`
- `validation_passed`
- `task_done`
- `commit_ready`
- `committed`
- `pushed`
- `deployed`
- `production_ready`
- `approved`
- `merged`
- `released`

## Allowed Transitions

- `draft -> admission_previewed`
- `admission_previewed -> write_planned`
- `write_planned -> sandbox_written`
- `sandbox_written -> readback_verified`
- `readback_verified -> evidence_bundled`
- `evidence_bundled -> awaiting_human_review`
- Any allowed non-terminal state may transition to `blocked`.

Blocked recovery rule:

- `blocked -> draft` is refused unless `human_authorized_recovery: true` is supplied.
- Even with `human_authorized_recovery: true`, validator output remains advisory and non-authoritative.

## Validation Rules

- Unknown lifecycle states are rejected.
- Forbidden lifecycle states are rejected.
- Invalid transitions are rejected.
- Skipped transitions are rejected.
- Metadata must include `sandbox: true`.
- Metadata must include `non_authoritative: true`.
- Metadata must include `lifecycle.state`.
- Metadata must include a `non_authoritative_statement` containing `non-authoritative` and no execution/authority terms.
- Metadata rejects forbidden authority claims for queue execution, worker execution, task execution, runtime authority, evidence mutation, review acceptance, validation pass, task completion, staging, commit, push, deploy, dependency install, network access, product work, and canonical queue admission.

## Test Results

Required focused checks passed:

- `node --check scripts/agent/lib/sandbox-queue-entry-lifecycle.mjs` — PASS
- `node --test scripts/agent/__tests__/sandbox-queue-entry-lifecycle.test.mjs` — PASS, 14 tests passed, 0 failed

## Safety Boundaries

- The lifecycle module is an isolated validation helper.
- It does not import file-system APIs.
- It does not write sandbox or canonical artifacts.
- It does not modify `.agent/overnight/**`, `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- It does not modify product, package, Supabase, or governance files.
- It does not stage, commit, push, deploy, install dependencies, format, fix, or access the network.

## No-Authority Assertions

All validator result objects assert the following flags as `false`:

- `queue_execution`
- `worker_execution`
- `task_execution`
- `runtime_authority`
- `evidence_mutation`
- `review_mutation`
- `validation_mutation`
- `canonical_queue_admission`
- `staging`
- `commit`
- `push`
- `deploy`
- `network`

## Changed Files

- `scripts/agent/lib/sandbox-queue-entry-lifecycle.mjs`
- `scripts/agent/__tests__/sandbox-queue-entry-lifecycle.test.mjs`
- `reports/RALPH-042B_SANDBOX_QUEUE_ENTRY_LIFECYCLE_SCHEMA_PROBE_REPORT.md`
- `ROADMAP.md` after successful verification only

## Conclusion

PASS. The RALPH-042B sandbox lifecycle schema probe is implemented as isolated advisory validation only. Focused verification passed, no lifecycle engine or execution path was added, and `ROADMAP.md` may be updated from `todo` to `done` for RALPH-042B.
