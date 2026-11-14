# Foundation kit (the gates)

Reference implementation of the gates in the [foundation playbook](../../playbooks/foundation.md). Ops installs it in a project before any feature work; the owner approves it, because every file here becomes a gate file. Standard library Python 3 and bash only, so it works for any stack.

| File | Goes to | What it does |
|---|---|---|
| [scripts/team_gates.py](scripts/team_gates.py) | `.github/team/team_gates.py` | Tamper guard, verdict check, quality ratchet |
| [scripts/run-checks.sh](scripts/run-checks.sh) | `.github/team/run-checks.sh` | Runs every Verifier check under `verification/*/checks/` |
| [workflows/team-gates.yml](workflows/team-gates.yml) | `.github/workflows/team-gates.yml` | `team-gates` runs the guard and verdict check from the **base** branch and never runs PR code |
| [workflows/team-checks.yml](workflows/team-checks.yml) | `.github/workflows/team-checks.yml` | `team-checks` runs the PR's Verifier checks and lint with no secrets. Skips drafts |
| [zones.yml](zones.yml) | `zones.yml` | Gate, tests, deps, red, evidence and approved-document zones by path; edit the patterns for the project |
| [scripts/app-token.sh](scripts/app-token.sh) | Verifier sessions only | Mints a short-lived token for the checker App, so the Verifier can approve the head as `TEAM_CHECKER` |
| [verdict.schema.json](verdict.schema.json) | `.github/team/verdict.schema.json` | The shape of `verification/<issue>/verdict.json` |
| [pull_request_template.md](pull_request_template.md), [ISSUE_TEMPLATE/ticket.md](ISSUE_TEMPLATE/ticket.md) | `.github/` | PR and ticket shapes the gates expect |
| [tests/selftest.sh](tests/selftest.sh) | stays here | 77 cases in a scratch repo: each planted violation must be blocked and each legitimate change allowed |

## Pull request classes

The gate reads the branch name; agents only open these.

| Branch | Class | Gates |
|---|---|---|
| `team/<issue>-<slug>` | ticket (normal or trivial) | Tamper guard, Verifier checks, quality, Verifier PASS (and checker approval) |
| `docs/<topic>` | docs: brief, spec, estimate, change request, research | Tamper guard; may only touch documents. No verdict: the owner's yes, with Ella's receipt, is the approval |
| `team/records` | records: ledger, reports | Tamper guard; may only touch `budget/ledger.csv` and `reports/` |
| `verify/<issue>-tests` | the Verifier's changes to existing tests | Only the tests zone, with the owner's `tests-approved` label |
| `deps/<name>`, `dependabot/...` | dependency updates | Only the deps zone, with the owner's `deps-approved` label |
| `gate/<topic>` | changes to gate files (including the kit itself) | Only gate files, with the owner's `gate-change-approved` label |

Any other branch name fails, with one exception: some agent tools may only push to a branch name they pick. Then the PR description carries one line, `Team branch: <name>`, naming the branch it would have been (say `Team branch: team/12-sign-in`), and the gate applies exactly that branch's class and rules.

## What the gates enforce

- **Tamper guard.** A PR may not change gate files (including `TEAM.md`, `AGENTS.md`, installed role files and lint config), existing tests, lockfiles or red-zone paths unless the **owner's own GitHub account** added the matching label after the latest push and after an approval receipt (every push removes approval labels, so the owner approves what is there now) (`gate-change-approved`, `tests-approved`, `deps-approved`, `red-zone-approved`). The script asks GitHub who added each label, so an agent adding the label does not count. Zone rules are read from the base branch, so a PR cannot loosen them. Evidence may only be written under `verification/<issue>/` for the PR's own issue. Test-runner config, manifests (which hold test scripts) and the command surface are protected too. A ticket may not edit approved documents (brief, specs, change requests, decision records, budget, reports), and only ticket and test-change PRs may add test files.
- **Approval receipts.** The owner approves by saying yes to Ella, who adds the label from the owner's sign-in. So an owner label counts only after a comment from the owner's account whose `team-event` is `{"kind":"approval","approves":"<label>"}`, posted since the label was last removed. This catches an agent that adds a label and forgets the receipt; it can't catch one that writes both, so Ops also matches every merge, label and release to its receipt each week.
- **Verifier checks.** Every check script a Verifier commits runs on every PR, so a BLOCK stays red until it is fixed.
- **Docs budget.** New Markdown files only in the folders made for them (changes, change requests, decisions, specs, reports, research, work, verification), and the standing docs may not grow past `DOCS_BUDGET` words (default 6,000).
- **Quality gate.** Block new violations only: the project's lint command runs at base and head (after `SETUP_CMD`), and a changed file may not gain violations of any rule. A crashing linter or an unset command fails.
- **Limits.** A ticket stops when its sessions pass the cap the Budget Analyst set, or after three BLOCK verdicts. The check counts the `team-event` lines on the ticket's issue and PR, and uses the first cap posted, so a later, bigger one changes nothing. Only the **owner's own account** can let it go on, by adding `spend-approved` or `rounds-approved` to the issue after a receipt. With `cap` in `require:`, a ticket with no cap fails too. Only comments by the owner, members and collaborators count, so an outsider on a public repo can't post a cap or a verdict.
- **Watch mode.** A check listed under `watch:` in `zones.yml` (limits, quality or docs) reports "would block" and passes, so a new check can be tried first. Any check that crashes reports NEVER RAN; an enforcing one fails.
- **Verifier PASS.** No merge of a ticket without `verification/<issue>/verdict.json` saying PASS with every check passed, for a revision in the branch; every file that differs from that revision must be the Verifier's evidence or exactly main's version (so merging main is fine and anything smuggled in is not); and, with `TEAM_CHECKER` set, the checker identity's approval of the exact head. Check rows whose command isn't a script under `verification/<issue>/checks/` are listed in a note, because CI can't re-run them.

## Install in a project

1. Copy the files to the places in the table, on a `gate/foundation` branch. Edit the patterns in `zones.yml` for the project's folders. The gates run from the base branch, so this install PR only gets a notice; Ella explains it to the owner in plain words and merges it after their yes.
2. Set repository variables: `TEAM_OWNER` (the owner's GitHub login), `TEAM_CHECKER` (the Verifier's GitHub App login), `LINT_CMD` (prints `<path>\t<rule>` per violation and exits 0 or 1; Ops writes the small adapter for the project's linter; `none` for prototypes) and `SETUP_CMD` (installs dependencies). Ella lists them in the project's `team-settings.json` and sets them with the owner's sign-in (`.team/adapters/github/settings.py fill`), so the owner never opens GitHub's settings. `TEAM_RECEIPTS=off` only if the owner adds approval labels on GitHub themselves, and `DOCS_BUDGET` only to change the 6,000-word docs budget.
3. Create the labels: `.team/adapters/github/labels.sh <owner/repo>`.
4. **Check the plan first.** On a personal account, rulesets and required reviews on a private repo may need a paid GitHub plan; without enforcement every gate is only advice. Ops checks the current plan and price and brings the monthly figure to the owner before going further.
5. Branch ruleset on `main`: pull requests only, the `team-gates` and `team-checks` jobs required, **review from code owners required**, no force-push, no deletion, no bypass for anyone but the owner. `CODEOWNERS` names the owner for every path (`* @<owner>`) at stages 0 and 1, so nothing merges without the owner's approving review. Ella gives that review from the owner's sign-in right after a receipt; a PR she opened herself (the brief, the decision log) merges through the owner's bypass, also after a receipt. At stage 2 and 3 the owner removes the paths that may auto-merge from `CODEOWNERS` (a gate change, so it needs their label); the red zone and gate files always keep the owner.
6. Agent identity: see [agent identity](../../playbooks/foundation.md#agent-identity).
7. **Rehearse.** Run `bash .team/templates/foundation/tests/selftest.sh` locally. Then open six throwaway PRs on ticket branches with `Closes #<n>`, each of which must fail at the step meant to catch it:
   - an edited existing test (tamper guard)
   - a red-zone path (tamper guard)
   - a lint violation (quality gate)
   - an approval label added by the agents' account (tamper guard)
   - a push after the owner's label (labels removed, then tamper guard)
   - a PASS without the checker's approval (verdict check)

   Then one real ticket PR that should pass, all the way to Vera's approval and the `verified` label turning the gates green. The last four exercise the GitHub side the self-test can't. Also confirm the agents' account can't merge a green PR on its own. Vera records each run link, failing step and message in `verification/foundation/rehearsal.md` on a `gate/rehearsal` branch. Stage 1 starts only after this.

**Prototype and hobby (lite, the default):** steps 1 to 5, `LINT_CMD=none` if there's no linter yet, and no `TEAM_CHECKER`; the self-test is the rehearsal. The kit's `zones.yml` ships with its `require:` lines commented out, so a beginner never meets a checker App or a linter on day one. **Internal and production:** turning those lines on is part of moving up a profile. With them on, a missing checker, `LINT_CMD=none` or a ticket with no cap fails the gates, so a forgotten setting can't quietly weaken a real project.

**Merged checks.** Verifier checks keep running on every PR as regression tests. A check is a `*.sh` or executable file; helpers and fixtures beside it are left alone. At each cleanup cycle, Ops moves old ones into the project's own test suite in a `verify/<issue>-tests` PR with `tests-approved`.

## What the kit does and doesn't ship

The kit ships the tamper guard, the verdict check, the docs budget and a quality ratchet over whatever `LINT_CMD` prints. It doesn't ship stack-specific checks. Complexity, security, type and duplication rules arrive through `LINT_CMD` if the linter covers them. The new-dependency check, token lint, accessibility, visual baselines and hidden scenarios are separate CI jobs Ops writes for the stack at foundation. Until they exist, the foundation checklist isn't done.

Sample `LINT_CMD` values (each prints `<path>\t<rule>` and keeps the linter's own crash as a failure):

```bash
# Python, ruff (turn on C901 for complexity and S for security in ruff.toml)
bash -o pipefail -c 'ruff check --output-format=concise --exit-zero . | sed -nE "s/^([^:]+):[0-9]+:[0-9]+: ([A-Z]+[0-9]+).*/\1\t\2/p"'

# JavaScript or TypeScript, ESLint (add the complexity rule in eslint.config.js)
bash -o pipefail -c 'npx eslint -f unix . | sed -nE "s/^([^:]+):[0-9]+:[0-9]+:.*\[[A-Za-z]+\/(.+)\]$/\1\t\2/p"'
```

These are starting points, not tested on every version; Ops checks the output format during the rehearsal.
