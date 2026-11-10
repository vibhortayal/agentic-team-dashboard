# How we work

Every change starts as a small written spec with testable criteria. It's built as a ticket that flows through build, an independent check and automated gates, with a limit on work in progress. The owner merges it and it ships in small steps. There are no sprints, story points or standups. Agents swarm on reading, research and review, never on writing: each piece of code has one builder.

**[M]** marks a claim from a measured study, **[P]** one from practitioner or vendor guidance.

```text
Idea ─▶ Intake (Ella) ─▶ Spec (Priya) ─▶ Spec review (fresh agents) ─▶ Owner approves
  ─▶ Tickets on the board (WIP limit)
  ─▶ Build (Ian) ─▶ Verify (Vera, checks from the spec first) ─▶ CI gates   [BLOCK: up to 3 rounds]
  ─▶ PASS + green CI + preview ─▶ Owner merges ─▶ Release (Otto, owner approves) ─▶ Operate
```

Around it sits the [engagement](../playbooks/engagement.md) layer: an estimate before work starts, priced change requests, weekly status and re-baselining.

## Compared with the usual methods

| | Waterfall | Scrum | SAFe | Kanban and DevOps | **Ours** |
|---|---|---|---|---|---|
| Unit of work | The whole system | Stories in a sprint | Features across teams | Items flowing one by one | **A ticket with a one-page spec** |
| Planning | All up front | Every sprint | Every 8 to 12 weeks | Continuous | **Per change, reviewed by fresh agents** |
| Coordination | Plans and managers | Ceremonies | Release-train roles | Board and WIP limits | **The repo, labels and CI** |
| Quality | Test phase at the end | Definition of done | Demos | Automated pipeline | **An independent checker per ticket and gates the builder can't edit** |

**Waterfall.** We keep "write it down first" and drop the single big pass, which Royce's 1970 paper already called risky. Agents can't ask a colleague what was meant, so the spec is their only source of intent and the Verifier's source of checks. Ours are a page per change.

**Scrum.** We keep small increments and fast feedback and drop the ceremonies. Standups and sprint events exist so people can share a picture in their heads. An agent finishes a ticket in hours and keeps nothing between sessions, so a sprint boundary only adds waiting. The shared picture lives in the repo and on the board.

**SAFe.** Little carries over. Our problem isn't many teams agreeing; it's many agent sessions not contradicting each other. One source of truth, pinned spec versions and automated checks solve that, not meetings.

**Kanban and DevOps** are the backbone: flow, WIP limits, visible state, small batches, trunk-based work, fast tests. This matters more with agents. The 2025 DORA report found AI use goes with higher throughput but lower stability, and that strong controls like automated testing decide whether AI helps **[M, about 5,000 professionals]**.

**Spec-driven development** is the new practice of 2025 and 2026 (GitHub's Spec Kit, AWS Kiro) **[P]**. Anthropic's guidance: a good spec is self-contained, names files and interfaces, states what's out of scope and ends with a verification step, and you skip the plan when one sentence describes the diff **[P]**. The limit is real: a 2026 study of 88,052 pull requests found linked specs or tickets didn't reduce defects once complexity was controlled for **[M, observational]**. So we treat the spec as the source of the Verifier's checks, and let the checks do the guaranteeing.

**Swarming** helps breadth, not writing. Anthropic's multi-agent research beat a single agent by 90.2% but used about 15 times the tokens **[M]**. A study of seven multi-agent frameworks found failure rates of 41% to 86.7%, many from miscommunication **[M]**. On whole projects a developer and tester pair beat a single agent (49.5% against 45.7% of requirements met) while adding a designer dropped it to 27.7% **[M, preprint]**. So Researchers and Critics run in parallel, and each ticket gets one builder and one checker.

## What replaces the ceremonies

| Ceremony | Here | How often |
|---|---|---|
| Sprint planning | Spec approval and ticket split | Per change |
| Standup | The board's labels and team comments | Always current |
| Demo | Verifier evidence, screenshots and the PR preview | Per ticket |
| Retro | Close-out retro, monthly health report, quarterly team review ([improve](../playbooks/improve.md)) | Per project, monthly, quarterly |
| Tech-debt sprint | One budgeted cleanup ticket | Every two weeks by default |
| Release planning | Autonomy stage review with evidence ([foundation](../playbooks/foundation.md#staged-autonomy)) | When criteria are met |

Nothing wakes an agent by itself. Each handoff ends with the next prompt to paste, and the cadences start when the owner pastes a prompt from the README or a scheduler in the tool runs it.

## Not settled

As of November 2026 no controlled study compares delivery methods for agent teams, and no study shows spec-driven tools improve agent output. This is our best fit with current guidance and the evidence on batch size, stability and team shape. The health report and retros tell us whether it works, and roles get tuned when it doesn't.

## Sources

Royce (1970), [Managing the Development of Large Software Systems](https://faculty.washington.edu/hazeline/misc/reserve/royce_waterfall.pdf) · [Agile Manifesto principles](https://agilemanifesto.org/principles.html) · [Scrum Guide 2020](https://www.scrumguides.org/scrum-guide.html) · [SAFe](https://scaledagileframework.com/) · [Kanban Guide](https://kanbanguides.org/) · DORA on [small batches](https://dora.dev/capabilities/working-in-small-batches/) and [trunk-based development](https://dora.dev/capabilities/trunk-based-development/) · [2025 DORA report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report) · [Spec Kit](https://github.com/github/spec-kit) · [Fowler on Kiro, Spec Kit and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) · [Claude Code best practices](https://code.claude.com/docs/en/best-practices) · [Hill, ESEM 2026](https://drops.dagstuhl.de/storage/00lipics/lipics-vol394-esem2026/LIPIcs.ESEM.2026.84/LIPIcs.ESEM.2026.84.pdf) · [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system) · [Cognition on multi-agents](https://cognition.com/blog/multi-agents-working) · [MAST](https://arxiv.org/pdf/2503.13657) · [arXiv 2511.04064](https://arxiv.org/html/2511.04064v1) · Our full evidence review: [research](research/agentic-software-company-practices.md)
