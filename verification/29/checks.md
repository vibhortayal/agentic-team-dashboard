# Checks for #29 (team projects first, and a next step when there's none), from docs/changes/29.md v1 at 575c0e9

Rows come from the spec, written before reading the diff. To script them I read only `/api/projects` and
`listProjects` on main (what the board already calls), not the builder's tests.

How they run: `checks/*.mjs` are Node scripts that `.github/team/run-checks.sh` runs. The board runs from source
with `../8/checks/guard.mjs` preloaded (no internet), signed in with a fake `GITHUB_TOKEN`,
`BOARD_GITHUB_CLIENT_ID=none`, a temp `BOARD_CONFIG_DIR` and its working folder outside any git repo. GitHub is a
fake on 127.0.0.1 (`checks/lib.mjs`) reached through `BOARD_GITHUB_API`: it holds the project list (one or more
GitHub App installations, or `/user/repos`), answers `contents/TEAM.md` with 200 for team projects and 404 for the
rest, logs every request under `/repos/<project>/` made while the list is read, and counts how many are open at
once. `page.mjs` uses the page in a real browser (Playwright) and is run by hand, as #16's was (CI has no browser).

| Row | Clause | Check | Script |
|---|---|---|---|
| AC1 mark | marks each project `team: true` when `TEAM.md` exists at its root | 6 projects, 2 with TEAM.md: every entry has a boolean `team`, true exactly for those 2; all 6 are listed; asking twice gives the same answer | `ac1_projects.mjs` |
| AC1 first | lists those first | the team projects come before every other; same through `/user/repos` and through installations | `ac1_projects.mjs` |
| AC1 cap | looks inside at most 100 projects | 100 projects (last allowed): all 100 looked at, a team project in 100th place is marked; 101 (first over): at most 100 looked at, all 101 listed; 250 over three installations: at most 100 looked at, all 250 listed, nothing looked at twice | `ac1_projects.mjs` |
| AC1 8 at a time | 8 at a time | 40 projects whose look takes 150 ms: never more than 8 looks open at once (the peak is reported) | `ac1_projects.mjs` |
| AC1 failed look | a look that fails counts as not a team project and never fails the list | a look that answers 500, 403, 401, 429, 502, drops the connection, answers non-JSON, or never answers (until the board gives up): that project is listed with `team: false`, the list answers 200 with every project, and a real team project next to it is still `team: true` | `ac1_projects.mjs` |
| AC2 | the picker shows team projects; the rest and the "type its name" box sit behind "Show all your projects (N more)" | 2 team + 3 others: the 2 are shown, the 3 and the name box are not; the button says "Show all your projects (3 more)"; pressing it shows the 3 and the box; picking a team project opens it | `page.mjs` |
| AC3 | first run, exactly one team project opens straight away with no list; "Change project" always shows the list | 1 team + 4 others, nothing saved: the board for that project shows and no list appears; "Change project" shows the list and it stays (no jump back), also after a reload. 2 team projects: the list shows. A saved project is opened, not replaced by the team project | `page.mjs` |
| AC4 | no team project: "No project yet", talk to Ella first in three short steps linking the "Your first project" lesson, a Check again button; "Let the board see it on GitHub" stays for a GitHub App sign-in | 0 team (3 others) and 0 projects at all: the heading, Ella, three steps, a link named "Your first project" (https), Check again. After TEAM.md appears, Check again reads the list again and the board moves on. Signed in through the App (config token, client id, app slug): the "Let the board see it on GitHub" link is there | `page.mjs` |
| screens | states, widths, themes | list, opened, change, none, none through the App, loading, error: phone 390 and desktop 1280, light and dark, no sideways scroll | `page.mjs` |
| AC5 | #8, #10, #11 and #16 still hold | `verification/8,10,11,16/checks/*` via run-checks.sh; `npm ci`, `npm test`, `npx tsc --noEmit`, a clean `npm run build`, at base and at head | run-checks.sh |
