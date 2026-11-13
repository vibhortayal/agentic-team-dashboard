# Verification of #16 (Settings and keys without opening GitHub)

Round 3: **PASS** on `2568430`. This round is a new verdict, not a fix. `origin/main` (`5627a43`) was merged in at `6967ef0`, and `docs/changes/10.md` was put back to main's version at `2568430`. The spec `docs/changes/16.md` v1 is unchanged.

Round 2 was a PASS on `be305af` (evidence `195fae3`). Round 1 was a BLOCK on `b36f228` (evidence `5944bea`), and both of its findings are fixed.

The Verifier ran in the same account as the builder (prototype profile, no checker identity), so there is no checker approval.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`.

Tamper check: `git diff 195fae3 2568430 -- verification/16` is empty, and so was `git diff 5944bea be305af -- verification/`.

## Round 3

The diff from main to `2568430` holds only #16's files. In `server/github.ts`, `web/App.tsx`, `server/main.ts`, `server/settings.ts` and `web/settings.tsx`, the lines that change are the same as in `da515ce..be305af`. So the merge kept main's #11 change and #16's change as they were, and dropped neither.

```
$ npm ci && rm -rf dist dist-server && npm run build    ok
$ npx tsc --noEmit                                       exit 0
$ npm test                                               Test Files 6 passed (6), Tests 75 passed (75)
$ bash .github/team/run-checks.sh                        31 run, ok
  #16: AC1 32/32, AC2 22/22, AC3 8/8, AC4 33/33, AC5 10/10, AC6 44/44, AC7 30/30, AC8 footer 3/3, F1 3/3, round 2 11/11
  #8:  39/39, 37/37, 30/30, 17/17, 63/63
  #10: 9/9, 10/10, 32/32, 20/20, 10/10, 69/69, 12/12
  #11: 12/12, 15/15, 10/10, 15/15, 6/6, 23/23, 10/10, 19/19, 29/29
$ NODE_PATH=$(npm root -g) node verification/16/page.mjs     49 ok, 0 failed (screens unchanged)
```

The untested risk from round 2 still stands. A multi-byte character split across body pieces is changed before it is sealed. A real browser on this computer sends these bodies whole. See `verdict.json`.

# Round 2 (PASS on be305af)

**F1 fixed.** The server bundle now carries tweetnacl and @noble/hashes, and needs only Node's own modules. #10's one-file check passes 9/9 and its npx check 10/10. `checks/f1_bundle_alone.mjs` passes 3/3.

I corrected that script's third row. In round 1 it copied `board.cjs` with no `dist/` beside it, which stops with "The page isn't built yet" even at base. It now uses the npm package layout: `dist-server/board.cjs` beside `dist/`, with no `node_modules`. The finding itself stood on the script's first two rows and on #10's own checks.

**F2 fixed.** `checks/ac6_problems.mjs` passes 44/44. A 12 000-character value gets 400 with the too-long sentence. Values of 49 153 and 1 048 576 characters get 413 with the same sentence. The box now keeps at most 8 000 characters.

**Changed code, checked** (`checks/r2_changed_code.mjs`, 11/11):
- Variables on pages 2 and 3 show as set, with their values. So do secrets on pages 2 and 3.
- Exactly one full page of variables works.
- When page 2 fails to load, the page shows a plain problem.
- After 1 MB and 26 000-character bodies, ordinary saves on the same kept-alive connections work: `1048576:413 26000:413 4000:200 1048576:413 4000:200 100:200 4000:200`.

**Untested risk (a note, not judged).** The body reader still joins the request as text, piece by piece. If a body arrives in pieces that cut a multi-byte character in half, that character changes. The changed value is then saved with a 200: 7 000 CJK characters sent in 1 001-byte pieces were saved as 7 021. A real browser on this computer sent the same values whole (Chromium 9 of 9 exact, Node fetch 3 of 3), and keys are almost always plain ASCII. Collecting the bytes and decoding once would remove the risk.

```
$ rm -rf dist dist-server && npm run build    built
$ npx tsc --noEmit                            exit 0
$ npm test                                    Test Files 6 passed (6), Tests 74 passed (74)
$ bash .github/team/run-checks.sh             30 run
  #16: AC1 32/32, AC2 22/22, AC3 8/8, AC4 33/33, AC5 10/10, AC6 44/44, AC7 30/30, AC8 footer 3/3, F1 3/3, round 2 11/11
  #8:  39/39, 37/37, 30/30, 17/17, 63/63
  #10: 9/9, 10/10, 32/32, 20/20, 10/10, 69/69, 12/12
  #11: all pass except ac1_waiting_second_read 4/6, the same at base da515ce (not this change; CI stays red on it)
$ NODE_PATH=$(npm root -g) node verification/16/page.mjs     49 ok, 0 failed
```

# Round 1 (BLOCK on b36f228)

## F1: the one-file app and the npm package no longer start (AC8, via #10 AC1 and AC2)

> **AC8** #8, #10 and #11 still hold

The server bundle that `vite.app.config.ts` builds now has `require("tweetnacl")` and `require("@noble/hashes/blake2.js")` in it. Both are devDependencies, so they aren't in the one-file app or the packed package. #10's `ac1_one_file.mjs` and `ac2_npx.mjs` passed at the base and fail at the head.

```
$ npm run build:server && mkdir /tmp/alone && cp dist-server/board.cjs /tmp/alone/ && cd /tmp/alone && node board.cjs --demo --no-open
Error: Cannot find module 'tweetnacl'

verification/10/checks/ac1_one_file.mjs   Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: tweetnacl
verification/10/checks/ac2_npx.mjs        Error: Cannot find module 'tweetnacl'   (installed from the packed tarball)
```

Expected: the board starts, as it does at the base. Actual: it stops before it opens. Script: `checks/f1_bundle_alone.mjs` (1/3 now). The two #10 checks fail too.

## F2: a long value gets "That request didn't make sense." (AC6)

> **AC6 Plain problems.** No permission, an expired sign-in, an empty or over-long value, and GitHub being down each give one plain sentence

From 8 001 characters to about 9 970, the answer is "That's too long to be a key. Check you copied the right thing." Once the request body passes 10 000 characters, the board's request reader rejects it first. The answer is then the general "That request didn't make sense.", which doesn't tell the person what's wrong. The page puts no length limit on the box, so pasting a whole file gets there.

```
POST /api/settings {"name":"OPENAI_API_KEY","value":"<12 000 x 'w'>"}  ->  400 {"error":"That request didn't make sense."}
POST /api/settings {"name":"OPENAI_API_KEY","value":"<8 001 x 'z'>"}   ->  400 {"error":"That's too long to be a key. Check you copied the right thing."}
```

Expected: the too-long sentence for any over-long value, for secrets and variables alike. Actual: the general sentence at 12 000, 49 153 (one byte over GitHub's 48 KB limit) and 1 048 576 characters. Script: `checks/ac6_problems.mjs` (38/44; the six failures are these).

## Commands and real output (Node 22.23.4, Linux x64, clean tree at b36f228)

```
$ rm -rf dist dist-server && npm run build    built
$ npx tsc --noEmit                            exit 0
$ npm test                                    Test Files 6 passed (6), Tests 74 passed (74)
$ bash .github/team/run-checks.sh             29 run, FAIL (real 0m31s)
  #16: AC1 32/32, AC2 22/22, AC3 8/8, AC4 33/33, AC5 10/10, AC6 38/44, AC7 30/30, AC8 footer 3/3, F1 1/3
  #8:  39/39, 37/37, 30/30, 17/17, 63/63
  #10: AC1 one file 2/3 (F1), AC2 npx 6/7 (F1), AC3/5 32/32, AC4 20/20, dots 10/10, AC6 69/69, AC7 12/12
  #11: 12/12, 10/10, 15/15, 23/23, 10/10, 19/19, 29/29; ac1_waiting_second_read 4/6 (also 4/6 at base)
$ NODE_PATH=$(npm root -g) node verification/16/page.mjs     48 ok, 0 failed
```

Baseline at `da515ce` (a throwaway worktree): 20 run. Everything passes except `verification/11/checks/ac1_waiting_second_read.mjs`, which fails the same way at both revisions, so it is not this change.

AC2's sealed values were opened two ways. The fake opens them with tweetnacl and the fake's own private key. libsodium opens them too (PyNaCl 1.6.2 `SealedBox`). Neither opens them with another private key.

## Screens

These are from `page.mjs`, at phone (390) and desktop (1280) widths, light and dark: `list-*`, `saved-*`, `refused-*`, `empty-*`, `error-*` and `demo-*`. No screen scrolls sideways.
