# Checks for #16 (Settings and keys without opening GitHub), from docs/changes/16.md v1 at b36f228

Rows come from the spec. To script them I read only the `/api/settings` route in `server/main.ts`, the shape of
its answer (`SettingView`/`SettingsView`) and the GitHub paths the board calls, not the builder's tests.

How they run: each `checks/*.mjs` is a Node script that `.github/team/run-checks.sh` runs. The board runs from
source with `../8/checks/guard.mjs` preloaded (no internet), `--repo acme/garden` and a fake `GITHUB_TOKEN`.
GitHub is a fake on 127.0.0.1 (`checks/lib.mjs`) reached through `BOARD_GITHUB_API`. It holds a real Curve25519
key pair and opens every sealed secret the board sends. When PyNaCl (libsodium) is installed the same sealed
value is also opened with `nacl.public.SealedBox`; without it that half is reported as a note. CI needs
`npm ci && npm run build` first.

| Row | Clause | Check | Script |
|---|---|---|---|
| AC1 list | each sensible entry with its `why`, whether it is set, and for unset ones "Get it here" (https only) and `steps` | a list of 5 good entries comes back in order with `why`, `is_set` from GitHub's secret and variable lists, `get` and `steps`. A `get` of `http:`, `javascript:` or not a URL is dropped | `ac1_list.mjs` |
| AC1 skipped | bad name (not upper case, or starting `GITHUB_`), no `why`, unknown kind, repeated name are skipped, and the page says so | `my_key`, `Mixed_Key`, `GITHUB_TOKEN_X`, `GITHUB_`, no `why`, blank `why`, kind `env`, a second `OPENAI_API_KEY`: none shown (the repeat appears once), `skipped` > 0. Names `A`, `A_1`, `GITHUBX` are kept. The page says some of the list didn't make sense | `ac1_list.mjs`, `page.mjs` |
| AC1 empty | no list: "Nothing to set yet." | list file missing (404): no items, no problem; the page says "Nothing to set yet." | `ac1_list.mjs`, `page.mjs` |
| AC2 sealed | value locked with the project's public key (sealed box) before it leaves the board's server; opens only with GitHub's private key | one PUT to `/actions/secrets/<NAME>` with the current `key_id`; `encrypted_value` opens with the fake's private key (tweetnacl, and libsodium via PyNaCl) to the exact value, including non-ASCII; it does not open with another private key; the plain value is in no request GitHub gets | `ac2_secret.mjs` |
| AC2 never shown | the board never returns, logs or shows a secret's value; a saved secret can be replaced, not shown | the value is in no answer from the board (save, settings list), not in its output, not in any file under HOME or its temp folder; settings list shows `is_set` and `updated_at` but `value` null. A second save replaces it (second PUT that opens to the new value). The page uses a password box and never shows the value after Save | `ac2_secret.mjs`, `page.mjs` |
| AC2 sent once | sent once | exactly one PUT per Save, also when GitHub answers 500 | `ac2_secret.mjs` |
| AC3 | app variable shows its value and can be changed; a new one is created | a set variable's value is shown; a change sends PATCH with the new value and the list then shows it; an unset variable is created with POST `/actions/variables` | `ac3_variables.mjs` |
| AC4 read-only | the six checks settings show only set or not set, with "Ella fills this in" | with all six on the list and some set on GitHub (variables and secrets), each is `checks: true`, `is_set` right, `value` null and the values appear nowhere in the answer; the page says "Ella fills this in" and has no box for them | `ac4_readonly.mjs`, `page.mjs` |
| AC4 refused | server refuses to change them, and any name not on the list | a save of each of the six (value and make) is refused (4xx) with no write to GitHub; so is a name not on the list, a skipped entry's name, a lowercase variant of a listed name, `GITHUB_TOKEN`, `../X`, empty and missing name | `ac4_readonly.mjs` |
| AC5 | `make: "random"` saves a fresh random value (32 random bytes) without typing | the sealed value opens to a string that decodes to exactly 32 bytes (base64, base64url or hex); two makes differ; nothing returned. The page shows the button only for that entry | `ac5_make.mjs`, `page.mjs` |
| AC6 | no permission, expired sign-in, empty or over-long value, GitHub down: one plain sentence each, none repeats the value | GitHub 403, 401, 500, 503 and a dropped connection on the PUT and on the public key read; empty value; a value over GitHub's own 48 KB secret limit (49 153 bytes) and 1 MB: each answer is one sentence, no codes or braces, without the value; empty and over-long make no GitHub write. Reading the list with 401, 403, 500: one plain sentence | `ac6_problems.mjs` |
| AC7 origin | saving obeys the same rules as other changes (this computer, same origin, JSON body) | POST `/api/settings` with no Origin, another site, `null`, another port, text/plain, urlencoded, multipart, no Content-Type, another Host: 403; non-JSON body: 400; nothing reaches GitHub | `ac7_origin_demo.mjs` |
| AC7 demo | the demo shows a sample list and saves nothing | `--demo`: the list has sample entries; a save from its own page is refused, no network, no file written | `ac7_origin_demo.mjs`, `page.mjs` |
| AC8 | #8, #10 and #11 still hold, except the footer | `verification/8,10,11/checks/*` via run-checks.sh; footer says the board changes the project only when you save a setting, and the old "only reads ... changes nothing" line is gone | `../8`, `../10`, `../11`, `ac8_footer.mjs`, `page.mjs` |
| screens | settings page at phone and desktop, light and dark: list, nothing yet, demo, error | `page.mjs` (by hand, Playwright) | `page.mjs` |

Spec statements with no row: section 7 permissions on the GitHub App (the App doesn't exist yet, section 9);
section 8 dependencies (`deps-approved` is the owner's, CI's gate). "Ella sets the settings she already knows
from the chat" (section 2) is the team kit's job, not the board's.
