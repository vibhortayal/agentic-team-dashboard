# Evidence for #32, round 1: BLOCK

Reviewed revision `4557e3affd567227a0cc9299f0019fbef33f7e81` (PR #31) against base `5f6b2b6`. Rows R1-R5 and how
each runs: `checks.md`. Node 22.23.4, no outbound network for the board (guard preloaded), fake GitHub on 127.0.0.1.

## What ran

| Command | Base 5f6b2b6 | Head 4557e3a |
|---|---|---|
| `npm ci` | ok | ok |
| `npx vitest run` | 6 files, 75 passed | 7 files, 83 passed (adds `server/latest.test.ts`; no existing test changed) |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run build` | ok | ok |
| `bash .github/team/run-checks.sh` (earlier tickets' checks) | 31 run, ok | 31 run, ok |
| `node verification/32/checks/r1_r2_latest.mjs` | | 28/28 passed |
| `node verification/32/checks/r1_fallback.mjs` | | 34/34 passed |
| `node verification/32/checks/r4_error.mjs` | | 9/9 passed |
| `node verification/32/checks/f1_card_holder_style.mjs` | ok | **FAIL** |
| `NODE_PATH=$(npm root -g) node verification/32/page.mjs` | holder row ok | 36 ok, **1 FAIL** (holder row) |

Screenshots: `{cards,started,nothing,error,demo}-{phone,desktop}-{light,dark}.png` (phone 390px, desktop 1280px; no
sideways scroll in any of the 20). `f1-card-base.png` and `f1-card-head.png` show the finding.

## Finding F1 (blocks): every work card's holder row lost its style

- Row: R5, "Existing behaviour unchanged".
- The change renames the work card's holder row from class `who` to `l-who` (`web/App.tsx`, `WorkCard`). `.who`
  in `web/board.css` (flex row, 8px gap, muted 14px text) now matches nothing, and `.l-who` is styled only inside
  `.latest`. So on every card the face circle touches the name and the name is larger and darker
  (`f1-card-base.png` vs `f1-card-head.png`).
- Repro: `npm run build && node verification/32/checks/f1_card_holder_style.mjs`. In a browser, any card's holder
  row: expected `display:flex; gap:8px; font-size:14px` (as at base), actual `display:block; gap:normal; font-size:15px`.
- Passes once the card's holder row is styled as before (for example, its class is `who` again).

## Notes (do not block)

- When `/activity` answers but every `/commits/<sha>` read fails, the list is empty; there is no fallback to
  `/commits` (it would be a 5th read). No clause covers this.
- `/activity` answering `[]` falls back to the main line (`r1_fallback.mjs` note). A branch deletion is skipped and
  one commit pushed to two branches shows once.
- The three lines are ordered by commit date, not push order; a push of an older commit (rebase, cherry-pick) can
  drop below newer commits. Not covered by a clause.
- An `@team.invalid` committer whose address and name match no role shows its raw name, not "You". The clause says
  agents show by first name and "anyone else" as You; this case is in between.
- Untested: GitHub's real `/activity` paging and rate limits; only GitHub's documented response shapes were faked.
