# Verification of #11 (board for app testers)

Round 4: **BLOCK** on `6e17670`. This is the fourth BLOCK on #11, the one extra round the owner allowed (round 1 on `4c85eeb`, evidence `aba0e47`; round 2 on `2bbc580`, evidence `164dfaf`; round 3 on `3d97ee9`, evidence `35b68db`), so it goes to the coordinator, not back to the builder. The spec is `docs/changes/11.md` v1 at `4c85eeb`, unchanged since, and the base is `8f48f84`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`. The page checks and screenshots: `page.mjs` (by hand, needs Playwright).

## Round 3's finding: fixed

**F4 (a waiting change whose newest preview failed lost its Try it): fixed.** `ac1_failed_newest.mjs` 12/12, with 5 status reads whichever change's preview failed. F1, F2 and F3 are still fixed.

## Finding that blocks

**F5, new. AC1: a waiting change whose newest preview failed loses its Try it to open pull requests that aren't waiting.** AC1 says the button opens "the latest successful non-production deployment whose branch or commit matches the pull request". The read order rewritten for F4 (`server/github.ts:177-184`) first reads the newest deployment of every place: the live app, each waiting change, then each other open pull request. Only then does any place get a second read. Other open pull requests show no Try it, but their reads use up the 6 before the waiting change gets its older preview read.

Repro (a): 1 live deployment; waiting #40 with a working day-8 preview and a failed day-9 one; 4 other open pull requests with one preview each. The reads go to live, 40-9 (failed), then the 4 others: 6. #40's working day-8 preview is never read, though 3 reads would do. Case (a) passed on round 3's code, so the fix broke it. Case (b), with 3 waiting changes and 2 other open pull requests, needs 5 reads and fails on both.

```
$ node verification/11/checks/ac1_waiting_second_read.mjs
  FAIL AC1 (a) waiting change #40 has Try it https://40-8.preview.example (got null; 6 status reads)
  FAIL AC1 (b) waiting change #40 has Try it https://40-8.preview.example (got null; 6 status reads)
AC1 Try it: a waiting change's older preview before other open pull requests: 4/6 passed
```

Expected: #40's Try it is `https://40-8.preview.example` in both cases, inside section 7's 6 reads.

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm ci && npx vite build     exit 0, exit 0
$ bash .github/team/run-checks.sh       verifier checks: 20 run, FAIL (ac1_waiting_second_read.mjs, F5); exit 1
#10 and #8 checks: all pass
AC1 Try it: 15/15                AC1 Try it with other open pull requests: 10/10
AC1 newest preview failed: 12/12 <- F4 fixed
AC2 the ask: 23/23               AC2 masked keys with _: 10/10
AC3 your app: 19/19              AC5/sec 7 optional reads: 29/29
$ npm test                     Test Files 5 passed (5), Tests 62 passed (62)
$ npm run typecheck            exit 0
$ NODE_PATH=$(npm root -g) node verification/11/page.mjs     page.mjs: all ok, 16 screenshots, no sideways scroll
$ node verification/11/checks/ac1_waiting_second_read.mjs    4/6   <- F5
```

The 4 demo screenshots changed only in relative times ("8 hours ago" is now "9 hours ago").

Tamper check: `git diff 35b68db 6e17670 -- verification/` is empty.

## Notes (not blocking)

- A key used as link text now shows only "[hidden: github token]". A key wrapped in `_` gets past the ask's own mask, but the board-wide mask hides it: on the board it shows hidden and isn't in the data.
- HTML tags match in any case now. `<center>`, `<mark>` and `<small>` aren't on the list and stay; "a<b and c>d" still becomes "ad".
- A change gets at most 2 status reads: if its two newest previews both failed, an older working one is never read.

## Not proved here

How real hosts name their environments.
