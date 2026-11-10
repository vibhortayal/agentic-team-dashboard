# Research to spec

Turns a rough idea into an approved spec. Small changes to an existing project skip straight to step 9 with a [change spec](../templates/documents.md#change-spec). A question that isn't a product (which database, which vendor) runs steps 1, 5 and 8 and ends in a decision record.

**Who:** Ella first, then two Researchers, Quinn, Priya. Max joins if quality lives in a model.

## Steps

| # | Step | Who | Output | Done when |
|---|---|---|---|---|
| 0 | Engagement: real goal, profile, staffing | Ella | `docs/brief.md` | Owner approves the brief |
| 1 | Hard constraints from primary sources: rules, deadlines, limits, terms | Researcher | `research/knowledgebase.md` | Every rule, date and price cites an official page |
| 2 | Owner's brainstorm, logged without judgement | Owner, Priya | `research/ideas-owner.md` | |
| 3 | Independent options, **without reading step 2** | Second Researcher | `research/ideas-independent.md` | Says at the top it didn't read the owner's ideas |
| 3a | Audit steps 1 and 3 against their sources | Fresh Researcher | `research/<report>-audit.md` | PASS, or fixes applied |
| 4 | Compare both passes; where they agree on their own is the strongest signal | Researcher | `research/comparison.md` | Each rejected option names what kills it |
| 5 | Vet finalists: prior art, feasibility, competitors, scoring against the real goal | Researcher | `research/vet-<idea>.md` | A verdict per finalist |
| 6 | Spike the riskiest assumption, with a pass mark set first. Spikes live in `spikes/`, never product code, under a session cap from Bea. Spikes need no spec approval and happen before the build | Implementer, Evaluator | `spikes/<n>/REPORT.md` | Pass mark met or fallback chosen |
| 7 | Owner picks, from one recommendation and the evidence | Owner | Decision record | Owner's own message |
| 8 | Critique the chosen direction; adjudicate any outside review point by point | Quinn | `research/critique.md` | Each risk has a proof, a gate or an accepted fallback |
| 9 | Spec: API first, testable criteria, out of scope, release | Priya | `docs/specs/vN.md` | Spec review says GO |
| 10 | Plan the build: units, order, ticket estimates and caps | Priya, Arjun, Bea | Dispatch, estimate | Owner approves spec and estimate together |

Steps 2 and 3 run in parallel and never see each other; that independence is the point of step 3. Ideas the owner didn't pick stay in `research/` with their score and the reason they lost.

## Spec review (the goldfish check)

The agent that wrote the spec with the owner shares the owner's blind spots. Fresh agents that see only the document find what's missing. This borrows the method of Google's Elephant-Goldfish Model ([announcement](https://opensource.googleblog.com/2026/10/introducing-elephant-goldfish-model-plugin.html)), not its plugin.

Each fish gets only the spec and `TEAM.md`, never the conversation or another fish's output. Priya posts one next prompt per fish and Ella starts each; their outputs come back as comments, and Priya commits them in `docs/specs/vN-review/`.

1. **Comprehension.** A fresh Researcher or Critic explains the goal and design back. If Priya says it misread something, the spec is ambiguous: fix and repeat.
2. **Attack.** Two or three independent Critic runs hunt for edge cases, contradictions and hidden dependencies. Every finding is fixed or recorded as accepted risk.
3. **Readiness.** Vera gives GO or NO-GO from the spec alone: are paths, data shapes, API shapes and criteria present, unambiguous and testable? Priya owns what and why; the Architect (multi-unit) or a short Implementer pass fills in the how, and Priya accepts it into the spec.

Only after GO does Priya ask the owner to approve. A change spec needs steps 1 and 3; step 2 is for new products and red-zone changes. Trivial changes skip the review.
