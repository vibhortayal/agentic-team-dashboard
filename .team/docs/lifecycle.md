# Lifecycle map

Every stage a product goes through, from first idea to switching it off, the outside reference it's measured against, and the rule here that covers it. It's how we know the team is complete without waiting for someone to spot a gap. `teamcheck` fails if a row has no rule or a link breaks; the [weekly watch](../playbooks/improve.md#4-weekly-watch) re-checks one phase a week against its references.

| # | Phase | Stage | Reference | Owner | Covered by |
|---|---|---|---|---|---|
| 1 | Discover | Problem, users, success signals | [SWEBOK](https://www.computer.org/education/bodies-of-knowledge/software-engineering) requirements | Ella, Rohan | [Intake](../roles/engagement-lead.md#intake-new-project-or-big-change) |
| 2 | Discover | Worth building: critique, cost, buy or build | [Well-Architected](https://aws.amazon.com/architecture/well-architected/) cost | Quinn, Bea | [Engagement lifecycle](../playbooks/engagement.md#lifecycle) |
| 3 | Discover | Rules that apply | Privacy, accessibility, AI and store rules | Rohan | [Practice and skill review](../playbooks/engagement.md#practice-and-skill-review) |
| 4 | Define | Testable requirements | [Gherkin](https://cucumber.io/docs/gherkin/reference/), spec-driven development | Priya | [Spec template](../templates/spec.md) |
| 5 | Define | Quality targets: load, speed, uptime, data loss | ISO 25010, Well-Architected | Priya, Arjun | [Spec template](../templates/spec.md) |
| 6 | Define | Screens and design system | Platform design guidelines, [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Priya, Quinn | [UI quality](../playbooks/foundation.md#ui-quality-projects-with-screens) |
| 7 | Define | Architecture and decision records | [ADRs](https://adr.github.io/) | Arjun, Priya | [Architecture checks](../playbooks/foundation.md#architecture-checks) |
| 8 | Define | Threat model | [OWASP SAMM](https://owaspsamm.org/) | Quinn | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 9 | Define | Personal data list | Privacy by design | Priya | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 10 | Build | Preview, staging, production | [Twelve-Factor](https://12factor.net/) dev/prod parity | Otto | [Release](../playbooks/production.md#release) |
| 10a | Build | Hosting choice and setup, any provider | Twelve-Factor, the host's own docs and skills | Ella, Rohan, Otto, Bea | [Hosting](../playbooks/foundation.md#hosting) |
| 11 | Build | Config and secrets outside the code | Twelve-Factor config | Otto, Ella | [Agent identity](../playbooks/foundation.md#agent-identity) |
| 12 | Build | Git workflow | [DORA](https://dora.dev/capabilities/trunk-based-development/) trunk-based development | Priya, Otto | [Git workflow](github-state.md#git-workflow-trunk-based-short-lived-branches) |
| 13 | Build | Code quality gates | SWEBOK construction | Otto, Vera | [Quality gate](../playbooks/foundation.md#quality-gate-block-new-violations-only) |
| 14 | Build | Dependencies and supply chain | OWASP SAMM, [SLSA](https://slsa.dev/) | Otto | [Dependency policy](../playbooks/foundation.md#dependency-policy) |
| 15 | Build | Automated tests | SWEBOK testing | Ian, Vera | [Rules](../playbooks/foundation.md#rules) |
| 16 | Build | AI quality evals | Eval-driven development | Max | [When quality is a score](../playbooks/build.md#when-quality-is-a-score) |
| 17 | Build | AI safety and abuse | [OWASP Top 10 for LLM apps](https://genai.owasp.org/llm-top-10/) | Quinn, Max | [AI features and agents](../playbooks/production.md#ai-features-and-agents) |
| 18 | Verify | Independent check | Maker-checker | Vera | [A ticket from start to finish](../playbooks/build.md#a-ticket-from-start-to-finish) |
| 19 | Verify | User acceptance by the owner | UAT | Ella, Vera | [Release](../playbooks/production.md#release) |
| 20 | Verify | Security testing of the running app | [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | Vera | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 21 | Verify | Accessibility and speed | WCAG 2.2, Core Web Vitals | Vera | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 22 | Release | Automated deploy, smoke, rollback, one build promoted | DORA continuous delivery | Otto | [Release](../playbooks/production.md#release) |
| 23 | Release | Feature flags and staged rollout | DORA | Otto, Arjun | [Release](../playbooks/production.md#release) |
| 24 | Release | Database changes that never break the app | Expand and contract | Arjun | [Release](../playbooks/production.md#release) |
| 25 | Release | App stores | Apple and Google review rules | Otto, Priya | [Mobile apps](../playbooks/production.md#mobile-apps) |
| 26 | Release | Launch readiness review | [Google SRE](https://sre.google/books/) production readiness | Otto, owner | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 27 | Operate | Monitoring, uptime target, alerts to a person | Google SRE | Otto | [Monitoring](../playbooks/production.md#monitoring-buy-dont-build) |
| 28 | Operate | Incidents and post-mortems | Google SRE | Otto, Quinn | [Incidents](../playbooks/production.md#incidents) |
| 29 | Operate | Backups and restore drills | Well-Architected reliability | Otto | [Monitoring](../playbooks/production.md#monitoring-buy-dont-build) |
| 30 | Operate | Capacity and scaling | Google SRE | Otto, Bea | [Launch readiness](../playbooks/production.md#launch-readiness) |
| 31 | Operate | Cost control | [FinOps](https://www.finops.org/framework/) | Bea, Otto | [Engagement rules](../playbooks/engagement.md#rules) |
| 32 | Operate | Security upkeep | OWASP SAMM operations | Otto | [Security upkeep](../playbooks/production.md#security-upkeep) |
| 33 | Operate | Support and feedback | Service desk practice | Priya | [Support](../playbooks/production.md#support) |
| 34 | Learn | Analytics and keep, change or stop | DORA user-centric focus | Priya, Bea | [After launch](../playbooks/production.md#after-launch) |
| 35 | Evolve | Code health, renewals, deadlines | Well-Architected operations | Otto | [Code health](../playbooks/production.md#code-health) |
| 36 | Evolve | Handover | Runbooks, bus factor | Priya, Otto | [Handover test](../playbooks/production.md#handover-test) |
| 37 | Retire | Switching it off | Data retention rules | Otto, Priya, Bea | [Retirement](../playbooks/production.md#retirement) |
| 38 | Team | Learning from projects and outside practice | [Agentic practice research](research/agentic-software-company-practices.md) | Max, Rohan, Quinn | [Improve](../playbooks/improve.md) |
