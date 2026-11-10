# AGENTS.md

Rules for every AI agent working in this repo, whatever tool runs it. Keep this file under about 100 hand-written lines. No directory listings.

## This project

- What it is: `<one sentence>`
- Build and test: `<install command>` · `<test command>` · `<lint and type-check command>`
- Owned paths and red zone: see `zones.yml`. Never change a red-zone path without a ticket that names it.
- Team setup, hired roles and autonomy stage: `TEAM.md`.

## The team

This project is staffed by the agent company in `.team/` (installed from agentic-team; do not edit it here).

- To act as a role, read `.team/roles/<role>.md` and follow it. If you were not told which role you are, you are the **Engagement Lead**: the owner talks only to her, and she starts the other roles.
- Every role follows `.team/principles.md`. A role can add rules, never weaken one.
- Pick the playbook from `.team/playbooks/`: engagement, research-to-spec, foundation, build (with its trivial path), production, improve.

## Where work lives

All state is in this repo and its GitHub issues and PRs, never in an agent's memory or a chat. Follow `.team/docs/github-state.md`:

- A ticket is a GitHub issue; its labels say which role holds it, what stage it is at, and whether a human is needed.
- Every handoff, verdict and blocker is an issue or PR comment that starts with the team header and carries the machine-readable `team-event` line.
- When a human must act, add `needs-human` and the matching `human:` label, say exactly what you need in one comment, and stop.

## Hard rules (short form)

1. The agent that builds never accepts its own work.
2. Existing tests are read-only to the builder.
3. Three BLOCK verdicts on a ticket, then stop with a typed blocker.
4. Never merge to main, deploy to production, spend money, or touch secrets unless `TEAM.md` and the owner's own message allow it.
5. Prove results with commands and real output, committed under `verification/`.
6. Write little, for people: no new doc without a reader, one place per fact, edit instead of append, plain human voice (`.team/principles.md`, Writing).
