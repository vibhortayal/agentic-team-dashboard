# Verification of #29 (team projects first, and a next step when there's none)

Round 2: **PASS** on `99d2d29`. The spec `docs/changes/29.md` v1 is unchanged. Base is `5f6b2b6`.
Round 1 was a BLOCK on `575c0e9` (evidence `5018469`), and its one finding is fixed.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`.
Tamper check: `git diff 5018469 99d2d29 -- verification/` is empty.

```
$ NODE_PATH=$(npm root -g) node verification/29/f1_type_box.mjs   2 ok, exit 0 (F1 repro, run first)
$ npm ci && rm -rf dist dist-server && npm run build    ok (base ok)
$ npx tsc --noEmit                                       exit 0 (base 0)
$ npm test                                               79 passed (base 75)
$ bash .github/team/run-checks.sh                        32 run, ok (base 31 run, ok)
  #29 AC1 41/41; #8, #10, #11 and #16 all pass
$ NODE_PATH=$(npm root -g) node verification/29/page.mjs      all ok; 40 screenshots, no sideways scroll
```

**F1 fixed.** The box to type a project's name can now be reached whatever the list holds. With only team projects, the picker shows "Show all your projects" with no count, no help line and no empty list, and a typed name opens that project (`all-team-*.png`). With no projects at all, "No project yet" has the same "Show all your projects" with the box.

Round 2 changed only `web/setup.tsx`. The only check added is for that change: the R2 rows in `page.mjs`.
