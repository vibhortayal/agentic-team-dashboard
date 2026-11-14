# Production: release, run and keep healthy

How merged work reaches users and stays healthy. Releases are for hobby, internal and production projects; prototypes stop at a preview link. Monitoring, incidents and support are for internal and production.

**Who:** Otto (releases, launch readiness, monitoring, incidents, health, housekeeping), Ian (previews, fixes, cleanup), Vera (preview, smoke and launch checks, health numbers), Quinn (threat list, abuse cases, store review), Max (AI safety and drift), Priya (support triage, the 30-day review), Bea (costs at scale), owner (approves every production deploy and every spend).

## Release

```text
PR ─▶ preview of the PR head ─▶ Vera checks it ─▶ owner tries it ─▶ "yes" ─▶ Ella merges
  ─▶ staging, the test version (all of main) ─▶ smoke + owner run-through ─▶ "put it live" ─▶ same build to production
  ─▶ smoke ─▶ watch ─▶ released or rolled back
```

The app runs in up to three places. The owner never has to read a pull request; they judge the work by trying it, like a user acceptance tester.

| Place | Shows | Profiles |
|---|---|---|
| **Preview** | One PR's exact head, at its own link | All with screens |
| **Staging** | `main` as it stands, redeployed after every merge | Internal, production |
| **Production** | What real users use | Hobby, internal, production |

Previews and staging use made-up or scrubbed data, never real users' personal data. Staging matches production's setup (same services and config shape, smaller plans) so what passes there behaves the same live.

1. **Preview before merge.** Every PR that changes behaviour gets a preview of its exact head: per PR where the host offers it, otherwise one staging slot, one ticket at a time. Ian deploys it with the command in `TEAM.md` and puts its link in his handoff's `preview` field ([github-state](../docs/github-state.md#comment-format)), where the progress board finds it; Vera checks it as part of the verdict.
2. **The owner tries it.** With the PASS, Ella sends the preview link and three to five "try this" steps in plain words, which Vera writes from the acceptance criteria. The owner answers "yes" or what to change, in the chat; they never open GitHub. A change goes onto the same ticket and PR, not as a BLOCK (it doesn't count toward the three), and counts as a send-back in the health report. On a yes, Ella posts the receipt and merges. A change with nothing to see (a fix inside the code) skips this step and says so.
3. **A release is a list of merged PRs, tried together on staging.** Otto cuts it from `main` with a semver version, plain release notes, its migrations and the exact rollback command, on a release issue labelled `needs-human` + `human:approve-release`. Vera runs the smoke checks on staging; Ella sends the owner the staging link and a ten-minute checklist covering what's new and the main journeys.
4. **Build once, promote the same build.** The artifact the owner tried on staging is the one deployed to production; it is never rebuilt in between.
5. **The owner approves every production deploy** by saying "put it live" to Ella, always as its own question, until the autonomy stage covers releases. Ella posts the receipt (`approves` `release`, with the tag) and approves the environment's approval rule for them; Otto deploys only after that receipt. Migrations, sign-in, payments and data deletion always need the owner.
6. **Deploy, smoke, watch.** Otto deploys the approved version, runs the smoke checks from `TEAM.md` and watches errors and latency for the window (default 30 minutes). The tag comes after the window, with a GitHub release carrying the plain release notes, because the progress board lists the app's versions from releases.
7. **Roll back first.** A failed smoke check or an error alert in the window means roll back, then open an incident. Rollback and restore are rehearsed at foundation and after any change to how the app deploys.
8. **Database changes never break the running app.** They go in two steps: add the new shape and write to both, then, in a later release once nothing reads the old shape, remove it. A release says which step its migration is. One that can't be split gets its own release, after a verified backup.
9. **Unfinished or risky features hide behind a switch** (a feature flag in config or a managed flag service), so `main` stays releasable and a bad feature is turned off without a deploy. Large changes roll out to a share of users first where the host allows. Flags are removed once the feature is settled; a flag older than 90 days is a cleanup ticket.
10. **Agents never hold production credentials.** Deploys run from CI with the environment's secrets. An agent triggers the workflow and never sees the keys.

## Launch readiness

Green tests don't make a product safe to put in front of real users. Before the first production release, Otto opens a launch issue with this checklist, filtered by the product type in `TEAM.md`. Each item has an owner and a proof committed under `verification/launch/`. The owner approves the first production release only when every item is green or knowingly waived; Ella records each waiver and its risk in the decision log. Internal projects run the rows marked **all**; production projects run every row for their type. Later releases rerun a row when the change touches what it covers.

| Item | Type | Who | Proof |
|---|---|---|---|
| **Threat list** for each red-zone area (sign-in, data separation, payments, uploads, admin): how it could be attacked and the check that stops it | all | Quinn at planning; checks join the spec | `docs/specs/vN-review/threats.md` |
| **Security scan** of the running preview with OWASP ZAP's baseline scan, and the OWASP ASVS 5.0 Level 1 checklist, each requirement marked pass, fail or not relevant with how it was checked (the scan alone proves none) | web, api | Vera | Scan report, checklist |
| **Data list** in the spec: what personal data, why, where it's kept, which outside services see it, how long | all | Priya | Spec section |
| **Privacy policy and terms** from a managed generator (buy, don't build), matching the data list; legal pages are red zone | all | Priya drafts, owner approves | Links |
| **Users can download and delete their own data;** tracking waits for consent where the rules require it | all | Vera | Check scripts |
| **Load test** with k6 at 10 times the expected load in the spec, against a production-sized preview; costs shown at today's load and at 10 times | web, api, ai | Otto runs, Arjun sets the load, Bea prices | k6 summary, cost table |
| **Speed budgets** from the spec met: page speed via Lighthouse CI on the preview, start time and crash-free rate on mobile, response time and cost per call for AI | all | Vera | Report |
| **Accessibility** to WCAG 2.2 AA: the automated check plus a keyboard and screen-reader pass of the main flows; platform scanners on mobile | web, mobile | Vera | Notes, screenshots |
| **Backup restore** rehearsed within the last 90 days, inside the spec's data-loss and recovery targets | all | Otto | Drill log |
| **Monitoring** live (below) and **analytics** sending the spec's events | all | Otto | Dashboard links |
| **Email** that reaches inboxes: SPF, DKIM and DMARC set on the sending domain | if it sends email | Otto, owner edits DNS | Record check |
| **Support channel** feeding `support` issues, and the help pages live | all | Priya | Links |
| **Store must-haves** (below) | mobile | Priya, Quinn, owner | Store checklist |
| **AI abuse cases** pass (below) | ai | Max, Vera | Eval report |

Agents never say a product is "compliant" with a law. Where a project touches health, money, children or sensitive personal data, Ella tells the owner plainly that an hour with a lawyer is worth it before launch, and records the answer.

## Mobile apps

A store app can't be rolled back once it's on people's phones, and the store can reject it. So:

1. **Accounts.** The owner creates the store developer accounts; Ella walks them through it and Bea lists the fees. New store accounts can have waiting periods (a new personal Google Play account needs a closed test with a minimum number of testers for a minimum time); Rohan checks today's rules at intake and Bea puts them and review time in the calendar.
2. **Previews are test builds** (TestFlight on iOS, an internal test track on Android) of the PR head, or of `main` where per-PR builds cost too much. Vera checks them on simulators or emulators at the phone sizes the spec names.
3. **Build and sign in CI or a managed build service.** Signing keys live with the store or the service, never with agents. macOS build minutes cost far more than Linux, so Bea prices a managed build service against the CI plan.
4. **Version 1 ships a remote off switch** for risky features and a minimum-version check that asks users to update. Releases roll out in stages (a small share of users first), and Otto watches crash rate before widening.
5. **Store must-haves**, drafted by Priya and approved by the owner: listing text and screenshots, the privacy label or data safety form matching the data list, the privacy policy link, account deletion inside the app if users can sign up, and age rating. Before each submission Quinn checks the build against the store's published review guidelines and common rejection reasons.
6. **A rejection is a ticket,** with the store's message quoted, not an incident.

## AI features and agents

Max's evals measure whether AI output is good. These rules cover whether it can be tricked, leak, or do harm.

1. **Abuse cases.** Quinn writes them from the spec and the OWASP Top 10 for LLM applications, plus the [one for agentic applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) when the AI calls tools: prompt injection (including through documents, web pages or emails the AI reads), leaking personal data or its own instructions, harmful or off-topic output, an agent acting beyond its job, and runaway cost. Max adds them to the golden set as a red-team slice with its own pass mark, run before every prompt or model change.
2. **Least power.** An agent inside the product gets only the tools its job needs, and asks the user before it spends money, sends a message, deletes anything or acts outside the app. Its tool permissions are red zone.
3. **Tell users** when they're talking to an AI, and where its answers can be wrong.
4. **Drift.** Each month Max scores a small sample of real AI calls against the golden set's metric, only where users agreed and only through a mode that doesn't train on the data. A drop below the pass mark is a SEV3.
5. **Model changes are eval-gated.** Providers retire models. A new model or version goes through the full eval, red-team slice included, before release; retirement dates go on the coming-due list.

## Monitoring (buy, don't build)

Set up at the first release with managed services, on free tiers where they fit. Otto proposes each with its monthly cost; the owner approves any spend. Cover: an uptime check on the main page and a health endpoint, error tracking tagged with the release, searchable logs with an approved retention, automatic backups in an account no agent can delete (restored in a drill every quarter, not just once), product analytics for the spec's events from a privacy-friendly service, and spend alerts on every paid service and model provider. Every alert opens or updates a GitHub issue labelled `incident`, so the board is the one place to look.

Production projects name an **uptime target** in the spec (default 99.5% a month) and the error budget it leaves. When the budget is spent, Otto files reliability work before new features and Ella tells the owner. A **SEV1 also reaches a person**: through a free push or paging service to the owner's phone, in plain words: what's wrong, whether it was already rolled back or switched off, and what they need to do (usually nothing). Otto proposes the service; the owner approves it.

## Security upkeep

For internal and production projects, on top of the CI checks:

- **Patch deadlines** from the day an advisory is known: critical within 7 days, high within 30, the rest at the next cleanup cycle. A deadline that slips goes to the owner.
- **Keys and tokens rotate** at least yearly, at once when someone with access leaves, and whenever one may have leaked. The owner rotates (agents never see values); Otto puts the dates on the coming-due list.
- **Access review** each quarter: who and what (people, agent accounts, apps, services) can reach the repo, hosting, data and stores. Anything not needed is removed, by the owner.
- **A bill of materials** (an SBOM made by a free tool in CI) is attached to each release, so a new advisory can be checked against what's live.

## After launch

Thirty days after the first production release, then each quarter, Priya and Bea write a short review on `team/records`: each "How we'll know" signal from the brief against its target, cost per active user, the top support issues and incidents. Ella brings the owner one recommendation: keep going, change course (a change request) or stop.

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

**Monthly report.** Otto writes `reports/health-<YYYY-MM>.md` ([template](../templates/documents.md#health-report)) from numbers it can recompute, and commits the script. A fresh Vera re-runs it before the owner sees the report. It covers change failure rate (merged PRs followed within 14 days by a revert, hotfix or bug ticket naming them), rework (lines changed again within 30 days), warnings, complexity and duplication against the baseline and last month, copying versus refactoring, BLOCK rounds per ticket, typed blockers by type, owner send-backs with reasons, and the least healthy modules. Never report "% of code written by AI"; nobody measures it with a disclosed method. It also shows headroom (load and spend against their limits) and a coming-due list for the next 90 days: renewals, store and platform deadlines, model retirements, runtime end-of-life, free-tier limits, the next restore drill. Each item past due or within 30 days becomes a ticket. It ends with at most three recommendations, each with one line of evidence.

**Cleanup.** Every cycle (default two weeks), Otto files one cleanup ticket from the latest report, a normal change spec with owned paths and a proof command and a fixed budget (default one Ian and one Vera session). What doesn't fit waits for the next cycle. Ian refactors in small steps with existing tests green; Vera checks behaviour didn't change and the numbers moved the right way. A module flagged unhealthy is cleaned before a new feature lands in it, and Priya adds that cleanup to the feature's plan. When a count drops, the same PR lowers `quality/baseline.json`.

## Handover test

Once a year, and before a profile change, a fresh agent that has never seen the project tries to set it up and run it from the README and runbooks alone, with test credentials. Everything it trips on becomes a ticket for Priya. This is what makes "you own it" true: someone else could take the product over.

## Retirement

When the owner decides to switch a product off, Priya writes a change request and Otto runs it: tell users with a date (default 30 days' notice) and how to download their data; turn off sign-ups; on the date, take a final backup kept only as long as the law requires, delete user data and say so, shut down services and cancel paid plans (Bea confirms the bills stop), remove store listings, and archive the repo. The owner approves each step that deletes or publishes.

## Housekeeping

Weekly, before the owner resets or merges anything, and whenever the owner asks, Otto checks this repo and every project repo with a `TEAM.md`. Repos the owner put on hold are left alone.

1. `git fetch --prune origin`.
2. `git status` in every checkout from `git worktree list`. Name the agent that owns each dirty tree; never commit, stash or discard another agent's work.
3. Unpushed commits per branch (`git log --oneline origin/<branch>..<branch>`). A local `main` ahead of `origin/main` is always reported.
4. Delete branches whose tip is in `origin/main` and whose PR merged. Never delete `main`, an active branch, one with an open PR, or one with unmerged commits; ask its owner.
5. `git worktree prune`, and remove only your own clean, merged worktrees.
6. Match every merge to `main`, owner label and release since last week to an approval receipt from before it ([principle 1](../principles.md#authority)). One without a receipt is an incident: report it to the owner through Ella.
7. Post one short summary: what was deleted, what's dirty or unpushed and whose, receipts matched, what's left for the owner.

Resetting `main`, force-pushes and deleting a repo stay with the owner. Merges, release tags and deploys wait for the owner's yes.
