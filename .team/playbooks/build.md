# Build

Builds an approved spec one bounded ticket at a time, with someone other than the builder checking the work.

**Who:** Ella brings requests in and decisions out. Priya runs each ticket, Ian builds, Vera checks, Bea prices. Arjun joins only for multi-unit builds, Max when quality is a score, Otto beside (never inside).
**Ends with** a PR carrying evidence in `verification/`. The owner merges; Otto releases ([production](production.md)).

## A ticket from start to finish

| Step | Who | What happens | Owner involved? |
|---|---|---|---|
| 1. Request | Ella | The owner asks Ella for a change. Ella opens an issue and hands it to Priya | They asked |
| 2. Draft | Priya | Creates `team/<issue>-<slug>` with the draft change spec as its first commit | No |
| 3. Price | Bea | Comments the size, cost range and cap on the issue | No |
| 4. Review | Fresh agents | Comprehension and readiness checks on the committed draft ([spec review](research-to-spec.md#spec-review-the-goldfish-check)) | No |
| 5. Approve | Owner, through Ella | Ella shows the spec and price with her recommendation; the owner's own words, naming the spec's commit, are posted on the issue | **Yes** |
| 6. Prepare | Vera | Writes checks from the spec before any code exists | No |
| 7. Build | Ian | Builds, self-checks, opens the PR | No |
| 8. Verify | Vera | PASS or BLOCK on that exact revision; on BLOCK, back to step 7 (three rounds at most) | No, but on internal and production projects the owner may have to start Vera's approving session |
| 9. Merge | Owner, through Ella | With PASS and green CI, Ella brings the PR, its evidence and the preview | **Yes** |

A trivial change skips steps 3 to 5: the owner's request is the approval, and Priya's handoff comment holds the criteria, so they're pinned even if the issue body changes. Ian builds and Vera checks against that comment. A full spec goes through [research to spec](research-to-spec.md) and is approved by merging its `docs/` PR, then Priya splits it into tickets or a multi-unit dispatch.

## Who runs the handoffs

Agents never call or wait on each other. Each one posts a handoff naming the next role and ends its turn, and the main session (Ella) starts whoever the `role:` label names, through the fix rounds, stopping only at the two owner steps or a typed blocker. Each agent gets its handoff (paths and exact commits), never another agent's transcript. Vera writes her checks before she reads the diff.

- **Prototype and hobby:** everything can run in one session, with Vera as a subagent.
- **Internal and production:** Vera's approving run is her own session with the checker key, so the session that ran Ian can't approve its own work ([agent identity](foundation.md#agent-identity)). Ella starts her session with the next prompt from the issue, through the tool's scheduler or background agents where it has them. Otherwise Ella gives the owner the one line to paste.
- **Later:** a GitHub Action can start the next agent whenever a ticket changes hands. That runs agents in CI on a paid key, so it needs the owner's spend approval.

Every handoff is still a team comment on the issue ([github-state](../docs/github-state.md)), so any tool can pick the work up and the dashboard shows where it stands.

## Two modes

| Mode | For | Coordinator |
|---|---|---|
| **Ticket** (default) | One change spec and its GitHub issue | Priya |
| **Multi-unit** | A full spec split into dependent units | Arjun, who writes the acceptance map, orders the units and writes release notes |

Before anyone adds a third agent to the default, Max tests whether it beats the pair on frozen cases.

## Accepting a verdict

The coordinator (Priya in ticket mode, Arjun in multi-unit) acts on a verdict like this:

- **PASS:** Vera hands it to you. Wait for the gates to re-run after her `verified` label, and accept only with green CI at the exact head she reviewed. Then set `stage:review` with `needs-human` + `human:merge` for Ella.
- **BLOCK:** goes straight back to Ian, not through you. You can't waive a finding; if you dispute one with evidence and can't agree with Vera, record both views for the owner.
- **INCONCLUSIVE:** get the missing evidence from whoever has it.
- **Third BLOCK:** Vera hands it to you. Stop with a typed blocker and the evidence, and say whether you think the spec or the approach is wrong. If a finding survived a round with nothing new, look again at the requirement before blaming the build.

## Trivial changes

A change is trivial when one sentence describes its diff and it touches no gate, test, dependency or red-zone path: docs, copy, a config value, a small obvious fix. Priya labels the issue `class:trivial` and writes the criteria in her handoff comment to Ian, with the branch, base, scope (the paths the sentence names) and baseline.

- No change-spec file, no spec review, no separate price (it shows up in the weekly ledger). Priya still creates the branch, with no commit of her own, and hands it straight to Ian.
- One fresh Vera session checks it against that comment and writes `verdict.json`. CI runs as always.
- Cap: four sessions (build, verify, one fix round of each). Anything bigger becomes a normal ticket.
- A "trivial" PR that touches a protected zone fails the tamper guard and stops being trivial.

## Rules for builds

The separation rules (builder never accepts, checks from the spec, PASS plus green CI, three BLOCKs then a typed blocker, read-only tests, the repo is the handoff) are in [principles](../principles.md#separation-of-duties). On top of them:

- Nobody gets build work until the owner approved the spec version. Spec approval isn't approval to deploy.
- Vera writes needed changes to existing tests on a `verify/<issue>-tests` branch, and the owner approves them.
- Ian can't touch approved documents (brief, specs, decision records he didn't add); the tamper guard enforces it.

## Who merges

The owner, through a required code-owner review, until a zone reaches stage 2 or 3 ([staged autonomy](foundation.md#staged-autonomy)). The red zone never auto-merges. Agents never change the stage. Without a release section in `TEAM.md`, the run stops at the merged PR.

## Dark run

After the dispatch, agents don't ask the owner questions until the final report. They resolve open questions from the spec and record the reason. They still raise `needs-human` for what only the owner can do (typed blockers, spend over a cap, UI baselines, red-zone approval, merging a unit others depend on), and that stops only the affected units.

## When quality is a score

Prompts, model choices, judges and extractors have no pass or fail test. Max owns the golden set, the scorer and the verdict; Ian changes the prompt; Vera checks the gate and the evidence.

| Loop | How | Use for |
|---|---|---|
| Eval loop | Run on the golden set, score, change one variable, run again. Log prompt hash, set version, model, mode, score and cost every time | Any prompt that carries product quality |
| Parallel candidates | Three variants scored on the same set; keep the losers with their scores | The one or two prompts the product can't ship without |
| Dual judge | Two independent calls must agree before a costly action; disagreement goes to review | Auto-posting, auto-buying, anything nobody double-checks |

Stop when the gate passes (more polish is a new decision), the cap is hit (12 prompt iterations, 3 candidate rounds by default), three attempts gain under a point (the approach is wrong; propose another), spend reaches the allocation, or the loop shows the spec is wrong. Every stop except a pass goes to the owner with the score path.

Agent labour and the product's own API spend are separate budgets. The product's calls are metered and logged from the first one. Development loops on a mode that may train on inputs use synthetic data only. Gate scores, demos and any real user data use the no-training mode, and a gate score counts only in the mode production uses.

Max's report gives the method before the numbers, the whole score path, each error and whether the system would have caught it, and one quotable sentence with its n.
