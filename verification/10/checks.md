# Checks for #10 (board as a download and an npx command), from docs/changes/10.md v1 at bad007a

Rows come from the spec. To script them I read only the command line, the `/api/*` paths and the
`BOARD_*` settings in `server/`, not the builder's tests.

How they run: each `checks/*.mjs` is a Node script that `.github/team/run-checks.sh` runs. From source and from
npm, the board runs with `../8/checks/guard.mjs` preloaded. The guard refuses and logs any connection off this
computer, and it lets a check step the board's clock. GitHub (both github.com and the API) is one fake on
127.0.0.1, reached through `BOARD_GITHUB_WEB` and `BOARD_GITHUB_API`, with `BOARD_GITHUB_CLIENT_ID` set. HOME is
a temp folder, and `gh` is a stub that isn't signed in. CI needs `npm ci && npm run build` first. `ac1` builds
the app itself, and `ac2` packs and installs the package offline. The whole suite takes about 11 s.

| Row | Clause | Check | Script |
|---|---|---|---|
| AC1 Linux | one file starts with `--demo`, serves the page and `/api/board`, no Node, no other files | `npm run package`. The one file is copied alone into an empty folder and run with PATH `/usr/bin:/bin` (no node there): the page, its script and style, the sample `/api/board` and `inside_app: true` are all served. The folder still holds only the app, and Stop exits 0 | `ac1_one_file.mjs` |
| AC1 Mac/Windows | proved by the release workflow's smoke test | the workflow is read, not run. It builds on macos and windows with `npm run package` and starts the app with `--demo`, then curls `/` and `/api/board` | `ac7_sec7_docs_release.mjs` |
| AC2 | packed package installs with no runtime dependencies; `npx team-board --demo` serves the board | `npm pack` (runs prepack). The tarball's package.json lists no runtime dependencies. An offline install into an empty folder brings only `team-board`. `npx --offline team-board --demo` then serves the page, its assets and the sample board, with no internet attempt | `ac2_npx.mjs` |
| AC3 | no saved sign-in and no GITHUB_TOKEN: code to copy, button to GitHub, checks every few seconds until yes | status not signed in. Start gives the code and an https GitHub page, and the device code stays private. A poll inside GitHub's interval doesn't call GitHub. `slow_down` widens the wait. "done" signs in. With GITHUB_TOKEN set there is no device sign-in | `ac3_ac5_sign_in.mjs`, `shots.mjs` |
| AC3 | refused or expired code says so in one plain sentence | `access_denied`, `expired_token`, and 901 s past `expires_in` on the board's clock each give a plain message with no codes and save nothing. The sentences are counted | `ac3_ac5_sign_in.mjs`, `shots.mjs` (refused) |
| AC3 | token saved only in the user's settings folder, readable only by them | the default folder `~/.config/team-board/config.json` has mode 600 and its folder 700. The key is found in no other file under HOME or the run folder, in no output and in no response to the page | `ac3_ac5_sign_in.mjs` |
| AC4 | lists projects the board was given access to, link to give access to more, box to type owner/name | the list matches the fake's installation repos, and the install link is https://github.com/apps/<slug>/... Eight malformed names are refused in plain words and not saved | `ac4_pick_project.mjs`, `shots.mjs` |
| AC4 | choice saved; "Change project" brings the list back | the pick is saved and shown, a second pick is shown at once, and the choice is kept after a restart. Run from a project folder (git remote acme/garden, as `npx` is), a pick of acme/other must be shown | `ac4_pick_project.mjs`, `shots.mjs` |
| AC5 | "Sign out" deletes the saved sign-in | after sign out the key and refresh key are gone from the file and the board is signed out, also after a restart. In the browser it returns to the sign-in screen | `ac3_ac5_sign_in.mjs`, `shots.mjs` |
| AC6 | every action request must come from the board's own page (Origin, JSON body) | each of the 5 actions is refused (403) with: no Origin, another site, `null`, another port, a text/plain, urlencoded or multipart body, no Content-Type, or another Host. A non-JSON body gets 400 and GET does nothing. The refused requests change nothing. Own-page requests work from 127.0.0.1 and localhost | `ac6_only_this_page.mjs` |
| AC6 | demo refuses all except "Stop" | in the demo, sign-in start and poll, sign out and project are refused from its own page and nothing is saved. Stop exits 0 | `ac6_only_this_page.mjs` |
| AC7 | README shows Mac "Open Anyway" and Windows "More info, Run anyway", says why | text check of README.md | `ac7_sec7_docs_release.mjs` |
| AC8 | all of #8's criteria still hold | `verification/8/checks/*` (run by run-checks.sh) | `../8/checks/` |
| sec 7 | release runs only on a v* tag or by hand, 15-minute timeouts | workflow triggers and every job's `timeout-minutes` | `ac7_sec7_docs_release.mjs` |
| sec 3/4 | draft release; no npm publish | `gh release create --draft`; no `npm publish` | `ac7_sec7_docs_release.mjs` |
| screens | sign-in, code, refused, project list, board at phone and desktop widths, light and dark | `shots.mjs` (by hand, needs Playwright) writes 20 screenshots and checks for no sideways scroll | `shots.mjs` |

Spec statements with no row: section 7 "the app reads only Issues, Pull requests and Metadata". That is a
setting on the GitHub App the owner creates (section 8), and it can't be checked here. The board's own reads are
issues, comments, `/user/installations` and `/user/repos`, all GET.
