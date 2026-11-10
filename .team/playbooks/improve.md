# Improve the team

How the team learns from its projects: which handoffs fail, which roles earn their cost, and when to tune, merge, retire or add a role. It runs in this repo, fed by evidence from projects. Tune roles here, never in a project's installed copy.

**Who:** a fresh Critic (retros), Max (quarterly review and comparisons), owner (approves every change to a role or rule).

```text
project evidence ─▶ retro by a fresh agent ─▶ team-finding issues here
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
2. One hypothesis, one change to one role file. No change while a run that uses the role is in flight.
3. Run the old and new role on the same frozen cases, with the same model and task wording.
4. Check nothing else got worse: spec coverage, review strictness, security, autonomy.
5. Record the finding, the change, before and after, and the revert path in the pull request.
6. Bump the role's `version:` and tag the repo. Projects move their pin when they choose.

Before a team version is tagged, a fresh agent on a different model reviews the whole repo cold.

Keep quality and performance apart; never fold them into one score. Quality: independent PASS at an exact revision, negative control blocked, owner interventions during a dark run (target zero), evidence complete. Performance: time to first useful response, wall-clock per unit, rework rounds, token and API cost per unit.

## Frozen cases

Each case in `evals/<case-id>/` has `task.md` (the ticket exactly as an agent gets it), `repo/` (a tiny starting repo, or a pinned public repo and commit), `expected.md` (what a correct result does, and the planted defect for a negative case) and `kind` (`positive` or `negative`, where Vera must BLOCK). A case never changes once used in a comparison; add a new one instead. Every set has at least one negative case, and no case carries project words.

The set starts empty. Each project's retro adds at least one positive and one negative case from a real ticket. Until there are three, compare on the project's own recent tickets and say so in the PR.
