# Engagement: how a project runs

We work with the owner the way a good agency works with a client: a likely cost and timeline before saying yes, every scope change priced, and an honest re-estimate when things drift. The build itself happens in [build](build.md); this playbook wraps it.

**Who:** Ella (the owner's single point of contact: intake, proposal, every request and decision after that), Bea (estimates, status, ledger), Priya (specs, change requests), owner (approves).

## Project profiles

Ella's first question is what kind of project this is, because the answer sets how much process applies. It goes in `TEAM.md` and changes only on the owner's word.

| Profile | For | What runs | Vera's own key | Ends with |
|---|---|---|---|---|
| **research** | A question, no product | Researcher and Critic, no code gates | No code | A graded report |
| **prototype** | A demo, an event, an idea test | Rough estimate, the [trivial path](build.md#trivial-changes) for most tickets, the lite gate kit, session caps | No; one session can run everything | A demo link and a keep, kill or harden call |
| **hobby** | Personal and low stakes, but long-lived | Prototype plus tests in CI and a simple release | No | A personal deploy |
| **internal** | A tool a few people rely on | Full foundation, change specs, weekly status, release | Yes | Production for a small group |
| **production** | A product for real users | Everything, including the UI kit, monitoring, incidents and support | Yes | A live, supported app |
| **other** | Anything else | The closest profile, with the differences written down | As that profile | A new profile once the same kind of project shows up twice |

Moving up a profile (say prototype to production) is a change request. Bea prices a hardening pass first: tests for untested paths, a security, dependency and red-zone review, monitoring, a rollback rehearsal. The owner approves it before the profile changes.

## Lifecycle

| Step | What happens | Who | Output |
|---|---|---|---|
| 1. Intake | Profile, goal, users, scope, constraints, budget ceiling | Ella | Decision log |
| 2. Proposal | Brief plus a rough estimate: milestones, cost and calendar ranges, assumptions, exclusions | Ella, Bea | `docs/brief.md`, `budget/estimate-v1.md` |
| 3. Sign-off | The owner approves both; that sets the baseline budget and dates | Owner | Merged `docs/` PR |
| 4. Delivery | Specs, tickets, build and verify, inside each ticket's cap | Priya, build team | Merged PRs with evidence |
| 5. Release and run | Production releases, monitoring, incidents, support | Otto, owner | [production](production.md) |
| 6. Change requests | New or changed scope is written up and priced before work starts | Priya writes, Bea prices, owner approves | `docs/change-requests/CR-<n>.md` |
| 7. Weekly status | Done, next, blocked, spend against budget, dates against plan, risks, what the owner must do | Bea | `reports/status-<date>.md` |
| 8. Re-baseline | Actuals drift more than 20% from the estimate for the rest of the work | Bea, owner approves | `budget/estimate-vN.md` |
| 9. Close-out | Final cost and time against the baseline, then a retro by a fresh agent | Bea, then Quinn | `reports/close-out.md`, `reports/retro.md` |

Ella stays the owner's contact through every step. Approvals, the weekly status and anything else for the owner reach them through her. Templates for all of these are in [templates/documents.md](../templates/documents.md).

## Existing projects

When the owner brings a repo that already exists, the team reads it before anyone asks a question.

1. **Read.** Rohan writes `research/repo-map.md` in informed mode: what the app does today, the stack, how to run it, whether tests exist and pass, and where it looks fragile, each claim with the file or command that shows it. Otto runs the health checks and records `quality/baseline.json`, so old debt can't block new work, only grow.
2. **Interview.** Ella opens intake with what the team found and asks where the owner wants it to go. The profile, brief and estimate follow as for a new project.
3. **Fit the foundation.** Otto installs the kit and branch protection in their own `gate/` PRs, which the owner approves. Code without tests gets tests before it changes: the first ticket for an untested area pins its current behaviour, and only then does a feature ticket change it.

After that it runs like any other project.

## Rules

1. **No work without an approved number.** Inside an approved ticket, reversible work needs no further ask.
2. **Ranges, not single numbers,** with the assumptions that move them most. Early ranges are wide. Say so.
3. **Show the owner's time.** Agents are fast; reviews and approvals are usually the slow part. Calendar estimates list both, with the assumed response time.
4. **Price changes before starting them.** If a change would break the budget, flag `needs-human` + `human:spend` and wait.
5. **Status comes from data.** Every number in the weekly status comes from GitHub, CI or the ledger. Anything unmeasured is labelled as such.
6. **Drift means re-baseline.** Past 20% drift, Bea re-estimates and the owner approves before work continues.

Early numbers will be rough and the ledger will have gaps until tools report usage. If this layer stops earning its keep, the quarterly review can retire it.
