# Fooplan

A hello-world Angular 22 app: standalone components, zoneless, Vitest. Needs Node ≥ 24.15.

- `src/app/`: the root component (`app.ts`, `app.html`, `app.css`) and `app.config.ts`. `src/main.ts` bootstraps it; `src/index.html` and `src/styles.css` are the page and global styles.
- `npm start` serves it on `http://localhost:4200/`, `npm run build` writes `dist/fooplan/`. Never commit `node_modules/`, `dist/` or `.angular/`.

## Coding style

- Do not add a comment on every function. Code should be self-explanatory through naming and structure, so comments restating *what* the code does are noise. Only comment *why* something is done when the reason is non-obvious — a platform quirk, a workaround, a tuning trade-off, or a subtle constraint.

  ```js
  // Avoid
  // Loads the user.
  function loadUser() { ... }

  // Good
  // Safari only allows this after a permission prompt that must come from a user gesture
  document.getElementById('start').addEventListener('click', async () => { ... });
  ```

- Write code that reads like the surrounding code: match its naming, idiom and comment density.
- Order functions top-down: a function comes before the ones it calls, so a file reads from its entry points down to the helpers.
- On shared contracts (interfaces, base classes, abstract members), describe the contract and the default only, never which implementations currently behave a certain way. Such statements go stale as new implementations are added; a reason specific to one implementation belongs in that implementation.

## Describing behavior

- Before describing how the app behaves (what a screen shows, what an action does, in which order), read the code. Don't infer it from what the app is likely to do.
- Before describing how a failure propagates, read the error handling of every caller up the stack.
- Keep the README in sync when user-facing behavior changes.

## Testing

- `npx ng test --watch=false` runs the Vitest suite (`src/**/*.spec.ts`) and `npm run build` the type check. Before a commit, run the specs that cover the change (`--include <spec file>`); run the whole suite and the build before pushing. Put new logic where it can be tested, and add tests with it.
- A new business case (a new rule, a new state transition, a new edge case in an existing rule) is not done until a test covers it. Pure refactorings, renames and mechanical changes need no new tests.
- Put a test in the spec of the code whose behavior it proves, not in a caller's spec.
- Before saying a test helper or pattern doesn't exist, search for its base types and the test setup files, not just one name.
- Unit tests don't prove the running app. Also verify a change in the real app (in a browser, with the `browser-test` skill), and report it as working only because you saw it work, never because the code looks right.
- When something can't be verified here, say so and ask the user to check it.

## Working with agents

- Keep the main session for planning, reviewing and deciding. Delegate to subagents whatever pulls a lot of content into the context: implementing features (in parallel when they touch different files), follow-up fixes after an agent run, and browser testing.
- Agents can die on API overload errors (529). Tell them to save edits incrementally, and resume them rather than taking the work over.
- Before implementing a feature, show the plan as an HTML artifact and wait for the user's approval; the `develop-ticket` flow publishes its plan and goes on without waiting. Fixes from a review or the user's feedback go ahead without a new plan.
- Never write auto-memory: it is hidden and stays on one machine. Durable rules go into this file, a skill or `.claude/rules/`, where they're versioned with the project.

## Commits

- Keep the message to a single line saying what changed. No description body, no bullet lists, and no tool attribution trailers such as `Co-Authored-By`.
- Prefix with the area when there is an obvious one (`docs:`, `misc:`, …) and append the GitHub issue when the work has one: `docs: describe the setup steps - #12`.

## Tickets

- Tickets are GitHub issues. The `create-ticket` skill writes and files one from a request (`/create-ticket <what it's about>`). The `develop-ticket` skill develops one (`/develop-ticket 12`) or every open one (`/develop-ticket`) unattended, merges each into `main` and closes it.
- A ticket names the issues it builds on in a `Depends on #N.` line: only that line orders the tickets.
- An issue the skill couldn't finish gets the `needs-human` label and a comment why; remove the label to have it retried.
