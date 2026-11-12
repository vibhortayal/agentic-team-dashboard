# TEAM.md

This project is staffed from agentic-team (https://github.com/vibhortayal/agentic-team-oss), installed in `.team/`.

- **Profile:** prototype (the owner's choice, 2026-11-10; Ella confirms it at intake) (see `.team/playbooks/engagement.md`, Project profiles). Changes only on the owner's message.
- Team version: `13e79e1`. Roles and playbooks at that version win over anything here about how agents work.
- Agent tools in use: Claude Code; installed with the generic adapter plus the matching tool adapter. State follows `.team/docs/github-state.md`.
- Spec of record: `<paths, e.g. docs/specs/v1.md, docs/specs/v1-openapi.yaml>`; decision records in `docs/decisions/`.
- Main branch: `<main>`. Only the owner merges to it, except what the autonomy stage below allows.
- Autonomy stage: `0` while the gates are built, then `1` (owner merges everything). Moves to 2 or 3 only on the owner's explicit message, linked here: `<link>`, after the entry criteria in the foundation playbook are met (override the numbers here if needed). `CODEOWNERS` is what enforces it.
  - Stage 2: copy, working notes and new tests auto-merge on green CI.
  - Stage 3: also features and fixes inside owned paths auto-merge on green CI.
  - The red zone, gate files and approved documents never auto-merge at any stage.

## Limits (defaults; the Budget Analyst recalibrates from the ledger)

| Limit | Default |
|---|---|
| Tickets in progress at once | 2 |
| Fix rounds per ticket | 3 (trivial: 1) |
| Build sessions per ticket, by size | trivial 4 · S 5 · M 9 · L 13 |
| Spec review sessions per change spec | 2 (comprehension and readiness), counted apart from the build cap |
| Wall-clock per agent session | 60 minutes |
| Cleanup cycle | 2 weeks |
| Weekly status day | `<day>` |
| Standing docs budget (`DOCS_BUDGET`) | 6,000 words across README, AGENTS, TEAM, DESIGN and `docs/*.md` |

Build sessions count prepare, build and verify sessions that end with a team comment: 1 prepare + (1 build + 1 verify) × (1 + fix rounds). Defaults allow S one fix round, M two plus two extra reviews, L three plus four; the third BLOCK still stops any ticket. Spec review and pricing sessions are counted on their own line, so a review never eats a ticket's build budget. Size guide: **S** one module, no new interface, no UI; **M** a few modules or one new interface or screen; **L** several interfaces or screens, or a red-zone path. Anything bigger is split.

## Hired

| Role | Persona | Hired for | Tool and model override (optional) |
|---|---|---|---|
| engagement-lead | Ella | always hired: the owner's single point of contact and guide; can't be removed | |
| product-manager | Priya | spec and dispatch | |
| architect | Arjun | build runs | |
| implementer | Ian | build runs | |
| verifier | Vera | build runs | |
| researcher | Rohan | `<only if research is needed>` | |
| critic | Quinn | `<only if research is needed>` | |
| evaluator | Max | `<only if the product has prompts or models with a quality gate>` | |
| budget-analyst | Bea | estimates, per-ticket caps, spend ledger | |
| ops | Otto | foundation, housekeeping, releases, production and incidents | |

Delete rows for roles this project does not use.

## Units

- A unit is one bounded change: `<e.g. one roadmap item>`.
- Branch: `team/<issue>-<slug>`, one issue per unit (see `.team/docs/github-state.md`, Branches).
- Default scope: `<paths a unit may touch>`
- Protected areas (need an explicit scope grant): `<e.g. migrations, auth, prod config, .github/, .env*>`
- Conventions: `<where code style, naming and test layout are documented>`

## Baseline

Commands that must pass at the base and at the head, from a clean state:
`<install, build, lint, unit tests, e2e>`

## Eval (omit if no AI component has a quality gate)

- Golden sets: `<path>`; scorer: `<command>`
- Gates: `<component: metric ≥ pass mark>`
- Caps and budgets: `<iterations, candidate rounds, API spend per stage>`
- Allowed mode for real data: `<e.g. no-training mode only>`

## Release (omit for research and prototype profiles)

See `.team/playbooks/production.md`, Release.

- Version scheme: `<semver; version file or latest tag>`. Ops tags each production release after the watch window.
- Preview deploy command (per PR, or the single staging slot): `<command>`
- Preview address pattern: `<url>`
- Deployed-version check: `<how to read the deployed revision>`
- Smoke checks: `<commands>`
- Production deploy: `<CI workflow name>`, behind the `production` environment's owner approval
- Watch window: `30 minutes`
- Rollback: `<command>`; backup restore: `<command>`

## Operate (internal and production profiles)

See `.team/playbooks/production.md`. Monitoring services and their monthly cost (owner-approved): `<uptime, errors, logs, backups, cost alerts>`. Where user reports arrive: `<email, form>`.

## Project-specific rules

Rules that only apply here (data, secrets, budgets, owner approvals). Keep them out of the role files.
