# Document templates

Copy the section you need into the path shown. Keep each document to a page; if it won't fit, the thinking isn't done yet. Write in plain words (see "Writing" in `principles.md`).

## Project brief

`docs/brief.md` · written by Ella, approved by the owner.

```markdown
# Brief: <name> vN
Approved: <link to owner's message> · Date: <YYYY-MM-DD> · Profile: <research | prototype | hobby | internal | production | other>
Read: <repos, docs, research reviewed> · Not verified: <what couldn't be checked>

## Goal            The outcome in the owner's words, then one plain sentence.
## Who it's for    Users and what changes for them.
## How we'll know  Two to four measurable signals.
## Scope           In: ... Out: ...
## Constraints     Spend ceiling, paid services allowed, time, data and privacy, platforms. Owner-stated only.
## What exists     Code, research and decisions to reuse, with links. What was rejected before and why.
## Advice          Risks, the recommended approach, alternatives, anything we advise against.
## Open questions  | Question | Proposed default | Who answers | Blocking? |
## Team            | Agent | Hired? | Why |  First playbook and why. Autonomy stage.
```

## Research brief

Posted on the research issue, by whoever asks for research.

```markdown
Mode: informed | independent
Question: <one sentence>
Decision it feeds: <what the owner decides with this, and by when>
Must read: <files or links; empty in independent mode>
Must not read: <in independent mode, the earlier passes>
Known constraints: <link the knowledgebase>
Time box: <e.g. 45 minutes>
Output: research/<slug>.md
```

## Change spec

`docs/changes/<issue>.md` on the ticket branch, written by Priya. Used for every change except a new product's first version or one that reshapes the data model or API (those use [spec.md](spec.md)). Trivial changes put the criteria in the issue instead.

```markdown
# Change: <title>
Ticket: <issue link> · Approved: <owner's message> · Date: <YYYY-MM-DD> · Status: proposed | shipped in #<PR>

## Why            One or two sentences: the problem and who it affects.
## What changes   Behaviour before and after.
## Owned paths    What this change may touch. Anything else needs a scope change.
## Acceptance criteria
| # | Given | When | Then |
| AC1 | | | |
## Budget         Size S/M/L · Estimate $low–$high · Cap <n> sessions, <r> fix rounds (stop with a typed blocker, never exceed)
## Proof command  The one command that shows it works, which Vera re-runs.
## Out of scope
## Risks          Red-zone paths touched, or none.
```

Evidence isn't written by hand: the PR links the CI run and `verification/<issue>/verdict.json`.

## Change request

`docs/change-requests/CR-<n>.md` · Priya writes, Bea prices, the owner decides.

```markdown
# CR-<n>: <title>
Requested by: <owner's message> · Date: · Status: proposed | approved | rejected | withdrawn

## What changes   The new or changed requirement, and which spec or ticket it touches.
## Why            In the owner's words where possible.
## Impact         | | Before | After | Change |  for cost range, calendar range, milestones moved. Biggest assumptions.
## Options        1. As asked. 2. A smaller version that fits the budget. 3. Defer.  Recommendation and why.
## Decision       The owner's choice, linked.
```

## Estimate

`budget/estimate-vN.md` · written by Bea.

```markdown
# Estimate: <project or feature> vN
Based on: <brief or spec path @ commit> · Prices: budget/prices.yml dated <date> · Calibration: uncalibrated | N past tickets · Approved: <owner's message>

Cost $low–$high · Agent time <range> · Calendar time <range>, assuming <owner response time>

| # | Ticket | Size | Tiers | Cost low | Cost high | Cap (sessions, rounds) |

Assumptions that move the number most: ...
Not included: hosting, paid services, anything outside agent runs unless listed.
Changes since last version: | Date | Change | Cost | Time | Approved |
```

## Weekly status

`reports/status-<YYYY-MM-DD>.md` · Bea, from GitHub, CI and the ledger. Anything unmeasured is labelled.

```markdown
# Status: <project>, week of <date>
Headline: on track | at risk | off track, and why, in one sentence.
What you need to do: <needs-human items with links, or "nothing this week">
Progress: | Milestone | Planned | Forecast | Done / total |   Done this week, next, blocked (typed).
Money: | Approved budget | Spent | Forecast at completion | Drift % |
Risks: | Risk | Likelihood | Impact | What we're doing |
Changes: CRs opened, approved or rejected, with cost impact.
```

The close-out report (`reports/close-out.md`) uses the same shape for the whole project: final cost and time against the baseline.

## Decision record

`docs/decisions/DR-<n>.md` · Priya owns them; the owner approves stack and red-zone decisions.

```markdown
# DR-<n>: <title>
Status: proposed | accepted | superseded by DR-<m> · Date: · Approved: <owner's message, if stack or red zone>

## Context        What forces the decision, in two to five sentences.
## Decision       A rule an agent can follow.
## Enforced by    The check that fails when the rule breaks, where it runs, and an error message that says how to fix it.
                  Or "Not enforceable", why, and who reviews it when.
## Alternatives   Each with the reason it lost.
## Consequences   What gets easier, what gets harder, what would make us revisit.
```

## Health report

`reports/health-<YYYY-MM>.md` · Otto writes it, a fresh Vera checks the numbers.

```markdown
# Code health: <YYYY-MM>
Period: · Script: <path@commit> · Numbers checked by: <verdict path>
Summary: better, worse or flat, and the one thing the owner should know.

| Measure | This month | Last month | Direction |
Change failure rate · Rework within 30 days · Lint and type errors · Complexity over limit · Duplicated blocks ·
Copy vs refactor · BLOCK rounds per ticket (avg, worst) · Typed blockers by type · Owner send-backs

Unhealthy modules: | Module | Why | Next cleanup |
Design notes seen more than once (propose a rule for each).
Recommendations: at most three.
```
