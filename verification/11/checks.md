# Checks for #11 (board for app testers), from docs/changes/11.md v1 at 4c85eeb

Rows come from the spec and were written before reading the code. To script the data rows I then read only the
`/api/board` field names in `server/model.ts`, not the builder's tests or how the fields are filled.

How they run: each `checks/*.mjs` is a Node script that `.github/team/run-checks.sh` runs. The board runs from source
with `../8/checks/guard.mjs` preloaded (no internet, steppable clock). GitHub is a fake on 127.0.0.1 (`lib.mjs`, an
extension of #8's fake) that also answers `/releases`, `/deployments`, `/deployments/<id>/statuses` and `/pulls`,
and can be told to fail any one of them. The page rows run in a real browser (Playwright) in `page.mjs`, by hand,
since the CI runner has no browser; `page.mjs` also takes the screenshots.

The waiting change in the fixtures is an open pull request labelled `needs-human` (branch `feat/seeds`, head sha
`aaa111...`), plus an issue labelled `needs-human` with no pull request.

| Row | Clause | Check | Script |
|---|---|---|---|
| AC1 deploy by branch | Try it opens the latest successful non-production deployment whose branch matches the PR | two successful preview deployments on `feat/seeds` (older and newer): the newer one's URL is the button | `ac1_try_it.mjs`, `page.mjs` |
| AC1 deploy by commit | ... or whose commit matches | a preview deployment whose `ref` is the sha (not the branch) gives the button | `ac1_try_it.mjs` |
| AC1 successful only | latest *successful* | the newest matching deployment's latest status is `failure` (or still `in_progress`): the older successful one is used | `ac1_try_it.mjs` |
| AC1 non-production only | non-production | a production deployment of the same sha is never the Try it link | `ac1_try_it.mjs` |
| AC1 other branches | matches the pull request | a preview of another branch and sha gives no button | `ac1_try_it.mjs` |
| AC1 comment fallback | else the latest `preview` in its team comments | no matching deployment, two team comments with `preview`: the later one is used. A deployment beats a comment | `ac1_try_it.mjs`, `page.mjs` |
| AC1 none | No preview, no button | no deployment and no comment preview: no Try it in the data or on the page | `ac1_try_it.mjs`, `page.mjs` |
| AC1 other branches newer | the latest successful ... deployment whose branch or commit matches | the change's successful preview is older than 1, then 2, previews of other branches (each push to any branch deploys one): it is still the button | `ac1_try_it.mjs` |
| AC1 other open pull requests (round 2) | the latest successful ... deployment whose branch or commit matches, inside section 7's 6 status reads | (a) 1 waiting change and 3 newer open pull requests that aren't waiting, each with 2 previews; (b) 3 waiting changes with 2 previews each and 2 production deployments: every waiting change has its newest preview, with at most 6 status reads | `ac1_other_pulls.mjs` |
| AC1 https only | Only https links are shown | an `http://` deployment and production link and a `javascript:` comment preview are never links on the page. The data may still carry them (logged as a note) | `page.mjs`, notes in `ac1_try_it.mjs`, `ac3_your_app.mjs` |
| AC2 the ask | shows the message that asked, in plain text | the asking comment (#8 AC1's rule) appears on the card; Markdown marks (`**`, `_`, `` ` ``, `#`, `[text](url)`, `>` and list marks) are gone, the header line, the `<!-- team-event -->` line, other HTML comments and HTML tags (`<details>`, `<summary>`) are gone, and a later handoff between team members doesn't replace the ask | `ac2_ask.mjs`, `page.mjs` |
| AC2 masked | masked | fake keys (#8's shapes) and `NAME_TOKEN=value` in the ask come out hidden | `ac2_ask.mjs` |
| AC2 masked, keys with `_` (round 2) | masked | `ghp_`, `github_pat_`, `npm_`, `sk_live_` and `sbp_` keys in the ask, not after a key name: none of the key's characters reach the card, with or without the `_`. Round 1's row compared the whole key and missed a key shown without its `_` | `ac2_masked.mjs` |
| AC2 600 | at most 600 characters, "…" when cut | ask bodies of 599, 600 and 601 characters (after cleaning) and 5000: 600 shows whole with no "…", 601 and 5000 show at most 600 ending "…" | `ac2_ask.mjs`, `page.mjs` |
| AC2 how to answer | ends with "Tell Ella in your chat with her." | every waiting card on the page ends with that sentence | `page.mjs` |
| AC3 live link | latest successful production deployment as "Open your app" | two successful production deployments: the newer one's URL; a newer failed one is skipped; a preview is never the live link | `ac3_your_app.mjs`, `page.mjs` |
| AC3 live version | latest published release with date and first lines of notes | three published releases: the newest by date is the live version, with its date and the start of its notes (plain) | `ac3_your_app.mjs`, `page.mjs` |
| AC3 waiting version | a draft release marked "Ready to go live, waiting for your OK" | a draft release shows with that phrase, and is not the live version | `ac3_your_app.mjs`, `page.mjs` |
| AC3 earlier versions | up to 5 earlier versions | 8 published releases: live + 5 earlier, no more; 3 published: live + 2 earlier | `ac3_your_app.mjs`, `page.mjs` |
| AC3 nothing yet | With none of these it says the app isn't online yet | no deployments and no releases: the section says the app isn't online yet | `ac3_your_app.mjs`, `page.mjs` |
| AC4 no GitHub links | no link on the page points at github.com, board or error message | every `<a href>` on the board view (with cards, Your app, Try it and the can't-read message) is checked; none has host github.com (or a subdomain) | `page.mjs` |
| AC4 sign-in/picker | still link GitHub there | not a check (excepted) | n/a |
| AC5 optional | releases or deployments can't be read: the rest shows, no error | /releases and /deployments (each and both, and the statuses) answer 404, 403, 500 or drop the connection: cards and the waiting list still show and `error` is empty | `ac5_optional.mjs` |
| AC6 | #8's and #10's criteria still hold, except the links | `verification/8/checks/*` and `verification/10/checks/*` (run by run-checks.sh); #8 AC1/AC5 links: the data still carries `url` | `../8/checks`, `../10/checks`, `ac2_ask.mjs` |
| sec 7 | at most 10 extra reads per refresh, inside the one-minute cache | 3 waiting PRs and 20 deployments: the reads of releases, deployments, statuses and pulls on one refresh are at most 10, and a refresh inside the minute reads none of them again | `ac5_optional.mjs` |
| sec 6 | plain words, the user never sees code | screenshots read by eye; no sha, branch or label name on the Your app and Try it parts | `page.mjs` |
| screens | board with Your app and Try it at phone and desktop widths, light and dark; demo too | `page.mjs` writes the screenshots and checks for no sideways scroll | `page.mjs` |

Spec statements with no row: section 4's "the `preview` field is read if present" is AC1's comment row.
