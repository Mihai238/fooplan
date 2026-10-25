---
name: create-ticket
description: Write a GitHub issue for this project from a feature request or a bug report - spec, Given/When/Then acceptance criteria and the issues it depends on - in the shape the develop-ticket skill builds from, and file it. Splits a request that is several features into several issues. Use when asked to create, write, file or open a ticket or issue, or to turn an idea or a bug into one.
argument-hint: [what the ticket is about]
---

# Create a ticket: $ARGUMENTS

`develop-ticket` builds an issue unattended from its body and comments alone, and decides on its own
whatever the issue leaves open. So the issue settles what the app does, in enough detail that each
criterion becomes one test. The request is `$ARGUMENTS` plus the chat. There's no draft for the user to
review: file the issue, then report what you decided.

## 1. Read before writing

- The code the ticket touches, and the README's description of it. The spec states how the app behaves
  today from the code, not from what it's likely to do, and names the files and functions involved where
  that helps a developer (`pickRecipe`, `src/app/plan/plan.ts:89`).
- The issues: `gh issue list --state all --limit 100 --json number,title,state,labels,body`. Look for
  open issues this one builds on or overlaps with, and closed ones that specified the behavior it changes.
  If an open issue already covers the request, don't file another: say which one and what the request
  would add, and ask whether that goes in as a comment there or as a new issue.
- `.claude/rules/` for rules on the data the ticket touches.

## 2. Decide

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

## 3. Write

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

**Spec:**

- Opens with how the app behaves today and what's wrong or missing, then states the change in one bold
  sentence.
- Then the details, as short paragraphs or bullets: the exact texts of labels, buttons and messages in
  quotes; limits and boundaries; what happens after a reload, after "New plan" and on an accepted plan;
  whether a plan saved before the change still loads; keyboard and screen reader behavior of new
  controls.
- Describes behavior, not implementation, except where the implementation is the point (a data format,
  a saved value).
- Ends with `Out of scope:` for what a reader would expect but the ticket doesn't do.

**Acceptance criteria:**

- Numbered, each as **Given** / **when** / **then**, with concrete values ("a 5-day plan with 3 picked
  meals", "shows \"3 of 10 meals picked\"") instead of "some" or "correctly".
- Each is provable by one unit test, component test or browser scenario, so it names what can be
  observed: what the page shows, what is saved, what has the focus. Never "works well" or "is fast".
- Cover the negative side (what must not show, happen or be allowed), the boundaries and the empty cases
  the spec names. Variants of one rule can share a criterion, separated by `;`.
- Every rule in the spec has a criterion, and no criterion says something the spec doesn't.

## 4. File

Create the issues in dependency order, so a later one can name an earlier one's number:

```bash
gh issue create --title "<title>" --body-file - <<'EOF'
<body>
EOF
```

Add `--label bug` for a bug; no other labels, no assignee, no milestone. Never edit other issues: a
change to another issue's spec lives in this ticket's `Changes` line and spec.

## 5. Report

For each issue filed: its URL, title and dependencies. Then a short list of the details settled in
step 2, so the user can edit the issue where they'd have decided differently before running
`/develop-ticket <number>`.
