# Verification of #8 (progress board), round 1: BLOCK

Reviewed revision `d9822945bc18e84b72d5324cfaedae15a51acd94`, spec `docs/changes/8.md` at that revision. Base `721cc0f`. Checks were written from the spec (see `checks.md`) before reading `app/`; only `app/github_read.py` and `app/board.py` were read to learn how to feed hand-made data. The Verifier ran in the same account as the builder, so the check was not separate.

## Commands and real output

Baseline at base (throwaway worktree): `bash .github/team/run-checks.sh` gave `verifier checks: 0 run, ok`.

Builder's tests at head: `python3 -m unittest discover -s app/tests` gave `Ran 20 tests ... OK`.

Verifier checks at head: `bash .github/team/run-checks.sh` (1 min 16 s, python3 only, no network: the harness refuses every non-loopback connect and serves GitHub data from fixtures):

```
  FAIL AC4 #21 shows 'Checked: passed' (got 'Checked: it works')
  FAIL AC4 #23 shows 'Not checked yet' (got 'Check not finished')
  FAIL AC4 only #21 shows 'Checked: passed' (got [])
AC1-AC4: 35/38 passed
  FAIL 7 one GitHub read per minute at most: refresh 12 s later read again (open+closed issue-list calls went 2 -> 4)
AC5/read rate: 33/34 passed
AC6: 28/28 passed
  FAIL data model: card has number,title,url,kind,stage,holder,update,check,needed (missing ['stage'])
AC7/AC8/data model: 14/15 passed
AC9: 57/57 passed
verifier checks: 5 run, FAIL
```

50 items with 5 comments each, through the same harness: `50 items: 0.041 s; cards 50 calls 52`.

Browser (run by hand, not a CI check): `NODE_PATH=$(npm root -g) node verification/8/shots.js <port> verification/8 <tag>` with Playwright Chromium at 1440x900 and 390x844, deviceScaleFactor 1, light and dark, for the demo, a GitHub-unreachable board and an empty board. No page errors, no horizontal scroll (scrollWidth equals width), first screen in plain words. Screenshots: `demo-*.png`, `error-*.png`, `empty-*.png`.

## Findings (block)

1. AC4, `app/model.py:62`: latest verdict PASS shows "Checked: it works"; the clause says "Checked: passed".
2. AC4, `app/model.py:64`: latest verdict INCONCLUSIVE shows "Check not finished"; the clause says anything but PASS or BLOCK shows "Not checked yet".
3. Section 7, `app/board.py:49`: "Check now" (`/api/board?refresh=1`) reads GitHub again once the data is 10 s old; the spec allows one GitHub read per minute at most.
4. Section 8, `app/model.py:183`: cards carry `column`, not `stage`; the spec lists `stage` among the card fields.

Notes are in `verdict.json`.
