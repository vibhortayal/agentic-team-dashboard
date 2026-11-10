# Foundation: gates before features

Run this once per new project repo, before any feature work. Checks the agents can't change are what keep agent-built code honest, so they come first.

**Who:** Ops sets it up, Priya drafts the risk zones, the owner owns the gate files and approves the zone map.
**Ends with:** a protected `main`, green CI from the first commit, owner-owned gate files, preview and production environments, and a rehearsed rollback.

Prototype and hobby projects use the [foundation kit](../templates/foundation/README.md)'s lite setup: tamper guard and verdict gate, no checker App, a linter only if there is one, and the kit's self-test as the rehearsal. Hobby adds tests in CI. Everything else below is for internal and production projects.

## Rules

1. **Protect `main` and require CI** before any feature work, with the foundation kit and its gate rehearsal. Gate files (CI workflows, rulesets, `CODEOWNERS`, `TEAM.md`, `AGENTS.md` and installed role files, lint and test config, `zones.yml`) belong to the owner.
2. **Builders can't edit existing tests.** A tamper guard in CI enforces it, and it covers test config, workflows, hooks, fixtures, `verification/` scripts, the quality baseline and lockfiles changed without a dependency change. Hidden scenarios and eval holdouts are never visible to the builder; Vera's committed checks are visible by design and protected by her diff before each verdict. Agents also get a "stop and flag" exit (typed blockers), but read-only tests and caps are the real control ([research](../docs/research/agentic-software-company-practices.md)).
3. **Hidden scenarios.** Keep a few end-to-end scenarios where only CI can read them. Visible tests alone overstate quality.
4. **Small specs.** A one-page change spec and a structured ticket: owned paths, a proof command, acceptance criteria. Its status is updated in place (`shipped in #<PR>`), never moved.
5. **Short rules file.** `AGENTS.md` stays under about 100 hand-written lines with no directory listing. Tools with their own rules file get a one-line file that imports it.
6. **AI review informs; checks decide.** AI reviewers miss and invent problems ([research](../docs/research/agentic-software-company-practices.md)), and a human clicking approve without reading is weak too. Required checks, path rules and environment approvals carry the weight.
7. **The red zone never auto-merges.** One owner-controlled file lists it: sign-in and sessions, authorisation and data separation, payments, secrets, migrations, data export and deletion, infrastructure and production config, production deploys, the gates, anything that deletes or weakens a test, new dependencies, prompts and model ids unless the eval gate passed, quotas and spend caps, legal pages.
8. **Contain the agents.** Unattended work runs in vendor cloud sessions or a container with no production credentials. Backups sit in an account no agent can delete. Rollback and restore are rehearsed.
9. **Hard caps.** Limit tickets in progress, attempts per ticket (three, then a typed blocker), and sessions and fix rounds per ticket (set by Bea from the estimate). Scripted runs get turn, time and dollar limits. One agent per ticket, and a single agent before many.
10. **Own the logs and evals.** Log every model call and agent run in your own schema. Evaluate AI features on labelled files you own, split into dev and holdout (say 70/30).
11. **Typed blockers.** When a ticket can't be done honestly, the agent stops and files one of: unclear request, missing access, too big, impossible. That's a good outcome.

## Staged autonomy

Autonomy widens one risk zone at a time, on measured results. The red zone never moves.

| Stage | Merges without the owner | The owner |
|---|---|---|
| 0 | Nothing; gates being built | Owns gate files, approves the zone map |
| 1 (about a month) | Nothing | Merges everything, judging evidence and previews, not diffs |
| 2 | Copy, working notes, new tests | Reads the health report |
| 3 | Features and fixes inside owned paths, on green | About 30 minutes a week on previews, release approvals and the report |

**How it's enforced.** The ruleset on `main` requires a review from code owners. At stages 0 and 1, `CODEOWNERS` names the owner for every path, so nothing merges without the owner's approving review. Moving a zone to stage 2 or 3 means taking its paths out of `CODEOWNERS`; PRs that touch only those paths then merge on green checks (an agent, or the host's auto-merge, can click merge). The red zone, gate files and approved documents (brief, specs, decision records, estimates) always keep the owner. `CODEOWNERS` and `TEAM.md` are gate files, so no agent can change the stage.

A stage changes only on the owner's message, after Ops shows the evidence in the health report. Default entry criteria (a project's `TEAM.md` can change the numbers):

- **1 to 2:** four weeks and 20 merged PRs at stage 1, every gate live and rehearsed, the checker identity in place, and fewer than 10% of PRs sent back in the last two weeks.
- **2 to 3, per zone:** six weeks at stage 2, no send-backs in that zone for four weeks, change failure rate at most 10% and not rising, a flat or improving health report, and a passing code audit.

**Code audit.** A fresh agent that has never seen the project, ideally on a different vendor's model, reads a sample of the zone's merged code (default: the 10 largest PRs since the last audit) with `DESIGN.md`, the decision records and `AGENTS.md`, and reports problems by file and line. This is the Critic's audit mode. Findings a tool could catch become gate rules; the rest go to the owner. The audit is evidence for the owner's call, not a gate. The team uses no paid human review by default; the research recommends one, so revisit it if a stage-3 zone ships a defect the audit should have caught, or the product starts handling payments or sensitive personal data.

Why not run unattended from day one: studies of AI-assisted repos show a short speed boost followed by lasting rises in warnings and complexity. That decay is slow and green tests don't show it, hence the monthly health report and the audit.

## Quality gate: block new violations only

The kit ships the ratchet; the checks behind it come from the project's linter and from CI jobs Ops writes for the stack ([what the kit ships](../templates/foundation/README.md#what-the-kit-does-and-doesnt-ship)). Until each row below is live, the foundation isn't done.

CI fails a PR that adds any of these in the files it changes. Old violations don't block.

| Check | Fails on | Free tools (pick per stack) |
|---|---|---|
| Lint | A new error | ESLint, Ruff, golangci-lint |
| Types | A new type error; strict mode on new code | TypeScript `strict`, mypy, pyright |
| Complexity | A new or changed function over the limit (start at cyclomatic 10, 60 lines) | ESLint `complexity`, Ruff `C901`, lizard |
| Duplication | A new copied block over 50 tokens, or above the baseline share | jscpd |
| Security | A new high or critical finding | Semgrep, CodeQL on public repos |
| Dependencies | A new dependency without a decision record, or with a known high or critical vulnerability | The package manager's audit, Dependabot |

On day one Ops records the counts in `quality/baseline.json`. The baseline only moves down: when a PR pays off old debt, the number drops and stays dropped. Thresholds live in owner-owned config, so loosening one is a red-zone change. A new inline rule disable, or a function split only to dodge a limit, is a Verifier finding unless the spec allows it (the kit doesn't count disables itself). Design problems tools can't see (a wrong abstraction, misleading names) are Verifier notes for the health report; a note that keeps coming back becomes a rule.

## Dependency policy

Models invent package names in about 5% of code samples, attackers register those names, and compromised releases of popular packages have stolen secrets through AI coding tools. So each new direct dependency passes a CI check before the owner is asked:

| Check | Passes when |
|---|---|
| Exists | It's on the official registry under exactly that name |
| Age | First release at least 30 days old |
| Usage | Over 1,000 weekly downloads, or the registry's nearest measure |
| Licence | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause or ISC; anything else needs the owner |
| Vulnerabilities | No known high or critical advisory for that version |

The stack decision record lists the starting set, and the owner approves it once with the stack. After that each addition is approved on its own. Every new version waits seven days (set in the package manager), install scripts are off and lockfiles are committed. A package that fails a check, or an urgent patch that can't wait seven days, needs the owner's waiver, recorded as a decision record. Prefer a small in-house helper over a tiny package. Ops writes the check for the stack and owns its config as a gate file.

## Architecture checks

Written architecture is advice; only checks hold it. Every decision record names the check that enforces it, or says why none can. For apps with more than one layer, start with a one-way layering rule (UI, then services, then data; nothing imports upward) checked by a dependency rule tool, and single entry points for sign-in, telemetry and AI providers so nothing else imports those SDKs. Each rule's error message says what to do instead. Rule configs are gate files. Small scripts and single-layer tools skip the layering rule but still record decisions.

## UI quality (projects with screens)

Agents left alone produce the generic AI look. Pin them to a design system and make them look at their output.

1. `DESIGN.md` from [the template](../templates/DESIGN.md): brand, named tokens, one standard component library close to its defaults, do's and don'ts. Owner-owned.
2. Token lint: CI fails on raw colours (and raw spacing where possible) outside the token file.
3. Screenshots of every changed screen at phone and desktop widths, light and dark, in the Verifier's evidence.
4. Committed visual baselines. Changing one needs `human:approve-ui`.
5. An automated accessibility check fails on new violations, and new components get a keyboard-only pass. Automated checks catch about half of real issues, so this is a floor.
6. The Critic in design mode reviews screenshots against `DESIGN.md` before the owner sees them.
7. Before launch, a few target users try it while someone watches. Findings become tickets.

## Agent identity

Agents never act through the owner's GitHub account. If they did, no gate could tell an agent's approval from the owner's.

- **Builders use a machine account** (GitHub allows one free one per person) with Write access to this repo only, through a fine-grained token: contents, issues and PRs read and write; no admin, workflows or secrets. It isn't on the ruleset's bypass list, and approval labels it adds don't count.
- **The Verifier uses a separate GitHub App from the start** (internal and production), set as `TEAM_CHECKER`. Every PASS ends with the App approving the exact head commit. The verdict gate requires that approval, so a builder can't write its own PASS, and any later push voids it. Only Verifier sessions can reach the App's key, so for internal and production projects Vera's approving run is her own session, never a subagent of the session that ran Ian. In practice: put the key in a separate tool workspace or cloud environment that only Vera's sessions use, and run builders where it isn't. If your tool can't keep secrets apart, the owner starts Vera's session by hand. Before every verdict she diffs `verification/<issue>/` from her own last commit to the head; any change she didn't make is a BLOCK, raised with `needs-human` as tampering.
- **Prototypes may skip the App** and run everything in one session. The gate then prints a note and the owner reads `verification/` before merging.
- Tokens and keys live in the agent tool's secret store. Never in the repo, a prompt or a chat.

## Setup checklist (Ops)

- [ ] Repo private unless the owner says otherwise; no licence file unless the owner picks one
- [ ] The GitHub plan enforces rulesets and required reviews on this repo (a private repo on a free personal plan may not); if it needs a paid plan, the monthly figure goes to the owner first
- [ ] Machine account and token, and the checker App; the owner's own token never goes to an agent
- [ ] Foundation kit installed: workflow, scripts, owner-approved `zones.yml`, PR and issue templates, the `TEAM_OWNER`, `TEAM_CHECKER`, `LINT_CMD` and `SETUP_CMD` variables, labels
- [ ] Ruleset on `main`: PRs only; `team-gates`, `team-checks` and the project's tests required; review from code owners required, with `CODEOWNERS` naming the owner for every path; no force-push or deletion; owner-only bypass
- [ ] CI also runs tests, type check and secret scan
- [ ] `CODEOWNERS` gives the owner the gate files and red-zone paths
- [ ] Dependabot and secret scanning on; seven-day release age and install scripts off
- [ ] New-dependency check in CI
- [ ] **Gate rehearsal:** the kit's self-test, then the six planted PRs in the [kit's install steps](../templates/foundation/README.md#install-in-a-project) each fail at the step meant to catch it, and the agents' account can't merge a green PR; run link, failing step and message for each in `verification/foundation/rehearsal.md` on a `gate/rehearsal` branch
- [ ] `zones.yml` edited to the project's real folders: the red zone, the tests zone, and any script the test command calls (added to the gate zone). The shipped patterns are only a start
- [ ] A preview per PR (or one staging slot) and a production environment with an approval rule
- [ ] Rollback and backup restore rehearsed once, commands written down
- [ ] Apps: layering rule and single entry points in CI, recorded as DR-1
- [ ] Screens: `DESIGN.md`, token lint, screenshots, visual baselines, accessibility check
- [ ] Production profile: the owner creates a private repo for hidden scenarios and installs only the checker App on it; Vera writes the scenarios from the spec; a CI job checks them out with the App's token and runs them against the PR preview. The builders' token can't read that repo

## Starting layout

```text
README.md, AGENTS.md, TEAM.md, DESIGN.md (screens), zones.yml, Makefile (one command surface)
budget/                prices.yml, estimate-vN.md, ledger.csv
docs/brief.md          the approved brief
docs/specs/            vN.md, vN-review/, vN-dispatch.md
docs/changes/          <issue>.md change specs
docs/change-requests/  CR-<n>.md
docs/decisions/        log.md (owner decisions and overrides), DR-<n>.md records, each naming its check
research/  reports/  quality/baseline.json  verification/<issue>/  work/<issue>/
.github/               workflows, team/ gate scripts, CODEOWNERS, ISSUE_TEMPLATE/, PR template
src/ai/                provider adapter (one function per AI task), prompts/, schemas/, call log
tests/                 unit, integration, e2e, visual baselines (read-only to builders)
evals/  loops/         product eval cases and eval-loop logs
infra/                 infrastructure as code, separate credentials per environment (red zone)
```

Held-out scenarios, the eval holdout slice and backups live outside the repo.

Defaults that come with it (Priya records them in the stack decision record): plain provider SDKs behind the small adapter, with no LangChain or gateway library unless a decision record says why (a popular gateway shipped credential-stealing releases in 2026); data owned by a group (household, team, org) from the first schema, with currency and time zone in it; platform-paid AI with per-user quotas, a monthly budget alert and the cheapest model that passes the eval set.

## Gaps in the evidence

CI design for agents, release and rollback mechanics, runaway-cost controls and GitHub ruleset details rest on thin sources. We found no study on same-model versus different-model review, or on mutation testing.
