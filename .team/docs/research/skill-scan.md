# Skill scan: SkillSpector on every skill

The team's adopted and written skills, scanned with NVIDIA's [SkillSpector](https://github.com/NVIDIA/SkillSpector) the way the [engagement playbook](../../playbooks/engagement.md) says: pinned commit `3c2c5d7a1ee148d228398070b91d3beaf0d73b11` (v2.12.0), own virtual environment, `--no-llm --fail-on-findings --fail-on-incomplete`. Run on 12 November 2026 against `main` at `a8cbee8`. The scanner is an alarm, not a verdict, so every finding below has a line saying why it is harmless or what we do about it.

## Result

14 of 26 skills come back clean. 12 have findings, and the scanner's own label for four of them is "do not install". On a full read, none of the findings is a real problem: no hidden instructions to the agent, nothing that sends data out, nothing that runs on its own. Most hits are security skills quoting the attacks they teach you to stop.

| Skill | Scanner says | Findings | Verdict |
|---|---|---|---|
| sharp-edges | CRITICAL, do not install | 47 | Harmless. Teaching examples of bad code (`rm -rf /`, `../../etc/passwd`, `pickle.loads`, PHP `preg_replace /e`). The CRITICAL "obfuscated PHP webshell" is the `/e` example; the file has no `base64_decode` at all. The agent it names we don't carry; the Architect and Critic roles already say to ignore it. |
| security-and-hardening | CRITICAL, do not install | 21 | Harmless. Quotes `.env`, `.pem`, `169.254.169.254` and "LLM output into eval" as things to defend against. 12 hits are "couldn't fully read a linked file" (see below). |
| accessibility | HIGH, do not install | 11 | Harmless. "Hidden instructions" is an HTML comment `<!-- ✅ With instructions -->` labelling a form example. `npx lighthouse` is unpinned in an upstream example. 9 hits are "couldn't fully read a linked file". |
| owasp-llm | HIGH, do not install | 5 | Harmless. Quotes "Ignore all previous instructions" as an attack example and tells you to look for hidden instructions. |
| k6 | MEDIUM, caution | 14 | Harmless. 13 hits are "couldn't fully read" the example scripts it links. The Ops role already bans its `@latest` builds, remote imports and paid cloud runs. |
| owasp-agentic | MEDIUM, caution | 7 | Harmless. Describes over-privileged agents and credential abuse as risks. |
| webapp-testing | MEDIUM, caution | 4 | Harmless in our use. `scripts/with_server.py` starts the dev server with `shell=True`; the command comes from the agent's own arguments, not from a user or a web page. |
| measure-instrumentation-spec | LOW | 1 | Harmless. An HTML comment in a template tells the writer when to fill in a section. |
| frontend-design | LOW | 1 | Harmless. "Errors don't apologize" is UI writing advice, not "don't refuse". |
| differential-review | LOW | 1 | Harmless. A heading about unchecked return values. |
| performance | LOW | 2 | Harmless. `analytics.example.com` in an async-loading example. |
| screen-review, team-comment | LOW | 1 each | Harmless. "No `allowed-tools` declared." Our own skills. Adding `allowed-tools` would not help: in some tools it pre-approves tools rather than limiting them. |

Clean: core-web-vitals, debug-a-failure, eval-audit, explain-a-step, generate-synthetic-data, property-based-testing, restore-point, security-threat-model, share-check, testable-criteria, validate-evaluator, write-code-eval, write-judge-prompt (and our plugin folder).

**Partial scans.** k6, accessibility, security-and-hardening and sharp-edges were not fully read: the scanner's parser stops at code it can only judge by running it. The unread spans are the k6 example scripts (each runs `http.get` against a test site; `ext-exec.js` runs `date`), the "bad LLM output" TypeScript block in `hardening-patterns.md`, and shell examples in sharp-edges' Java, Python and Ruby notes. We read each one; all are examples, none is run by the team.

## Roles and playbooks

Not skills, but scanned the same way out of interest. 40 findings, no real problem. One HIGH each: "Scale it, don't preach it" (engagement-lead) and "logged without judgement" (research-to-spec) match the scanner's "strip safety warnings" rule. The rest is "lists other skills", which is what a role does.

## What a clean scan doesn't prove

In our earlier test the scanner called a planted skill that merges to `main` and edits tests "SAFE". So a pass here is not a safety check; the full read is. That is why the playbook keeps the scan as an alarm and Quinn reads every file.
