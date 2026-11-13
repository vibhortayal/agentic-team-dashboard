# Verification of #10 (board as a download and an npx command)

Round 2: **PASS** on `8f48f84e4677032c93bb066982d463dc482c4607`. The spec is `docs/changes/10.md` v1, unchanged since round 1, and the base is `2f258b1`.

Round 1 was a BLOCK on `bad007a` (evidence `7b1a653`), with two findings. Both are fixed.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`.

## Round-1 findings, rerun first

**F1 fixed.** `node server/main.ts` starts the board again, and all five #8 checks pass (166/166).

```
$ node server/main.ts --demo --port 45111 --no-open
Your progress board is open at http://localhost:45111
```

**F2 fixed.** `Session.repo()` now puts `--repo` first, then the saved pick, then the folder's remote. Started in a folder whose remote is acme/garden, a pick of acme/other is shown.

```
  ok   AC4 started in a project folder, "Change project" to acme/other shows acme/other (got status 200, board acme/other, status.repo acme/other)
AC4 pick a project: 20/20 passed
```

## Changed code, checked

- Project names: an owner or name of `.` or `..` is refused and not saved. Names that only contain dots still work. The new `checks/ac4_dot_names.mjs` gets 4/10 on the round-1 code and 10/10 now.
- The release smoke test now copies the app alone into an empty folder and runs it there. That's read, not run (see below).

## Commands and real output (Node 22.23.4, Linux x64, clean worktree at 8f48f84)

```
$ npm ci && npm run build      found 0 vulnerabilities; built
$ npm run typecheck            exit 0
$ npm test                     Test Files 4 passed (4), Tests 51 passed (51)
$ time bash .github/team/run-checks.sh
AC1 one file runs (Linux): 9/9           AC2 npx runs: 10/10
AC3/AC5 sign in: 32/32                   AC4 pick a project: 20/20
AC4 dot names: 10/10                     AC6 only this page can act: 69/69
AC7/section 7 docs and release: 12/12
#8: AC1-AC4 39/39, AC5/read rate 37/37, AC6 30/30, AC7/AC8 17/17, AC9 43/43
verifier checks: 12 run, ok      real 0m12.1s
$ NODE_PATH=$(npm root -g) node verification/10/shots.mjs    33 ok, 0 FAIL (screens unchanged)
```

Tamper check: `git diff 7b1a653 8f48f84 -- verification/` is empty.

## Not proved here

- **AC1 on macOS and Windows.** Neither system can run here. The release workflow's smoke test now matches the clause: the app runs alone in an empty folder. It runs only on a `v*` tag or by hand, and the release job needs it to pass. So a Mac or Windows file that doesn't start stops the release rather than shipping. Setup-node's Node is still on PATH there. The app carries its own Node, and the Linux run shows it needs none.
- Nobody has double-clicked the download on a real Mac or Windows computer (spec section 9).
