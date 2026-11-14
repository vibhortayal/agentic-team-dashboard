# Improve the team

How the team learns from its projects: which handoffs fail, which roles earn their cost, and when to tune, merge, retire or add a role. It runs in this repo, fed by evidence from projects. Tune roles here, never in a project's installed copy.

**Who:** a fresh Critic (retros), Max (quarterly review and comparisons), Rohan and Quinn (weekly watch and role refresh), owner (approves every change to a role or rule).

```text
project evidence ─▶ retro by a fresh agent ─────┐
outside research ─▶ weekly watch (Rohan, Quinn) ─┴▶ team-finding issues here
  ─▶ quarterly scorecard ─▶ owner picks ─▶ tested on frozen cases ─▶ new team version
```

## 1. Retro

At every close-out, and after every SEV1 or SEV2, a Critic that didn't work on the project reads only the evidence: issues and team comments, `verification/`, the ledger, health reports, post-mortems and send-backs. It writes `reports/retro.md`, answering:

- Where did a handoff fail (missing input, wrong recipient, asked twice, waited on nobody)?
- Which checks caught real problems, and what reached the owner or production unseen?
- Where did the owner have to step in, and could a rule or check have saved that?
- Where did cost or time drift, and why?

Findings about the team, not the project, go to this repo as issues labelled `team-finding`, with links and no project vocabulary.

## 2. Quarterly review

Max gathers the `team-finding` issues and the ledgers of the quarter's projects into a role scorecard: sessions used, outputs actually used, rework caused, cost share, handoff failures, and a proposal for each role.

Every proposal links the findings and numbers behind it.

- **Tune** a role that misses the same kind of thing twice.
- **Merge** two roles when one is nearly always followed by the other with no hand-back, or both are thin.
- **Retire** a role, or make it optional, when nothing it produced was used for two quarters, or a CI check now does its job.
- **Add** a role only when the same gap shows up in two projects and no check, template or existing role covers it. Prefer a check to a persona.
- **Profiles:** if the same "other" kind of project came up twice, propose a new profile.

It also names the slowest step on the board, the most common blocker type, and questions agents asked that a document should have answered.

## 3. Change one thing and test it

1. Start from a dated finding with evidence (commit, verdict, log).
2. One hypothesis, one change to one role or skill file. No change while a run that uses the role is in flight.
3. Run the old and new role on the same frozen cases, with the same model and task wording.
4. Check nothing else got worse: spec coverage, review strictness, security, autonomy.
5. Record the finding, the change, before and after, and the revert path in the pull request.
6. Bump the role's `version:` and tag the repo. Projects move their pin when they choose.

Before a team version is tagged, a fresh agent on a different model reviews the whole repo cold.

Keep quality and performance apart; never fold them into one score. Quality: independent PASS at an exact revision, negative control blocked, owner interventions during a dark run (target zero), evidence complete. Performance: time to first useful response, wall-clock per unit, rework rounds, token and API cost per unit.

## 4. Weekly watch

Retros learn from our own projects; the weekly watch learns from everyone else's. Once a week a fresh session checks what changed in agentic coding and proposes what the team should change in response. It never changes a role, skill or rule on its own.

1. **Rohan scans** the last seven days in independent mode, time box about 30 minutes. Where to look, in this order: papers and benchmark results on coding agents, multi-agent work, evaluation and agent security; the agent-tool vendors' own engineering posts, docs and changelogs; the Agent Skills format and official skill collections; security advisories that touch agents or skills. He reads this repo first and keeps only what would change how a role, skill, playbook or check works here. Something the model already knows, or that only restates what we do, is not a finding. Every finding gets a primary source he opened, its date, a grade and the file it would change.
2. **Quinn vets** each proposed change cold: does the evidence carry it, would it weaken a principle, does it add words without a reader, is it already covered. Each gets ADOPT, ADOPT WITH NOTES or REJECT, with one line why. A proposed outside skill goes through the full skill checklist in the [practice and skill review](engagement.md#practice-and-skill-review).
3. **Report.** One issue here labelled `team-finding`, titled `Weekly watch <date>`: what changed out there (a few lines, each linked), what Quinn adopted and why, what was rejected, and anything to keep an eye on. A quiet week says so in one line.
4. **Changes.** Each adopted change follows step 3 above: one change to one file, in its own pull request on a `docs/watch-<date>-<topic>` branch, linking the issue, with `python3 tools/teamcheck.py` and `python3 tools/sandbox/selftest.py` passing. Model cases run only when the owner asks, with a spend cap. The owner merges or closes; nothing merges unreviewed.

Team rules win over anything the watch finds: a finding that would weaken a principle goes to the owner as a question in the issue, never as a pull request.

## 5. Role refresh

Roles shouldn't depend on the owner knowing what good looks like. Each role names the outside references it's grounded in (its **Grounded in:** line), and each week the watch also refreshes one role, in a fixed rotation, so every role is looked at about every ten weeks. The same run re-checks one phase of the [lifecycle map](../docs/lifecycle.md) against its references.

1. **Rohan reads the role cold** in independent mode, then the current versions of its references and any newer leading practice for that job, and looks for published skills for its tasks: the stack vendors' official skills first, then well-known publishers, then community collections.
2. **Adopt before writing.** Where a vetted outside skill does a task well, the role uses it instead of describing the task itself, and the role file keeps only how our team works: handoffs, authority, separation of duties. The team writes its own skill only where nothing good exists.
3. **Quinn vets** each proposed change and skill as in the weekly watch, with the full skill checklist from the [practice and skill review](engagement.md#practice-and-skill-review).
4. **Changes** follow step 3 above: one file per PR, frozen cases run before and after when the owner asks, the owner merges.

Each quarter the rotation also re-checks the [hosting shortlist](../docs/hosting.md): providers still sound, picks still right, links working. Once a month the watch also checks each pinned outside skill for a newer upstream version; an update is re-scanned and re-vetted before its pin moves.

## Testing the team

Three layers, cheapest first. Run the first two after any change to a role, playbook, template or tool.

| Layer | Command | Model? | Runs |
|---|---|---|---|
| Free checks: role files, vendor names, links and anchors, labels, the handoff table, case format, every installer, the gate self-test | `python3 tools/teamcheck.py` | No | Every pull request here (about a minute) |
| Tool self-test: planted mistakes the checks and the handoff replayer must catch, and a scripted fix loop through the harness | `python3 tools/sandbox/selftest.py` | No | Every pull request here |
| Role cases and end-to-end projects | `tools/sandbox/run.sh <adapter> --max-usd <cap> <case...>` | Yes | On demand, locally, in Docker |

The model layer never runs in CI. Each case gets a fresh copy of a tiny fixture project with the team installed, a local remote, and a stand-in `gh` that keeps issues, labels and comments in a file, so nothing touches GitHub. Agents run with full permissions, which is why it runs in Docker. In an end-to-end case the runner plays the main session (it starts each role from the next prompt in the latest team comment) and the owner (it answers and approves from the case, and merges only a head with a PASS). Afterwards the replayer checks every handoff (`python3 tools/teamcheck.py replay`).

**Spend** is capped and visible: `--max-usd` caps the whole run, each session gets what's left as its own cap, and no session starts once it's spent. Every session's tokens and cost go into the run's `ledger.csv`, in the budget ledger's format, next to `report.md`. An adapter that can't report cost needs `--allow-unpriced`, and then only turn and time caps apply. Start with one case and a small cap; check the real cost before running the whole set.

## Frozen cases

Each case is `evals/<case-id>/case.md`: frontmatter with `role` (a role, or `e2e` for a whole flow), `kind` (`negative` when the role must block, refuse or push back) and `fixture` (a starting project in `evals/fixtures/`), then these sections:

- **Task:** the prompt exactly as the agent gets it.
- **Setup:** a bash block that seeds issues, branches and earlier handoffs, using the helpers in `evals/fixtures/lib.sh`.
- **Expected:** what a correct result does, and the planted defect for a negative case.
- **Checks:** one per line, run against the result without a model: `event` and `no-event` (a new team comment whose event matches, e.g. `from=verifier verdict=BLOCK`), `label <n> has|lacks <label>`, `file` and `no-file <branch-glob> <path-glob> [contains <text>]`, `same <branch-glob> <path>` (unchanged since setup), `run <branch-glob> <shell command>`, `merged` and `not-merged <issue>`, `main-unchanged`.
- **Rubric:** yes/no questions for a judge model, only for what a check can't decide (did Ella explain the risk plainly). Every answer must be yes.
- **Owner:** what the simulated owner says when asked (end-to-end cases).

Prefer checks to rubric questions; judges cost money and disagree. A case never changes once used in a comparison; add a new one instead. Every set has at least one negative case, and no case carries project words. The seed set covers every role and two end-to-end flows on the word-count fixture; each project's retro adds at least one positive and one negative case from a real ticket.
