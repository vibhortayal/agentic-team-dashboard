# Verification of #10 (board as a download and an npx command)

Round 1: **BLOCK** on `bad007a625d774442e715ff23265a6bb6af52add`. The spec is `docs/changes/10.md` v1 at that commit, and the base is `2f258b1`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`.

## Findings that block

**F1. #8's committed checks passed at the base and fail at the head (AC8, baseline rule).** All five `verification/8/checks/*.mjs` crash with `board did not start:`. They start the board with `node server/main.ts`. bad007a removed the block that ran `main()` when that file is started directly, so the process now exits 0 at once and prints nothing. The command moved to `server/cli.ts`. CI's verifier step will be red.

```
$ node server/main.ts --demo --port 45111 --no-open; echo rc=$?
rc=0                                  # at 2f258b1 this printed "Your progress board is open at ..."
$ bash .github/team/run-checks.sh     # at base 2f258b1 (throwaway worktree): 5 run, ok
$ bash .github/team/run-checks.sh     # at head bad007a: the 5 #8 checks FAIL "board did not start"
```

#8's behaviour itself still holds. In a scratch copy with the checks' start command changed to `server/cli.ts`, all five pass (39+37+30+17+43 = 166/166). The fix is to make `node server/main.ts` start the board again. The other way is for the coordinator to approve the Verifier changing `verification/8/checks/lib.mjs`. Either way the committed #8 checks are the repro, and they pass once it is fixed.

**F2. AC4: run from a project folder, a picked project is never shown.** AC4 says "After sign-in the page lists the projects ... The choice is saved; 'Change project' brings the list back." `server/main.ts:275` takes the folder's git remote as the project for `npx` and source runs. `Session.repo()` (`server/main.ts:38`) then puts that ahead of the saved choice. If someone types `npx team-board` inside their project folder, "Change project" brings the list back and saves the pick. The board keeps showing the folder's project anyway, and so does every later run from that folder.

```
$ node verification/10/checks/ac4_pick_project.mjs
  FAIL AC4 started in a project folder, "Change project" to acme/other shows acme/other (got status 200, board acme/garden, status.repo acme/garden)
```

Expected: after POST `/api/project {"repo":"acme/other"}` from the page, `/api/board` and `/api/status` show `acme/other`. The script passes once a pick is shown.

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm ci                       found 0 vulnerabilities
$ npm run typecheck            exit 0
$ npm test                     Test Files 4 passed (4), Tests 51 passed (51)
$ npm run package              Built dist-app/Team-Board-linux-x64   (125.2 MB, 5 s)
$ npm pack                     team-board-0.1.0.tgz (86 kB, 8 files)
$ time bash .github/team/run-checks.sh
AC1 one file runs (Linux): 9/9 passed
AC2 npx runs: 10/10 passed
AC3/AC5 sign in: 32/32 passed
AC4 pick a project: 19/20 passed            <- F2
AC6 only this page can act: 69/69 passed
AC7/section 7 docs and release: 12/12 passed
verification/8/checks/*: 0/1 each, "board did not start"   <- F1
verifier checks: 11 run, FAIL     real 0m11.0s
$ NODE_PATH=$(npm root -g) node verification/10/shots.mjs    33 ok, 0 FAIL, 20 screenshots
```

Selected lines:

```
  ok   AC1 there is no node on the app's PATH ("")
  ok   AC1 the app's folder still holds only the app (Team-Board-linux-x64)
  ok   AC2 installing it, offline, brings nothing else (team-board)
  ok   AC3 a check 0 s later doesn't ask GitHub again (calls 1 -> 1)
  ok   AC3 settings file is readable only by the user (mode 600)
  ok   AC3 the key is written nowhere else under HOME or the run folder (["home/.config/team-board/config.json"])
  ok   AC3 after GitHub says yes the page moved on by itself in 3.3 s
  ok   AC6 demo allows Stop (200, exit 0)
```

Tamper check: `git diff 2f258b1 bad007a -- verification/` is empty.

## Not proved here

- **AC1 on macOS and Windows: INCONCLUSIVE.** Neither system can run here, and the release workflow only runs on a `v*` tag or by hand. I read the workflow instead. Its smoke test runs the app from the checkout, with setup-node's Node on PATH. That shows the app starts and serves the page and `/api/board`. It doesn't show the app needs no Node and no other files (the Linux run shows that, and the code path is the same). Copying the app to `$RUNNER_TEMP` and running it there would close that gap.
- Nobody has double-clicked the download on a real Mac or Windows computer (spec section 9).
