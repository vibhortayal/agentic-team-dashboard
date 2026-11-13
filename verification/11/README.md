# Verification of #11 (board for app testers)

Round 2: **BLOCK** on `2bbc580`. Round 1 was BLOCK on `4c85eeb` (evidence `aba0e47`). The spec is `docs/changes/11.md` v1 at `4c85eeb`, unchanged since, and the base is `8f48f84`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`. The page checks and screenshots: `page.mjs` (by hand, needs Playwright).

## Round 1's findings

- **F2 (HTML tags in the ask): fixed.** `ac2_ask.mjs` 23/23, and the page shows no tags.
- **F1 (Try it lost to other branches' previews): round 1's repro passes, but the clause still fails.** See below.

## Findings that block

**F1, still open. AC1: a waiting change gets no Try it when other open pull requests use up the status reads.** AC1 says the button opens "the latest successful non-production deployment whose branch or commit matches the pull request". `server/github.ts:159-160` now spends up to 2 status reads on every open pull request in GitHub's order (newest first), whether it is waiting for the person or not. Older waiting changes get none of the 6 reads.

```
$ node verification/11/checks/ac1_other_pulls.mjs
  FAIL AC1 the one waiting change has Try it when 3 open pull requests that aren't waiting have newer previews (want "https://seeds.preview.example", got null; 6 status reads)
  FAIL AC1 waiting change #40 of 3 has Try it, its newest preview (got null; 6 status reads)
AC1 Try it with other open pull requests: 8/10 passed
```

The first case needs 2 status reads and the second 5, both inside section 7's 6.

**F3, new. AC2: keys with `_` in them are shown on the card.** AC2 says the ask is "masked". `plainMessage` (`server/model.ts:218`) takes out every `_` as an emphasis mark before masking runs (`model.ts:336`). After that a `ghp_`, `github_pat_`, `npm_`, `sk_live_` or `sbp_` key no longer matches its shape, so it reaches the card whole, minus the `_`. Release notes (`model.ts:250`) go the same way. This was in `4c85eeb` too. My round-1 row missed it because it only looked for the whole key, `_` included.

```
$ node verification/11/checks/ac2_masked.mjs
  FAIL AC2 masked: a github token (ghp_) in the ask is hidden (got "Sign in with ghpQ7vX2mR9kL4tW8nB3pZ6cY1dH5gJ0fSaEuio and tell me if it works.")
  ... the same for github_pat_, npm_, sk_live_, sbp_
AC2 masked keys with _: 5/10 passed
```

## The builder's test change

`server/app.test.ts`: the fake pull request's branch went from `b` to `main`, the branch every fake deployment is on. With the new design only an open pull request's previews get a status read, so with `b` none would be read. The assertions (at most 10 reads, d19's link, every link ok) are unchanged. This doesn't loosen anything, and the file is new in #11, so it isn't an existing test.

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm ci && npx vite build     exit 0, exit 0
$ npm run typecheck            exit 0
$ npm test                     Test Files 5 passed (5), Tests 62 passed (62)
$ bash .github/team/run-checks.sh
#10 and #8 checks: all pass (9/9, 10/10, 32/32, 10/10, 20/20, 69/69, 12/12, 39/39, 37/37, 30/30, 17/17, 63/63)
AC1 Try it: 15/15                AC2 the ask: 23/23
AC1 Try it with other open pull requests: 8/10   <- F1
AC2 masked keys with _: 5/10                     <- F3
AC3 your app: 19/19              AC5/sec 7 optional reads: 29/29
verifier checks: 18 run, FAIL
$ NODE_PATH=$(npm root -g) node verification/11/page.mjs     page.mjs: all ok, 16 screenshots, no sideways scroll
```

Section 7: with 20 deployments and 3 waiting changes, one refresh reads 9 times (releases, deployments, pulls, 6 statuses), and refreshes inside the minute read none.

Tamper check: `git diff aba0e47 2bbc580 -- verification/` is empty.

## Not proved here

How real hosts name their environments. "Production – <project>" and "github-pages" now count as live, and so do names like "production-preview" (see the notes).
