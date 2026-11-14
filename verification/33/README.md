# Verification of #33

## Round 2: BLOCK (F1)

Reviewed revision ec0e18c19b4f19470419e9720a0452e2b5176db7. Spec `docs/changes/33.md` draft v2 at ec0e18c (adds AC9, AC10).
I wrote the round 2 rows into `checks.md` and committed them (6d98c82) before reading the new code. Then I read only the
GitHub addresses that `server/updates.ts` asks for.

### F1: two reads at the same moment ask GitHub twice (AC10)

- **Clause (AC10):** "It asks GitHub at most every six hours per project."
- **Repro:** `npm run build && node verification/33/checks/f1_team_check_together.mjs`. It starts the board for a project
  whose `.team/VERSION` is behind, then sends two `GET /api/updates` requests together. This is what two board tabs opened
  at once do: each page loads `/api/updates` when it opens.
- **Expected:** one `.team/VERSION` read and one agentic-team-oss compare read, both answered from that single round.
- **Actual:** with 2 reads, 2 VERSION reads and 2 compare reads. With 5 reads, 5 and 5. The six-hour cache is filled
  only after GitHub answers, so every read that arrives before then asks GitHub itself. Reads that come one after
  another are cached correctly.

### What ran at ec0e18c

| What | Result |
|---|---|
| `npm ci && npm run typecheck` | ok |
| `npm test` | 94 passed (10 files) |
| `npm run build` | ok |
| `bash .github/team/run-checks.sh` | 40 run; only `verification/33/checks/f1_team_check_together.mjs` fails (F1) |
| `checks/ac9_ac10_board.mjs` (new) | 27/27 ok (`checks-ac9_ac10_board.log`) |
| `checks/ac4_ac6_main.mjs` | 31 ok (round 1's 23, plus 8 for AC9). Its fake built board now also has `setAppUpdate` (`checks-ac4_ac6_main.log`) |
| `checks/ac7_ac8_files.mjs` | 28 ok |
| `app.mjs` (real app, desktop rebuilt with `npm run board`) | 64 ok, 0 failed (`app.log`) |

Passed in round 2:
- **AC9:**
  - After `update-downloaded` in the real app, a "Check now" brings up "A new version of Team Board is ready." with a
    Restart now button. Pressing it calls `quitAndInstall`.
  - The app's own box asks once per version: the same version again asks nothing; 0.3.0 asks once more.
  - Outside the Mac app, `/api/updates` has no app notice. A restart request is refused (400) and the board keeps running.
  - A restart request from another site's page is refused (403).
- **AC10:**
  - **Notice:** a VERSION behind main turns the notice on, with "update the team". VERSION at main's newest commit,
    even with trailing spaces, gives no notice.
  - **Read only:** every request is a GET.
  - **Six-hour cache:** later reads are cached. At 6 h minus a minute nothing is asked again; at 6 h plus a minute,
    one more round.
  - **Per project:** another project is asked about separately.
  - **Quiet cases:** no notice and no error, with the cards still showing, when:
    - there is no VERSION file, or it names no commit
    - agentic-team-oss doesn't have the commit
    - either read answers 500, a rate limit, a reset connection or broken JSON
  - **Demo:** the demo shows the notice without using the network.
- **Screenshots:** `news-*` shows both notices, at 420 and 1280 px, light and dark, with no sideways scroll.

Round 1's note 2 (asking again after Later) is fixed by AC9's once per version.

Notes (round 2):
- The release workflow was not rerun after round 2. `desktop/app/main.cjs` and the server changed, so the Mac smoke test
  covers round 1's code, not this revision.
- Every quiet failure is cached for six hours too, so one GitHub hiccup hides the team notice until the next check.
  The spec allows this ("stays quiet").
- The one-file app shows the team notice too, because it is the same board. AC10 says "the board", so this is expected;
  AC8 says the one-file app is unchanged, but its existing tests are unchanged and pass.

## Round 1: PASS (at e1999fc)

Reviewed revision e1999fc57f11466fc205a548f7f82ed280b07f3d (the build at 4907efe plus the coordinator's release.yml fix:
job renamed `mac_app`, 15-minute timeout). Base d9f0fee. Spec `docs/changes/33.md` at 3f21c2d. Rows: `checks.md`,
committed (02eec94) before the implementation was read.

## What ran

| What | Base d9f0fee | Head e1999fc |
|---|---|---|
| `npm ci && npm run typecheck` | ok | ok |
| `npm test` | 87 passed | 89 passed (2 new, `server/start.test.ts`) |
| `npm run build` | ok | ok |
| `bash .github/team/run-checks.sh` (every earlier verifier check) | 36 run, ok | 38 run, ok (36 earlier + 2 of #33) |
| `npm pack --dry-run --ignore-scripts` | 8 files | the same 8 files; only `dist-server/board.cjs` differs (it holds `startBoard()`) |

At 4907efe, before the coordinator's fix, `verification/10/checks/ac7_sec7_docs_release.mjs` failed (25-minute job,
hyphenated name). It passes at e1999fc.

#33's own checks:

- `app.mjs`, the real app under xvfb (Electron 45.2.3, `--no-sandbox`): 53 ok, 0 failed. Output in `app.log`.
  Command: `REF=<built checkout of e1999fc> NODE_PATH=$(npm root -g) xvfb-run -a node verification/33/app.mjs`.
- `checks/ac4_ac6_main.mjs` (CI): main.cjs with fake electron and electron-updater, 23 ok. Output in `checks-ac4_ac6_main.log`.
- `checks/ac7_ac8_files.mjs` (CI): dependencies, update feed, release job, secrets, 28 ok. Output in `checks-ac7_ac8_files.log`.
- By hand: `git diff --name-only d9f0fee e1999fc` lists only release.yml, desktop/*, docs/changes/33.md,
  scripts/build-desktop.mjs, server/main.ts, server/start.test.ts and verification/33. Modified existing files: release.yml
  and server/main.ts only, so no existing test changed. README, the one-file app build (`scripts/package-app.mjs`), `bin/`
  and the root package files are unchanged. Nothing from §4 scope out is in the diff.
- Version stamping, on Linux because there is no Mac here: the workflow's own step (`npm version --no-git-tag-version 0.2.0`) on a
  copy of `desktop/`, then `electron-builder --linux zip`, gave `Team-Board-0.2.0-x64.zip` with `resources/app-update.yml`
  pointing at this repo's GitHub releases.

Release workflow run 43532765073 on a Mac (at 4907efe; e1999fc changes only the job's name and timeout). Every job succeeded,
and the mac-app job took 1 min 56 s. With no Developer ID secrets set, it printed the warning "The Developer ID secrets
aren't set, so Team Board is signed ad hoc: the Mac warns people and the app can't update itself." It signed ad hoc and
built `Team-Board-0.1.0-arm64.dmg`, `.zip`, both `.blockmap` files and `latest-mac.yml`. `codesign --verify --deep --strict`
passed, `app-update.yml` is in the app, and the built app started with `--demo` and served `sample/recipe-box`. The 5 files
were uploaded as an artifact. The release job was skipped because no version was given.

Screenshots of the app window at 420 px (its minimum width) and 1280 px, in light and dark, with no sideways scroll:
`demo-*` (the sample board), `settings-*` (Settings and keys) and `start-*` (no project chosen).

## Notes (no clause broken)

1. The window loads `http://localhost:<port>` while the server listens on 127.0.0.1 only. Same as the one-file app, and it
   works. A board link written as `http://127.0.0.1:<port>/…` counts as "not the board" and opens in the browser.
2. Each `update-downloaded` event shows the Restart/Later question. After Later, a later 6-hourly check may download the
   same version again and ask again. No clause covers how often to ask.
3. If a 6-hourly check starts while a "Check for Updates…" check is still waiting, the menu check can end without
   saying anything (one shared flag). This is rare.
4. Dark mode: under xvfb on Linux, Electron's nativeTheme does not reach the page, so the dark screenshots set the
   colour scheme on the page directly. The app leaves `themeSource` at "system", so on a Mac it follows the system setting
   (not seen here).

## Not tested (risk)

- Spec §9: a real update from one signed release to the next, and a person opening the downloaded disk image.
- The Developer ID path: signing with the hardened runtime, notarization, and whether Apple answers within the job's
  15 minutes. The ad hoc build took under 2 minutes. electron-builder notarizes the app inside the dmg and zip. The dmg file
  itself is not signed by default.
- Stamping the version on the Mac and attaching the files to a draft release: the run gave no version, so those steps
  were skipped. They were checked from the workflow text, and stamping was run on Linux.
- "No Terminal window" on a Mac: a `.app` bundle has none. The smoke test started the binary directly.
