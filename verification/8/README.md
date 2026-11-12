# Verification of #8 (progress board)

Round 3: **PASS** on `01c6e4c91dcc12ab7806622bd6d3b515e7367926` (the TypeScript rebuild). Spec `docs/changes/8.md` v2 at that commit, base `721cc0f`. Round 2 was PASS on the Python board `bcef76d` (evidence `3575899`); round 1 was BLOCK on `d982294` (evidence `6210831`).

The Verifier ran in the same account as the builder (prototype profile, no checker identity), so the check was not separate and there is no checker approval. The owner should read this folder before merging.

Rows and how each is checked: `checks.md`. Per-row results and notes: `verdict.json`.

## Round 3 commands and real output

Tamper check: `git diff 3575899 01c6e4c -- verification/` is empty. The Python checks and `shots.js` were removed in this round (they ran the deleted `app/board.py`) and replaced with Node checks.

Setup, as CI will run it (`SETUP_CMD`), on Node 22.23.4:

```
$ npm ci && npm run build
found 0 vulnerabilities
dist/index.html                   0.37 kB │ gzip:  0.26 kB
dist/assets/index-CnUu6Ni-.css    4.84 kB │ gzip:  1.65 kB
dist/assets/index-BKRfvSxW.js   224.81 kB │ gzip: 70.49 kB
✓ built in 104ms
```

Baseline at base `721cc0f` (throwaway worktree): `bash .github/team/run-checks.sh` gave `verifier checks: 0 run, ok`.

Full run at the head (the guard refuses every connection off this computer; GitHub is a local fake):

```
$ time bash .github/team/run-checks.sh
AC1-AC4: 39/39 passed
check ok   verification/8/checks/ac1_ac4_board.mjs
AC5/read rate: 37/37 passed
check ok   verification/8/checks/ac5_read_rate.mjs
AC6: 30/30 passed
check ok   verification/8/checks/ac6_secrets.mjs
AC7/AC8/data model: 17/17 passed
check ok   verification/8/checks/ac7_ac8_demo_local.mjs
AC9: 43/43 passed
check ok   verification/8/checks/ac9_plain_words.mjs
verifier checks: 5 run, ok
real	0m2.720s
```

Selected lines:

```
  ok   7 one GitHub read per minute at most: refresh 59 s after a read (issue-list calls 2 -> 2)
  ok   7 a refresh after the minute reads GitHub again (issue-list calls 2 -> 3)
  ok   7 50 open items load in under 5 s (50 cards in 0.074 s)
  ok   AC8 every listening socket on port 36255 is 127.0.0.1 (["/proc/net/tcp:0100007F"])
  ok   guard self-test: a real-mode read is caught (["fetch https://api.github.com/repos/acme/garden/issues?state=open&per_page=100"])
  ok   AC7 `npm run demo` serves the sample board (7 cards)
```

The read at 62 s shows the clock step reaches the board, so the 12 s and 59 s results mean something; the guard self-test shows "no network attempt in demo mode" means something.

Old-Node probe (Node 20 faked with a preload): each check stops at once with

```
FAIL these checks need Node 22.18 or newer (the board runs server/main.ts directly); this runner has Node 20.11.1. Set up Node 22.18+ before running them.
exit 1
```

Builder's own checks:

```
$ npm run typecheck     # tsc --noEmit, clean
$ npm test
 Test Files  3 passed (3)
      Tests  44 passed (44)
```

Browser (by hand, not a CI check): `NODE_PATH=$(npm root -g) node verification/8/shots.mjs` starts the demo, a board whose GitHub drops the connection, and a board with no open items, and takes Playwright Chromium screenshots at 1440x900 and 390x844 (deviceScaleFactor 1), light and dark: `demo-*.png`, `error-*.png`, `empty-*.png`. All 12: no page errors, no horizontal scroll (scrollWidth equals the viewport), no jargon in the visible first-screen text. The error page says "The board can't reach GitHub. Check your internet connection." with "Look at it on GitHub instead" linking https://github.com/acme/garden and no cards.
