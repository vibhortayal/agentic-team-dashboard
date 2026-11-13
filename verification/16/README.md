# Verification of #16 (Settings and keys without opening GitHub)

Round 1: **BLOCK** on `b36f228e4fb8c83f7d5201af88f3d1fdbb8c75b0`. The spec is `docs/changes/16.md` v1 at that commit, and the base is `da515ce`.

The Verifier ran in the same account as the builder (prototype profile, no checker identity), so there is no checker approval.

Rows and how each one is checked: `checks.md` (committed before any check ran, in `78dd2d2`). Per-row results and notes: `verdict.json`.

The settings work itself holds up. Secrets are sealed with the project's key and open with libsodium. They are never returned, logged or saved. The six checks settings are read-only, and names off the list are refused. Saving obeys the origin rules, and the demo saves nothing. Two findings block it.

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
