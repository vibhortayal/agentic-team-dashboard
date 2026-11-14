# Team state on GitHub (the contract)

Every agent, in any tool, keeps the team's state in the project repo and its GitHub issues and PRs. Nothing important lives only in an agent's memory or a chat. This is also the contract a dashboard reads: if it is not here, the dashboard cannot show it and a fresh agent cannot pick it up.

Create the labels once per repo with [adapters/github/labels.sh](../adapters/github/labels.sh).

## Objects

| Thing | Lives in |
|---|---|
| Project brief, spec, change spec | Files in the repo (`docs/brief.md`, `docs/specs/`, `docs/changes/`), linked from the issue |
| Ticket (one unit of work) | A GitHub issue, using the change-spec template as its body or linking to it |
| The work | A branch and a PR that says `Closes #<issue>` |
| Handoff, verdict, blocker, question | A comment on the issue (or PR), in the format below |
| Working files for a ticket | `work/<issue>/` on its branch (acceptance map, notes); they stay in place after merge |
| Evidence | `verification/<issue>/` in the PR: commands, output, `verdict.json` |
| Team setup and autonomy stage | `TEAM.md` |

## Branches: where each file is written

`main` is protected: no agent pushes to it, and nothing merges into it without the owner's yes (until a zone's autonomy stage says otherwise). The owner says yes to Ella in their chat; she posts the approval receipt and presses merge with the owner's sign-in ([principle 1](../principles.md#authority)). `main` is the test version; going live is a release tag cut from it ([production](../playbooks/production.md)). Every file reaches `main` through a pull request on one of these branches:

- **`team/<issue>-<slug>`, a ticket.** Holds the change spec (`docs/changes/<issue>.md`), the code, new tests, `work/<issue>/` and Vera's `verification/<issue>/`. Priya creates it (Arjun for multi-unit units), with the change spec as the first commit unless the ticket is trivial; then Ian pushes; Vera pushes only under `verification/<issue>/`. Merged after PASS, the checker's approval, green CI and the owner's yes to the preview. Its PR stays a draft while the team works, so the gate doesn't fail (and email the owner) on every push; Priya marks it ready on PASS and the gate runs then.
- **`docs/<topic>`, an approval.** Anything the owner approves before work starts: the brief, a full spec and its review, the dispatch, an estimate, a change request, research, decision records not tied to one ticket. Written by the role that owns it. The owner's yes, with its receipt, is the approval, and the merge follows it; handoffs point at the merge commit.
- **`team/records`, standing records.** The ledger, weekly status, health reports, retros and close-out, from Bea, Otto, Max and Quinn. Ella merges it weekly with the status report; it changes no app code, so it needs no separate yes.
- **`verify/<issue>-tests`.** Vera's changes to existing tests. After the owner's yes, Ella adds `tests-approved` and merges it before the ticket.
- **`deps/<name>`, `dependabot/...`.** Dependency updates, merged after the owner's yes and `deps-approved`.
- **`gate/<topic>`.** Gate files and the foundation kit, from Otto. After the owner's yes, Ella adds `gate-change-approved` and merges.

The gate rejects a pull request from any other branch name (unless the agent tool picks branch names itself; then the PR description says `Team branch: <name>` and that name counts) and checks that each class only touches its own paths ([foundation kit](../templates/foundation/README.md#pull-request-classes)).

### Git workflow: trunk-based, short-lived branches

One main line, `main`, always releasable; no `develop` or long-lived release branches, because long branches drift apart and that drift is where merge conflicts come from.

- **Small and short.** One branch per ticket, cut from the latest `main`, merged within about two working days. A ticket that would take longer is split; unfinished work hides behind a feature flag rather than waiting on a branch.
- **No overlapping tickets.** Each ticket lists its owned paths. Priya doesn't start a ticket whose paths overlap one already in progress; it waits.
- **Up to date before the check and before the merge.** The branch takes in the latest `main` (a merge, never a rebase or force-push, so reviewed revisions stay findable) before Vera's verdict and again before the merge. The ruleset requires branches to be up to date; with several auto-merges a day, use the host's merge queue where the plan offers it.
- **Squash merge.** Each ticket lands on `main` as one commit named after its issue, so the history reads as a list of changes and any one reverts cleanly. Branches are deleted after merge.
- **Releases are tags on `main`,** and a production fix is a normal small ticket from `main`.

Rules:

1. Every agent pushes its own work before a handoff; a local-only commit is not a handoff.
2. No agent pushes to another role's branch, except the Verifier under `verification/<issue>/` on the ticket branch. The tamper guard rejects evidence written for any other issue, and the checker identity's approval of the exact head shows the PASS is the Verifier's ([agent identity](../playbooks/foundation.md#agent-identity)).
3. Commits after the reviewed revision that touch only `verification/<issue>/`, or a merge from `main` with no conflict in the ticket's files, keep the verdict valid. Any push still voids Vera's approval of the head, so she re-approves the new head (and adds `verified` again) without writing a new verdict. Anything else needs a new verdict.
4. Nothing is moved or archived after merge. The Implementer sets the change spec's `Status:` to `shipped in #<PR>` as part of the PR itself; a full spec's status is updated in the next `docs/` PR.

## Labels

| Group | Labels | Meaning |
|---|---|---|
| Who holds it | `role:engagement-lead`, `role:product-manager`, `role:researcher`, `role:critic`, `role:architect`, `role:implementer`, `role:verifier`, `role:evaluator`, `role:budget-analyst`, `role:ops` | The role that must act next. Exactly one at a time. |
| Stage | `stage:intake`, `stage:research`, `stage:spec`, `stage:ready`, `stage:building`, `stage:verifying`, `stage:review`, `stage:done` | Where the ticket is. Exactly one at a time. |
| Human needed | `needs-human` plus one of `human:answer`, `human:approve`, `human:approve-spec`, `human:approve-release`, `human:merge`, `human:spend`, `human:access`, `human:red-zone`, `human:approve-ui`, `human:blocker` | The work is waiting on a person. The comment that added it says exactly what is needed. |
| Blocker type | `blocker:unclear`, `blocker:access`, `blocker:too-big`, `blocker:impossible` | Set with `human:blocker` when a ticket stops. |
| Mode | `mode:ticket`, `mode:multi-unit`, `class:trivial` | Build mode and the fast path (see [build](../playbooks/build.md)). |
| Owner approvals | `gate-change-approved`, `tests-approved`, `deps-approved`, `red-zone-approved` | Count only when the owner's account adds them after an approval receipt; the tamper guard checks both ([foundation kit](../templates/foundation/README.md)). |
| Owner limits | `spend-approved`, `rounds-approved` | Put on the issue from the owner's account, after a receipt, to let a ticket go past its cap or past three BLOCKs; the limits check checks both. |
| Verifier | `verified` | Added to the PR by Vera right after her approving review, so the gates re-run. |
| Operations | `incident`, `support`, `owner-rejected` | Production incidents, user reports, and PRs the owner sent back (counted for autonomy stages). |

Whoever hands work on swaps the `role:` and `stage:` labels in the same step as posting the handoff comment.

| Event | `stage:` | `role:` | Human label |
|---|---|---|---|
| Request from the owner (Ella opens the issue; for a new project, as soon as she knows the idea) | `intake` or `spec` | engagement-lead, then product-manager | |
| Change spec drafted, being priced | `spec` | budget-analyst | |
| Priced, in spec review | `spec` | product-manager | |
| Spec or change spec waiting for approval | `spec` | product-manager | `needs-human` + `human:approve-spec` |
| Approved, checks being prepared | `ready` | verifier | |
| Checks prepared (Verifier's handoff) | `building` | implementer | |
| Building | `building` | implementer | |
| Revision handed to the Verifier | `verifying` | verifier | |
| BLOCK (first or second) | `building` | implementer | |
| Third BLOCK | stays `verifying` | the coordinator (product-manager or architect) | |
| PASS, coordinator checking CI | stays `verifying` | the coordinator | |
| INCONCLUSIVE | stays `verifying` | the role that must supply the missing evidence | |
| PASS + green CI, waiting for the owner to try it | `review` (owner trying it) | product-manager | `needs-human` + `human:merge` |
| Owner asks for a change (same branch and PR, not a BLOCK) | `building` | implementer | `owner-rejected` (kept for the record) |
| Merged | `done` | none (Ella removes the label on her next board read) | |
| Typed blocker | stays | role that stopped | `needs-human` + `human:blocker` + `blocker:*` |
| Anything else the owner must approve (brief, estimate, change request, zone map, re-baseline, release) | stays | role that asked | `needs-human` + `human:approve` (or `human:approve-spec`, `human:approve-release`); the comment names what |
| Research question | `research` | researcher | |

A trivial ticket (`class:trivial`) skips `ready`: the Product Manager hands it straight to the Implementer.

The role that receives the owner's answer removes `needs-human` and the `human:` label in the same step as acting on it.

## Comment format

Every team comment starts with a one-line header people can read, and ends with one machine-readable line:

```markdown
**Vera (verifier) → Ian (implementer)** · verdict · BLOCK · rev `abc1234`

<the body: findings, evidence paths, what is needed>

<!-- team-event {"from":"verifier","to":"implementer","kind":"verdict","verdict":"BLOCK","rev":"abc1234","round":2} -->
```

A handoff, fix request or verdict body opens with the **evidence line**: `Rows:` acceptance rows · `Revision:` full commit · `Files:` paths · `Command:` what ran · `Expected / actual:` one line · `Repro:` smallest reproduction. Use `n/a` where a field does not apply; it never replaces the source documents.

Every comment that hands work on ends with a **next prompt**: one line in a code block that the next role's session can be started with, for example `You are the Verifier. Read .team/roles/verifier.md and act on issue #42.` Ella uses it to start the next agent. When the next step is several independent fish runs (spec review, research), the comment carries one next prompt per run; Ella starts each, and the `role:` label stays with the role that asked. In a tool that can't start sessions, Ella gives the owner each line to paste.

`from` and `to` are role names (`to` is `owner` when the comment asks a person to act). `kind` is one of `handoff`, `verdict`, `blocker`, `question`, `report`, `note`, `approval`. An `approval` is Ella's receipt for the owner's yes: it quotes their words in a `>` line and adds `"approves"` (a label, `merge` or `release`) and `rev` where there is one. `verdict` is `PASS`, `BLOCK` or `INCONCLUSIVE`. Add `"human":"<human: label>"` when the comment asks a person to act. Bea's pricing comment on a ticket adds `"cap_sessions":<n>`, which the limits check reads. A comment that offers a preview adds `"preview":"<url>"`, which the progress board shows as the change's try-it link. Keep the JSON on one line.

## verdict.json

```json
{"issue": 42, "rev": "abc1234", "verdict": "PASS", "round": 1,
 "checks": [{"id": "AC1", "spec": "docs/changes/42.md#AC1", "command": "npm test -- ac1", "result": "pass"}],
 "notes": []}
```

## What a person sees

The owner normally just asks Ella, who answers from this data, or looks at the progress board, a page on their own computer that reads the same data. It is a view, not a second source of truth, and it reads only these:

- **Waiting for you:** open items labelled `needs-human`, with the text of the comment that added it. Ella's `note` comments show as "Ella handled these herself".
- **What the team is doing:** the `stage:` label in everyday words, who holds it from the `role:` label, the header of the latest team comment, and the latest verdict.
- **Try it:** the newest `preview` link in a PR's team comments; otherwise a GitHub deployment of the PR's branch or head with a working address (most hosts report these).
- **Your app:** the live link is the newest working deployment to an environment named `production`, `prod` or `github-pages`. Versions are the repo's GitHub releases, so every release tag gets a release with plain notes.

Anyone who does use GitHub can filter issues by `needs-human` for the same inbox, by `role:` for who is working on what, and by `stage:` for progress.
