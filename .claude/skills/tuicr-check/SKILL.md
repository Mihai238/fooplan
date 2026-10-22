---
name: tuicr-check
description: Read the comments the user left in their tuicr review of this worktree and answer each one, without changing any code. Use when the user says they've finished reviewing, e.g. "cr done", "review done", "check my comments".
---

# tuicr-check

The user has reviewed this worktree's changes in tuicr and wants your take on their comments before
anything changes. Read-only: no edits, no `git add`/commit/stash, no `tuicr review add`.

1. `tuicr review list` and keep only the sessions whose slug ends with `/<git rev-parse --short=7 HEAD>`.
   Older sessions belong to work that has since been committed. Take the most recently updated one (ask if
   two look current), then `tuicr review comments --session <slug>`. If none match, say so and stop.
2. For each comment, read the code it points at (and whatever it depends on) before answering. Don't
   answer from the diff alone.
3. Reply per comment, in the order tuicr lists them, headed by `file:line` and a short quote of the comment:
   - a question: answer it, with `file:line` references.
   - a suggested change: say whether you agree. If yes, describe the fix in a line or two and what else it
     would touch (tests, other call sites, the UI). If not, say why.
   - a remark that's already handled elsewhere: point to where.
4. End with the list of fixes you'd make and wait. Once the user says which ones to do, follow the
   `tuicr` skill's "Resolving review comments".
