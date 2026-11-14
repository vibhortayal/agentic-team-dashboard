# Checks for #32 (show the team's latest work before any card exists)

There is no change spec. The rows come from issue #32 and the "What changed" list in PR #31's description, as the
coordinator handed them over (R1-R5 below), and were written before reading the implementation. To script them I
read only the `/api/board` field names in `server/model.ts` (`latest: {who, what, at}[]`) and the base's role names.

How they run: each `checks/*.mjs` is a Node script that `.github/team/run-checks.sh` runs. The board runs from source
with `../8/checks/guard.mjs` preloaded (no internet). GitHub is a fake on 127.0.0.1 (`checks/lib.mjs`, extending
#11's) that also answers `/activity`, `/commits/<sha>` and `/commits`, each able to fail on its own. The page rows
run in a real browser (Playwright) in `page.mjs`, by hand, since the CI runner has no browser; it also takes the
screenshots at 390px and 1280px, light and dark.

| Row | Clause | Check | Script |
|---|---|---|---|
| R1 any branch | reads the newest pushes on any branch (`/activity`, then `/commits/{sha}`) | 5 pushes on 4 branches, newest first: `latest` holds the 3 newest pushes' commits in that order; `/commits` (main line) is not what fills it | `r1_r2_latest.mjs` |
| R1 fallback | falling back to `/commits` on the main line | `/activity` answers 404, 403, 500, a reset connection, then broken JSON: `latest` is the main line's 3 newest | `r1_fallback.mjs` |
| R1 at most 4 reads | at most 4 GitHub reads for this | in every case above and with 10 pushes, latest-work reads (`/activity` + `/commits*`) per board read are at most 4 | `r1_r2_latest.mjs`, `r1_fallback.mjs` |
| R1 never throws | it never throws | every latest route fails (each failure kind), or one `/commits/<sha>` fails, or the repo is empty (409): the board answers 200, `error` is null, the cards still show, `latest` is a list | `r1_fallback.mjs` |
| R2 three | shows the three newest | 5 available: 3 shown; 2 available: 2; 0: none | `r1_r2_latest.mjs` |
| R2 who | team agents by first name from their `@team.invalid` email or role title (Engagement Lead -> Ella); anyone else "You" | `verifier@team.invalid` -> Vera, `implementer@team.invalid` -> Ian, name "Engagement Lead" with a plain email -> Ella, name "Product Manager" -> Priya, a person with a gmail address -> You, a person named "Ian Smith" with a non-team email -> You | `r1_r2_latest.mjs` |
| R2 what | the first line of the commit message with keys masked | a 3-line message gives only its first line; a first line holding a `ghp_` key does not show the key anywhere in `/api/board` | `r1_r2_latest.mjs` |
| R2 when | and when | each entry's `at` is the commit's date | `r1_r2_latest.mjs` |
| R3 heading | "Latest from the team" appears above the columns | with cards and latest work, the heading is on the page and sits above the first column | `page.mjs` |
| R3 getting started | with no cards the page says "The team is getting started. Cards show up here once Ella opens your project's first task." | no issues, 2 pushes: that sentence and the 2 lines; no "Nothing here yet" | `page.mjs` |
| R3 nothing yet | with no cards and no latest work "Nothing here yet. Talk to Ella to get your project started." | no issues, no pushes, empty main line: that sentence; no latest heading | `page.mjs` |
| R3 cards | (implied) the empty-board sentences are for an empty board | with cards, neither sentence shows | `page.mjs` |
| R4 error | when the board has an error, no latest lines show | GitHub answers 500 to everything except latest work, which still answers: `error` set, `latest` empty in `/api/board`, no heading or lines on the page | `r4_error.mjs`, `page.mjs` |
| R3/R4 widths | phone width 390px with no sideways scroll | each page state above, plus a 300-character unbroken commit line, at 390 and 1280, light and dark: no sideways scroll; screenshots committed | `page.mjs` |
| R3 demo | (the demo is how a person first sees it) | `--demo` shows the latest heading and lines | `page.mjs` |
| R5 unchanged | all existing tests pass, typecheck and build pass | `npx vitest run`, `npx tsc --noEmit`, `npm run build` at base and head; existing verifier checks at base and head; diff shows no existing test changed | by hand, output in `README.md` |
| F1 card holder row (round 1 finding) | R5: existing behaviour unchanged | the work card's "<face> Ian (builds)" row keeps its base style: its class has a top-level flex rule with an 8px gap (built page), and in a browser it is `display:flex`, gap 8px, 14px | `checks/f1_card_holder_style.mjs`, `page.mjs` |
