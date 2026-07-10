# RALPH-040C Queue Admission Validator Smoke Report

## Base Context

- Task: RALPH-040C Queue Admission Validator Smoke Evaluation
- Latest commit verified before execution: `73d542f chore(roadmap): register queue admission smoke`
- Initial working tree check: `git --no-pager status --short` returned no output.
- Overall result: PASS

## Commands Executed

- `git --no-pager status --short`
- `git --no-pager log -1 --oneline`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<SAFE_AUTONOMOUS fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<REVIEW_REQUIRED fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<HUMAN_ONLY fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<FORBIDDEN fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<dirty-tree signal fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<staged-files signal fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<protected-file match fixture>"`
- `node scripts/agent/queue-admission-validator.mjs --metadata-json "<queue-entry collision fixture>"`

## Fixture Results

| Fixture               | Expected decision              | Actual decision                | admission_allowed | reason_codes                                   | queue_entry_preview.queue_entry_id | Result |
| --------------------- | ------------------------------ | ------------------------------ | ----------------: | ---------------------------------------------- | ---------------------------------- | ------ |
| SAFE_AUTONOMOUS       | `admissible`                   | `admissible`                   |            `true` | `(none)`                                       | `preview-ralph-040c`               | PASS   |
| REVIEW_REQUIRED       | `requires_review_before_queue` | `requires_review_before_queue` |           `false` | `(none)`                                       | `preview-ralph-040c`               | PASS   |
| HUMAN_ONLY            | `human_only`                   | `human_only`                   |           `false` | `(none)`                                       | `preview-ralph-040c`               | PASS   |
| FORBIDDEN             | `rejected`                     | `rejected`                     |           `false` | `(none)`                                       | `preview-ralph-040c`               | PASS   |
| Dirty-tree signal     | `rejected`                     | `rejected`                     |           `false` | `dirty_tree_blocks_queue_admission`            | `preview-ralph-040c`               | PASS   |
| Staged-files signal   | `rejected`                     | `rejected`                     |           `false` | `staged_files_block_queue_admission`           | `preview-ralph-040c`               | PASS   |
| Protected-file match  | `rejected`                     | `rejected`                     |           `false` | `protected_file_match_blocks_queue_admission`  | `preview-ralph-040c`               | PASS   |
| Queue-entry collision | `rejected`                     | `rejected`                     |           `false` | `queue_entry_collision_blocks_queue_admission` | `preview-ralph-040c`               | PASS   |

## Smoke Summary

- Expected vs actual admission decisions: all matched.
- Overall pass/fail: PASS.
- Validator behavior changed: No.
- Queue entry written: No.
- Queue integration added: No.
- Runtime state mutated: No.
- Evidence/review JSONL written: No.
- Handoff, product, package, script, test, task, run, validation, review, queue, and canonical governance files mutated: No.
- Planned allowed mutations after successful smoke verification: this report artifact and the RALPH-040C `ROADMAP.md` status update only.
