# Production: release, run and keep healthy

How merged work reaches users and stays healthy. Releases are for hobby, internal and production projects; prototypes stop at a preview link. Monitoring, incidents and support are for internal and production.

**Who:** Otto (releases, monitoring, incidents, health, housekeeping), Ian (previews, fixes, cleanup), Vera (preview and smoke checks, health numbers), Priya (support triage), owner (approves every production deploy and every spend).

## Release

```text
PR ─▶ preview of the PR head ─▶ Vera checks it ─▶ PASS + green CI ─▶ owner merges
  ─▶ Otto prepares the release ─▶ owner approves ─▶ deploy ─▶ smoke ─▶ watch ─▶ released or rolled back
```

1. **Preview before merge.** Every PR that changes behaviour gets a preview of its exact head: per PR where the host offers it, otherwise one staging slot, one ticket at a time. Ian deploys it with the command in `TEAM.md`; Vera checks it as part of the verdict.
2. **A release is a list of merged PRs.** Otto cuts it from `main` with a semver version, plain release notes, its migrations and the exact rollback command, on a release issue labelled `needs-human` + `human:approve-release`.
3. **The owner approves every production deploy** through the environment's approval rule, until the autonomy stage covers releases. Migrations, sign-in, payments and data deletion always need the owner.
4. **Deploy, smoke, watch.** Otto deploys the approved version, runs the smoke checks from `TEAM.md` and watches errors and latency for the window (default 30 minutes). The tag comes after the window.
5. **Roll back first.** A failed smoke check or an error alert in the window means roll back, then open an incident. Rollback and restore are rehearsed at foundation and after any change to how the app deploys.
6. **Migrations are their own step.** A release says whether its migration is backward compatible. One that isn't gets its own release, after a verified backup.
7. **Agents never hold production credentials.** Deploys run from CI with the environment's secrets. An agent triggers the workflow and never sees the keys.

## Monitoring (buy, don't build)

Set up at the first release with managed services, on free tiers where they fit. Otto proposes each with its monthly cost; the owner approves any spend. Cover: an uptime check on the main page and a health endpoint, error tracking tagged with the release, searchable logs with an approved retention, automatic backups in an account no agent can delete, and spend alerts on every paid service and model provider. Every alert opens or updates a GitHub issue labelled `incident`, so the board is the one place to look.

## Incidents

| Severity | Meaning | Response |
|---|---|---|
| SEV1 | Down, data loss or a security problem | Roll back or switch off first; tell the owner at once (`needs-human` + `human:blocker`) |
| SEV2 | A main feature broken for many users | Fix or roll back the same day |
| SEV3 | A minor bug or degraded path | A normal ticket |

Stabilise before diagnosing: roll back, turn the feature off or scale down. Never hot-fix production. The fix is a ticket with a failing check that reproduces the incident ([trivial path](build.md#trivial-changes) if it qualifies). SEV1 and SEV2 get a blameless post-mortem by a fresh agent: what happened, why the gates missed it, and one change to a gate, check or role, which goes to [improve](improve.md).

## Support

User reports from email, a form or app feedback become GitHub issues labelled `support`. Priya triages them weekly: a bug becomes a ticket with a severity, a request becomes a change request, and a question gets an answer the owner approves before it's sent. Agents never reply to users directly.

## Code health

The quality gate stops new mess. This part measures what's left and pays it down, in every project with merged code.

**Monthly report.** Otto writes `reports/health-<YYYY-MM>.md` ([template](../templates/documents.md#health-report)) from numbers it can recompute, and commits the script. A fresh Vera re-runs it before the owner sees the report. It covers change failure rate (merged PRs followed within 14 days by a revert, hotfix or bug ticket naming them), rework (lines changed again within 30 days), warnings, complexity and duplication against the baseline and last month, copying versus refactoring, BLOCK rounds per ticket, typed blockers by type, owner send-backs with reasons, and the least healthy modules. Never report "% of code written by AI"; nobody measures it with a disclosed method. It ends with at most three recommendations, each with one line of evidence.

**Cleanup.** Every cycle (default two weeks), Otto files one cleanup ticket from the latest report, a normal change spec with owned paths and a proof command and a fixed budget (default one Ian and one Vera session). What doesn't fit waits for the next cycle. Ian refactors in small steps with existing tests green; Vera checks behaviour didn't change and the numbers moved the right way. A module flagged unhealthy is cleaned before a new feature lands in it, and Priya adds that cleanup to the feature's plan. When a count drops, the same PR lowers `quality/baseline.json`.

## Housekeeping

Weekly, before the owner resets or merges anything, and whenever the owner asks, Otto checks this repo and every project repo with a `TEAM.md`. Repos the owner put on hold are left alone.

1. `git fetch --prune origin`.
2. `git status` in every checkout from `git worktree list`. Name the agent that owns each dirty tree; never commit, stash or discard another agent's work.
3. Unpushed commits per branch (`git log --oneline origin/<branch>..<branch>`). A local `main` ahead of `origin/main` is always reported.
4. Delete branches whose tip is in `origin/main` and whose PR merged. Never delete `main`, an active branch, one with an open PR, or one with unmerged commits; ask its owner.
5. `git worktree prune`, and remove only your own clean, merged worktrees.
6. Post one short summary: what was deleted, what's dirty or unpushed and whose, what's left for the owner.

Merging to or resetting `main`, tags, force-pushes, deploys and deleting a repo stay with the owner.
