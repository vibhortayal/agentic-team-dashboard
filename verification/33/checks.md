# Checks for #33 (the board as a Mac app that updates itself)

Spec: `docs/changes/33.md` at 3f21c2d. Base: d9f0fee (main). Rows were written from the spec before reading the
implementation. To drive them I read only `desktop/package.json` (how to build and start the app) and the names of
the files in the diff.

How they run:
- `app.mjs` (by hand, needs Electron and a display): starts the real Electron app under `xvfb-run` with Playwright's
  `_electron`, `--no-sandbox --demo`, with a fake `xdg-open` first on `PATH` that only logs what it was asked to
  open (that is how Electron hands a link to the person's browser on Linux). Takes screenshots of the window.
- `checks/*.mjs` (CI, plain Node): load `desktop/app/main.cjs` with `electron` and `electron-updater` replaced by
  fakes that record what the app asks of them, then play update events into it. `app.isPackaged` is set true.
- macOS-only rows (dmg, signing, notarization, the built app's smoke test, no Terminal window) are read from the
  release workflow run on a Mac (actions run 43532765073) and its logs.

| Row | Clause | Check | Where |
|---|---|---|---|
| AC1 local only | starts the board on this computer only (127.0.0.1) | the window's page is `http://127.0.0.1:<port>/`; the port answers on 127.0.0.1 and not on the machine's other address; `ss` shows it bound to 127.0.0.1 only | `app.mjs` |
| AC1 window | shows it in a window titled "Team Board" | exactly one window, title "Team Board", visible | `app.mjs` |
| AC1 no tab | No Terminal window, no browser tab | nothing was handed to the browser at start (fake `xdg-open` log empty); no Terminal on Mac: release run smoke | `app.mjs`, release run |
| AC1 close quits | Closing the window quits the app and stops the board | close the window: the Electron process exits within 10 s and the port no longer answers | `app.mjs` |
| AC2 same board | Everything #8, #10, #11 and #16 show works the same in the window | the window shows the same board as the one-file app's server with `--demo` (same `/api/board` JSON apart from time fields; same page HTML); cards render; Settings opens; the project picker and sign-in are reachable as in the browser board | `app.mjs` |
| AC2 demo | `--demo` shows the sample project | `/api/board` in the app is the sample project, page shows it | `app.mjs` |
| AC2 server | `server/main.ts` gains `startBoard()`, so the app starts the same server | the app's server answers the same routes as the one-file app (`/`, `/api/board`, settings routes) | `app.mjs` |
| AC3 links | A link to anything other than the board opens in the person's browser, never inside the app window | in the window: a `target=_blank` link to github.com, `window.open` to a try-it link, and a same-window navigation to a help page: each goes to the fake `xdg-open`; the window stays on the board; no second window | `app.mjs` |
| AC3 board links stay | (inverse) links to the board stay in the window | navigating to another board path on 127.0.0.1 stays in the window and is not handed to the browser | `app.mjs` |
| AC4 locked down | no Node in the page, context isolation and the sandbox on | in the page `require`, `process`, `module` are undefined; the window's web preferences have `nodeIntegration` false, `contextIsolation` true, `sandbox` true | `app.mjs`, `checks/ac4_ac6_main.mjs` |
| AC5 one copy | Opening the app again brings the open window forward instead of starting a second board | start a second copy with the same user data: it exits within 10 s, starts no second board (one listening port), the first window is shown and focused | `app.mjs` |
| AC6 check when opens | A packaged app checks this repo's latest published release when it opens | packaged: `checkForUpdates` called once on ready; unpackaged: not called; the feed is GitHub, this repo | `checks/ac4_ac6_main.mjs`, `desktop/package.json` |
| AC6 every 6 hours | and every 6 hours | a repeating timer of 6 h (21 600 000 ms) that calls the check again | `checks/ac4_ac6_main.mjs` |
| AC6 background | A newer version downloads in the background | auto download on; no dialog on `update-available` | `checks/ac4_ac6_main.mjs` |
| AC6 ask | then the app asks "A new version of Team Board is ready. Restart now?" with Restart and Later | on `update-downloaded` a dialog with exactly that text and buttons Restart, Later; Restart calls `quitAndInstall` | `checks/ac4_ac6_main.mjs` |
| AC6 later | Later installs it the next time the app quits | Later does not call `quitAndInstall`; `autoInstallOnAppQuit` is true | `checks/ac4_ac6_main.mjs` |
| AC6 menu | The app menu has "Check for Updates…", which also says when it's already up to date | menu has an item labelled `Check for Updates…` (one ellipsis character); clicking it and then `update-not-available` shows a dialog saying it is up to date | `checks/ac4_ac6_main.mjs` |
| AC6 quiet | No network or a failed check stays quiet (only the menu check says it couldn't check) | an `error` event (and a rejected check) after the start or timer check shows no dialog and does not crash; after a menu check it shows one dialog saying it couldn't check | `checks/ac4_ac6_main.mjs` |
| AC6 no drafts | Draft releases are never offered | prereleases not allowed; feed is GitHub releases (which skips drafts); no token in the app | `checks/ac4_ac6_main.mjs` |
| AC7 names | builds `Team-Board-<version>-arm64.dmg`, `.zip`, its `.blockmap` and `latest-mac.yml` with the release's version | release run: those files exist with the run's version and are attached to the draft release; config names them so | release run, `checks/ac7_release.mjs` |
| AC7 sign | signs and notarizes them when the Developer ID secrets are set (ad hoc otherwise, with a warning) | workflow: signing and notarization use the #28 secrets; when absent it signs ad hoc and prints a warning naming updates | release run, `checks/ac7_release.mjs` |
| AC7 smoke | starts the built app with the sample project and checks it serves the board | release run log shows the built app started with `--demo` and the board answered | release run |
| AC8 unchanged | The one-file apps, the npx package and their tests are unchanged | no existing test file changed; root `npm ci && npm run typecheck && npm test` and all earlier verifier checks pass at base and head; `npm pack --dry-run` file list the same at base and head; the one-file app build script unchanged | by hand, output in `README.md` |
| §3 own package | Its own `package.json`, so the npx package and the one-file app don't change | root `package.json` and lock unchanged | `checks/ac8_scope.mjs` |
| §8 deps | `electron` 45.2.3 and `electron-builder` 26.18.1 (build only), `electron-updater` 6.8.12 (inside the app), in `desktop/package.json` only | exact versions; electron and electron-builder in devDependencies, electron-updater in dependencies; none added at the root | `checks/ac8_scope.mjs` |
| §7 secrets | No new ones | workflow uses only the five #28 secrets and GITHUB_TOKEN | `checks/ac7_release.mjs` |
| scope | §4 scope out | no Ella chat, Windows or Intel build, icon or README change in the diff | by hand |
