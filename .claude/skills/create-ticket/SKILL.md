---
name: create-ticket
description: Write a GitHub issue for this project from a feature request or a bug report - spec, Given/When/Then acceptance criteria and the issues it depends on - precise enough for the unattended develop-ticket flow, after checking the code and the running app, and file it. Splits a request that is several features into several issues. Use when asked to create, write, file or open a ticket or issue, or to turn an idea or a bug into one.
argument-hint: [what the ticket is about]
---

# Create a ticket: $ARGUMENTS

`develop-ticket` builds an issue unattended from its body and comments alone. It builds exactly what the
issue says and decides on its own whatever the issue leaves open, so every gap becomes a guess nobody
reviews. The issue therefore has to be precise: each sentence allows one reading, and each criterion
becomes one test. The request is `$ARGUMENTS` plus the chat. There's no draft for the user to review:
file the issue, then report what you decided.

## 1. Read the code

First bring the checkout up to date, so the ticket describes the latest `main`: `git fetch origin main`
and `git merge --ff-only origin/main`. If that fails, because the branch and `main` have diverged or local
changes are in the way, stop and ask: the ticket would describe code that isn't on `main`.

Then read the code the ticket touches, and the README's description of it. The spec states how the app behaves
today from the code and the running app (step 2), not from what it's likely to do, and names the files,
functions and constants involved where that helps a developer (`pickRecipe` in
`src/app/plan/plan.ts:89`, `MAX_DAYS`). Read `.claude/rules/` for rules on the data the ticket touches.

## 2. Check the running app

An agent following the `browser-test` skill walks through every screen and flow the ticket touches,
starting from cleared `localStorage` and then from each state that matters to the ticket (a picked meal,
leftovers, an accepted plan, ticked grocery lines, the limits of Days and People). Give it the flows to
walk; it reports back, compactly:

- the texts shown, verbatim, with case and punctuation;
- the controls and elements, in their order on the page and where they sit relative to each other, and
  which are disabled or hidden in which state;
- what each relevant action does, by mouse and by keyboard, and where the focus goes after it;
- anything in the console or a failed request.

For a bug, the agent reproduces it from a cleared `localStorage`, and its exact steps and result become
the issue's Steps and Actual. If it doesn't reproduce, don't file: tell the user what the agent did and
saw.

Where the app and the README disagree, the app is right; mention the mismatch to the user. What a
desktop browser can't show (touch, real devices) goes into the report as unchecked.

## 3. Read the issues

`gh issue list --state all --limit 100 --json number,title,state,labels,body`. Look for open issues this
one builds on, overlaps with or conflicts with, and closed ones that specified the behavior it changes.
If an open issue already covers the request, don't file another: say which one and what the request
would add, and ask whether that goes in as a comment there or as a new issue.

## 4. Decide

- **One ticket or several.** An issue is one feature or one bug that can be built, tested and merged on
  its own. Split a request that holds several, and order the parts with `Depends on` lines.
- **Open details.** Settle them the way the app already handles similar things: labels and messages in
  the style of the existing ones, saved in `localStorage` like the plan, read-only on an accepted plan,
  usable by keyboard and screen reader. Ask the user only when the request leaves the feature itself
  open, when two readings would build different things. Keep a list of what you settled for the report.
- **Relations to other issues**, as lines at the top of the body:
  - `Depends on #4.` (`Depends on #8 and #16.`) when the ticket builds on code or UI an open issue adds.
    It's the only line that orders tickets for `develop-ticket`, and a ticket waits until every issue it
    names is closed, so don't name issues that are merely related.
  - `Changes #2.` when it changes behavior another issue specified; the spec says which criterion
    changes and how.
  - `Works best after #8.` when it's better after another issue but doesn't need it.

  Name related issues in the spec where they meet, too ("with #11's spoon formatting once that lands").

## 5. Write

The title says what the user gets, in sentence case, with no prefix: `Add your own items to the grocery
list`, `Picked meal: "Undo" brings back its suggestions instead of drawing new ones`.

The body, leaving out the relation lines that don't apply and `## Bug` for a feature:

```markdown
Depends on #4.

Changes #2. Works best after #8.

## Bug

**Steps:**
1. …

**Expected:** …

**Actual:** …

**Cause:** … (with file:line, when the code shows it)

## Spec

…

## Acceptance criteria

1. **Given** …, **when** …, **then** ….
```

**Spec:** opens with how the app behaves today (as the app showed it in step 2) and what's wrong or
missing, then states the change in one bold sentence. Then the details, as short paragraphs or bullets,
and ends with `Out of scope:` for what a reader would expect but the ticket doesn't do. It describes
behavior, not implementation, except where the implementation is the point (a data format, a saved
value).

**Precision.** Go through each of these and write down the answer, even when it is "unchanged":

- **Texts:** every new label, button, heading, message and accessible name, verbatim in quotes. Existing
  texts are copied from what the app showed, not from memory.
- **Placement:** on which page, relative to which existing element, in which order.
- **States:** none, one, many and each limit; an unaccepted and an accepted plan; after a reload; after
  "New plan"; a plan saved in `localStorage` before the change; and every existing feature it meets
  (leftovers, suggestions shown once per plan, the grocery list, ticks).
- **Input:** mouse or tap, keyboard (which keys, where the focus is before and after), screen reader
  (role, name, value).
- **Numbers and order:** exact limits and whether they're inclusive, rounding, sort order and its
  tie-breaks.
- **Names:** existing things by the names the app and the code use ("Plan" page, "Other suggestions",
  `MIN_DAYS`), never a description that could match two things.
- **What goes away:** behavior, texts and code the change removes, and the tests that go with them.

A rule is complete on its own: an example ("e.g.", "such as") only illustrates a rule already stated in
full, and a list is either complete or the rule says what decides membership. No "etc.", "should",
"could", "appropriate", "properly", "similar to", "some", "if needed": state what the app does.

**Acceptance criteria:**

- Numbered, each as **Given** / **when** / **then**: a starting state the app can be put in, one action,
  and the observable result, with concrete values ("a 5-day plan with 3 picked meals", "shows \"3 of 10
  meals picked\"") and expected texts verbatim.
- Each is provable by one unit test, component test or browser scenario, so it names what can be
  observed: what the page shows, what is saved, what has the focus. Never "works well" or "is fast".
- Cover the negative side (what must not show, happen or be allowed), every limit and the empty cases.
  Variants of one rule can share a criterion, separated by `;`.
- Every rule in the spec has a criterion, and no criterion says something the spec doesn't.

**Self-check.** Before filing, reread the draft as `develop-ticket`'s intake would, with the code at
hand, and fix in the ticket, sentence by sentence:

- where two developers could build different things;
- states, inputs or limits from the precision list that the spec doesn't settle;
- criteria that can't be tested as written (a component test can't compute CSS, so a colour or an
  opacity is a browser check and says so), or that disagree with the spec;
- claims about today's behavior that the code contradicts;
- texts or names that don't match the app.

Add what this settled to the list of settled details. Ask the user only about what the request leaves
open; everything else gets decided here.

## 6. File

Create the issues in dependency order, so a later one can name an earlier one's number:

```bash
gh issue create --title "<title>" --body-file - <<'EOF'
<body>
EOF
```

Add `--label bug` for a bug; no other labels, no assignee, no milestone. Never edit other issues: a
change to another issue's spec lives in this ticket's `Changes` line and spec. Stop any dev server the
flow started.

## 7. Report

For each issue filed: its URL, title and dependencies. Then a short list of the details settled in
steps 4 and 5, so the user can edit the issue where they'd have decided differently before running
`/develop-ticket <number>`, and what step 2 couldn't check in a desktop browser.
