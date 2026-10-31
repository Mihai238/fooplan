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

## Service worker

The service worker, the manifest and offline use exist only in the production build; `npm start` registers no worker. To check them, build and serve the app as GitHub Pages does, under `/fooplan/` with unknown paths answered by `404.html` (status 404), so a deep link like `/fooplan/recipes` still boots the app:

```bash
npx ng build --base-href /fooplan/
cp dist/fooplan/browser/index.html dist/fooplan/browser/404.html
node -e "const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const root=path.resolve('dist/fooplan/browser'),types={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.ico':'image/x-icon'};http.createServer((req,res)=>{let file,status=200;try{const url=new URL(req.url,'http://h').pathname;file=url.startsWith('/fooplan/')&&path.resolve(root,decodeURIComponent(url.slice(9))||'index.html');if(!file||!file.startsWith(root+path.sep)||!fs.statSync(file,{throwIfNoEntry:false})?.isFile()){file=path.join(root,'404.html');status=404}}catch{res.writeHead(400).end();return}fs.createReadStream(file).on('error',()=>{if(res.headersSent)res.destroy();else res.writeHead(404).end()}).on('open',()=>res.writeHead(status,{'content-type':types[path.extname(file)]??'application/octet-stream'})).pipe(res)}).listen(4300,'127.0.0.1')"
```

Start the server from the repo root with `run_in_background`, open `http://127.0.0.1:4300/fooplan/`, and stop it when done. A rebuild needs no restart: the server reads the directory on every request, but `404.html` has to be copied again.

The worker registers once the app is stable (or after 30 s) and controls the page from the next load. It stays registered in the browser profile (the production build served at `/` above registers one too, on the same origin) and keeps serving the build it cached, showing a new build only on the second load after the worker sees it: start each check in a fresh browser context, or unregister it first (`navigator.serviceWorker.getRegistrations()`, then `unregister()` on each).

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
