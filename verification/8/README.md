# Verification of #8 (progress board)

Round 2: **PASS** on `bcef76dd128d59c67292560b7e6dce5ec96a09bf`. Spec `docs/changes/8.md` (unchanged since round 1), base `721cc0f`. Round 1 was BLOCK on `d9822945bc18e84b72d5324cfaedae15a51acd94`, evidence commit `62108315bff3f50a6e0ee184d834b122980a89e2`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity), so the check was not separate and there is no checker approval. The owner should read this folder before merging.

Checks were written from the spec (see `checks.md`) before reading `app/`. Notes and the per-row results are in `verdict.json`.

## Round 2 commands and real output

Tamper check: `git diff 6210831 bcef76d -- verification/` is empty. The fix touched `app/board.py`, `app/model.py`, `app/static/board.js` and `app/tests/test_model.py` only.

Round-1 repros first, at the head:

```
$ python3 verification/8/checks/ac1_to_ac4_board.py
  ok   AC4 #21 shows 'Checked: passed' (got 'Checked: passed')
  ok   AC4 only #21 shows 'Checked: passed' (got [21])
AC1-AC4: 38/38 passed
$ python3 verification/8/checks/ac7_ac8_demo_local.py
AC7/AC8/data model: 15/15 passed
$ python3 verification/8/checks/ac5_cant_read.py      # old version, real 74 s wait
  ok   7 one GitHub read per minute at most: refresh 12 s later read again (open+closed issue-list calls went 2 -> 2)
AC5/read rate: 34/34 passed
real	1m14.973s
```

Then the AC5 check was changed to step the board's clock instead of sleeping (the harness adds an offset from a file to `time.time` and `time.monotonic` inside the board process; `Board.advance(s)` moves it). It now also checks a refresh at 59 s, the last second inside the minute. Probe against the round-1 revision in a throwaway worktree, to show it still catches finding 3:

```
  FAIL 7 one GitHub read per minute at most: refresh 12 s after a read (open+closed issue-list calls 2 -> 4)
  FAIL 7 one GitHub read per minute at most: refresh 59 s after a read (open+closed issue-list calls 2 -> 6)
AC5/read rate: 30/34 passed
```

Baseline at base `721cc0f` (throwaway worktree): `bash .github/team/run-checks.sh` gave `verifier checks: 0 run, ok`.

Full run at the head, python3 only, no network (the harness refuses every non-loopback connect and serves GitHub data from fixtures):

```
$ time bash .github/team/run-checks.sh
AC1-AC4: 38/38 passed
check ok   verification/8/checks/ac1_to_ac4_board.py
AC5/read rate: 35/35 passed
check ok   verification/8/checks/ac5_cant_read.py
AC6: 28/28 passed
check ok   verification/8/checks/ac6_secrets.py
AC7/AC8/data model: 15/15 passed
check ok   verification/8/checks/ac7_ac8_demo_local.py
AC9: 67/67 passed
check ok   verification/8/checks/ac9_plain_words.py
verifier checks: 5 run, ok
real	0m1.805s
$ python3 -m unittest discover -s app/tests
Ran 22 tests in 0.004s
OK
```

Browser (by hand, not a CI check): the demo, a GitHub-unreachable board and an empty board, each with `NODE_PATH=$(npm root -g) node verification/8/shots.js <port> verification/8 <tag>` (Playwright Chromium, 1440x900 and 390x844, light and dark). No page errors, no horizontal scroll, first screen in plain words, the badge reads "Checked: passed". Screenshots: `demo-*.png`, `error-*.png`, `empty-*.png` (only the two desktop demo shots changed).

## Round 1 findings, all fixed

1. AC4: a PASS showed "Checked: it works"; now "Checked: passed".
2. AC4: an INCONCLUSIVE verdict showed "Check not finished"; now "Not checked yet".
3. Section 7: "Check now" read GitHub again after 10 s; now at most one read a minute.
4. Section 8: cards had no `stage` field; now they do.
