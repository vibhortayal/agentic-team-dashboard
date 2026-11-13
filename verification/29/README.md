# Verification of #29 (team projects first, and a next step when there's none)

Round 1: **BLOCK** on `575c0e9`, one finding. The spec is `docs/changes/29.md` v1. Base is `5f6b2b6`.

Rows and how each one is checked: `checks.md`. Per-row results and notes: `verdict.json`.

```
$ npm ci && rm -rf dist dist-server && npm run build    ok (base ok)
$ npx tsc --noEmit                                       exit 0 (base 0)
$ npm test                                               79 passed (base 75)
$ bash .github/team/run-checks.sh                        32 run, ok (base 31 run, ok)
  #29 AC1 41/41; #8, #10, #11 and #16 all pass
$ NODE_PATH=$(npm root -g) node verification/29/page.mjs      AC2, AC3, AC4 ok; F1 fails; 40 screenshots, no sideways scroll
$ NODE_PATH=$(npm root -g) node verification/29/f1_type_box.mjs   2 failed
```

**F1. The box to type a project's name disappears when every project uses the team.** AC2 puts the box behind "Show all your projects (N more)". AC5 keeps #10 AC4: "a box to type owner/name". With two team projects and no others, the picker (first run, or after Change project) shows no "Show all your projects" and no box (`all-team-*.png`). With no projects at all, "No project yet" has no box either. Expected: the box can be reached from the picker whatever the list holds. CI has no browser, so `f1_type_box.mjs` is a by-hand repro: it exits 1 now and 0 once fixed.
