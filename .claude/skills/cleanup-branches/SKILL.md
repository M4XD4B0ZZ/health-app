---
name: cleanup-branches
description: Delete merged and stale Git branches locally and on the remote, with preview, protected-branch filtering, and explicit confirmation before any deletion. Use this skill whenever the user mentions cleaning up branches, deleting merged branches, pruning stale branches, "my repo has too many branches", tidying up after PR merges, or asks what branches can safely be removed — even if they don't say "cleanup" explicitly. Also run it automatically (local scope) right after every `git push` and `git pull`/`git fetch --prune`, per AGENTS.md's "Git Branch Sync After Push/Pull" rule, so the branch list stays clean as merges land.
---

# Cleanup Branches

Remove branches that are fully merged or long inactive, without ever risking unmerged work.

Branch deletion is one of the few Git operations that can lose work. Local deletion is recoverable via reflog; remote deletion generally is not. This skill therefore treats _showing_ and _confirming_ as the main job, and deletion as the small step at the end.

This skill implements, for this repository, the branch-deletion behavior required by
[`AGENTS.md`](../../../AGENTS.md)'s "Git Branch Sync After Push/Pull" rule: only delete a branch once its
pull request is confirmed merged (merge commits preserve history, so this is safe), and never delete
a branch whose PR was closed without merging without explicit, branch-specific human confirmation —
its commits exist nowhere else once removed. That AGENTS.md rule applies to every adapter/tool per
the Tool Adapter Principle; this file is the Claude Code-specific implementation of it, not a
replacement for it.

## Automatic invocation after push/pull

Per the same AGENTS.md rule, run this skill proactively — not only when the user asks for cleanup —
immediately after every `git push` and every `git pull`/`git fetch --prune`:

- **Scope:** local only (no `--remote`) by default. This surfaces branches merged into
  `origin/$DEFAULT` right after a sync point, when the list is most likely to have changed.
- **Confirmation still applies.** An automatic trigger is not license to skip step 8 below — it
  changes _when_ the skill runs, not _whether_ it asks before deleting. Present the preview and wait
  for the normal single local confirmation, same as a manually-invoked run.
- **`--remote` only** when either (a) the branch being cleaned up is one whose PR was confirmed
  merged in this same session (the standing authorization already granted by AGENTS.md for that
  narrow case), or (b) the user explicitly asks for a remote sweep. Otherwise leave remote branches
  alone and let the user invoke `--remote` deliberately.
- If nothing is merged since the last run, say so briefly (or stay silent if the push/pull itself
  already produced output) — this is meant to be a lightweight habit, not a noisy interruption on
  every sync.

## Flags

| Flag                | Effect                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| _(none)_            | Local merged branches only. Preview + one confirmation.                                                                        |
| `--remote`          | Also consider remote branches. Requires a **second, separate** confirmation.                                                   |
| `--stale <days>`    | Additionally list branches with no commit in `<days>` days (default 90). Never auto-deleted — reported for the user to choose. |
| `--dry-run`         | Print exactly what would be deleted, then stop. No confirmation prompt, no deletion.                                           |
| `--protect <a,b,c>` | Extra protected branch names or glob patterns, added to the defaults.                                                          |

Flags combine (`--remote --dry-run` previews both sides).

## Protected branches

Never delete, under any circumstances:

- `main`, `master`, `develop`, `development`, `staging`, `production`, `release/*`
- Anything passed via `--protect`
- The branch currently checked out (`git branch --show-current`)
- The remote's default branch (`git symbolic-ref refs/remotes/origin/HEAD`)

**Repo note:** in this repository the remote's default branch is _not_ named `main` — verify it
with step 3 below rather than assuming. Do not hardcode `main` anywhere in the implementation.

If a user explicitly asks to delete a protected branch, refuse and explain — they can do it manually with plain Git if they truly mean it. The value of this skill is that it can't be the thing that deleted the default branch.

## Process

### 1. Sanity checks

Bail out early with a clear message if any fail:

```bash
git rev-parse --is-inside-work-tree   # is this a repo at all?
git remote get-url origin             # does origin exist? (skip remote steps if not)
```

If the working tree has uncommitted changes, that's fine — deletion doesn't touch it — but mention it if the user seems to expect otherwise.

### 2. Sync with the remote

```bash
git fetch --prune origin
```

`--prune` removes stale `origin/*` refs for branches already deleted server-side. Without this step, `--merged` is evaluated against a possibly outdated view and the results are misleading. If `fetch` fails (offline, no auth), stop and say so rather than continuing on stale data.

### 3. Detect the default branch

Don't assume `main`. Ask the remote:

```bash
git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'
```

Fallbacks if that ref isn't set: `git remote show origin | sed -n 's/.*HEAD branch: //p'`, then `main`, then `master`. Store the answer as `$DEFAULT` and use it everywhere below — never a hardcoded `main`.

### 4. Find merged branches

```bash
# Local, merged into the remote's default branch (not the local one — it may be behind)
git branch --format='%(refname:short)' --merged "origin/$DEFAULT"

# Remote
git branch -r --format='%(refname:short)' --merged "origin/$DEFAULT"
```

Compare against `origin/$DEFAULT`, not the local `$DEFAULT`. A local default branch that hasn't been pulled in two weeks will report far fewer branches as merged than are actually merged.

**Squash-merge caveat:** repositories that squash-merge PRs produce branches that are _logically_ merged but that `--merged` will not report, because no merge commit shares their tip. Mention this once in the summary if nothing was found — the user may need `git cherry` or their forge's UI instead. Never work around it by loosening the merge check.

### 5. Find stale branches (only with `--stale`)

```bash
git for-each-ref --sort=committerdate \
  --format='%(refname:short)|%(committerdate:iso8601)|%(committerdate:relative)' \
  refs/heads/
```

Filter to those older than the threshold. Report them in a **separate section**, clearly labelled as _not merged_. Stale ≠ safe to delete: an old branch may hold the only copy of unfinished work. The user picks individually; never bulk-delete stale branches.

### 6. Filter

Remove from all candidate lists: protected patterns, the current branch, the default branch, and (for remote) `origin/HEAD`. Deduplicate.

### 7. Preview

Always print the full list before asking anything, grouped as Local / Remote / Stale / Protected (skipped). If a group is empty, say so rather than omitting it — the user should be able to tell the difference between "none found" and "not checked".

If `--dry-run`: stop here.

### 8. Confirm

- Local deletions: one confirmation covering the whole list.
- Remote deletions: a **second, separate** confirmation, asked only after the local one, stating the count and that it is not reversible. Never fold local and remote into one y/n.

Anything other than an explicit affirmative means abort. Silence, ambiguity, or "sure I guess" for the remote prompt → ask again.

### 9. Delete

```bash
# Local — lowercase -d refuses to delete unmerged branches
git branch -d "$branch"

# Remote
git push origin --delete "$branch"
```

**Use `-d`, never `-D`.** The capital form skips the merge check and is exactly the failure this skill exists to prevent. If `-d` refuses a branch, that is a correct outcome and valuable information: report it, don't retry, don't escalate to `-D` even if the user asks mid-run — have them re-run deliberately.

Delete one branch at a time and keep going on failure. Common failures worth surfacing plainly:

| Failure                                       | Meaning                                  |
| --------------------------------------------- | ---------------------------------------- |
| `error: the branch '<x>' is not fully merged` | Unmerged commits. Left intact — correct. |
| `remote ref does not exist`                   | Someone already deleted it. Harmless.    |
| `protected branch hook declined`              | Server-side protection. Respect it.      |
| non-fast-forward / permission denied          | No push rights. Report, don't retry.     |

If a remote deletion is rejected by the environment/proxy (HTTP 403, no MCP tool available, etc.) rather
than by Git itself, do not build ad-hoc workarounds (raw API calls, new tools/dependencies) to route
around that restriction — report it and leave the branch for deletion via a channel with proper access.
See the incident rationale in `AGENTS.md`'s "Git Branch Sync After Push" section.

### 10. Summarize

Report deleted, skipped, and failed counts separately. Mention that local deletions are recoverable for ~30 days via `git reflog` and `git branch <name> <sha>`; remote deletions are not.

## Examples

**Basic cleanup**

```
/cleanup-branches
→ Fetching (git fetch --prune origin)...
→ Default branch: chore/clean-arch-structure

  Local (merged into origin/chore/clean-arch-structure):
  - feature/add-button
  - feature/fix-header
  - bugfix/typo

  Remote: not checked (pass --remote)
  Stale: not checked (pass --stale)

  Protected (skipped): chore/clean-arch-structure, develop, release/2.1
  Current branch (skipped): feature/wip-refactor

→ Delete these 3 local branches? (y/n) y
→ Deleted 3 ✅  ·  Recover within ~30 days via git reflog
```

**With remote — note the two prompts**

```
/cleanup-branches --remote
→ Default branch: chore/clean-arch-structure

  Local (2):  feature/add-button, feature/fix-header
  Remote (3): origin/feature/old-feature, origin/feature/completed-work, origin/bugfix/fixed
  Protected (skipped): chore/clean-arch-structure, develop

→ Delete 2 local branches? (y/n) y
→ Deleted 2 local ✅

→ Now delete 3 REMOTE branches on origin? This cannot be undone. (y/n) y
→ Deleted 3 remote ✅
```

**Unmerged branch encountered**

```
→ Deleting...
  ✅ feature/add-button
  ⚠️  feature/fix-header — not fully merged, kept
→ 1 deleted, 1 kept. Inspect with: git log origin/chore/clean-arch-structure..feature/fix-header
```

**Nothing to clean**

```
/cleanup-branches
→ Default branch: chore/clean-arch-structure
→ No merged branches found ✅
   Note: if this repo squash-merges PRs, merged branches won't show up here.
   Try: git cherry -v origin/chore/clean-arch-structure <branch>
```

**Dry run**

```
/cleanup-branches --remote --dry-run
→ Would delete (dry run, nothing changed):
   Local:  feature/add-button, feature/fix-header
   Remote: origin/bugfix/fixed
→ Re-run without --dry-run to apply.
```

## Non-goals

- Deleting unmerged branches. Use `git branch -D` yourself.
- Deleting protected branches, even on request.
- Bulk-deleting stale-but-unmerged branches.
- Rewriting history, or anything touching commits rather than refs.
