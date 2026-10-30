---
name: develop-ticket
description: Develop GitHub issues unattended from their spec and acceptance criteria - tests first, implementation, quality gate (tests + browser check + review by agents), one commit per ticket merged into main and deployed, issue closed. Without a number, works through every open issue in dependency order. Also resumes a run in progress. Use when asked to work on, implement, develop or continue an issue or ticket, or all of them.
argument-hint: [issue number]
---

# Develop tickets $ARGUMENTS

## Before anything

The user has created this worktree for the run. Never create, switch or remove worktrees or branches:
the worktree's branch only carries each ticket on its way to `main`.

- **`.ticket.md` exists in the worktree root and its `Step:` is neither `done` nor `skipped`:** read it
  and continue that ticket at the step its `Step:` line names, then go on with the queue. On a resume,
  check `git log <Start>..HEAD` and `git status` against the progress log before going on.
- **Otherwise:** build the queue and start its first ticket at step 1, which overwrites the finished
  `.ticket.md`.

## The queue

- **With an issue number** (`12` or `#12`): that issue, after the open issues it depends on, and theirs.
- **Without:** every open issue that doesn't carry the `needs-human` label.

An issue depends on the ones its body names in a `Depends on #2 and #3.` line; `Changes #N` and
`Works best after #N` don't order anything. A ticket is ready when every issue it depends on is closed.
Take the ready ticket with the lowest number. After each ticket, read the open issues again
(`gh issue list --state open --json number,title,body,labels`), because a closed one makes others ready.

A ticket that depends on a `needs-human` issue, or sits in a dependency cycle, is skipped with that
reason. The run ends when no ticket in the queue is ready.

## Rules for the whole flow

- Nothing waits for the user. Unclear criteria are decided at step 1, the plan at step 3 is approved
  automatically, and a ticket the flow can't finish is skipped (see the end of this file). The only
  stops are blockers no ticket can get past: a working tree that isn't clean at step 1, a branch that
  can't fast-forward to `main`, and `gh` failing to reach the repository. Stop and ask then.
- `.ticket.md` (gitignored, from `ticket-template.md` next to this file) is the state of the current
  ticket. After every step, update its `Step:` line and add a line to the progress log. Write decisions
  to `## Decisions`. Agents get their context from `.ticket.md` and report back short results, never
  file dumps.
- Everything the flow produces lives in `.ticket.md`, never only in the scratchpad: the scratchpad is
  under `/tmp` and gone after a machine restart. That includes criteria written retroactively for work
  that was committed without them.
- Commit `wip: <slice>` freely as checkpoints; step 5 squashes them into one commit. Push only in
  step 6, and only to `main`; never force-push. `git reset --hard` only ever goes back to `<Start>`,
  when skipping a ticket.
- Read an issue with `gh issue view <number> --comments`. The flow closes it with a comment (step 6),
  or labels and comments it when skipping it; it never edits an issue's title or body or assigns it.
- Follow CLAUDE.md, in particular: delegate implementing, browser testing and the quality gate to agents;
  tell agents to save edits incrementally, and resume an agent that died on a 529 instead of taking its
  work over.

## 1. Intake

1. `git status` must be clean, since the `wip:` commits would take in anything already changed.
2. `git fetch origin main` and `git merge --ff-only origin/main`, so the ticket starts from the latest
   `main`.
3. Read the issue. The spec and the acceptance criteria come from the issue body and its comments, plus
   whatever the user adds in the chat; the chat wins where they differ.
4. Create `.ticket.md` from the template. Set `Ticket:` to the issue's URL and `Start:` to
   `git rev-parse HEAD`. Put the spec into `## Spec` and each criterion as Given / When / Then into the
   criteria table, with the level of the one test that proves it most cheaply:

   | Criterion describes | Level | Its test case |
   |---|---|---|
   | Logic with many variants (parsing, formatting, validation, state) | unit | Vitest spec of the function or service |
   | What a component shows or does on input | component | Vitest spec of the component (TestBed) |
   | A user workflow across screens, or anything a spec can't see (routing, real rendering, the console) | browser | Scenario in `## Browser scenarios`, run with the `browser-test` skill |

5. If a criterion is ambiguous, contradicts the spec or can't be tested, don't ask: take the reading
   that fits the spec best, write it into the table as a testable criterion, and the original wording
   and the reason into `## Decisions`.

## 2. Tests first

An agent writes the one test per criterion and records its name in the criteria table. Every Vitest test
must fail now, for the right reason (missing behavior, not a compile error in unrelated code). Browser
scenarios are written into `## Browser scenarios` as steps with expected results; they run in step 4.

The agent also adds the edge cases that would break each criterion, as extra rows numbered after it
(`2a`, `2b`), each with its own failing test: the negative side first (what must *not* show, happen or be
allowed), then boundaries, empty or missing data, and error states. Only cases whose outcome the spec
settles; one it leaves open goes to the plan as an open question, not into a test.

A test goes in the spec file next to the code whose behavior it proves (`foo.ts` → `foo.spec.ts`).

## 3. Implement

Write a short `## Approach` to `.ticket.md` first: slices in order with their files and the criteria
tests they make pass, and which slices can run in parallel. Check CLAUDE.md and `.claude/rules/` for
constraints. Before the approach names a component, route, input, CSS class or label, check how sibling
code names the same thing and reuse that name.

`.ticket.md` is the plan (spec, criteria with their edge-case rows, the readings decided at step 1, open
edge-case questions, approach, risks); it isn't published anywhere else. Go on without waiting: the plan
is approved automatically. If the user objects to it while the work runs, adjust the approach and drop the
edge-case tests they reject. Fixes from the quality gate and from the user's feedback go ahead without
a new plan.

Implementer agents work slice by slice. Per slice: write the code, make that slice's tests pass,
commit `wip: <slice>`, log it. Slices run as parallel agents when they touch different files. Parallel
agents share one git index in the worktree, so they don't commit: the main session commits each slice's
`wip:` after its agent reports. When user-facing behavior changes, a slice updates the README too.

## 4. Quality gate

The gate runs in rounds. A round is one run of the agents below plus the fixes for what they found;
raise `Round:` in `.ticket.md` when it starts.

Fresh agents that didn't write the code, in parallel:

- **Gate runner.** All of these must pass:
  - `npx ng test --watch=false`
  - `npm run build` (the type check), with no new warnings
- **Browser tester.** Follows the `browser-test` skill: runs every scenario in `## Browser scenarios`
  against `ng serve`, which reloads on its own and needs no restart, and checks the console and network
  for new errors. Reports pass/fail per scenario, with what it saw when one fails.
- **Reviewer.** Never changes a file, not even temporarily to check a finding, and passes that on to every
  sub-agent a skill starts for it: the other agents test the same worktree at the same time. A check that
  needs a code change goes into the finding as a proposal for the fix agent. It doesn't run the build or
  the tests either: they write the `dist/` and `.angular/` directories the gate runner is using.
  Picks the depth from what the diff touches and always names the level, because
  `/code-review` without one reuses the last level typed:

  | The diff touches | Level | Also |
  |---|---|---|
  | Authentication, credentials, user data storage, requests to other services, or rendering untrusted content | `xhigh` | `/security-review` |
  | Other logic, or UI behavior | `high` | |
  | Only copy, styling, docs or tests | `low` | |

  Round 1 runs `/code-review` on `git diff <Start>...HEAD` against `## Spec` and the criteria, then
  `/simplify`. Later rounds keep the level, review only `git diff <Reviewed>...HEAD` (the fixes) with
  `## Review findings` as context, post no finding again and skip `/simplify`, whose suggestions on
  small fix diffs mostly start another round.
  It checks the rules in CLAUDE.md and `.claude/rules/` in particular: the coding style, tests next to
  the code they prove, the README kept in sync.
  It reports each finding with file:line and one tag:
  - **Important**: a bug or rule break the diff introduces.
  - **Nit**: style, naming, cleanup.
  - **Pre-existing**: a bug in code the diff didn't change.

  When a finding is one instance of a pattern, it names the pattern and every place it occurs, so one
  fix covers all of them. At the end of the round, set `Reviewed:` to the commit it reviewed.

Record each test and scenario result in the criteria table. Check every finding against the code, then
give it a row in `## Review findings` with its outcome:

- Important: `fixed`, or `wrong` / `intentional` with the reason.
- Nit: `fixed` when cheap, otherwise `not worth it`. Skip a simplification that breaks a pattern the
  neighbouring code follows.
- Pre-existing: `left`. Not fixed in this ticket; the summary lists it.

Gate failures, failed scenarios and Important findings go back to step 3, then the next round starts.

If round 3 still ends with a failing gate or an open Important finding, skip the ticket: more fixes on
the same approach rarely converge. The reason names what is open and whether the approach is the cause.

## 5. Commit

`git reset --soft <Start>`, then commit everything as one commit in the CLAUDE.md format, ending in the
issue reference. The `wip:` commits are gone.

## 6. Merge into main

`main` has a linear history of one commit per ticket, so the ticket's commit goes on top of it instead
of in a merge commit. `main` may be checked out in another worktree, so don't switch to it here.

1. `git fetch origin main` and `git rebase origin/main`. Resolve a conflict when the intent of both
   sides is clear; when it isn't, `git rebase --abort` and skip the ticket.
2. Every time, run the whole suite (`npx ng test --watch=false`) and `npm run build` on the rebased
   commit; when the rebase brought in new commits, also run the browser scenarios again, since the gate
   tested the ticket on its old base. Push only when all of them pass. A failure is another gate round
   (step 4's limit of three still applies): fix it, fold the fix into the ticket's commit with
   `git commit --amend` (it isn't pushed yet), and go back to 1.
3. `git push origin HEAD:main`. If it's rejected because `main` moved meanwhile, go back to 1.
4. The push deploys (`.github/workflows/deploy.yml`): find the run with
   `gh run list --workflow deploy.yml --commit <the pushed commit>` and wait for it with
   `gh run watch <id> --exit-status`. If it fails, fix it in a new commit, rerun the affected part of
   the gate and this step. After three failed deployments, or when the failure isn't in the code
   (Actions or Pages down), label and comment the issue as when skipping, leave it open with the
   commit on `main`, and go on with 6.
5. Close the issue: `gh issue close <number> --comment "<commit> is on main and deployed."`
6. Stop any dev server the flow started, set `Step: done` in `.ticket.md`, and show the user the
   summary of the ticket without waiting for an answer. Then go on with the queue.

## Skipping a ticket

1. Write the reason into `.ticket.md`.
2. Drop the ticket's work: `git rebase --abort` if a rebase is in progress, then
   `git reset --hard <Start>`.
3. Label the issue `needs-human` (create the label first if the repository doesn't have it:
   `gh label create needs-human --description "develop-ticket couldn't finish it; remove the label to retry"`)
   and comment on it: why the flow gave up, what is open, and what would unblock it, such as a spec
   that settles a question.
4. Stop any dev server the flow started, set `Step: skipped` in `.ticket.md`, and go on with the queue.

## Summary

After each ticket, in a few lines:

- what changed and the criteria table with results, or why it was skipped,
- the rounds the gate took and the review findings counted by outcome, with every Important one not
  fixed and every Pre-existing one listed, so the user can decide whether it needs an issue,
- what the browser tester could not verify (see the end of the `browser-test` skill), for the user to
  check,
- the readings of unclear criteria decided at step 1,
- the open edge-case questions from the plan, which no test covers yet,
- the commit on `main` and whether the deployment succeeded.

At the end of the run, list the tickets done with their commits, the ones skipped with their reasons,
and the open issues left waiting on a skipped one.

Fix corrections the user brings later in a new commit: rerun the affected part of the gate, then
step 6.
