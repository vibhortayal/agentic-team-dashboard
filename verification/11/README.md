# Verification of #11 (board for app testers)

Round 5: **PASS** on `5ded111`. The owner allowed a fifth round after round 4's BLOCK (round 1 on `4c85eeb`, evidence `aba0e47`; round 2 on `2bbc580`, `164dfaf`; round 3 on `3d97ee9`, `35b68db`; round 4 on `6e17670`, `417c710`). The spec is `docs/changes/11.md` v2 at `5ded111`: the owner chose that only a waiting change (labelled `needs-human`) shows Try it. Only AC1 changed. The base is `8f48f84`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`. The page checks and screenshots: `page.mjs` (by hand, needs Playwright).

## Round 4's finding: fixed

**F5 (a waiting change's older preview lost to open pull requests that aren't waiting): fixed.** Those pull requests get no status reads now. `ac1_waiting_second_read.mjs` 6/6, with 3 and 5 status reads. F1 to F4 are still fixed.

## The v2 rule

New check `ac1_not_waiting.mjs` (15/15): open pull requests at other stages, one with a `human:` label but no `needs-human`, and an issue with a comment `preview` get no Try it. Status reads go only to the live app and the waiting change (2, 1 or 0 by case). When the label comes off, the next refresh after the minute drops Try it and stops reading that preview. When the label goes back on, Try it comes back. On the round-4 code (`1bc1901`) it scores 4/15, so it tells the two rules apart. On the page (`page.mjs` section F), only the waiting card has Try it and no work card does.

## The builder's test edit

`server/app.test.ts` loosens nothing. The AC1 cases gain `needs-human`, which v2 needs for any link. "No preview, no link" now has the label too, so it tests the no-preview path; it is stricter than before. A new case says a change that isn't waiting gets no link. The AC5 read test names #4 as waiting so its statuses are still read, and its assertions are unchanged. Existing tests are read-only to the builder, so the owner still needs to add `tests-approved` before merge.

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm ci && npx vite build     exit 0, exit 0
$ bash .github/team/run-checks.sh       verifier checks: 21 run, ok; exit 0
#10 and #8 checks: all pass
AC1 Try it: 15/15                AC1 Try it with other open pull requests: 10/10
AC1 newest preview failed: 12/12 AC1 older preview before other pulls: 6/6   <- F5 fixed
AC1 v2 only waiting changes: 15/15 (new)
AC2 the ask: 23/23               AC2 masked keys with _: 10/10
AC3 your app: 19/19              AC5/sec 7 optional reads: 29/29
$ npm test                     Test Files 5 passed (5), Tests 63 passed (63)
$ npm run typecheck            exit 0
$ NODE_PATH=$(npm root -g) node verification/11/page.mjs     page.mjs: all ok (46), 16 screenshots, no sideways scroll
```

The 4 demo screenshots changed only in relative times. Scope: the fix touches the spec, `server/github.ts`, `server/model.ts`, `web/App.tsx` and `server/app.test.ts`, all for AC1 v2.

Tamper check: `git diff 417c710 5ded111 -- verification/` is empty.

## Notes (not blocking)

- A waiting change gets at most 2 status reads; with 6 or more waiting changes and a live link, some get no Try it. That needs more than section 7's 6 reads.
- `http://` and `javascript:` addresses still reach the data; the page shows only https links.
- HTML tags not on the list (`<center>`, `<mark>`, `<small>`) stay in the ask.

## Not proved here

How real hosts name their environments.
