---
name: browser-test
description: Check the app in a real desktop browser through the Chrome DevTools MCP tools - start a local server, drive the UI, and check the console and network. Use when asked to run the app, verify a change works, reproduce a bug, or check for console errors.
---

# Browser test

Drive the app with the Chrome DevTools MCP tools. This proves what the screen shows and that the app runs. It can't prove anything that needs real hardware or a real device (see the end).

## Main session or agent

Every chrome-devtools action returns a full page snapshot, so testing in the main session fills the context fast. Delegate browser testing to an agent: give it the scenario and the expected results, and have it report back a compact pass/fail. When testing in the main session is unavoidable, use `evaluate_script` that returns small JSON, and screenshots only when something has to be seen.

## Server

Check whether a server already answers:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4200/ --max-time 3
```

`000` means nothing is running: start `npx ng serve --host 127.0.0.1 --port 4200` from the repo root with `run_in_background` (run `npm install` first if `node_modules/` is missing). If something already answers, it belongs to the user or another session: reuse it, never kill or restart it. Stop only a server you started.

Open `http://127.0.0.1:4200/`. Before reusing an open tab, check its URL in `list_pages`.

To check the production build instead, run `npm run build`, then `npx http-server dist/fooplan/browser -a 127.0.0.1 -p 4300` and open `http://127.0.0.1:4300/`.

## Supabase

Signing in needs the local Supabase stack. Check whether it answers:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54321/auth/v1/health --max-time 3
```

On `000`, run `npx supabase start` from the repo root (and `colima start` first if Docker doesn't answer, `docker info` failing).

To sign in, submit an email address on `/sign-in`, open Mailpit at `http://127.0.0.1:54324` (or its API, `/api/v1/messages`), and follow the link of the newest mail to that address. Don't stop the stack afterwards: it belongs to the machine, not to the test.

## Driving the app

- Act on `take_snapshot` uids for HTML controls.
- For a `<canvas>` or anything else the snapshot can't see, use `press_key`/`click` and `take_screenshot` to see the result.
- Browser permission prompts (microphone, camera, location, …) can't be answered from here. Fake the API with `evaluate_script` before triggering it: resolve to grant, reject with a `NotAllowedError` to deny.
- A "wrong" default is often a leftover setting in `localStorage`. Clear the app's keys and reload before concluding.
- Wait on conditions (`wait_for` on expected text, or `evaluate_script` polling), never fixed sleeps.

## Verify

Every flow: the expected screen renders, `list_console_messages` is clean, and no request fails in `list_network_requests`. Report anything new in the console, even if it looks unrelated.

Report a change as working only because the browser showed it, never because the code looks right.

## What a desktop browser can't prove

Device sensors, real microphone or camera input, touch-only behavior and the like can't be verified here, and a faked API proves the wiring but not the real behavior. Say so in the report, and ask the user to check it on a real device.
