---
name: tuicr
description: Open the tuicr code-review TUI on this worktree's uncommitted changes (in a fullscreen herdr pane), fix review comments the user has decided on, and delete old review sessions. Use when the user says "cr start" or asks to open tuicr or review changes in tuicr, or to fix comments from a tuicr review.
---

# tuicr

tuicr is an interactive TUI and can't run in Claude Code's own shell. Under herdr (`HERDR_PANE_ID` is
set), open it in a new pane and always zoom that pane to fullscreen:

```
herdr pane split --current --direction right --cwd <worktree> --focus
herdr pane run <new pane_id> tuicr      # never pass -w
herdr pane zoom <new pane_id> --on
```

## Reading a review

`tuicr review list`, then `tuicr review comments --session <slug>`.

## Resolving review comments

The user wants to see only the fixes afterwards, apart from the version they reviewed:

- Before fixing, check that the reviewed state is fully staged or committed. If it isn't, offer a temporary
  WIP commit, and never commit without asking.
- Don't touch the index while fixing: never `git add` a fix. Mark new files with `git add -N` so they show
  up in the diff.
- When done, tell the user that `git diff` shows only the fixes and `git diff --cached` the version they
  reviewed.

## Sessions

Sessions live in `<reviews>/sessions/<hash>.json`, where `<reviews>` is
`~/Library/Application Support/tuicr/reviews` on macOS and `~/.local/share/tuicr/reviews` on Linux. Each
file's `repo_path` names the worktree. tuicr has no delete command: to delete a session, remove its JSON
file and its entry in `<reviews>/index.json`, or `tuicr review list` keeps showing it.
