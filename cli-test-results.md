# CLI Test Results for Morning Review Generator

## Test 1: --help Flag

Command: `node scripts/agent/generate-morning-review.mjs --help`

Expected: Help text should be displayed with exit code 0
Status: Testing...

## Test 2: --dry-run Flag

Command: `node scripts/agent/generate-morning-review.mjs --dry-run`

Expected: Markdown report preview without file writes
Status: Pending...

## Test 3: --json Flag

Command: `node scripts/agent/generate-morning-review.mjs --json`

Expected: Valid JSON output
Status: Pending...

## Test 4: Write Mode Isolation

Command: `node scripts/agent/generate-morning-review.mjs --write`

Expected: Only reports/morning-review.md should be modified
Status: Pending...
