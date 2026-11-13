# Verification of #11 (board for app testers)

Round 3: **BLOCK** on `3d97ee9`. This is the third BLOCK on #11 (round 1 on `4c85eeb`, evidence `aba0e47`; round 2 on `2bbc580`, evidence `164dfaf`), so it goes to the coordinator, not back to the builder. The spec is `docs/changes/11.md` v1 at `4c85eeb`, unchanged since, and the base is `8f48f84`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`. The page checks and screenshots: `page.mjs` (by hand, needs Playwright).

## Round 2's findings: fixed

- **F1 (older waiting changes lost their Try it to other open pull requests): fixed.** `ac1_other_pulls.mjs` 10/10, with 5 and 6 status reads.
- **F3 (keys with `_` shown on the card): fixed.** The ask is masked before it is cleaned. `ac2_masked.mjs` 10/10.
- F2 (HTML tags) is still fixed: `ac2_ask.mjs` 23/23.

## Finding that blocks

**F4, new. AC1: a waiting change whose newest preview failed gets no Try it when there are 3 waiting changes and a live link.** AC1 says the button opens "the latest successful non-production deployment whose branch or commit matches the pull request". The status reads rewritten for F1 (`server/github.ts:160-168`) follow a fixed order and stop at 6: the newest live deployment, each waiting change's newest preview, the second live deployment, then each waiting change's second preview. The second previews get read even when the newest one worked, so the last waiting change in GitHub's pull order never gets its older preview read.

Repro: waiting pull requests #42, #41, #40, each with a working day-8 preview and a day-9 preview, plus one live deployment. #40's day-9 preview failed. The reads go to live, 42-9, 41-9, 40-9 (failed), 42-8 and 41-8. #40's working day-8 preview is never read.

```
$ node verification/11/checks/ac1_failed_newest.mjs
  FAIL AC1 #40's newest preview failed: waiting change #40 has Try it https://40-8.preview.example (got null; 6 status reads)
AC1 Try it when a waiting change's newest preview failed: 11/12 passed
```

Expected: #40's Try it is `https://40-8.preview.example`. Five status reads are enough (live, the three newest previews, then #40's older one), inside section 7's 6. When #41's or #42's newest preview is the one that failed, the board gets it right.

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm ci && npx vite build     exit 0, exit 0
$ npm run typecheck            exit 0
$ npm test                     Test Files 5 passed (5), Tests 62 passed (62)
$ bash .github/team/run-checks.sh
#10 and #8 checks: all pass
AC1 Try it: 15/15                AC1 Try it with other open pull requests: 10/10
AC2 the ask: 23/23               AC2 masked keys with _: 10/10
AC3 your app: 19/19              AC5/sec 7 optional reads: 29/29
verifier checks: 18 run, ok      (before ac1_failed_newest.mjs was added)
$ node verification/11/checks/ac1_failed_newest.mjs     11/12   <- F4
$ NODE_PATH=$(npm root -g) node verification/11/page.mjs     page.mjs: all ok, 16 screenshots, no sideways scroll
```

Tamper check: `git diff 164dfaf 3d97ee9 -- verification/` is empty.

## Notes (not blocking)

- Only lowercase tags from a fixed list are stripped now. `<DETAILS>`, `<center>`, `<mark>` and `<small>` stay on the card; round 2's code took them out. The team's own `<details>` and `<summary>` go. "a<b and c>d" still becomes "ad", though the code comment says it stays.
- Production now means prod, production, "Production – name" or github-pages. "production-preview", "prod staging" and "Production–x" (no spaces) don't count.

## Not proved here

How real hosts name their environments.
