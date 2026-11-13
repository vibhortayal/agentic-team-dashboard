# Verification of #11 (board for app testers)

Round 1: **BLOCK** on `4c85eeb`. The spec is `docs/changes/11.md` v1 at that commit, and the base is `8f48f84`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity). The check was not separate, and there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`. The page checks and screenshots: `page.mjs` (by hand, needs Playwright).

## Findings that block

**F1. AC1: a waiting change loses its Try it button once two newer previews of other branches exist.** AC1 says the button opens "the latest successful non-production deployment whose branch or commit matches the pull request". `server/github.ts:158` reads the status of only the 2 newest deployments per environment, whatever branch they are for. On a project where every push to any branch makes a preview, the waiting change's preview soon drops out, and the card shows no button. That's one waiting change and 3 deployments, well inside the 6 status reads section 7 allows.

```
$ node verification/11/checks/ac1_try_it.mjs
  ok   AC1 the change's preview is found when 1 newer preview of another branch exists
  FAIL AC1 the change's preview is found when 2 newer previews of other branches exist (want "https://seeds-new.preview.example", got null)
```

With 3 waiting changes that each have a preview, only 2 get the button (`ac5_optional.mjs` note). Picking the deployments that match the waiting pull requests' branches and commits before spending the status reads would fix both.

**F2. AC2: HTML tags in the ask are shown as text.** AC2 says the ask is shown "in plain text: no Markdown marks, ... no hidden data". `plainMessage` (`server/model.ts:205`) removes HTML comments but not tags. An asking comment with a collapsed `<details><summary>More</summary>...</details>` block shows those tags on the card.

```
$ node verification/11/checks/ac2_ask.mjs
  FAIL AC2 plain text: no HTML tags (GitHub Markdown's <details>, <summary> ...) (got "<details> <summary> </summary> </details>")
```

## Commands and real output (Node 22.23.4, Linux x64)

```
$ npm run typecheck            exit 0
$ npm test                     Test Files 5 passed (5), Tests 62 passed (62)
$ time bash .github/team/run-checks.sh
AC1 one file runs (Linux): 9/9           AC2 npx runs: 10/10
AC3/AC5 sign in: 32/32                   AC4 pick a project: 20/20
AC6 only this page can act: 69/69        AC7/section 7 docs and release: 12/12
AC1 Try it: 14/15                <- F1
AC2 the ask: 22/23               <- F2
AC3 your app: 19/19              AC5/sec 7 optional reads: 29/29
#8: AC1-AC4 39/39, AC5/read rate 37/37, AC6 30/30, AC7/AC8 17/17, AC9 63/63
verifier checks: 15 run, FAIL    real 0m23.5s
$ NODE_PATH=$(npm root -g) node verification/11/page.mjs     all ok, 16 screenshots, no sideways scroll
$ NODE_PATH=$(npm root -g) node verification/10/shots.mjs    33 ok, 0 FAIL (screenshots not kept)
```

Selected lines from `page.mjs`:

```
  ok   AC4 board with cards, Your app and Try it: no link points at github.com (2 links: ["https://seeds.preview.example/","https://garden.example/"])
  ok   AC1 only https: an http deployment and a javascript: comment preview are not Try it links
  ok   AC2 the ask is shown in plain text: "What I need\n\nPlease try the new seed list and read the plan.\n\n• Does it load?\n• Is it easy to read?"
  ok   AC3 the draft shows as "Ready to go live, waiting for your OK"
  ok   AC3 with none of these it says the app isn't online yet
  ok   AC4 the can't-read message: no link points at github.com (0 links: [])
  ok   AC4 demo board: no link points at github.com
```

Section 7: with 20 deployments and 3 waiting changes, one refresh reads 7 times (releases, deployments, pulls, 4 statuses), and refreshes inside the minute read none.

Tamper check: `git diff 7b1a653 4c85eeb -- verification/` is empty.

## Not proved here

How real hosts name their environments. The board treats only an environment named "production" or "prod" as live. GitHub Pages ("github-pages") and Vercel projects named "Production – <project>" get no "Open your app" (see the notes).
